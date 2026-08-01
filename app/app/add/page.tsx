"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Parsed = {
  orderId: string;
  productName: string;
  purchasePrice: number;
  purchaseDate: string;
  retailer: string;
  returnDeadline: string | null;
  confidence: Record<string, number>;
};

type Product = {
  handle: string;
  title: string;
  price: number;
  image: string | null;
  url: string;
};

const MERCHANTS = [
  { id: "anker", name: "Anker", category: "Electronics" },
  { id: "allbirds", name: "Allbirds", category: "Apparel" },
  { id: "brooklinen", name: "Brooklinen", category: "Home goods" },
];

export default function AddReceipt() {
  const router = useRouter();
  const [merchantId, setMerchantId] = useState("anker");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [matches, setMatches] = useState<Product[] | null>(null);
  const [chosen, setChosen] = useState<Product | null>(null);

  async function parse() {
    setBusy("Reading your receipt…");
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
      setBusy("Finding it in the store…");
      const s = await fetch(
        `/api/merchants/search?merchant=${merchantId}&q=${encodeURIComponent(j.productName)}`
      );
      const sj = await s.json();
      setMatches(sj.products ?? []);
      setChosen((sj.products ?? [])[0] ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function research(q: string) {
    setBusy("Searching…");
    const s = await fetch(
      `/api/merchants/search?merchant=${merchantId}&q=${encodeURIComponent(q)}`
    );
    const sj = await s.json();
    setMatches(sj.products ?? []);
    setBusy(null);
  }

  async function save() {
    if (!parsed || !chosen) return;
    setBusy("Saving…");
    setError(null);
    try {
      const r = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed,
          merchantId,
          productHandle: chosen.handle,
          userEmail: email,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Save failed");
      router.push(`/items/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const low = (f: string) => (parsed?.confidence?.[f] ?? 1) < 0.8;
  const field =
    "w-full rounded-xl border bg-zinc-900 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500";

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Track a purchase</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paste an order confirmation. AI reads it, then we link it to the store&apos;s live price.
        </p>
      </div>

      {!parsed ? (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm text-zinc-400">Where did you buy it?</p>
            <div className="flex flex-wrap gap-2">
              {MERCHANTS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMerchantId(m.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    merchantId === m.id
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {m.name}
                  <span className="ml-2 text-xs text-zinc-500">{m.category}</span>
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Paste the full text of your order confirmation email here…"
            className="w-full rounded-2xl border border-zinc-700/70 bg-zinc-900 p-5 text-sm leading-relaxed outline-none transition focus:border-emerald-500"
          />
          <button
            onClick={parse}
            disabled={!!busy || text.trim().length < 20}
            className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40"
          >
            {busy ?? "Read receipt"}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="space-y-4 rounded-3xl border border-zinc-800/70 bg-zinc-900/60 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
              What the AI read
            </h2>
            {(
              [
                ["orderId", "Order number", "text"],
                ["purchasePrice", "Price you paid (USD)", "number"],
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
                  className={`${field} ${low(key) ? "border-amber-500/70" : "border-zinc-700/70"}`}
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
          </section>

          <section className="rounded-3xl border border-zinc-800/70 bg-zinc-900/60 p-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
              Which product is it?
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Picked from {MERCHANTS.find((m) => m.id === merchantId)?.name}&apos;s live
              catalogue — this is what we track the price of.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                defaultValue={parsed.productName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") research((e.target as HTMLInputElement).value);
                }}
                placeholder="Search the store…"
                className={`${field} border-zinc-700/70`}
              />
              <button
                onClick={(e) =>
                  research(
                    (e.currentTarget.previousElementSibling as HTMLInputElement).value
                  )
                }
                className="shrink-0 rounded-xl border border-zinc-700 px-4 text-sm text-zinc-300 hover:border-zinc-500"
              >
                Search
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {(matches ?? []).map((p) => (
                <li key={p.handle}>
                  <button
                    onClick={() => setChosen(p)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      chosen?.handle === p.handle
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="h-11 w-11 rounded-lg object-cover" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.title}</span>
                      <span className="text-xs text-zinc-500">live price</span>
                    </span>
                    <span className="font-semibold">${p.price.toFixed(2)}</span>
                  </button>
                </li>
              ))}
              {matches?.length === 0 && (
                <li className="text-sm text-zinc-500">
                  No matches — try a shorter search, like a model name.
                </li>
              )}
            </ul>
          </section>

          {chosen && parsed.purchasePrice > chosen.price && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              Heads up: it&apos;s selling for ${chosen.price.toFixed(2)} right now — $
              {(parsed.purchasePrice - chosen.price).toFixed(2)} below what you paid. Your agent
              can act on that as soon as you authorize it.
            </p>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={save}
              disabled={!!busy || !email.includes("@") || !chosen}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40"
            >
              {busy ?? "Start watching this price"}
            </button>
            <button
              onClick={() => {
                setParsed(null);
                setMatches(null);
                setChosen(null);
              }}
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
