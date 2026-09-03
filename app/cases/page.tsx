import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  createCaseRepository,
  getAuthenticatedUserId,
} from "@/src/application/auth/session";
import { listCases } from "@/src/application/queries/cases";
import { formatEuro, formatStatus } from "@/lib/utils";

export default async function CasesPage() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return (
      <AppShell title="Open files" subtitle="Sign in to view files that belong to you.">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </AppShell>
    );
  }

  const cases = await listCases(await createCaseRepository(), userId);

  return (
    <AppShell
      title="Open files"
      subtitle="Every file is a stateful resolution — evidence, permission, execution, verification."
      actions={
        <Button asChild>
          <Link href="/cases/new">New file</Link>
        </Button>
      }
    >
      {cases.length === 0 ? (
        <div className="border border-dashed border-foreground/20 bg-white px-6 py-12 text-center">
          <p className="font-display text-3xl italic">No files</p>
          <p className="mt-2 text-sm text-muted-foreground">Nothing is preloaded. Connect mail, then open a thread.</p>
          <Button asChild className="mt-4">
            <Link href="/inbox">Open inbox</Link>
          </Button>
        </div>
      ) : (
        <ul className="border border-foreground/15 bg-white">
          {cases.map((item) => (
            <li key={item.id} className="border-b border-foreground/10 last:border-0">
              <Link
                href={`/cases/${item.id}`}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {item.id.slice(0, 8).toUpperCase()} · {item.provider} · {formatStatus(item.status)}
                  </p>
                </div>
                <p className="font-display text-2xl">{formatEuro(item.amountAtRisk)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}