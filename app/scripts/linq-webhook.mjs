// Registers our webhook with Linq so replies reach the app, and prints the
// signing secret to paste into LINQ_WEBHOOK_SECRET.
//
// Run once, after LINQ_API_KEY is set:
//   node scripts/linq-webhook.mjs
// Add "list" to see what is already registered:
//   node scripts/linq-webhook.mjs list
import { readFileSync } from "node:fs";

for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    // Not every environment has both files.
  }
}

const BASE = process.env.LINQ_API_BASE ?? "https://api.linqapp.com/api/partner/v3";
const KEY = process.env.LINQ_API_KEY;
const APP = process.env.APP_BASE_URL;

if (!KEY) {
  console.error("LINQ_API_KEY is not set. Copy it from https://dashboard.linqapp.com first.");
  process.exit(1);
}
if (!APP) {
  console.error("APP_BASE_URL is not set, so there is no URL to register.");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const url = `${APP.replace(/\/$/, "")}/api/linq/webhook`;

if (process.argv[2] === "list") {
  const r = await fetch(`${BASE}/webhook-subscriptions`, { headers });
  console.log(r.status, await r.text());
  process.exit(r.ok ? 0 : 1);
}

const r = await fetch(`${BASE}/webhook-subscriptions`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    url,
    // Replies are the only inbound event we act on. Delivery receipts and
    // typing indicators would be noise we'd store and never read.
    event_types: ["message.received"],
  }),
});

const text = await r.text();
if (!r.ok) {
  console.error(`Failed (${r.status}): ${text}`);
  process.exit(1);
}

console.log(`Registered ${url}`);
console.log(text);
console.log(
  "\nCopy the signing secret above (it starts with whsec_) into LINQ_WEBHOOK_SECRET,\n" +
    "in Vercel and in app/.env.local. Until it is set, every inbound reply is rejected."
);
