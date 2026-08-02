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
