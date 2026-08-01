"use client";
import { use, useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PaymentsIcon from "@mui/icons-material/Payments";
import ReplayIcon from "@mui/icons-material/Replay";
import ScheduleIcon from "@mui/icons-material/Schedule";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { GRADIENT } from "@/lib/theme";
import StatusChip from "@/components/StatusChip";

type Ev = { id: string; type: string; detail: unknown; at: string };
type ItemDetail = {
  id: string;
  productName: string;
  retailerName: string;
  retailerUrl: string;
  orderId: string;
  purchasePrice: string;
  currentPrice: string;
  rebuyPrice: string | null;
  returnDeadline: string;
  status: string;
  mandateId: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  variantId: string | null;
  events: Ev[];
};

const EVENT_COPY: Record<string, string> = {
  item_ingested: "Receipt read and purchase registered",
  mandate_setup_session_created: "Secure authorization session opened",
  mandate_active: "You approved the agent — authorization active",
  drop_detected: "Price drop detected inside the return window",
  rebuy_started: "Agent started the repurchase",
  mandate_charge: "Charged your authorization and issued a single-use card",
  charge_reported: "Purchase outcome reported to the card network",
  rebuy_complete: "Repurchase complete — savings locked in",
  rebuy_failed: "Repurchase blocked by the guardrails",
  mandate_cancelled: "Authorization revoked",
};

const FLOW = ["Receipt", "Switched on", "Watching", "Dropped", "Rebought"];

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const refresh = useCallback(() => {
    fetch(`/api/items/${id}`)
      .then((r) => r.json())
      .then(setItem);
  }, [id]);
  useEffect(refresh, [refresh]);

  if (!item) {
    return (
      <Stack spacing={2.5}>
        <Skeleton variant="text" width="60%" height={44} />
        <Skeleton variant="rounded" height={110} />
        <Skeleton variant="rounded" height={180} />
      </Stack>
    );
  }

  const paid = Number(item.purchasePrice);
  const now = Number(item.currentPrice);
  const saved = item.rebuyPrice ? paid - Number(item.rebuyPrice) : 0;
  const fee = saved * 0.15;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(item.returnDeadline).getTime() - Date.now()) / 86400000)
  );
  const active =
    item.status === "ingested" || item.status === "authorizing"
      ? 1
      : item.status === "monitoring"
        ? 2
        : item.status === "drop_detected"
          ? 3
          : item.status === "return_ready"
            ? 4
            : 2;

  async function call(path: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "That didn't work — try again.");
      return j;
    } catch (e) {
      setMsg((e as Error).message);
      return null;
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function authorize() {
    const j = await call(`/api/items/${item!.id}/authorize`);
    if (j?.iframeUrl) window.location.href = j.iframeUrl;
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2.5} sx={{ alignItems: "center" }}>
        <Avatar
          src={item.imageUrl ?? undefined}
          variant="rounded"
          sx={{ width: 68, height: 68, bgcolor: "#f3f4f6" }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" sx={{ fontSize: "1.5rem", lineHeight: 1.25 }}>
            {item.productName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {item.retailerName} · Order {item.orderId} · {daysLeft} days left to return
          </Typography>
        </Box>
      </Stack>

      {!["revoked", "expired"].includes(item.status) && (
        <Stepper activeStep={active} alternativeLabel>
          {FLOW.map((s) => (
            <Step key={s}>
              <StepLabel>{s}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      <Card>
        <Grid container>
          {[
            { label: "You paid", value: `$${paid.toFixed(2)}` },
            { label: "Price now", value: `$${now.toFixed(2)}`, good: now < paid },
            { label: "Saved", value: `$${saved.toFixed(2)}`, good: saved > 0 },
          ].map((s, i) => (
            <Grid size={4} key={s.label} sx={{ borderLeft: i ? "1px solid" : "none", borderColor: "divider" }}>
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="body2" color="text.secondary">
                  {s.label}
                </Typography>
                <Typography
                  sx={{ fontSize: { xs: "1.35rem", sm: "1.6rem" }, fontWeight: 700, color: s.good ? "success.main" : "text.primary" }}
                >
                  {s.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Card>

      {["ingested", "authorizing"].includes(item.status) && (
        <Card sx={{ borderColor: "primary.main" }}>
          {busy && <LinearProgress />}
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {item.status === "ingested" ? "Switch on your agent" : "Finish switching it on"}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
              Approve once with your fingerprint. From then on Rebuy can repurchase{" "}
              <b>this item only</b>, from <b>{item.retailerName} only</b>, for at most{" "}
              <b>${paid.toFixed(2)}</b>, once, within <b>7 days</b>. That ceiling is enforced by the
              card network — not by us.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", mt: 3 }}>
              <Button variant="contained" size="large" onClick={authorize} disabled={busy} sx={{ background: GRADIENT }}>
                {busy ? "Opening…" : "Approve with Prava"}
              </Button>
              {item.status === "authorizing" && (
                <Button onClick={() => call(`/api/items/${item.id}/confirm-mandate`)} disabled={busy} sx={{ color: "text.secondary" }}>
                  I already approved
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {item.mandateId && item.status !== "revoked" && (
        <Card>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                What Rebuy is allowed to do
              </Typography>
              <Chip
                icon={<FingerprintIcon />}
                label="Passkey-approved"
                color="success"
                variant="outlined"
                size="small"
              />
            </Stack>
            <List dense>
              {[
                { icon: <StorefrontIcon />, primary: `${item.retailerName} only`, secondary: "Merchant it can spend at" },
                { icon: <PaymentsIcon />, primary: `$${paid.toFixed(2)} maximum`, secondary: "Enforced by the card network" },
                { icon: <ReplayIcon />, primary: "One purchase", secondary: "Then the authorization is spent" },
                { icon: <ScheduleIcon />, primary: "Expires in 7 days", secondary: "Lapses on its own if unused" },
              ].map((g) => (
                <ListItem key={g.primary} disableGutters>
                  <ListItemIcon sx={{ color: "primary.main", minWidth: 42 }}>{g.icon}</ListItemIcon>
                  <ListItemText
                    primary={g.primary}
                    secondary={g.secondary}
                    slotProps={{ primary: { sx: { fontWeight: 500 } } }}
                  />
                </ListItem>
              ))}
            </List>
            {["monitoring", "drop_detected"].includes(item.status) && (
              <Button color="error" onClick={() => setConfirmRevoke(true)} disabled={busy} sx={{ mt: 1 }}>
                Revoke access
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {item.status === "monitoring" && (
        <Card>
          {busy && <LinearProgress />}
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Price watch
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
              Rebuy buys when the live price falls at least $1 or 2% below what you paid, with more
              than five days left to return the original.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", mt: 3 }}>
              <Button variant="contained" onClick={() => call(`/api/items/${item.id}/price`)} disabled={busy} sx={{ background: GRADIENT }}>
                {busy ? "Checking the store…" : "Check price now"}
              </Button>
              {item.productUrl && (
                <Button href={item.productUrl} target="_blank" endIcon={<OpenInNewIcon />} sx={{ color: "text.secondary" }}>
                  View at {item.retailerName}
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {item.status === "return_ready" && (
        <Card sx={{ borderColor: "success.main", bgcolor: "rgba(22,163,74,0.04)" }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: "success.dark" }}>
              Rebought at ${Number(item.rebuyPrice).toFixed(2)} — one thing left to do
            </Typography>
            <Grid container spacing={3} sx={{ mt: 0.5, mb: 1 }}>
              {[
                { label: "You keep", value: `$${(saved - fee).toFixed(2)}`, good: true },
                { label: "Our 15% share", value: `$${fee.toFixed(2)}` },
                {
                  label: "Ship return by",
                  value: new Date(new Date(item.returnDeadline).getTime() - 2 * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                },
              ].map((s) => (
                <Grid size={{ xs: 12, sm: 4 }} key={s.label}>
                  <Typography variant="body2" color="text.secondary">
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: s.good ? "success.main" : "text.primary" }}>
                    {s.value}
                  </Typography>
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="contained"
                color="success"
                href={`${item.retailerUrl}/account`}
                target="_blank"
                endIcon={<OpenInNewIcon />}
              >
                Start the return
              </Button>
              {item.variantId && (
                <Button
                  variant="outlined"
                  href={`${item.retailerUrl}/cart/${item.variantId}:1`}
                  target="_blank"
                  endIcon={<OpenInNewIcon />}
                >
                  Open the new order
                </Button>
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Return the original — order {item.orderId}. Suggested reason: “Found a better price.”
            </Typography>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            Activity
          </Typography>
          <Stack spacing={0}>
            {item.events.map((e) => (
              <Accordion key={e.id} disableGutters elevation={0} sx={{ "&:before": { display: "none" }, borderBottom: "1px solid", borderColor: "divider" }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 500 }}>{EVENT_COPY[e.type] ?? e.type}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(e.at).toLocaleString()}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0 }}>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 2,
                      bgcolor: "#f9fafb",
                      borderRadius: 2,
                      fontSize: 12,
                      overflowX: "auto",
                      color: "text.secondary",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {JSON.stringify(e.detail, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {msg && <Alert severity="error">{msg}</Alert>}
      <Box sx={{ display: "flex", justifyContent: "center", pb: 2 }}>
        <StatusChip status={item.status} size="medium" />
      </Box>

      <Dialog open={confirmRevoke} onClose={() => setConfirmRevoke(false)}>
        <DialogTitle>Revoke Rebuy&apos;s access?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Rebuy will stop watching this purchase and can no longer spend anything on your behalf.
            You can set it up again at any time while the return window is open.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmRevoke(false)}>Keep it on</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmRevoke(false);
              call(`/api/items/${item.id}/revoke`);
            }}
          >
            Revoke access
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
