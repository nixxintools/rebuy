// The agent: reads the merchant's live price, decides, and executes the rebuy
// against an active Prava mandate.
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { chargeMandate, reportCharge, PravaError } from "./prava";
import { fetchProduct } from "./merchants";

const MIN_DROP_DOLLARS = 1;
const MIN_DROP_PCT = 0.02;
const RETURN_BUFFER_DAYS = 5;

export function dropTriggered(purchase: number, current: number, deadline: Date) {
  const meaningful =
    purchase - current >= Math.max(MIN_DROP_DOLLARS, purchase * MIN_DROP_PCT);
  const daysLeft = (deadline.getTime() - Date.now()) / 86400000;
  return meaningful && daysLeft > RETURN_BUFFER_DAYS;
}

// Reads the merchant's live price for a tracked item and acts if it dropped.
export async function checkPrice(itemId: string) {
  const item = await prisma.trackedItem.findUniqueOrThrow({ where: { id: itemId } });
  if (!item.productHandle) throw new Error("This item has no linked merchant product.");

  const live = await fetchProduct(item.merchantId, item.productHandle);
  return recordPrice(itemId, live.price, "merchant_live");
}

export async function recordPrice(itemId: string, price: number, source: string) {
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
        detail: {
          paid: Number(item.purchasePrice),
          livePrice: price,
          source,
          merchant: item.retailerName,
        },
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
  // Idempotent per attempt: a resumed run reuses the reference and de-duplicates,
  // while a genuinely failed attempt can still be retried under a new one.
  const attempts = await prisma.agentEvent.count({
    where: { itemId, type: "rebuy_started" },
  });
  const reference = `${item.mandateId}:rebuy:${attempts}`;

  await prisma.agentEvent.create({
    data: { itemId, type: "rebuy_started", detail: { amount, reference } },
  });

  let charge: Record<string, unknown>;
  try {
    charge = await chargeMandate(item.mandateId, amount, reference, itemId);
  } catch (e) {
    if (e instanceof PravaError) {
      // Expired / not-active / forbidden are expected branches, not crashes.
      const backTo = e.code === "MANDATE_EXPIRED" ? "expired" : "monitoring";
      await prisma.trackedItem.update({ where: { id: itemId }, data: { status: backTo } });
      return { ok: false, code: e.code };
    }
    throw e;
  }

  if ((charge.status as string) === "failed") {
    // e.g. THRESHOLD_EXCEEDED arrives as HTTP 200 with status "failed"
    await prisma.trackedItem.update({ where: { id: itemId }, data: { status: "monitoring" } });
    await prisma.agentEvent.create({
      data: { itemId, type: "rebuy_failed", detail: JSON.parse(JSON.stringify(charge)) },
    });
    return { ok: false, code: (charge.fetchStatus as string) ?? "failed" };
  }

  const transactionId = (charge.transactionId ?? charge.transaction_id) as string;
  try {
    await reportCharge(item.mandateId, transactionId, itemId);
  } catch {
    // A failed report must not lose the completed charge; the audit trail has it.
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
