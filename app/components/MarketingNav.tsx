"use client";
import { useEffect, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import MenuIcon from "@mui/icons-material/Menu";
import Link from "next/link";
import { Wordmark } from "./Logo";
import { GRADIENT } from "@/lib/theme";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#who", label: "Who it's for" },
];

export default function MarketingNav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: solid ? "rgba(255,255,255,0.85)" : "transparent",
          backdropFilter: solid ? "blur(12px)" : "none",
          borderBottom: solid ? "1px solid" : "1px solid transparent",
          borderColor: solid ? "divider" : "transparent",
          transition: "all .25s ease",
        }}
      >
        <Toolbar sx={{ maxWidth: 1140, width: "100%", mx: "auto", px: { xs: 2, md: 3 } }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Wordmark size={30} />
          </Link>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, alignItems: "center" }}>
            {LINKS.map((l) => (
              <Button key={l.href} href={l.href} sx={{ color: "text.secondary" }}>
                {l.label}
              </Button>
            ))}
            <Button
              component={Link}
              href="/login"
              variant="contained"
              sx={{ background: GRADIENT, ml: 1 }}
            >
              Start free
            </Button>
          </Box>
          <IconButton
            onClick={() => setOpen(true)}
            sx={{ display: { xs: "inline-flex", md: "none" } }}
            aria-label="Open menu"
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 240, pt: 2 }} role="presentation" onClick={() => setOpen(false)}>
          <List>
            {LINKS.map((l) => (
              <ListItemButton key={l.href} component="a" href={l.href}>
                <ListItemText primary={l.label} />
              </ListItemButton>
            ))}
            <ListItemButton component={Link} href="/login">
              <ListItemText primary="Start free" slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </>
  );
}
