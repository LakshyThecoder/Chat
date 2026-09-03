export const PROVIDER_IDS = ["flyright", "streamly", "electromart", "unspecified"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ProviderCatalogEntry {
  id: ProviderId;
  name: string;
  kind: string;
  href: string | null;
  defaultCaseType: string;
  highImpactTool: string | null;
  identity: string;
  sandboxLabel: string;
}

export const PROVIDER_CATALOG: Record<ProviderId, ProviderCatalogEntry> = {
  flyright: {
    id: "flyright",
    name: "FlyRight",
    kind: "Airline counter",
    href: "/providers/flyright",
    defaultCaseType: "flight_compensation",
    highImpactTool: "submit_claim",
    identity: "Locator and last name",
    sandboxLabel: "Simulated carrier sandbox",
  },
  streamly: {
    id: "streamly",
    name: "Streamly",
    kind: "Subscription counter",
    href: "/providers/streamly",
    defaultCaseType: "subscription_refund",
    highImpactTool: "request_refund",
    identity: "Account email and subscription id",
    sandboxLabel: "Simulated billing sandbox",
  },
  electromart: {
    id: "electromart",
    name: "ElectroMart",
    kind: "Retail counter",
    href: "/providers/electromart",
    defaultCaseType: "warranty_claim",
    highImpactTool: "submit_warranty_claim",
    identity: "Order id and last name",
    sandboxLabel: "Simulated retail sandbox",
  },
  unspecified: {
    id: "unspecified",
    name: "No counter",
    kind: "Unrouted mail",
    href: null,
    defaultCaseType: "unrouted",
    highImpactTool: null,
    identity: "None",
    sandboxLabel: "Not a provider",
  },
};

export function resolveProviderId(value: string | null | undefined): ProviderId {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "flyright" || normalized === "streamly" || normalized === "electromart") {
    return normalized;
  }
  return "unspecified";
}

export function getProviderCatalog(value: string | null | undefined): ProviderCatalogEntry {
  return PROVIDER_CATALOG[resolveProviderId(value)];
}
