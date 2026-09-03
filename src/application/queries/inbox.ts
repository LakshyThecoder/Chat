import type { SupabaseClient } from "@supabase/supabase-js";
import { isSandboxMailConnected } from "@/src/application/commands/connect-mail";
import type { MailCatalogMessage } from "@/src/domain/mail/case-draft-from-mail";
import { listSandboxMailMessages } from "@/src/infrastructure/mail/sandbox-catalog";

export async function getInbox(params: {
  client: SupabaseClient;
  userId: string;
}): Promise<{ connected: boolean; messages: MailCatalogMessage[] }> {
  const connected = await isSandboxMailConnected(params.client, params.userId);
  if (!connected) {
    return { connected: false, messages: [] };
  }

  const messages = await listSandboxMailMessages();
  return { connected: true, messages };
}
