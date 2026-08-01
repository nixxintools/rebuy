import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken, createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const base = process.env.APP_BASE_URL ?? req.nextUrl.origin;
  if (!token) return NextResponse.redirect(`${base}/login?error=expired`);

  const user = await consumeLoginToken(token);
  if (!user) return NextResponse.redirect(`${base}/login?error=expired`);

  await createSession(user.id);
  return NextResponse.redirect(`${base}/dashboard`);
}
