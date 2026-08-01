"use client";
import { use, useCallback, useEffect, useState } from "react";

type Ev = { id: string; type: string; detail: unknown; at: string };
type ItemDetail = {
  id: string;
  productName: string;
  retailerName: string;
  retailerUrl: string;
  orderId: string;
  purchasePrice: string;
  currentPrice: string;
  rebuyPrice: string | null;
  purchaseDate: string;
  returnDeadline: string;
  status: string;
  mandateId: string | null;
  prices: { id: string; price: string; source: string; at: string }[];
  events: Ev[];
};

const EVENT_COPY: Record<string, string> = {
  item_ingested: "Receipt read and purchase registered",
  mandate_setup_session_created: "Secure authorization session created with Prava",
  mandate_active: "You approved the agent — standing authorization active",
  drop_detected: "Price drop detected inside the return window",
  rebuy_started: "Agent started the repurchase",
  mandate_charge: "Prava charged the authorization and issued a single-use card",
  charge_reported: "Purchase outcome reported to the card network",
  rebuy_complete: "Repurchase complete — savings locked in",
  rebuy_failed: "Repurchase attempt declined by guardrails",
  mandate_cancelled: "Authorization revoked",
};

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [simPrice, setSimPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch(`/api/items/${id}`).then((r) => r.json()).then(setItem);
  }, [id]);
  useEffect(refresh, [refresh]);

  if (!item)
    return <div className="h-40 animate-pulse rounded-3xl bg-zinc-900" />;

  const paid = Number(item.purchasePrice);
  const now = Number(item.currentPrice);
  const savings = item.rebuyPrice ? paid - Number(item.rebuyPrice) : 0;
  const fee = savings * 0.15;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(item.returnDeadline).getTime() - Date.now()) / 86400000)
  );

  async function call(path: string, body?: unknown) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Something went wrong — try again.");
      return j;
    } catch (e) {
      setMsg((e as Error).message);
      return null;
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function authorize() {
    const j = await call(`/api/items/${item!.id}/authorize`);
    if (j?.iframeUrl) window.location.href = j.iframeUrl;
  }

  const stepIndex =
    item.status === "ingested" || item.status === "authorizing"
      ? 1
      : item.status === "monitoring"
        ? 2
        : item.status === "drop_detected"
          ? 3
          : item.status === "return_ready"
            ? 4
            : 2;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
          {item.productName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {item.retailerName} · Order {item.orderId} · {daysLeft} days left to return
        </p>
      </div>

      {!["revoked", "expired"].includes(item.status) && (
        <Stepper
          steps={["Receipt", "Authorize", "Watching", "Drop", "Rebought"]}
          active={stepIndex}
        />
      )}

      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
        <Stat label="You paid" value={`$${paid.toFixed(2)}`} />
        <Stat label="Current price" value={`$${now.toFixed(2)}`} accent={now < paid} divider />
        <Stat label="Saved" value={`$${savings.toFixed(2)}`} accent={savings > 0} divider />
      </div>

      {["ingested", "authorizing"].includes(item.status) && (
        <Card>
          <h2 className="text-base font-semibold">
            {item.status === "ingested" ? "Authorize your agent" : "Finish authorizing your agent"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            One approval with your fingerprint sets the rules the agent can never break: it may
            repurchase <span className="text-zinc-200">this item only</span>, from{" "}
            <span className="text-zinc-200">{item.retailerName} only</span>, for at most{" "}
            <span className="text-zinc-200">${paid.toFixed(2)}</span>, within{" "}
            <span className="text-zinc-200">7 days</span>. The cap is enforced by the card
            network itself.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={authorize}
              disabled={busy}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40"
            >
              {busy ? "Opening secure session…" : "Authorize with Prava →"}
            </button>
            {item.status === "authorizing" && (
              <button
                onClick={() => call(`/api/items/${item!.id}/confirm-mandate`)}
                disabled={busy}
                className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
              >
                I already approved — check again
              </button>
            )}
          </div>
        </Card>
      )}

      {item.mandateId && !["revoked"].includes(item.status) && (
        <Card>
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold">What this agent is allowed to do</h2>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              Passkey-approved
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Guard k="Merchant" v={`${item.retailerName} only`} />
            <Guard k="Spend limit" v={`$${paid.toFixed(2)} per charge`} />
            <Guard k="Charges" v="Single use" />
            <Guard k="Expires" v="7 days from approval" />
          </dl>
          {["monitoring", "drop_detected"].includes(item.status) && (
            <button
              onClick={() => call(`/api/items/${item!.id}/revoke`)}
              disabled={busy}
              className="mt-5 rounded-full border border-red-500/40 px-4 py-2 text-[13px] font-medium text-red-400 transition hover:bg-red-500/10"
            >
              Revoke access
            </button>
          )}
        </Card>
      )}

      {item.status === "monitoring" && (
        <Card muted>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Price watch</h2>
            <span className="text-xs text-zinc-500">demo: simulated feed · payments are real sandbox</span>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            The agent acts when the price falls ≥ $1 or 2%, with more than 5 days left to return.
          </p>
          <div className="mt-4 flex gap-3">
            <input
              type="number"
              step="0.01"
              value={simPrice}
              onChange={(e) => setSimPrice(e.target.value)}
              placeholder={`Try ${(paid * 0.85).toFixed(2)}`}
              className="w-44 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm outline-none transition focus:border-emerald-500"
            />
            <button
              onClick={() => call(`/api/items/${item!.id}/price`, { price: Number(simPrice) })}
              disabled={busy || !simPrice}
              className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-40"
            >
              {busy ? "Agent deciding…" : "Push price"}
            </button>
          </div>
        </Card>
      )}

      {item.status === "return_ready" && (
        <Card highlight>
          <h2 className="text-base font-semibold text-emerald-300">
            Rebought at ${Number(item.rebuyPrice).toFixed(2)} — one thing left to do
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">You save</p>
              <p className="text-xl font-semibold text-emerald-400">${(savings - fee).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Rebuy fee (15%)</p>
              <p className="text-xl font-semibold text-zinc-300">${fee.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Ship return by</p>
              <p className="text-xl font-semibold text-zinc-300">
                {new Date(new Date(item.returnDeadline).getTime() - 2 * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
          <a
            href={`${item.retailerUrl}/gp/css/order-history`}
            target="_blank"
            className="mt-5 inline-block rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Start the return on {item.retailerName} →
          </a>
          <p className="mt-2 text-xs text-zinc-500">
            Return the <em>original</em> order {item.orderId} · reason: “Found better price”
          </p>
        </Card>
      )}

      <Card muted>
        <h2 className="text-base font-semibold">Activity</h2>
        <ol className="mt-4 space-y-0">
          {item.events.map((e, idx) => (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {idx !== item.events.length - 1 && (
                <span className="absolute left-[5px] top-4 h-full w-px bg-zinc-800" />
              )}
              <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-emerald-500 bg-zinc-950" />
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">{EVENT_COPY[e.type] ?? e.type}</p>
                <p className="text-xs text-zinc-500">{new Date(e.at).toLocaleString()}</p>
                {e.detail != null && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
                      technical details
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-900 p-2 font-mono text-[11px] text-zinc-500">
                      {JSON.stringify(e.detail, null, 1)}
                    </pre>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {msg && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {msg}
        </p>
      )}
    </main>
  );
}

function Stepper({ steps, active }: { steps: string[]; active: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
              i < active
                ? "bg-emerald-500/15 text-emerald-400"
                : i === active
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-900 text-zinc-600"
            }`}
          >
            {s}
          </span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-zinc-800" />}
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value, accent, divider }: { label: string; value: string; accent?: boolean; divider?: boolean }) {
  return (
    <div className={`p-5 ${divider ? "border-l border-zinc-800/70" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${accent ? "text-emerald-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Card({
  children,
  muted,
  highlight,
}: {
  children: React.ReactNode;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border p-6 ${
        highlight
          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
          : muted
            ? "border-zinc-800/70 bg-zinc-900/30"
            : "border-zinc-800/70 bg-zinc-900/60"
      }`}
    >
      {children}
    </section>
  );
}

function Guard({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-800/60 pb-2">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="font-medium text-zinc-200">{v}</dd>
    </div>
  );
}
