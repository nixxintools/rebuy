import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import { LinkButton, LinkListItemButton } from "@/components/Links";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import StatusChip from "@/components/StatusChip";
import { GRADIENT } from "@/lib/theme";

export const dynamic = "force-dynamic";

const STEPS = [
  "Paste an order confirmation — we read it for you",
  "Approve the agent once, with a spending ceiling you set",
  "It rebuys on a price drop and preps your return",
];

export default async function Dashboard() {
  const user = await requireUser();
  const items = await prisma.trackedItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const saved = items
    .filter((i) => i.status === "return_ready" && i.rebuyPrice)
    .reduce((s, i) => s + (Number(i.purchasePrice) - Number(i.rebuyPrice)), 0);
  const watching = items.filter((i) => ["monitoring", "drop_detected"].includes(i.status)).length;

  return (
    <Stack spacing={3}>
      <Card sx={{ background: GRADIENT, color: "#fff", border: "none" }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="body2" sx={{ opacity: 0.85, letterSpacing: "0.06em" }}>
            SAVINGS CAPTURED
          </Typography>
          <Typography sx={{ fontSize: { xs: "2.75rem", md: "3.25rem" }, fontWeight: 700, lineHeight: 1.1 }}>
            ${saved.toFixed(2)}
          </Typography>
          <Typography sx={{ mt: 1, opacity: 0.9 }}>
            {watching > 0
              ? `Watching ${watching} purchase${watching === 1 ? "" : "s"} for price drops.`
              : "Nothing being watched yet — add a receipt to get started."}
          </Typography>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: "center" }}>
            <Typography variant="h3" sx={{ mb: 1 }}>
              Track your first purchase
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              It takes about a minute, and it only pays off in your favour.
            </Typography>
            <Stack spacing={2} sx={{ maxWidth: 420, mx: "auto", textAlign: "left", mb: 4 }}>
              {STEPS.map((s, i) => (
                <Stack key={s} direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: GRADIENT,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Typography color="text.secondary">{s}</Typography>
                </Stack>
              ))}
            </Stack>
            <LinkButton href="/add" variant="contained" size="large" sx={{ background: GRADIENT }}>
              Add your first receipt
            </LinkButton>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <List disablePadding>
            {items.map((i, idx) => {
              const itemSaved = i.rebuyPrice ? Number(i.purchasePrice) - Number(i.rebuyPrice) : 0;
              return (
                <Box key={i.id}>
                  {idx > 0 && <Divider component="li" />}
                  <LinkListItemButton href={`/items/${i.id}`} sx={{ py: 2, px: { xs: 2, sm: 3 } }}>
                    <ListItemAvatar>
                      <Avatar
                        src={i.imageUrl ?? undefined}
                        variant="rounded"
                        sx={{ width: 48, height: 48, bgcolor: "#f3f4f6" }}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      sx={{ pr: 2 }}
                      primary={i.productName}
                      secondary={
                        <Box component="span" sx={{ display: "inline-flex", mt: 0.75 }}>
                          <StatusChip status={i.status} />
                        </Box>
                      }
                      slotProps={{
                        primary: {
                          noWrap: true,
                          sx: { fontWeight: 500, maxWidth: { xs: 150, sm: 340 } },
                        },
                        secondary: { component: "span" },
                      }}
                    />
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      {itemSaved > 0 ? (
                        <Typography sx={{ fontWeight: 700, color: "success.main" }}>
                          +${itemSaved.toFixed(2)}
                        </Typography>
                      ) : (
                        <Typography sx={{ fontWeight: 700 }}>
                          ${Number(i.currentPrice).toFixed(2)}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        paid ${Number(i.purchasePrice).toFixed(2)}
                      </Typography>
                    </Box>
                  </LinkListItemButton>
                </Box>
              );
            })}
          </List>
        </Card>
      )}
    </Stack>
  );
}
