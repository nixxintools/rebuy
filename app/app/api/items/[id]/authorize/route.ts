import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { createMandateSetupSession, PravaError } from "@/lib/prava";
import { getMerchant } from "@/lib/merchants";
import { checkBillingGate } from "@/lib/billing";

export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  // Check before creating the authorization, not at spend time: discovering this
  // when a price has already dropped would cost the user the drop.
  const gate = await checkBillingGate(item.userId!);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.message, needsBilling: true },
      { status: 402 }
    );
  }

  try {
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
