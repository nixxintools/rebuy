# PRD — Return & Rebuy Agent (Hackathon Scope)

**Event:** Prava Agentic Commerce Hackathon, Aug 1–2 2026 · Submission: Aug 3, 3:30 AM IST (hard)
**Version:** 2.0 — supersedes "concept note.txt" for build purposes. The concept note remains the long-form vision doc; this PRD is what we actually ship this weekend.

---

## 1. One-liner

An AI agent that watches the price of things you just bought, and when the price drops inside the return window, **buys the cheaper one for you via Prava** and hands you a ready-to-go return for the original — capturing savings you'd otherwise never claim.

## 2. The problem (unchanged from concept note)

Amazon and most US retailers don't refund price drops. The only workaround is "return and rebuy," which almost nobody does because it's tedious. That's real money left on the table on ~1 in 5 online purchases.

## 3. What we ship in 48 hours (MVP scope)

The demo must show one complete, honest loop:

1. **Ingest a receipt.** User pastes/uploads an Amazon order confirmation (email text or screenshot). OpenAI extracts product, price, order ID, purchase date, return deadline. User confirms.
2. **Authorize the agent — once.** User approves a **Prava mandate**: *"You may rebuy this item from this merchant, up to the price I paid, within the next 7 days."* Approved with a passkey (Face ID / fingerprint) on Prava's surface. This is the trust moment of the demo.
3. **Watch the price.** The app checks the item's price on a schedule. (Demo: a price feed with a "simulate drop" control, clearly labeled — the *payment* is real-sandbox, the price feed is simulated. Judges' rules forbid fake *transactions*, not simulated *market data*.)
4. **Act on the drop.** When price < purchase price (and >5 days remain in the return window), the agent **charges the mandate** — no user interaction needed, that's the point — receives single-use card credentials from Prava, completes the rebuy, and reports the outcome back to Prava.
5. **Hand off the return.** The agent generates the return: a deep link to the retailer's return page for that order, plus a pre-written return reason. User clicks, confirms, ships. (Full return automation is out of scope — see §6.)
6. **Show the money.** Dashboard shows: old price, new price, savings captured, our 15% fee, net to user. Full audit log of everything the agent did.

## 4. Why this wins tracks

| Track | Our claim |
|---|---|
| **Prava finalists** | Prava is the engine, not a button: the mandate (standing authorization with spend cap, merchant scope, expiry) is *the product's trust model*, and the autonomous mandate charge is the core action. |
| **OpenAI** | GPT-4o parses messy receipts into structured tracking records with confidence scores; user corrects only what's wrong. |
| **Visa Intelligent Commerce** | The mandate maps 1:1 to Visa's controls story: scoped credential, per-charge cap enforced at network level, expiry, revocation, biometric setup. We surface all four guardrail layers in the UI. |
| **Localhost (startup-ready)** | Users only pay when they save (15% of captured savings). Painfully clear ROI, obvious distribution (price-drop communities). |

## 5. Trust & transparency requirements (P0)

- User sets the spend cap implicitly: mandate cap = price they originally paid. The agent *cannot* spend more — enforced by the card network, not our code.
- Mandate is scoped to the one merchant and expires in 7 days.
- One-tap revoke ("stop watching this item") cancels the mandate.
- Notification before + after every rebuy; full audit trail on the dashboard.

## 6. Explicitly out of scope this weekend

- Automated return initiation on Amazon (login/2FA/CAPTCHA — prohibited terrain and unbuildable in 48h). We generate the return link + instructions instead, and say so.
- Real Amazon price scraping (nice-to-have; simulated feed is the default demo path).
- Multi-retailer support, email-forwarding inbox, SMS, referral, billing. All post-hackathon.
- Real money. Everything runs on Prava **sandbox** unless production access is granted and there's time to spare. Sandbox is explicitly demo-legitimate per the handbook.

## 7. Monetization (pitch, not built)

15% of captured savings, charged only on success. Free to track. $30 saved → $4.50 fee → user is $25.50 ahead for zero effort.

## 8. Success criteria for the demo video

- One unbroken take: receipt in → mandate approved with a real passkey → price drops → agent charges mandate autonomously → Prava shows the completed transaction → return link generated → savings displayed.
- Every judging criterion touched in under 3 minutes.

## 9. Disclosure (required by rules)

Pre-existing before the event: concept note / this PRD only. All code written during the build window with AI tools (disclosed and allowed).
