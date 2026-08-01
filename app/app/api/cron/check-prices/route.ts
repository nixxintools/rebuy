import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPrice, executeRebuy } from "@/lib/agent";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Scheduled sweep: pulls each watched item's live merchant price and lets the
// agent act. Also closes out items whose return window has passed.
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
    try {
      const r =
        item.status === "drop_detected"
          ? await executeRebuy(item.id)
          : await checkPrice(item.id);
      results.push({ id: item.id, action: "checked", result: r });
    } catch (e) {
      results.push({ id: item.id, action: "error", error: (e as Error).message });
    }
  }
  return NextResponse.json({ checked: items.length, results });
}
