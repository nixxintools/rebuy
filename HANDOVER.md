# Handover

Written 2026-08-02, roughly 15 hours before the submission deadline.

**Deadline:** Aug 2, 3:00 PM PT / Aug 3, 3:30 AM IST. The Devfolio page also shows a later
7:00 PM PT time; treat 3:00 PM PT as real.

**Live:** https://rebuy.upthink.app · **Repo:** https://github.com/nixxintools/rebuy
Working tree is clean and pushed.

---

## What still has to happen

Only three things are mandatory, and all three need the user, not the agent.

1. **Record the demo video.** Script with stage directions is in
   [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md), including the receipt to paste and the card to use.
   Nothing blocks this; the whole flow was rehearsed end to end.
2. **Take five screenshots.** Order is at the bottom of [SUBMISSION.md](SUBMISSION.md). The
   first becomes the cover, and should be an item page in `purchase_authorized` showing the
   guardrails and the "no order exists yet" card.
3. **Publish on Devfolio.** Copy is ready in [SUBMISSION.md](SUBMISSION.md). Sponsor tracks are
   claimed by naming them in "Technologies used". Publishing early is safe because it stays
   editable until the deadline, and only the team admin can submit.

Optional, in rough value order:

- **Verify `upthink.app` in Resend.** Sign-in email currently sends from `onboarding@resend.dev`,
  which Resend only delivers to the account owner's own address. A judge signing in with their
  own email gets nothing, and the on-screen link fallback is switched off. A few DNS records at
  Namecheap fixes it.
- **Request Prava production access** by emailing support@prava.space. Not needed for judging,
  and switching the demo to production would spend real money, so request it as a signal only.
- **Move to `rebuyit.store`** after submission. Untested against Prava's origin validation; the
  API key was registered with `rebuy.upthink.app`, so test a callback before switching.

## What is built and verified

Five real Prava sandbox transactions: three autonomous rebuys (Anker $39.99, Allbirds $105,
Taylor Stitch $228), a fourth rebuy gated by Senso (Anker $69.99,
`txn_01KZ0K7W6YG8AW8J224SPRZ7JZ`), and one fee collection of $6.90
(`txn_01KZ0EPJFZQ7BMRKD29V5PDAS5`). None are mocked.

- **Honest state machine** (`lib/status.ts`): `purchase_authorized` means money reserved and a
  single-use card issued, with no merchant order. The funnel to `refund_confirmed` is
  user-confirmed. Savings count only when banked.
- **67-merchant registry** (`lib/merchant-registry.ts`): every price feed probed from `iad1` and
  every return policy read from the merchant's own page with source URL and date. Ranked
  publicly at `/merchants`.
- **Senso** (`lib/senso.ts`): all 67 policies ingested as verified knowledge. The agent asks
  whether an item can be returned before charging, records the cited answer in the audit trail,
  and writes the outcome back afterwards. Blocking logic tested against real answers.
- **Billing** (`lib/billing.ts`): a second Prava mandate scoped to Rebuy. First rebuy free, then
  billing required. Billed in arrears on banked savings only, one charge per period, capped at
  $15/month with excess waived.
- **Auth**: passwordless magic link, sessions hashed, item routes 404 on someone else's id.

## Current data

| Merchant | Status | Paid | Rebought |
|---|---|---|---|
| Anker | purchase_authorized | $114.99 | $69.99 |
| Anker | purchase_authorized | $59.99 | $39.99 |
| Taylor Stitch | purchase_authorized | $250 | $228 |
| Allbirds | refund_confirmed | $160 | $105 |
| Brooklinen | watch_only | $120 | blocked, Last Call is final sale |
| Graza | expired | $40 | blocked, no returns accepted |

Totals: $46 banked, $69 pending, $6.90 collected in fees.

The Graza and Brooklinen rows are worth keeping. They are the registry visibly refusing to spend
where a return is impossible, which is the most persuasive thing in the product.

## Known limitations, stated deliberately

- **No order is placed at the merchant.** UCP checkout needs a published signed agent profile,
  RFC 9421 signing, and the merchant accepting a Prava credential as a payment handler. Probing
  Anker's live UCP endpoint rejected every documented wire format at handshake. The product says
  so on screen rather than hiding it.
- **Returns are not auto-filed.** The user is routed with the deadline and reason.
- **`detectFinalSale` is keyword-based**, not per-merchant. The registry holds richer rules than
  the matcher uses. A reviewer flagged this; it will miss cases like Peak Design apparel.
- **Return window start dates are approximated.** Many policies run from delivery, we compute
  from purchase. That is the conservative direction, which is why it was left.
- **Cron runs daily** (Vercel Hobby ceiling), plus an on-view check when the last one is stale.
  Landing copy was rewritten to match.

## Useful commands

```bash
cd app
npm run build                      # always green before deploying
vercel --prod --yes
npx prisma db push                 # schema changes; never --force-reset, it holds real transactions
node scripts/build-senso-corpus.mjs "rebuy_session=<cookie>"   # regenerate Senso docs
```

Signed-in API checks use a session cookie jar at `/tmp/cj.txt`. If it expires, mint a login token
directly in the database rather than weakening the production auth config.

## Outstanding review findings

An independent Codex review (read-only) raised nine P0s. The ones that could cost a user money
are fixed: return costs entering the decision, unevidenced charge success, revocation reporting,
variant substitution, and the marketing copy contradicting the product. Remaining, in priority
order: per-merchant final-sale rules, cron sweeps for post-charge states, races between the cron
and user actions on unconditional status writes, and fee idempotency across a replaced fee
mandate. Full findings are in the scratchpad, not the repo.
