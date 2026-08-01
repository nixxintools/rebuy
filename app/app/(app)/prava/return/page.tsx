"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

function ReturnInner() {
  const router = useRouter();
  const search = useSearchParams();
  const itemId = search.get("item");
  const [status, setStatus] = useState("Confirming your authorization…");
  const [done, setDone] = useState(false);

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
        setDone(true);
        setStatus("All set — Rebuy is watching the price now.");
        setTimeout(() => router.push(`/items/${itemId}`), 1200);
      } else if (tries < 5) {
        setStatus(`Waiting for the approval to register… (${tries}/5)`);
        setTimeout(attempt, 2500);
      } else {
        setStatus("Couldn't confirm yet — opening your item so you can retry.");
        setTimeout(() => router.push(`/items/${itemId}`), 2200);
      }
    };
    attempt();
  }, [itemId, router]);

  return (
    <Card sx={{ maxWidth: 440, mx: "auto" }}>
      <CardContent sx={{ p: 6 }}>
        <Stack spacing={3} sx={{ alignItems: "center" }}>
          {done ? (
            <CheckCircleIcon sx={{ fontSize: 56, color: "success.main" }} />
          ) : (
            <CircularProgress />
          )}
          <Typography sx={{ textAlign: "center" }} color="text.secondary">
            {status}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PravaReturn() {
  return (
    <Suspense>
      <ReturnInner />
    </Suspense>
  );
}
