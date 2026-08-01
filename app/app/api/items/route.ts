import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMerchant, fetchProduct } from "@/lib/merchants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const items = await prisma.trackedItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const merchant = getMerchant(b.merchantId ?? "anker");

  // Link to the live catalogue entry so the monitor has a real price source.
  const product = await fetchProduct(merchant.id, b.productHandle);

  const purchaseDate = new Date(b.purchaseDate);
  const returnDeadline = b.returnDeadline
    ? new Date(b.returnDeadline)
    : new Date(purchaseDate.getTime() + 30 * 86400000);
  const paid = new Prisma.Decimal(Number(b.purchasePrice).toFixed(2));
  const live = new Prisma.Decimal(product.price.toFixed(2));

  const item = await prisma.trackedItem.create({
    data: {
      userEmail: b.userEmail,
      merchantId: merchant.id,
      retailerName: merchant.name,
      retailerUrl: `https://${merchant.domain}`,
      currency: merchant.currency,
      orderId: b.orderId,
      productName: product.title,
      productUrl: product.url,
      productHandle: product.handle,
      variantId: product.variantId,
      imageUrl: product.image,
      purchasePrice: paid,
      currentPrice: live,
      purchaseDate,
      returnDeadline,
      status: "ingested",
      parseConfidence: b.confidence ?? undefined,
      prices: { create: { price: live, source: "merchant_live" } },
      events: {
        create: {
          type: "item_ingested",
          detail: {
            orderId: b.orderId,
            paid: Number(paid),
            livePriceNow: product.price,
            merchant: merchant.name,
            productUrl: product.url,
          },
        },
      },
    },
  });
  return NextResponse.json(item, { status: 201 });
}
