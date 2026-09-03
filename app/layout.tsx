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
  title: "Aegis — you and ChatGPT resolve money disputes on one desk",
  description:
    "Aegis is an agent-native consumer resolution desk. ChatGPT inspects live provider rows. You sign. Filing only counts when the provider row matches.",
  metadataBase: new URL("https://aegis-chamber.vercel.app"),
  openGraph: {
    title: "Aegis — you sign, it files, the row must match",
    description:
      "The desk where you and ChatGPT resolve money disputes together. WebMCP tools. Human signature. Provider verification.",
    url: "https://aegis-chamber.vercel.app",
    siteName: "Aegis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis — you sign, it files, the row must match",
    description: "People and agents share one live refund desk. WebMCP on the same page.",
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
