import type { TheaterWorkItemIdentity } from "@/src/domain/theater/types";

export const THEATER_BLOCKED_BOOKING = {
  locator: "FR0999",
  lastName: "BERG",
} as const;

export function isCatalogBlocked(identity: TheaterWorkItemIdentity): boolean {
  return (
    identity.providerId === "flyright" &&
    identity.locator === THEATER_BLOCKED_BOOKING.locator &&
    identity.lastName === THEATER_BLOCKED_BOOKING.lastName
  );
}

export function workItemNarrative(identity: TheaterWorkItemIdentity): {
  problem: string;
  source: string;
} {
  if (isCatalogBlocked(identity)) {
    return {
      problem: "This booking already has a claim on file. A second filing would be a duplicate.",
      source: "FlyRight catalog row FR0999 / BERG — persisted sandbox, not a prompt.",
    };
  }
  if (identity.providerId === "flyright") {
    return {
      problem: "Carrier cancelled the flight. The ticket was unused. The fare should come back.",
      source: "Live FlyRight booking issued for this desk visit.",
    };
  }
  if (identity.providerId === "streamly") {
    return {
      problem: "The plan was cancelled, then Streamly charged again. That charge should reverse.",
      source: "Live Streamly subscription issued for this desk visit.",
    };
  }
  return {
    problem: "Warranty path is not on this desk. Do not file it here.",
    source: "ElectroMart is not issued in the judge session.",
  };
}
