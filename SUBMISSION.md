# Devfolio submission (copy and paste)

Live: https://rebuy.upthink.app · Repo: https://github.com/nixxintools/rebuy

---

## Project Name

Rebuy

## Tagline

Your purchase just got cheaper. Rebuy gets you the difference.

## Problem it solves

Prices fall after you buy, and shops will not refund the gap. The only way to get it back is
to return the item and buy it again at the lower price. That means noticing the drop, paying
twice for a while, starting a return and repackaging the thing. Almost nobody bothers, so the
money stays with the shop.

Rebuy does it for you. You paste an order confirmation and GPT-4o reads it. You pick the exact
product and version you bought from the shop's live catalogue. You approve the agent once with
your fingerprint, and that approval carries hard limits: this one shop, never more than you
already paid, one purchase, and it expires on its own. After that the agent watches the real
price. If it drops far enough while you can still return the original, it charges the approval
through Prava and buys the cheaper one without asking you again.

We take 15% of what you actually keep. The first saving is free, nothing is charged until your
refund arrives, and we never take more than $15 in a month no matter how much we save you.

The idea underneath all of it is that a return window tells you how long your money can still
come back. Marine Layer gives a price 365 days to fall. Taylor Stitch gives it 21. Same
purchase, very different odds, and almost nobody thinks about it when choosing where to buy.
We built a list of 67 US shops ranked on exactly that, with every window read from the shop's
own policy page and the source and date recorded.

That number does real work in the product. It sets when the spending approval expires and it
gates every buying decision. Guess it too long and the agent buys a replacement for something
you can no longer return, which turns a $40 saving into a $160 loss. The thing that makes the
idea interesting is also the thing we had to get right.

## Challenges you ran into

Amazon turned out to be impossible, and it took a failed payment to find out why. The original
plan targeted Amazon. It has no way for an agent to transact with it, and when we passed it as
the merchant, Visa refused to verify the card at all, before the one-time-code screen even
appeared. Switching to a real merchant fixed it immediately, so we moved to US Shopify shops we
could verify.

Our own screen was lying to users. After a successful Prava charge the app said "Repurchase
complete" and offered a button called "Open the new order". No code anywhere placed an order at
a shop, and that button was just a link to a cart. Anyone who returned their original because
of that screen would have ended up with neither the item nor the money. A charge proves a card
was issued, nothing more, so we rebuilt every state in the product so it only claims what we
can actually prove.

We caught a serious bug while testing live. Adding a second shop, the purchase attached itself
to the first shop's approval, because the code picked the wrong end of a list that Prava
returns newest-first. The page said "Allbirds only, $160 maximum" while the real approval was
locked to Anker at $59.99. The limits shown to the user were not the limits being enforced,
which is the one thing a product like this cannot get wrong.

Shopify serves different prices depending on where the request comes from, without saying so. Testing from
India, an $88 Beyond Yoga polo came back as 8,600 rupees while the shop still reported its
currency as US dollars. Every price the agent reads decides whether it spends money, so shops
are now checked from the same US location that serves our users.

Return costs were shown everywhere and used nowhere. The agent triggered on the raw price gap,
the screen called that gap "saved", and our fee took a share of it. So a $5 drop at a shop that
charges $9.90 to return would have fired, displayed a saving, and billed a fee on what was
really a loss. The cost of returning is now recorded for each purchase and subtracted before
the agent acts and before we bill.

Getting paid was arithmetic on a page with nothing behind it. It now runs on a second Prava
approval scoped to us, approved by fingerprint and cancellable the same way as the first. The
user's first saving is free so nobody is asked to authorize payment before seeing the thing
work. After that, further spending needs a way for us to be paid. The $15 monthly ceiling is a
promise rather than a limit: anything above it is waived, not carried forward.

## Technologies used

Prava, OpenAI GPT-4o, OpenAI Codex, Senso, Visa Intelligent Commerce, Shopify Storefront, UCP,
Next.js 16, React 19, MUI v9, Prisma, PostgreSQL, TypeScript, Vercel, WebAuthn passkeys, Resend

## Links

- Live product: https://rebuy.upthink.app
- Shop rankings: https://rebuy.upthink.app/merchants
- Code: https://github.com/nixxintools/rebuy

## What worked, what didn't, what we learned

Five real transactions went through on Prava's test system. Four were purchases the agent made
on its own after spotting a genuine price drop, and one was us collecting our own fee. Nothing
is faked. The approval model turned out to be the right way to earn a user's trust, because the
four things it controls (which shop, how much, how many times, for how long) are exactly the
four things someone wants to know before letting software spend their money.

For most of the build we could not place the order at the shop. Every attempt at Anker was
rejected before it started, and we shipped the honest version: money reserved, no order yet. In
the final hours we worked out why. The agent has to publish a profile saying what it can do,
and point to it from a specific place in the request. Rebuy now introduces itself to the shop,
agrees what it is allowed to do, and builds a real cart there with the exact item. The one step
it does not take is pressing the final button, and that is deliberate: the card is test money
and sending a real order to a real company with it would be wrong. In a live version that step
is a single setting, and the screen tells the user exactly where the automation stopped and
why.

The same approval model that lets an agent spend under a limit also lets a company collect
under one, which we did not expect going in. A user who understands the first understands the
second, so asking to be paid felt like part of the product rather than a bolt-on.

The hardest part of this was never the payment. Prava made that straightforward. The hard part
was making sure that what the screen said matched what the agent could actually do. Almost
every serious bug we hit lived in that gap: limits displayed that were not the ones enforced, a
purchase claimed that never happened, a cancellation reported that had not gone through.
Building software that spends money is mostly building the evidence that backs up each claim
you make about it.

## Where the automation stops

After the Prava charge, the purchase page shows a real cart the agent built at the shop, on the
shop's own website, one guarded step short of a placed order. We block that step on purpose in
testing and say so on screen. Judges can check this: our agent profile is public at
rebuy.upthink.app/.well-known/ucp-agent-profile, and the cart IDs recorded against each
purchase open at Anker.

## Disclosure

Written before the hackathon: a concept note and some planning documents. All code was written
during the event, with AI assistance, which is permitted and disclosed. Every transaction shown
is a real transaction on Prava's test system. None are mocked.

## Screenshot order (first one becomes the cover)

1. A purchase after the agent bought it, showing the spending limits and the "cart prepared,
   order deliberately not placed" message
2. The shop rankings at /merchants, with 67 shops ordered by return window
3. The dashboard, showing money banked and money still in progress
4. Payments, showing what the agent can spend and the fee we collected
5. The add page mid-way, showing the receipt read by AI with the uncertain fields flagged
