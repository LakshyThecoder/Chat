export type MailDeskStatus =
  | "DETECTED"
  | "BILL_IMPORTED"
  | "POLICY_CHECKED"
  | "DRAFTED"
  | "AWAITING_SIGNATURE"
  | "APPROVED"
  | "DENIED"
  | "SENT"
  | "VERIFIED"
  | "FAILED";

export interface MailDeskBill {
  messageKey: string;
  filename: string;
  merchant: string;
  invoiceId: string;
  amount: string;
  currency: string;
  billedAt: string;
  cancelledAt: string | null;
  planName: string;
  supportAddress: string;
  bodyText: string;
}

export interface MailDeskPolicy {
  provider: string;
  policyKey: string;
  version: string;
  title: string;
  body: string;
  source: string;
}

export interface MailDeskDraft {
  toAddress: string;
  subject: string;
  body: string;
  amount: string;
  currency: string;
  invoiceId: string;
}

export interface MailDeskVerification {
  matched: boolean;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
}

export interface MailDeskItemSnapshot {
  id: string;
  messageKey: string;
  title: string;
  merchant: string;
  status: MailDeskStatus;
  hint: string;
  fromAddress: string;
  subject: string;
  bill: MailDeskBill | null;
  policy: MailDeskPolicy | null;
  draft: MailDeskDraft | null;
  approval: {
    state: "unsigned" | "approved" | "denied";
    approvedAmount: string | null;
    approvedCurrency: string | null;
  };
  outboundId: string | null;
  verification: MailDeskVerification | null;
  nextActions: string[];
}

export interface MailDeskSnapshot {
  sessionId: string;
  expiresAt: string;
  expired: boolean;
  items: MailDeskItemSnapshot[];
}
