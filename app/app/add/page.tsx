"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Parsed = {
  orderId: string;
  productName: string;
  productUrl: string | null;
  purchasePrice: number;
  purchaseDate: string;
  retailer: string;
  returnDeadline: string | null;
  confidence: Record<string, number>;
};

export default function AddReceipt() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);

  async function parse() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/receipts/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setParsed(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, userEmail: email }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Save failed");
      router.push(`/items/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const low = (f: string) => (parsed?.confidence?.[f] ?? 1) < 0.8;
  const field =
    "w-full rounded-xl border bg-zinc-900 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500";
  const border = (f: string) => (low(f) ? "border-amber-500/70" : "border-zinc-700/70");

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Track a purchase</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paste an order confirmation. AI reads it — you just confirm.
        </p>
      </div>

      {!parsed ? (
        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Paste the full text of your order confirmation email here…"
            className="w-full rounded-2xl border border-zinc-700/70 bg-zinc-900 p-5 text-sm leading-relaxed outline-none transition focus:border-emerald-500"
          />
          <button
            onClick={parse}
            disabled={busy || text.trim().length < 20}
            className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40"
          >
            {busy ? "Reading your receipt…" : "Read receipt"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-3xl border border-zinc-800/70 bg-zinc-900/60 p-6">
          <p className="text-sm text-zinc-400">
            Confirm the details.{" "}
            {Object.values(parsed.confidence ?? {}).some((c) => c < 0.8) && (
              <span className="text-amber-300">Amber fields need a second look.</span>
            )}
          </p>
          {(
            [
              ["productName", "Product", "text"],
              ["orderId", "Order number", "text"],
              ["purchasePrice", "Price paid (USD)", "number"],
              ["purchaseDate", "Purchase date", "date"],
              ["returnDeadline", "Return deadline", "date"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1.5 block text-zinc-500">{label}</span>
              <input
                type={type}
                value={(parsed[key as keyof Parsed] as string | number | null) ?? ""}
                onChange={(e) =>
                  setParsed({
                    ...parsed,
                    [key]: type === "number" ? Number(e.target.value) : e.target.value,
                  })
                }
                className={`${field} ${border(key)}`}
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="mb-1.5 block text-zinc-500">Your email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`${field} border-zinc-700/70`}
            />
          </label>
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={save}
              disabled={busy || !email.includes("@")}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Start watching this price"}
            </button>
            <button
              onClick={() => setParsed(null)}
              className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
            >
              Start over
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </main>
  );
}
