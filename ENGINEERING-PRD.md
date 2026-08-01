# Engineering PRD — Rebuy

Documents the system as built. **Live:** https://rebuy.upthink.app ·
**Repo:** https://github.com/nixxintools/rebuy

> Corrections worth carrying forward, each learned the hard way:
> - The `concept note.txt` Prava pseudo-code doesn't exist. You never touch card data, and
>   Prava does not drive a merchant checkout. The surface is **Sessions → Mandates →
>   Charges**.
> - **Amazon cannot be used.** Passing it as merchant details makes Visa refuse card
>   verification before the OTP screen renders. A real merchant fixed it immediately.
> - **Shopify localises pricing by caller region.** Probing from India read an $88 item as
>   ₹8,600 while `meta.json` still said USD. Functions are pinned to `iad1`.
> - Prisma 7 removed `url` from `datasource`; we pin **Prisma 6**.
> - MUI v9 moved `InputProps`/`InputLabelProps`/`*TypographyProps` to `slotProps`, and
>   `alignItems`/`justifyContent` off `Stack` onto `sx`. Next.js 16 renamed
>   `middleware.ts` to `proxy.ts`. Server components cannot pass a component reference to
>   a client component — hence `components/Links.tsx`.

---

## 1. Stack

```
Next.js 16.2 (App Router, Turbopack, route groups) → Vercel (iad1) → rebuy.upthink.app
├── UI         React 19 + MUI v9 (light theme, blue→teal gradient)
├── API        server-only routes; hold sk_test_ and CRON_SECRET
├── DB         Postgres via Prisma 6
└── Cron       daily price sweep · monthly billing run
```

Deployed before feature work because Prava sandbox passkeys are real WebAuthn and
origin-bound — they cannot be exercised from `localhost`.

**Env:** `PRAVA_SECRET_KEY`, `NEXT_PUBLIC_PRAVA_PK`, `PRAVA_API_BASE`, `OPENAI_API_KEY`,
`APP_BASE_URL`, `DATABASE_URL`, `CRON_SECRET`, optional `RESEND_API_KEY` /
`ALLOW_INSECURE_LOGIN`. Sandbox→production is one variable plus live keys.

**Why SDK/API, not MCP or CLI:** MCP deliberately excludes mandate charging, and our core
action is an autonomous charge. The CLI has no sandbox — it runs against production with
live cards. REST is the only path that is both sandbox-safe and autonomous.

## 2. State machine (`lib/status.ts`)

One module defines status, its user-facing meaning, the required action, and whether the
agent still holds spending power. Every state must be justified by evidence we hold.

```
ingested → authorizing → monitoring → drop_detected → purchase_authorized
                                                            ↓
                                     order_placed → return_started → refund_confirmed
```

- `purchase_authorized` — Prava charged, single-use card issued, **no merchant order**.
- `order_placed` / `return_started` / `refund_confirmed` — user-confirmed, because only
  the user can see the merchant and their bank.
- Failure branches: `charge_failed`, `authorization_expired`, `revocation_pending`,
  `revoked`, `expired`, `watch_only`.

`summariseSavings()` is the single source of truth: realized (`refund_confirmed`) versus
pending. Three copies of that arithmetic previously disagreed.

## 3. Merchant registry (`lib/merchant-registry.ts`, `lib/merchants.ts`)

67 US Shopify storefronts. Each carries `windowDays`, `windowStartsFrom`, `cost`,
`feeUsd`, `finalSaleRules`, `categoryExceptions`, `policyUrl`, `confidence`, `verifiedOn`.

Pipeline: ~150 candidates → `scripts/probe-merchants.mjs` (feed + USD + single-product
lookup) → `/api/admin/probe-merchants` re-probes **from iad1** and cross-checks the feed
against Shopify's `.js` cents endpoint and OpenGraph/JSON-LD → parallel policy research
per surviving store, citing sources.

Policy logic:
- `resolveReturnDeadline()` — receipt date wins, else the merchant's window, recording
  `returnWindowSource`. **No global fallback.**
- `canSpendAutonomously()` — needs ≥7 days and non-low confidence.
- `detectFinalSale()` — blocks "last call", "final sale", "clearance" and similar.

## 4. Prava integration (`lib/prava.ts`)

One wrapper attaches the key, writes an `AgentEvent` with `x-response-id`, and raises a
typed `PravaError`.

**Mandate setup** — `POST /v1/sessions` with `mandate_setup` (`one_time`, `listed`,
`valid_until` = min(now+7d, return deadline), cap = purchase price). Gotchas: exactly one
`purchase_context`; string amounts; `external_order_ref` must be unique per attempt or you
get `DUPLICATE_EXTERNAL_ORDER_REF`; sessions expire in ~15 min; merchant details are
forwarded to Visa.

**Confirmation** matches on merchant **and** ceiling and skips mandates already bound to
another item. It previously took the last element of Prava's list, which is the *oldest* —
an Allbirds purchase ended up holding an Anker mandate while the UI advertised Allbirds
guardrails. Caught live during testing.

**Charging** — `rebuyAttempts` counter drives the idempotency reference; `executeRebuy`
re-reads the mandate and refuses on merchant or ceiling mismatch; over-cap and provider
failures arrive as HTTP 200 with `status: "failed"` and are handled as branches.

## 5. Billing (`lib/billing.ts`)

A second mandate scoped to Rebuy: monthly, `listed`, user-visible cap, passkey-approved.

- Fees accrue only on `refund_confirmed` items not already claimed by a charge.
- One charge per `(user, period)` — unique index plus deterministic reference.
- **An unresolved record is retried on its original amount and reference.** Recomputing
  would find nothing, because that record already claims its items, so an interrupted
  charge would be abandoned while the money may already have moved.

## 6. Routes

`/api/receipts/parse` · `/api/merchants/search` · `/api/items` (GET/POST) ·
`/api/items/[id]` (GET/DELETE) · `.../authorize` · `.../confirm-mandate` · `.../price` ·
`.../advance` · `.../revoke` · `/api/payments` · `/api/billing/authorize` ·
`/api/billing/confirm` · `/api/cron/check-prices` · `/api/cron/bill` ·
`/api/admin/probe-merchants`.

All user routes scope to the session; item routes 404 on someone else's id rather than
403, so they can't probe for valid ids. Both crons require `CRON_SECRET`.

Cron runs daily (Vercel Hobby caps sub-daily), so the copy says "checked every day and any
time you open Rebuy" rather than the round-the-clock claim it made before.

## 7. Verification performed

- Auth gates by `curl`: all protected endpoints 401; another user's item 404s; a second
  signed-in account sees an empty list.
- Policy sourcing: a Taylor Stitch receipt with no deadline produced 2026-08-20 — exactly
  21 days, not 30.
- Final-sale guard: a live Brooklinen "Last Call" robe and a Graza product both landed in
  `watch_only` with explanations.
- Funnel: illegal jumps refused; walking the funnel moved savings from $0 realized /
  $75 pending to $55 realized / $20 pending, fee $8.25 on the realized portion only.
- Billing: accrual correct, both endpoints gated, empty run safe; crash-recovery path
  reproduced and fixed.
- Two real Prava sandbox transactions completed end to end.

## 8. Known limitations

- **No merchant order is placed** — see PRD §6. Stated in-product, not hidden.
- **Returns are not auto-filed**; we route the user with the deadline and reason.
- **Email delivery not configured** — sign-in currently shows the magic link on screen
  behind `ALLOW_INSECURE_LOGIN`. That flag must be removed once a Resend key is set.
- Sandbox only; production needs Prava approval.

## 9. Devfolio submission checklist

Fields: Project Name · Tagline · Problem it solves · Challenges you ran into ·
Technologies used · Links · Video Demo · Screenshots.

- **Sponsor tracks are claimed via "Technologies used"** — name `Prava`, `OpenAI GPT-4o`,
  `Visa Intelligent Commerce`, `Shopify`, `Next.js`, `Prisma`, `Vercel`.
- **First screenshot becomes the cover image.**
- Only the **team admin** can submit; all members must be checked in.
- **Publish early** — it stays editable until the deadline.
- Video: YouTube, 2–3 minutes, opening on the live price drop and autonomous charge.
