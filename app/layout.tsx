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
  title: "Aegis OS — Dispute Runtime",
  description:
    "Aegis OS is a shared desktop for consumer disputes. ChatGPT works the page through WebMCP. You sign money. Success is a provider re-read.",
  metadataBase: new URL("https://aegis-chamber.vercel.app"),
  openGraph: {
    title: "Aegis OS — you sign, it files, the row must match",
    description:
      "Not a chatbot. A Dispute OS desktop with WebMCP tools, human UAC, and provider verification.",
    url: "https://aegis-chamber.vercel.app",
    siteName: "Aegis OS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis OS — Dispute Runtime",
    description: "Shared desktop for people and ChatGPT. WebMCP. Human signature. Provider match.",
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
