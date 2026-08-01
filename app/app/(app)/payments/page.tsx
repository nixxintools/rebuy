"use client";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Skeleton from "@mui/material/Skeleton";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import LockIcon from "@mui/icons-material/Lock";
import { LinkButton } from "@/components/Links";
import { GRADIENT } from "@/lib/theme";

type Charge = {
  transactionId: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  productName: string;
  merchantName: string;
  itemId: string;
};

type Authorization = {
  itemId: string;
  productName: string;
  imageUrl: string | null;
  merchantName: string;
  currency: string;
  mandateId: string;
  mandate: {
    status: string;
    state: string;
    approvedAmount: string;
    remaining: string;
    spent: string;
    chargeCount: number;
    validUntil: string;
  };
};

type Payload = {
  email: string;
  authorizations: Authorization[];
  charges: Charge[];
  totals: { saved: number; fee: number; net: number; feeRate: number };
};

const STATUS_COLOR: Record<string, "success" | "warning" | "default" | "error"> = {
  active: "success",
  pending: "warning",
  paused: "warning",
  consumed: "default",
  cancelled: "default",
  expired: "default",
  completed: "success",
  failed: "error",
};

export default function PaymentsPage() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch("/api/payments")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <Stack spacing={2.5}>
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h2" sx={{ fontSize: "1.9rem" }}>
          Payments
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Your card, what Rebuy is allowed to spend, and everything it has spent.
        </Typography>
      </Box>

      {/* Earnings summary */}
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Grid container spacing={3}>
            {[
              { label: "Saved for you", value: `$${data.totals.saved.toFixed(2)}`, good: true },
              { label: `Our share (${Math.round(data.totals.feeRate * 100)}%)`, value: `$${data.totals.fee.toFixed(2)}` },
              { label: "You keep", value: `$${data.totals.net.toFixed(2)}`, good: true },
            ].map((s) => (
              <Grid size={{ xs: 12, sm: 4 }} key={s.label}>
                <Typography variant="body2" color="text.secondary">
                  {s.label}
                </Typography>
                <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: s.good ? "success.main" : "text.primary" }}>
                  {s.value}
                </Typography>
              </Grid>
            ))}
          </Grid>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            We only charge when Rebuy actually saves you money. No savings, no fee.
          </Typography>
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            Payment method
          </Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Avatar sx={{ background: GRADIENT, width: 48, height: 48 }}>
              <CreditCardIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 500 }}>Card held securely by Prava</Typography>
              <Typography variant="body2" color="text.secondary">
                You entered it on Prava&apos;s own page. Rebuy never sees or stores your card
                number — each purchase uses a single-use card generated for that one order.
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
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Spend authorizations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            Each one is capped, locked to a single store, and expires on its own.
          </Typography>

          {data.authorizations.length === 0 ? (
            <Stack spacing={2} sx={{ alignItems: "flex-start", py: 2 }}>
              <Typography color="text.secondary">
                You haven&apos;t authorized any spending yet.
              </Typography>
              <LinkButton href="/add" variant="contained" sx={{ background: GRADIENT }}>
                Track a purchase
              </LinkButton>
            </Stack>
          ) : (
            <Stack divider={<Divider />} spacing={0}>
              {data.authorizations.map((a) => {
                const used = Number(a.mandate.spent);
                const cap = Number(a.mandate.approvedAmount);
                const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
                return (
                  <Box key={a.mandateId} sx={{ py: 2.5 }}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1.5 }}>
                      <Avatar src={a.imageUrl ?? undefined} variant="rounded" sx={{ bgcolor: "#f3f4f6" }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 500 }}>
                          {a.productName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {a.merchantName} only · expires{" "}
                          {new Date(a.mandate.validUntil).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </Typography>
                      </Box>
                      <Chip
                        label={a.mandate.status}
                        size="small"
                        color={STATUS_COLOR[a.mandate.status] ?? "default"}
                        variant="outlined"
                        sx={{ textTransform: "capitalize" }}
                      />
                    </Stack>
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
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      {data.charges.length > 0 && (
        <Card>
          <CardContent sx={{ p: { xs: 3, md: 4 }, pb: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Every charge Rebuy has attempted on your behalf, successful or not.
            </Typography>
          </CardContent>
          <Box sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Purchase</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.charges.map((c) => (
                  <TableRow key={c.transactionId}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 240 }}>
                        {c.productName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.merchantName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.status}
                        size="small"
                        color={STATUS_COLOR[c.status] ?? "default"}
                        variant="outlined"
                        sx={{ textTransform: "capitalize" }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                      ${Number(c.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}
    </Stack>
  );
}
