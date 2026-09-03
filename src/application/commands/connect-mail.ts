import type { SupabaseClient } from "@supabase/supabase-js";

export class MailConnectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MailConnectionError";
    this.code = code;
  }
}

export async function connectSandboxMail(
  client: SupabaseClient,
  userId: string,
): Promise<{ source: "mail_sandbox"; casesCreated: 0 }> {
  const { error } = await client.from("source_connections").insert({
    user_id: userId,
    source: "mail_sandbox",
  });

  if (error && error.code !== "23505") {
    throw new MailConnectionError("CONNECT_FAILED", error.message);
  }

  return { source: "mail_sandbox", casesCreated: 0 };
}

export async function isSandboxMailConnected(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("source_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "mail_sandbox")
    .maybeSingle();

  if (error) {
    throw new MailConnectionError("LOOKUP_FAILED", error.message);
  }

  return Boolean(data);
}
