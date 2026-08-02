"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
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
import TextField from "@mui/material/TextField";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PaymentsIcon from "@mui/icons-material/Payments";
import ReplayIcon from "@mui/icons-material/Replay";
import ScheduleIcon from "@mui/icons-material/Schedule";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { GRADIENT } from "@/lib/theme";
import StatusChip from "@/components/StatusChip";
import { STATUS, statusMeta } from "@/lib/status";

type Ev = { id: string; type: string; detail: unknown; at: string };
type ItemDetail = {
  id: string;
  productName: string;
  variantTitle: string | null;
  retailerName: string;
  retailerUrl: string;
  orderId: string;
  purchasePrice: string;
  currentPrice: string;
  rebuyPrice: string | null;
  returnDeadline: string;
  returnWindowSource: string;
  returnCostUsd: string;
  status: string;
  mandateId: string | null;
  mandateExpiresAt: string | null;
  chargeTransactionId: string | null;
  merchantOrderRef: string | null;
  failureCode: string | null;
  lastCheckedAt: string | null;
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
  senso_policy_check: "Checked the merchant's verified return policy before spending",
  senso_outcome_recorded: "Recorded the outcome so future decisions are better informed",
  rebuy_started: "Agent started the repurchase",
  mandate_charge: "Charged your authorization and issued a single-use card",
  charge_reported: "Charge outcome reported to the card network",
  purchase_authorized: "Money reserved and single-use card issued",
  order_placed: "You confirmed the replacement was ordered",
  return_started: "You confirmed the original is on its way back",
  refund_confirmed: "You confirmed the refund arrived — saving banked",
  rebuy_failed: "Repurchase attempt did not go through",
  authorization_mismatch: "Stopped: the authorization didn't match this purchase",
  revocation_failed: "Could not confirm the authorization was cancelled",
  mandate_cancelled: "Authorization revoked",
};

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [orderRef, setOrderRef] = useState("");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/items/${id}`);
      if (!r.ok) {
        setLoadError(r.status === 404 ? "We couldn't find this purchase." : "Couldn't load this purchase.");
        return;
      }
      setItem(await r.json());
      setLoadError(null);
    } catch {
      setLoadError("Couldn't reach the server. Check your connection and try again.");
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The scheduled sweep runs daily, so an open page is the other moment we can
  // honestly claim to be watching. Only re-checks when the last check is stale,
  // and only while the user has actually authorized spending.
  const staleCheck = useRef(false);
  useEffect(() => {
    if (!item || staleCheck.current) return;
    if (item.status !== STATUS.monitoring) return;
    const age = item.lastCheckedAt ? Date.now() - new Date(item.lastCheckedAt).getTime() : Infinity;
    if (age < 6 * 3600 * 1000) return;
    staleCheck.current = true;
    fetch(`/api/items/${id}/price`, { method: "POST" }).then(() => refresh()).catch(() => {});
  }, [item, id, refresh]);

  if (loadError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={refresh}>
            Retry
          </Button>
        }
      >
        {loadError}
      </Alert>
    );
  }

  if (!item) {
    return (
      <Stack spacing={2.5}>
        <Skeleton variant="rounded" height={96} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={180} />
      </Stack>
    );
  }

  const meta = statusMeta(item.status);
  const paid = Number(item.purchasePrice);
  const now = Number(item.currentPrice);
  const returnCost = Number(item.returnCostUsd ?? 0);
  // What the user is actually up, after paying to send the original back.
  const gap = item.rebuyPrice ? paid - Number(item.rebuyPrice) - returnCost : 0;
  const banked = item.status === STATUS.refundConfirmed;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(item.returnDeadline).getTime() - Date.now()) / 86400000)
  );

  async function call(path: string, body?: unknown, label = "Working…") {
    setBusy(label);
    setMsg(null);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "That didn't work — please try again.");
      return j;
    } catch (e) {
      setMsg((e as Error).message);
      return null;
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  async function authorize() {
    const j = await call(`/api/items/${item!.id}/authorize`, undefined, "Opening secure session…");
    if (j?.iframeUrl) window.location.href = j.iframeUrl;
  }

  const needsBilling = item.status === STATUS.billingRequired;

  const toneSeverity = { error: "error", warning: "warning", success: "success", active: "info", neutral: "info" } as const;

  return (
    <Stack spacing={3}>
      {/* Who and what */}
      <Stack direction="row" spacing={2.5} sx={{ alignItems: "center" }}>
        <Avatar
          src={item.imageUrl ?? undefined}
          variant="rounded"
          sx={{ width: 64, height: 64, bgcolor: "#f3f4f6" }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem", lineHeight: 1.25 }}>
            {item.productName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {item.retailerName}
            {item.variantTitle ? ` · ${item.variantTitle}` : ""} · Order {item.orderId}
          </Typography>
        </Box>
      </Stack>

      {/* What's true right now, and what to do — the first thing on the page */}
      <Card sx={{ borderColor: meta.tone === "error" ? "error.main" : meta.tone === "warning" ? "warning.main" : "divider" }}>
        {busy && <LinearProgress />}
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <StatusChip status={item.status} size="medium" />
            <Typography variant="body2" color="text.secondary">
              {daysLeft} days left to return
            </Typography>
          </Stack>
          <Typography sx={{ lineHeight: 1.7 }}>{meta.meaning}</Typography>
          {meta.action && (
            <Typography sx={{ mt: 1, fontWeight: 500 }}>{meta.action}</Typography>
          )}

          {/* Primary action for the current state */}
          <Box sx={{ mt: 3 }}>
            {[STATUS.ingested, STATUS.authorizing, STATUS.authorizationExpired].includes(item.status as never) && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
                <Button variant="contained" onClick={authorize} disabled={!!busy} sx={{ background: GRADIENT }}>
                  {busy ?? "Approve with Prava"}
                </Button>
                {item.status === STATUS.authorizing && (
                  <Button onClick={() => call(`/api/items/${item.id}/confirm-mandate`, undefined, "Checking…")} disabled={!!busy} sx={{ color: "text.secondary" }}>
                    I already approved
                  </Button>
                )}
              </Stack>
            )}

            {item.status === STATUS.monitoring && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
                <Button
                  variant="contained"
                  onClick={() => call(`/api/items/${item.id}/price`, undefined, "Checking the store…")}
                  disabled={!!busy}
                  sx={{ background: GRADIENT }}
                >
                  {busy ?? "Check the price now"}
                </Button>
                {item.productUrl && (
                  <Button href={item.productUrl} target="_blank" endIcon={<OpenInNewIcon />} sx={{ color: "text.secondary" }}>
                    View at {item.retailerName}
                  </Button>
                )}
              </Stack>
            )}

            {item.status === STATUS.purchaseAuthorized && (
              <Stack spacing={2}>
                <Alert severity="warning">
                  <AlertTitle>No order exists yet</AlertTitle>
                  Rebuy reserved ${Number(item.rebuyPrice).toFixed(2)} and issued a single-use card, but
                  it cannot place the order for you. Buy the item at {item.retailerName} using that
                  card, then confirm below. <b>Don&apos;t return the original until you have.</b>
                </Alert>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  {item.variantId && (
                    <Button
                      variant="contained"
                      href={`${item.retailerUrl}/cart/${item.variantId}:1`}
                      target="_blank"
                      endIcon={<OpenInNewIcon />}
                      sx={{ background: GRADIENT }}
                    >
                      Open the cart at {item.retailerName}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    onClick={() => call(`/api/items/${item.id}/advance`, { to: STATUS.orderPlaced, merchantOrderRef: orderRef || null }, "Saving…")}
                    disabled={!!busy}
                  >
                    I&apos;ve placed the order
                  </Button>
                </Stack>
                <TextField
                  size="small"
                  label="Order number at the merchant (optional)"
                  value={orderRef}
                  onChange={(e) => setOrderRef(e.target.value)}
                  sx={{ maxWidth: 340 }}
                />
              </Stack>
            )}

            {item.status === STATUS.orderPlaced && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant="contained"
                  href={`${item.retailerUrl}/account`}
                  target="_blank"
                  endIcon={<OpenInNewIcon />}
                  sx={{ background: GRADIENT }}
                >
                  Start the return
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => call(`/api/items/${item.id}/advance`, { to: STATUS.returnStarted }, "Saving…")}
                  disabled={!!busy}
                >
                  I&apos;ve sent the original back
                </Button>
              </Stack>
            )}

            {item.status === STATUS.returnStarted && (
              <Button
                variant="contained"
                onClick={() => call(`/api/items/${item.id}/advance`, { to: STATUS.refundConfirmed }, "Saving…")}
                disabled={!!busy}
                sx={{ background: GRADIENT }}
              >
                My refund arrived
              </Button>
            )}

            {needsBilling && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant="contained"
                  href="/payments"
                  sx={{ background: GRADIENT }}
                >
                  Set up billing
                </Button>
                <Button href="/merchants" sx={{ color: "text.secondary" }}>
                  How our fee works
                </Button>
              </Stack>
            )}

            {item.status === STATUS.chargeFailed && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant="contained"
                  onClick={() => call(`/api/items/${item.id}/retry`, undefined, "Trying again…")}
                  disabled={!!busy}
                  sx={{ background: GRADIENT }}
                >
                  Try the purchase again
                </Button>
                <Button color="error" onClick={() => setConfirmRevoke(true)} disabled={!!busy}>
                  Stop watching
                </Button>
              </Stack>
            )}

            {item.status === STATUS.revocationPending && (
              <Button variant="contained" color="error" onClick={() => setConfirmRevoke(true)} disabled={!!busy}>
                Try revoking again
              </Button>
            )}
          </Box>

          {item.failureCode && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              Reference: {item.failureCode}
            </Typography>
          )}
        </CardContent>
      </Card>

      {needsBilling && (
        <Alert severity="info">
          <AlertTitle>Your first saving was on us</AlertTitle>
          Rebuy already banked you a saving for free. To keep it working, authorize how we get
          paid: 15% of what you actually bank, capped at $15 a month no matter how much we save
          you. Nothing is charged until a refund lands.
        </Alert>
      )}

      {banked && (
        <Alert severity="success">
          <AlertTitle>You saved ${gap.toFixed(2)}</AlertTitle>
          ${(paid - Number(item.rebuyPrice)).toFixed(2)} price difference
          {returnCost > 0 ? `, less $${returnCost.toFixed(2)} to return the original` : ""}. Our share
          is ${(gap * 0.15).toFixed(2)}, so you keep ${(gap * 0.85).toFixed(2)}.
        </Alert>
      )}

      {/* Money */}
      <Card>
        <Grid container>
          {[
            { label: "You paid", value: `$${paid.toFixed(2)}` },
            { label: "Price now", value: `$${now.toFixed(2)}`, good: now < paid },
            {
              label: banked ? "Saved" : gap > 0 ? "Difference" : "Saved",
              value: `$${gap.toFixed(2)}`,
              good: banked && gap > 0,
            },
          ].map((s, i) => (
            <Grid size={4} key={s.label} sx={{ borderLeft: i ? "1px solid" : "none", borderColor: "divider" }}>
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="body2" color="text.secondary">
                  {s.label}
                </Typography>
                <Typography sx={{ fontSize: { xs: "1.3rem", sm: "1.6rem" }, fontWeight: 700, color: s.good ? "success.main" : "text.primary" }}>
                  {s.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Card>

      {/* Guardrails */}
      {item.mandateId && ![STATUS.revoked].includes(item.status as never) && (
        <Card>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                What Rebuy is allowed to do
              </Typography>
              <Chip icon={<FingerprintIcon />} label="Passkey-approved" color="success" variant="outlined" size="small" />
            </Stack>
            <List dense>
              {[
                { icon: <StorefrontIcon />, primary: `${item.retailerName} only`, secondary: "Where it can spend" },
                { icon: <PaymentsIcon />, primary: `$${paid.toFixed(2)} maximum`, secondary: "Enforced by the card network" },
                { icon: <ReplayIcon />, primary: "One purchase", secondary: "Then the authorization is spent" },
                {
                  icon: <ScheduleIcon />,
                  primary: item.mandateExpiresAt
                    ? `Expires ${new Date(item.mandateExpiresAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
                    : "Expires 7 days after approval",
                  secondary: "Lapses on its own if unused",
                },
              ].map((g) => (
                <ListItem key={g.primary} disableGutters>
                  <ListItemIcon sx={{ color: "primary.main", minWidth: 42 }}>{g.icon}</ListItemIcon>
                  <ListItemText primary={g.primary} secondary={g.secondary} slotProps={{ primary: { sx: { fontWeight: 500 } } }} />
                </ListItem>
              ))}
            </List>
            {statusMeta(item.status).agentCanSpend && (
              <Button color="error" onClick={() => setConfirmRevoke(true)} disabled={!!busy} sx={{ mt: 1 }}>
                Revoke access
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Where the deadline came from — this number decides when money moves */}
      <Card sx={{ bgcolor: "#f9fafb" }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="body2" color="text.secondary">
            Return deadline{" "}
            <b style={{ color: "#111827" }}>
              {new Date(item.returnDeadline).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </b>{" "}
            —{" "}
            {item.returnWindowSource === "receipt"
              ? "taken from your receipt."
              : `based on ${item.retailerName}'s published return policy, because your receipt didn't state one.`}
            {returnCost > 0 && (
              <>
                {" "}Returning it costs about <b style={{ color: "#111827" }}>${returnCost.toFixed(2)}</b>,
                which Rebuy subtracts before deciding a drop is worth acting on.
              </>
            )}
            {item.lastCheckedAt && (
              <> Price last checked {new Date(item.lastCheckedAt).toLocaleString()}.</>
            )}
          </Typography>
        </CardContent>
      </Card>

      {/* Activity */}
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
                    sx={{ m: 0, p: 2, bgcolor: "#f9fafb", borderRadius: 2, fontSize: 12, overflowX: "auto", color: "text.secondary", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                  >
                    {JSON.stringify(e.detail, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {msg && <Alert severity="error" onClose={() => setMsg(null)}>{msg}</Alert>}

      <Dialog open={confirmRevoke} onClose={() => setConfirmRevoke(false)}>
        <DialogTitle>Revoke Rebuy&apos;s access?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Rebuy will stop watching this purchase and can no longer spend anything on your behalf.
            You can set it up again while the return window is open.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmRevoke(false)}>Keep it on</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmRevoke(false);
              call(`/api/items/${item.id}/revoke`, undefined, "Revoking…");
            }}
          >
            Revoke access
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
