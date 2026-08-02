# Rebuy — demo script (3 minutes)

About 355 spoken words, which is roughly two and a half minutes of talking. The rest is
silence while things happen on screen. Stage directions in brackets, spoken words in plain
text.

Say the words as written. If you go off script you will overrun — the old eight-minute
version is in git history if you ever want it back.

---

### 0:00 — the problem

**[Start on rebuy.upthink.app/add, nothing typed yet.]**

Buy something online, and if the price drops next week, the shop keeps the difference. You
can get it back — return it, buy it again cheaper — but that's an evening's work, so nobody
does it.

**[Pick Anker from the shop dropdown.]**

Rebuy does it for you.

### 0:20 — the receipt

**[Paste the receipt. Click Read receipt. Let the fields appear. Then click the Anker MagGo
Power Bank 10K and choose a version.]**

I paste in my order confirmation. OpenAI's model reads it — what I bought, what I paid, and
the date I have to return it by. Then I pick exactly the version I bought, because buying me
the wrong one isn't a saving.

### 0:45 — permission to spend

**[Click Save this purchase, land on the item page. Slow down. Point at each limit as you say
it.]**

Now the part that has to be right: giving software permission to spend my money. This is
Prava. One shop. Never more than I already paid. Works once. Expires on its own.

**[Click Approve with Prava. Card details, then the passkey. Stop talking while the passkey
dialog is up.]**

I approve it with my fingerprint. Those limits are held by Visa at the card network, so even
if our own code went wrong, it couldn't spend more than that.

### 1:20 — the agent acts

**[Click Check the price now. Take your hands off the keyboard. Let it run in silence.]**

From here I'm not involved.

**[When the page updates, let the new card sit on screen for a beat.]**

It found the drop. Before spending anything, it checked whether I could actually return the
original — that runs through Senso, which holds the real return policies of sixty-seven
shops, so the agent gets an answer with its source attached instead of guessing. Then it
charged the permission I gave it, introduced itself to Anker as an agent, and built a real
cart there for my exact item.

**[Click Open the prepared checkout. Let Anker's own cart fill the screen.]**

That cart is on Anker's site, not ours.

### 2:05 — the stop

**[Switch back to the item page. Rest on the status card.]**

And then it stopped. It has not placed the order — and it doesn't tell me it has. A card
exists; an order doesn't. Pressing that last button is deliberately switched off, because
this is a sandbox card and placing a live order at a real shop with test money would be
wrong. In production it's one setting.

### 2:30 — when it refuses

**[Open the Brooklinen item, the final-sale one.]**

It also knows when not to spend. This one is final sale. The price dropped and it refused,
because a purchase you can't undo isn't a saving.

### 2:45 — how we get paid, and close

**[Switch to the payments tab.]**

We take fifteen percent of what you actually keep. First saving free, nothing charged until
your refund lands, never more than fifteen dollars in a month.

**[Hold on the dashboard for the last line.]**

An agent that spends your money should tell you exactly what it did — and exactly what it
didn't.

---

## Optional: only if texting is switched on

If `LINQ_API_KEY` and `LINQ_WEBHOOK_SECRET` are live before you record, add this at 2:05,
right after "That cart is on Anker's site, not ours." It costs about twelve seconds, so trim
the fee paragraph to one sentence to stay inside three minutes.

**[Hold up your phone with the text on screen.]**

And it told me. It texted me the moment it spent — that a card exists, that nothing has been
ordered yet, and what's still mine to do.

**If the text hasn't actually arrived on your phone, cut this. Do not describe it.**

---

## Before you hit record

- Four tabs only: `/add`, `/merchants`, `/payments`, and the Anker product page.
- Receipt text and card details in a notepad off screen.
- Browser at 100%, notifications off.
- Card `4622 9431 2313 7896`, CVV `499`, expiry `12/27`, OTP `456789`.
- Do a silent dry run first. The two places that eat time are the passkey dialog and the
  price check — know how long they take so you're not filling the gap with words.

## What got cut, in case you miss it

The receipt-parsing detail, the tour of all sixty-seven shops, and the story about the bug
we found with Codex. All three are in SUBMISSION.md, which the judges read. The video only
has room for the thing they can't get from text: watching it spend, and watching it stop.

## Receipt to paste

```
Anker order confirmation

Hi Nikhil, your order has shipped.

Order # 114-7729481-2210355
Anker MagGo Power Bank (10K)
Qty 1
Item total: $129.99
Shipping: FREE
Order Total: $129.99

Order placed: July 25, 2026
Delivered: July 28, 2026

Returns: eligible for return through August 27, 2026
```

If Prava returns an error mid take, that is the sandbox outage from earlier coming back. Wait
a minute and retry.
