import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { checkPrice } from "@/lib/agent";
import { MerchantUnavailableError } from "@/lib/merchants";

export const maxDuration = 60;

// Re-reads the merchant's live price now. If the drop rule fires and an
// authorization is active, the agent executes the rebuy autonomously.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  try {
    const agentResult = await checkPrice(id);
    const updated = await prisma.trackedItem.findUnique({ where: { id } });
    return NextResponse.json({ item: updated, agentResult });
  } catch (e) {
    const unavailable = e instanceof MerchantUnavailableError;
    return NextResponse.json(
      { error: (e as Error).message, unavailable },
      { status: unavailable ? 503 : 502 }
    );
  }
}
