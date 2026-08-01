// Live catalogue access plus the return-policy rules that decide whether the
// agent is allowed to spend at a merchant at all.
import { MERCHANTS, type Merchant, type ReturnPolicy } from "./merchant-registry";

export { MERCHANTS };
export type { Merchant, ReturnPolicy };

export function getMerchant(id: string): Merchant {
  const m = MERCHANTS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown merchant: ${id}`);
  return m;
}

export function findMerchant(id: string): Merchant | null {
  return MERCHANTS.find((x) => x.id === id) ?? null;
}

/**
 * A merchant only earns autonomous spending if a return is actually possible and
 * we are confident about the window. Everything else is watch-only: we'll still
 * track the price, we just won't buy on the user's behalf.
 */
export function canSpendAutonomously(m: Merchant) {
  return m.policy.windowDays >= 7 && m.policy.confidence !== "low";
}

export function whyNotSpendable(m: Merchant): string | null {
  if (m.policy.windowDays === 0) {
    return `${m.name} doesn't accept returns, so a repurchase could never be undone.`;
  }
  if (m.policy.windowDays < 7) {
    return `${m.name}'s return window is only ${m.policy.windowDays} days — too short to act on safely.`;
  }
  if (m.policy.confidence === "low") {
    return `We haven't been able to verify ${m.name}'s return policy, so we won't spend there.`;
  }
  return null;
}

/** Merchants ordered by how long a purchase stays recoverable. */
export function rankedByRecoverableWindow() {
  return [...MERCHANTS].sort((a, b) => {
    if (b.policy.windowDays !== a.policy.windowDays) {
      return b.policy.windowDays - a.policy.windowDays;
    }
    // Same window: prefer the one that costs less to return.
    return (a.policy.feeUsd ?? 0) - (b.policy.feeUsd ?? 0);
  });
}

/**
 * The return deadline the agent will actually act on. A date stated on the
 * receipt always wins; otherwise we fall back to the merchant's published
 * window. There is deliberately no global default — inventing one is what lets
 * the agent rebuy something the user can no longer return.
 */
export function resolveReturnDeadline(
  merchant: Merchant,
  purchaseDate: Date,
  receiptDeadline: Date | null
): { deadline: Date; source: "receipt" | "merchant_policy"; windowDays: number } {
  if (receiptDeadline && !Number.isNaN(receiptDeadline.getTime())) {
    const days = Math.round((receiptDeadline.getTime() - purchaseDate.getTime()) / 86400000);
    return { deadline: receiptDeadline, source: "receipt", windowDays: days };
  }
  const days = merchant.policy.windowDays;
  return {
    deadline: new Date(purchaseDate.getTime() + days * 86400000),
    source: "merchant_policy",
    windowDays: days,
  };
}

const FINAL_SALE_MARKERS = [
  "final sale",
  "last call",
  "last chance",
  "clearance",
  "closeout",
  "as-is",
  "non-returnable",
];

/**
 * Final-sale items are the sharpest edge in this product: Brooklinen's storefront
 * is largely "Last Call", and those cannot be returned at all. Buying a
 * replacement for one leaves the user holding both.
 */
export function detectFinalSale(product: { title: string; tags?: string[] }): string | null {
  const haystack = [product.title, ...(product.tags ?? [])].join(" ").toLowerCase();
  const hit = FINAL_SALE_MARKERS.find((marker) => haystack.includes(marker));
  return hit ? `This looks like a "${hit}" item, which usually can't be returned.` : null;
}

export type MerchantProduct = {
  handle: string;
  title: string;
  price: number;
  variantId: string;
  variantTitle: string | null;
  image: string | null;
  url: string;
  tags: string[];
  variants: { id: string; title: string; price: number; available: boolean }[];
};

type ShopifyVariant = {
  id: number;
  title?: string;
  price: string;
  available?: boolean;
};

type ShopifyProduct = {
  handle: string;
  title: string;
  tags?: string[] | string;
  images?: { src: string }[];
  variants: ShopifyVariant[];
};

function toProduct(m: Merchant, p: ShopifyProduct, variantId?: string): MerchantProduct {
  const variants = p.variants.map((v) => ({
    id: String(v.id),
    title: v.title?.trim() || "Default",
    price: Number(v.price),
    available: v.available !== false,
  }));
  const chosen =
    (variantId ? variants.find((v) => v.id === variantId) : undefined) ??
    variants.find((v) => v.available) ??
    variants[0];
  const tags = Array.isArray(p.tags) ? p.tags : typeof p.tags === "string" ? p.tags.split(/,\s*/) : [];

  return {
    handle: p.handle,
    title: p.title,
    price: chosen.price,
    variantId: chosen.id,
    variantTitle: variants.length > 1 ? chosen.title : null,
    image: p.images?.[0]?.src ?? null,
    url: `https://${m.domain}/products/${p.handle}`,
    tags,
    variants,
  };
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export class MerchantUnavailableError extends Error {}

/** Search a merchant's live catalogue. */
export async function searchProducts(
  merchantId: string,
  query: string,
  limit = 8
): Promise<MerchantProduct[]> {
  const m = getMerchant(merchantId);

  const suggest = await getJson<{
    resources?: { results?: { products?: { handle: string }[] } };
  }>(
    `https://${m.domain}/search/suggest.json?q=${encodeURIComponent(query)}` +
      `&resources[type]=product&resources[limit]=${limit}`
  );
  const handles = (suggest?.resources?.results?.products ?? []).map((p) => p.handle);
  if (handles.length) {
    const found = await Promise.all(
      handles.slice(0, limit).map((h) => fetchProduct(merchantId, h).catch(() => null))
    );
    const ok = found.filter((p): p is MerchantProduct => p !== null);
    if (ok.length) return ok;
  }

  // Not every storefront enables the suggest endpoint; fall back to the feed.
  const feed = await getJson<{ products: ShopifyProduct[] }>(
    `https://${m.domain}/products.json?limit=250`
  );
  if (!feed?.products) {
    throw new MerchantUnavailableError(`${m.name}'s catalogue is not responding right now.`);
  }
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  return feed.products
    .map((p) => {
      const title = p.title.toLowerCase();
      return { p, score: terms.reduce((s, t) => s + (title.includes(t) ? 1 : 0), 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => toProduct(m, x.p));
}

/** Live price for one product — the price monitor's data source. */
export async function fetchProduct(
  merchantId: string,
  handle: string,
  variantId?: string
): Promise<MerchantProduct> {
  const m = getMerchant(merchantId);
  const json = await getJson<{ product: ShopifyProduct }>(
    `https://${m.domain}/products/${handle}.json`
  );
  if (!json?.product) {
    throw new MerchantUnavailableError(`Couldn't read the live price for this item at ${m.name}.`);
  }
  return toProduct(m, json.product, variantId);
}
