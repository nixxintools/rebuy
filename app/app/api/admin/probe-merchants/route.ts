import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Shopify localises storefront pricing by the *caller's* region. Probing from a
// developer machine outside the US therefore reports prices in the wrong
// currency — Beyond Yoga returned INR 8,600 for an $86 polo. Merchants must be
// validated from the same region that will serve users, so this runs the probe
// inside our own US-pinned function rather than locally.
type Probe = {
  host: string;
  ok: boolean;
  reason?: string;
  feedPrice?: number;
  displayedPrice?: number;
  pageCurrency?: string;
  metaCurrency?: string;
  sampleHandle?: string;
  sampleTitle?: string;
  variantCount?: number;
};

const TIMEOUT = 12000;

async function getJson(url: string) {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "RebuyMerchantProbe/1.0" },
      signal: AbortSignal.timeout(TIMEOUT),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const body = await res.text();
    if (body.trim().startsWith("<")) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function getText(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; RebuyPriceCheck/1.0)" },
      signal: AbortSignal.timeout(TIMEOUT + 3000),
      redirect: "follow",
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function findOfferPrice(node: unknown): number | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findOfferPrice(n);
      if (p != null) return p;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (obj.offers) {
    const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
    for (const o of offers) {
      const raw = (o as Record<string, unknown>)?.price ?? (o as Record<string, unknown>)?.lowPrice;
      if (raw != null && !Number.isNaN(Number(raw))) return Number(raw);
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const p = findOfferPrice(v);
      if (p != null) return p;
    }
  }
  return null;
}

// Only trust prices a shopper would actually see: OpenGraph, then JSON-LD offers.
// A bare `"price":` regex is not safe — Shopify themes embed the same field in
// integer cents, which reads as a 100x disagreement.
function displayedPrice(html: string | null) {
  if (!html) return null;
  const og =
    html.match(/property=["']og:price:amount["']\s+content=["']([\d.,]+)["']/i) ??
    html.match(/content=["']([\d.,]+)["']\s+property=["']og:price:amount["']/i);
  if (og) return Number(og[1].replace(/,/g, ""));

  for (const block of html.matchAll(
    /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const found = findOfferPrice(JSON.parse(block[1].trim()));
      if (found != null) return found;
    } catch {
      /* malformed JSON-LD is common on Shopify themes */
    }
  }
  return null;
}

function pageCurrency(html: string | null) {
  if (!html) return null;
  return (
    html.match(/og:price:currency["']\s+content=["']([A-Z]{3})["']/i)?.[1] ??
    html.match(/content=["']([A-Z]{3})["']\s+property=["']og:price:currency["']/i)?.[1] ??
    html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/)?.[1] ??
    null
  );
}

async function probe(host: string): Promise<Probe> {
  const feed = await getJson(`https://${host}/products.json?limit=5`);
  const products = feed?.products;
  if (!Array.isArray(products) || products.length === 0) {
    return { host, ok: false, reason: "no public product feed" };
  }

  // Pick a product with a real, non-zero price — gift cards and samples are noise.
  const product = products.find(
    (p: { variants?: { price?: string }[] }) => Number(p.variants?.[0]?.price ?? 0) > 1
  );
  if (!product) return { host, ok: false, reason: "no priced sample product" };

  const detail = await getJson(`https://${host}/products/${product.handle}.json`);
  const variants = detail?.product?.variants ?? [];
  const feedPrice = Number(variants[0]?.price ?? 0);
  if (!feedPrice) return { host, ok: false, reason: "single-product lookup failed" };

  const meta = await getJson(`https://${host}/meta.json`);
  const html = await getText(`https://${host}/products/${product.handle}`);
  const shown = displayedPrice(html);
  const currency = pageCurrency(html);

  // Shopify's .js endpoint is present on every storefront and always reports
  // integer cents, so it is the most reliable check that the feed is quoting
  // dollars rather than cents.
  const js = await getJson(`https://${host}/products/${product.handle}.js`);
  const cents = Number(js?.variants?.[0]?.price ?? js?.price ?? 0) || null;

  const base: Probe = {
    host,
    ok: false,
    feedPrice,
    displayedPrice: shown ?? undefined,
    pageCurrency: currency ?? undefined,
    metaCurrency: meta?.currency ?? undefined,
    sampleHandle: product.handle,
    sampleTitle: detail.product.title,
    variantCount: variants.length,
  };

  if (currency && currency !== "USD") {
    return { ...base, reason: `storefront serves ${currency}, not USD` };
  }

  if (cents) {
    const asDollars = cents / 100;
    if (Math.abs(feedPrice - asDollars) <= Math.max(0.02, asDollars * 0.02)) {
      return { ...base, ok: true };
    }
    if (Math.abs(feedPrice - cents) <= 1) {
      return { ...base, reason: `feed quotes cents (${feedPrice}), not dollars` };
    }
    return { ...base, reason: `feed ${feedPrice} disagrees with storefront ${asDollars}` };
  }

  if (shown != null) {
    if (Math.abs(feedPrice - shown) <= Math.max(0.02, shown * 0.02)) {
      return { ...base, ok: true };
    }
    return { ...base, reason: `feed ${feedPrice} disagrees with displayed ${shown}` };
  }

  return { ...base, reason: "no independent price source to verify the feed against" };
}

export async function POST(req: NextRequest) {
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secretMatches(provided, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { hosts } = (await req.json()) as { hosts: string[] };
  if (!Array.isArray(hosts) || hosts.length === 0) {
    return NextResponse.json({ error: "hosts[] required" }, { status: 400 });
  }
  const results: Probe[] = [];
  for (const host of hosts.slice(0, 40)) {
    results.push(await probe(host));
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? "unknown", results });
}
