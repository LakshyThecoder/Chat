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
  title: "Aegis — Flight Desk",
  description:
    "Passenger rights, operated with ChatGPT. Airline inbox, EU261 math, human signature, FlyRight filing, provider verify.",
  metadataBase: new URL("https://aegis-chamber.vercel.app"),
  openGraph: {
    title: "Aegis Flight Desk — you sign, it files, the row must match",
    description:
      "A product for delayed and cancelled flights. WebMCP tools, deterministic rights, human permission, verified carrier state.",
    url: "https://aegis-chamber.vercel.app",
    siteName: "Aegis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis — Flight Desk",
    description: "People and ChatGPT share one flight-rights desk. WebMCP. Human signature. Provider match.",
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
