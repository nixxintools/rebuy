# Rebuy signed-in UX review

This review is based on the implementation, including the signed-in pages, their API routes, `lib/agent.ts`, `lib/prava.ts`, `lib/merchants.ts`, `lib/receipt.ts`, the Prisma schema, and the Vercel cron configuration. Findings are ordered within priority.

## P0 — blocks safe real-world use

### 1. “Rebought” is asserted without any code placing a merchant order

**Files:** `lib/agent.ts:63-123`, `lib/prava.ts:158-183`, `app/(app)/items/[id]/page.tsx:60-70,284-333`

`executeRebuy` charges the Prava mandate and reports that charge as an approved purchase, then immediately sets `status: "return_ready"`. There is no Shopify checkout/order call anywhere in that path. The supposed order action is an ordinary cart URL (`/cart/{variantId}:1`), yet the UI calls it “Open the new order,” says “Repurchase complete,” and tells the user to return the original.

**How this bites:** a user can return the product they actually own while no replacement order exists. A successful authorization charge is not proof that the merchant accepted an order, inventory was reserved, tax/shipping were paid, or an order number was issued.

**Change:** introduce separate states such as `payment_authorized`, `checkout_pending`, `order_confirmed`, and `order_failed`. Only show the return hand-off after storing a merchant order ID and confirmation. Until a real merchant purchase exists, label the Prava result accurately and require the user to finish checkout; do not call the cart an order.

### 2. Revocation can be shown as successful while the mandate remains active

**Files:** `app/api/items/[id]/revoke/route.ts:13-24`, `app/(app)/items/[id]/page.tsx:383-402`

The revoke route catches every `PravaError`—not just “already cancelled/consumed”—and then marks the local item `revoked`. A Prava timeout, 500, or other failed cancellation therefore produces a success response, after which the UI says Rebuy “can no longer spend anything.”

**How this bites:** the user believes a money permission has been withdrawn when the external authorization may still be spendable.

**Change:** only treat explicit terminal mandate states as idempotent success. On any ambiguous failure, preserve a `revocation_pending`/`revocation_failed` state, show that access may still be active, retry safely, and verify the mandate state with Prava before promising revocation.

### 3. The confirmation callback can attach the wrong active mandate to an item

**Files:** `app/api/items/[id]/confirm-mandate/route.ts:19-40`, `lib/prava.ts:73-115`

Confirmation lists all active mandates for the user and takes the last one. It does not match the returned setup session, external order reference, merchant, amount, product, or item. Two concurrent/stale authorization flows can therefore bind an unrelated mandate to this purchase.

**How this bites:** the item page displays this item’s merchant and price ceiling as enforced guardrails even though the stored `mandateId` may represent another authorization; subsequent autonomous charging uses that ID.

**Change:** correlate the callback to the exact `sessionId`/external reference created for the item and verify merchant scope, ceiling, charge count, and expiry before setting `monitoring`. Reject ambiguous matches.

### 4. Matching is not precise enough for autonomous spending

**Files:** `app/(app)/add/page.tsx:57,70-88,231-280`, `lib/merchants.ts:54-66`, `app/api/items/route.ts:45-75`

The first search result is selected automatically. Matching is only at Shopify product-handle level; `toProduct` silently chooses the first available variant, and the UI shows no size, colour, capacity, SKU, quantity, or variant choice. The saved title and `variantId` come from that arbitrary live variant, not the receipt.

**How this bites:** a user can approve an autonomous purchase for the wrong model or a wrong size/colour/capacity, with one prominent click and no explicit match confirmation.

**Change:** never preselect a result. Require an explicit “This is my exact product” action, fetch and display variants, make the user choose/confirm the exact variant, and carry receipt attributes/SKU into matching. If exact matching is not possible, let the user save a non-spending price watch or stop with a clear unsupported message.

### 5. An invented 30-day return window can trigger a financially losing rebuy

**Files:** `app/(app)/add/page.tsx:217-225`, `app/api/items/route.ts:48-51`, `lib/receipt.ts:51-55`

When the receipt contains no deadline, the API silently assumes 30 days and the UI describes that as a default. It does not establish that the item is returnable, account for final-sale/category exceptions, or ask the user to confirm the policy.

**How this bites:** Rebuy may charge for a second item when the original cannot be returned, turning a promised saving into a duplicate purchase.

**Change:** treat a missing deadline/eligibility as blocking for autonomous rebuy. Require explicit user confirmation of the return deadline and returnability (with a merchant-policy link where possible); never convert “unknown” into “30 days” silently.

## P1 — clear product and trust wins

### 6. An expired seven-day mandate can still look like an active price watch

**Files:** `lib/prava.ts:73-79,108-113`, `app/api/cron/check-prices/route.ts:17-38`, `lib/agent.ts:81-99`, `app/(app)/items/[id]/page.tsx:218-253`

The mandate expires after at most seven days, but the cron only closes an item at its return deadline. An item can remain `monitoring` for weeks after its authority has expired. The item page hard-codes “Expires in 7 days” rather than showing the actual `validUntil`; it has no renewal state. Expiry may only surface after a later price drop attempts a charge.

**How this bites:** the user thinks Rebuy can capture a drop, but it is no longer able to spend when the drop arrives.

**Change:** persist/sync actual mandate status and `validUntil`, move the item to `authorization_expired` when it lapses, surface the exact date/time near the primary status, and offer renewal while the confirmed return window permits it.

### 7. Declines and agent failures disappear back into “Watching price”

**Files:** `lib/agent.ts:79-99`, `app/(app)/items/[id]/page.tsx:60-70,259-282,338-376`

For most Prava errors, the agent changes the item back to `monitoring` without a user-facing failure event. HTTP-200 failed charges do create `rebuy_failed`, but the page still presents the normal monitoring card; the explanation is buried in raw JSON in Activity. “Repurchase blocked by the guardrails” also conflates a safety block, a decline, an expired mandate, and a provider failure.

**How this bites:** a user sees a price drop later disappear and reasonably believes the agent is still protecting them, with no clear warning that the purchase failed or action is required.

**Change:** model and display distinct `charge_declined`, `authorization_expired`, `provider_unavailable`, and `retrying` states. Put a plain-language alert and next action at the top of the item and dashboard; keep provider codes only in an optional support-details disclosure.

### 8. The add-receipt stepper and CTA misstate progress and outcome

**Files:** `app/(app)/add/page.tsx:44-57,70-88,117-118,131-137,180-318`, `app/api/items/route.ts:73`

After parsing, search automatically chooses the first result, so `step` jumps straight from 0 to 2 even though the user has not checked the extracted details or consciously picked a product. “Start watching this price” creates an `ingested` item that is not watching until a separate authorization. The extracted product name is neither displayed nor editable, and editing a low-confidence field leaves its warning styling in place. A multi-item receipt is reduced to one unexplained item.

**How this bites:** users cannot tell what needs confirmation, may accept an AI mistake, and believe monitoring has begun when it has not.

**Change:** use explicit stages and continue/back actions: receipt → review every extracted field (including product/quantity and detected merchant) → choose exact product/variant → saved, authorization required. Label the last button “Save purchase” or include authorization in the flow. Clear/recompute a field’s confidence warning after manual correction and state that only one item is being tracked.

### 9. Catalogue search failure is presented as “no matches,” and searches can race

**Files:** `app/(app)/add/page.tsx:81-88,240-285`, `app/api/merchants/search/route.ts:14-20`, `lib/merchants.ts:72-129`

`search()` never checks `s.ok`, has no search-specific loading/error state, and converts an error payload to an empty array. Multiple searches can complete out of order and overwrite newer results. Changing the merchant before parsing is manual even though the parser returns a retailer, and changing it after results exist does not automatically invalidate/re-run the match.

**How this bites:** outages look like bad search terms; users repeatedly shorten a correct query or select a stale result from the wrong store.

**Change:** check HTTP status, distinguish unavailable/timeout/no-result states, disable or version requests while searching, discard stale responses, and clear chosen/results whenever merchant changes. Offer “product not found” exits: retry, choose another supported merchant, save without autonomous spending, or contact support.

### 10. Item and Payments fetch failures produce permanent skeletons

**Files:** `app/(app)/items/[id]/page.tsx:82-97`, `app/(app)/payments/page.tsx:73-89`

Both client pages parse any response as JSON without checking `r.ok`. The item request can set an error object as `item` and then render invalid monetary/date values; a rejected request leaves the skeleton forever. Payments explicitly converts a rejected request back to `null`, which is also its loading state.

**How this bites:** a signed-out session, 404, Prava outage, or network error looks like endless loading with no retry or route back.

**Change:** represent `loading`, `loaded`, `notFound/unauthorized`, and `error` separately; validate the payload; give retry and navigation actions. Show an inline refresh state rather than returning to a full-page skeleton.

### 11. The item page hides the answer to “what is happening now?”

**Files:** `app/(app)/items/[id]/page.tsx:140-189,191-381`, `components/StatusChip.tsx:10-23`

The authoritative status chip is at the very bottom, below pricing, authorization, guardrails, watch/return content, and a potentially long activity log. Revoked and expired states remove the stepper but get no explanatory closure card. The raw JSON audit log is developer-facing, while the page duplicates guardrails in prose and a full card.

**How this bites:** users must scan a long page to learn whether Rebuy can spend, needs action, failed, or is finished—especially on mobile.

**Change:** make the first card a state-specific summary with status, “what Rebuy can do now,” latest check/action time, next automatic step, and any user action. Keep the four guardrails directly under that while authority is active; collapse technical audit details under a secondary “Full activity and support details” section. Give expired/revoked/failed states explicit next steps.

### 12. The return hand-off is generic and has no completion state

**Files:** `app/(app)/items/[id]/page.tsx:284-333`, `prisma/schema.prisma:43-69`

“Start the return” sends every merchant to its generic `/account` page, supplies one generic return reason, and calculates “Ship return by” as deadline minus two days. There is no return label, merchant-specific route/instructions, replacement order ID, acknowledgement that a return was started, or state for shipped/refunded/closed.

**How this bites:** the highest-stakes manual step is where guidance becomes least specific. The product counts savings before knowing whether the original was returned or refunded, and cannot remind/escalate around the real return status.

**Change:** make return handling a focused task surface (or dominant state on the item page) with original and replacement order IDs, merchant-specific link/instructions, real deadline, checklist, and user-confirmed `return_started`/`return_shipped`/`refund_received` states. Only call savings realized after the return/refund outcome is known.

### 13. Payments does not answer spend authority at a glance and makes unsupported claims

**Files:** `app/api/payments/route.ts:17-69`, `app/(app)/payments/page.tsx:91-278`

The first card is estimated earnings, not current spend authority. There is no total currently spendable, active authorization count, nearest expiry, or one-click revoke. Consumed/expired/cancelled mandates are mixed together. If `getMandate` fails, that authorization is silently removed; an outage can make the page say the user has never authorized spending. The “Card held securely by Prava” card is shown even when no authorization/card setup exists. “Our 15% share” is only arithmetic—there is no fee transaction or collection state in this code.

**How this bites:** users cannot quickly answer “Can it spend right now, how much, where, and until when?” and may mistake missing provider data for no authority.

**Change:** lead with an “Active authority now” summary and group active separately from past. Preserve unresolved mandates as “status unavailable,” show the last sync time, and put revoke on each active row. Only show payment-method and fee claims when backed by actual provider/account and fee records; label estimates as estimates.

### 14. Savings are counted before they are realized and inconsistently shown gross/net

**Files:** `app/(app)/dashboard/page.tsx:32-50,96-138`, `app/api/payments/route.ts:56-68`, `app/(app)/payments/page.tsx:102-123`

The dashboard calls the gross price gap “SAVINGS CAPTURED” as soon as status is `return_ready`; the item row also shows the gross amount. Payments separately shows gross, a calculated fee, and net. None of these depend on the original return/refund succeeding.

**How this bites:** users see contradictory numbers and may believe money has been earned when they still face a return task and possible failure.

**Change:** define and label a consistent funnel: potential drop, replacement charged, return pending, refund confirmed, fee charged, net realized. Dashboard should prioritize net realized and separately show pending savings with the required action.

### 15. Once-daily checks do not match the product’s immediacy or explain missed drops

**Files:** `vercel.json:1-3`, `app/(marketing)/page.tsx:52-70`, `app/(app)/items/[id]/page.tsx:259-279`

The only scheduled sweep runs once per day at 06:00 UTC, while the product says it checks “around the clock” and rebuys “the moment” a price falls. A short promotion can begin and end between sweeps. The signed-in item page shows neither last check nor next check.

**How this bites:** the core agent can miss a qualifying drop while users believe it is continuously watching; if no rebuy happens, there is no evidence explaining why.

**Change:** either increase the cadence to one that supports the promise or narrow the promise. Show last successful live-price check, next scheduled check, data-source health, and a history/chart sufficient to explain “price never dropped while eligible.”

### 16. Action refreshes and repeated actions are not robust

**Files:** `app/(app)/items/[id]/page.tsx:82-87,118-137,191-213,259-279`

`refresh()` is fire-and-forget and responses are not sequenced. The shared `busy` flag is cleared before the refresh completes, so buttons can re-enable against stale state; an older initial request can overwrite a newer response. All actions share one busy label, and action errors render below the entire activity card rather than beside the action.

**How this bites:** users can repeat authorization/price actions, see stale status immediately after success, or miss an error because it appears far below the button they pressed.

**Change:** await and sequence/abort refreshes, use action-specific pending state, optimistically lock invalid repeat actions, and place success/error feedback next to the initiating control. Return the updated item from mutations where possible and reconcile once.

## P2 — hierarchy, mobile, and polish

### 17. The 375px navigation is overcrowded

**Files:** `components/AppNav.tsx:34-63`, `components/Logo.tsx:23-30`

At the `xs` breakpoint the full wordmark, two text navigation buttons, add icon, and account avatar all remain in one toolbar. Only the large “Track a purchase” button is hidden. Their intrinsic widths plus toolbar padding leave little or no safe space at 375px and make the primary destinations cramped.

**Change:** use the logo mark without the wordmark at `xs`, or move Purchases/Payments into a mobile bottom navigation/menu. Preserve 44px touch targets and indicate the current route; the current nav gives no active-page cue.

### 18. Several mobile rows assume horizontal space

**Files:** `app/(app)/add/page.tsx:240-252,298-318`, `app/(app)/items/[id]/page.tsx:142-155,204-213,270-279`, `app/(app)/payments/page.tsx:133-147,178-212,232-275`

Search controls and action groups stay horizontal at `xs`; long merchant/product text competes with fixed buttons and chips. Payments relies on a 560px table with horizontal scrolling, which hides status/amount off-screen—the two facts users most need.

**Change:** stack primary/secondary actions and search controls at `xs`; allow authorization rows to wrap. Replace the mobile transaction table with compact cards that keep status and amount visible without horizontal scrolling.

### 19. State colour and labels need stronger semantics than decorative consistency

**Files:** `components/StatusChip.tsx:10-23`, `lib/theme.ts:17-51`, `app/(app)/dashboard/page.tsx:39-53`

The MUI theme is consistent, but several materially different states fall back to neutral chips or the same warning treatment. The large gradient savings card dominates even when the user has urgent pending returns, failed actions, or expiring authority.

**Change:** reserve colour plus icon/copy combinations for actionable meanings, never colour alone. Put urgent return/failed/expiring states above celebratory savings, and add an accessible text explanation to every status.

## What is already good

- The authorization copy in `app/(app)/items/[id]/page.tsx:198-203` explains merchant scope, ceiling, one charge, expiry, and network enforcement unusually clearly. Keep that plain-language trust framing, but populate it from the verified mandate rather than local assumptions.
- `components/StatusChip.tsx` translates internal statuses into user language, and the dashboard’s empty state gives a focused path to first value.
- The add flow exposes low-confidence extraction fields for review, uses editable dates/prices, and provides a useful no-match suggestion; the right foundation is present even though stage control and failure handling need work.
- The visual system is restrained and coherent: MUI cards, spacing, typography, blue/teal brand treatment, and responsive grids produce a credible baseline. The main issue is state hierarchy, not a need for a redesign.
- The activity trail records external calls and agent decisions, and ownership checks live in the route layer. Retain the auditability while translating the default view into plain English and keeping raw payloads for support details.
