"use client";

import { useEffect, useRef, useState } from "react";
import {
  discoverRegisteredToolNames,
  registerTheaterTools,
  runTheaterTool,
} from "@/components/theater/register-theater-tools";
import type { TheaterToolName } from "@/src/domain/theater/tools";

export function TheaterWebMcp({
  onStatus,
}: {
  onStatus: (ready: boolean, reason: string, tools: string[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const onStatusRef = useRef(onStatus);
  const registeredRef = useRef(false);
  onStatusRef.current = onStatus;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const context = document.modelContext;
    if (!context?.registerTool) {
      onStatusRef.current(
        false,
        "WebMCP is off in this browser. Open this URL in ChatGPT’s in-app browser, or Chrome 149+ with chrome://flags/#enable-webmcp-testing.",
        [],
      );
      return;
    }

    if (registeredRef.current) {
      onStatusRef.current(
        true,
        "Tools are on this page. The desk moves when they run.",
        discoverRegisteredToolNames(context),
      );
      return;
    }

    const names = registerTheaterTools(context, (name: TheaterToolName, input) =>
      runTheaterTool(name, input),
    );
    registeredRef.current = true;
    const discovered = discoverRegisteredToolNames(context);
    onStatusRef.current(
      true,
      `WebMCP ready · ${names.length} tools on this URL.`,
      discovered.length > 0 ? discovered : names,
    );
  }, [mounted]);

  return null;
}
