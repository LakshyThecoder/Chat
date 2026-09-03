"use client";

import { useEffect } from "react";
import { ResolutionTheaterApp } from "@/components/theater/ResolutionTheaterApp";
import { ChamberManifesto } from "@/components/landing/ChamberManifesto";

export function ChamberHome() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.get("desk") === "1" || hash === "#desk") {
      window.requestAnimationFrame(() => {
        document.getElementById("desk")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  return (
    <div className="bg-[#071525]">
      <ChamberManifesto />
      <div id="desk" className="scroll-mt-0 border-t border-[#e8b84a]/30">
        <ResolutionTheaterApp />
      </div>
    </div>
  );
}
