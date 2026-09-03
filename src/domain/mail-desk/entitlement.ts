import type { MailDeskBill, MailDeskPolicy } from "@/src/domain/mail-desk/types";

export function evaluateBilledAfterCancel(params: {
  bill: MailDeskBill;
  policy: MailDeskPolicy;
}): { eligible: boolean; amount: string; currency: string; reasons: string[] } {
  const reasons: string[] = [];
  if (!params.bill.cancelledAt) {
    reasons.push("No cancellation date on the bill — not eligible under billed-after-cancel.");
    return { eligible: false, amount: "0.00", currency: params.bill.currency, reasons };
  }

  const cancelled = Date.parse(params.bill.cancelledAt);
  const billed = Date.parse(params.bill.billedAt);
  if (!Number.isFinite(cancelled) || !Number.isFinite(billed)) {
    reasons.push("Bill dates are malformed.");
    return { eligible: false, amount: "0.00", currency: params.bill.currency, reasons };
  }

  if (billed <= cancelled) {
    reasons.push("Charge occurred on or before cancellation — not billed-after-cancel.");
    return { eligible: false, amount: "0.00", currency: params.bill.currency, reasons };
  }

  reasons.push(
    `${params.policy.title}: charge after cancel → full refund of invoice ${params.bill.invoiceId}.`,
  );
  return {
    eligible: true,
    amount: params.bill.amount,
    currency: params.bill.currency,
    reasons,
  };
}

export function buildSupportDraft(params: {
  bill: MailDeskBill;
  policy: MailDeskPolicy;
  eligibility: { eligible: boolean; amount: string; currency: string; reasons: string[] };
}): {
  toAddress: string;
  subject: string;
  body: string;
  amount: string;
  currency: string;
  invoiceId: string;
} {
  const amount = params.eligibility.amount;
  const currency = params.eligibility.currency;
  return {
    toAddress: params.bill.supportAddress,
    subject: `Refund request — ${params.bill.invoiceId} (${currency} ${amount})`,
    body: [
      `Hello ${params.bill.merchant} Support,`,
      "",
      `I cancelled ${params.bill.planName} on ${params.bill.cancelledAt?.slice(0, 10) ?? "unknown"}, but invoice ${params.bill.invoiceId} charged ${currency} ${amount} on ${params.bill.billedAt.slice(0, 10)}.`,
      "",
      `Under your policy (${params.policy.title}, ${params.policy.version}), I request a full refund of ${currency} ${amount}.`,
      "",
      "Evidence: the attached invoice from my mailbox.",
      "",
      "Thank you,",
      "Camille Moreau",
    ].join("\n"),
    amount,
    currency,
    invoiceId: params.bill.invoiceId,
  };
}
