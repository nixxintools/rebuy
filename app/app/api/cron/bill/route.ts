import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secretMatches } from "@/lib/auth";
import { billUser, currentPeriod } from "@/lib/billing";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Monthly billing run. Prava allows one charge per cycle on a recurring mandate,
// which maps exactly onto one billing period per user.
export async function GET(req: NextRequest) {
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(provided, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = req.nextUrl.searchParams.get("period") ?? currentPeriod();
  const users = await prisma.user.findMany({ where: { feeMandateId: { not: null } } });

  const results = [];
  for (const user of users) {
    results.push({ user: user.email, ...(await billUser(user.id, period)) });
  }
  return NextResponse.json({ period, billed: results.length, results });
}
