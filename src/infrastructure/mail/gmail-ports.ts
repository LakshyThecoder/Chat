import "server-only";

import type { MailSourcePort, OutboundMailPort } from "@/src/domain/mail-desk/ports";

/**
 * Gmail adapters — same ports as sandbox.
 * Wire OAuth (server-only refresh tokens) before enabling in UI.
 * Scopes: gmail.readonly first; gmail.send only after explicit consent + UAC.
 */
export function createGmailMailSource(_params: {
  accessToken: string;
}): MailSourcePort {
  return {
    async listDisputeMessageKeys() {
      throw new Error("Gmail mail source is not configured yet. Use sandbox mail desk for the demo.");
    },
    async getMessageMeta() {
      throw new Error("Gmail mail source is not configured yet.");
    },
    async getBill() {
      throw new Error("Gmail mail source is not configured yet.");
    },
  };
}

export function createGmailOutboundMail(_params: {
  accessToken: string;
}): OutboundMailPort {
  return {
    async getByIdempotencyKey() {
      throw new Error("Gmail outbound is not configured yet.");
    },
    async send() {
      throw new Error("Gmail outbound is not configured yet. Sandbox outbound_mail is the live demo path.");
    },
  };
}

export function gmailOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
