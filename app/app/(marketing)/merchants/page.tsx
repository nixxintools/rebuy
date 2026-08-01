import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import type { Metadata } from "next";
import { rankedByRecoverableWindow, canSpendAutonomously } from "@/lib/merchants";
import { LinkButton } from "@/components/Links";
import { GRADIENT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Where your money stays recoverable — Rebuy",
  description:
    "Every store we support, ranked by how long you can still get your money back. Return windows verified against each merchant's own published policy.",
};

function costLabel(cost: string, fee: number | null) {
  if (cost === "free") return "Free returns";
  if (cost === "flat_fee" && fee != null) return `$${fee.toFixed(2)} to return`;
  if (cost === "flat_fee") return "Return fee applies";
  if (cost === "customer_pays_shipping") return "You pay return shipping";
  return "Return cost unpublished";
}

export default function MerchantsPage() {
  const merchants = rankedByRecoverableWindow();
  const spendable = merchants.filter(canSpendAutonomously);
  const longest = merchants[0];

  return (
    <>
      <Box sx={{ pt: { xs: 14, md: 18 }, pb: { xs: 6, md: 8 }, textAlign: "center" }}>
        <Container maxWidth="md">
          <Typography variant="h1" sx={{ fontSize: { xs: "2.25rem", md: "3rem" } }}>
            Where your money stays{" "}
            <Box component="span" sx={{ background: GRADIENT, backgroundClip: "text", color: "transparent" }}>
              recoverable
            </Box>
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 3, fontSize: "1.1rem", lineHeight: 1.7 }}>
            A return window isn&apos;t red tape — it&apos;s how long the price has to fall while you
            can still do something about it. {longest.name} gives you {longest.policy.windowDays} days.
            Some stores give you 21. Same purchase, wildly different odds.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {merchants.length} stores · every window read from the merchant&apos;s own policy page ·
            last verified {merchants[0].policy.verifiedOn}
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ pb: 10 }}>
        <Card>
          <Stack divider={<Divider />}>
            {merchants.map((m, i) => {
              const ok = canSpendAutonomously(m);
              return (
                <Stack
                  key={m.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1, sm: 2 }}
                  sx={{ px: { xs: 2.5, sm: 3 }, py: 2, alignItems: { sm: "center" } }}
                >
                  <Typography
                    sx={{ width: 28, color: "text.secondary", fontVariantNumeric: "tabular-nums", display: { xs: "none", sm: "block" } }}
                  >
                    {i + 1}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography sx={{ fontWeight: 600 }}>{m.name}</Typography>
                      <Chip label={m.category} size="small" variant="outlined" />
                      {!ok && (
                        <Tooltip
                          title={
                            m.policy.windowDays === 0
                              ? "No returns accepted, so a repurchase could never be undone."
                              : "Policy not verified well enough to spend against."
                          }
                        >
                          <Chip label="watch only" size="small" color="warning" variant="outlined" />
                        </Tooltip>
                      )}
                      {m.policy.confidence === "medium" && ok && (
                        <Tooltip title={m.policy.notes}>
                          <Chip label="shortest documented" size="small" variant="outlined" />
                        </Tooltip>
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {costLabel(m.policy.cost, m.policy.feeUsd)} ·{" "}
                      <a href={m.policy.policyUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                        their policy
                      </a>
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: { xs: "left", sm: "right" }, flexShrink: 0 }}>
                    <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, lineHeight: 1.2 }}>
                      {m.policy.windowDays === 0 ? "None" : `${m.policy.windowDays} days`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      to change your mind
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </Card>

        <Box sx={{ mt: 5, textAlign: "center" }}>
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 620, mx: "auto", lineHeight: 1.7 }}>
            Rebuy will only spend at the {spendable.length} stores where a return is genuinely
            possible and the policy is verified. At the rest we&apos;ll still watch the price — we
            just won&apos;t buy, because a repurchase you can&apos;t undo isn&apos;t a saving.
          </Typography>
          <LinkButton href="/login" variant="contained" size="large" sx={{ background: GRADIENT }}>
            Start tracking free
          </LinkButton>
        </Box>
      </Container>
    </>
  );
}
