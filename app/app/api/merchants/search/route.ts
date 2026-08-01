import { NextRequest, NextResponse } from "next/server";
import { searchProducts, MERCHANTS } from "@/lib/merchants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const merchantId = req.nextUrl.searchParams.get("merchant") ?? "anker";
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ merchants: MERCHANTS, products: [] });
  try {
    const products = await searchProducts(merchantId, q);
    return NextResponse.json({ merchants: MERCHANTS, products });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
