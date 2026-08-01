import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMandateSetupSession, PravaError } from "@/lib/prava";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.trackedItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { getMerchant } = await import("@/lib/merchants");
    const merchant = getMerchant(item.merchantId);
    const session = await createMandateSetupSession({
      ...item,
      countryCode: merchant.countryCode,
    });
    await prisma.trackedItem.update({
      where: { id },
      data: { sessionId: session.session_id as string, status: "authorizing" },
    });
    return NextResponse.json({ iframeUrl: session.iframe_url });
  } catch (e) {
    if (e instanceof PravaError) {
      return NextResponse.json(
        { error: `Prava error ${e.code}`, responseId: e.responseId, detail: e.body },
        { status: 502 }
      );
    }
    throw e;
  }
}
