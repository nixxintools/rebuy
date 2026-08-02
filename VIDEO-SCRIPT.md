# Rebuy — demo script

Roughly 3 minutes. Stage directions in brackets, spoken words in plain text.

---

**[Start on rebuy.upthink.app/add, nothing typed yet.]**

If you buy something online and the price drops a week later, the shop keeps the difference.
You can get it back by returning the item and buying it again at the lower price, but that
takes an evening, so most people never bother.

**[Pick Anker from the shop dropdown. Pause a beat so the "30 day return window" text is visible.]**

Rebuy does it for you.

**[Paste the receipt. Click Read receipt.]**

I paste in my order confirmation, and GPT-4o from OpenAI reads it.

**[Once the fields appear, move the cursor across the amber-flagged fields.]**

It pulls out what I bought, what I paid, and the date I have to return it by. The ones it
marked in amber are the ones it was less sure about, so I can correct them.

**[Scroll to the product matches. Click Anker MagGo Power Bank 10K. Then open the variant
dropdown and choose one.]**

Then I pick exactly what I bought, right down to the version, because buying me the wrong
one would not be a saving.

**[Click Save this purchase. Land on the item page.]**

**[Slow down here. Point at each of the four guardrail lines as you say them.]**

Now I have to give software permission to spend my money, which is the part that has to be
right. This is Prava. The permission covers this one shop. It can never go above what I
already paid. It works once. And it expires on its own.

**[Click Approve with Prava. Card details, then the passkey prompt. Stop talking while the
passkey dialog is up.]**

I approve it with my fingerprint. Those limits are held by Visa at the card network, so even
if our own code went wrong, it could not spend more than that.

**[Back on the item page. Click Check the price now. Take your hands off the keyboard while
it runs.]**

Now it checks the real price at the shop. I am not involved in this next part at all.

**[When the page updates, stay still and let the new card sit on screen.]**

It found the drop and it bought.

**[Expand the Activity list. Scroll to the entry that says it checked the merchant's verified
return policy, and expand it so the cited document is visible.]**

Before it spent anything, it checked whether I could actually return the original. That check
runs through Senso. We loaded the real return policy from sixty-seven shops as verified
knowledge, so the agent asks the question and gets an answer with the source attached instead
of guessing. If the shop takes no returns, or the item is final sale, it does not buy. After
each purchase we write the result back, so the next decision about that shop is better
informed.

**[Scroll back up to the blue card that says the checkout is prepared. Let it sit, then click
Open the prepared checkout so Anker's own cart appears with the item in it.]**

And it has gone one step further. It introduced itself to Anker as an agent, Anker verified
it, and it created a real checkout there for my exact item. That cart you are looking at is
on Anker's site, not ours. The only thing it has not done is press the final button, and that
is on purpose: this is a sandbox card, and placing a live order at a real store with test
money would be wrong. In production, that last step is one switch. The screen says all of
this, and it tells me not to send the original back until the replacement is really bought.

**[Switch to the merchants tab. Scroll slowly from the top down to a row marked watch only.]**

The return window turned out to be the most interesting part of this. It tells you how long
your money can still come back. This shop gives you a full year. That one gives you three
weeks. And where a shop takes no returns at all, we will watch the price for you, but we will
not buy, because a purchase you cannot undo is not a saving.

**[Switch to the payments tab. Point at the fee authorization and the charge in the history.]**

We take fifteen percent of what you actually keep. The first saving is free, nothing is
charged until your refund arrives, and we never take more than fifteen dollars in a month. We
collect that through Prava as well, under a limit you set and can cancel whenever you want.

**[Stay on payments, or cut to the dashboard. Final line.]**

One last thing. The worst bug we shipped was a screen that told people a purchase was
complete when it was not. We found it by having OpenAI's Codex read our own code back to us,
and we fixed it before anyone relied on it.

---

## Before you hit record

- Four tabs only: `/add`, `/merchants`, `/payments`, and the Anker product page.
- Receipt text and card details in a notepad off screen.
- Browser at 100%, notifications off.
- Card `4622 9431 2313 7896`, CVV `499`, expiry `12/27`, OTP `456789`.

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

If Prava returns an error mid take, that is the sandbox outage from earlier coming back. Wait a
minute and retry.
