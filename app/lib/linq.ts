// Talking to Linq — the agent's phone number. Linq delivers over iMessage, RCS
// or plain SMS and picks whichever the recipient can receive.
//
// Two rules from Linq's own guidance are enforced here rather than left to the
// caller: the first message we ever send someone may not contain a link, and a
// recipient who has opted out is never messaged again. Both are checked in
// lib/notify.ts, which is the only thing that should call sendToUser().
import { createHmac, timingSafeEqual } from "crypto";

const BASE = process.env.LINQ_API_BASE ?? "https://api.linqapp.com/api/partner/v3";

export function linqConfigured() {
  return Boolean(process.env.LINQ_API_KEY && process.env.LINQ_FROM_NUMBER);
}

/**
 * Linq requires E.164. We accept what a person would actually type and reject
 * anything we can't be sure about — texting a wrong number is worse than not
 * texting at all, because the message says money was spent.
 */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  // A bare 10-digit number is North American; 11 digits starting with 1 is the
  // same number written with its country code. Anything else needs a "+" and we
  // will not guess a country on the user's behalf.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Last four digits, for showing the user which number we hold. */
export function maskPhone(e164: string) {
  return `••• ••• ${e164.slice(-4)}`;
}

type SendResult =
  | { ok: true; chatId: string | null; messageId: string | null; protocol: string | null }
  | { ok: false; error: string };

async function call(path: string, body: unknown): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LINQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `network: ${(e as Error).message}` };
  }

  const text = await res.text();
  if (!res.ok) {
    console.error("[rebuy] linq send failed", res.status, text);
    return { ok: false, error: `${res.status}: ${text.slice(0, 300)}` };
  }

  // Their response nests differently between the create-chat and send-to-chat
  // endpoints, so read defensively rather than assuming one shape.
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: true, chatId: null, messageId: null, protocol: null };
  }
  const data = (json.data ?? json) as Record<string, unknown>;
  const chat = (data.chat ?? {}) as Record<string, unknown>;
  const message = (data.message ?? data) as Record<string, unknown>;
  return {
    ok: true,
    chatId: str(data.chat_id ?? data.chatId ?? chat.id ?? message.chat_id ?? message.chatId),
    messageId: str(message.id ?? data.id),
    protocol: str(message.protocol ?? message.service ?? data.protocol),
  };
}

function str(v: unknown) {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
}

/**
 * Send text to a number. Pass the chat id we already hold with that person, if
 * any — Linq keeps the thread in one bubble rather than starting a new one.
 */
export async function sendText(opts: {
  to: string;
  text: string;
  chatId?: string | null;
  idempotencyKey: string;
}): Promise<SendResult> {
  if (!linqConfigured()) return { ok: false, error: "linq_not_configured" };

  const message = {
    parts: [{ type: "text", value: opts.text }],
    idempotency_key: opts.idempotencyKey.slice(0, 255),
  };

  if (opts.chatId) {
    const sent = await call(`/chats/${encodeURIComponent(opts.chatId)}/messages`, { message });
    // A chat id can go stale. Falling back to opening a new one keeps the news
    // from being silently dropped.
    if (sent.ok) return { ...sent, chatId: sent.chatId ?? opts.chatId };
  }

  return call("/chats", {
    from: process.env.LINQ_FROM_NUMBER,
    to: [opts.to],
    message,
  });
}

/**
 * Standard Webhooks verification. Without this, anyone who finds the URL can
 * post "STOP" as another user and silence their alerts, or fake an inbound
 * message. Returns false on anything it cannot positively verify.
 */
export function verifyWebhook(opts: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  secret: string | undefined;
}): boolean {
  const { id, timestamp, signature, body, secret } = opts;
  if (!id || !timestamp || !signature || !secret) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(Date.now() / 1000 - sentAt) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // The header may carry several space-separated versioned signatures during a
  // secret rotation; any one of them matching is a pass.
  return signature.split(" ").some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : part;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
