// Prava sandbox API client. All calls are server-side only (uses secret key).
import { prisma } from "./prisma";

const BASE = process.env.PRAVA_API_BASE ?? "https://sandbox.api.prava.space";
const KEY = process.env.PRAVA_SECRET_KEY!;

export class PravaError extends Error {
  constructor(
    public status: number,
    public code: string,
    public responseId: string | null,
    public body: unknown
  ) {
    super(`Prava ${status} ${code}`);
  }
}

/**
 * Card credentials must never reach the database. A successful charge returns
 * the issued card — token, dynamic CVV and expiry — and the audit trail was
 * storing that response whole. In sandbox that is fake money; in production it
 * would be live card credentials sitting in plaintext in our own tables, which
 * is the one mistake there is no recovering from.
 *
 * Only the audit copy is redacted. The caller still receives the real response,
 * because the charge itself needs it.
 */
const SECRET_KEYS = /^(credentials|dynamicdata|token|cvv|dynamiccvv|pan|cardnumber|card_number|expiry(month|year)?)$/i;

export function redactForAudit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForAudit);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Keep the key so the trail still shows a card was issued, drop the value.
      out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redactForAudit(v);
    }
    return out;
  }
  return value;
}

async function pravaFetch(
  path: string,
  init: RequestInit & { itemId?: string; eventType?: string } = {}
) {
  const { itemId, eventType, ...req } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...req,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(req.headers ?? {}),
    },
    cache: "no-store",
  });
  const responseId = res.headers.get("x-response-id");
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  // Audit every Prava call against the item, including the support trace id.
  if (itemId) {
    await prisma.agentEvent.create({
      data: {
        itemId,
        type: eventType ?? `prava:${path}`,
        detail: JSON.parse(
          JSON.stringify(redactForAudit({ path, status: res.status, responseId, body }))
        ),
      },
    });
  }
  if (!res.ok) {
    const code =
      (body as { code?: string; error?: { code?: string } })?.code ??
      (body as { error?: { code?: string } })?.error?.code ??
      "UNKNOWN";
    throw new PravaError(res.status, code, responseId, body);
  }
  return body as Record<string, unknown>;
}

type Item = {
  id: string;
  userEmail: string;
  retailerName: string;
  retailerUrl: string;
  currency: string;
  countryCode?: string;
  productName: string;
  purchasePrice: { toString(): string };
  returnDeadline: Date;
};

// One-time mandate setup: cap = purchase price, scope = this merchant,
// valid until min(now + 7 days, return deadline).
export async function createMandateSetupSession(item: Item) {
  const sevenDays = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const validUntil =
    item.returnDeadline < sevenDays ? item.returnDeadline : sevenDays;
  return pravaFetch("/v1/sessions", {
    method: "POST",
    itemId: item.id,
    eventType: "mandate_setup_session_created",
    body: JSON.stringify({
      user_id: item.userEmail,
      user_email: item.userEmail,
      total_amount: Number(item.purchasePrice.toString()).toFixed(2),
      currency: item.currency,
      purchase_context: [
        {
          merchant_details: {
            name: item.retailerName,
            url: item.retailerUrl,
            country_code_iso2: item.countryCode ?? "US",
          },
          product_details: [
            {
              description: item.productName.slice(0, 200),
              unit_price: Number(item.purchasePrice.toString()).toFixed(2),
              quantity: 1,
            },
          ],
        },
      ],
      callback_url: `${process.env.APP_BASE_URL}/prava/return?item=${item.id}`,
      external_order_ref: `${item.id}:${Date.now()}`,
      description: `Return & Rebuy authorization: ${item.productName.slice(0, 100)}`,
      mandate_setup: {
        intent: "mandate_setup",
        recurring_frequency: "one_time",
        merchant_scope: "listed",
        valid_until: validUntil.toISOString(),
        max_charges: 1,
      },
    }),
  });
}

/**
 * Standing authorization for our own service fee. Same primitive as a spend
 * authorization — scoped to Rebuy as the merchant, capped, monthly, and
 * revocable — so the user grants collection on exactly the terms they can see.
 */
export async function createFeeMandateSession(opts: {
  userEmail: string;
  capUsd: number;
  months: number;
  merchant: { name: string; url: string; countryCode: string };
}) {
  const validUntil = new Date(Date.now() + opts.months * 31 * 24 * 3600 * 1000);
  return pravaFetch("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: opts.userEmail,
      user_email: opts.userEmail,
      total_amount: opts.capUsd.toFixed(2),
      currency: "USD",
      purchase_context: [
        {
          merchant_details: {
            name: opts.merchant.name,
            url: opts.merchant.url,
            country_code_iso2: opts.merchant.countryCode,
          },
          product_details: [
            {
              description: "Rebuy service fee — 15% of savings you've banked",
              unit_price: opts.capUsd.toFixed(2),
              quantity: 1,
            },
          ],
        },
      ],
      callback_url: `${process.env.APP_BASE_URL}/prava/fee-return`,
      external_order_ref: `fee:${opts.userEmail}:${Date.now()}`,
      description: "Authorize Rebuy to collect its share of savings you've banked",
      mandate_setup: {
        intent: "mandate_setup",
        recurring_frequency: "monthly",
        merchant_scope: "listed",
        valid_until: validUntil.toISOString(),
        max_charges: opts.months,
      },
    }),
  });
}

export async function listMandates(customerId: string) {
  const body = await pravaFetch(
    `/v1/mandates?customer_id=${encodeURIComponent(customerId)}`,
    { method: "GET" }
  );
  const list =
    (body as { mandates?: unknown[]; data?: unknown[] }).mandates ??
    (body as { data?: unknown[] }).data ??
    (Array.isArray(body) ? body : []);
  return list as Array<Record<string, unknown>>;
}

export type MandateCharge = {
  transactionId: string;
  amount: string;
  currency: string;
  status: string;
  reference: string | null;
  createdAt: string;
};

export type MandateDetail = {
  id: string;
  status: string;
  state: string;
  merchantName: string;
  approvedAmount: string;
  remaining: string;
  spent: string;
  currency: string;
  chargeCount: number;
  validUntil: string;
  createdAt: string;
  charges: MandateCharge[];
};

export async function getMandate(id: string) {
  return (await pravaFetch(`/v1/mandates/${id}`, { method: "GET" })) as unknown as MandateDetail;
}

export async function chargeMandate(
  mandateId: string,
  amount: string,
  reference: string,
  itemId: string | null
) {
  return pravaFetch(`/v1/mandates/${mandateId}/charge`, {
    method: "POST",
    itemId: itemId ?? undefined,
    eventType: "mandate_charge",
    body: JSON.stringify({ amount, reference }),
  });
}

export async function reportCharge(
  mandateId: string,
  transactionId: string,
  itemId: string | null,
  txnStatus: "APPROVED" | "DECLINED" = "APPROVED"
) {
  return pravaFetch(`/v1/mandates/${mandateId}/charges/${transactionId}/report`, {
    method: "POST",
    itemId: itemId ?? undefined,
    eventType: "charge_reported",
    body: JSON.stringify({ txn_status: txnStatus, txn_type: "PURCHASE" }),
  });
}

export async function cancelMandate(mandateId: string, itemId: string) {
  return pravaFetch(`/v1/mandates/${mandateId}/cancel`, {
    method: "POST",
    itemId,
    eventType: "mandate_cancelled",
    body: JSON.stringify({}),
  });
}
