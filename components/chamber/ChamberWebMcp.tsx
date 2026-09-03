"use client";

import { useEffect, useRef, useState } from "react";
import { CHAMBER_STATE_EVENT, pulseChamberTool } from "@/components/chamber/pulse";
import type { ChamberSnapshot } from "@/src/domain/chamber/types";

const lookupSchema = {
  type: "object",
  additionalProperties: false,
  required: ["locator", "lastName"],
  properties: {
    locator: {
      type: "string",
      description: "Booking locator printed on the human stub, e.g. AG7K2M",
    },
    lastName: { type: "string", description: "Passenger last name" },
  },
};

async function runTool(name: string, input: Record<string, unknown>) {
  const response = await fetch("/api/demo/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: name, input }),
  });
  const payload = (await response.json()) as {
    error?: { message?: string; code?: string };
    chamber?: ChamberSnapshot;
  };
  if (!response.ok) {
    const message = payload.error?.message ?? `${name} failed`;
    pulseChamberTool({ name, ok: false, message, at: new Date().toISOString() });
    if (payload.chamber) {
      window.dispatchEvent(new CustomEvent(CHAMBER_STATE_EVENT, { detail: payload.chamber }));
    }
    throw new Error(message);
  }
  pulseChamberTool({
    name,
    ok: true,
    message: `${name} wrote into this page`,
    at: new Date().toISOString(),
  });
  if (payload.chamber) {
    window.dispatchEvent(new CustomEvent(CHAMBER_STATE_EVENT, { detail: payload.chamber }));
  }
  return payload;
}

export function ChamberWebMcp({
  locator,
  lastName,
  onStatus,
}: {
  locator: string;
  lastName: string;
  onStatus: (ready: boolean, reason: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const context = document.modelContext;
    if (!context?.registerTool) {
      onStatusRef.current(
        false,
        "WebMCP is off in this browser. Open this URL in ChatGPT’s in-app browser, or Chrome 149+ with chrome://flags/#enable-webmcp-testing.",
      );
      return;
    }

    const ticketHint = `This page is holding ${locator} / ${lastName}. Use those values unless you are probing FR2201/KLEIN (ineligible) or FR0999/BERG (already claimed).`;
    const registerTool = context.registerTool.bind(context);

    if (document.modelContext) {
      document.modelContext.registerTool({
        name: "get_booking",
        description: `Look up a FlyRight booking and paint it on the carrier desk. ${ticketHint}`,
        inputSchema: lookupSchema,
        execute: (input) => runTool("get_booking", input),
      });
    }
    registerTool({
      name: "get_flight_status",
      description: `Read live flight status for a booking. ${ticketHint}`,
      inputSchema: lookupSchema,
      execute: (input) => runTool("get_flight_status", input),
    });
    registerTool({
      name: "get_policy",
      description: "Read FlyRight’s published unused-fare cancellation policy.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => runTool("get_policy", {}),
    });
    registerTool({
      name: "calculate_compensation",
      description: `Calculate the unused-fare refund from the live booking and policy. Does not file. ${ticketHint}`,
      inputSchema: lookupSchema,
      execute: (input) => runTool("calculate_compensation", input),
    });
    registerTool({
      name: "get_claim_status",
      description: "Read whether a FlyRight claim already exists.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          claimId: { type: "string" },
          locator: { type: "string" },
        },
      },
      execute: (input) => runTool("get_claim_status", input),
    });
    registerTool({
      name: "get_chamber",
      description:
        "Read the human file on this page: ticket, eligibility, whether the person has signed, and last verification.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => runTool("get_chamber", {}),
    });
    registerTool({
      name: "submit_claim",
      description:
        "File the unused-fare claim for THIS page’s ticket. Fails until the human signs. Fails if ineligible, already claimed, or the amount does not match the signed figure. Paints the claim on the desk and re-reads provider state.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["locator", "lastName", "amount"],
        properties: {
          locator: { type: "string" },
          lastName: { type: "string" },
          amount: { type: "string", description: "Exact fare amount, e.g. 183.40" },
          currency: { type: "string" },
        },
      },
      execute: (input) => runTool("submit_claim", input),
    });

    onStatusRef.current(true, "WebMCP tools are registered on this page. The desk moves when they run.");
  }, [locator, lastName, mounted]);

  return null;
}
