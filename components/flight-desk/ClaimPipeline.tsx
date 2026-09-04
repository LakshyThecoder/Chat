"use client";

import type { TheaterWorkItemStatus } from "@/src/domain/theater/types";

const STAGES = ["Proposed", "Entitled", "Ask", "Approved", "Filed", "Matched"] as const;

function rank(status: TheaterWorkItemStatus | null): number {
  switch (status) {
    case "UNINSPECTED":
      return 0;
    case "INSPECTED":
    case "ENTITLED":
      return 1;
    case "PREPARED":
    case "AWAITING_SIGNATURE":
      return 2;
    case "APPROVED":
      return 3;
    case "EXECUTED":
      return 4;
    case "VERIFIED":
      return 5;
    default:
      return -1;
  }
}

export function ClaimPipeline({
  status,
  blocked,
  failed,
}: {
  status: TheaterWorkItemStatus | null;
  blocked: boolean;
  failed: boolean;
}) {
  const current = rank(status);

  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Claim state">
      {STAGES.map((label, index) => {
        const reached = current >= index;
        return (
          <li
            key={label}
            className="flex items-center gap-2 text-sm"
            aria-current={current === index ? "step" : undefined}
            style={{
              color: blocked || failed ? "var(--notam)" : reached ? "var(--chart)" : "var(--mist)",
            }}
          >
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: reached ? (blocked || failed ? "var(--notam)" : "var(--recovered)") : "transparent",
                boxShadow: reached ? "none" : "inset 0 0 0 1px var(--mist)",
              }}
            />
            {label}
          </li>
        );
      })}
    </ol>
  );
}
