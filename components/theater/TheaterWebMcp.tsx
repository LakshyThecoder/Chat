"use client";

import {
  discoverRegisteredToolNames,
  registerTheaterTools,
  runTheaterTool,
  theaterToolsHealthy,
} from "@/components/theater/register-theater-tools";
import type { TheaterToolName } from "@/src/domain/theater/tools";
import { useEffect, useRef, useState } from "react";

export const THEATER_WEBMCP_STATUS_EVENT = "aegis:theater:webmcp-status";

export type TheaterWebMcpStatus = {
  ready: boolean;
  reason: string;
  tools: string[];
};

function publishStatus(status: TheaterWebMcpStatus) {
  window.dispatchEvent(new CustomEvent<TheaterWebMcpStatus>(THEATER_WEBMCP_STATUS_EVENT, { detail: status }));
}

function bindNow(onStatus: (status: TheaterWebMcpStatus) => void): boolean {
  try {
    const context = document.modelContext;
    if (!context?.registerTool) {
      const status = {
        ready: false,
        reason:
          "WebMCP is off in this browser. Open this URL in ChatGPT’s in-app browser, or Chrome 149+ with chrome://flags/#enable-webmcp-testing.",
        tools: [] as string[],
      };
      onStatus(status);
      publishStatus(status);
      return false;
    }

    const names = registerTheaterTools(context, (name: TheaterToolName, input) => runTheaterTool(name, input));
    const discovered = discoverRegisteredToolNames(context);
    const healthy = theaterToolsHealthy(context);
    const status = {
      ready: healthy,
      reason: healthy
        ? `WebMCP online · ${discovered.length || names.length} tools live on this desktop.`
        : "WebMCP partially bound — rebinding…",
      tools: discovered.length > 0 ? discovered : names,
    };
    onStatus(status);
    publishStatus(status);
    return healthy;
  } catch (error) {
    const status = {
      ready: false,
      reason: error instanceof Error ? `WebMCP bind failed: ${error.message}` : "WebMCP bind failed.",
      tools: [] as string[],
    };
    onStatus(status);
    publishStatus(status);
    return false;
  }
}

/**
 * Binds theater tools as soon as the document can, retries until healthy,
 * and rebinds on pageshow / visibility so refresh never leaves dead tools.
 */
export function TheaterWebMcp({
  onStatus,
}: {
  onStatus?: (ready: boolean, reason: string, tools: string[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const emit = (status: TheaterWebMcpStatus) => {
      onStatusRef.current?.(status.ready, status.reason, status.tools);
    };

    bindNow(emit);

    let attempts = 0;
    const retry = window.setInterval(() => {
      attempts += 1;
      const context = document.modelContext;
      if (!context?.registerTool) {
        bindNow(emit);
        return;
      }
      if (!theaterToolsHealthy(context) || attempts % 4 === 0) {
        // Unhealthy: rebind now. Healthy: soft-refresh handlers every ~6s.
        bindNow(emit);
      }
    }, 1500);

    function onShow() {
      bindNow(emit);
    }

    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    document.addEventListener("visibilitychange", onShow);

    return () => {
      window.clearInterval(retry);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [mounted]);

  return null;
}
