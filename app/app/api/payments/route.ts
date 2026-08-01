import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { getMandate, type MandateDetail } from "@/lib/prava";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FEE_RATE = 0.15;

// Everything the payments page needs: the spend authorizations this user has
// granted, the charges made against them, and what they've earned net of fees.
export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const items = await prisma.trackedItem.findMany({
    where: { userId: user.id, mandateId: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  const authorizations = (
    await Promise.all(
      items.map(async (item) => {
        let mandate: MandateDetail | null = null;
        try {
          mandate = await getMandate(item.mandateId!);
        } catch {
          // A mandate that Prava can no longer resolve shouldn't break the page.
        }
        return {
          itemId: item.id,
          productName: item.productName,
          imageUrl: item.imageUrl,
          merchantName: item.retailerName,
          itemStatus: item.status,
          currency: item.currency,
          mandateId: item.mandateId,
          mandate,
        };
      })
    )
  ).filter((a) => a.mandate !== null);

  const charges = authorizations
    .flatMap((a) =>
      (a.mandate?.charges ?? []).map((c) => ({
        ...c,
        productName: a.productName,
        merchantName: a.merchantName,
        itemId: a.itemId,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const saved = items
    .filter((i) => i.status === "return_ready" && i.rebuyPrice)
    .reduce((s, i) => s + (Number(i.purchasePrice) - Number(i.rebuyPrice)), 0);

  return NextResponse.json({
    email: user.email,
    authorizations,
    charges,
    totals: {
      saved: Number(saved.toFixed(2)),
      fee: Number((saved * FEE_RATE).toFixed(2)),
      net: Number((saved * (1 - FEE_RATE)).toFixed(2)),
      feeRate: FEE_RATE,
    },
  });
}
