"use client";
import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Skeleton from "@mui/material/Skeleton";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import LockIcon from "@mui/icons-material/Lock";
import { LinkButton } from "@/components/Links";
import { GRADIENT } from "@/lib/theme";

type Charge = {
  transactionId: string;
  amount: string;
  status: string;
  createdAt: string;
  productName: string;
  merchantName: string;
};

type Authorization = {
  itemId: string;
  productName: string;
  imageUrl: string | null;
  merchantName: string;
  mandateId: string;
  live: boolean;
  unreachable: boolean;
  mandate: {
    status: string;
    approvedAmount: string;
    remaining: string;
    spent: string;
    validUntil: string;
  } | null;
};

type Payload = {
  authorizations: Authorization[];
  charges: Charge[];
  authority: {
    activeCount: number;
    spendableNow: number;
    nextExpiry: string | null;
    anyUnreachable: boolean;
  };
  totals: { realized: number; pending: number; fee: number; net: number };
};

const CHARGE_COLOR: Record<string, "success" | "error" | "default"> = {
  completed: "success",
  failed: "error",
};

export default function PaymentsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/payments");
      if (!r.ok) {
        setError(r.status === 401 ? "Please sign in again." : "Couldn't load your payment details.");
        return;
      }
      setData(await r.json());
      setError(null);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
        {error}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Stack spacing={2.5}>
        <Skeleton variant="rounded" height={130} />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  const { authority, totals } = data;
  const active = data.authorizations.filter((a) => a.live);
  const past = data.authorizations.filter((a) => !a.live);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h2" sx={{ fontSize: "1.9rem" }}>
          Payments
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          What Rebuy can spend right now, and everything it has spent.
        </Typography>
      </Box>

      {/* Spend authority first — the question a user actually has */}
      <Card sx={{ borderColor: authority.activeCount ? "primary.main" : "divider" }}>
        {loading && <LinearProgress />}
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ letterSpacing: "0.06em" }}>
            RECOVERABLE RIGHT NOW
          </Typography>
          <Typography sx={{ fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.15 }}>
            ${authority.spendableNow.toFixed(2)}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {authority.activeCount === 0
              ? "No active authorizations — Rebuy cannot spend anything."
              : `Across ${authority.activeCount} authorization${authority.activeCount === 1 ? "" : "s"}` +
                (authority.nextExpiry
                  ? `, the first expiring ${new Date(authority.nextExpiry).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.`
                  : ".")}
          </Typography>
        </CardContent>
      </Card>

      {authority.anyUnreachable && (
        <Alert severity="warning">
          <AlertTitle>Some authorizations couldn&apos;t be checked</AlertTitle>
          Prava didn&apos;t respond for at least one of these. They are shown as &ldquo;status
          unavailable&rdquo; rather than hidden — assume they may still be active.
        </Alert>
      )}

      {/* Card custody */}
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Avatar sx={{ background: GRADIENT, width: 48, height: 48 }}>
              <CreditCardIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 500 }}>Your card stays with Prava</Typography>
              <Typography variant="body2" color="text.secondary">
                You entered it on Prava&apos;s own page. Rebuy never sees or stores the number — each
                purchase gets a single-use card issued for that one order.
              </Typography>
            </Box>
            <Tooltip title="PCI-compliant tokenised storage">
              <Chip icon={<LockIcon />} label="Secured" color="success" variant="outlined" />
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      {/* Authorizations */}
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Active authorizations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Each is capped, locked to one store, and expires on its own.
          </Typography>

          {active.length === 0 ? (
            <Stack spacing={2} sx={{ alignItems: "flex-start", py: 1 }}>
              <Typography color="text.secondary">Nothing is authorized right now.</Typography>
              <LinkButton href="/add" variant="contained" sx={{ background: GRADIENT }}>
                Track a purchase
              </LinkButton>
            </Stack>
          ) : (
            <Stack divider={<Divider />}>
              {active.map((a) => (
                <AuthorizationRow key={a.mandateId} a={a} />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {past.length > 0 && (
        <Card>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
              Spent and closed
            </Typography>
            <Stack divider={<Divider />}>
              {past.map((a) => (
                <AuthorizationRow key={a.mandateId} a={a} muted />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Earnings */}
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            What you&apos;ve earned
          </Typography>
          <Grid container spacing={3}>
            {[
              { label: "Banked", value: totals.realized, good: true },
              { label: "Not banked yet", value: totals.pending },
              { label: "Our 15% share", value: totals.fee },
              { label: "You keep", value: totals.net, good: true },
            ].map((s) => (
              <Grid size={{ xs: 6, sm: 3 }} key={s.label}>
                <Typography variant="body2" color="text.secondary">
                  {s.label}
                </Typography>
                <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: s.good && s.value > 0 ? "success.main" : "text.primary" }}>
                  ${s.value.toFixed(2)}
                </Typography>
              </Grid>
            ))}
          </Grid>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            We only take a share of savings you&apos;ve actually banked — after your refund lands.
            Nothing is charged before that.
          </Typography>
        </CardContent>
      </Card>

      {/* Transactions — cards on mobile, no horizontal scrolling */}
      {data.charges.length > 0 && (
        <Card>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
              Transactions
            </Typography>
            <Stack divider={<Divider />}>
              {data.charges.map((c) => (
                <Stack
                  key={c.transactionId}
                  direction="row"
                  spacing={2}
                  sx={{ py: 1.5, alignItems: "center" }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 500 }}>
                      {c.productName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {c.merchantName} ·{" "}
                      {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Typography>
                  </Box>
                  <Chip
                    label={c.status}
                    size="small"
                    color={CHARGE_COLOR[c.status] ?? "default"}
                    variant="outlined"
                    sx={{ textTransform: "capitalize" }}
                  />
                  <Typography sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    ${Number(c.amount).toFixed(2)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

function AuthorizationRow({ a, muted }: { a: Authorization; muted?: boolean }) {
  const cap = Number(a.mandate?.approvedAmount ?? 0);
  const used = Number(a.mandate?.spent ?? 0);
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;

  return (
    <Box sx={{ py: 2.5, opacity: muted ? 0.75 : 1 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1.5 }}>
        <Avatar src={a.imageUrl ?? undefined} variant="rounded" sx={{ bgcolor: "#f3f4f6" }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 500 }}>
            {a.productName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {a.merchantName} only
            {a.mandate?.validUntil
              ? ` · expires ${new Date(a.mandate.validUntil).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
              : ""}
          </Typography>
        </Box>
        {a.unreachable ? (
          <Chip label="status unavailable" size="small" color="warning" variant="outlined" />
        ) : (
          <Chip
            label={a.mandate?.status ?? "unknown"}
            size="small"
            color={a.live ? "success" : "default"}
            variant="outlined"
            sx={{ textTransform: "capitalize" }}
          />
        )}
      </Stack>
      {a.mandate && (
        <>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{ height: 8, borderRadius: 999, bgcolor: "#f3f4f6" }}
          />
          <Stack direction="row" sx={{ justifyContent: "space-between", mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              ${used.toFixed(2)} spent of ${cap.toFixed(2)} ceiling
            </Typography>
            <LinkButton href={`/items/${a.itemId}`} size="small" sx={{ color: "text.secondary" }}>
              Manage
            </LinkButton>
          </Stack>
        </>
      )}
    </Box>
  );
}
