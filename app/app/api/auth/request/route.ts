import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLoginToken } from "@/lib/auth";
import { sendMagicLink, emailConfigured, insecureLinkFallbackEnabled } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({ email: z.string().email() });

// Simple per-address throttle. In-memory is fine at this scale.
const attempts = new Map<string, number[]>();
const WINDOW_MS = 15 * 60_000;
const MAX_IN_WINDOW = 3;

function rateLimited(email: string) {
  const now = Date.now();
  const recent = (attempts.get(email) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_IN_WINDOW) return true;
  recent.push(now);
  attempts.set(email, recent);
  return false;
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();

  // Always answer identically so the endpoint can't be used to discover accounts.
  if (rateLimited(email)) {
    return NextResponse.json({ ok: true, delivered: true });
  }

  if (!emailConfigured() && !insecureLinkFallbackEnabled()) {
    return NextResponse.json(
      { error: "Sign-in email isn't configured yet. Please try again shortly." },
      { status: 503 }
    );
  }

  const { raw } = await createLoginToken(email);
  const url = `${process.env.APP_BASE_URL}/api/auth/callback?token=${raw}`;
  const result = await sendMagicLink(email, url);

  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    // Deliberately opt-in only — see insecureLinkFallbackEnabled().
    devUrl: insecureLinkFallbackEnabled() ? result.url : undefined,
  });
}
