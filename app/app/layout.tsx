import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Logo } from "@/components/Logo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rebuy — price drops, captured automatically",
  description:
    "Rebuy watches everything you buy. When the price drops inside the return window, it repurchases at the lower price and preps your return. You keep the difference.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#0a0a0b] font-sans text-zinc-100 antialiased`}
      >
        <div className="border-b border-zinc-800/60 bg-[#0a0a0b]/80 backdrop-blur">
          <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
            <a href="/" className="flex items-center gap-2.5">
              <Logo />
              <span className="text-[17px] font-semibold tracking-tight">Rebuy</span>
            </a>
            <a
              href="/add"
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Track a purchase
            </a>
          </header>
        </div>
        <div className="mx-auto max-w-3xl px-5 py-10">{children}</div>
        <footer className="mx-auto max-w-3xl px-5 pb-10 pt-4 text-xs text-zinc-600">
          Payments secured by Prava · sandbox demo — no real money moves
        </footer>
      </body>
    </html>
  );
}
