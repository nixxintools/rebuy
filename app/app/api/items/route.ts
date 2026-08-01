import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.trackedItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { prices: { orderBy: { at: "desc" }, take: 1 } },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const purchaseDate = new Date(b.purchaseDate);
  const returnDeadline = b.returnDeadline
    ? new Date(b.returnDeadline)
    : new Date(purchaseDate.getTime() + 30 * 86400000);
  const price = new Prisma.Decimal(Number(b.purchasePrice).toFixed(2));
  const item = await prisma.trackedItem.create({
    data: {
      userEmail: b.userEmail,
      retailerName: b.retailer || "Amazon",
      retailerUrl: b.retailerUrl || "https://www.amazon.com",
      orderId: b.orderId,
      productName: b.productName,
      productUrl: b.productUrl || null,
      purchasePrice: price,
      currentPrice: price,
      purchaseDate,
      returnDeadline,
      status: "ingested",
      parseConfidence: b.confidence ?? undefined,
      prices: { create: { price, source: "receipt" } },
      events: {
        create: {
          type: "item_ingested",
          detail: { orderId: b.orderId, purchasePrice: Number(b.purchasePrice) },
        },
      },
    },
  });
  return NextResponse.json(item, { status: 201 });
}
