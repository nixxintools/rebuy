import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelMandate, PravaError } from "@/lib/prava";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.trackedItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.mandateId) {
    try {
      await cancelMandate(item.mandateId, id);
    } catch (e) {
      // Already consumed/cancelled mandates are fine to revoke locally.
      if (!(e instanceof PravaError)) throw e;
    }
  }
  const updated = await prisma.trackedItem.update({
    where: { id },
    data: { status: "revoked" },
  });
  return NextResponse.json(updated);
}
