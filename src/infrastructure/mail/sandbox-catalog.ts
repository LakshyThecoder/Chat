import "server-only";

import { createAdminSupabaseClient } from "@/src/infrastructure/db/supabase/admin";
import type { MailCatalogMessage } from "@/src/domain/mail/case-draft-from-mail";

function mapMessage(row: Record<string, unknown>): MailCatalogMessage {
  return {
    messageKey: String(row.message_key),
    fromAddress: String(row.from_address),
    fromName: String(row.from_name),
    subject: String(row.subject),
    sentAt: String(row.sent_at),
    body: String(row.body),
    hint: String(row.hint),
    routeProvider: row.route_provider ? String(row.route_provider) : null,
    routeCaseType: row.route_case_type ? String(row.route_case_type) : null,
    locatorHint: row.locator_hint ? String(row.locator_hint) : null,
    lastNameHint: row.last_name_hint ? String(row.last_name_hint) : null,
    accountEmailHint: row.account_email_hint ? String(row.account_email_hint) : null,
  };
}

export async function listSandboxMailMessages(): Promise<MailCatalogMessage[]> {
  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("mail_messages")
    .select("*")
    .order("sent_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapMessage(row as Record<string, unknown>));
}

export async function getSandboxMailMessage(messageKey: string): Promise<MailCatalogMessage | null> {
  const client = createAdminSupabaseClient();
  const { data, error } = await client
    .from("mail_messages")
    .select("*")
    .eq("message_key", messageKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapMessage(data as Record<string, unknown>) : null;
}
