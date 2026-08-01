// How Rebuy actually gets paid.
//
// The fee runs on the same primitive as the agent's spending: a Prava mandate,
// scoped to Rebuy as the merchant, approved once by passkey and capped by the
// user. Two properties matter and are enforced here rather than assumed:
//
//  1. We bill in arrears, only on savings the user has *banked* — a refund they
//     confirmed receiving. Charging on an authorized-but-unfinished purchase
//     would take money for a saving that might never materialise.
//  2. One charge per user per period, guaranteed by a unique index and a
//     deterministic reference, so a retried or concurrent run can't double-bill.
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { chargeMandate, reportCharge, PravaError } from "./prava";
import { FEE_RATE, REALIZED_SAVINGS_STATUSES, netSaving } from "./status";

export const FEE_MERCHANT = {
  name: "Rebuy",
  url: "https://rebuy.upthink.app",
  countryCode: "US",
};

/** Default monthly ceiling shown to the user when they approve fee collection. */
export const DEFAULT_FEE_CAP_USD = 50;

export function currentPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Savings banked in a period that we haven't billed for yet. An item counts once:
 * the moment the user confirms the refund arrived.
 */
export async function accruedFees(userId: string, period = currentPeriod()) {
  const [items, alreadyBilled] = await Promise.all([
    prisma.trackedItem.findMany({
      where: { userId, status: { in: [...REALIZED_SAVINGS_STATUSES] } },
    }),
    prisma.feeCharge.findMany({ where: { userId, status: { in: ["pending", "paid"] } } }),
  ]);

  const billedItemIds = new Set(alreadyBilled.flatMap((c) => c.itemIds));
  const unbilled = items.filter((i) => !billedItemIds.has(i.id));

  // Net of what it cost to send the original back. Billing a share of the gross
  // price gap would take money from a user who came out behind.
  const savings = unbilled.reduce((s, i) => s + Math.max(0, netSaving(i)), 0);
  const fee = Math.round(savings * FEE_RATE * 100) / 100;

  return {
    period,
    savings: Math.round(savings * 100) / 100,
    fee,
    itemIds: unbilled.map((i) => i.id),
  };
}

export type BillingOutcome =
  | { ok: true; skipped: "nothing_to_bill" | "already_billed" }
  | { ok: true; charged: number; transactionId: string; period: string }
  | { ok: false; reason: string; code?: string };

/** Charge a user's accrued fees for a period. Safe to run more than once. */
export async function billUser(userId: string, period = currentPeriod()): Promise<BillingOutcome> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.feeMandateId) {
    return { ok: false, reason: "No fee authorization — the user hasn't approved collection." };
  }

  const existing = await prisma.feeCharge.findUnique({
    where: { userId_period: { userId, period } },
  });
  if (existing && existing.status === "paid") {
    return { ok: true, skipped: "already_billed" };
  }

  let record = existing;
  let amount: number;

  if (record) {
    // A record that isn't "paid" was interrupted — between the Prava call and
    // our write, or by a decline. It must be retried on its ORIGINAL amount and
    // reference: recomputing accruals here would find nothing, because this very
    // record already claims those items, and the charge would be abandoned with
    // the money possibly already taken.
    amount = Number(record.amount);
  } else {
    const accrued = await accruedFees(userId, period);
    if (accrued.fee <= 0) return { ok: true, skipped: "nothing_to_bill" };

    const cap = Number(user.feeMandateCapUsd ?? DEFAULT_FEE_CAP_USD);
    amount = Math.min(accrued.fee, cap);
    record = await prisma.feeCharge.create({
      data: {
        userId,
        period,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        savingsBase: new Prisma.Decimal(accrued.savings.toFixed(2)),
        itemIds: accrued.itemIds,
        reference: `${user.feeMandateId}:fee:${period}`,
        status: "pending",
      },
    });
  }

  // Reuse the stored reference so Prava de-duplicates a retry rather than
  // charging twice.
  const reference = record.reference;

  try {
    // The same reference always maps to the same charge, so a retry after a
    // crash returns the original rather than taking the money twice.
    const charge = await chargeMandate(user.feeMandateId, amount.toFixed(2), reference, null);

    // Only a terminal success status with a transaction id counts as paid. An
    // unrecognised status must stay pending and be reconciled, never be recorded
    // as money we collected.
    const chargeStatus = String(charge.status ?? "");
    const transactionId = (charge.transactionId ?? charge.transaction_id) as string | undefined;
    const succeeded =
      Boolean(transactionId) &&
      ["awaiting_result", "completed", "succeeded"].includes(chargeStatus);

    if (!succeeded) {
      const code =
        (charge.errorCode as string) ??
        (chargeStatus === "failed" ? "CHARGE_FAILED" : `UNCONFIRMED_${chargeStatus || "NO_STATUS"}`);
      await prisma.feeCharge.update({
        where: { id: record.id },
        data: {
          // Unconfirmed is not failed — leave it retryable rather than writing
          // off a charge that may have succeeded.
          status: chargeStatus === "failed" ? "failed" : "pending",
          failureCode: code,
        },
      });
      return { ok: false, reason: "The fee charge was not confirmed.", code };
    }
    try {
      await reportCharge(user.feeMandateId, transactionId!, null);
    } catch {
      // Reporting failure must not lose a completed charge.
    }

    await prisma.feeCharge.update({
      where: { id: record.id },
      data: { status: "paid", transactionId, failureCode: null },
    });
    return { ok: true, charged: amount, transactionId: transactionId!, period };
  } catch (e) {
    const code = e instanceof PravaError ? e.code : "UNKNOWN";
    await prisma.feeCharge.update({
      where: { id: record.id },
      data: { status: "failed", failureCode: code },
    });
    return { ok: false, reason: "Could not charge the fee authorization.", code };
  }
}
