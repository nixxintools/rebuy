// Turns the verified merchant registry into one document per merchant for Senso.
// One file per merchant rather than a single blob, so an answer cites the shop
// it actually came from.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const cookie = process.argv[2];
const res = await fetch("https://rebuy.upthink.app/api/merchants/search?q=", {
  headers: { cookie },
});
if (!res.ok) throw new Error(`registry fetch failed: ${res.status}`);
const { merchants } = await res.json();

mkdirSync(".senso-corpus", { recursive: true });

const costLine = (p) => {
  if (p.cost === "free") return "Returns are free.";
  if (p.cost === "flat_fee" && p.feeUsd != null) return `A $${p.feeUsd.toFixed(2)} fee is deducted from the refund.`;
  if (p.cost === "flat_fee") return "A return fee is deducted from the refund.";
  if (p.cost === "customer_pays_shipping") return "The customer pays return shipping.";
  return "The return cost is not published.";
};

for (const m of merchants) {
  const p = m.policy;
  const returnable = p.windowDays > 0;
  const doc = `# ${m.name} return policy

Merchant: ${m.name}
Website: https://${m.domain}
Category: ${m.category}
Currency: ${m.currency}

## Can this be returned?

${returnable
  ? `Yes. ${m.name} accepts returns within ${p.windowDays} days, counted from ${p.windowStartsFrom}.`
  : `No. ${m.name} does not accept returns on any order. A repurchase at ${m.name} could never be undone.`}

## Return window

${p.windowDays} days from ${p.windowStartsFrom}.
${p.windowDays > 0 ? `This is the shortest window ${m.name} documents; some categories may allow longer.` : ""}

## Cost of returning

${costLine(p)}

## What cannot be returned

${p.finalSaleRules}

## Category exceptions

${p.categoryExceptions}

## Verification

Source: ${p.policyUrl}
Last verified: ${p.verifiedOn}
Confidence in this reading: ${p.confidence}
Notes: ${p.notes}

## Guidance for an agent deciding whether to spend here

${returnable && p.confidence !== "low"
  ? `An agent may repurchase at ${m.name} provided the item is not final sale and the original is still inside the ${p.windowDays}-day window with time left to ship it back. Subtract the return cost from any expected saving before deciding.`
  : `An agent must not repurchase at ${m.name}. ${returnable ? "The policy could not be verified with enough confidence." : "No return route exists, so the user would be left holding both items."}`}
`;
  writeFileSync(`.senso-corpus/${m.id}-return-policy.md`, doc);
}

console.log(`wrote ${merchants.length} policy documents to .senso-corpus/`);
