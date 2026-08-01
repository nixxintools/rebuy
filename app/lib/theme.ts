"use client";
import { createTheme } from "@mui/material/styles";
import { Roboto } from "next/font/google";

export const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const GRADIENT = "linear-gradient(135deg, #2563eb 0%, #0d9488 100%)";

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: "#2563eb" },
    secondary: { main: "#0d9488" },
    success: { main: "#16a34a" },
    error: { main: "#ef4444" },
    warning: { main: "#ea580c" },
    background: { default: "#ffffff", paper: "#ffffff" },
    text: { primary: "#111827", secondary: "#4b5563" },
    divider: "#e5e7eb",
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: roboto.style.fontFamily,
    h1: { fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
    h2: { fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h4: { fontSize: "1.25rem", fontWeight: 500 },
    button: { textTransform: "none", fontWeight: 500 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 22, paddingBlock: 10 },
        sizeLarge: { paddingInline: 30, paddingBlock: 13, fontSize: "1rem" },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: "1px solid #e5e7eb" },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiAppBar: { defaultProps: { elevation: 0, color: "transparent" } },
  },
});

export default theme;
