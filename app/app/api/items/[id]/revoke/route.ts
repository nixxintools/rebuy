import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadOwnedItem } from "@/lib/owned";
import { cancelMandate, getMandate, PravaError } from "@/lib/prava";
import { STATUS } from "@/lib/status";

export const maxDuration = 30;

// Terminal states: the authorization genuinely cannot be spent again.
const TERMINAL = new Set(["cancelled", "consumed", "expired", "revoked"]);

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, response } = await loadOwnedItem(id);
  if (!item) return response;

  if (!item.mandateId) {
    const updated = await prisma.trackedItem.update({
      where: { id },
      data: { status: STATUS.revoked },
    });
    return NextResponse.json(updated);
  }

  // Telling someone their agent can no longer spend, when it still can, is worse
  // than reporting a failure. So we only claim success if Prava confirms it —
  // anything ambiguous leaves the item visibly unresolved.
  try {
    await cancelMandate(item.mandateId, id);
  } catch (e) {
    if (!(e instanceof PravaError)) throw e;
    let terminal = false;
    try {
      const mandate = await getMandate(item.mandateId);
      terminal = TERMINAL.has(String(mandate.status).toLowerCase());
    } catch {
      terminal = false;
    }
    if (!terminal) {
      const pending = await prisma.trackedItem.update({
        where: { id },
        data: { status: STATUS.revocationPending, failureCode: e.code },
      });
      await prisma.agentEvent.create({
        data: {
          itemId: id,
          type: "revocation_failed",
          detail: { code: e.code, responseId: e.responseId },
        },
      });
      return NextResponse.json(
        {
          ...pending,
          error:
            "We couldn't confirm the cancellation with Prava. Assume the agent can still spend and try again.",
        },
        { status: 502 }
      );
    }
  }

  // Confirm the authorization really is dead before saying so.
  try {
    const mandate = await getMandate(item.mandateId);
    if (!TERMINAL.has(String(mandate.status).toLowerCase())) {
      const pending = await prisma.trackedItem.update({
        where: { id },
        data: { status: STATUS.revocationPending, failureCode: "MANDATE_STILL_ACTIVE" },
      });
      return NextResponse.json(
        { ...pending, error: "Prava still reports this authorization as active. Please try again." },
        { status: 502 }
      );
    }
  } catch {
    // We could not read the mandate back. The cancel call returning 200 is not
    // proof it took effect, and claiming spending power is gone when it may not
    // be is the worse error — so stay unresolved.
    const pending = await prisma.trackedItem.update({
      where: { id },
      data: { status: STATUS.revocationPending, failureCode: "REVOKE_UNVERIFIED" },
    });
    return NextResponse.json(
      {
        ...pending,
        error:
          "We asked Prava to cancel it but couldn't confirm. Assume the agent can still spend and try again.",
      },
      { status: 502 }
    );
  }

  const updated = await prisma.trackedItem.update({
    where: { id },
    data: { status: STATUS.revoked, failureCode: null },
  });
  return NextResponse.json(updated);
}
