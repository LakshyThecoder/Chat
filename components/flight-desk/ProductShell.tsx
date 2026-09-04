"use client";

import type { ReactNode } from "react";

export function ProductShell({
  webmcpReady,
  webmcpReason,
  inboxConnected,
  nextAction,
  children,
}: {
  webmcpReady: boolean;
  webmcpReason: string;
  inboxConnected: boolean;
  nextAction: string;
  children: ReactNode;
}) {
  return (
    <div className="flight-desk">
      <a
        href="#desk-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:text-black"
      >
        Skip to desk
      </a>
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--canvas)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--blue)] font-display text-xl italic text-white">
              A
            </span>
            <div>
              <p className="text-base font-extrabold leading-none tracking-[-0.02em]">Aegis</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Passenger protection</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="desk-pill" data-live={webmcpReady}>
              {webmcpReady ? "Agent connected" : "Open in ChatGPT"}
            </span>
            <span className="desk-pill hidden sm:inline-flex" data-live={inboxConnected}>
              {inboxConnected ? "Evidence inbox ready" : "Opening evidence…"}
            </span>
          </div>
        </div>
      </header>
      <div className="border-b border-[var(--line)] bg-white/55">
        <p className="mx-auto max-w-[1380px] px-4 py-2.5 text-center text-xs font-semibold text-[var(--muted)] sm:px-8">
          {nextAction}
          <span className="sr-only"> {webmcpReason}</span>
        </p>
      </div>
      <div id="desk-main" className="mx-auto max-w-[1380px] px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
        {children}
      </div>
    </div>
  );
}
