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
      problem: "Carrier cancelled the flight. The ticket was unused. File the unused fare. EU261 may add statutory cash.",
      source: "Live FlyRight booking issued for this desk visit.",
    };
  }
  if (identity.providerId === "streamly") {
    return {
      problem: "Out of scope on the flight desk. Do not file this item.",
      source: "Non-flight leftover. Ignore it.",
    };
  }
  return {
    problem: "Out of scope on the flight desk. Do not file it here.",
    source: "Non-flight leftover. Ignore it.",
  };
}
