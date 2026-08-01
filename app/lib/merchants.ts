// US merchants running Shopify storefronts — the same UCP/MCP-compatible commerce
// surface Prava's merchant list points at. Prices are read live from each store's
// public product feed, so the price monitor uses real market data, not a simulation.

export type Merchant = {
  id: string;
  name: string;
  domain: string;
  currency: string;
  countryCode: string;
  category: string;
};

export const MERCHANTS: Merchant[] = [
  {
    id: "anker",
    name: "Anker",
    domain: "us.anker.com",
    currency: "USD",
    countryCode: "US",
    category: "Electronics",
  },
  {
    id: "allbirds",
    name: "Allbirds",
    domain: "www.allbirds.com",
    currency: "USD",
    countryCode: "US",
    category: "Apparel",
  },
  {
    id: "brooklinen",
    name: "Brooklinen",
    domain: "www.brooklinen.com",
    currency: "USD",
    countryCode: "US",
    category: "Home goods",
  },
];

export function getMerchant(id: string): Merchant {
  const m = MERCHANTS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown merchant: ${id}`);
  return m;
}

export type MerchantProduct = {
  handle: string;
  title: string;
  price: number;
  variantId: string;
  image: string | null;
  url: string;
};

type ShopifyProduct = {
  handle: string;
  title: string;
  images?: { src: string }[];
  variants: { id: number; price: string; available?: boolean }[];
};

function toProduct(m: Merchant, p: ShopifyProduct): MerchantProduct {
  const v = p.variants.find((x) => x.available !== false) ?? p.variants[0];
  return {
    handle: p.handle,
    title: p.title,
    price: Number(v.price),
    variantId: String(v.id),
    image: p.images?.[0]?.src ?? null,
    url: `https://${m.domain}/products/${p.handle}`,
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

// Search the merchant's live catalogue. Shopify's suggest endpoint is what the
// store's own search box uses; not every store enables it, so fall back to
// scanning the public product feed.
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

  const feed = await getJson<{ products: ShopifyProduct[] }>(
    `https://${m.domain}/products.json?limit=250`
  );
  if (!feed?.products) return [];
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  return feed.products
    .map((p) => {
      const title = p.title.toLowerCase();
      const score = terms.reduce((s, t) => s + (title.includes(t) ? 1 : 0), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => toProduct(m, x.p));
}

// Live price for one product — the price monitor's data source.
export async function fetchProduct(
  merchantId: string,
  handle: string
): Promise<MerchantProduct> {
  const m = getMerchant(merchantId);
  const json = await getJson<{ product: ShopifyProduct }>(
    `https://${m.domain}/products/${handle}.json`
  );
  if (!json?.product) throw new Error(`Live price lookup failed for ${handle}`);
  return toProduct(m, json.product);
}
