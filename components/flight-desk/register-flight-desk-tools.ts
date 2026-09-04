import { airlineInboxForDesk } from "@/src/domain/flight-desk/inbox-catalog";
import { bookingFromCounter, isFlyRightItem, rightsFromWorkItem } from "@/src/domain/flight-desk/rights-from-item";
import { runTheaterTool } from "@/components/theater/register-theater-tools";
import { pulseTheaterTool } from "@/components/theater/pulse";
import type { TheaterSnapshot } from "@/src/domain/theater/types";

export const FLIGHT_DESK_EXTRA_TOOL_NAMES = [
  "scan_airline_mail",
  "get_travel_graph",
  "get_disruption",
  "compute_rights",
  "research_passenger_rights",
  "prepare_claim",
] as const;

export type FlightDeskExtraToolName = (typeof FLIGHT_DESK_EXTRA_TOOL_NAMES)[number];
export const FLIGHT_DESK_FOCUS_EVENT = "aegis:flight-desk:focus";
export const FLIGHT_DESK_RESEARCH_EVENT = "aegis:flight-desk:research";

export interface FlightDeskFocusDetail {
  workItemId?: string;
  mailId?: string;
  target: "flight" | "inbox" | "trips" | "evidence";
}

const noInput = { type: "object", additionalProperties: false, properties: {} } as const;
const workItemInput = {
  type: "object",
  additionalProperties: false,
  properties: {
    workItemId: { type: "string", format: "uuid", description: "Optional FlyRight work item id." },
  },
} as const;

export const FLIGHT_DESK_EXTRA_TOOLS: Array<{
  name: FlightDeskExtraToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}> = [
  {
    name: "scan_airline_mail",
    description:
      "Read the connected airline inbox on this page: bookings, cancellations, claim notices, and promotional mail. Promos are not junk — they reveal future trips to watch.",
    inputSchema: noInput,
  },
  {
    name: "get_travel_graph",
    description:
      "Build the travel graph from airline mail plus live FlyRight bookings on this desk. Includes watched promo itineraries.",
    inputSchema: noInput,
  },
  {
    name: "get_disruption",
    description:
      "Open the active disruption: scheduled vs actual, rights clock, and whether FR0999 / BERG is blocked.",
    inputSchema: workItemInput,
  },
  {
    name: "compute_rights",
    description:
      "Compute EU261 / UK261 / DOT / unused-fare rights from observed facts. Software owns amounts. Does not file.",
    inputSchema: workItemInput,
  },
  {
    name: "research_passenger_rights",
    description:
      "Search current official government sources for the active flight's passenger-rights regime. Returns citations and excerpts; never changes a claim or authoritative amount.",
    inputSchema: workItemInput,
  },
  {
    name: "prepare_claim",
    description:
      "Prepare the FlyRight filing for an eligible cancellation. Same as prepare_filing. Does not execute. Refuses FR0999 / BERG.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["workItemId"],
      properties: {
        workItemId: { type: "string", format: "uuid", description: "Work item id from list_work_items." },
      },
    },
  },
];

async function loadTheater(): Promise<TheaterSnapshot | null> {
  const response = await fetch("/api/demo/theater/session", { method: "GET" });
  if (!response.ok) return null;
  const payload = (await response.json()) as { theater?: TheaterSnapshot };
  return payload.theater ?? null;
}

function pickFlyRight(theater: TheaterSnapshot | null, workItemId?: string) {
  const flights = (theater?.items ?? []).filter(isFlyRightItem);
  if (workItemId) {
    return flights.find((item) => item.id === workItemId) ?? flights[0] ?? null;
  }
  return flights.find((item) => !item.catalogBlocked) ?? flights[0] ?? null;
}

export async function runFlightDeskExtraTool(
  name: FlightDeskExtraToolName,
  input: Record<string, unknown>,
) {
  const workItemId = typeof input.workItemId === "string" ? input.workItemId : undefined;

  if (name === "prepare_claim") {
    if (!workItemId) {
      throw new Error("workItemId is required for prepare_claim.");
    }
    return runTheaterTool("prepare_filing", { workItemId });
  }

  const theater = await loadTheater();
  const item = pickFlyRight(theater, workItemId);
  const inbox = airlineInboxForDesk();

  let payload: Record<string, unknown>;
  if (name === "scan_airline_mail") {
    payload = {
      inbox,
      connected: Boolean(theater),
      note: "Promotional mail is kept. It can reveal a future itinerary to watch.",
    };
  } else if (name === "get_travel_graph") {
    payload = {
      flights: (theater?.items ?? []).filter(isFlyRightItem).map((entry) => ({
        workItemId: entry.id,
        title: entry.title,
        status: entry.status,
        identity: entry.identity,
        catalogBlocked: entry.catalogBlocked,
        entitlement: entry.entitlement,
      })),
      watched: inbox.filter((thread) => thread.watchOnly),
    };
  } else if (!item) {
    payload = { empty: true, message: "Connect the airline inbox on this page first." };
  } else if (name === "get_disruption") {
    payload = { item, rights: rightsFromWorkItem(item) };
  } else if (name === "research_passenger_rights") {
    const booking = bookingFromCounter(item.counter);
    const rights = rightsFromWorkItem(item);
    const regime = rights.applicableRegimes.find(
      (value) => value === "EU261" || value === "UK261" || value === "DOT",
    );
    const origin = booking?.origin;
    const destination = booking?.destination;
    if (!origin || !destination || !regime) {
      throw new Error("Observed route and rights regime are required before research.");
    }
    const response = await fetch("/api/intelligence/passenger-rights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        regime,
        disruption: booking.cancelledByCarrier ? "cancelled" : "delayed",
      }),
    });
    const result = (await response.json()) as Record<string, unknown> & {
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(result.error?.message ?? "Official-source research failed.");
    payload = { ...result, authoritativeAmount: false };
    window.dispatchEvent(new CustomEvent(FLIGHT_DESK_RESEARCH_EVENT, { detail: payload }));
  } else {
    payload = {
      item,
      rights: rightsFromWorkItem(item),
      filingNote: "The sandbox files the unused-fare refund. Statutory EU261 cash is a separate computed line.",
    };
  }

  pulseTheaterTool({
    name,
    ok: true,
    message: `${name} updated this desk`,
    at: new Date().toISOString(),
    input,
    output: payload,
  });
  const target =
    name === "scan_airline_mail"
      ? "inbox"
      : name === "get_travel_graph"
        ? "trips"
        : name === "research_passenger_rights"
          ? "evidence"
          : "flight";
  window.dispatchEvent(
    new CustomEvent<FlightDeskFocusDetail>(FLIGHT_DESK_FOCUS_EVENT, {
      detail: {
        target,
        workItemId: item?.id,
        mailId: name === "scan_airline_mail" ? inbox.find((thread) => thread.kind === "cancel")?.id : undefined,
      },
    }),
  );
  return payload;
}

export function registerFlightDeskExtraTools(
  context: NonNullable<Document["modelContext"]>,
): string[] {
  const bound: string[] = [];
  for (const tool of FLIGHT_DESK_EXTRA_TOOLS) {
    try {
      context.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (input: Record<string, unknown>) => runFlightDeskExtraTool(tool.name, input ?? {}),
      });
      bound.push(tool.name);
    } catch {
      bound.push(tool.name);
    }
  }
  return bound;
}
