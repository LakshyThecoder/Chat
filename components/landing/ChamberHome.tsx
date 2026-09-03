"use client";

import { useEffect, useState } from "react";
import { ResolutionTheaterApp } from "@/components/theater/ResolutionTheaterApp";

type BootPhase = "splash" | "desktop";

export function ChamberHome() {
  const [phase, setPhase] = useState<BootPhase>("splash");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const skip = params.get("desk") === "1" || params.get("boot") === "0" || window.location.hash === "#desk";
    if (skip) {
      setPhase("desktop");
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setPhase("desktop"), reduced ? 200 : 1100);
    return () => window.clearTimeout(timer);
  }, []);

  if (phase === "splash") {
    return (
      <main className="chamber-root flex min-h-screen flex-col items-center justify-center px-6 text-[#f4efe4]" aria-busy="true">
        <p className="font-board text-xs tracking-[0.4em] text-[#e8b84a]">AEGIS OS</p>
        <h1 className="mt-4 font-board text-5xl uppercase tracking-wide sm:text-6xl">Dispute Runtime</h1>
        <p className="mt-4 max-w-md text-center text-sm text-white/60">
          Booting shared desktop · binding WebMCP · loading provider counters
        </p>
        <div className="os-boot-bar mt-10 h-1 w-48 overflow-hidden bg-white/10" aria-hidden>
          <div className="os-boot-fill h-full bg-[#e8b84a]" />
        </div>
        <button
          type="button"
          className="theater-btn mt-8 text-sm text-[#e8b84a]/80 underline-offset-4 hover:underline"
          onClick={() => setPhase("desktop")}
        >
          Skip boot
        </button>
      </main>
    );
  }

  return <ResolutionTheaterApp />;
}
