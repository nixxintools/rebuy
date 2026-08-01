import { NextRequest, NextResponse } from "next/server";
import { searchProducts, MERCHANTS, MerchantUnavailableError } from "@/lib/merchants";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const merchantId = req.nextUrl.searchParams.get("merchant") ?? "anker";
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ merchants: MERCHANTS, products: [] });
  try {
    const products = await searchProducts(merchantId, q);
    return NextResponse.json({ merchants: MERCHANTS, products });
  } catch (e) {
    // "The store is down" and "nothing matched" are different problems and the
    // user needs to be told which one they have.
    const unavailable = e instanceof MerchantUnavailableError;
    return NextResponse.json(
      { error: (e as Error).message, unavailable },
      { status: unavailable ? 503 : 502 }
    );
  }
}
