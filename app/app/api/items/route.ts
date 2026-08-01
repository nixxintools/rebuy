import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { getMerchant, fetchProduct } from "@/lib/merchants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  merchantId: z.string().default("anker"),
  productHandle: z.string().min(1),
  orderId: z.string().min(1),
  purchasePrice: z.number().positive(),
  purchaseDate: z.string().min(4),
  returnDeadline: z.string().nullish(),
  confidence: z.record(z.string(), z.number()).nullish(),
});

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const items = await prisma.trackedItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid fields.", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const b = parsed.data;
  const merchant = getMerchant(b.merchantId);

  // Link to the live catalogue entry so the monitor has a real price source.
  const product = await fetchProduct(merchant.id, b.productHandle);

  const purchaseDate = new Date(b.purchaseDate);
  const returnDeadline = b.returnDeadline
    ? new Date(b.returnDeadline)
    : new Date(purchaseDate.getTime() + 30 * 86400000);
  const paid = new Prisma.Decimal(b.purchasePrice.toFixed(2));
  const live = new Prisma.Decimal(product.price.toFixed(2));

  const item = await prisma.trackedItem.create({
    data: {
      userId: user.id,
      userEmail: user.email, // Prava's customer key — must stay in sync with the account
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
