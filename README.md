# Rebuy

**An agent that captures post-purchase price drops.** You bought it, the price fell, and the
store won't refund the difference. Rebuy watches the real price, and when it drops far enough
to actually be worth it — while you can still return the original — it charges a spend
authorization you approved once and funds the cheaper replacement.

**Live:** https://rebuy.upthink.app · **Merchant registry:** https://rebuy.upthink.app/merchants

Built for the Prava Agentic Commerce Hackathon, August 2026.

---

## The idea

Retailers don't refund price drops. The workaround — return it and buy it again — takes
enough effort that almost nobody does, so the money quietly stays with the store.

The insight the product is built on: **a return window isn't red tape, it's how long your
money stays recoverable.** Marine Layer gives a price 365 days to fall. Taylor Stitch gives it
21. Same purchase, completely different odds — and nobody shops that way, because nobody
presents return policy as an asset.

That fact is also load-bearing. The return window sets the spend authorization's expiry and
gates every buy decision. Guess it long and the agent buys a replacement for something you can
no longer return, turning "saved you $40" into "cost you $160." So the thing that makes the
pitch interesting is also the thing that has to be right, which is why there are 67 verified
merchant policies behind it rather than a hardcoded 30 days.

## How it works

1. **Paste a receipt.** GPT-4o extracts the order number, price, date and any stated return
   deadline, with per-field confidence. Anything below 80% is flagged for you to check.
2. **Pick the exact product and variant** from the merchant's live catalogue. Nothing is
   auto-selected — buying the wrong size on your behalf isn't a saving.
3. **Approve once with a passkey.** A Prava mandate: this merchant only, never more than you
   originally paid, one charge, expiring with your return window. The ceiling is enforced by
   the card network, not by our code.
4. **The agent watches the live price** and acts on a qualifying drop with no further input.
5. **You finish checkout and return the original.** Rebuy issues a single-use card; it does not
   place the order (see [Honest boundaries](#honest-boundaries)).

## Honest boundaries

Worth stating plainly, because an earlier version got this wrong and it mattered.

**The final order submission is deliberately blocked.** After the charge, the agent creates a
real checkout at the merchant over UCP: published agent profile, capability negotiation, exact
variant, the merchant's card handler attached. The one call it does not make is
`complete_checkout`, because the Prava card is a sandbox credential and placing a live order at
a real store with test money would be wrong. The guard is one env switch
(`UCP_COMPLETE_CHECKOUT`); the interface says exactly where automation stopped and why,
including "don't return the original until you've bought the replacement."

An earlier build said "Repurchase complete" and offered "Open the new order" over a cart link.
Someone who trusted that screen would have returned their only item and been left with nothing.

**Returns are not auto-filed.** We route you to the merchant with the deadline and reason.

**Sandbox only.** Production needs Prava approval; it's one environment variable away.

## Architecture

```
Next.js 16 (App Router, Turbopack) → Vercel (pinned to iad1) → rebuy.upthink.app
├── UI          React 19 + MUI v9
├── API         server-only routes holding the Prava secret and cron secret
├── DB          Postgres via Prisma 6
└── Cron        daily price sweep · monthly billing run
```

| Module | Responsibility |
|---|---|
| `lib/status.ts` | The state machine, and the only place savings are computed |
| `lib/merchant-registry.ts` | 67 merchants with verified return policies and sources |
| `lib/merchants.ts` | Live catalogue access + the rules deciding where we may spend |
| `lib/agent.ts` | Price checks, the drop decision, and the charge |
| `lib/prava.ts` | Prava client; audits every call with its `x-response-id` |
| `lib/billing.ts` | How we get paid, and the guarantees around it |

### The state machine

Every state must be justified by evidence we hold.

```
ingested → authorizing → monitoring → drop_detected → purchase_authorized
                                                            ↓
                        order_placed → return_started → refund_confirmed
```

The post-charge steps are user-confirmed, because only you can see the merchant and your bank.
Savings count as banked only at `refund_confirmed`. Failure branches — `charge_failed`,
`authorization_expired`, `revocation_pending`, `billing_required`, `watch_only` — are real
states with their own copy, not a silent fallback to "monitoring".

### The merchant registry

Every merchant is verified twice:

- **Price feed** — probed from our own US-region function and cross-checked against the
  storefront's authoritative figure. Shopify localises pricing by *caller* region, so probing
  from outside the US read an $88 polo as ₹8,600 while the store still reported USD.
- **Return policy** — read from the merchant's own policy page, recording the window, who pays,
  final-sale rules, the source URL and the verification date. Where a window varies by category
  we store the shortest.

There is no global fallback deadline. An unverified or zero-return merchant is watch-only: we'll
track the price and refuse to spend. Final-sale items are blocked too — Brooklinen's storefront
is largely "Last Call", which can't be returned at any price, and buying a replacement for one
would leave you holding both.

Return cost enters the decision, not just the copy. A $5 drop at a merchant charging $9.90 to
return leaves you worse off, so the agent nets it out before acting and before we bill.

### How we get paid

15% of what you actually bank, on a second Prava mandate scoped to Rebuy — the same primitive
the agent spends with, approved by passkey and revocable the same way.

- **Your first saving is free.** Nobody is asked to authorize payment before seeing it work.
- **Billed in arrears**, only on savings you've confirmed banking. Never on an authorized but
  unfinished purchase.
- **Never more than $15 in a month**, however much we save you. Excess is waived, not deferred.
- One charge per period, enforced by a unique index and a deterministic reference.

## Running locally

```bash
cd app
npm install
npx prisma db push
npm run dev
```

`.env.local`:

```
PRAVA_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PRAVA_PK=pk_test_...
PRAVA_API_BASE=https://sandbox.api.prava.space
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgres://...
APP_BASE_URL=https://your-deployment
CRON_SECRET=<random>
RESEND_API_KEY=re_...             # optional; without it, sign-in email can't be sent
UNLIMITED_REBUY_EMAILS=           # optional; accounts exempt from the free-rebuy limit
```

**Deploy before testing Prava.** Sandbox passkeys are real WebAuthn and origin-bound — they
cannot be exercised from `localhost`.

### Merchant tooling

```bash
node scripts/probe-merchants.mjs      # candidate storefronts → probe-results.json
node scripts/validate-prices.mjs      # cross-check feed prices against displayed prices
```

`POST /api/admin/probe-merchants` re-runs the probe from the deployed US region, which is the
only place currency-correct results can be obtained. Requires `CRON_SECRET`.

## Verification performed

- Auth gates by `curl`: protected endpoints return 401; another user's item returns 404, not 403,
  so ids can't be probed.
- Policy sourcing: a Taylor Stitch receipt with no stated deadline produced a deadline exactly
  21 days out, not 30.
- Final-sale guard: a live Brooklinen "Last Call" robe and a Graza product both landed in
  `watch_only` with explanations.
- Funnel: illegal transitions refused; walking it moved savings from $0 banked / $75 pending to
  $46 banked / $11 pending, with the fee computed on the banked, net-of-return-cost figure.
- Billing: the free-rebuy gate refuses a second authorization with a 402; an interrupted charge
  is retried on its original reference rather than abandoned.
- Two real Prava sandbox transactions completed end to end.

## Notable things learned

**Amazon can't be used.** Passing it as merchant details makes Visa refuse card verification
before the OTP screen renders. Switching to a real merchant fixed it immediately.

**Prices are region-dependent.** See above — this would have shipped silently.

**The hard part isn't the payment.** Prava makes the transaction genuinely easy. The hard part
is making sure what the screen says matches what the agent can actually do. Nearly every serious
bug here was a gap between the two: guardrails displayed that weren't the ones enforced, a
purchase claimed that never happened, a revocation reported that hadn't completed.

## Disclosure

Pre-existing before the build window: a concept note and PRD drafts. All code was written during
the hackathon with AI assistance, disclosed and permitted. Every transaction shown is a real
Prava sandbox transaction — none are mocked.
