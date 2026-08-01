import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import {
  findMerchant,
  fetchProduct,
  canSpendAutonomously,
  whyNotSpendable,
  resolveReturnDeadline,
  detectFinalSale,
  MerchantUnavailableError,
} from "@/lib/merchants";
import { STATUS } from "@/lib/status";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  merchantId: z.string().min(1),
  productHandle: z.string().min(1),
  variantId: z.string().nullish(),
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

  const merchant = findMerchant(b.merchantId);
  if (!merchant) {
    return NextResponse.json({ error: "We don't support that store yet." }, { status: 400 });
  }

  let product;
  try {
    product = await fetchProduct(merchant.id, b.productHandle, b.variantId ?? undefined);
  } catch (e) {
    if (e instanceof MerchantUnavailableError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    throw e;
  }

  // Something that can't be returned must never be rebought on the user's behalf.
  const finalSale = detectFinalSale(product);

  const purchaseDate = new Date(b.purchaseDate);
  const { deadline, source } = resolveReturnDeadline(
    merchant,
    purchaseDate,
    b.returnDeadline ? new Date(b.returnDeadline) : null
  );

  const spendable = canSpendAutonomously(merchant) && !finalSale;
  const paid = new Prisma.Decimal(b.purchasePrice.toFixed(2));
  const live = new Prisma.Decimal(product.price.toFixed(2));

  const item = await prisma.trackedItem.create({
    data: {
      userId: user.id,
      userEmail: user.email, // Prava's customer key — must track the account
      merchantId: merchant.id,
      retailerName: merchant.name,
      retailerUrl: `https://${merchant.domain}`,
      currency: merchant.currency,
      orderId: b.orderId,
      productName: product.title,
      productUrl: product.url,
      productHandle: product.handle,
      variantId: product.variantId,
      variantTitle: product.variantTitle,
      imageUrl: product.image,
      purchasePrice: paid,
      currentPrice: live,
      purchaseDate,
      returnDeadline: deadline,
      returnWindowSource: source,
      lastCheckedAt: new Date(),
      status: spendable ? STATUS.ingested : STATUS.watchOnly,
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
            variant: product.variantTitle,
            returnWindowDays: merchant.policy.windowDays,
            returnWindowSource: source,
            spendable,
            blockedReason: finalSale ?? whyNotSpendable(merchant),
          },
        },
      },
    },
  });

  return NextResponse.json(
    { ...item, blockedReason: finalSale ?? whyNotSpendable(merchant) },
    { status: 201 }
  );
}
