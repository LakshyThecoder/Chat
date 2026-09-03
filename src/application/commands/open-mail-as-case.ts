import type { SupabaseClient } from "@supabase/supabase-js";
import { createCase } from "@/src/application/commands/create-case";
import { connectSandboxMail, isSandboxMailConnected } from "@/src/application/commands/connect-mail";
import { investigateCase } from "@/src/application/commands/investigate-case";
import { uploadCaseDocument } from "@/src/application/commands/upload-document";
import type { CaseRecord, CaseRepository } from "@/src/domain/cases/types";
import { caseDraftFromMail } from "@/src/domain/mail/case-draft-from-mail";
import { getSandboxMailMessage } from "@/src/infrastructure/mail/sandbox-catalog";

export class OpenMailError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OpenMailError";
    this.code = code;
  }
}

export async function openMailAsCase(params: {
  repository: CaseRepository;
  client: SupabaseClient;
  userId: string;
  messageKey: string;
  investigate?: boolean;
}): Promise<{ caseRecord: CaseRecord; investigationError: string | null }> {
  const connected = await isSandboxMailConnected(params.client, params.userId);
  if (!connected) {
    throw new OpenMailError("MAIL_NOT_CONNECTED", "Connect the sandbox mailbox before opening a thread.");
  }

  const message = await getSandboxMailMessage(params.messageKey);
  if (!message) {
    throw new OpenMailError("MAIL_NOT_FOUND", "That sandbox message is not in the catalog.");
  }

  const draft = caseDraftFromMail(params.userId, message);
  const created = await createCase(params.repository, params.userId, {
    provider: draft.provider,
    caseType: draft.caseType,
    title: draft.title,
    summary: draft.summary,
    bookingLocator: draft.bookingLocator,
    passengerLastName: draft.passengerLastName,
    accountEmail: draft.accountEmail,
  });

  const exhibit = new File([message.body], `${message.messageKey}.txt`, { type: "text/plain" });
  await uploadCaseDocument({
    client: params.client,
    userId: params.userId,
    caseId: created.id,
    file: exhibit,
    source: "mail_sandbox",
  });

  if (params.investigate === false) {
    return { caseRecord: created, investigationError: null };
  }

  try {
    const investigated = await investigateCase({
      repository: params.repository,
      client: params.client,
      userId: params.userId,
      caseId: created.id,
    });
    return { caseRecord: investigated, investigationError: null };
  } catch (error) {
    return {
      caseRecord: created,
      investigationError: error instanceof Error ? error.message : "Investigation could not finish.",
    };
  }
}

export { connectSandboxMail };
