import type { MailDeskBill } from "@/src/domain/mail-desk/types";

/** Inbound mailbox — sandbox now, Gmail later on the same contract. */
export interface MailSourcePort {
  listDisputeMessageKeys(): Promise<string[]>;
  getMessageMeta(messageKey: string): Promise<{
    subject: string;
    fromAddress: string;
    hint: string;
    body: string;
  } | null>;
  getBill(messageKey: string): Promise<MailDeskBill | null>;
}

export interface OutboundMailSendInput {
  toAddress: string;
  subject: string;
  body: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
}

export interface OutboundMailRecord {
  id: string;
  status: "QUEUED" | "SENT" | "FAILED";
  providerMessageId: string | null;
  toAddress: string;
  subject: string;
  amount: string;
  currency: string;
}

/** Outbound send — sandbox writes outbound_mail; Gmail send uses the same shape after OAuth. */
export interface OutboundMailPort {
  send(input: OutboundMailSendInput): Promise<OutboundMailRecord>;
  getByIdempotencyKey(idempotencyKey: string): Promise<OutboundMailRecord | null>;
}
