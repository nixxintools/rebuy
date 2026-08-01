"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function FeeReturn() {
  const router = useRouter();
  const [status, setStatus] = useState("Confirming your billing authorization…");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let tries = 0;
    const attempt = async () => {
      tries++;
      const r = await fetch("/api/billing/confirm", { method: "POST" });
      if (r.ok) {
        setDone(true);
        setStatus("All set — we'll only bill on savings you've actually banked.");
        setTimeout(() => router.push("/payments"), 1400);
      } else if (tries < 5) {
        setStatus(`Waiting for the approval to register… (${tries}/5)`);
        setTimeout(attempt, 2500);
      } else {
        setStatus("Couldn't confirm yet — opening your payments page so you can retry.");
        setTimeout(() => router.push("/payments"), 2200);
      }
    };
    attempt();
  }, [router]);

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
