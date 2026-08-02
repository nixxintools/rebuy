// What the agent tells the user, and when.
//
// Every sentence here is held to the same standard as lib/status.ts: it may only
// say what the code can evidence. A completed Prava charge proves a single-use
// card exists. It does not prove an order exists at the merchant, so no message
// says the item was ordered — the earlier "Repurchase complete" screen is
// exactly the mistake these texts must not repeat in a place the user reads on
// their phone, away from the app, with no way to check.
import { prisma } from "./prisma";
import { linqConfigured, sendText } from "./linq";
import { netSaving } from "./status";

type NotifiableItem = {
  id: string;
  userId: string | null;
  productName: string;
  retailerName: string;
  purchasePrice: unknown;
  rebuyPrice: unknown;
  currentPrice: unknown;
  returnCostUsd: unknown;
  returnDeadline: Date;
};

function usd(v: unknown) {
  return `$${Number(v).toFixed(2)}`;
}

function shortDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function itemUrl(itemId: string) {
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}/items/${itemId}` : null;
}

/**
 * The one way a message reaches a user. Everything that could stop a send —
 * no number, opted out, Linq not configured, already told — is checked here so
 * no caller can skip it.
 *
 * It never throws. A text failing must not roll back a charge that succeeded.
 */
async function notifyOnce(opts: {
  itemId: string | null;
  userId: string | null;
  kind: string;
  /** Written so it stands alone; the link is appended only when allowed. */
  text: string;
  link?: string | null;
}) {
  try {
    if (!opts.userId) return;
    if (!linqConfigured()) return;

    const user = await prisma.user.findUnique({ where: { id: opts.userId } });
    if (!user?.phone || user.smsOptOut) return;

    // Claim the right to send before sending. The unique index on
    // (itemId, kind) is what makes a re-run of the cron sweep silent instead of
    // sending "I spent your money" a second time.
    try {
      await prisma.notification.create({
        data: {
          itemId: opts.itemId,
          userId: user.id,
          kind: opts.kind,
          body: opts.text,
          status: "pending",
        },
      });
    } catch {
      return; // Already claimed by an earlier run.
    }

    // Linq's guidance: a first message to someone must not carry a link, and a
    // new conversation should say who it is and how to stop it.
    const firstEver = !user.linqChatId;
    const body = firstEver
      ? `${opts.text}\n\nThis is Rebuy, the price-drop agent you set up. Reply STOP to stop these.`
      : opts.link
        ? `${opts.text}\n\n${opts.link}`
        : opts.text;

    const result = await sendText({
      to: user.phone,
      text: body,
      chatId: user.linqChatId,
      idempotencyKey: `${opts.itemId ?? user.id}:${opts.kind}`,
    });

    await prisma.notification.updateMany({
      where: { itemId: opts.itemId, kind: opts.kind },
      data: result.ok
        ? {
            status: "sent",
            body,
            messageId: result.messageId,
            protocol: result.protocol,
            error: null,
          }
        : { status: "failed", body, error: result.error.slice(0, 500) },
    });

    if (result.ok && result.chatId && result.chatId !== user.linqChatId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { linqChatId: result.chatId },
      });
    }
  } catch (e) {
    console.error("[rebuy] notify failed", opts.kind, (e as Error).message);
  }
}

/**
 * The agent spent money while the user was elsewhere. This is the message that
 * matters, and the one most at risk of overclaiming — it states plainly that
 * nothing has been ordered yet.
 */
export async function notifyPurchaseAuthorized(item: NotifiableItem) {
  const paid = usd(item.purchasePrice);
  const now = usd(item.rebuyPrice ?? item.currentPrice);
  const net = netSaving(item as never);
  const returnCost = Number(item.returnCostUsd);

  const text =
    `${item.retailerName} dropped ${item.productName} from ${paid} to ${now}.\n\n` +
    `I used the limit you approved, so a single-use card now exists for ${now}. ` +
    `Nothing has been ordered at ${item.retailerName} yet — placing the order is still your step.\n\n` +
    `You keep ${usd(net)} once you send the original back` +
    (returnCost > 0 ? ` (after ${usd(returnCost)} return postage)` : "") +
    `, and it has to be back by ${shortDate(item.returnDeadline)}.`;

  await notifyOnce({
    itemId: item.id,
    userId: item.userId,
    kind: "purchase_authorized",
    text,
    link: itemUrl(item.id),
  });
}

/** The drop was real, the payment was not. Say so rather than going quiet. */
export async function notifyChargeFailed(item: NotifiableItem, code: string) {
  const text =
    `${item.retailerName} dropped ${item.productName} to ${usd(item.currentPrice)}, ` +
    `but the payment didn't go through (${code}). Nothing was charged and nothing was ordered.\n\n` +
    `The price may not last — open Rebuy to try again.`;

  await notifyOnce({
    itemId: item.id,
    userId: item.userId,
    kind: "charge_failed",
    text,
    link: itemUrl(item.id),
  });
}

/**
 * The agent found a drop and deliberately declined to spend. This is the
 * product working, so the user should hear it.
 */
export async function notifyReturnBlocked(item: NotifiableItem) {
  const text =
    `${item.retailerName} dropped ${item.productName} to ${usd(item.currentPrice)}, ` +
    `but I checked their policy first and this one can't be returned. ` +
    `Buying again would have left you with two and no refund, so I didn't spend anything.`;

  await notifyOnce({
    itemId: item.id,
    userId: item.userId,
    kind: "return_blocked",
    text,
    link: itemUrl(item.id),
  });
}
