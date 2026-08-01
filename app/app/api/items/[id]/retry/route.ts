import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { checkPrice } from "@/lib/agent";
import { STATUS } from "@/lib/status";

export const maxDuration = 60;

// "Try again" after a failed charge. The price endpoint alone couldn't do this:
// recordPrice only acts from `monitoring`, so retrying from `charge_failed` just
// refreshed the price and left the same failure on screen.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  if (item.status !== STATUS.chargeFailed) {
    return NextResponse.json({ error: "There's no failed purchase to retry." }, { status: 409 });
  }
  if (!item.mandateId) {
    return NextResponse.json(
      { error: "This purchase no longer has an active authorization." },
      { status: 409 }
    );
  }

  await prisma.trackedItem.update({
    where: { id },
    data: { status: STATUS.monitoring, failureCode: null },
  });

  try {
    const agentResult = await checkPrice(id);
    const updated = await prisma.trackedItem.findUnique({ where: { id } });
    return NextResponse.json({ item: updated, agentResult });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
