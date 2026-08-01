import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { STATUS } from "@/lib/status";

export const maxDuration = 30;

// The post-charge funnel is user-confirmed because only the user can see what
// actually happened at the merchant and in their bank account. We record their
// confirmation rather than inferring an outcome we have no evidence for.
const Body = z.object({
  to: z.enum([STATUS.orderPlaced, STATUS.returnStarted, STATUS.refundConfirmed]),
  merchantOrderRef: z.string().max(120).nullish(),
});

const ALLOWED: Record<string, string[]> = {
  [STATUS.purchaseAuthorized]: [STATUS.orderPlaced],
  [STATUS.orderPlaced]: [STATUS.returnStarted],
  [STATUS.returnStarted]: [STATUS.refundConfirmed],
};

const EVENT: Record<string, string> = {
  [STATUS.orderPlaced]: "order_placed",
  [STATUS.returnStarted]: "return_started",
  [STATUS.refundConfirmed]: "refund_confirmed",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  }
  const { to, merchantOrderRef } = parsed.data;

  if (!(ALLOWED[item.status] ?? []).includes(to)) {
    return NextResponse.json(
      { error: `This purchase can't move to that step from "${item.status}".` },
      { status: 409 }
    );
  }

  const updated = await prisma.trackedItem.update({
    where: { id },
    data: { status: to, merchantOrderRef: merchantOrderRef ?? item.merchantOrderRef },
  });
  await prisma.agentEvent.create({
    data: {
      itemId: id,
      type: EVENT[to],
      detail: { confirmedByUser: true, merchantOrderRef: merchantOrderRef ?? null },
    },
  });
  return NextResponse.json(updated);
}
