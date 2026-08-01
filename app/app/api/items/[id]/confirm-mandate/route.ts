import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { listMandates } from "@/lib/prava";

export const maxDuration = 30;

// Called after the user returns from Prava's approval page: find the newly
// active mandate for this user and attach it to the item.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  if (item.mandateId && item.status === "monitoring") {
    return NextResponse.json({ ok: true, mandateId: item.mandateId });
  }

  const mandates = await listMandates(item.userEmail);
  const active = mandates.filter(
    (m) => (m.status as string) === "active" || (m.state as string) === "available"
  );
  const mandate = active[active.length - 1] ?? active[0];
  if (!mandate) {
    return NextResponse.json(
      { ok: false, error: "No active authorization found yet. Finish the approval, then retry." },
      { status: 404 }
    );
  }

  const mandateId = (mandate.id ?? mandate.mandateId ?? mandate.mandate_id) as string;
  await prisma.trackedItem.update({
    where: { id },
    data: { mandateId, status: "monitoring" },
  });
  await prisma.agentEvent.create({
    data: {
      itemId: id,
      type: "mandate_active",
      detail: JSON.parse(JSON.stringify({ mandateId, mandate })),
    },
  });
  return NextResponse.json({ ok: true, mandateId });
}
