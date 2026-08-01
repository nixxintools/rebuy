import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordPrice } from "@/lib/agent";

export const maxDuration = 60;

// Simulated market feed: set the current price. If the drop rule fires and a
// mandate is active, the agent executes the rebuy autonomously.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { price } = await req.json();
  if (typeof price !== "number" || price <= 0) {
    return NextResponse.json({ error: "price must be a positive number" }, { status: 400 });
  }
  const item = await prisma.trackedItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await recordPrice(id, price, "simulated");
  const updated = await prisma.trackedItem.findUnique({ where: { id } });
  return NextResponse.json({ item: updated, agentResult: result });
}
