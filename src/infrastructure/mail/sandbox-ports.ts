import "server-only";

import type { MailSourcePort, OutboundMailPort, OutboundMailSendInput } from "@/src/domain/mail-desk/ports";
import type { MailDeskBill } from "@/src/domain/mail-desk/types";
import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import { randomBytes } from "crypto";

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export function createSandboxMailSource(disputeKeys: readonly string[]): MailSourcePort {
  return {
    async listDisputeMessageKeys() {
      return [...disputeKeys];
    },
    async getMessageMeta(messageKey) {
      const { data, error } = await createAdminSupabaseClient()
        .from("mail_messages")
        .select("subject, from_address, hint, body")
        .eq("message_key", messageKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        subject: String(data.subject),
        fromAddress: String(data.from_address),
        hint: String(data.hint),
        body: String(data.body),
      };
    },
    async getBill(messageKey): Promise<MailDeskBill | null> {
      const { data, error } = await createAdminSupabaseClient()
        .from("mail_bill_catalog")
        .select("*")
        .eq("message_key", messageKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        messageKey: String(data.message_key),
        filename: String(data.filename),
        merchant: String(data.merchant),
        invoiceId: String(data.invoice_id),
        amount: money(data.amount),
        currency: String(data.currency),
        billedAt: String(data.billed_at),
        cancelledAt: data.cancelled_at ? String(data.cancelled_at) : null,
        planName: String(data.plan_name),
        supportAddress: String(data.support_address),
        bodyText: String(data.body_text),
      };
    },
  };
}

export function createSandboxOutboundMail(sessionId: string, itemId: string): OutboundMailPort {
  const client = createAdminSupabaseClient();
  return {
    async getByIdempotencyKey(idempotencyKey) {
      const { data, error } = await client
        .from("outbound_mail")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: String(data.id),
        status: data.status as "QUEUED" | "SENT" | "FAILED",
        providerMessageId: data.provider_message_id ? String(data.provider_message_id) : null,
        toAddress: String(data.to_address),
        subject: String(data.subject),
        amount: money(data.amount),
        currency: String(data.currency),
      };
    },
    async send(input: OutboundMailSendInput) {
      const existing = await this.getByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
      const providerMessageId = `sandbox-${randomBytes(6).toString("hex")}`;
      const { data, error } = await client
        .from("outbound_mail")
        .insert({
          session_id: sessionId,
          item_id: itemId,
          to_address: input.toAddress,
          subject: input.subject,
          body: input.body,
          amount: input.amount,
          currency: input.currency,
          idempotency_key: input.idempotencyKey,
          status: "SENT",
          provider_message_id: providerMessageId,
        })
        .select("*")
        .single();
      if (error) {
        const replay = await this.getByIdempotencyKey(input.idempotencyKey);
        if (replay) return replay;
        throw new Error(error.message);
      }
      return {
        id: String(data.id),
        status: "SENT",
        providerMessageId,
        toAddress: input.toAddress,
        subject: input.subject,
        amount: input.amount,
        currency: input.currency,
      };
    },
  };
}
