// The agent: reads the merchant's live price, decides, and — if the user has
// granted spending power — charges their Prava authorization.
//
// The hard rule here is that a state must be justified by evidence we hold. A
// completed mandate charge proves a card credential was issued; it does not
// prove an order exists at the merchant, so it never claims one.
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { chargeMandate, reportCharge, getMandate, PravaError } from "./prava";
import { fetchProduct, MerchantUnavailableError } from "./merchants";
import { STATUS } from "./status";

const MIN_DROP_DOLLARS = 1;
const MIN_DROP_PCT = 0.02;
const RETURN_BUFFER_DAYS = 5;

/**
 * The drop has to clear what it costs to return the original, otherwise "acting"
 * makes the user poorer. Return cost is part of the decision, not a footnote.
 */
export function dropTriggered(
  purchase: number,
  current: number,
  deadline: Date,
  returnCost: number
) {
  const net = purchase - current - returnCost;
  const meaningful = net >= Math.max(MIN_DROP_DOLLARS, purchase * MIN_DROP_PCT);
  const daysLeft = (deadline.getTime() - Date.now()) / 86400000;
  return meaningful && daysLeft > RETURN_BUFFER_DAYS;
}

/** Reads the merchant's live price for a tracked item and acts if it dropped. */
export async function checkPrice(itemId: string) {
  const item = await prisma.trackedItem.findUniqueOrThrow({ where: { id: itemId } });
  if (!item.productHandle) throw new Error("This item has no linked merchant product.");

  const live = await fetchProduct(item.merchantId, item.productHandle, item.variantId ?? undefined);
  return recordPrice(itemId, live.price, "merchant_live");
}

export async function recordPrice(itemId: string, price: number, source: string) {
  const item = await prisma.trackedItem.findUniqueOrThrow({ where: { id: itemId } });
  await prisma.pricePoint.create({
    data: { itemId, price: new Prisma.Decimal(price.toFixed(2)), source },
  });
  await prisma.trackedItem.update({
    where: { id: itemId },
    data: { currentPrice: new Prisma.Decimal(price.toFixed(2)), lastCheckedAt: new Date() },
  });

  if (
    item.status === STATUS.monitoring &&
    dropTriggered(Number(item.purchasePrice), price, item.returnDeadline, Number(item.returnCostUsd))
  ) {
    await prisma.trackedItem.update({
      where: { id: itemId },
      data: { status: STATUS.dropDetected },
    });
    await prisma.agentEvent.create({
      data: {
        itemId,
        type: "drop_detected",
        detail: {
          paid: Number(item.purchasePrice),
          livePrice: price,
          returnCost: Number(item.returnCostUsd),
          netSaving: (Number(item.purchasePrice) - price - Number(item.returnCostUsd)).toFixed(2),
          source,
          merchant: item.retailerName,
        },
      },
    });
    return executeRebuy(itemId);
  }
  return null;
}

export async function executeRebuy(itemId: string) {
  const item = await prisma.trackedItem.findUniqueOrThrow({ where: { id: itemId } });
  if (item.status !== STATUS.dropDetected || !item.mandateId) return null;
  const amount = Number(item.currentPrice).toFixed(2);

  // Never spend against an authorization that isn't the one shown to the user.
  // Prava enforces scope and ceiling too, but a mismatch means our own interface
  // has misdescribed what was granted — so stop and say so.
  const authority = await getMandate(item.mandateId);
  const merchantMatches =
    String(authority.merchantName ?? "").toLowerCase() === item.retailerName.toLowerCase();
  const ceilingCoversCharge = Number(authority.approvedAmount) >= Number(amount);
  if (!merchantMatches || !ceilingCoversCharge) {
    await prisma.trackedItem.update({
      where: { id: itemId },
      data: { status: STATUS.ingested, mandateId: null, failureCode: "AUTHORIZATION_MISMATCH" },
    });
    await prisma.agentEvent.create({
      data: {
        itemId,
        type: "authorization_mismatch",
        detail: {
          reason: !merchantMatches ? "merchant_scope" : "ceiling_too_low",
          expectedMerchant: item.retailerName,
          authorizedMerchant: authority.merchantName,
          authorizedCeiling: authority.approvedAmount,
          attemptedAmount: amount,
        },
      },
    });
    return { ok: false, code: "AUTHORIZATION_MISMATCH" };
  }

  // Idempotency is keyed to a stored counter rather than a count of past events,
  // so adding states between "charged" and "ordered" can't silently mint a new
  // reference and defeat de-duplication.
  const attempt = item.rebuyAttempts + 1;
  const reference = `${item.mandateId}:rebuy:${attempt}`;
  await prisma.trackedItem.update({
    where: { id: itemId },
    data: { rebuyAttempts: attempt, chargeReference: reference },
  });
  await prisma.agentEvent.create({
    data: { itemId, type: "rebuy_started", detail: { amount, reference, attempt } },
  });

  let charge: Record<string, unknown>;
  try {
    charge = await chargeMandate(item.mandateId, amount, reference, itemId);
  } catch (e) {
    if (e instanceof PravaError) {
      const expired = e.code === "MANDATE_EXPIRED" || e.code === "MANDATE_NOT_ACTIVE";
      await prisma.trackedItem.update({
        where: { id: itemId },
        data: {
          status: expired ? STATUS.authorizationExpired : STATUS.chargeFailed,
          failureCode: e.code,
        },
      });
      await prisma.agentEvent.create({
        data: { itemId, type: "rebuy_failed", detail: { code: e.code, responseId: e.responseId } },
      });
      return { ok: false, code: e.code };
    }
    throw e;
  }

  // Treat only positively-evidenced success as success. Anything else — an
  // unrecognised status, or a response with no transaction id — must not put the
  // user on a screen telling them a card was issued and inviting them to return
  // their original.
  const chargeStatus = String(charge.status ?? "");
  const transactionId = (charge.transactionId ?? charge.transaction_id) as string | undefined;
  const succeeded =
    Boolean(transactionId) && ["awaiting_result", "completed", "succeeded"].includes(chargeStatus);

  if (!succeeded) {
    const code =
      (charge.errorCode as string) ??
      (chargeStatus === "failed" ? "CHARGE_FAILED" : `UNCONFIRMED_${chargeStatus || "NO_STATUS"}`);
    await prisma.trackedItem.update({
      where: { id: itemId },
      data: { status: STATUS.chargeFailed, failureCode: code },
    });
    await prisma.agentEvent.create({
      data: { itemId, type: "rebuy_failed", detail: JSON.parse(JSON.stringify(charge)) },
    });
    return { ok: false, code };
  }

  try {
    await reportCharge(item.mandateId, transactionId!, itemId);
  } catch {
    // A failed report must never lose a completed charge; the audit trail has it.
  }

  // Money is committed and a single-use card exists. No order has been placed at
  // the merchant — that is the user's next step, and the status says exactly that.
  await prisma.trackedItem.update({
    where: { id: itemId },
    data: {
      status: STATUS.purchaseAuthorized,
      rebuyPrice: new Prisma.Decimal(amount),
      chargeTransactionId: transactionId!,
      failureCode: null,
    },
  });
  await prisma.agentEvent.create({
    data: {
      itemId,
      type: "purchase_authorized",
      detail: {
        transactionId,
        amount,
        deduplicated: (charge.deduplicated as boolean) ?? false,
        returnCost: Number(item.returnCostUsd),
        netSavingIfReturned: (
          Number(item.purchasePrice) - Number(amount) - Number(item.returnCostUsd)
        ).toFixed(2),
      },
    },
  });
  return { ok: true, transactionId };
}

export { MerchantUnavailableError };
