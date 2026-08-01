// Some Shopify storefronts publish product-feed prices that don't match what a
// shopper actually sees — typically inflated 100x by a currency/market app. A
// price feed we can't trust is worse than no merchant at all, because every
// downstream decision (drop detection, spend ceiling, the charge itself) reads
// from it. This validates the feed against the price rendered on the product
// page and rejects any storefront that disagrees.
import { readFileSync, writeFileSync } from "node:fs";

const TIMEOUT = 15000;
const TOLERANCE = 0.02;

async function text(url) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; RebuyPriceCheck/1.0)" },
      signal: AbortSignal.timeout(TIMEOUT),
      redirect: "follow",
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

// What the shopper sees: OpenGraph price, or JSON-LD offers.price.
function extractDisplayedPrice(html) {
  if (!html) return null;

  const og = html.match(/property=["']og:price:amount["']\s+content=["']([\d.,]+)["']/i)
    ?? html.match(/content=["']([\d.,]+)["']\s+property=["']og:price:amount["']/i);
  if (og) return Number(og[1].replace(/,/g, ""));

  for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = findOfferPrice(JSON.parse(block[1].trim()));
      if (found != null) return found;
    } catch {
      /* malformed JSON-LD is common; keep looking */
    }
  }
  return null;
}

function findOfferPrice(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findOfferPrice(n);
      if (p != null) return p;
    }
    return null;
  }
  if (node.offers) {
    const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
    for (const o of offers) {
      const raw = o?.price ?? o?.lowPrice;
      if (raw != null && !Number.isNaN(Number(raw))) return Number(raw);
    }
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === "object") {
      const p = findOfferPrice(v);
      if (p != null) return p;
    }
  }
  return null;
}

const candidates = JSON.parse(readFileSync("scripts/probe-results.json", "utf8"));
const trusted = [];
const rejected = [];

for (const m of candidates) {
  const feedPrice = Number(m.samplePrice);
  const html = await text(`https://${m.host}/products/${m.sampleHandle}`);
  const shown = extractDisplayedPrice(html);

  if (shown == null) {
    rejected.push({ ...m, reason: "no displayed price to verify against" });
    console.log(`SKIP  ${m.host.padEnd(28)} feed=${feedPrice} (no og:price / JSON-LD)`);
    continue;
  }

  const ratio = shown > 0 ? feedPrice / shown : Infinity;
  const agrees = Math.abs(feedPrice - shown) <= Math.max(TOLERANCE, shown * TOLERANCE);

  if (agrees) {
    trusted.push({ ...m, verifiedAgainstDisplayed: shown });
    console.log(`OK    ${m.host.padEnd(28)} feed=${feedPrice} shown=${shown}`);
  } else {
    rejected.push({ ...m, displayedPrice: shown, ratio: Number(ratio.toFixed(2)), reason: "feed price disagrees with displayed price" });
    console.log(`BAD   ${m.host.padEnd(28)} feed=${feedPrice} shown=${shown}  ratio=${ratio.toFixed(1)}x`);
  }
}

console.log(`\n=== ${trusted.length} price-verified · ${rejected.length} rejected ===`);
writeFileSync("scripts/price-verified.json", JSON.stringify(trusted, null, 2));
writeFileSync("scripts/price-rejected.json", JSON.stringify(rejected, null, 2));
