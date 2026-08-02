// Inbound from Linq: replies the user sends to the agent's number.
//
// Two things here are not optional. The signature is verified before anything
// is read, because an unverified endpoint lets anyone post "STOP" as somebody
// else and silence the alerts that tell them their money moved. And STOP is
// honoured immediately, before any other handling.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhook, sendText, toE164, linqConfigured } from "@/lib/linq";
import { netSaving, STATUS, statusMeta } from "@/lib/status";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STOP_WORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"];
const START_WORDS = ["start", "unstop", "yes"];

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (
    !verifyWebhook({
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
      body: raw,
      secret: process.env.LINQ_WEBHOOK_SECRET,
    })
  ) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const eventId = req.headers.get("webhook-id")!;
  const type = String(event.type ?? event.event ?? "unknown");
  const data = (event.data ?? event) as Record<string, unknown>;

  // Their delivery is at-least-once, so a repeat of an id we've already stored
  // is a duplicate and must not produce a second reply.
  const message = extractMessage(data);
  try {
    await prisma.linqEvent.create({
      data: {
        id: eventId,
        type,
        fromPhone: message.from,
        body: message.text,
        payload: JSON.parse(raw),
      },
    });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (type !== "message.received" || !message.from) {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const user = await prisma.user.findFirst({ where: { phone: message.from } });
  if (!user) return NextResponse.json({ ok: true, unknownSender: true });

  const word = (message.text ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");

  if (STOP_WORDS.includes(word)) {
    await prisma.user.update({ where: { id: user.id }, data: { smsOptOut: true } });
    // One last message confirming the stop is what a person expects, and is the
    // standard for every other SMS sender. Nothing follows it.
    await reply(user.phone!, user.linqChatId, eventId, "Stopped. Rebuy won't text you again. Your price watching carries on in the app — turn texts back on there, or reply START.");
    return NextResponse.json({ ok: true, action: "opted_out" });
  }

  if (user.smsOptOut && !START_WORDS.includes(word)) {
    return NextResponse.json({ ok: true, action: "ignored_opted_out" });
  }

  if (START_WORDS.includes(word)) {
    await prisma.user.update({ where: { id: user.id }, data: { smsOptOut: false } });
    await reply(user.phone!, user.linqChatId, eventId, "Texts are back on. I'll message you when a price drops and I act on it.");
    return NextResponse.json({ ok: true, action: "opted_in" });
  }

  await reply(user.phone!, user.linqChatId, eventId, await summaryFor(user.id, word));
  return NextResponse.json({ ok: true, action: "replied" });
}

/** What the user is owed an answer about, in the order they'd ask. */
async function summaryFor(userId: string, word: string) {
  const items = await prisma.trackedItem.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  if (items.length === 0) {
    return "Nothing is being watched right now. Add an order confirmation in the app and I'll watch that shop's price for you.";
  }

  const waiting = items.filter((i) => i.status === STATUS.purchaseAuthorized);
  const watching = items.filter((i) => i.status === STATUS.monitoring);
  const banked = items.filter((i) => i.status === STATUS.refundConfirmed);

  // Anything that needs the user is the answer, whatever they asked.
  if (waiting.length > 0) {
    const lines = waiting.map(
      (i) =>
        `• ${i.retailerName} ${i.productName}: card issued for $${Number(i.rebuyPrice).toFixed(2)}. ` +
        `Not ordered yet — that's your step, and the original has to be back by ` +
        `${i.returnDeadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
    );
    return `${lines.join("\n")}\n\nOpen Rebuy to finish those.`;
  }

  const bankedTotal = banked.reduce((s, i) => s + netSaving(i), 0);
  const parts = [
    watching.length > 0
      ? `Watching ${watching.length} item${watching.length === 1 ? "" : "s"}. Nothing has dropped far enough to be worth returning for.`
      : `Nothing is being watched right now.`,
  ];
  if (bankedTotal > 0) parts.push(`$${bankedTotal.toFixed(2)} banked so far.`);

  const other = items.find(
    (i) => ![STATUS.monitoring, STATUS.refundConfirmed, STATUS.purchaseAuthorized].includes(i.status as never)
  );
  if (other) parts.push(`${other.productName}: ${statusMeta(other.status).label.toLowerCase()}.`);

  if (!["status", "", "hi", "hey", "hello"].includes(word)) {
    parts.push(`I only understand STATUS and STOP here — everything else is in the app.`);
  }
  return parts.join(" ");
}

async function reply(to: string, chatId: string | null, eventId: string, text: string) {
  if (!linqConfigured()) return;
  await sendText({ to, text, chatId, idempotencyKey: `reply:${eventId}` });
}

/** Their payload nests the sender and text differently by event; read loosely. */
function extractMessage(data: Record<string, unknown>) {
  const message = (data.message ?? data) as Record<string, unknown>;
  const rawFrom =
    data.from ?? data.handle ?? data.sender ?? message.from ?? message.handle ?? message.sender;
  const from =
    typeof rawFrom === "string"
      ? toE164(rawFrom)
      : typeof (rawFrom as Record<string, unknown>)?.handle === "string"
        ? toE164(String((rawFrom as Record<string, unknown>).handle))
        : null;

  const parts = (message.parts ?? data.parts) as { type?: string; value?: string }[] | undefined;
  const text = Array.isArray(parts)
    ? parts
        .filter((p) => p.type === "text" && typeof p.value === "string")
        .map((p) => p.value)
        .join(" ")
        .trim()
    : typeof message.text === "string"
      ? message.text
      : null;

  return { from, text: text || null };
}
