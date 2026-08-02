# Localhost, Most Startup-Ready Product

Rebuy · https://rebuy.upthink.app · https://github.com/nixxintools/rebuy

They judge on five things: problem clarity, product readiness, user demand, distribution
potential and founder commitment. Answering each in turn.

---

## The problem

Shops change their prices constantly. When the price of something you bought falls a week
later, the shop keeps the difference. There is a way to get it back, which is to return the
item and buy it again at the lower price, and most shops will let you. Almost nobody does it,
because it means noticing the drop in the first place, being out of pocket twice for a while,
and dealing with a return.

So the money sits there, recoverable in principle, unclaimed in practice. That gap is the
business.

The part nobody has priced properly is how long that gap stays open. A return window is the
period in which your money can still come back. Marine Layer gives you 365 days. Taylor Stitch
gives you 21. Same purchase, wildly different chances of ever catching a drop. We built a
ranking of 67 US shops on exactly that, read from each shop's own policy page.

## Is it ready

It works today, end to end, on a live site.

Five real transactions have gone through Prava's test system. Four were purchases the software
made on its own after finding a genuine price drop at a real shop. One was us collecting our
own fee.

The parts that exist: reading a pasted receipt with AI, matching it to the exact product and
version in the shop's live catalogue, a one-time approval with hard limits held at the card
network, live price watching, an automatic purchase when a drop clears the cost of returning,
a real cart built at the shop itself, and a working way for us to get paid.

What is deliberately unfinished: the software builds the cart at the shop but does not press
the final button, because the card is test money and sending a real order to a real company
with it would be wrong. That step is one setting in a live version. We say so on the screen
rather than pretending.

## Does anyone want it

We have no users yet, and it would be easy to dress that up. What we have instead is evidence
the problem is real: US shoppers returned $849bn of goods in 2025, about 16% of everything
sold, and roughly one in five online orders comes back. Returning and rebuying is a known
tactic discussed constantly in deal communities. What has been missing is anyone doing it for
people automatically.

The pricing is the strongest evidence we could ask for whether it works. We take 15% of what a
user actually keeps, we charge nothing until their refund has arrived, the first saving is
free, and we never take more than $15 in a month. If the product does not save someone money,
we earn nothing. That means signups are worthless to us unless they convert to real savings,
so any usage number we ever report will mean something.

<!-- GAP: if you have shown this to anyone, even informally, say so here. Two sentences about
a real person's reaction is worth more than the market statistics above. -->

## How it gets in front of people

Three routes, in the order we would try them.

The shop rankings page is a link people send each other. "These are the shops where your money
stays recoverable longest" is a genuinely useful page whether or not you ever sign up, and no
retailer has an incentive to publish it. It brings in exactly the people who care about return
policies, who are the people who would use this.

Deal and refund communities already do this by hand and complain about the effort. That is a
small, reachable, highly motivated audience who will understand the product in one sentence.

Longer term, the ranking gets better the more purchases run through it. We already write the
result of each purchase back into our knowledge base, so the system learns which shops honour
their published policy in practice. That is a dataset a competitor cannot buy.

## Why we will keep going

<!-- GAP: this section has to be yours. Judges are asking whether you will still be working on
this in three months. Answer honestly and specifically:
  - why this problem, for you personally
  - what you will do in the next 30 days whether or not you win
  - whether you are buying the domain, incorporating, talking to users
Two honest sentences beat a paragraph of intent. -->

What is already committed: the product is live on its own domain, the code is public, and the
business model is not a slide, it has collected money.

## The honest list of what is missing

Judges will find these anyway, so here they are.

No users yet. The final purchase step is switched off on purpose. Returns still have to be
filed by the person, we only route them with the deadline. Only 67 shops are covered, and
adding more is manual research. Detecting final-sale items works by reading product names,
which will miss cases. Everything runs on test payments, and going live needs approval from
Prava.

None of these are architectural. They are work.

## Why Prava matters here rather than being a checkbox

The hard part of this business was never watching prices. It was getting permission to spend
someone's money while they are not there, in a way they would actually agree to. Prava's
approval model gives a user four things they can understand in one sentence each: which shop,
how much at most, how many times, and for how long. That is the entire trust problem, solved.

We then used the same mechanism a second time to collect our own fee, under a limit the user
sets and can cancel. A customer who understands the first understands the second, which made
asking to be paid feel like part of the product.
