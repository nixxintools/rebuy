"use client";
import { useEffect, useState } from "react";

type Item = {
  id: string;
  productName: string;
  retailerName: string;
  purchasePrice: string;
  currentPrice: string;
  rebuyPrice: string | null;
  returnDeadline: string;
  status: string;
};

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  ingested: { label: "Needs authorization", cls: "text-amber-300", dot: "bg-amber-400" },
  authorizing: { label: "Approval pending", cls: "text-amber-300", dot: "bg-amber-400" },
  monitoring: { label: "Watching price", cls: "text-sky-300", dot: "bg-sky-400" },
  drop_detected: { label: "Drop detected", cls: "text-violet-300", dot: "bg-violet-400" },
  return_ready: { label: "Rebought · return ready", cls: "text-emerald-300", dot: "bg-emerald-400" },
  revoked: { label: "Stopped", cls: "text-zinc-500", dot: "bg-zinc-600" },
  expired: { label: "Window closed", cls: "text-zinc-500", dot: "bg-zinc-600" },
};

export default function Dashboard() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    fetch("/api/items").then((r) => r.json()).then(setItems).catch(() => setItems([]));
  }, []);

  const savings = (items ?? [])
    .filter((i) => i.status === "return_ready" && i.rebuyPrice)
    .reduce((s, i) => s + (Number(i.purchasePrice) - Number(i.rebuyPrice)), 0);
  const watching = (items ?? []).filter((i) =>
    ["monitoring", "drop_detected"].includes(i.status)
  ).length;

  return (
    <main className="space-y-8">
      <section className="rounded-3xl border border-zinc-800/70 bg-gradient-to-b from-zinc-900 to-zinc-900/40 p-7">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wider text-zinc-500">
              Savings captured
            </p>
            <p className="mt-1 text-5xl font-semibold tracking-tight text-emerald-400">
              ${savings.toFixed(2)}
            </p>
          </div>
          <p className="text-right text-sm text-zinc-500">
            {watching} purchase{watching === 1 ? "" : "s"} being watched
          </p>
        </div>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
          Rebuy watches what you paid. If the price drops inside the return window, it repurchases
          at the lower price and preps your return — you keep the difference.
        </p>
      </section>

      {items === null ? (
        <div className="space-y-3">
          {[0, 1].map((k) => (
            <div key={k} className="h-20 animate-pulse rounded-2xl bg-zinc-900" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <section className="rounded-3xl border border-zinc-800/70 p-10 text-center">
          <h2 className="text-lg font-semibold">Track your first purchase</h2>
          <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm text-zinc-400">
            <li className="flex gap-3"><Step n={1} />Paste an order confirmation — AI reads it.</li>
            <li className="flex gap-3"><Step n={2} />Approve the agent once with your fingerprint.</li>
            <li className="flex gap-3"><Step n={3} />It rebuys on a drop and preps your return.</li>
          </ol>
          <a
            href="/add"
            className="mt-6 inline-block rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            Add your first receipt
          </a>
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Your purchases
          </h2>
          <ul className="divide-y divide-zinc-800/60 overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
            {items.map((i) => {
              const s = STATUS[i.status] ?? { label: i.status, cls: "text-zinc-400", dot: "bg-zinc-500" };
              const saved = i.rebuyPrice ? Number(i.purchasePrice) - Number(i.rebuyPrice) : 0;
              return (
                <li key={i.id}>
                  <a href={`/items/${i.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-800/30">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{i.productName}</span>
                      <span className={`text-[13px] ${s.cls}`}>{s.label}</span>
                    </span>
                    <span className="text-right">
                      {saved > 0 ? (
                        <span className="block font-semibold text-emerald-400">+${saved.toFixed(2)}</span>
                      ) : (
                        <span className="block font-medium text-zinc-300">
                          ${Number(i.currentPrice).toFixed(2)}
                        </span>
                      )}
                      <span className="block text-[13px] text-zinc-500">
                        paid ${Number(i.purchasePrice).toFixed(2)}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-400">
      {n}
    </span>
  );
}
