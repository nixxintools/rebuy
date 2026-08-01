import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { cancelMandate, PravaError } from "@/lib/prava";

export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  if (item.mandateId) {
    try {
      await cancelMandate(item.mandateId, id);
    } catch (e) {
      // Already consumed or cancelled authorizations are fine to clear locally.
      if (!(e instanceof PravaError)) throw e;
    }
  }
  const updated = await prisma.trackedItem.update({
    where: { id },
    data: { status: "revoked" },
  });
  return NextResponse.json(updated);
}
