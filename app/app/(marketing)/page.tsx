import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import BoltIcon from "@mui/icons-material/Bolt";
import SavingsIcon from "@mui/icons-material/Savings";
import Section from "@/components/Section";
import { LinkButton } from "@/components/Links";
import { GRADIENT } from "@/lib/theme";

const PROBLEMS = [
  "Prices drop days after you buy — nobody tells you",
  "Retailers won't refund the difference",
  "Returning and rebuying by hand is a whole evening",
  "The return window closes and you just eat the loss",
];

const SOLUTIONS = [
  "It watches the store's real price for you",
  "It rebuys the moment the price drops",
  "Your return comes prepped, with a ship-by date",
  "You keep the difference",
];

const STEPS = [
  {
    n: 1,
    title: "Paste your receipt",
    body: "Drop in the order confirmation email. Rebuy reads the product, the price and your return deadline.",
  },
  {
    n: 2,
    title: "Turn it on",
    body: "One tap and it starts working. You set the ceiling — it can never spend more than you already paid.",
  },
  {
    n: 3,
    title: "It captures the drop",
    body: "The price falls, Rebuy buys the cheaper one and hands you the return. You pocket the difference.",
  },
];

const FEATURES = [
  {
    icon: <ReceiptLongIcon />,
    title: "Reads any receipt",
    body: "Paste the email as-is. No forms, no order numbers to copy out, no manual entry.",
  },
  {
    icon: <MonitorHeartIcon />,
    title: "Watches the real price",
    body: "Live prices read straight from the store, checked every day and any time you open Rebuy.",
  },
  {
    icon: <BoltIcon />,
    title: "Acts inside your window",
    body: "It only buys while you can still return the original — using that store’s real return policy, not a guess.",
  },
  {
    icon: <SavingsIcon />,
    title: "Shows its work",
    body: "Every check, every decision, every dollar saved — laid out in plain English.",
  },
];

const AUDIENCE = [
  {
    title: "Gadget buyers",
    body: "Electronics move the most. A charger, a pair of headphones, a monitor — prices swing by tens of dollars within days of you buying.",
  },
  {
    title: "Frequent shoppers",
    body: "Ten orders a month means ten chances to overpay. Rebuy watches all of them so you never have to remember to check.",
  },
  {
    title: "Households",
    body: "Home goods and everyday essentials go on sale constantly. Small differences, but they stack up across a year.",
  },
];

export default function Landing() {
  return (
    <>
      {/* Hero */}
      <Box
        sx={{
          position: "relative",
          pt: { xs: 14, md: 20 },
          pb: { xs: 8, md: 12 },
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: -260,
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 620,
            background: "radial-gradient(circle, rgba(37,99,235,0.16) 0%, rgba(13,148,136,0.07) 45%, transparent 70%)",
            pointerEvents: "none",
          },
        }}
      >
        <Container maxWidth="md" sx={{ position: "relative", textAlign: "center" }}>
          <Typography variant="h1">
            Your purchase just got cheaper.
            <Box component="span" sx={{ display: "block", background: GRADIENT, backgroundClip: "text", color: "transparent" }}>
              Get the difference.
            </Box>
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mt: 3, fontSize: "1.15rem", maxWidth: 620, mx: "auto", lineHeight: 1.7 }}
          >
            Prices fall after you buy, and stores won&apos;t refund the gap. Rebuy watches what you
            paid, buys the cheaper one while you can still return the first, and hands you back the
            difference.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "center", mt: 5 }}>
            <LinkButton href="/login" variant="contained" size="large" sx={{ background: GRADIENT }}>
              Start tracking free
            </LinkButton>
            <Button href="#how" variant="outlined" size="large">
              See how it works
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Free to start · Nothing charged unless it saves you money
          </Typography>
        </Container>
      </Box>

      {/* Problem vs solution */}
      <Section tinted title="The money you're already leaving behind" subtitle="One in five online purchases drops in price before your return window closes.">
        <Grid container spacing={3} sx={{ justifyContent: "center" }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: "100%", borderColor: "#fecaca" }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h3" sx={{ mb: 1, color: "#b91c1c" }}>
                  Doing it yourself
                </Typography>
                <List dense disablePadding>
                  {PROBLEMS.map((p) => (
                    <ListItem key={p} disableGutters sx={{ alignItems: "flex-start" }}>
                      <ListItemIcon sx={{ minWidth: 34, mt: 0.5 }}>
                        <CloseIcon sx={{ color: "#ef4444" }} fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={p} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: "100%", borderColor: "#bbf7d0" }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h3" sx={{ mb: 1, color: "#15803d" }}>
                  With Rebuy
                </Typography>
                <List dense disablePadding>
                  {SOLUTIONS.map((s) => (
                    <ListItem key={s} disableGutters sx={{ alignItems: "flex-start" }}>
                      <ListItemIcon sx={{ minWidth: 34, mt: 0.5 }}>
                        <CheckIcon sx={{ color: "#16a34a" }} fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={s} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Section>

      {/* How it works */}
      <Section id="how" eyebrow="How it works" title="Three steps, then it runs itself" subtitle="Set it up once per purchase. After that you only hear from Rebuy when it has saved you money.">
        <Grid container spacing={4}>
          {STEPS.map((s) => (
            <Grid size={{ xs: 12, md: 4 }} key={s.n}>
              <Box sx={{ textAlign: "center", px: 2 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: GRADIENT,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    fontWeight: 700,
                    mx: "auto",
                    mb: 2.5,
                  }}
                >
                  {s.n}
                </Box>
                <Typography variant="h3" sx={{ mb: 1.5 }}>
                  {s.title}
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {s.body}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Section>

      {/* Features */}
      <Section id="features" tinted eyebrow="Features" title="Built to be left alone">
        <Grid container spacing={3}>
          {FEATURES.map((f) => (
            <Grid size={{ xs: 12, sm: 6 }} key={f.title}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: 4 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(37,99,235,0.09)",
                      color: "primary.main",
                      mb: 2,
                    }}
                  >
                    {f.icon}
                  </Box>
                  <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
                    {f.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {f.body}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Section>

      {/* Audience */}
      <Section id="who" eyebrow="Who it's for" title="If you buy online, you're overpaying somewhere">
        <Grid container spacing={3}>
          {AUDIENCE.map((a) => (
            <Grid size={{ xs: 12, md: 4 }} key={a.title}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h4" sx={{ mb: 1.5, fontWeight: 700 }}>
                    {a.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {a.body}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Section>

      {/* Final CTA */}
      <Container maxWidth="lg" sx={{ mb: 4 }}>
        <Box
          sx={{
            background: GRADIENT,
            borderRadius: 6,
            px: { xs: 4, md: 8 },
            py: { xs: 6, md: 9 },
            textAlign: "center",
            color: "#fff",
          }}
        >
          <Typography variant="h2" sx={{ color: "#fff" }}>
            Stop leaving money with the store
          </Typography>
          <Typography sx={{ mt: 2, fontSize: "1.1rem", opacity: 0.92, maxWidth: 560, mx: "auto" }}>
            Track your first purchase in under a minute. If Rebuy never saves you anything, it never
            costs you anything.
          </Typography>
          <LinkButton
            href="/login"
            size="large"
            sx={{ mt: 4, bgcolor: "#fff", color: "#111827", "&:hover": { bgcolor: "#f3f4f6" } }}
          >
            Start tracking free
          </LinkButton>
        </Box>
      </Container>
    </>
  );
}
