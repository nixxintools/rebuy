# Devfolio submission — copy and paste

Live: https://rebuy.upthink.app · Repo: https://github.com/nixxintools/rebuy

---

## Project Name

Rebuy

## Tagline

Your purchase just got cheaper. Rebuy gets you the difference.

## Problem it solves

Prices fall after you buy, and retailers won't refund the gap. The only remedy is to
return the item and buy it again at the lower price — which means noticing the drop,
fronting the cash, starting a return and repackaging the thing. Almost nobody does it, so
the money quietly stays with the store.

Rebuy is an agent that does it for you. You paste an order confirmation; GPT-4o reads it;
you pick the exact product and variant from the store's live catalogue and approve the
agent once with a passkey. From then on it watches the real price and, if it falls far
enough while you can still return the original, it charges your pre-approved Prava mandate
and buys the cheaper one on its own. You return the first and keep the difference.

We charge 15% of what you actually bank — your first saving is free, nothing is billed until
your refund lands, and we can never take more than $15 in a month however much we save you.

The insight underneath it: **a return window isn't red tape, it's how long your money
stays recoverable.** Marine Layer gives a price 365 days to fall. Taylor Stitch gives it
21. Same purchase, completely different odds — and nobody shops that way, because nobody
presents return policy as an asset. We built a registry of 67 US merchants ranked by
exactly that, each window read from the merchant's own policy page with the source and
verification date recorded.

That fact isn't decoration. It sets the spend authorization's expiry and gates every buy
decision. Guess it long and the agent buys a replacement for something you can no longer
return — turning "saved you $40" into "cost you $160." So the thing that makes the pitch
interesting is also the thing that has to be right.

## Challenges you ran into

**Amazon was impossible, and it took a failed payment to learn why.** The original concept
targeted Amazon. It has no agentic commerce surface — and passing it as merchant details
made Visa refuse card verification outright, before the OTP screen even rendered.
Switching to a real merchant fixed it instantly. We moved to verified US Shopify
storefronts.

**Our own interface was lying.** After a successful Prava charge the app said "Repurchase
complete" and offered "Open the new order" — but no code anywhere places an order at a
merchant; that button was a cart link. Anyone who returned their original on the strength
of that screen would have been left with neither the item nor the money. A charge proves
a card credential was issued, not that an order exists, so we rebuilt the state machine
so every state is justified by evidence we actually hold.

**A live bug caught mid-demo.** Testing a second merchant, the item bound itself to the
*first* merchant's authorization — the code took the last element of Prava's mandate list,
which is the oldest. The page advertised "Allbirds only, $160 maximum" while the real
authorization was Anker-scoped at $59.99. The displayed guardrails weren't the enforced
ones, which is the one thing a product like this cannot get wrong.

**Shopify localises prices by caller region.** Probing from India read an $88 Beyond Yoga
polo as ₹8,600 while the store still reported USD. Every price the agent reads is a
spending input, so merchants are now validated from the same US region that serves users.

**Return costs were shown everywhere and used nowhere.** The agent triggered on the gross price
gap, the UI called that gap "saved", and billing took a share of it — so a $5 drop at a merchant
charging $9.90 to return would fire, display a saving, and invoice a fee on what was actually a
loss. Return cost is now captured per item and subtracted before the agent acts and before we
bill.

**Getting paid at all.** The 15% fee was multiplication on a page with no collection behind it.
It now runs on a second Prava mandate scoped to us — the same primitive the agent spends with,
approved by passkey and revocable the same way. Your first saving is free so nobody is asked to
authorize payment before seeing it work; after that a further spend authorization needs a way to
be paid. The monthly ceiling is $15 and is framed as what it is — a promise that we can never
take more than that, with anything above it waived rather than deferred.

## Technologies used

Prava, OpenAI GPT-4o, Visa Intelligent Commerce, Shopify Storefront, UCP, Next.js 16,
React 19, MUI v9, Prisma, PostgreSQL, TypeScript, Vercel, WebAuthn/passkeys, Resend

## Links

- Live product: https://rebuy.upthink.app
- Merchant registry: https://rebuy.upthink.app/merchants
- Repository: https://github.com/nixxintools/rebuy

## What worked, what didn't, what we learned

**Worked.** Two complete autonomous transactions on Prava sandbox — a real live price drop
detected, a mandate charged with no human in the loop, single-use card credentials issued
and the outcome reconciled with the card network. The mandate model turned out to be the
right trust primitive: merchant scope, a network-enforced ceiling, one charge and an
expiry are exactly the four things a user needs to understand before letting software
spend for them.

**Didn't, then did.** For most of the build we couldn't place the order at the merchant —
every probe of Anker's UCP endpoint was rejected at handshake, and we shipped the honest
state "money reserved, no order yet". In the final hours we cracked it: the agent needed a
published profile declaring its capabilities, referenced at an exact spot in the request
metadata. Rebuy now introduces itself to the merchant, negotiates capabilities, and creates
a real checkout for the exact variant — verified live against Anker, with the merchant's
card handler attached. The one call we do not make is the final submission, deliberately:
the card is a sandbox credential, and firing a live order at a real store with test money
would be wrong. In production that last step is a single switch (`UCP_COMPLETE_CHECKOUT`),
and the screen tells the user exactly where automation stopped and why.

**Learned.** Prava's mandate turned out to be the right primitive for the business too, not just
the product: the same standing-authorization model that lets an agent spend under a cap also lets
a company collect under one, and a user who understands the first understands the second.

The hard part of agentic commerce isn't the payment — Prava makes that
genuinely easy. It's proving to the user that what the screen says matches what the agent
can actually do. Nearly every serious bug we hit was a gap between the two: guardrails
displayed that weren't enforced, a purchase claimed that never happened, a revocation
reported that didn't complete. Building an agent that spends money is mostly building the
evidence trail that justifies each claim you make about it.

## The last mile, precisely

After the Prava charge, the item page shows a checkout the agent created at the merchant
over UCP — a real cart on the merchant's own domain, one guarded call short of a placed
order. We block that call in sandbox on purpose and say so on screen. Judges can verify:
our agent profile is public at rebuy.upthink.app/.well-known/ucp-agent-profile, and the
checkout ids in the audit trail resolve at Anker.

## Disclosure

Pre-existing before the build window: a concept note and PRD drafts. All code was written
during the hackathon, with AI assistance (disclosed and permitted). All transactions shown
are real Prava sandbox transactions — none are mocked.

## Screenshot order (first becomes the cover)

1. Item page in `purchase_authorized` — the guardrails and the "checkout prepared, submission deliberately blocked" card
2. `/merchants` — 67 stores ranked by recoverable window
3. Dashboard with banked vs pending savings
4. Payments — spend authority, transactions, billing
5. Add flow — receipt parse with confidence flags and variant picker
