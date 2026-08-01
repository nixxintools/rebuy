import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listMandates } from "@/lib/prava";

export const maxDuration = 30;

// Called after the user returns from Prava's approval page: find the newly
// active mandate for this user and attach it to the item.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.trackedItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.mandateId && item.status === "monitoring") {
    return NextResponse.json({ ok: true, mandateId: item.mandateId });
  }

  const mandates = await listMandates(item.userEmail);
  const active = mandates.filter(
    (m) => (m.status as string) === "active" || (m.state as string) === "available"
  );
  // Newest active mandate wins; single-user demo keeps this unambiguous.
  const mandate = active[active.length - 1] ?? active[0];
  if (!mandate) {
    return NextResponse.json(
      { ok: false, error: "No active mandate found yet. Complete the approval, then retry." },
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
