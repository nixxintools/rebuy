// Senso holds the merchant return policies as verified, citable knowledge.
//
// Why this is not just a lookup in our own registry: the registry is a table we
// wrote, and the agent has no way to show its work. Asking Senso means the
// answer that gates a purchase comes back with the source document attached, so
// the decision is auditable — and outcomes written back mean the next decision
// about that merchant is informed by what actually happened last time.
//
// Senso is consulted, not depended on. If it is unreachable the agent falls back
// to the local registry and records that it did, rather than blocking a purchase
// the user is entitled to.
import crypto from "crypto";

const BASE = "https://apiv2.senso.ai/api/v1";
const KEY = process.env.SENSO_API_KEY;

export function sensoConfigured() {
  return Boolean(KEY);
}

export type PolicyVerdict = {
  source: "senso" | "local_registry";
  /** Senso's prose answer, suitable to show a user. */
  answer: string | null;
  /** Documents the answer was drawn from. */
  citations: { title: string; contentId?: string }[];
  /** Did Senso indicate the item cannot be returned? */
  returnBlocked: boolean;
  unavailableReason?: string;
};

type SearchResponse = {
  answer?: string;
  results?: { title?: string; filename?: string; content_id?: string }[];
  total_results?: number;
};

async function search(query: string, maxResults = 3): Promise<SearchResponse | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}/org/search`, {
      method: "POST",
      headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: maxResults }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as SearchResponse;
  } catch {
    return null;
  }
}

/**
 * Ask whether this purchase can actually be returned, before spending against it.
 * Phrased as a question about the specific merchant and item so the answer cites
 * that merchant's policy document rather than a neighbouring one.
 */
export async function verifyReturnable(
  merchantName: string,
  productTitle: string
): Promise<PolicyVerdict> {
  const query =
    `Can a "${productTitle}" bought from ${merchantName} be returned? ` +
    `What is ${merchantName}'s return window, what does it cost to return, ` +
    `and what does ${merchantName} treat as final sale?`;

  const result = await search(query);

  if (!result || !result.total_results) {
    return {
      source: "local_registry",
      answer: null,
      citations: [],
      returnBlocked: false,
      unavailableReason: !KEY
        ? "Senso is not configured"
        : !result
          ? "Senso did not respond"
          : "No verified policy found for this merchant",
    };
  }

  const answer = (result.answer ?? "").trim();
  const lower = answer.toLowerCase();

  // Only treat an explicit refusal as a block. The question is phrased "Can X
  // be returned?", so the answer leads with its verdict — trust that, not stray
  // keywords. An earlier keyword-only version blocked an answer that began
  // "Yes — Anker accepts returns" because its list of exceptions contained the
  // words "final sale": describing the policy's edge cases is not a refusal.
  const stance = lower.replace(/^[^a-z]+/, "");
  const saysYes = stance.startsWith("yes");
  const saysNo = /^no\b/.test(stance);
  const refusal =
    /does not accept returns|no returns|cannot be returned|final sale|not returnable/.test(lower);
  const affirmation =
    /can be returned|accepts returns|is returnable|eligible for return/.test(lower);
  const returnBlocked = saysNo || (refusal && !saysYes && !affirmation);

  return {
    source: "senso",
    answer,
    citations: (result.results ?? []).map((r) => ({
      title: r.title ?? r.filename ?? "policy document",
      contentId: r.content_id,
    })),
    returnBlocked,
  };
}

/**
 * Write the result of a transaction back into the knowledge base. The next agent
 * that considers this merchant sees what happened last time — whether the policy
 * held up, what the return actually cost, whether a refund arrived.
 */
export async function recordOutcome(outcome: {
  merchantName: string;
  productTitle: string;
  paidUsd: number;
  rebuyUsd: number;
  returnCostUsd: number;
  netSavingUsd: number;
  transactionId: string;
  status: string;
  occurredAt?: Date;
}): Promise<{ ok: boolean; contentId?: string; reason?: string }> {
  if (!KEY) return { ok: false, reason: "Senso is not configured" };

  const when = (outcome.occurredAt ?? new Date()).toISOString().slice(0, 10);
  const body = `# Rebuy transaction outcome: ${outcome.merchantName}

Merchant: ${outcome.merchantName}
Product: ${outcome.productTitle}
Date: ${when}
Prava transaction: ${outcome.transactionId}
Outcome status: ${outcome.status}

## What happened

An agent detected a price drop on a purchase from ${outcome.merchantName} and repurchased it.
The original was bought for $${outcome.paidUsd.toFixed(2)} and repurchased at $${outcome.rebuyUsd.toFixed(2)}.
Returning the original was expected to cost $${outcome.returnCostUsd.toFixed(2)},
leaving a net saving of $${outcome.netSavingUsd.toFixed(2)}.

## What this tells a future agent

${outcome.netSavingUsd > 0
  ? `Repurchasing at ${outcome.merchantName} produced a real saving after return costs. The published return policy was usable in practice.`
  : `Repurchasing at ${outcome.merchantName} did not clear the cost of returning the original. Treat small price drops at this merchant with caution.`}
`;

  try {
    const md5 = crypto.createHash("md5").update(body).digest("hex");
    const filename = `outcome-${outcome.merchantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${outcome.transactionId}.md`;

    const init = await fetch(`${BASE}/org/kb/upload`, {
      method: "POST",
      headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            filename,
            file_size_bytes: Buffer.byteLength(body),
            content_type: "text/markdown",
            content_hash_md5: md5,
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!init.ok) return { ok: false, reason: `upload init failed (${init.status})` };

    const json = (await init.json()) as {
      results?: { content_id?: string; upload_url?: string }[];
    };
    const target = json.results?.[0];
    if (!target?.upload_url) return { ok: false, reason: "no upload URL returned" };

    const put = await fetch(target.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!put.ok) return { ok: false, reason: `upload failed (${put.status})` };

    return { ok: true, contentId: target.content_id };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
