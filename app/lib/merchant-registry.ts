// Verified merchant registry.
//
// Every entry has been checked twice, and both checks matter:
//
//  1. Price feed — probed from our own US-region function, because Shopify
//     localises storefront pricing by the caller's region. Probing from outside
//     the US returned INR for several of these (a $88 polo read as 8,600), so a
//     feed is only trusted when its price agrees with the storefront's own
//     authoritative figure from the same region.
//  2. Return policy — read from the merchant's own policy page, with the source
//     URL recorded. The window is not decoration: it sets the mandate expiry and
//     gates the buy. Where a merchant's window varies by category we record the
//     SHORTEST one, because guessing long is what makes a user own two of
//     something they can only return one of.
//
// `confidence: "medium"` means the merchant's own pages were ambiguous or
// partly unreachable. Those are still tracked, but the shortest defensible
// window is recorded.

export type ReturnCost = "free" | "customer_pays_shipping" | "flat_fee" | "unknown";
export type WindowStart = "delivery" | "purchase" | "shipment" | "unknown";
export type Confidence = "high" | "medium" | "low";

export type ReturnPolicy = {
  /** Shortest documented window, in days. 0 means the merchant accepts no returns. */
  windowDays: number;
  windowStartsFrom: WindowStart;
  cost: ReturnCost;
  /** Amount deducted from the refund, where the merchant publishes one. */
  feeUsd: number | null;
  finalSaleRules: string;
  categoryExceptions: string;
  policyUrl: string;
  confidence: Confidence;
  verifiedOn: string;
  notes: string;
};

export type MerchantCategory =
  | "Electronics"
  | "Footwear"
  | "Apparel"
  | "Home & bedding"
  | "Kitchen"
  | "Outdoor & fitness"
  | "Beauty"
  | "Bags & travel"
  | "Pet"
  | "Tools";

export type Merchant = {
  id: string;
  name: string;
  /** Host that actually serves the product feed — some brands only work on www. */
  domain: string;
  currency: "USD";
  countryCode: "US";
  category: MerchantCategory;
  policy: ReturnPolicy;
};

const VERIFIED = "2026-08-02";

export const MERCHANTS: Merchant[] = [
  // ---------------------------------------------------------------- Electronics
  {
    id: "anker", name: "Anker", domain: "us.anker.com", currency: "USD", countryCode: "US",
    category: "Electronics",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Visible wear or damage, free gifts, bulk orders of 10+, unauthorised-reseller purchases.",
      categoryExceptions: "Pre-orders run 30 days from delivery. Defects go through warranty, not this window.",
      policyUrl: "https://www.anker.com/policies/refund-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Must be unused in original packaging. Buyer pays return shipping unless the fault is Anker's.",
    },
  },
  {
    id: "moft", name: "MOFT", domain: "moft.us", currency: "USD", countryCode: "US",
    category: "Electronics",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "None stated.",
      categoryExceptions: "Faulty or wrong items must be reported within 7 days of delivery.",
      policyUrl: "https://www.moft.com/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Refunds exclude shipping and handling; the page never states who pays the label on a change-of-mind return.",
    },
  },
  {
    id: "nomad", name: "Nomad", domain: "www.nomadgoods.com", currency: "USD", countryCode: "US",
    category: "Electronics",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 5,
      finalSaleRules: "Used items with scuffs or scratches, customised items, anything without its original box.",
      categoryExceptions: "None stated.",
      policyUrl: "https://help.nomadgoods.com/en-US/return-refund-and-exchange-policy-139904",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Store credit and exchanges are free; a cash refund costs $5. Outbound shipping never refunded.",
    },
  },
  {
    id: "peakdesign", name: "Peak Design", domain: "peakdesign.com", currency: "USD", countryCode: "US",
    category: "Electronics",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 8,
      finalSaleRules: "Apparel cannot be returned or exchanged at all.",
      categoryExceptions: "International orders are refund-only.",
      policyUrl: "https://www.peakdesign.com/pages/product-return-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "$8 per product on refunds, waived entirely for exchange or store credit. Lifetime guarantee is separate.",
    },
  },
  {
    id: "twelvesouth", name: "Twelve South", domain: "twelvesouth.com", currency: "USD", countryCode: "US",
    category: "Electronics",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Clearance and final-sale items get neither returns nor warranty.",
      categoryExceptions: "Mid-Nov to end-Dec orders extend to 31 January.",
      policyUrl: "https://www.twelvesouth.com/pages/twelve-south-returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "A label is issued but its cost is deducted, so the customer effectively pays.",
    },
  },
  {
    id: "orbitkey", name: "Orbitkey", domain: "orbitkey.com", currency: "USD", countryCode: "US",
    category: "Electronics",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 9.9,
      finalSaleRules: "Personalised or monogrammed products.",
      categoryExceptions: "Pre-orders and back-orders run from delivery instead of purchase.",
      policyUrl: "https://orbitkey-us.gorgias.help/en-US/returns-and-refunds-203724",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "$9.90 deducted from the refund. Must be unused and resalable with all packaging.",
    },
  },
  {
    id: "spigen", name: "Spigen", domain: "spigen.com", currency: "USD", countryCode: "US",
    category: "Electronics",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Clearance and warehouse-sale items are final; promotional gifts are non-returnable.",
      categoryExceptions: "Executive Rewards members get 60 days. Bundles must come back complete.",
      policyUrl: "https://www.spigen.com/pages/return-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Standard customers pay return shipping; Elite and Executive tiers get prepaid labels.",
    },
  },
  {
    id: "elevationlab", name: "Elevation Lab", domain: "www.elevationlab.com", currency: "USD", countryCode: "US",
    category: "Electronics",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "None stated.",
      categoryExceptions: "None stated.",
      policyUrl: "https://www.elevationlab.com/policies/refund-policy",
      confidence: "medium", verifiedOn: "2026-08-02",
      notes:
        "Verified Aug 2 against the merchant's page, whose entire policy is one sentence: " +
        "\"Not happy? Return it within 30 days.\" Window confirmed; who pays return shipping is " +
        "unstated, so the customer-pays assumption is kept as the cautious default. Counted " +
        "from purchase because the page names no start point.",
    },
  },

  // ------------------------------------------------------------------ Footwear
  {
    id: "allbirds", name: "Allbirds", domain: "allbirds.com", currency: "USD", countryCode: "US",
    category: "Footwear",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Gift cards, insoles and anything tagged final sale. Must be unworn and unwashed with tags.",
      categoryExceptions: "Socks, underwear and accessories only if packaging is unopened; insoles always final sale.",
      policyUrl: "https://www.allbirds.com/pages/returns-exchanges",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "The widely-repeated 'wear them anywhere' trial is not in the current policy, which requires unworn condition.",
    },
  },
  {
    id: "vessi", name: "Vessi", domain: "vessi.com", currency: "USD", countryCode: "US",
    category: "Footwear",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "free", feeUsd: 0,
      finalSaleRules: "Gift cards, socks, laces and face masks. Some sale items are exchange-only.",
      categoryExceptions: "Socks, laces and masks cannot be returned at all for hygiene reasons.",
      policyUrl: "https://vessi.com/pages/return-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Free in North America only. $5 deducted if the original shoebox is missing or damaged.",
    },
  },
  {
    id: "rothys", name: "Rothy's", domain: "rothys.com", currency: "USD", countryCode: "US",
    category: "Footwear",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 7.99,
      finalSaleRules: "'Final Few' and other final-sale items, gift cards, gift-with-purchase items.",
      categoryExceptions: "None stated.",
      policyUrl: "https://rothys.com/pages/returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "$7.99 applies to mail-in refunds only — in-store, Happy Returns drop-off and exchanges are free.",
    },
  },
  {
    id: "atoms", name: "Atoms", domain: "www.atoms.com", currency: "USD", countryCode: "US",
    category: "Footwear",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 10,
      finalSaleRules: "Masks and mystery boxes. Custom and limited editions are store-credit or one exchange only.",
      categoryExceptions: "Paid Atoms+ membership extends the window to 90 days.",
      policyUrl: "https://atoms.com/terms-and-conditions",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "$10 deducted from cash refunds; store credit refunds in full. Their help centre and terms word the window differently.",
    },
  },
  {
    id: "kizik", name: "Kizik", domain: "kizik.com", currency: "USD", countryCode: "US",
    category: "Footwear",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Sale-priced and final-sale items are not refundable.",
      categoryExceptions: "None stated.",
      policyUrl: "https://kizik.com/pages/returns-and-exchanges",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Free via UPS QR drop-off, store or return bar; $5 if you choose a printed mail-back label. Their two policy pages differ.",
    },
  },
  {
    id: "thousandfell", name: "Thousand Fell", domain: "thousandfell.com", currency: "USD", countryCode: "US",
    category: "Footwear",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 4.95,
      finalSaleRules: "Only new, unworn sneakers with original packaging. Worn pairs go to recycling instead.",
      categoryExceptions: "None stated.",
      policyUrl: "https://www.thousandfell.com/pages/orders-and-returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "$4.95 per return in the US, $20 in Canada. Refunds only to the original payment method.",
    },
  },
  {
    id: "olivercabell", name: "Oliver Cabell", domain: "olivercabell.com", currency: "USD", countryCode: "US",
    category: "Footwear",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 20,
      finalSaleRules: "Must be unworn and re-sellable with no creases or visible wear.",
      categoryExceptions: "Defects go through a separate 60-day footwear warranty.",
      policyUrl: "https://olivercabell.com/policies/refund-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "$20 restocking fee on every refund. Must be requested within 30 days and shipped within 7 of the request.",
    },
  },

  // ------------------------------------------------------------------- Apparel
  {
    id: "tentree", name: "tentree", domain: "tentree.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 10,
      finalSaleRules: "Anything discounted 30% or more is final sale. Tags must be attached and the tree code unregistered.",
      categoryExceptions: "None stated.",
      policyUrl: "https://www.tentree.com/policies/refund-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "$10 flat fee including the label, but exchanges are free. US and Canada only.",
    },
  },
  {
    id: "outerknown", name: "Outerknown", domain: "outerknown.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "free", feeUsd: 0,
      finalSaleRules: "Final-sale and 'Outerworn' resale items. Must be unworn and unwashed with tags.",
      categoryExceptions: "Discounted (non-final-sale) items carry a $5.95 return fee; full-price is free.",
      policyUrl: "https://www.outerknown.com/pages/returns-exchanges",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Free returns apply to US full-price orders only.",
    },
  },
  {
    id: "taylorstitch", name: "Taylor Stitch", domain: "taylorstitch.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 21, windowStartsFrom: "delivery", cost: "free", feeUsd: 0,
      finalSaleRules: "'Last Call' items are final sale, though a size exchange may be possible.",
      categoryExceptions: "Ordinary sale items remain returnable — only Last Call is excluded.",
      policyUrl: "https://www.taylorstitch.com/blogs/help-center/what-is-your-exchange-return-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Unusually short at 21 days. Once started, you have 28 days to ship or the refund is forfeited.",
    },
  },
  {
    id: "marinelayer", name: "Marine Layer", domain: "marinelayer.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 365, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Final-sale items, gift cards, Mystery Tees and the Re-Spun Take Back Bag.",
      categoryExceptions: "Worn swimwear without its liner, and worn or unpackaged boxers, are excluded.",
      policyUrl: "https://www.marinelayer.com/policies/refund-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "A full year, effectively no questions asked, and worn condition is generally tolerated. Free US labels.",
    },
  },
  {
    id: "faherty", name: "Faherty", domain: "fahertybrand.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 60, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Items marked final sale. Must be unworn and unwashed with all tags and packaging.",
      categoryExceptions: "None stated.",
      policyUrl: "https://fahertybrand.com/pages/returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Prepaid label, no fee deducted. Box-free drop-off via Happy Returns refunds at drop-off.",
    },
  },
  {
    id: "mackweldon", name: "Mack Weldon", domain: "mackweldon.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Final-sale items. Must be unworn and unwashed; underwear in original packaging.",
      categoryExceptions: "First-purchase Try On Guarantee lets one pair be tried and refunded without shipping it back.",
      policyUrl: "https://mackweldon.com/pages/returns",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "The page never states whether the standard label is free; a paid add-on covering labels implies it is not.",
    },
  },
  {
    id: "ministryofsupply", name: "Ministry of Supply", domain: "ministryofsupply.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Last Chance, Previous Generation, Capsule Sale, gift cards, As-Is items, masks and filters.",
      categoryExceptions: "Store-credit exchanges allowed to 100 days. Repeat boxer-brief purchases are final sale.",
      policyUrl: "https://www.ministryofsupply.com/pages/returns-exchanges",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Free domestic returns via Loop. International returns cost $25.",
    },
  },
  {
    id: "everlane", name: "Everlane", domain: "everlane.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "shipment", cost: "flat_fee", feeUsd: 7,
      finalSaleRules: "Final-sale items and gift cards. Must be unworn and unwashed with tags.",
      categoryExceptions: "Swimwear and bodysuits need their hygienic liner attached. Non-US markets get 45 days.",
      policyUrl: "https://www.everlane.com/policies/refund-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Counts from the SHIP date, so the real deadline is earlier than it looks. $7 waived for store credit or in-person returns.",
    },
  },
  {
    id: "trueclassic", name: "True Classic", domain: "trueclassictees.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 100, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 5,
      finalSaleRules: "Items marked final sale. Must be unworn and unwashed.",
      categoryExceptions: "None stated.",
      policyUrl: "https://www.trueclassictees.com/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Two of their own pages agree on 100 days; the fee is described as a processing/restocking deduction.",
    },
  },
  {
    id: "chubbies", name: "Chubbies", domain: "chubbiesshorts.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "free", feeUsd: 0,
      finalSaleRules: "Sale items and gift cards per the published policy — though that clause may be Shopify boilerplate.",
      categoryExceptions: "EU customers have a separate 14-day withdrawal right.",
      policyUrl: "https://www.shopchubbies.com/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Their help centre and returns portal could not be read directly; sale-item eligibility is the uncertain part.",
    },
  },
  {
    id: "beyondyoga", name: "Beyond Yoga", domain: "beyondyoga.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Final-sale items are not refunded AND are discarded rather than returned if you send them back.",
      categoryExceptions: "Gift returns go to a gift card. International and APO orders don't get free shipping.",
      policyUrl: "https://beyondyoga.com/pages/returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "The discard rule on final-sale items is the real trap here — you lose both the item and the money.",
    },
  },
  {
    id: "girlfriend", name: "Girlfriend Collective", domain: "girlfriend.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "shipment", cost: "flat_fee", feeUsd: 7,
      finalSaleRules: "Final-sale items, promotional purchases, free gifts and e-gift cards.",
      categoryExceptions: "Swimwear and bodysuits need liners attached. After a first purchase, socks and underwear are final sale.",
      policyUrl: "https://www.girlfriend.com/policies/refund-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Counts from ship date. $7 waived for store credit, exchanges and in-person drop-off.",
    },
  },
  {
    id: "outdoorvoices", name: "Outdoor Voices", domain: "outdoorvoices.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 7,
      finalSaleRules: "Final-sale items. Must be unworn, undamaged and unwashed with tags.",
      categoryExceptions: "Canadian orders pay $25 and cannot exchange.",
      policyUrl: "https://www.outdoorvoices.com/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "$7 deducted from refunds; same-item exchanges ship free. Some third-party sources claim 45 days — not supported by their own page.",
    },
  },
  {
    id: "asrv", name: "ASRV", domain: "asrv.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Final-sale items. Must be unwashed and unworn with original tags.",
      categoryExceptions: "Masks, balaclavas, compression bottoms, underwear and socks cannot be returned at all.",
      policyUrl: "https://asrv.com/pages/returns-and-exchanges",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Return shipping is free only if the prepaid-returns add-on was bought at checkout. Exchanges are always covered.",
    },
  },
  {
    id: "pairofthieves", name: "Pair of Thieves", domain: "pairofthieves.com", currency: "USD", countryCode: "US",
    category: "Apparel",
    policy: {
      windowDays: 101, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Final-sale items; third-party retailer purchases are not accepted.",
      categoryExceptions: "Black Friday and Cyber Monday promotional purchases may be excluded.",
      policyUrl: "https://pairofthieves.com/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "The 101-Day Guarantee covers worn product, unusual for socks and underwear. Their terms page conflicts on who pays shipping.",
    },
  },

  // ------------------------------------------------------------ Home & bedding
  {
    id: "brooklinen", name: "Brooklinen", domain: "brooklinen.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 365, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 9.95,
      finalSaleRules: "The entire Last Call / Sale section is final sale and cannot be returned.",
      categoryExceptions: "None stated — 365 days applies to everything eligible.",
      policyUrl: "https://www.brooklinen.com/pages/returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "$9.95 deducted, waived in-store. No exchanges — return and rebuy, which suits this product exactly.",
    },
  },
  {
    id: "parachute", name: "Parachute", domain: "parachutehome.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 60, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 8,
      finalSaleRules: "Final-sale items, gift cards, swatches, the Handmade Wood Bed Frame.",
      categoryExceptions: "Mattresses get a 100-night trial with free pickup.",
      policyUrl: "https://parachutehome.com/pages/returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "$8 deducted on mail-in; free in a Parachute store or if you take store credit.",
    },
  },
  {
    id: "bollandbranch", name: "Boll & Branch", domain: "bollandbranch.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "free", feeUsd: 0,
      finalSaleRules: "Pet beds are never returnable. Last-call, sale and clearance items are final.",
      categoryExceptions: "Mattresses cannot be returned in the first 30 days, then run to 100 days.",
      policyUrl: "https://www.bollandbranch.com/pages/shipping-return-policy/",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Explicitly accepts washed or used bedding within 30 days — rare, and worth knowing.",
    },
  },
  {
    id: "buffy", name: "Buffy", domain: "buffy.co", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "unknown", feeUsd: null,
      finalSaleRules: "The at-home trial excludes final-sale orders and Shop Pay orders.",
      categoryExceptions: "A 7-night trial pre-authorises rather than charges the card.",
      policyUrl: "https://buffy.co/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Their own page says 30 nights, not the 50 that circulates elsewhere. Return cost is genuinely unpublished.",
    },
  },
  {
    id: "coyuchi", name: "Coyuchi", domain: "coyuchi.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Made-to-order items, final sale, and anything discounted 50% or more.",
      categoryExceptions: "Days 31–180 are store credit only, minus a $15 restocking fee.",
      policyUrl: "https://www.coyuchi.com/pages/returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Washed or worn bedding is explicitly returnable inside 30 days, with free return shipping.",
    },
  },
  {
    id: "cozyearth", name: "Cozy Earth", domain: "cozyearth.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 11.99,
      finalSaleRules: "Final-sale and 'Last Chance' products accept no returns or exchanges.",
      categoryExceptions: "Bedding gets 100 days; non-bedding is 30, which is what we record.",
      policyUrl: "https://cozyearth.com/pages/faq#returns-exchanges",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Fee is 3% or $11.99, whichever is greater — so it scales above $11.99 on larger orders.",
    },
  },
  {
    id: "ettitude", name: "ettitude", domain: "ettitude.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Final-sale items; third-party retailer purchases go back to the retailer.",
      categoryExceptions: "A 60-night sleep trial applies only to a first purchase of full-price bedding.",
      policyUrl: "https://ettitude.com/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Outside the first-purchase trial, items must be unused and unwashed. Label cost is deducted but never quantified.",
    },
  },
  {
    id: "nestbedding", name: "Nest Bedding", domain: "nestbedding.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 10,
      finalSaleRules: "All furniture, foundations and bases are final sale. Clearance bedding is non-returnable.",
      categoryExceptions: "Mattresses get a 365-night trial after a mandatory 30-night adjustment period.",
      policyUrl: "https://www.nestbedding.com/policies/refund-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Washed or used bedding is NOT returnable — must be sanitary and resaleable in original packaging.",
    },
  },
  {
    id: "avocado", name: "Avocado Green", domain: "avocadogreenmattress.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 99,
      finalSaleRules: "Bases, dressers, headboards, accessories, decor, clearance and anything over 50% off.",
      categoryExceptions: "Windows range from 30 days to a year by product; fees range $10 to $99 to 20% restocking.",
      policyUrl: "https://help.avocadogreenmattress.com/en/articles/6641437-what-is-avocado-s-return-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "One of the most fragmented policies in the registry — the shortest category window is recorded deliberately.",
    },
  },
  {
    id: "sijo", name: "Sijo", domain: "sijohome.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 60, windowStartsFrom: "delivery", cost: "unknown", feeUsd: null,
      finalSaleRules: "Final-sale and Refresh Collection items are excluded from returns and the trial.",
      categoryExceptions: "A 30-day trial allows used bedding back; days 31–60 require unused and unwashed.",
      policyUrl: "https://sijohome.com/pages/return-and-shipping",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Domestic return cost is not published anywhere on their page.",
    },
  },
  {
    id: "burrow", name: "Burrow", domain: "www.burrow.com", currency: "USD", countryCode: "US",
    category: "Home & bedding",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: null,
      finalSaleRules: "Must be in usable condition — no stains, tears, burns, pet damage or odours.",
      categoryExceptions: "Mattresses get 100 days from receipt with free returns in good condition.",
      policyUrl: "https://burrow.com/returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Fee is a percentage, not a fixed sum: 10% with original packaging, 20% without, capped at $250.",
    },
  },

  // ------------------------------------------------------------------- Kitchen
  {
    id: "ourplace", name: "Our Place", domain: "fromourplace.com", currency: "USD", countryCode: "US",
    category: "Kitchen",
    policy: {
      windowDays: 100, windowStartsFrom: "shipment", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Final-sale items and gift cards; items damaged in return transit are ineligible.",
      categoryExceptions: "Retail-store purchases run 100 days from the purchase date instead.",
      policyUrl: "https://fromourplace.com/pages/returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Counts from ship date. Each item must go back in its own box with its own label.",
    },
  },
  {
    id: "misen", name: "Misen", domain: "misen.com", currency: "USD", countryCode: "US",
    category: "Kitchen",
    policy: {
      windowDays: 60, windowStartsFrom: "delivery", cost: "free", feeUsd: 0,
      finalSaleRules: "Consumables and final-sale items once shipped.",
      categoryExceptions: "Amazon purchases follow Amazon's 30 days and go back through Amazon.",
      policyUrl: "https://help.misen.com/en-US/what-is-your-return-policy-321721",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "A genuine 60-day risk-free trial — used cookware appears acceptable within it.",
    },
  },
  {
    id: "materialkitchen", name: "Material Kitchen", domain: "materialkitchen.com", currency: "USD", countryCode: "US",
    category: "Kitchen",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 9.95,
      finalSaleRules: "A small number of products are marked final sale.",
      categoryExceptions: "'MK Finds' vendor products follow each vendor's own policy.",
      policyUrl: "https://materialkitchen.com/pages/return-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "The $9.95 applies only to refunds over $101, and is waived for store credit or exchange.",
    },
  },
  {
    id: "hedleyandbennett", name: "Hedley & Bennett", domain: "hedleyandbennett.com", currency: "USD", countryCode: "US",
    category: "Kitchen",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Embroidered, personalised, Mystery Box and overstock aprons, plus anything final sale.",
      categoryExceptions: "None stated.",
      policyUrl: "https://www.hedleyandbennett.com/support/shipping-and-returns-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Must be RECEIVED within 30 days, not merely postmarked — a meaningfully tighter deadline.",
    },
  },
  {
    id: "fellow", name: "Fellow", domain: "fellowproducts.com", currency: "USD", countryCode: "US",
    category: "Kitchen",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 5,
      finalSaleRules: "Coffee, personalised products, refurbished gear and final-sale items.",
      categoryExceptions: "Pre-orders run from delivery. Holiday orders extend to 60 days.",
      policyUrl: "https://fellowproducts.com/pages/return-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Fee is tiered by product: $5 non-electric up to $50 for espresso machines. Waived for gift-card refunds.",
    },
  },
  {
    id: "greatjones", name: "Great Jones", domain: "greatjonesgoods.com", currency: "USD", countryCode: "US",
    category: "Kitchen",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "free", feeUsd: 0,
      finalSaleRules: "Engraved or personalised pieces.",
      categoryExceptions: "Early-November to mid-December orders extend to 10 January.",
      policyUrl: "https://greatjonesgoods.com/pages/shipping-return-discount-policies-updated",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "No-questions-asked with a prepaid label; the policy assumes you've actually cooked with it.",
    },
  },
  {
    id: "brightland", name: "Brightland", domain: "brightland.co", currency: "USD", countryCode: "US",
    category: "Kitchen",
    policy: {
      windowDays: 0, windowStartsFrom: "unknown", cost: "unknown", feeUsd: null,
      finalSaleRules: "Every order is final sale. No returns or exchanges are accepted on anything.",
      categoryExceptions: "None — the policy is absolute.",
      policyUrl: "https://brightland.co/pages/faqs-olive-oil",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Watch-only. There is no return route, so a rebuy could never be unwound.",
    },
  },
  {
    id: "graza", name: "Graza", domain: "graza.co", currency: "USD", countryCode: "US",
    category: "Kitchen",
    policy: {
      windowDays: 0, windowStartsFrom: "unknown", cost: "unknown", feeUsd: null,
      finalSaleRules: "No returns accepted at all — the product is perishable food.",
      categoryExceptions: "None.",
      policyUrl: "https://www.graza.co/pages/faqs",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Watch-only, for the same reason as Brightland.",
    },
  },

  // --------------------------------------------------------- Outdoor & fitness
  {
    id: "cotopaxi", name: "Cotopaxi", domain: "cotopaxi.com", currency: "USD", countryCode: "US",
    category: "Outdoor & fitness",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 6,
      finalSaleRules: "Final-sale items and event tickets. Must be unworn with tags intact.",
      categoryExceptions: "International and US-territory orders get 60 days but pay their own shipping.",
      policyUrl: "https://www.cotopaxi.com/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Their own pages state both 30 and 60 days in different sections; the shorter is recorded deliberately.",
    },
  },
  {
    id: "rumpl", name: "Rumpl", domain: "rumpl.com", currency: "USD", countryCode: "US",
    category: "Outdoor & fitness",
    policy: {
      windowDays: 60, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 15,
      finalSaleRules: "Final-sale, custom MyRumpl, Pro and bulk orders over 50 units.",
      categoryExceptions: "None stated.",
      policyUrl: "https://www.rumpl.com/pages/returns-and-exchanges",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Marketing elsewhere mentions a 100-night trial; the official returns page says 60 days, which is what we use.",
    },
  },
  {
    id: "nemo", name: "NEMO Equipment", domain: "nemoequipment.com", currency: "USD", countryCode: "US",
    category: "Outdoor & fitness",
    policy: {
      windowDays: 60, windowStartsFrom: "purchase", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Pro-deal sales are final. Must be new, unused and clean with all packaging.",
      categoryExceptions: "Retailer purchases go back to the retailer.",
      policyUrl: "https://www.nemoequipment.com/pages/returns-exchanges",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Used gear is not returnable; not-new items incur a reshelving fee or outright denial.",
    },
  },
  {
    id: "therabody", name: "Therabody", domain: "therabody.com", currency: "USD", countryCode: "US",
    category: "Outdoor & fitness",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "free", feeUsd: 0,
      finalSaleRules: "Personalised items, refurbished devices and anything marked final sale.",
      categoryExceptions: "Some products are flagged return-ineligible on their own product pages.",
      policyUrl: "https://www.therabody.com/pages/return-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Free return shipping, no restocking fee, but must be like-new with all packaging. Labels expire after 14 days.",
    },
  },

  // -------------------------------------------------------------------- Beauty
  {
    id: "glossier", name: "Glossier", domain: "glossier.com", currency: "USD", countryCode: "US",
    category: "Beauty",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "unknown", feeUsd: null,
      finalSaleRules: "Gift cards and store-specific merchandise.",
      categoryExceptions: "Gifted items return for store credit only.",
      policyUrl: "https://www.glossier.com/policies/refund-policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "The page describes a self-service label but never states who pays, nor whether opened product is accepted.",
    },
  },
  {
    id: "ilia", name: "ILIA Beauty", domain: "iliabeauty.com", currency: "USD", countryCode: "US",
    category: "Beauty",
    policy: {
      windowDays: 60, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Final-sale items and complimentary gifts-with-purchase.",
      categoryExceptions: "None stated for the US.",
      policyUrl: "https://support.iliabeauty.com/en-US/what-is-your-returnexchange-policy-732130",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Refund or store credit at the customer's choice, prepaid label, no restocking fee.",
    },
  },
  {
    id: "tula", name: "TULA Skincare", domain: "tula.com", currency: "USD", countryCode: "US",
    category: "Beauty",
    policy: {
      windowDays: 60, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Gift cards and free gifts.",
      categoryExceptions: "None stated.",
      policyUrl: "https://help.tula.com/en-US/what-is-tulas-return-policy-316939",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Counts from order date. They accept returns without original packaging, so opened product is fine.",
    },
  },
  {
    id: "kosas", name: "Kosas", domain: "kosas.com", currency: "USD", countryCode: "US",
    category: "Beauty",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Samples, final-sale items and all international orders.",
      categoryExceptions: "Late-November to Christmas orders get 60 days.",
      policyUrl: "https://kosas.com/pages/returns",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Their terms reference a restocking fee but never publish an amount — verify before relying on a full refund.",
    },
  },
  {
    id: "versed", name: "Versed", domain: "versedskin.com", currency: "USD", countryCode: "US",
    category: "Beauty",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 7.99,
      finalSaleRules: "Items marked final sale.",
      categoryExceptions: "None stated.",
      policyUrl: "https://versedskin.gorgias.help/en-US",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Policy lives on their hosted help centre rather than their own domain; several of their own URLs 404.",
    },
  },

  // ------------------------------------------------------------- Bags & travel
  {
    id: "away", name: "Away", domain: "awaytravel.com", currency: "USD", countryCode: "US",
    category: "Bags & travel",
    policy: {
      windowDays: 100, windowStartsFrom: "purchase", cost: "free", feeUsd: 0,
      finalSaleRules: "Monogrammed items, gift cards, corporate gifts, and anything with seals removed.",
      categoryExceptions: "None — 100 days applies across products.",
      policyUrl: "https://www.awaytravel.com/pages/returns-exchanges",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Must be UNUSED — at-home testing only, no travel use. Exchanging doesn't reset the clock.",
    },
  },
  {
    id: "monos", name: "Monos", domain: "monos.com", currency: "USD", countryCode: "US",
    category: "Bags & travel",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 25,
      finalSaleRules: "Luggage tags, UVC bottles and alphabet stickers. Photos required; must be brand new.",
      categoryExceptions: "Luggage gets a 100-day trial; sunglasses and accessories get free 30-day returns.",
      policyUrl: "https://monos.com/pages/faq",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "The 30-day non-luggage window is the shortest and is what we record.",
    },
  },
  {
    id: "calpak", name: "CALPAK", domain: "calpaktravel.com", currency: "USD", countryCode: "US",
    category: "Bags & travel",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 24.95,
      finalSaleRules: "Gift cards, personalised items, sample and flash-sale items.",
      categoryExceptions: "$12.95 for bags and accessories, $24.95 for luggage; waived with Return Coverage.",
      policyUrl: "https://www.calpaktravel.com/pages/return-exchange-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Strict condition bar — luggage removed from its box can count as used.",
    },
  },
  {
    id: "dagnedover", name: "Dagne Dover", domain: "dagnedover.com", currency: "USD", countryCode: "US",
    category: "Bags & travel",
    policy: {
      windowDays: 30, windowStartsFrom: "shipment", cost: "flat_fee", feeUsd: 10,
      finalSaleRules: "Final-sale items and gift cards. Products must be new and unused.",
      categoryExceptions: "International returns carry a $15 handling fee.",
      policyUrl: "https://www.dagnedover.com/pages/terms-and-conditions",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Counts from shipping confirmation, so the usable window is shorter than it appears.",
    },
  },
  {
    id: "tortuga", name: "Tortuga", domain: "tortugabackpacks.com", currency: "USD", countryCode: "US",
    category: "Bags & travel",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Gift cards. Travel use, scuffs, stains, odours or pet hair disqualify a return.",
      categoryExceptions: "None stated.",
      policyUrl: "https://www.tortugabackpacks.com/pages/returns",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "You may test-pack at home but not travel with it. Return postage mechanism is not published.",
    },
  },

  // ----------------------------------------------------------------------- Pet
  {
    id: "wildone", name: "Wild One", domain: "wildone.com", currency: "USD", countryCode: "US",
    category: "Pet",
    policy: {
      windowDays: 30, windowStartsFrom: "delivery", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Orders totalling $400 or more are final sale. Outdoor-used or dog-damaged items are refused.",
      categoryExceptions: "Limited editions and international orders cannot be exchanged.",
      policyUrl: "https://wildone.com/policies/refund-policy",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "The $400 final-sale threshold is unusual and easy to trip on a single large order.",
    },
  },

  // --------------------------------------------------------------------- Tools
  {
    id: "benchmade", name: "Benchmade", domain: "benchmade.com", currency: "USD", countryCode: "US",
    category: "Tools",
    policy: {
      windowDays: 60, windowStartsFrom: "delivery", cost: "flat_fee", feeUsd: 15,
      finalSaleRules: "Custom, personalised, engraved, Gold Class and Limited Edition knives.",
      categoryExceptions: "None stated.",
      policyUrl: "https://support.benchmade.com/hc/en-us/articles/15085627704987-Benchmade-Knife-Company-Return-Policy",
      confidence: "medium", verifiedOn: VERIFIED,
      notes: "Their support site refused direct fetches, so this comes from indexed content of that official page.",
    },
  },
  {
    id: "leatherman", name: "Leatherman", domain: "leatherman.com", currency: "USD", countryCode: "US",
    category: "Tools",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "customer_pays_shipping", feeUsd: null,
      finalSaleRules: "Final-sale items; customised or engraved items are non-returnable and non-cancellable.",
      categoryExceptions: "Damaged tools route to the lifetime warranty instead of returns.",
      policyUrl: "https://www.leatherman.com/pages/customerservice-shipping-returns",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "Refund is the item total less shipping both ways. Returns start by phone, not a portal.",
    },
  },
  {
    id: "topodesigns", name: "Topo Designs", domain: "topodesigns.com", currency: "USD", countryCode: "US",
    category: "Tools",
    policy: {
      windowDays: 30, windowStartsFrom: "purchase", cost: "flat_fee", feeUsd: 9,
      finalSaleRules: "Final-sale items. Must be unused, unwashed and free of pet hair.",
      categoryExceptions: "International orders cannot be returned or exchanged at all.",
      policyUrl: "https://topodesigns.com/pages/returns-and-shipping",
      confidence: "high", verifiedOn: VERIFIED,
      notes: "US exchanges are free; refunds cost $9 unless you're a VIP member or bought the free-returns add-on.",
    },
  },
];
