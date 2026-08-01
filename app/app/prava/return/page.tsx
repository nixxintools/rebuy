"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ReturnInner() {
  const router = useRouter();
  const search = useSearchParams();
  const itemId = search.get("item");
  const [status, setStatus] = useState("Confirming your authorization with Prava…");

  useEffect(() => {
    if (!itemId) {
      setStatus("Missing item reference.");
      return;
    }
    let tries = 0;
    const attempt = async () => {
      tries++;
      const r = await fetch(`/api/items/${itemId}/confirm-mandate`, { method: "POST" });
      if (r.ok) {
        setStatus("Authorized! Your agent is now monitoring the price.");
        setTimeout(() => router.push(`/items/${itemId}`), 1200);
      } else if (tries < 5) {
        setStatus(`Waiting for Prava to activate the mandate… (attempt ${tries}/5)`);
        setTimeout(attempt, 2500);
      } else {
        setStatus("Couldn't confirm yet — open the item and press “I completed the approval”.");
        setTimeout(() => router.push(`/items/${itemId}`), 2500);
      }
    };
    attempt();
  }, [itemId, router]);

  return (
    <main className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      <p className="text-zinc-300">{status}</p>
    </main>
  );
}

export default function PravaReturn() {
  return (
    <Suspense>
      <ReturnInner />
    </Suspense>
  );
}
