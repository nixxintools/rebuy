// Once SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are set, this asks the
// merchant for the authoritative complete_checkout schema. Anonymous callers
// are refused, which is why the credential shape had to be guessed until now.
//
//   node scripts/ucp-introspect.mjs [merchant-mcp-endpoint]
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

const EP = process.argv[2] ?? "https://ankerus.myshopify.com/api/ucp/mcp";
const PROFILE = "https://rebuy.upthink.app/.well-known/ucp-agent-profile";
const { SHOPIFY_CLIENT_ID: ID, SHOPIFY_CLIENT_SECRET: SECRET } = process.env;

if (!ID || !SECRET) {
  console.error("Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET first (Shopify Dev Dashboard).");
  process.exit(1);
}

const tokenRes = await fetch("https://api.shopify.com/auth/access_token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grant_type: "client_credentials", client_id: ID, client_secret: SECRET }),
});
if (!tokenRes.ok) {
  console.error(`Token request failed (${tokenRes.status}): ${await tokenRes.text()}`);
  process.exit(1);
}
const { access_token: token } = await tokenRes.json();
console.log("Got a Token-tier bearer token.\n");

async function call(body) {
  const res = await fetch(EP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const frame = text.split("\n").find((l) => l.startsWith("data:"));
    return frame ? JSON.parse(frame.slice(5).trim()) : { raw: text.slice(0, 400) };
  }
}

const list = await call({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: { meta: { "ucp-agent": { profile: PROFILE } } },
});

const tools = list.result?.tools;
if (!tools) {
  console.error("tools/list refused:", JSON.stringify(list.error ?? list).slice(0, 500));
  process.exit(1);
}

console.log("tools:", tools.map((t) => t.name).join(", "), "\n");
const complete = tools.find((t) => t.name === "complete_checkout");
if (!complete) {
  console.error("No complete_checkout at this tier — check the app's permissions.");
  process.exit(1);
}
console.log("=== complete_checkout input schema ===");
console.log(JSON.stringify(complete.inputSchema, null, 2));
console.log(
  "\nCompare the payment.instruments[].credential fields with lib/ucp.ts and fix any mismatch."
);
