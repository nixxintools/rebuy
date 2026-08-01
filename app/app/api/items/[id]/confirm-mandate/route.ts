import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { listMandates } from "@/lib/prava";

export const maxDuration = 30;

// Called after the user returns from Prava's approval page. Prava's mandate list
// carries no session reference, so the new mandate is identified by matching the
// authorization we asked for — this merchant, this ceiling — and never by
// position in the list.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  if (item.mandateId && item.status === "monitoring") {
    return NextResponse.json({ ok: true, mandateId: item.mandateId });
  }

  // A mandate already bound to another purchase must never be reused here.
  const claimed = new Set(
    (
      await prisma.trackedItem.findMany({
        where: { userId: item.userId, mandateId: { not: null }, id: { not: id } },
        select: { mandateId: true },
      })
    ).map((i) => i.mandateId!)
  );

  const mandates = await listMandates(item.userEmail);
  const paid = Number(item.purchasePrice).toFixed(2);

  const candidates = mandates
    .filter((m) => {
      const mandateId = (m.id ?? m.mandateId ?? m.mandate_id) as string | undefined;
      if (!mandateId || claimed.has(mandateId)) return false;
      const usable = (m.status as string) === "active" || (m.state as string) === "available";
      const sameMerchant =
        String(m.merchantName ?? "").toLowerCase() === item.retailerName.toLowerCase();
      const sameCeiling = Number(m.approvedAmount ?? 0).toFixed(2) === paid;
      return usable && sameMerchant && sameCeiling;
    })
    .sort(
      (a, b) =>
        new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime()
    );

  const mandate = candidates[0];
  if (!mandate) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "We couldn't find the authorization you just approved. Finish the approval on Prava, then try again.",
      },
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
      detail: JSON.parse(
        JSON.stringify({
          mandateId,
          matchedOn: { merchant: item.retailerName, ceiling: paid },
          mandate,
        })
      ),
    },
  });
  return NextResponse.json({ ok: true, mandateId });
}
