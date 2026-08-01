import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme, { roboto } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rebuy — your purchase just got cheaper",
  description:
    "Rebuy watches the price of what you just bought. If it drops while you can still return it, Rebuy buys the cheaper one and preps your return. You keep the difference.",
  openGraph: {
    title: "Rebuy — your purchase just got cheaper",
    description:
      "Prices drop after you buy. Rebuy captures the difference automatically, inside your return window.",
    url: "https://rebuy.upthink.app",
    siteName: "Rebuy",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.className}>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
