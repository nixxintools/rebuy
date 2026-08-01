# PRD — Rebuy

**Product:** Rebuy — an agent that captures post-purchase price drops
**Event:** Prava Agentic Commerce Hackathon, Aug 1–2 2026 · Hard deadline Aug 2, 3:00 PM PT / Aug 3, 3:30 AM IST
**Live:** https://rebuy.upthink.app · **Repo:** https://github.com/nixxintools/rebuy
**Version:** 3.0 — supersedes v2.0 and `concept note.txt`. Rewritten after the merchant research and the first working end-to-end run.

---

## 1. One-liner

You bought it. The price dropped. Rebuy notices, buys the cheaper one for you, and hands you the return — automatically, inside the return window.

## 2. The problem

Retailers don't refund price drops. The only remedy is "return and rebuy," which requires you to notice the drop, front the cash, start a return, and repackage the item. Almost nobody does it, so the savings evaporate. Roughly one in five online purchases is returned anyway; the machinery exists, people just won't drive it by hand.

## 3. What actually got built

A working agent, live on a real domain, doing real work against real data:

1. **Receipt in.** User pastes an order confirmation. GPT-4o extracts order number, price paid, purchase date, and return deadline, with per-field confidence — anything below 80% is flagged for the user to check.
2. **Linked to a real product.** The parsed product name is matched against the merchant's **live catalogue**. The user confirms which product it is. This is what gives the monitor a real price to watch.
3. **Authorized once.** The user approves a **Prava mandate** with a passkey: *this merchant only, at most what I originally paid, one charge, expires in 7 days.* The cap is enforced by the card network, not by our code.
4. **Watched with live prices.** The agent reads the merchant's **actual current price** from its public product feed — on a schedule and on demand. No simulated price slider.
5. **Acts alone.** When the live price falls at least $1 or 2% below what was paid, and more than 5 days remain in the return window, the agent charges the mandate without any further human input. That autonomy is the product.
6. **Return handed back.** The user gets the savings breakdown and a direct route to return the original.

## 4. Merchants — the decision that changed the product

**v2 assumed Amazon. That was wrong, and it broke twice.**

Amazon has no agentic commerce surface — no UCP manifest, no MCP endpoint, no way for an agent to transact. Worse, when we passed `Amazon / amazon.com` as merchant details, Prava forwarded them to Visa and **card verification failed outright** ("we couldn't set up verification", OTP screen never rendered). Swapping to a real merchant fixed it immediately. Impersonating a merchant you have no relationship with does not work, and the hackathon rules treat a mocked transaction as grounds for disqualification.

**v3 uses three US merchants that are genuinely agent-ready**, and they map cleanly onto the personas in the original concept note:

| Merchant | Category | Persona it serves |
|---|---|---|
| **Anker** (us.anker.com) | Electronics | Savvy online shopper — where price drops are largest and most frequent |
| **Allbirds** (allbirds.com) | Apparel | Gift buyer |
| **Brooklinen** (brooklinen.com) | Home goods | Small business / household buyer |

All three are USD, US-based, and verified live on **UCP (Universal Commerce Protocol)** spec `2026-04-08`, each advertising `dev.ucp.shopping.checkout` and `dev.ucp.shopping.fulfillment` over MCP. Allbirds is on ucpchecker.com's verified merchant list. These are among the most agent-ready storefronts in US retail — which is exactly the bet this product makes.

## 5. What is real, and what is not

Judges are explicitly warned about mocked transactions, so this boundary is stated plainly here and in the submission.

**Real:**
- Live product prices, read from each merchant's public product feed at request time.
- Real price gaps — the demo item genuinely sells below what the receipt says was paid.
- A real Prava sandbox mandate: created via API, approved with a real passkey and a real issuer OTP, verifiable through Prava's mandate endpoints.
- A real autonomous charge attempt against that mandate, with the resulting card credential issued by Prava.

**Not real (and disclosed):**
- **No order is placed at the merchant.** Prava mints a single-use card credential; completing a UCP checkout additionally requires publishing a signed agent profile, RFC 9421 request signing, and the merchant accepting that credential as a UCP payment handler. That is a merchant-side integration, not something buildable in a weekend.
- **No return is filed.** We route the user to the merchant's returns flow with the reason pre-written. Automating retailer returns means logging in as the user through 2FA and CAPTCHA — out of scope and not something we should be doing on a user's behalf.
- Sandbox only. Production needs Prava approval and additional verification; the only code difference is one environment variable.

## 6. Trust model

This is a product that spends money by itself, so the guardrails *are* the feature, not fine print. Four layers, all visible in the UI:

- **Merchant scope** — the mandate is locked to the one store.
- **Spend cap** — never more than the original purchase price, enforced at the card network.
- **Single charge, 7-day expiry** — the authorization dies on its own.
- **Passkey** — one biometric approval to create it, revocable in one click at any time.

Every external call the agent makes is written to an audit trail the user can read in plain English, with the raw payload one click away.

## 7. Track fit

| Track | Claim |
|---|---|
| **Prava finalists** | The mandate is the product's trust model and the autonomous charge is the core action. Prava isn't a checkout button here — without standing authorization there is no agent. |
| **OpenAI** | GPT-4o turns unstructured receipts into tracked purchases with confidence scoring and human correction. |
| **Visa Intelligent Commerce** | The mandate maps directly onto Visa's controls story: scoped credential, network-enforced cap, expiry, revocation, biometric setup. All four surfaced in the interface. |
| **Localhost (startup-ready)** | Aligned incentives — 15% of realised savings, nothing when nothing is saved. Obvious distribution into deal and price-tracking communities. |

## 8. Monetization

15% of captured savings, charged only on success. Free to track. A $20 drop returns $17 to the user and $3 to us. Nothing to lose by trying it, which is the whole growth argument.

## 9. Open issue at time of writing

The final Visa credential fetch fails inside Prava's sandbox: every mandate charge returns `FETCH_AGENTIC_CREDS_ERROR` / "Visa 400 — Fetching cryptogram failed", on a mandate that is otherwise active and healthy (`approvedAmount 59.99`, `remaining 59.99`, `chargeCount 0`). Reproduced on three attempts at both partial and exact amounts. Raised with Prava support. Everything up to and including the charge request works; this is the last mile and it is on the platform side.

## 10. Disclosure

Pre-existing before the build window: `concept note.txt` and this PRD's earlier drafts. All code written during the hackathon, with AI assistance (permitted and disclosed).
