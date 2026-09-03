import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { InboxBoard } from "@/components/inbox/InboxBoard";
import { SandboxMailWebMcp } from "@/components/webmcp/SandboxMailWebMcp";
import { Button } from "@/components/ui/button";
import { getAuthenticatedUserId } from "@/src/application/auth/session";
import { getInbox } from "@/src/application/queries/inbox";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";

export default async function InboxPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }

  const client = await createServerSupabaseClient();
  const inbox = await getInbox({ client, userId });

  return (
    <AppShell
      title="Inbox"
      subtitle="Problems arrive as mail. You pick a thread. Aegis opens a blank file — it does not pre-win a refund."
      actions={
        <Button asChild variant="outline">
          <Link href="/cases/new">Manual file</Link>
        </Button>
      }
    >
      <InboxBoard connected={inbox.connected} messages={inbox.messages} />
      <div className="mt-6">
        <SandboxMailWebMcp />
      </div>
    </AppShell>
  );
}
