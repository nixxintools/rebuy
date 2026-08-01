import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dropTriggered, executeRebuy } from "@/lib/agent";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Hourly sweep: re-evaluates monitored items against their latest price and
// expires items whose return window closed.
export async function GET() {
  const items = await prisma.trackedItem.findMany({
    where: { status: { in: ["monitoring", "drop_detected"] } },
  });
  const results: Record<string, unknown>[] = [];
  for (const item of items) {
    if (item.returnDeadline < new Date()) {
      await prisma.trackedItem.update({
        where: { id: item.id },
        data: { status: "expired" },
      });
      results.push({ id: item.id, action: "expired" });
      continue;
    }
    if (
      item.status === "drop_detected" ||
      dropTriggered(Number(item.purchasePrice), Number(item.currentPrice), item.returnDeadline)
    ) {
      if (item.status === "monitoring") {
        await prisma.trackedItem.update({
          where: { id: item.id },
          data: { status: "drop_detected" },
        });
      }
      const r = await executeRebuy(item.id);
      results.push({ id: item.id, action: "execute", result: r });
    } else {
      results.push({ id: item.id, action: "none" });
    }
  }
  return NextResponse.json({ checked: items.length, results });
}
