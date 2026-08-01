import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Link from "next/link";
import { Logo } from "./Logo";

export default function Footer() {
  return (
    <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "divider", py: 6, mt: 10 }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Logo size={28} />
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} Rebuy
            </Typography>
          </Stack>
          <Stack direction="row" spacing={3}>
            <Typography variant="body2" color="text.secondary">
              Privacy
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Terms
            </Typography>
            <Link href="/login" style={{ textDecoration: "none" }}>
              <Typography variant="body2" color="text.secondary">
                Sign in
              </Typography>
            </Link>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Payments secured by Prava
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
