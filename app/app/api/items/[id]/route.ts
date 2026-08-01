import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  const full = await prisma.trackedItem.findUnique({
    where: { id },
    include: {
      prices: { orderBy: { at: "asc" } },
      events: { orderBy: { at: "desc" } },
    },
  });
  return NextResponse.json(full);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;
  await prisma.trackedItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
