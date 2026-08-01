import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { createFeeMandateSession, PravaError } from "@/lib/prava";
import { DEFAULT_FEE_CAP_USD, FEE_MERCHANT } from "@/lib/billing";

export const maxDuration = 30;

export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    const session = await createFeeMandateSession({
      userEmail: user.email,
      capUsd: DEFAULT_FEE_CAP_USD,
      months: 12,
      merchant: FEE_MERCHANT,
    });
    return NextResponse.json({
      iframeUrl: session.iframe_url,
      capUsd: DEFAULT_FEE_CAP_USD,
    });
  } catch (e) {
    if (e instanceof PravaError) {
      return NextResponse.json(
        { error: `Prava error ${e.code}`, responseId: e.responseId },
        { status: 502 }
      );
    }
    throw e;
  }
}
