# Working in this repo

Rebuy is an agent that captures post-purchase price drops. It spends real money on a user's
behalf, so the standards below are not style preferences.

**Read [HANDOVER.md](HANDOVER.md) first** for current state and what is outstanding.

**Talk to Nikhil in plain, direct English.** Short sentences. Say what things do, not what
they're called. No jargon, no dense compressed phrasing. He has made this a standing rule.

## The rule that matters most

**Never claim something the code cannot evidence.** An earlier build told users "Repurchase
complete" and offered "Open the new order" after a Prava charge, when nothing anywhere places
an order at a merchant. Someone trusting that screen would have returned their only item and
been left with nothing.

Every status in `lib/status.ts` must be justified by evidence actually held. A completed charge
proves a card credential was issued. It does not prove an order exists. If you add a state, say
plainly what is true and what the user must still do.

The same applies to failure. Revocation reports success only when Prava confirms a terminal
state, because telling someone their agent cannot spend when it still can is worse than
reporting a failure.

## Money correctness

- **Savings are net.** Returning an item costs money at most merchants. `netSaving()` in
  `lib/status.ts` is the only place savings are computed; do not recompute inline.
- **Idempotency is stored, not derived.** `TrackedItem.rebuyAttempts` and `FeeCharge.reference`
  drive charge references. Never derive one by counting events.
- **A charge succeeded only with a terminal status and a transaction id.** Anything else stays
  pending and retryable. Do not treat "not failed" as success.
- **Fees bill in arrears on banked savings only** (`refund_confirmed`), one charge per
  `(user, period)`, capped at $15/month with the excess waived rather than deferred.

## Things that cost hours to learn

- **Amazon cannot be used.** Passing it as `merchant_details` makes Visa refuse card
  verification before the OTP screen renders.
- **Shopify localises prices by caller region.** Probing from outside the US read an $88 item
  as 8,600 rupees while `meta.json` still said USD. Vercel functions are pinned to `iad1`, and
  merchants must be validated from there via `/api/admin/probe-merchants`.
- **Prava sandbox passkeys are origin-bound real WebAuthn.** They cannot be exercised from
  localhost. Deploy first.
- **`external_order_ref` must be unique per attempt** or you get `DUPLICATE_EXTERNAL_ORDER_REF`.
- **Prava's mandate list returns newest first.** Match a mandate by merchant and ceiling, never
  by position. Taking the last element once bound an Allbirds purchase to an Anker mandate while
  the UI advertised Allbirds limits.
- **Prava sandbox goes down.** It returned 500 on every endpoint for about ten minutes on Aug 2
  while `/health` still said ok. Check their API directly before debugging our code.
- **Next.js 16** renamed `middleware.ts` to `proxy.ts`. **MUI v9** moved `InputProps`,
  `InputLabelProps` and `*TypographyProps` to `slotProps`, and `alignItems`/`justifyContent` off
  `Stack` onto `sx`. **Prisma 7** removed `url` from `datasource`, so we pin Prisma 6.
- Server components cannot pass a component reference to a client component. Use
  `components/Links.tsx`.
- **Linq's first message to anyone cannot contain a link**, so `lib/notify.ts` only appends one
  once `User.linqChatId` exists, which is proof we already have a thread with that person.
  A reply of STOP must silence us immediately; that check lives in `notifyOnce()` so no caller
  can skip it.

## Secrets

Never in the repo. They live in Vercel project env and `app/.env.local`, which is gitignored.
Scan the staged diff before committing. Keys currently set: `PRAVA_SECRET_KEY`,
`NEXT_PUBLIC_PRAVA_PK`, `OPENAI_API_KEY`, `DATABASE_URL`, `CRON_SECRET`, `RESEND_API_KEY`,
`SENSO_API_KEY`, `UNLIMITED_REBUY_EMAILS`.

Not set yet, and texting stays completely off until both are: `LINQ_API_KEY` and
`LINQ_WEBHOOK_SECRET`. `LINQ_FROM_NUMBER` is `+12062619826`.

## Verifying

Test the deployed site with `curl`, not the UI. Protected endpoints must return 401; another
user's item id must return 404 rather than 403. When something looks broken, check the provider
directly before assuming it is our bug.

Do not run external review tools with write access to the working tree. A Codex review with
`--sandbox workspace-write` reverted in-flight edits to leave the tree clean and cost a commit.
Use `--sandbox read-only` and write findings outside the repo.
