"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import { Logo } from "@/components/Logo";
import { GRADIENT } from "@/lib/theme";

function LoginCard() {
  const search = useSearchParams();
  const expired = search.get("error") === "expired";

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not send the link.");
      setSent(true);
      setDevUrl(j.devUrl ?? null);
      setDelivered(Boolean(j.delivered));
      setCooldown(30);
      const timer = setInterval(
        () => setCooldown((c) => (c <= 1 ? (clearInterval(timer), 0) : c - 1)),
        1000
      );
    } catch (err) {
      setError((err as Error).message);
      setSent(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card sx={{ width: "100%", maxWidth: 440 }}>
      {sending && <LinearProgress />}
      <CardContent sx={{ p: { xs: 3.5, sm: 5 } }}>
        <Stack spacing={2} sx={{ alignItems: "center", mb: 3 }}>
          <Logo size={44} />
          <Typography variant="h3" sx={{ textAlign: "center" }}>
            {sent ? "Check your email" : "Sign in to Rebuy"}
          </Typography>
        </Stack>

        {expired && !sent && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            That sign-in link has expired or was already used. Request a fresh one below.
          </Alert>
        )}

        {sent ? (
          <Stack spacing={2.5} sx={{ alignItems: "center" }}>
            <MarkEmailReadIcon sx={{ fontSize: 52, color: "secondary.main" }} />
            <Typography sx={{ textAlign: "center" }} color="text.secondary">
              We sent a sign-in link to <b style={{ color: "#111827" }}>{email}</b>. Open it on this
              device — it works once and expires in 15 minutes.
            </Typography>

            {devUrl && (
              <Alert severity="info" sx={{ width: "100%" }}>
                Email delivery isn&apos;t configured yet, so here&apos;s your link directly:
                <Button
                  href={devUrl}
                  fullWidth
                  variant="contained"
                  sx={{ mt: 1.5, background: GRADIENT }}
                >
                  Open sign-in link
                </Button>
              </Alert>
            )}

            {!delivered && !devUrl && (
              <Alert severity="warning" sx={{ width: "100%" }}>
                We couldn&apos;t deliver the email. Check the address and try again.
              </Alert>
            )}
            <Button
              onClick={() => submit()}
              disabled={cooldown > 0 || sending}
              size="small"
              sx={{ color: "text.secondary" }}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend the link"}
            </Button>
          </Stack>
        ) : (
          <form onSubmit={submit}>
            <Stack spacing={2.5}>
              <TextField
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                fullWidth
                required
                autoFocus
                autoComplete="email"
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={sending || !email.includes("@")}
                sx={{ background: GRADIENT }}
              >
                {sending ? "Sending…" : "Email me a sign-in link"}
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                No password needed. We&apos;ll email you a link that signs you straight in.
              </Typography>
            </Stack>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 12,
        background: "radial-gradient(circle at 50% 0%, rgba(37,99,235,0.10), transparent 55%)",
      }}
    >
      <Suspense>
        <LoginCard />
      </Suspense>
    </Box>
  );
}
