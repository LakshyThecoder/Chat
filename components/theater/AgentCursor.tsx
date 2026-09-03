"use client";

import { useEffect, useRef, useState } from "react";
import { THEATER_WEBMCP_EVENT, type TheaterToolPulse } from "@/components/theater/pulse";

type Pos = { x: number; y: number };

function targetForTool(name: string): string {
  if (
    name.includes("mail") ||
    name === "import_bill" ||
    name === "lookup_refund_policy" ||
    name === "prepare_support_email" ||
    name === "send_support_email" ||
    name === "verify_sent" ||
    name === "begin_mail_resolution"
  ) {
    return '[data-agent-target="mail"]';
  }
  if (name.includes("signature") || name === "begin_resolution" || name === "request_signature") {
    return '[data-agent-target="uac"], [data-agent-target="processes"]';
  }
  if (name === "execute_filing" || name === "continue_resolution" || name === "verify_filing") {
    return '[data-agent-target="inspector"]';
  }
  if (name === "inspect_counter" || name === "compute_entitlement" || name === "prepare_filing") {
    return '[data-agent-target="inspector"]';
  }
  if (name === "list_work_items" || name === "get_work_item") {
    return '[data-agent-target="processes"]';
  }
  return '[data-agent-target="console"]';
}

function centerOf(el: Element | null): Pos | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 && rect.height < 2) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height / 2, 120) };
}

/**
 * Fast agent cursor — flies to the live OS surface when WebMCP tools fire.
 */
export function AgentCursor() {
  const [pos, setPos] = useState<Pos>({ x: 48, y: 120 });
  const [label, setLabel] = useState("idle");
  const [active, setActive] = useState(false);
  const [ok, setOk] = useState(true);
  const [trail, setTrail] = useState<Pos[]>([]);
  const reducedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const currentRef = useRef<Pos>({ x: 48, y: 120 });
  const targetRef = useRef<Pos>({ x: 48, y: 120 });

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    function tick() {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      const dx = tgt.x - cur.x;
      const dy = tgt.y - cur.y;
      // Crazy-fast ease: eat most of the distance every frame.
      const next = {
        x: cur.x + dx * 0.55,
        y: cur.y + dy * 0.55,
      };
      if (Math.abs(dx) < 0.8 && Math.abs(dy) < 0.8) {
        currentRef.current = tgt;
        setPos(tgt);
        rafRef.current = null;
        return;
      }
      currentRef.current = next;
      setPos(next);
      setTrail((prev) => [{ ...next }, ...prev].slice(0, 5));
      rafRef.current = window.requestAnimationFrame(tick);
    }

    function flyTo(next: Pos, name: string, success: boolean) {
      targetRef.current = next;
      setLabel(name);
      setOk(success);
      setActive(true);
      if (reducedRef.current) {
        currentRef.current = next;
        setPos(next);
        return;
      }
      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    }

    function onPulse(event: Event) {
      const detail = (event as CustomEvent<TheaterToolPulse>).detail;
      if (!detail) return;
      const node = document.querySelector(targetForTool(detail.name));
      const point = centerOf(node) ?? {
        x: window.innerWidth * (0.35 + Math.random() * 0.3),
        y: window.innerHeight * (0.25 + Math.random() * 0.35),
      };
      // Small jitter so multi-tool storms look alive.
      flyTo(
        {
          x: point.x + (Math.random() * 24 - 12),
          y: point.y + (Math.random() * 18 - 9),
        },
        detail.name,
        detail.ok,
      );
      window.setTimeout(() => setActive(false), 900);
    }

    window.addEventListener(THEATER_WEBMCP_EVENT, onPulse);
    return () => {
      window.removeEventListener(THEATER_WEBMCP_EVENT, onPulse);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden>
      {trail.map((point, index) => (
        <span
          key={`${point.x}-${point.y}-${index}`}
          className="agent-cursor-trail absolute block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e8b84a]"
          style={{
            left: point.x,
            top: point.y,
            opacity: 0.35 - index * 0.06,
            transform: `translate(-50%, -50%) scale(${1 - index * 0.12})`,
          }}
        />
      ))}
      <div
        className={`agent-cursor absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150 ${
          active ? "opacity-100" : "opacity-40"
        }`}
        style={{ left: pos.x, top: pos.y }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
          <path
            d="M4 3.5L20 12.2L12.4 14.1L9.8 21.5L4 3.5Z"
            fill={ok ? "#e8b84a" : "#ffb4a8"}
            stroke="#0b1f3a"
            strokeWidth="1.2"
          />
        </svg>
        <span
          className={`mt-1 block whitespace-nowrap border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
            ok ? "border-[#e8b84a]/60 bg-[#0b1f3a] text-[#e8b84a]" : "border-[#ffb4a8]/60 bg-[#0b1f3a] text-[#ffb4a8]"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
