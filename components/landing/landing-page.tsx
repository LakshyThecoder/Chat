"use client";

import Link from "next/link";
import { FileSearch, ShieldCheck, Waypoints, BadgeCheck } from "lucide-react";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { Spotlight } from "@/components/ui/spotlight-new";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { PlaneWindowHero } from "@/components/landing/plane-window-hero";

const LOOP_STEPS = [
  "Understand",
  "Investigate",
  "Prove",
  "Plan",
  "Ask",
  "Execute",
  "Verify",
  "Monitor",
  "Resolve",
] as const;

const CAPABILITIES = [
  {
    icon: FileSearch,
    title: "Evidence first",
    body: "Every important fact carries provenance. Documents are data, never instructions.",
  },
  {
    icon: ShieldCheck,
    title: "Permission at the edge",
    body: "Consequential actions stop for human authorization. The model never grants itself permission.",
  },
  {
    icon: Waypoints,
    title: "Real WebMCP execution",
    body: "Provider tools cause and observe real provider state. No fake calls. No demo shortcuts.",
  },
  {
    icon: BadgeCheck,
    title: "Verify after mutate",
    body: "Success is not a model claim. Aegis re-reads provider state before an action is confirmed.",
  },
] as const;

const PRINCIPLES = [
  {
    quote:
      "Money arithmetic stays deterministic. The model may propose; software decides the amount.",
    name: "Authoritative money",
    title: "Never LLM-owned",
  },
  {
    quote:
      "Every consequential action is auditable and idempotent, so retries never invent a second outcome.",
    name: "Replay-safe actions",
    title: "Audit by design",
  },
  {
    quote:
      "Untrusted web content and uploads cannot rewrite system instructions or bypass policy.",
    name: "Instruction firewall",
    title: "Treat content as data",
  },
  {
    quote:
      "AI proposes the tool call. The capability layer validates tool, case state, arguments, and permission.",
    name: "Capability gate",
    title: "Propose, then prove",
  },
  {
    quote:
      "Aegis is not a chatbot that writes complaints. It is an operations loop that closes the case.",
    name: "Resolution product",
    title: "Built to finish work",
  },
] as const;

const NAV_ITEMS = [
  { name: "How it works", link: "#how-it-works" },
  { name: "Capabilities", link: "#capabilities" },
  { name: "Cases", link: "/cases" },
];

export function LandingPage() {
  return (
    <main className="bg-background text-foreground">
      <FloatingNav
        navItems={NAV_ITEMS}
        className="border-0 bg-transparent p-0 shadow-none"
      />

      <PlaneWindowHero />

      <section
        id="how-it-works"
        className="relative overflow-hidden border-t border-border/60 bg-neutral-950 px-6 py-24 text-white md:px-10"
      >
        <Spotlight
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(173, 60%, 70%, .12) 0, hsla(173, 50%, 40%, .04) 50%, transparent 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(200, 80%, 70%, .08) 0, transparent 80%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(210, 70%, 65%, .05) 0, transparent 80%)"
        />
        <div className="relative z-10 mx-auto max-w-5xl">
          <p className="text-sm font-medium tracking-wide text-teal-200/80">
            North-star loop
          </p>
          <TextGenerateEffect
            words="From messy problem to verified resolution."
            className="mt-2 font-display font-semibold"
            duration={0.35}
          />
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            Aegis reconstructs what happened, preserves evidence, evaluates
            entitlement, proposes a strategy, asks for authorization, executes
            through provider capabilities, and keeps working until the case is
            resolved.
          </p>
          <ol className="mt-12 flex flex-wrap gap-2 md:gap-3">
            {LOOP_STEPS.map((step, index) => (
              <li
                key={step}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm"
              >
                <span className="font-mono text-xs text-teal-200/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="capabilities"
        className="mx-auto max-w-6xl px-6 py-24 md:px-10"
      >
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Built like an operations product, not a chat window.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            Money, evidence, status, next action, and permissions stay visually
            and systemically dominant. AI interprets. Deterministic software
            owns the consequential boundaries.
          </p>
        </div>
        <div className="mt-14 grid gap-10 sm:grid-cols-2">
          {CAPABILITIES.map((item) => (
            <article key={item.title} className="space-y-3">
              <item.icon
                className="h-5 w-5 text-primary"
                aria-hidden
                strokeWidth={1.75}
              />
              <h3 className="text-lg font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/40 py-20">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <h2 className="max-w-xl font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Invariants you can trust.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            These are product rules, not marketing lines.
          </p>
        </div>
        <div className="mt-10 flex justify-center">
          <InfiniteMovingCards
            items={[...PRINCIPLES]}
            direction="left"
            speed="slow"
            className="max-w-none"
          />
        </div>
      </section>

      <section className="relative overflow-hidden bg-neutral-950 px-6 py-28 text-white md:px-10">
        <BackgroundBeams className="opacity-60" />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
            Open the Command Center.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70 md:text-lg">
            Start a case, attach evidence, and watch Aegis move from proposal to
            permissioned execution with a clear audit trail.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-white/90"
            >
              Open Command Center
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/25 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg font-semibold tracking-tight">
            Aegis
          </p>
          <p className="text-sm text-muted-foreground">
            Agent-native consumer advocacy. The web, working for you.
          </p>
        </div>
      </footer>
    </main>
  );
}
