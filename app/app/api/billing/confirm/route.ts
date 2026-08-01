import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { listMandates } from "@/lib/prava";
import { DEFAULT_FEE_CAP_USD, FEE_MERCHANT } from "@/lib/billing";

export const maxDuration = 30;

// Attaches the fee authorization the user just approved. Matched on merchant and
// ceiling rather than list position — the same mistake that once bound a
// purchase to the wrong merchant's authorization.
export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const mandates = await listMandates(user.email);
  const candidate = mandates
    .filter((m) => {
      const usable = (m.status as string) === "active" || (m.state as string) === "available";
      const isOurs =
        String(m.merchantName ?? "").toLowerCase() === FEE_MERCHANT.name.toLowerCase();
      const recurring = String(m.recurringFrequency ?? "") === "monthly";
      return usable && isOurs && recurring;
    })
    .sort(
      (a, b) =>
        new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime()
    )[0];

  if (!candidate) {
    return NextResponse.json(
      { ok: false, error: "We couldn't find the authorization you just approved." },
      { status: 404 }
    );
  }

  const mandateId = (candidate.id ?? candidate.mandateId) as string;
  const cap = Number(candidate.approvedAmount ?? DEFAULT_FEE_CAP_USD);
  const validUntil = candidate.validUntil ? new Date(String(candidate.validUntil)) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      feeMandateId: mandateId,
      feeMandateCapUsd: new Prisma.Decimal(cap.toFixed(2)),
      feeMandateExpires: validUntil,
    },
  });

  return NextResponse.json({ ok: true, mandateId, capUsd: cap });
}
