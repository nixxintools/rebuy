"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import InputAdornment from "@mui/material/InputAdornment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { GRADIENT } from "@/lib/theme";

type Parsed = {
  orderId: string;
  productName: string;
  purchasePrice: number;
  purchaseDate: string;
  returnDeadline: string | null;
  confidence: Record<string, number>;
};

type Product = { handle: string; title: string; price: number; image: string | null; url: string };

const MERCHANTS = [
  { id: "anker", name: "Anker", category: "Electronics" },
  { id: "allbirds", name: "Allbirds", category: "Apparel" },
  { id: "brooklinen", name: "Brooklinen", category: "Home goods" },
];

const STEPS = ["Paste receipt", "Check details", "Pick the product"];

export default function AddReceipt() {
  const router = useRouter();
  const [merchantId, setMerchantId] = useState("anker");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [matches, setMatches] = useState<Product[] | null>(null);
  const [chosen, setChosen] = useState<Product | null>(null);
  const [query, setQuery] = useState("");

  const step = !parsed ? 0 : !chosen ? 1 : 2;

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
      setQuery(j.productName);
      setBusy("Finding it in the store…");
      await search(j.productName);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function search(q: string) {
    const s = await fetch(
      `/api/merchants/search?merchant=${merchantId}&q=${encodeURIComponent(q)}`
    );
    const sj = await s.json();
    setMatches(sj.products ?? []);
    setChosen((sj.products ?? [])[0] ?? null);
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
          merchantId,
          productHandle: chosen.handle,
          orderId: parsed.orderId,
          purchasePrice: Number(parsed.purchasePrice),
          purchaseDate: parsed.purchaseDate,
          returnDeadline: parsed.returnDeadline,
          confidence: parsed.confidence,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save this purchase.");
      router.push(`/items/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const lowConfidence = (f: string) => (parsed?.confidence?.[f] ?? 1) < 0.8;
  const gap = chosen && parsed ? Number(parsed.purchasePrice) - chosen.price : 0;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h2" sx={{ fontSize: "1.9rem" }}>
          Track a purchase
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Paste the order confirmation — we read it and link it to the live store price.
        </Typography>
      </Box>

      <Stepper activeStep={step} alternativeLabel sx={{ mb: 1 }}>
        {STEPS.map((s) => (
          <Step key={s}>
            <StepLabel>{s}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {!parsed ? (
        <Card>
          {busy && <LinearProgress />}
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography sx={{ mb: 1.5, fontWeight: 500 }}>Where did you buy it?</Typography>
            <ToggleButtonGroup
              exclusive
              value={merchantId}
              onChange={(_, v) => v && setMerchantId(v)}
              sx={{ mb: 3, flexWrap: "wrap", gap: 1, "& .MuiToggleButton-root": { borderRadius: "999px !important", border: "1px solid #e5e7eb !important", px: 2.5 } }}
            >
              {MERCHANTS.map((m) => (
                <ToggleButton key={m.id} value={m.id}>
                  {m.name}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    {m.category}
                  </Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <TextField
              label="Order confirmation email"
              multiline
              minRows={9}
              fullWidth
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the whole email here — we'll pull out what matters."
            />
            <Button
              onClick={parse}
              variant="contained"
              size="large"
              disabled={!!busy || text.trim().length < 20}
              sx={{ mt: 3, background: GRADIENT }}
            >
              {busy ?? "Read receipt"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2.5 }}>
                What we read
              </Typography>
              <Stack spacing={2.5}>
                <TextField
                  label="Order number"
                  fullWidth
                  value={parsed.orderId}
                  onChange={(e) => setParsed({ ...parsed, orderId: e.target.value })}
                  error={lowConfidence("orderId")}
                  helperText={lowConfidence("orderId") ? "Please double-check this one." : " "}
                />
                <TextField
                  label="Price you paid"
                  type="number"
                  fullWidth
                  value={parsed.purchasePrice}
                  onChange={(e) => setParsed({ ...parsed, purchasePrice: Number(e.target.value) })}
                  error={lowConfidence("purchasePrice")}
                  helperText={lowConfidence("purchasePrice") ? "Please double-check this one." : " "}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                  }}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Purchase date"
                    type="date"
                    fullWidth
                    value={parsed.purchaseDate ?? ""}
                    onChange={(e) => setParsed({ ...parsed, purchaseDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="Return deadline"
                    type="date"
                    fullWidth
                    value={parsed.returnDeadline ?? ""}
                    onChange={(e) => setParsed({ ...parsed, returnDeadline: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    helperText="Defaults to 30 days after purchase"
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Which product is it?
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, mb: 2.5 }}>
                Picked from {MERCHANTS.find((m) => m.id === merchantId)?.name}&apos;s live catalogue —
                this is the price we&apos;ll watch.
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  fullWidth
                  size="small"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search(query)}
                  placeholder="Search the store"
                />
                <Button variant="outlined" onClick={() => search(query)}>
                  Search
                </Button>
              </Stack>

              <List sx={{ mt: 1 }}>
                {(matches ?? []).map((p) => (
                  <ListItemButton
                    key={p.handle}
                    selected={chosen?.handle === p.handle}
                    onClick={() => setChosen(p)}
                    sx={{
                      borderRadius: 3,
                      mb: 1,
                      border: "1px solid",
                      borderColor: chosen?.handle === p.handle ? "primary.main" : "divider",
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar src={p.image ?? undefined} variant="rounded" sx={{ bgcolor: "#f3f4f6" }} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={p.title}
                      secondary="live price"
                      slotProps={{ primary: { noWrap: true } }}
                    />
                    <Typography sx={{ fontWeight: 700, ml: 2 }}>${p.price.toFixed(2)}</Typography>
                    {chosen?.handle === p.handle && (
                      <CheckCircleIcon color="primary" sx={{ ml: 1.5 }} />
                    )}
                  </ListItemButton>
                ))}
                {matches?.length === 0 && (
                  <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                    No matches — try a shorter search, like just the model name.
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>

          {gap > 0 && (
            <Alert severity="success">
              It&apos;s selling for ${chosen!.price.toFixed(2)} right now — ${gap.toFixed(2)} below
              what you paid. Rebuy can act on that as soon as you switch it on.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Button
              variant="contained"
              size="large"
              onClick={save}
              disabled={!!busy || !chosen}
              sx={{ background: GRADIENT }}
            >
              {busy ?? "Start watching this price"}
            </Button>
            <Button
              onClick={() => {
                setParsed(null);
                setMatches(null);
                setChosen(null);
              }}
              sx={{ color: "text.secondary" }}
            >
              Start over
            </Button>
          </Stack>
        </>
      )}
      {error && !parsed && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
