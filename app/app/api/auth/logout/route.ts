import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(`${process.env.APP_BASE_URL ?? req.nextUrl.origin}/`, 303);
}
