import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/auth";
import { getMandate, type MandateDetail } from "@/lib/prava";
import { summariseSavings, statusMeta } from "@/lib/status";
import { accruedFees, DEFAULT_FEE_CAP_USD } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const items = await prisma.trackedItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const withMandates = items.filter((i) => i.mandateId);

  const authorizations = await Promise.all(
    withMandates.map(async (item) => {
      let mandate: MandateDetail | null = null;
      let unreachable = false;
      try {
        mandate = await getMandate(item.mandateId!);
      } catch {
        // Dropping the row would make the page claim the user authorised nothing.
        unreachable = true;
      }
      return {
        itemId: item.id,
        productName: item.productName,
        imageUrl: item.imageUrl,
        merchantName: item.retailerName,
        itemStatus: item.status,
        currency: item.currency,
        mandateId: item.mandateId,
        /** Does the agent still hold spending power via this authorization? */
        live: statusMeta(item.status).agentCanSpend,
        unreachable,
        mandate,
      };
    })
  );

  const charges = authorizations
    .flatMap((a) =>
      (a.mandate?.charges ?? []).map((c) => ({
        ...c,
        productName: a.productName,
        merchantName: a.merchantName,
        itemId: a.itemId,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const savings = summariseSavings(items);
  const [accrued, feeHistory] = await Promise.all([
    accruedFees(user.id),
    prisma.feeCharge.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  // How much could actually be spent right now, and where.
  const activeAuthorizations = authorizations.filter((a) => a.live && a.mandate);
  const spendableNow = activeAuthorizations.reduce(
    (s, a) => s + Number(a.mandate?.remaining ?? 0),
    0
  );
  const nextExpiry = activeAuthorizations
    .map((a) => a.mandate?.validUntil)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null;

  return NextResponse.json({
    email: user.email,
    authorizations,
    charges,
    authority: {
      activeCount: activeAuthorizations.length,
      spendableNow: Math.round(spendableNow * 100) / 100,
      nextExpiry,
      anyUnreachable: authorizations.some((a) => a.unreachable),
    },
    totals: savings,
    billing: {
      authorized: Boolean(user.feeMandateId),
      capUsd: user.feeMandateCapUsd ? Number(user.feeMandateCapUsd) : DEFAULT_FEE_CAP_USD,
      expiresAt: user.feeMandateExpires,
      accrued: { period: accrued.period, savings: accrued.savings, fee: accrued.fee },
      history: feeHistory.map((f) => ({
        period: f.period,
        amount: Number(f.amount),
        status: f.status,
        transactionId: f.transactionId,
        createdAt: f.createdAt,
      })),
    },
  });
}
