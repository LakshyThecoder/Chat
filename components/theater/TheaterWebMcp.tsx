"use client";

import {
  discoverRegisteredToolNames,
  registerTheaterTools,
  runTheaterTool,
} from "@/components/theater/register-theater-tools";
import type { TheaterToolName } from "@/src/domain/theater/tools";
import { useEffect, useRef, useState } from "react";

/** Survives React Strict Mode remounts in the same document. */
let theaterToolsBound = false;

export function TheaterWebMcp({
  onStatus,
}: {
  onStatus: (ready: boolean, reason: string, tools: string[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    try {
      const context = document.modelContext;
      if (!context?.registerTool) {
        onStatusRef.current(
          false,
          "WebMCP is off in this browser. Open this URL in ChatGPT’s in-app browser, or Chrome 149+ with chrome://flags/#enable-webmcp-testing.",
          [],
        );
        return;
      }

      let names: string[];
      if (!theaterToolsBound) {
        names = registerTheaterTools(context, (name: TheaterToolName, input) => runTheaterTool(name, input));
        theaterToolsBound = true;
      } else {
        names = discoverRegisteredToolNames(context);
        if (names.length === 0) {
          names = registerTheaterTools(context, (name: TheaterToolName, input) => runTheaterTool(name, input));
        }
      }

      onStatusRef.current(true, `WebMCP online · ${names.length} tools bound to this desktop.`, names);
    } catch (error) {
      theaterToolsBound = false;
      onStatusRef.current(
        false,
        error instanceof Error ? `WebMCP bind failed: ${error.message}` : "WebMCP bind failed.",
        [],
      );
    }
  }, [mounted]);

  return null;
}
