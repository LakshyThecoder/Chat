import type { TheaterToolName } from "@/src/domain/theater/tools";

export function ledgerCopy(input: {
  name: string;
  ok: boolean;
  code?: string;
  amount?: string | null;
}): { headline: string; detail: string } {
  const name = input.name as TheaterToolName | string;
  if (!input.ok) {
    if (input.code === "APPROVAL_REQUIRED") {
      return {
        headline: "Filing blocked — human signature required",
        detail: "execute_filing refused because this page has not signed the prepared amount.",
      };
    }
    if (input.code === "NOT_ELIGIBLE") {
      return {
        headline: "Counter says no — do not file",
        detail: "This row is ineligible. Leave it blocked.",
      };
    }
    return {
      headline: `${name} failed`,
      detail: input.code ? `${input.code}` : "Tool returned an error.",
    };
  }

  switch (name) {
    case "list_work_items":
      return { headline: "Agent listed the desk", detail: "Three disputes, live states." };
    case "get_work_item":
      return { headline: "Agent opened one dispute", detail: "Read current state and next actions." };
    case "inspect_counter":
      return { headline: "Agent read the live provider row", detail: "Passenger or plan painted on this page." };
    case "compute_entitlement":
      return {
        headline: input.amount
          ? `Software calculated ${input.amount} from policy`
          : "Software evaluated entitlement",
        detail: "The model does not own this amount.",
      };
    case "prepare_filing":
      return { headline: "Filing prepared", detail: "Payload, amount, and expected verification are frozen." };
    case "request_signature":
      return { headline: "Human signature required", detail: "The person on this page must sign the amount." };
    case "execute_filing":
      return { headline: "Agent filed at the provider", detail: "Do not call this done until verify_filing matches." };
    case "verify_filing":
      return { headline: "Provider row re-read", detail: "Expected vs observed must match." };
    default:
      return { headline: name, detail: "Tool wrote into this page." };
  }
}
