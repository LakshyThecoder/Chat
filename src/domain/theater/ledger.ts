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
        headline: "Blocked — human signature required",
        detail:
          name.includes("send") || name.includes("mail")
            ? "send_support_email refused until this page signs the refund amount."
            : "execute_filing refused because this page has not signed the prepared amount.",
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
    case "scan_airline_mail":
    case "get_travel_graph":
      return { headline: "Agent read the airline inbox", detail: "Bookings, cancellations, and promo trips on this desk." };
    case "get_disruption":
      return { headline: "Agent opened the disruption", detail: "Scheduled vs actual vs rights clock." };
    case "compute_rights":
      return {
        headline: input.amount
          ? `Software calculated ${input.amount} from passenger-rights rules`
          : "Software evaluated passenger rights",
        detail: "EU261 / UK261 / DOT / fare refund. The model does not own this amount.",
      };
    case "prepare_claim":
      return { headline: "Claim prepared", detail: "Payload, amount, and expected verification are frozen." };
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
    case "begin_resolution":
      return {
        headline: "Resolution started — signatures required",
        detail: "Eligible disputes prepared. Blocked bookings left alone. Agent will not file yet.",
      };
    case "continue_resolution":
      return {
        headline: "Signed filings executed and verified",
        detail: "Only APPROVED items filed. Success requires matched verify_filing.",
      };
    case "begin_mail_resolution":
      return {
        headline: "Mailbox scanned — signatures required",
        detail: "Bills imported and support emails drafted. Agent will not send yet.",
      };
    case "list_mail_disputes":
      return { headline: "Agent listed mail disputes", detail: "Sandbox mailbox states." };
    case "inspect_mail":
      return { headline: "Agent opened a mail dispute", detail: "Message painted on Mail Disputes." };
    case "import_bill":
      return { headline: "Bill imported from mailbox", detail: "Amount comes from the invoice, not the model." };
    case "lookup_refund_policy":
      return { headline: "Refund policy loaded", detail: "Provenance attached. Software owns eligibility." };
    case "prepare_support_email":
      return { headline: "Support email drafted", detail: "Ready for human signature. Not sent." };
    case "request_mail_signature":
      return { headline: "Outbound UAC required", detail: "Sign the refund amount before send." };
    case "send_support_email":
      return { headline: "Support email sent", detail: "Do not call this done until verify_sent matches." };
    case "verify_sent":
      return { headline: "Outbound mail re-read", detail: "Expected vs observed must match." };
    default:
      return { headline: name, detail: "Tool wrote into this page." };
  }
}
