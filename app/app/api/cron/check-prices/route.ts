import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPrice, executeRebuy } from "@/lib/agent";
import { secretMatches } from "@/lib/auth";
import { getMandate } from "@/lib/prava";
import { STATUS } from "@/lib/status";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Scheduled sweep. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(provided, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.trackedItem.findMany({
    where: { status: { in: [STATUS.monitoring, STATUS.dropDetected, STATUS.watchOnly] } },
  });
  const results: Record<string, unknown>[] = [];

  for (const item of items) {
    // The return window closing ends the opportunity regardless of price.
    if (item.returnDeadline < new Date()) {
      await prisma.trackedItem.update({ where: { id: item.id }, data: { status: STATUS.expired } });
      results.push({ id: item.id, action: "expired" });
      continue;
    }

    // An authorization can lapse well before the return deadline — the agent
    // looks like it's watching when it has actually lost the power to act.
    if (item.mandateId && item.status === STATUS.monitoring) {
      try {
        const mandate = await getMandate(item.mandateId);
        const validUntil = mandate.validUntil ? new Date(mandate.validUntil) : null;
        const dead =
          (validUntil && validUntil < new Date()) ||
          ["expired", "cancelled", "consumed"].includes(String(mandate.status).toLowerCase());
        if (dead) {
          await prisma.trackedItem.update({
            where: { id: item.id },
            data: { status: STATUS.authorizationExpired, mandateExpiresAt: validUntil },
          });
          results.push({ id: item.id, action: "authorization_expired" });
          continue;
        }
        if (validUntil) {
          await prisma.trackedItem.update({
            where: { id: item.id },
            data: { mandateExpiresAt: validUntil },
          });
        }
      } catch {
        // A Prava read failure shouldn't stop the price check.
      }
    }

    try {
      const r =
        item.status === STATUS.dropDetected
          ? await executeRebuy(item.id)
          : await checkPrice(item.id);
      results.push({ id: item.id, action: "checked", result: r });
    } catch (e) {
      results.push({ id: item.id, action: "error", error: (e as Error).message });
    }
  }

  return NextResponse.json({ checked: items.length, results });
}
