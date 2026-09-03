import "server-only";

import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import { SupabaseCaseRepository } from "@/src/infrastructure/db/cases/supabase-case-repository";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function createCaseRepository() {
  const client = await createServerSupabaseClient();
  return new SupabaseCaseRepository(client);
}
