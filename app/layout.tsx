import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const board = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-board",
  display: "swap",
});

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aegis — you sign, the desk files, the row must match",
  description:
    "A live dispute desk. WebMCP tools inspect persisted sandbox rows, compute entitlement, and file only after a human signs. Success is a re-read.",
  metadataBase: new URL("https://aegis-chamber.vercel.app"),
  openGraph: {
    title: "Aegis — you sign, the desk files, the row must match",
    description:
      "ChatGPT and a person share one refund desk. The agent inspects. You authorize money. The provider row must match.",
    url: "https://aegis-chamber.vercel.app",
    siteName: "Aegis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis — you sign, the desk files, the row must match",
    description: "A WebMCP resolution desk: inspect, sign, file, verify.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${board.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
