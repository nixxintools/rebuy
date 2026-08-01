# Engineering PRD — Rebuy

**Status:** built and deployed. This documents the system as it actually exists, not as originally planned.
**Live:** https://rebuy.upthink.app · **Repo:** https://github.com/nixxintools/rebuy

> Corrections to earlier drafts, so nobody rebuilds a wrong assumption:
> - The `concept note.txt` Prava pseudo-code (`create_card_token(card_number=…)`, `client.checkout(url=…)`) does not exist. You never handle card data, and Prava does not drive a merchant checkout for you. The real surface is **Sessions → Mandates → Mandate Charges**.
> - Amazon cannot be used. Passing `Amazon / amazon.com` as merchant details causes Visa card verification to fail before the OTP screen renders. Confirmed by observation: identical session with a real merchant succeeded immediately.
> - Prisma 7 removed `url` from `datasource`; we pin **Prisma 6**.

---

## 1. Stack as built

```
Next.js 16.2 (App Router, TypeScript, Turbopack)  →  Vercel  →  rebuy.upthink.app
├── UI            React 19 + Tailwind v4
├── API routes    server-side only; holds sk_test_ key
├── DB            Postgres (Prisma Postgres) via Prisma 6
└── Scheduler     Vercel Cron → /api/cron/check-prices
```

Deployed on Vercel because Prava sandbox passkeys are **real WebAuthn and origin-bound** — they cannot be exercised from `localhost`. A real HTTPS origin was required before the first integration test, so deployment came before feature work. DNS: `rebuy` A record → `76.76.21.21`.

**Environment variables** (Vercel production + `.env.local`; `.env` additionally holds `DATABASE_URL` for the Prisma CLI):
```
PRAVA_SECRET_KEY      sk_test_…      server only, never exposed
NEXT_PUBLIC_PRAVA_PK  pk_test_…
PRAVA_API_BASE        https://sandbox.api.prava.space
OPENAI_API_KEY        sk-proj-…
APP_BASE_URL          https://rebuy.upthink.app
DATABASE_URL          postgres://…
```
Sandbox → production is a single change of `PRAVA_API_BASE` plus live keys. Nothing else in the code branches on environment.

## 2. Why SDK/API rather than MCP or CLI

Not a preference — a constraint, and worth saying out loud when asked:

- **MCP deliberately excludes mandate charging.** Our core action is an autonomous recurring-style charge, so MCP cannot express it.
- **The CLI has no sandbox** — it runs against production with live cards. Unusable for a hackathon demo.
- **REST/SDK is the only path that is both sandbox-safe and autonomous.**

## 3. Data model (`prisma/schema.prisma`)

```prisma
TrackedItem {
  id, userEmail
  merchantId, retailerName, retailerUrl, currency     // resolved from lib/merchants.ts
  orderId, productName, productUrl, productHandle,     // productHandle is the live-price key
  variantId, imageUrl
  purchasePrice, currentPrice, rebuyPrice              // Decimal(10,2)
  purchaseDate, returnDeadline
  status                                               // see state machine
  mandateId, sessionId
  parseConfidence                                      // GPT-4o per-field confidence
  prices  PricePoint[]                                 // full price history
  events  AgentEvent[]                                 // audit trail
}
```

`AgentEvent` is written **before and after every external call**, including the Prava `x-response-id` header — support asks for it, and it doubles as the user-facing activity feed.

**State machine:**
`ingested → authorizing → monitoring → drop_detected → return_ready`, with `revoked` and `expired` as terminal branches. `authorizing` exists because the user leaves for Prava's hosted page and may not come back.

Auth is deliberately absent — single-user demo, email captured at ingest. That decision bought roughly four hours.

## 4. Merchant layer (`lib/merchants.ts`)

Three US Shopify storefronts, all USD and all UCP-verified (`2026-04-08`, advertising `dev.ucp.shopping.checkout`):

| id | Merchant | Domain | UCP/MCP endpoint |
|---|---|---|---|
| `anker` | Anker | us.anker.com | `https://ankerus.myshopify.com/api/ucp/mcp` |
| `allbirds` | Allbirds | www.allbirds.com | `https://weareallbirds.myshopify.com/api/ucp/mcp` |
| `brooklinen` | Brooklinen | www.brooklinen.com | `https://brooklinen2.myshopify.com/api/ucp/mcp` |

**Search** — `/search/suggest.json` (the store's own search box endpoint), falling back to scanning `/products.json?limit=250` and scoring by title-term overlap. Allbirds and Brooklinen return no suggest hits, which is why the fallback exists.

**Live price** — `GET https://{domain}/products/{handle}.json`, reading the first available variant. This is the monitor's data source. All fetches use a 15s timeout and `cache: "no-store"`; a failed lookup surfaces as an error rather than a silent stale price.

### Why we do not place the merchant order
UCP checkout requires publishing an agent profile JSON with JWK signing keys at a stable URL, referencing it via a `UCP-Agent` header or MCP `_meta`, and signing every request per RFC 9421. Live probing of Anker's endpoint rejected every documented wire format with `invalid_profile_url` even at `initialize` — so beyond the signing work there is likely an allowlist. Separately, the merchant would have to accept a Prava credential as a UCP payment handler, which is merchant-side configuration we don't control. Not a weekend task; documented as a known boundary rather than faked.

## 5. Prava integration (`lib/prava.ts`)

All calls go through one wrapper that attaches the bearer key, records an `AgentEvent` with the `x-response-id`, and raises a typed `PravaError(status, code, responseId, body)`.

### 5.1 Mandate setup — once per tracked item
`POST /v1/sessions` with a `mandate_setup` block:

```json
{
  "user_id": "<email>", "user_email": "<email>",
  "total_amount": "<purchase price>", "currency": "<merchant currency>",
  "purchase_context": [{
    "merchant_details": { "name": "Anker", "url": "https://us.anker.com", "country_code_iso2": "US" },
    "product_details": [{ "description": "<product>", "unit_price": "<price>", "quantity": 1 }]
  }],
  "callback_url": "<APP_BASE_URL>/prava/return?item=<id>",
  "external_order_ref": "<itemId>:<timestamp>",
  "mandate_setup": {
    "intent": "mandate_setup", "recurring_frequency": "one_time",
    "merchant_scope": "listed", "valid_until": "<min(now+7d, returnDeadline)>", "max_charges": 1
  }
}
```

Hard-won details:
- `purchase_context` takes **exactly one** entry. Amounts are **strings**, ≤2 decimals.
- `external_order_ref` **must be unique per attempt** — reusing it returns `DUPLICATE_EXTERNAL_ORDER_REF`. We suffix a timestamp.
- `merchant_details` are forwarded to Visa. An unrecognised or impersonated merchant fails verification downstream, not at session creation. This is the Amazon failure.
- Sessions expire in ~15 minutes — create one only when the user clicks Authorize.
- Response gives `iframe_url`; we redirect the full page there (hosted flow). The user enters the card, clears an **issuer OTP** (sandbox `456789`), then registers a passkey.
- On return, `/api/items/[id]/confirm-mandate` polls `GET /v1/mandates?customer_id=…` for the newly active mandate and attaches it. The callback page retries five times before telling the user to confirm manually — mandate activation is not instant.

### 5.2 Charging
`POST /v1/mandates/{id}/charge` with `{ amount, reference }`.

- `reference` is the idempotency key. It is **attempt-scoped**: `{mandateId}:rebuy:{n}` where `n` counts prior `rebuy_started` events. A resumed run reuses the reference and de-duplicates; a genuinely failed attempt can still be retried. A fixed key made failures permanently unretryable — that was a real bug, found and fixed.
- **Failure is not an exception.** Over-cap, and the Visa error below, arrive as **HTTP 200 with `status: "failed"`**. Treated as a normal branch that returns the item to `monitoring` and records `rebuy_failed`.
- `MANDATE_EXPIRED` → `expired`; `MANDATE_NOT_ACTIVE` / other `PravaError` → back to `monitoring`.
- On success, `POST /v1/mandates/{id}/charges/{txnId}/report` with `{ txn_status: "APPROVED", txn_type: "PURCHASE" }` reconciles with the card network. A failed report is swallowed — it must never lose a completed charge.

### 5.3 Known platform blocker
Charges currently fail with:
```
status: "failed", errorCode: "FETCH_AGENTIC_CREDS_ERROR",
errorMessage: "Visa 400 —  Fetching cryptogram failed"
```
on a mandate that is `active` / `available`, `approvedAmount 59.99`, `remaining 59.99`, `chargeCount 0`. Reproduced three times across partial and exact amounts, same `instructionId` each time. Session creation, passkey approval and mandate activation all succeed. Raised with Prava support with `x-response-id 3cd4626d-ee52-41bf-b063-845ae8ff265b`.

## 6. The agent (`lib/agent.ts`)

```
checkPrice(itemId)
  → fetchProduct(merchant, handle)          // live merchant price
  → recordPrice()                            // PricePoint + currentPrice
  → dropTriggered(paid, live, deadline)?     // ≥$1 or ≥2%, >5 days left
      → status drop_detected + AgentEvent
      → executeRebuy()
           charge mandate (attempt-scoped reference)
           → failed?  → monitoring | expired, AgentEvent, stop
           → ok       → report to network → return_ready, rebuyPrice set
```

Every transition persists before and after the external call. Success is never inferred — it is read back from Prava's response.

## 7. Routes

| Route | Purpose |
|---|---|
| `POST /api/receipts/parse` | GPT-4o structured extraction (JSON schema, strict) with per-field confidence |
| `GET /api/merchants/search` | Live catalogue search for the product-linking step |
| `GET POST /api/items` | List / create (create resolves the live product and seeds price history) |
| `GET DELETE /api/items/[id]` | Detail with prices + events / remove |
| `POST /api/items/[id]/authorize` | Create mandate-setup session, return `iframe_url` |
| `POST /api/items/[id]/confirm-mandate` | Attach the activated mandate after callback |
| `POST /api/items/[id]/price` | Re-read live price now; agent acts if triggered |
| `POST /api/items/[id]/revoke` | Cancel the mandate, stop watching |
| `GET /api/cron/check-prices` | Scheduled sweep; also expires closed return windows |

Cron runs daily (`0 6 * * *`) — Vercel's Hobby plan rejects sub-daily schedules. On a paid plan this becomes hourly; the handler is already idempotent and safe to run at any frequency.

## 8. Receipt parsing

GPT-4o with `response_format: json_schema` (strict), returning order ID, product name, price, dates, and a `confidence` object. Missing return deadline defaults to purchase date + 30 days. Fields below 0.8 confidence are highlighted amber for the user to verify. This is the OpenAI-track evidence: unstructured text in, corrected structured record out.

## 9. Testing notes

- Sandbox Visa cards: `4622 9431 2313 7789` (CVV 757), `…7797` (640), `…7805` (304) — expiry `12/27` for all. **OTP `456789`.**
- Passkeys are origin-bound and require a platform authenticator. Test on the deployed HTTPS domain.
- `GET https://sandbox.api.prava.space/health` before debugging anything else.
- Always log `x-response-id`.

## 10. Recommended next work, in priority order

1. **UCP discovery surface (~1–2h).** Fetch and display each merchant's `/.well-known/ucp` manifest in the UI, proving the agent detects agent-ready checkout. Converts the honest gap in §4 into an architecture statement: the missing piece is the merchant accepting a Prava credential as a payment handler — configuration, not a rebuild.
2. **Cart permalink (~15m).** `https://{domain}/cart/{variantId}:1` hands the user a pre-filled cart at the dropped price. Real, works today, makes the last mile tangible.
3. **Design pass.** Direction pending from the product owner.
4. Email notification on drop; multi-item dashboard polish.

## 11. Devfolio submission checklist

Fields required: **Project Name · Tagline · Problem it solves · Challenges you ran into · Technologies used · Links · Video Demo · Screenshots.**

- **"Technologies used" is how sponsor tracks are claimed** — must explicitly name `Prava`, plus `OpenAI GPT-4o`, `UCP`, `MCP`, `Shopify`, `Next.js`, `Visa Intelligent Commerce`.
- **First screenshot becomes the cover image.** Order them deliberately.
- Only the **team admin** can submit, and every member must be checked in.
- **Publish early.** Publishing makes it public immediately but it stays editable until the deadline — there is no penalty for publishing a rough version and refining it.
- Demo video: YouTube (unlisted is fine), 2–3 minutes, opening with the money shot — live price drop → autonomous mandate charge.
- Must include: disclosure of pre-existing work, explanation of the Prava integration and transaction outcome, and what worked / what didn't.
