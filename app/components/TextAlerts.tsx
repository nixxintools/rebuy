"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import { GRADIENT } from "@/lib/theme";

type State = { available: boolean; phone: string | null; optedOut: boolean };

export default function TextAlerts() {
  const [state, setState] = useState<State | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      if (r.ok) setState(await r.json());
    } catch {
      // A dashboard shouldn't break because this one card couldn't load.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Nothing to offer until the number is switched on in the environment.
  if (!state?.available) return null;

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: input }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't save that number.");
      setState({ available: true, phone: j.phone, optedOut: false });
      setInput("");
      setNote("Saved. Send yourself a test to check it arrives.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await fetch("/api/notifications/test", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't send the text.");
      setNote(
        j.protocol
          ? `Sent over ${j.protocol}. It should arrive in a few seconds.`
          : "Sent. It should arrive in a few seconds."
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      setState({ available: true, phone: null, optedOut: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1.5 }}>
          <Avatar sx={{ background: GRADIENT, width: 44, height: 44 }}>
            <ChatBubbleOutlineIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Get a text when the agent acts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The whole point is that you&apos;re not watching. A text tells you the moment money
              moves — and exactly what is still yours to do.
            </Typography>
          </Box>
        </Stack>

        {state.optedOut && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You replied STOP, so nothing is being sent. Save your number again to turn texts back on.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {note && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {note}
          </Alert>
        )}

        {state.phone && !state.optedOut ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography sx={{ flex: 1, fontWeight: 500 }}>Texting {state.phone}</Typography>
            <Button onClick={test} disabled={busy} variant="outlined">
              Send me a test
            </Button>
            <Button onClick={remove} disabled={busy} color="inherit">
              Remove
            </Button>
          </Stack>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              label="Mobile number"
              placeholder="+1 206 261 9826"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input && save()}
            />
            <Button
              onClick={save}
              disabled={busy || !input}
              variant="contained"
              sx={{ background: GRADIENT, flexShrink: 0 }}
            >
              Save
            </Button>
          </Stack>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Only price drops the agent acted on, and failures. Reply STATUS for where things stand,
          STOP to end it.
        </Typography>
      </CardContent>
    </Card>
  );
}
