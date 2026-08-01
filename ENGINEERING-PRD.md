# Engineering PRD — Return & Rebuy Agent

Build spec for the hackathon MVP. Companion to PRD.md. Written to be executed by an AI coding agent (Claude Code) with the developer approving each milestone.

> **Important correction to the concept note:** the pseudo-code in `concept note.txt` §8.2 (`create_card_token(card_number=...)`, `client.checkout(url=...)`) does **not** exist in Prava's API. You never touch card numbers — the card is entered on Prava's hosted surface. And Prava does not drive a browser through a merchant's site for you; it mints single-use card credentials that *your* flow uses. The real integration is Sessions + Mandates + Mandate Charges, specified below.

---

## 1. Architecture

One deployable app. No microservices, no Redis, no Celery — 48 hours.

```
Next.js 15 (App Router, TypeScript)  →  deployed on Vercel
├── UI: dashboard, item detail, onboarding      (React + Tailwind)
├── API routes (backend, holds sk_test key)
│     /api/receipts/parse      → OpenAI GPT-4o structured extraction
│     /api/items               → CRUD tracked items
│     /api/items/[id]/authorize→ create Prava mandate-setup session
│     /api/items/[id]/price    → price feed (simulated + manual override)
│     /api/items/[id]/execute  → the agent: charge mandate → rebuy → report
│     /api/cron/check-prices   → Vercel Cron (every hour) price sweep
├── DB: SQLite via Prisma locally / Turso or Vercel Postgres in prod
└── Prava callback page  /prava/return  (session redirect target)
```

**Why Vercel is non-negotiable:** Prava sandbox passkeys are real WebAuthn and **origin-bound** — they will not work from `localhost` against Prava's hosted approval page. You need a real HTTPS domain from day one. Deploy first, build on the deployed URL.

**Why SDK/API (not MCP, not CLI):** MCP cannot charge mandates (deliberately excluded) and CLI has no sandbox (live cards only). Mandate charging over REST is the only path that is both sandbox-safe and autonomous. Say this in the submission — judges ask.

## 2. Environment & secrets

`.env.local` (never committed):
```
PRAVA_SECRET_KEY=sk_test_...        # from dashboard.prava.space
NEXT_PUBLIC_PRAVA_PK=pk_test_...
PRAVA_API_BASE=https://sandbox.api.prava.space
OPENAI_API_KEY=sk-...
DATABASE_URL=...
APP_BASE_URL=https://<vercel-app>.vercel.app
```
Mirror the same vars in Vercel project settings.

## 3. Data model (Prisma)

```prisma
model TrackedItem {
  id              String   @id @default(cuid())
  userEmail       String
  retailerName    String   // "Amazon"
  retailerUrl     String   // "https://www.amazon.com"
  orderId         String
  productName     String
  productUrl      String?
  purchasePrice   Decimal
  currentPrice    Decimal
  purchaseDate    DateTime
  returnDeadline  DateTime
  status          String   // ingested | authorized | monitoring | drop_detected | rebuy_complete | return_ready | revoked | expired
  mandateId       String?  // Prava mandate id once active
  sessionId       String?  // mandate-setup session id
  parseConfidence Json?    // per-field confidence from GPT-4o
  createdAt       DateTime @default(now())
  prices          PricePoint[]
  events          AgentEvent[]
}
model PricePoint { id String @id @default(cuid()); itemId String; price Decimal; source String; at DateTime @default(now()); item TrackedItem @relation(...) }
model AgentEvent { id String @id @default(cuid()); itemId String; type String; detail Json; at DateTime @default(now()); item TrackedItem @relation(...) }
// AgentEvent is the audit trail — write one for EVERY external call and decision.
```

Auth: none for the hackathon. Single-user demo, email captured at onboarding. (Cutting auth buys ~4 hours.)

## 4. Prava integration — exact flows

### 4.1 Authorize (mandate setup) — happens once per tracked item

`POST {PRAVA_API_BASE}/v1/sessions` with `Authorization: Bearer sk_test_...`:

```json
{
  "user_id": "<userEmail>",
  "user_email": "<userEmail>",
  "total_amount": "<purchasePrice as string, 2dp>",
  "currency": "USD",
  "purchase_context": [{
    "merchant_details": { "name": "Amazon", "url": "https://www.amazon.com", "country_code_iso2": "US" },
    "product_details": [{ "description": "<productName>", "unit_price": "<purchasePrice>", "quantity": 1 }]
  }],
  "callback_url": "<APP_BASE_URL>/prava/return",
  "mandate_setup": {
    "intent": "mandate_setup",
    "recurring_frequency": "one_time",
    "merchant_scope": "listed",
    "valid_until": "<min(now+7d, returnDeadline) ISO8601>",
    "max_charges": 1
  }
}
```

Notes that will bite you if ignored:
- `purchase_context` is an array of **exactly one** entry.
- All amounts are **strings** with ≤2 decimals.
- `total_amount` becomes the **per-charge cap**, enforced at card-network level → set it to the purchase price. A one-time mandate lives ≤7 days.
- Response 201 → `session_id`, `iframe_url`, `session_token`, `authorizeOnly: true`. Redirect the user to `iframe_url` (hosted flow — simplest). User enters a **sandbox test card** and approves with a passkey. Store `session_id`, set status `authorized`.
- Sessions expire in ~15 min — create the session only when the user clicks "Authorize agent," never earlier.
- After callback, find the mandate via `GET /v1/mandates?customer_id=<userEmail>&standing_only=true`, store `mandateId`, status → `monitoring`.

### 4.2 Price monitor

- `POST /api/cron/check-prices` (Vercel Cron, hourly): for each `monitoring` item, read latest simulated price, append `PricePoint`.
- Simulated feed: item detail page has a dev-labeled "Simulate market" control (set current price). Honest-demo rule: label it "simulated price feed" in the UI.
- Trigger condition: `currentPrice < purchasePrice - max(1, 2% of purchasePrice)` AND `returnDeadline - now > 5 days` AND status == `monitoring` → status `drop_detected`, immediately call execute.

### 4.3 Execute (the agent's autonomous purchase)

`POST {PRAVA_API_BASE}/v1/mandates/{mandateId}/charge`:
```json
{ "amount": "<newPrice as string>", "reference": "<mandateId>:rebuy" }
```
- `reference` is an **idempotency key** — deterministic, so a crashed/re-run job can never double-charge. Always set it.
- Response includes `transactionId`, `status`, and `credentials` `{token, dynamicCvv, expiryMonth, expiryYear}` — the single-use card. In a real product these credentials pay at the merchant's checkout; in the demo we display a masked version ("Prava issued single-use card •••• for $169.99") and record the order as placed in our system.
- **Over-cap is not an exception:** HTTP 200 with `status: "failed"` and code `THRESHOLD_EXCEEDED`. Also handle `MANDATE_EXPIRED` (400) and `MANDATE_NOT_ACTIVE` (409) as normal branches → status back to `monitoring` or `expired`, notify user. Never treat these as crashes.
- Then **report the outcome** (this reconciles with the card network — skipping it makes the transaction look incomplete to judges):
  `POST /v1/mandates/{mandateId}/charges/{transactionId}/report` with `{ "txn_status": "APPROVED", "txn_type": "PURCHASE" }`.
- Persist state before AND after every external call (AgentEvent). Never infer success — read the mandate/payment back.
- Log the `X-Response-ID` response header on every Prava call into AgentEvent — support asks for it when debugging.

### 4.4 Revoke

"Stop watching" → mandate cancel endpoint → status `revoked`. Surface this prominently (trust story).

## 5. OpenAI receipt parsing

`POST /api/receipts/parse` — accepts raw pasted email text or an image (screenshot). Call GPT-4o with structured output (JSON schema): `{ orderId, productName, productUrl?, purchasePrice, purchaseDate, retailer, returnDeadline?, confidence: {field: 0-1} }`. If `returnDeadline` absent, compute purchaseDate + 30 days. Render an editable confirmation form; fields with confidence < 0.8 highlighted for review. This is the OpenAI-track evidence — show the raw→structured transformation in the demo.

## 6. Return handoff

On `rebuy_complete`: generate
- deep link `https://www.amazon.com/gp/css/order-history` (and per-order return URL pattern where known),
- a pre-written return reason ("Found better price"),
- ship-by date = returnDeadline − 2 days.
Status → `return_ready`. Email/SMS out of scope; in-app notification panel only.

## 7. UI (three screens, Tailwind, keep it clean)

1. **Dashboard** — tracked items list with status chips (Monitoring → Drop detected → Rebought → Return ready), total-savings counter, "Add receipt" button.
2. **Item detail** — price history sparkline, return-deadline countdown, mandate card showing the four guardrail layers (merchant scope, spend cap, expiry, revoke button), audit-trail feed, dev "simulate market" control.
3. **Add receipt** — paste/upload → parsed fields with confidence highlights → confirm → "Authorize agent" (Prava redirect).

## 8. Sandbox testing

Test cards (sandbox hosts only): Visa `4622 9431 2313` + last four from the published list (e.g. `7789`, `7797`, `7805`…), expiry `12/27`, **OTP `456789`**. Passkey prompts are real biometrics on your actual device — test on the deployed Vercel URL, and if Prava enforces a domain allowlist for your key, register the Vercel domain in the dashboard.

## 9. Milestones (rest of the build window)

| # | Milestone | Definition of done |
|---|---|---|
| M0 | Scaffold + deploy | Next.js app live on Vercel with env vars set; DB migrated |
| M1 | Prava round-trip | Create mandate-setup session from the deployed app, complete card + passkey with a test card, mandate shows `active` via list-mandates |
| M2 | Receipt → tracked item | Paste real Amazon email text → GPT-4o parse → confirm → item in DB |
| M3 | Agent loop | Simulate drop → autonomous charge with idempotency → report → status/audit trail correct; over-cap branch tested and shown |
| M4 | Polish + demo | Dashboard/guardrail UI, unbroken demo recording, README, Devfolio submission |

M1 is the risk milestone — do it before anything else. If Prava sandbox misbehaves, Birdie (Discord support channel) claims <30 min replies.

## 10. Submission artifacts

Repo (public or judge-access), 3-min demo video, README explaining: user/problem, why SDK+mandates over MCP/CLI (see §1), transaction evidence (Prava dashboard screenshot + `transactionId`s), disclosure (concept note pre-existed; all code in-window), what worked/what didn't.
