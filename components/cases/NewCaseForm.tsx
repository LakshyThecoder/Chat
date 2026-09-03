"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROVIDER_CATALOG } from "@/src/domain/providers/catalog";

const COUNTERS = [PROVIDER_CATALOG.flyright, PROVIDER_CATALOG.streamly, PROVIDER_CATALOG.electromart];

export function NewCaseForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [provider, setProvider] = useState<"flyright" | "streamly" | "electromart">("flyright");
  const selected = useMemo(() => PROVIDER_CATALOG[provider], [provider]);

  return (
    <form action={action} className="max-w-2xl space-y-6 border border-foreground/15 bg-white p-6 sm:p-8">
      <div className="space-y-2">
        <Label htmlFor="title">What went wrong</Label>
        <Input id="title" name="title" required placeholder="Charged after I cancelled" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="provider">Counter</Label>
          <select
            id="provider"
            name="provider"
            value={provider}
            onChange={(event) =>
              setProvider(event.target.value as "flyright" | "streamly" | "electromart")
            }
            className="flex h-9 w-full rounded-none border border-input bg-transparent px-3 text-sm"
          >
            {COUNTERS.map((counter) => (
              <option key={counter.id} value={counter.id}>
                {counter.name} ({counter.kind})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="caseType">File type</Label>
          <input type="hidden" name="caseType" value={selected.defaultCaseType} />
          <Input id="caseType" value={selected.defaultCaseType.replaceAll("_", " ")} readOnly />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bookingLocator">
            {provider === "streamly"
              ? "Subscription id"
              : provider === "electromart"
                ? "Order id"
                : "Booking locator"}
          </Label>
          <Input
            id="bookingLocator"
            name="bookingLocator"
            placeholder="If you have it"
            className="uppercase"
          />
        </div>
        {provider === "streamly" ? (
          <div className="space-y-2">
            <Label htmlFor="accountEmail">Account email</Label>
            <Input id="accountEmail" name="accountEmail" type="email" placeholder="On the subscription" />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="passengerLastName">Last name</Label>
            <Input id="passengerLastName" name="passengerLastName" placeholder="As on the record" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">Notes</Label>
        <Textarea id="summary" name="summary" rows={4} placeholder="Optional. Do not invent a refund amount." />
      </div>

      <p className="text-sm text-muted-foreground">
        Prefer Inbox: connect sandbox mail and open a thread. Manual identity that fails: FlyRight
        FR2201/KLEIN, Streamly SL-2002 still active, ElectroMart EM-5500 expired warranty.
      </p>

      <Button type="submit">Open file</Button>
    </form>
  );
}
