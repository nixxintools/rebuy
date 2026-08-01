// The agent: decides and executes the rebuy against an active mandate.
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { chargeMandate, reportCharge, PravaError } from "./prava";

const MIN_DROP_DOLLARS = 1;
const MIN_DROP_PCT = 0.02;
const RETURN_BUFFER_DAYS = 5;

export function dropTriggered(purchase: number, current: number, deadline: Date) {
  const meaningful =
    purchase - current >= Math.max(MIN_DROP_DOLLARS, purchase * MIN_DROP_PCT);
  const daysLeft = (deadline.getTime() - Date.now()) / 86400000;
  return meaningful && daysLeft > RETURN_BUFFER_DAYS;
}

export async function recordPrice(itemId: string, price: number, source = "simulated") {
  const item = await prisma.trackedItem.findUniqueOrThrow({ where: { id: itemId } });
  await prisma.pricePoint.create({
    data: { itemId, price: new Prisma.Decimal(price.toFixed(2)), source },
  });
  await prisma.trackedItem.update({
    where: { id: itemId },
    data: { currentPrice: new Prisma.Decimal(price.toFixed(2)) },
  });
  if (
    item.status === "monitoring" &&
    dropTriggered(Number(item.purchasePrice), price, item.returnDeadline)
  ) {
    await prisma.trackedItem.update({
      where: { id: itemId },
      data: { status: "drop_detected" },
    });
    await prisma.agentEvent.create({
      data: {
        itemId,
        type: "drop_detected",
        detail: { purchasePrice: Number(item.purchasePrice), newPrice: price },
      },
    });
    return executeRebuy(itemId);
  }
  return null;
}

// Idempotent by design: deterministic charge reference + status guards.
export async function executeRebuy(itemId: string) {
  const item = await prisma.trackedItem.findUniqueOrThrow({ where: { id: itemId } });
  if (item.status !== "drop_detected" || !item.mandateId) return null;
  const amount = Number(item.currentPrice).toFixed(2);
  const reference = `${item.mandateId}:rebuy`;

  await prisma.agentEvent.create({
    data: { itemId, type: "rebuy_started", detail: { amount, reference } },
  });

  let charge: Record<string, unknown>;
  try {
    charge = await chargeMandate(item.mandateId, amount, reference, itemId);
  } catch (e) {
    if (e instanceof PravaError) {
      // Expired / not-active / forbidden are expected branches, not crashes.
      const backTo =
        e.code === "MANDATE_EXPIRED" ? "expired" : "monitoring";
      await prisma.trackedItem.update({
        where: { id: itemId },
        data: { status: backTo },
      });
      return { ok: false, code: e.code };
    }
    throw e;
  }

  const status = charge.status as string | undefined;
  if (status === "failed") {
    // e.g. THRESHOLD_EXCEEDED comes back as 200 + failed
    await prisma.trackedItem.update({
      where: { id: itemId },
      data: { status: "monitoring" },
    });
    await prisma.agentEvent.create({
      data: { itemId, type: "rebuy_failed", detail: JSON.parse(JSON.stringify(charge)) },
    });
    return { ok: false, code: (charge.fetchStatus as string) ?? "failed" };
  }

  const transactionId = (charge.transactionId ?? charge.transaction_id) as string;
  try {
    await reportCharge(item.mandateId, transactionId, itemId);
  } catch {
    // Reporting failure shouldn't lose the completed charge; audit trail has it.
  }

  await prisma.trackedItem.update({
    where: { id: itemId },
    data: { status: "return_ready", rebuyPrice: item.currentPrice },
  });
  await prisma.agentEvent.create({
    data: {
      itemId,
      type: "rebuy_complete",
      detail: {
        transactionId,
        amount,
        deduplicated: (charge.deduplicated as boolean) ?? false,
        savings: (Number(item.purchasePrice) - Number(amount)).toFixed(2),
      },
    },
  });
  return { ok: true, transactionId };
}
