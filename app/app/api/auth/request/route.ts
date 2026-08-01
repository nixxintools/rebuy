import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLoginToken } from "@/lib/auth";
import { sendMagicLink, emailConfigured, insecureLinkFallbackEnabled } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({ email: z.string().email() });

const WINDOW_MS = 15 * 60_000;
const MAX_IN_WINDOW = 5;

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();

  if (!emailConfigured() && !insecureLinkFallbackEnabled()) {
    return NextResponse.json(
      { error: "Sign-in email isn't configured yet. Please try again shortly." },
      { status: 503 }
    );
  }

  // Throttle against issued tokens rather than an in-process counter: serverless
  // instances don't share memory, so an in-memory map throttles unpredictably —
  // and a silently throttled request left the user with no link and no reason.
  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await prisma.loginToken.count({
    where: { user: { email }, createdAt: { gte: since } },
  });
  if (recent >= MAX_IN_WINDOW) {
    return NextResponse.json(
      {
        error:
          "Too many sign-in links requested. Use the most recent link, or wait a few minutes and try again.",
      },
      { status: 429 }
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
