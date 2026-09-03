import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { NewCaseForm } from "@/components/cases/NewCaseForm";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import { createCase } from "@/src/application/commands/create-case";

async function createCaseAction(formData: FormData) {
  "use server";

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }

  const repository = await createCaseRepository();
  const created = await createCase(repository, userId, {
    provider: String(formData.get("provider") ?? "flyright"),
    caseType: String(formData.get("caseType") ?? "flight_compensation"),
    title: String(formData.get("title") ?? "").trim(),
    summary: String(formData.get("summary") ?? "") || undefined,
    bookingLocator: String(formData.get("bookingLocator") ?? "") || undefined,
    passengerLastName: String(formData.get("passengerLastName") ?? "") || undefined,
    accountEmail: String(formData.get("accountEmail") ?? "") || undefined,
  });

  redirect(`/cases/${created.id}`);
}

export default async function NewCasePage() {
  const userId = await getAuthenticatedUserId();

  return (
    <AppShell
      title="Open a file"
      subtitle="Blank on purpose. Amounts are calculated later from the chosen counter — never typed as a win."
    >
      {!userId ? (
        <div className="border border-foreground/15 bg-white p-6">
          <p className="font-display text-2xl italic">Sign in required</p>
          <Button asChild className="mt-4">
            <a href="/login">Sign in</a>
          </Button>
        </div>
      ) : (
        <NewCaseForm action={createCaseAction} />
      )}
    </AppShell>
  );
}
