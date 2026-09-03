import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DocketBoard } from "@/components/docket/DocketBoard";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import { getCaseWorkspace } from "@/src/application/queries/case-workspace";
import { CaseNotFoundError } from "@/src/domain/cases/case-service";
import { createServerSupabaseClient } from "@/src/infrastructure/db/supabase/server";
import { notFound } from "next/navigation";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }

  try {
    const repository = await createCaseRepository();
    const client = await createServerSupabaseClient();
    const workspace = await getCaseWorkspace({ repository, client, userId, caseId });

    return (
      <AppShell
        title={workspace.caseRecord.title}
        subtitle={`${workspace.caseRecord.provider} · ${workspace.caseRecord.caseType}`}
        fileNo={workspace.caseRecord.id.slice(0, 8).toUpperCase()}
      >
        <DocketBoard workspace={workspace} />
      </AppShell>
    );
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      notFound();
    }
    throw error;
  }
}
