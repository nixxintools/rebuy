# Review brief — Rebuy

You are reviewing a live product, not a toy. Read the code before judging it.

## What Rebuy is

An agent that captures post-purchase price drops. A user pastes an order
receipt; GPT-4o extracts it; we link it to a live product on a US Shopify
merchant (Anker / Allbirds / Brooklinen) and read that store's real current
price. When the live price falls below what the user paid — and their return
window is still open with days to spare — the agent autonomously charges a
pre-approved Prava mandate (a standing spend authorization: one merchant, a
ceiling equal to the original purchase price, one charge, 7-day expiry,
approved once with a passkey) to rebuy at the lower price. The user then
returns the original and keeps the difference, less our 15% share.

Live at https://rebuy.upthink.app. This has completed a real end-to-end
transaction on Prava's sandbox.

## Stack

Next.js 16.2 (App Router, Turbopack, route groups), React 19, MUI v9 (light
theme, blue #2563eb → teal #0d9488 gradient), Tailwind v4 present but barely
used, Prisma 6 on Postgres, deployed on Vercel. Passwordless magic-link auth
with hashed session cookies. `proxy.ts` (Next 16's renamed middleware) does a
cookie-presence check; real authorization is in route handlers via
`lib/owned.ts` and `lib/auth.ts`.

## Where to look

- `app/(marketing)/page.tsx` — landing
- `app/(marketing)/login/page.tsx` — sign-in
- `app/(app)/dashboard/page.tsx` — the user's purchases (server component)
- `app/(app)/add/page.tsx` — paste receipt → confirm parse → pick live product
- `app/(app)/items/[id]/page.tsx` — the main surface: authorize, guardrails,
  price watch, return hand-off, activity log
- `app/(app)/payments/page.tsx` — authorizations, charge history, earnings
- `components/`, `lib/` — theme, Prava client, agent decision logic, merchants

## What I want from you

**Usability improvements for signed-in users**, above all else. The logged-in
experience is where this product lives or dies: someone has to understand what
an autonomous agent is about to do with their money and feel safe letting it.

Judge specifically:
1. **Comprehension** — can a non-technical person tell what the agent will do,
   what it cannot do, and what it has already done? The guardrails (merchant
   scope, spend ceiling, single charge, expiry, revoke) are the trust story.
2. **The add-receipt flow** — three steps in one page. Too long? Is the
   product-matching step confusing? What happens when the AI parse is wrong or
   the product isn't found?
3. **Dead ends and missing states** — what happens on failure, on an empty
   catalogue search, when a charge is declined, when the return window closes,
   when a price never drops? Find the states we don't handle.
4. **The item page** — it carries authorize, guardrails, price watch, return
   hand-off and audit log. Is that too much on one page? What should be
   promoted, demoted or split?
5. **Payments page** — does it answer "what can this thing spend, and what has
   it spent?" at a glance?
6. **Information hierarchy and visual design** — MUI usage, spacing, type
   scale, colour, mobile behaviour at 375px.
7. **Correctness/UX bugs** — stale data after actions, missing loading or
   disabled states, race conditions, anything that would confuse or mislead.

## Rules

- **Do not change any code.** This is a review. No edits, no commits.
- Be concrete: name the file and what to change, not "improve the UX".
- Prioritise: P0 (blocks real users), P1 (clear win), P2 (polish). Ordered.
- Say what is already good, briefly, so I don't undo it.
- Where you assert a problem, say how it actually bites a user.
- Write your findings to `REVIEW-FINDINGS.md` in this folder.
