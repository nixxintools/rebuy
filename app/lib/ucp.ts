// UCP checkout creation at the merchant.
//
// After Prava charges the mandate, the agent creates a real checkout at the
// merchant over UCP: our published agent profile is verified by the merchant,
// the exact variant is added, and the merchant returns a live checkout with a
// card payment handler.
//
// The final `complete_checkout` call is DELIBERATELY not made. In sandbox, the
// Prava card is a test credential, and firing a live order at a real store with
// it is not something a demo should do. The block is one guarded call, not an
// architectural gap — production opens it by lifting the guard.
import { prisma } from "./prisma";

export const COMPLETE_CHECKOUT_ENABLED = process.env.UCP_COMPLETE_CHECKOUT === "true";

const AGENT_PROFILE = "https://rebuy.upthink.app/.well-known/ucp-agent-profile";

type UcpManifest = {
  ucp?: {
    services?: {
      "dev.ucp.shopping"?: { transport?: string; endpoint?: string }[];
    };
  };
};

/** Discover a merchant's UCP MCP endpoint from its own well-known manifest. */
export async function discoverUcpEndpoint(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${domain}/.well-known/ucp`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const manifest = (await res.json()) as UcpManifest;
    const svc = manifest.ucp?.services?.["dev.ucp.shopping"] ?? [];
    return svc.find((s) => s.transport === "mcp")?.endpoint ?? null;
  } catch {
    return null;
  }
}

/**
 * Shopify requires a bearer token for complete_checkout — creating a checkout
 * is open, placing the order is not. The token is fetched per run because it
 * expires after an hour.
 */
async function shopifyAgentToken(): Promise<string | null> {
  const id = process.env.SHOPIFY_CLIENT_ID;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const res = await fetch("https://api.shopify.com/auth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: id,
        client_secret: secret,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: string };
    return body.access_token ?? null;
  } catch {
    return null;
  }
}

export type CompletionResult =
  | { ok: true; orderId: string; permalinkUrl: string | null }
  | { ok: false; stage: "disabled" | "no_token" | "transport" | "merchant"; code: string; message: string };

/**
 * The last call — the one that turns a prepared cart into an order.
 *
 * It is off unless UCP_COMPLETE_CHECKOUT is "true", and it must stay that way
 * while the Prava card is a sandbox credential: a real order at a real shop
 * paid for with test money is someone else's problem to unpick.
 *
 * Card details are passed to the merchant and never returned, logged or stored.
 * Success is only reported when the merchant hands back an order id — a
 * response without one is a decline, however it is phrased.
 */
export type ShippingDestination = {
  id: string;
  first_name: string;
  last_name: string;
  street_address: string;
  address_locality: string;
  address_region: string;
  postal_code: string;
  address_country: string;
};

const INSTRUMENT_ID = "rebuy-prava-card";
const DESTINATION_ID = "rebuy-dest-1";

/**
 * Merchants want the name split in two. We store it as the user typed it, so
 * split on the last space and treat a single word as the surname being absent
 * rather than inventing one.
 */
export function destinationFromUser(u: {
  shipName: string | null;
  shipStreet: string | null;
  shipLocality: string | null;
  shipRegion: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;
}): ShippingDestination | undefined {
  if (!u.shipName || !u.shipStreet || !u.shipCountry) return undefined;
  const parts = u.shipName.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  return {
    // The id is not decoration. The spec requires one on every destination and
    // a matching selected_destination_id on the method; Shopify silently drops
    // a destination without it, then reports the address as missing. That
    // single omission cost a day of "verification" theories.
    id: DESTINATION_ID,
    first_name: parts.join(" "),
    last_name: last,
    street_address: u.shipStreet,
    address_locality: u.shipLocality ?? "",
    address_region: u.shipRegion ?? "",
    postal_code: u.shipPostalCode ?? "",
    address_country: u.shipCountry,
  };
}

export async function completeUcpCheckout(opts: {
  endpoint: string;
  checkoutId: string;
  credentials: { token?: string; dynamicCvv?: string; expiryMonth?: string; expiryYear?: string };
  idempotencyKey: string;
  destination?: ShippingDestination;
}): Promise<CompletionResult> {
  if (!COMPLETE_CHECKOUT_ENABLED) {
    return { ok: false, stage: "disabled", code: "COMPLETION_DISABLED", message: "Completion is switched off." };
  }

  const bearer = await shopifyAgentToken();
  if (!bearer) {
    return {
      ok: false,
      stage: "no_token",
      code: "AUTHENTICATION_REQUIRED",
      message:
        "Shopify requires an agent bearer token to place an order. Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.",
    };
  }

  let rpc: {
    result?: { content?: { type: string; text: string }[] };
    error?: { code?: number; message?: string; data?: unknown };
  };
  try {
    const res = await fetch(opts.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${bearer}`,
        // An authenticated call is refused outright without this: "Missing
        // required buyer IP header." The merchant wants the buyer's address,
        // not ours, to price and localise. We do not capture the user's IP at
        // purchase time — the agent acts on a schedule, hours after they last
        // opened the app — so this is configurable and defaults to a US
        // address, which matches where our functions and merchants live.
        "Shopify-Buyer-IP": process.env.UCP_BUYER_IP ?? "23.235.33.229",
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        id: 1,
        params: {
          name: "complete_checkout",
          arguments: {
            meta: {
              "ucp-agent": { profile: AGENT_PROFILE },
              "idempotency-key": opts.idempotencyKey,
            },
            id: opts.checkoutId,
            checkout: {
              // Shopify's documented shape: a list of instruments and a
              // pointer to the chosen one. The credential sub-object is the
              // one piece their public docs don't spell out — once we hold a
              // Dev Dashboard token, tools/list returns the authoritative
              // schema for this and we should read it rather than guess again.
              payment: {
                instruments: [
                  {
                    id: INSTRUMENT_ID,
                    type: "card",
                    handler_id: "shopify.card",
                    credential: {
                      type: "card",
                      number: opts.credentials.token,
                      security_code: opts.credentials.dynamicCvv,
                      expiry_month: opts.credentials.expiryMonth,
                      expiry_year: opts.credentials.expiryYear,
                    },
                  },
                ],
                selected_instrument_id: INSTRUMENT_ID,
              },
              // Shopify refuses a checkout with nowhere to ship to. We only
              // send this when we have one; we do not invent an address.
              ...(opts.destination
                ? {
                    fulfillment: {
                      methods: [
                        {
                          type: "shipping",
                          destinations: [opts.destination],
                          selected_destination_id: opts.destination.id,
                        },
                      ],
                    },
                  }
                : {}),
            },
          },
        },
      }),
    });
    const text = await res.text();
    try {
      rpc = JSON.parse(text);
    } catch {
      const frame = text.split("\n").find((l) => l.startsWith("data:"));
      if (!frame) {
        return { ok: false, stage: "transport", code: String(res.status), message: text.slice(0, 300) };
      }
      rpc = JSON.parse(frame.slice(5).trim());
    }
  } catch (e) {
    return { ok: false, stage: "transport", code: "NETWORK", message: (e as Error).message };
  }

  if (rpc.error) {
    return {
      ok: false,
      stage: "merchant",
      code: rpc.error.message ?? "RPC_ERROR",
      message: typeof rpc.error.data === "string" ? rpc.error.data : JSON.stringify(rpc.error.data ?? {}),
    };
  }

  const text = rpc.result?.content?.find((c) => c.type === "text")?.text;
  if (!text) {
    return { ok: false, stage: "merchant", code: "EMPTY_RESULT", message: "No content in the response." };
  }

  const checkout = JSON.parse(text) as {
    status?: string;
    order?: { id?: string; permalink_url?: string };
    messages?: { code?: string; content?: string; severity?: string }[];
  };

  // An order id is the only thing that proves an order exists. Everything else
  // — including a cheerful status with no order attached — is a decline.
  if (checkout.order?.id) {
    return {
      ok: true,
      orderId: checkout.order.id,
      permalinkUrl: checkout.order.permalink_url ?? null,
    };
  }

  const first = checkout.messages?.[0];
  return {
    ok: false,
    stage: "merchant",
    code: first?.code ?? checkout.status ?? "NO_ORDER",
    message: (checkout.messages ?? []).map((m) => `${m.code}: ${m.content}`).join(" | ").slice(0, 500),
  };
}

export type UcpCheckout = {
  checkoutId: string;
  continueUrl: string | null;
  totalCents: number | null;
  lineItemTitle: string | null;
  paymentHandlers: string[];
  endpoint: string;
};

/**
 * Create a real checkout at the merchant for the exact variant the user tracked.
 * Returns null rather than throwing — a merchant without working UCP must not
 * break the purchase flow that already completed on the Prava side.
 */
export async function createUcpCheckout(opts: {
  merchantDomain: string;
  variantId: string;
  buyerEmail: string;
  itemId?: string;
  destination?: ShippingDestination;
}): Promise<UcpCheckout | null> {
  const endpoint = await discoverUcpEndpoint(opts.merchantDomain);
  if (!endpoint) return null;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        id: 1,
        params: {
          name: "create_checkout",
          arguments: {
            meta: { "ucp-agent": { profile: AGENT_PROFILE } },
            checkout: {
              currency: "USD",
              line_items: [
                { quantity: 1, item: { id: `gid://shopify/ProductVariant/${opts.variantId}` } },
              ],
              buyer: { email: opts.buyerEmail },
              // Given early, the merchant can price shipping and tax straight
              // away instead of holding the checkout open for an address.
              ...(opts.destination
                ? {
                    fulfillment: {
                      methods: [
                        {
                          type: "shipping",
                          destinations: [opts.destination],
                          selected_destination_id: opts.destination.id,
                        },
                      ],
                    },
                  }
                : {}),
            },
          },
        },
      }),
    });
    if (!res.ok) return null;

    const rpc = (await res.json()) as {
      result?: { content?: { type: string; text: string }[] };
      error?: unknown;
    };
    const text = rpc.result?.content?.find((c) => c.type === "text")?.text;
    if (!text) return null;

    const checkout = JSON.parse(text) as {
      ucp?: { status?: string; payment_handlers?: Record<string, unknown> };
      id?: string;
      continue_url?: string;
      totals?: { total?: { amount?: number } } | { name?: string; amount?: number }[];
      line_items?: { item?: { title?: string } }[];
    };
    if (checkout.ucp?.status !== "success" || !checkout.id) return null;

    let totalCents: number | null = null;
    if (Array.isArray(checkout.totals)) {
      totalCents = (checkout.totals.find((t) => t.name === "total")?.amount as number) ?? null;
    } else if (checkout.totals && "total" in checkout.totals) {
      totalCents = checkout.totals.total?.amount ?? null;
    }

    const result: UcpCheckout = {
      checkoutId: checkout.id,
      continueUrl: checkout.continue_url ?? null,
      totalCents,
      lineItemTitle: checkout.line_items?.[0]?.item?.title ?? null,
      paymentHandlers: Object.keys(checkout.ucp?.payment_handlers ?? {}),
      endpoint,
    };

    if (opts.itemId) {
      await prisma.agentEvent.create({
        data: {
          itemId: opts.itemId,
          type: "ucp_checkout_created",
          detail: JSON.parse(
            JSON.stringify({
              ...result,
              agentProfile: AGENT_PROFILE,
              completion: COMPLETE_CHECKOUT_ENABLED
                ? "enabled"
                : "deliberately blocked in sandbox — the Prava card is a test credential and firing a live order at a real store with it is not something a demo should do",
            })
          ),
        },
      });
    }
    return result;
  } catch {
    return null;
  }
}
