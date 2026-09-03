import { z } from "zod";
import { CaseService } from "@/src/domain/cases/case-service";
import type { CaseRepository } from "@/src/domain/cases/types";

export const createCaseCommandSchema = z.object({
  provider: z.string().min(1).max(80),
  caseType: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  summary: z.string().max(4000).optional(),
  currency: z.string().length(3).optional(),
  bookingLocator: z.string().min(3).max(32).optional(),
  passengerLastName: z.string().min(1).max(80).optional(),
  accountEmail: z.string().email().max(180).optional(),
});

export type CreateCaseCommand = z.infer<typeof createCaseCommandSchema>;

export async function createCase(
  repository: CaseRepository,
  userId: string,
  command: CreateCaseCommand,
) {
  const service = new CaseService(repository);
  return service.createCase({
    userId,
    provider: command.provider,
    caseType: command.caseType,
    title: command.title,
    summary: command.summary,
    currency: command.currency,
    bookingLocator: command.bookingLocator,
    passengerLastName: command.passengerLastName,
    accountEmail: command.accountEmail,
  });
}
