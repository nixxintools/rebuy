import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { createUcpCheckout } from "@/lib/ucp";
import { STATUS } from "@/lib/status";

export const maxDuration = 60;

// Creates (or re-creates — they expire) the real merchant checkout for an item
// whose money is already reserved. Completion stays blocked; see lib/ucp.ts.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  if (item.status !== STATUS.purchaseAuthorized) {
    return NextResponse.json(
      { error: "A checkout is only prepared once the money is reserved." },
      { status: 409 }
    );
  }
  if (!item.variantId) {
    return NextResponse.json({ error: "This item has no linked variant." }, { status: 409 });
  }

  const ucp = await createUcpCheckout({
    merchantDomain: item.retailerUrl.replace(/^https?:\/\//, ""),
    variantId: item.variantId,
    buyerEmail: item.userEmail,
    itemId: id,
  });
  if (!ucp) {
    return NextResponse.json(
      { error: `${item.retailerName} didn't accept an agent checkout right now.` },
      { status: 502 }
    );
  }

  const updated = await prisma.trackedItem.update({
    where: { id },
    data: { ucpCheckoutId: ucp.checkoutId, ucpContinueUrl: ucp.continueUrl },
  });
  return NextResponse.json({ item: updated, ucp });
}
