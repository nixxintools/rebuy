"use client";
import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, Wordmark } from "./Logo";
import { GRADIENT } from "@/lib/theme";

export default function AppNav({ email }: { email: string }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const pathname = usePathname();
  const active = pathname.startsWith("/payments") ? "payments" : "dashboard";

  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ maxWidth: 1000, width: "100%", mx: "auto", px: { xs: 2, md: 3 } }}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          {/* The wordmark costs width the nav needs on small screens. */}
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <Wordmark size={30} />
          </Box>
          <Box sx={{ display: { xs: "flex", sm: "none" }, alignItems: "center" }}>
            <Logo size={30} />
          </Box>
        </Link>
        <Stack direction="row" spacing={0.5} sx={{ ml: { xs: 1.5, sm: 3 } }}>
          <Button
            component={Link}
            href="/dashboard"
            sx={{
              color: active === "dashboard" ? "primary.main" : "text.secondary",
              fontWeight: active === "dashboard" ? 600 : 400,
              px: { xs: 1, sm: 1.5 },
              minWidth: 0,
            }}
          >
            Purchases
          </Button>
          <Button
            component={Link}
            href="/payments"
            sx={{
              color: active === "payments" ? "primary.main" : "text.secondary",
              fontWeight: active === "payments" ? 600 : 400,
              px: { xs: 1, sm: 1.5 },
              minWidth: 0,
            }}
          >
            Payments
          </Button>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Button
          component={Link}
          href="/add"
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ background: GRADIENT, mr: 1.5, display: { xs: "none", sm: "inline-flex" } }}
        >
          Track a purchase
        </Button>
        <IconButton component={Link} href="/add" sx={{ display: { xs: "inline-flex", sm: "none" }, mr: 0.5 }} aria-label="Track a purchase">
          <AddIcon />
        </IconButton>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account">
          <Avatar sx={{ width: 34, height: 34, background: GRADIENT, fontSize: 15 }}>
            {email.charAt(0).toUpperCase()}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Signed in as
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {email}
            </Typography>
          </Box>
          <Divider />
          <form action="/api/auth/logout" method="post">
            <MenuItem component="button" type="submit" sx={{ width: "100%" }}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </form>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
