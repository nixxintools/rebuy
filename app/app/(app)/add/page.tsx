"use client";
import { useEffect, useRef, useState } from "react";
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
import MenuItem from "@mui/material/MenuItem";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import LinearProgress from "@mui/material/LinearProgress";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
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

type Variant = { id: string; title: string; price: number; available: boolean };
type Product = {
  handle: string;
  title: string;
  price: number;
  image: string | null;
  variantId: string;
  variants: Variant[];
};

type MerchantSummary = {
  id: string;
  name: string;
  category: string;
  policy: { windowDays: number; feeUsd: number | null; cost: string; policyUrl: string; confidence: string };
};

const STEPS = ["Paste receipt", "Check the details", "Pick the exact product"];

export default function AddReceipt() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [merchantId, setMerchantId] = useState("anker");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "empty" | "unavailable" | "ok">("idle");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [matches, setMatches] = useState<Product[]>([]);
  const [chosen, setChosen] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState<string>("");
  const [query, setQuery] = useState("");
  const searchSeq = useRef(0);

  useEffect(() => {
    fetch("/api/merchants/search?q=")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.merchants && setMerchants(j.merchants))
      .catch(() => {});
  }, []);

  const merchant = merchants.find((m) => m.id === merchantId);
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
      if (!r.ok) throw new Error(j.error ?? "We couldn't read that receipt.");
      setParsed(j);
      setQuery(j.productName ?? "");
      await search(j.productName ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Responses can land out of order; only the newest search is allowed to win.
  async function search(q: string) {
    if (!q.trim()) return;
    const seq = ++searchSeq.current;
    setSearchState("loading");
    try {
      const r = await fetch(
        `/api/merchants/search?merchant=${merchantId}&q=${encodeURIComponent(q)}`
      );
      const j = await r.json().catch(() => ({}));
      if (seq !== searchSeq.current) return;
      if (!r.ok) {
        setMatches([]);
        setSearchState(j.unavailable ? "unavailable" : "empty");
        return;
      }
      const products: Product[] = j.products ?? [];
      setMatches(products);
      setSearchState(products.length ? "ok" : "empty");
    } catch {
      if (seq === searchSeq.current) setSearchState("unavailable");
    }
  }

  function pick(p: Product) {
    setChosen(p);
    setVariantId(p.variantId);
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
          variantId: variantId || chosen.variantId,
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
  const selectedVariant = chosen?.variants.find((v) => v.id === variantId);
  const effectivePrice = selectedVariant?.price ?? chosen?.price ?? 0;
  const gap = parsed ? Number(parsed.purchasePrice) - effectivePrice : 0;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h2" sx={{ fontSize: "1.9rem" }}>
          Track a purchase
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Paste the order confirmation — we read it, then link it to the store&apos;s live price.
        </Typography>
      </Box>

      <Stepper activeStep={step} alternativeLabel>
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
            <TextField
              select
              fullWidth
              label="Where did you buy it?"
              value={merchantId}
              onChange={(e) => {
                setMerchantId(e.target.value);
                setMatches([]);
                setChosen(null);
                setSearchState("idle");
              }}
              sx={{ mb: 1.5 }}
            >
              {merchants.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name} — {m.policy.windowDays} day return window
                </MenuItem>
              ))}
            </TextField>
            {merchant && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {merchant.name} gives you{" "}
                <b>{merchant.policy.windowDays} days</b> to return, which is how long Rebuy has to
                catch a price drop.{" "}
                {merchant.policy.feeUsd
                  ? `Returns cost $${merchant.policy.feeUsd.toFixed(2)}.`
                  : merchant.policy.cost === "free"
                    ? "Returns are free."
                    : "You pay return shipping."}{" "}
                <a href={merchant.policy.policyUrl} target="_blank" rel="noreferrer">
                  Their policy
                </a>
              </Typography>
            )}

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
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
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
                  helperText={lowConfidence("orderId") ? "Worth double-checking." : " "}
                />
                <TextField
                  label="Price you paid"
                  type="number"
                  fullWidth
                  value={parsed.purchasePrice}
                  onChange={(e) => setParsed({ ...parsed, purchasePrice: Number(e.target.value) })}
                  error={lowConfidence("purchasePrice")}
                  helperText={lowConfidence("purchasePrice") ? "Worth double-checking." : " "}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
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
                    helperText={
                      parsed.returnDeadline
                        ? "From your receipt."
                        : merchant
                          ? `Blank — we'll use ${merchant.name}'s published ${merchant.policy.windowDays} days.`
                          : "Blank — we'll use the store's published window."
                    }
                  />
                </Stack>
                {!parsed.returnDeadline && (
                  <Alert severity="warning">
                    Your receipt didn&apos;t state a return deadline. This date decides when Rebuy is
                    allowed to spend, so if you know the real one, set it here.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Which exact product is it?
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, mb: 2.5 }}>
                Rebuy will buy exactly what you choose here, so pick the right size and colour.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  fullWidth
                  size="small"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search(query)}
                  placeholder="Search the store"
                />
                <Button variant="outlined" onClick={() => search(query)} disabled={searchState === "loading"}>
                  Search
                </Button>
              </Stack>

              {searchState === "loading" && <LinearProgress sx={{ mt: 2 }} />}
              {searchState === "unavailable" && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <AlertTitle>{merchant?.name ?? "That store"} isn&apos;t responding</AlertTitle>
                  This is a problem at their end, not with your search. Try again in a moment.
                </Alert>
              )}
              {searchState === "empty" && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No products matched &ldquo;{query}&rdquo;. Try a shorter search — just the model name
                  usually works best.
                </Alert>
              )}

              <List sx={{ mt: 1 }}>
                {matches.map((p) => (
                  <ListItemButton
                    key={p.handle}
                    selected={chosen?.handle === p.handle}
                    onClick={() => pick(p)}
                    sx={{
                      borderRadius: 3, mb: 1, border: "1px solid",
                      borderColor: chosen?.handle === p.handle ? "primary.main" : "divider",
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar src={p.image ?? undefined} variant="rounded" sx={{ bgcolor: "#f3f4f6" }} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={p.title}
                      secondary={p.variants.length > 1 ? `${p.variants.length} options` : "live price"}
                      slotProps={{ primary: { noWrap: true } }}
                    />
                    <Typography sx={{ fontWeight: 700, ml: 2 }}>${p.price.toFixed(2)}</Typography>
                    {chosen?.handle === p.handle && <CheckCircleIcon color="primary" sx={{ ml: 1.5 }} />}
                  </ListItemButton>
                ))}
              </List>

              {chosen && chosen.variants.length > 1 && (
                <TextField
                  select
                  fullWidth
                  label="Which option did you buy?"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  sx={{ mt: 1 }}
                >
                  {chosen.variants.map((v) => (
                    <MenuItem key={v.id} value={v.id} disabled={!v.available}>
                      {v.title} — ${v.price.toFixed(2)}
                      {v.available ? "" : " (sold out)"}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </CardContent>
          </Card>

          {chosen && gap > 0 && (
            <Alert severity="success">
              It&apos;s ${effectivePrice.toFixed(2)} right now — ${gap.toFixed(2)} below what you paid.
              Rebuy can act on that as soon as you approve it.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
            <Button
              variant="contained"
              size="large"
              onClick={save}
              disabled={!!busy || !chosen}
              sx={{ background: GRADIENT }}
            >
              {busy ?? "Save this purchase"}
            </Button>
            {!chosen && (
              <Chip label="Choose the exact product first" size="small" variant="outlined" />
            )}
            <Button
              onClick={() => {
                setParsed(null);
                setMatches([]);
                setChosen(null);
                setSearchState("idle");
              }}
              sx={{ color: "text.secondary" }}
            >
              Start over
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}
