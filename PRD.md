# PRD — Rebuy

**Product:** Rebuy — an agent that captures post-purchase price drops
**Event:** Prava Agentic Commerce Hackathon · Hard deadline Aug 2, 3:00 PM PT / Aug 3, 3:30 AM IST
**Live:** https://rebuy.upthink.app · **Repo:** https://github.com/nixxintools/rebuy
**Version:** 4.0

---

## 1. One-liner

You bought it. The price dropped. Rebuy buys the cheaper one for you and walks you
through returning the first — automatically, and only while you can still return it.

## 2. The problem

Retailers don't refund price drops. The only remedy is "return and rebuy," which needs
you to notice the drop, front the cash, start a return, and repackage the item. Almost
nobody does it, so the savings evaporate.

## 3. The insight the product is built on

**A return window is not red tape. It is how long your money stays recoverable.**

Marine Layer gives a price 365 days to fall. Taylor Stitch gives it 21. Same purchase,
wildly different odds of ever capturing a drop — and nobody shops that way, because
nobody has ever presented return policy as an *asset* rather than a footnote.

That reframing is also what makes the product safe. The return window is not display
text: it sets the spend authorization's expiry and gates every buy decision. Guess it
long and the agent buys a replacement for something the user can no longer return,
turning "saved you $40" into "cost you $160." So the same fact that makes the pitch
interesting is the fact that has to be right.

## 4. What actually got built

1. **Receipt in.** GPT-4o extracts order number, price paid, date and any stated return
   deadline, with per-field confidence. Anything under 80% is flagged for review.
2. **Linked to a real product and variant.** The user picks the exact product *and
   variant* from the merchant's live catalogue — no auto-selection, because buying the
   wrong size on the user's behalf is not a saving.
3. **A deadline we can defend.** A date on the receipt wins. Otherwise we use that
   merchant's verified published window. There is no global default.
4. **Authorized once.** A Prava mandate approved with a passkey: this merchant only, at
   most what you paid, one charge, expiring with the return window. The cap is enforced
   by the card network, not by our code.
5. **Watched with live prices** read from the merchant's own feed.
6. **Acts alone.** On a qualifying drop with days still on the clock, the agent charges
   the mandate with no further human input. That autonomy is the product.
7. **Hands back an honest next step** (see §6).

## 5. Merchants — 67 stores, verified twice

Amazon was the original plan and could never have worked: it has no agentic commerce
surface, and passing it as merchant details made Visa refuse card verification outright.

Every merchant is now checked on two axes:

- **Price feed** — probed from our own US-region function. This caught a bug that would
  have shipped: Shopify localises pricing by the *caller's* region, so probing from
  India read an $88 Beyond Yoga polo as ₹8,600 while the store still reported USD.
- **Return policy** — read from the merchant's own policy page, recording the window,
  who pays, final-sale rules, the source URL and the verification date. Where a window
  varies by category we store the shortest.

Ranked by recoverable window at [/merchants](https://rebuy.upthink.app/merchants).

**What the registry caught.** Brooklinen's storefront is largely "Last Call" — final
sale, not returnable at any price. Tracking one was three clicks away, and the agent
would have bought a replacement for something that could never be sent back. Final-sale
items and zero-return merchants are now blocked from autonomous spending, with the
reason shown. Brightland and Graza accept no returns at all and are watch-only.

## 6. What is real, and what is not

Judges are warned about mocked transactions, so the line is drawn explicitly.

**Real:** live merchant prices; genuine price gaps; a real Prava sandbox mandate approved
with a real passkey and issuer OTP; a real autonomous charge producing a real single-use
card credential, verifiable in Prava's own records.

**Not real, and never claimed:** **no order is placed at the merchant.** Prava issues a
card credential; completing a UCP checkout additionally requires a published signed agent
profile, RFC 9421 request signing, and the merchant accepting that credential as a
payment handler. So the state after a successful charge is `purchase_authorized` — money
reserved, card issued, *no order yet* — and the interface says exactly that, including
"don't return the original until you've bought the replacement."

An earlier version said "Repurchase complete" and offered "Open the new order" over a
cart link. Someone who trusted that screen would have returned their only item and been
left with nothing. That is the single most important thing this version fixes.

## 7. Trust model

The guardrails *are* the product, not fine print:

- **Merchant scope** — locked to one store.
- **Spend cap** — never more than the original price, enforced at the card network.
- **Single charge, expiry tied to the return window.**
- **Passkey** to create, one click to revoke — and revocation only reports success when
  Prava confirms it, because telling someone their agent can't spend when it still can is
  worse than reporting a failure.

Every state is justified by evidence we hold. Savings count only once the user confirms
the refund landed.

## 8. How the business makes money

15% of savings — collected, not asserted. A second Prava mandate scoped to Rebuy,
approved by passkey with a monthly ceiling the user sets and can revoke. Fees accrue only
on **banked** savings and are billed monthly in arrears, one charge per period, guarded
against double-billing. The same rails that let the agent spend also collect our revenue,
under caps the user controls.

## 9. Track fit

| Track | Claim |
|---|---|
| **Prava finalists** | Prava is load-bearing twice: the mandate is the trust model and the autonomous charge is the core action, and a second mandate collects our revenue. Without standing authorization there is no product. |
| **OpenAI** | GPT-4o turns unstructured receipts into tracked purchases with confidence scoring and human correction. |
| **Visa Intelligent Commerce** | The mandate maps onto Visa's controls story exactly: scoped credential, network-enforced cap, expiry, revocation, biometric setup — all surfaced in the UI. |
| **Localhost (startup-ready)** | Working billing, aligned incentives, a real distribution wedge in the merchant ranking. |

**Not claimed:** the Senso track. Our merchant registry does something Senso-shaped — verified
context deciding which merchants an agent may transact with — but we built it ourselves and never
integrated Senso, so the track doesn't apply.

## 10. Disclosure

Pre-existing before the build window: `concept note.txt` and earlier PRD drafts. All code
written during the hackathon with AI assistance, disclosed and permitted.
