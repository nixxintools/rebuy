// The one place item status is defined. Every state must be justifiable by
// evidence we actually hold — the previous design asserted "Repurchase complete"
// on the strength of a card authorization, with no merchant order behind it.

export const STATUS = {
  ingested: "ingested",
  authorizing: "authorizing",
  monitoring: "monitoring",
  dropDetected: "drop_detected",
  /** Prava charged and issued a single-use card. No order exists yet. */
  purchaseAuthorized: "purchase_authorized",
  /** The user confirmed they completed checkout at the merchant. */
  orderPlaced: "order_placed",
  /** The user confirmed the original is on its way back. */
  returnStarted: "return_started",
  /** Refund received. Only here are savings real. */
  refundConfirmed: "refund_confirmed",
  chargeFailed: "charge_failed",
  authorizationExpired: "authorization_expired",
  revocationPending: "revocation_pending",
  revoked: "revoked",
  /** The return window closed before a drop arrived. */
  expired: "expired",
  /** Tracked for price history only — merchant isn't safe to spend at. */
  watchOnly: "watch_only",
} as const;

export type ItemStatus = (typeof STATUS)[keyof typeof STATUS];

export type StatusMeta = {
  label: string;
  /** What the user should understand is true right now. */
  meaning: string;
  /** What the user must do, if anything. */
  action: string | null;
  tone: "neutral" | "active" | "success" | "warning" | "error";
  /** Does the agent still hold spending power in this state? */
  agentCanSpend: boolean;
};

export const STATUS_META: Record<string, StatusMeta> = {
  [STATUS.ingested]: {
    label: "Needs your approval",
    meaning: "We're tracking this purchase but can't act on it yet.",
    action: "Approve the agent to let it buy on a price drop.",
    tone: "warning",
    agentCanSpend: false,
  },
  [STATUS.authorizing]: {
    label: "Approval unfinished",
    meaning: "You started approving the agent but it didn't complete.",
    action: "Finish the approval, or start it again.",
    tone: "warning",
    agentCanSpend: false,
  },
  [STATUS.monitoring]: {
    label: "Watching the price",
    meaning: "The agent is checking the live price and will buy if it drops enough.",
    action: null,
    tone: "active",
    agentCanSpend: true,
  },
  [STATUS.dropDetected]: {
    label: "Price dropped",
    meaning: "A qualifying drop was found and the agent is acting on it.",
    action: null,
    tone: "active",
    agentCanSpend: true,
  },
  [STATUS.purchaseAuthorized]: {
    label: "Card issued — purchase not finished",
    meaning:
      "The agent reserved the money and issued a single-use card. No order exists at the merchant yet.",
    action: "Complete the purchase at the merchant, then confirm it here.",
    tone: "warning",
    agentCanSpend: false,
  },
  [STATUS.orderPlaced]: {
    label: "Replacement ordered",
    meaning: "You've confirmed the cheaper replacement is ordered.",
    action: "Return the original before its deadline.",
    tone: "active",
    agentCanSpend: false,
  },
  [STATUS.returnStarted]: {
    label: "Return under way",
    meaning: "The original is on its way back. Your saving isn't banked until the refund lands.",
    action: "Confirm here once the refund arrives.",
    tone: "active",
    agentCanSpend: false,
  },
  [STATUS.refundConfirmed]: {
    label: "Saved",
    meaning: "Refund received. This saving is real.",
    action: null,
    tone: "success",
    agentCanSpend: false,
  },
  [STATUS.chargeFailed]: {
    label: "Purchase failed",
    meaning: "The agent found a drop but the payment didn't go through.",
    action: "Review and try again, or stop watching this item.",
    tone: "error",
    agentCanSpend: false,
  },
  [STATUS.authorizationExpired]: {
    label: "Approval expired",
    meaning: "Your approval lapsed before the price dropped, so the agent can no longer buy.",
    action: "Approve again if the return window is still open.",
    tone: "warning",
    agentCanSpend: false,
  },
  [STATUS.revocationPending]: {
    label: "Revoke unconfirmed",
    meaning:
      "We asked to cancel the agent's spending power but couldn't confirm it. Treat it as still active.",
    action: "Try revoking again.",
    tone: "error",
    agentCanSpend: true,
  },
  [STATUS.revoked]: {
    label: "Stopped",
    meaning: "The agent can no longer spend on this purchase.",
    action: null,
    tone: "neutral",
    agentCanSpend: false,
  },
  [STATUS.expired]: {
    label: "Return window closed",
    meaning: "The deadline passed without a qualifying price drop.",
    action: null,
    tone: "neutral",
    agentCanSpend: false,
  },
  [STATUS.watchOnly]: {
    label: "Price watch only",
    meaning: "We'll track the price, but this merchant isn't safe for the agent to buy from.",
    action: null,
    tone: "neutral",
    agentCanSpend: false,
  },
};

export function statusMeta(status: string): StatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status,
      meaning: "",
      action: null,
      tone: "neutral",
      agentCanSpend: false,
    }
  );
}

/** States where the agent still holds live spending power. */
export const SPENDABLE_STATUSES = [STATUS.monitoring, STATUS.dropDetected];

/** States after a successful charge — money committed, outcome still open. */
export const PENDING_SAVINGS_STATUSES = [
  STATUS.purchaseAuthorized,
  STATUS.orderPlaced,
  STATUS.returnStarted,
];

/** The only state where a saving has actually been realised. */
export const REALIZED_SAVINGS_STATUSES = [STATUS.refundConfirmed];

export const FEE_RATE = 0.15;

export type SavingsBreakdown = {
  realized: number;
  pending: number;
  fee: number;
  net: number;
};

type SavingsItem = {
  status: string;
  purchasePrice: unknown;
  rebuyPrice: unknown;
};

/**
 * Single source of truth for savings. Three separate copies of this arithmetic
 * previously disagreed about when a saving counted.
 */
export function summariseSavings(items: SavingsItem[]): SavingsBreakdown {
  const gap = (i: SavingsItem) =>
    i.rebuyPrice != null ? Number(i.purchasePrice) - Number(i.rebuyPrice) : 0;

  const realized = items
    .filter((i) => REALIZED_SAVINGS_STATUSES.includes(i.status as never))
    .reduce((s, i) => s + gap(i), 0);

  const pending = items
    .filter((i) => PENDING_SAVINGS_STATUSES.includes(i.status as never))
    .reduce((s, i) => s + gap(i), 0);

  const fee = realized * FEE_RATE;
  return {
    realized: round(realized),
    pending: round(pending),
    fee: round(fee),
    net: round(realized - fee),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
