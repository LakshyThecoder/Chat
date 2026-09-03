import type { CreateCaseInput } from "@/src/domain/cases/types";
import { resolveProviderId } from "@/src/domain/providers/catalog";

export interface MailCatalogMessage {
  messageKey: string;
  fromAddress: string;
  fromName: string;
  subject: string;
  sentAt: string;
  body: string;
  hint: string;
  routeProvider: string | null;
  routeCaseType: string | null;
  locatorHint: string | null;
  lastNameHint: string | null;
  accountEmailHint: string | null;
}

export function caseDraftFromMail(
  userId: string,
  message: MailCatalogMessage,
): CreateCaseInput {
  const provider = resolveProviderId(message.routeProvider);
  return {
    userId,
    provider,
    caseType: message.routeCaseType?.trim() || (provider === "unspecified" ? "unrouted" : "unknown"),
    title: message.subject,
    summary: `Opened from sandbox mail ${message.messageKey}. ${message.hint}`,
    bookingLocator: message.locatorHint?.trim() || undefined,
    passengerLastName: message.lastNameHint?.trim() || undefined,
    accountEmail: message.accountEmailHint?.trim() || undefined,
  };
}
