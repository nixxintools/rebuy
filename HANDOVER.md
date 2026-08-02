# Handover

Written August 2, about 15 hours before the deadline.

**Deadline:** August 2, 3:00 PM Pacific time — that's August 3, 3:30 AM in India. Devfolio
also shows a later time in one place; trust the earlier one.

**Live site:** https://rebuy.upthink.app · **Code:** https://github.com/nixxintools/rebuy
Everything is committed and pushed.

**A rule for whoever picks this up:** Nikhil is not a developer. Write to him in plain,
direct English. Short sentences. Say what things do, not what they're called. He has
called out jargon-heavy updates twice and made this a standing rule.

---

## What still needs to happen

Three things. All three need Nikhil, not an AI.

1. **Record the demo video.** Three minutes. The script is deliberately not in this repo any
   more — if you need it back, the last version is in git history:
   `git show 29836a1:VIDEO-SCRIPT.md`.
2. **Take five screenshots.** The list is at the bottom of [SUBMISSION.md](SUBMISSION.md).
   The first one becomes the cover image on Devfolio, so it should be the page that shows
   the agent bought something and prepared the cart at Anker. For the project logo on
   Devfolio, upload `brand/rebuy-icon-512.png`.
3. **Publish on Devfolio.** All the text is ready in [SUBMISSION.md](SUBMISSION.md).
   Publish early, it stays editable until the deadline. Only the team admin can submit.
   There is also a separate write-up for the Localhost startup track in
   [LOCALHOST-SUBMISSION.md](LOCALHOST-SUBMISSION.md), which has two short sections only
   Nikhil can write: whether anyone has reacted to the product, and why he will keep
   working on it.

4. **Switch on the texting.** The code is written, built and tested, but it stays completely
   off until two values are filled in. Get them from https://dashboard.linqapp.com:
   - `LINQ_API_KEY` — copy it from the dashboard.
   - `LINQ_WEBHOOK_SECRET` — you get this by running `node scripts/linq-webhook.mjs` inside
     `app` once the key is set. That registers our address with Linq and prints the secret.

   Put both into Vercel (and `app/.env.local` if you want it working on your machine), then
   deploy. Until they're set, the "Get a text when the agent acts" card doesn't even appear,
   and nothing tries to send. The agent's number is +12062619826, and the sandbox for it
   expires 9 August.

Nice to have, if there's time:

- **Set up email properly.** Sign-in emails currently only reach Nikhil's own address.
  A judge trying to sign in with their own email gets nothing. Fixing it means adding a
  few DNS records for upthink.app in the Resend dashboard and Namecheap.
- **Ask Prava for production access** (email support@prava.space). Not needed for judging.
  Don't switch the demo to production — it would spend real money.
- **The domain rebuyit.store** — Nikhil wants to buy it. Do this after submission, and
  test that Prava still works on the new domain before switching anything.

## What the product does now

A user pastes an order confirmation email. AI reads it. The user picks the exact product
they bought from the shop's live catalogue. They approve the agent once with their
fingerprint, with hard limits: this one shop, never more than they originally paid, one
purchase, and the permission expires on its own.

The agent then watches the shop's real price. When the price falls enough to be worth it —
after subtracting what it costs to send the original back — it does four things on its own:

1. Checks the shop's return policy through Senso (a knowledge service) and records the
   answer with its source.
2. Charges the pre-approved permission through Prava, which issues a one-time card.
3. Goes to the shop's website and fills a real shopping cart with the exact item.
4. Stops just before pressing "place order" — on purpose, because the card is test money.
   The screen explains this. In a live version, one setting removes the stop.

If the user has given us their mobile number, the agent texts them the moment it spends —
over iMessage, or RCS, or plain SMS, whichever their phone takes. The text says what dropped,
that a card now exists, that **nothing has been ordered yet**, and what they keep if they
send the original back. It also texts when it tried and the payment failed, and when it found
a drop but refused to spend because the item can't be returned. They can reply STATUS to hear
where things stand, or STOP to end it. That runs through Linq; see point 4 above for how to
switch it on.

The user then finishes the purchase, sends the original back, and confirms when the refund
arrives. Only then does the saving count, and only then do we take our 15% share — which
we collect through Prava too, capped at $15 a month no matter how much we save them. The
first saving is free.

## Proof it all works

Five real transactions on Prava's test system, none faked:

- Three automatic repurchases: Anker $39.99, Allbirds $105, Taylor Stitch $228
- One repurchase that went through the Senso policy check first: Anker $69.99
- One fee collection: $6.90

Real shopping carts exist at Anker right now for the two open Anker purchases — open
either item in the app and click "Open the prepared checkout" to see one. Carts expire;
the "Prepare the checkout for me" button makes a fresh one.

There are also 67 shops in the registry, each with its return policy read from the shop's
own website, with a link to the source. Two purchases in the demo data are deliberately
blocked: a Graza item (they take no returns at all) and a Brooklinen "Last Call" item
(final sale). **Keep these — they show the product refusing to spend money the user could
never get back, which is the most convincing thing in it.**

## The current purchases in the demo account

| Shop | Where it stands | Paid | Rebought at |
|---|---|---|---|
| Anker | bought, cart prepared, waiting on user | $114.99 | $69.99 |
| Anker | bought, cart prepared, waiting on user | $59.99 | $39.99 |
| Taylor Stitch | bought, waiting on user | $250 | $228 |
| Allbirds | done — refund confirmed | $160 | $105 |
| Brooklinen | watch only (final sale item) | $120 | — |
| Graza | expired (no returns possible) | $40 | — |

Totals: $46 saved and banked, $69 more in progress, $6.90 collected in fees.

## Honest limitations (also stated in the product and submission)

- The final "place order" step is deliberately switched off. The switch is the
  `UCP_COMPLETE_CHECKOUT` setting; leaving it unset keeps the stop in place.
- Returns aren't filed automatically — the user is sent to the shop with the deadline.
- Spotting final-sale items works by keywords in the product name. It will miss some cases.
- Return deadlines are counted from the purchase date even when a shop counts from
  delivery. That errs on the safe side, which is why it was left.
- The automatic price check runs once a day (the hosting plan's limit), plus whenever the
  user opens an item.

## The logo and icon

The icon is the blue-to-green rounded square with two circling arrows, meaning "buy it again".
Master file is `brand/rebuy-icon.svg`. Ready-made pictures for uploading anywhere (Devfolio,
social, app stores) are in the same folder at 512, 192 and 180 pixels.

The website already uses it as its browser tab icon. If you change the design, replace
`brand/rebuy-icon.svg`, copy it over `app/app/icon.svg`, and regenerate the PNGs with:

```bash
cd app
node -e "const s=require('sharp'),f=require('fs');const v=f.readFileSync('../brand/rebuy-icon.svg');[['../brand/rebuy-icon-512.png',512],['../brand/rebuy-icon-192.png',192],['../brand/rebuy-icon-apple-180.png',180],['app/apple-icon.png',180]].forEach(([p,n])=>s(v,{density:400}).resize(n,n).png().toFile(p))"
```

## Where things are in the code

All in the `app` folder.

| File | What it holds |
|---|---|
| `lib/status.ts` | Every state a purchase can be in, and the only savings math |
| `lib/merchant-registry.ts` | The 67 shops and their verified return policies |
| `lib/agent.ts` | The buying decision and the charge |
| `lib/prava.ts` | Talking to Prava |
| `lib/senso.ts` | The return-policy check and writing outcomes back |
| `lib/ucp.ts` | Creating the real cart at the shop, and the deliberate stop |
| `lib/billing.ts` | How we collect our fee |
| `lib/notify.ts` | The exact words the agent texts, and every reason not to send |
| `lib/linq.ts` | Talking to Linq, and checking inbound messages are genuine |
| `app/icon.svg` | The browser tab icon |

Useful commands (run inside `app`):

```bash
npm run build          # must pass before deploying
vercel --prod --yes    # deploy
```

Never run `prisma db push --force-reset` — it wipes the database, which holds the real
transactions.

## Known rough edges from the last code review

Fixed already: everything that could cost a user money. Still open, in order of
importance: smarter final-sale detection per shop, cleanup for purchases stuck in the
post-buy stages, and two rare timing issues that only matter with many users. Details are
in the review notes outside the repo.
