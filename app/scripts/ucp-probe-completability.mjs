// Which merchants can an agent actually finish a checkout at?
//
// Anker reaches `requires_escalation` with `extension_interaction_required`,
// which per Shopify's own docs means handing the buyer to the storefront. No
// amount of credentials changes that. This finds merchants whose checkout
// reaches `ready_for_complete` instead, which is where the last step can be
// proven.
//
//   node scripts/ucp-probe-completability.mjs [count]
const PROFILE = "https://rebuy.upthink.app/.well-known/ucp-agent-profile";
const EMAIL = "agent-probe@rebuy.upthink.app";

const DEST = {
  first_name: "Test",
  last_name: "Buyer",
  street_address: "500 Terry Francois Blvd",
  address_locality: "San Francisco",
  address_region: "CA",
  postal_code: "94158",
  address_country: "US",
};

const DOMAINS = process.env.UCP_PROBE_DOMAINS?.split(",") ?? [
  "us.anker.com", "allbirds.com", "taylorstitch.com", "brooklinen.com",
  "everlane.com", "rothys.com", "peakdesign.com", "cotopaxi.com",
  "monos.com", "fellowproducts.com", "misen.com", "glossier.com",
  "awaytravel.com", "parachutehome.com", "nomadgoods.com",
];

// Anonymous callers may be escalated for reasons that have nothing to do with
// the merchant. Re-run this with credentials set and the same output answers a
// different question: whether Token tier is what clears the escalation.
import { readFileSync } from "node:fs";
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    // Either file may be absent.
  }
}

let BEARER = null;
if (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
  const r = await fetch("https://api.shopify.com/auth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  BEARER = r.ok ? (await r.json()).access_token : null;
  console.log(BEARER ? "Probing as Token tier.\n" : "Credentials set but token request failed.\n");
} else {
  console.log("Probing anonymously — set SHOPIFY_CLIENT_ID/SECRET to compare.\n");
}

async function json(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const frame = text.split("\n").find((l) => l.startsWith("data:"));
    return frame ? JSON.parse(frame.slice(5).trim()) : null;
  }
}

async function probe(domain) {
  const manifest = await json(`https://${domain}/.well-known/ucp`, {
    headers: { accept: "application/json" },
  }).catch(() => null);
  const endpoint = manifest?.ucp?.services?.["dev.ucp.shopping"]?.find(
    (s) => s.transport === "mcp"
  )?.endpoint;
  if (!endpoint) return { domain, result: "no UCP endpoint" };

  const products = await json(`https://${domain}/products.json?limit=3`).catch(() => null);
  const variant = products?.products?.flatMap((p) => p.variants ?? []).find((v) => v.available);
  if (!variant) return { domain, result: "no purchasable variant found" };

  const rpc = await json(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(BEARER ? { Authorization: `Bearer ${BEARER}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      id: 1,
      params: {
        name: "create_checkout",
        arguments: {
          meta: { "ucp-agent": { profile: PROFILE } },
          checkout: {
            currency: "USD",
            line_items: [{ quantity: 1, item: { id: `gid://shopify/ProductVariant/${variant.id}` } }],
            buyer: { email: EMAIL },
            fulfillment: { methods: [{ type: "shipping", destinations: [DEST] }] },
          },
        },
      },
    }),
  }).catch(() => null);

  if (!rpc) return { domain, result: "no response" };
  if (rpc.error) return { domain, result: `error: ${rpc.error.message}` };

  const text = rpc.result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return { domain, result: "empty result" };
  const checkout = JSON.parse(text);
  const blocking = (checkout.messages ?? [])
    .filter((m) => m.severity === "requires_buyer_input")
    .map((m) => m.code);
  return {
    domain,
    result: checkout.status ?? "unknown",
    blocking: blocking.join(", ") || "none",
  };
}

const limit = Number(process.argv[2] ?? DOMAINS.length);
const results = [];
for (const batch of chunk(DOMAINS.slice(0, limit), 5)) {
  results.push(...(await Promise.all(batch.map((d) => probe(d).catch((e) => ({ domain: d, result: e.message }))))));
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

for (const r of results) {
  console.log(`${r.result === "ready_for_complete" ? "YES " : "  - "}${r.domain.padEnd(24)} ${r.result}${r.blocking ? `  [${r.blocking}]` : ""}`);
}
const completable = results.filter((r) => r.result === "ready_for_complete");
console.log(
  `\n${completable.length} of ${results.length} reach ready_for_complete` +
    (completable.length ? `: ${completable.map((r) => r.domain).join(", ")}` : "")
);
