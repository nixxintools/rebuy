import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPrice } from "@/lib/agent";

export const maxDuration = 60;

// Re-reads the merchant's live price now. If the drop rule fires and a mandate
// is active, the agent executes the rebuy autonomously.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.trackedItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const agentResult = await checkPrice(id);
    const updated = await prisma.trackedItem.findUnique({ where: { id } });
    return NextResponse.json({ item: updated, agentResult });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
