import type { SupabaseClient } from "@supabase/supabase-js";
import { CaseNotFoundError, CaseService } from "@/src/domain/cases/case-service";
import type { CaseRecord, CaseRepository } from "@/src/domain/cases/types";
import { evaluateFlightRefund } from "@/src/domain/eligibility/evaluate-flight-refund";
import { evaluateSubscriptionRefund } from "@/src/domain/eligibility/evaluate-subscription-refund";
import { evaluateUnroutedMessage } from "@/src/domain/eligibility/evaluate-unrouted";
import { evaluateWarrantyClaim } from "@/src/domain/eligibility/evaluate-warranty-claim";
import type { EligibilityDecision } from "@/src/domain/eligibility/types";
import { parseDecimalToCents } from "@/src/domain/money/cents";
import { evaluatePermission } from "@/src/domain/permissions/evaluate";
import {
  DEFAULT_AUTONOMY_POLICY,
  type AutonomyPolicy,
} from "@/src/domain/permissions/types";
import { getProviderCatalog, resolveProviderId } from "@/src/domain/providers/catalog";
import { AiGatewayError, extractFactsFromText } from "@/src/infrastructure/ai/regolo-gateway";
import { listCaseDocuments } from "@/src/application/commands/upload-document";
import { FlyRightNotFoundError } from "@/src/infrastructure/providers/flyright/types";
import { createFlyRightProvider } from "@/src/infrastructure/providers/flyright/service";
import { StreamlyNotFoundError } from "@/src/infrastructure/providers/streamly/types";
import { createStreamlyProvider } from "@/src/infrastructure/providers/streamly/service";
import { ElectroMartNotFoundError } from "@/src/infrastructure/providers/electromart/types";
import { createElectroMartProvider } from "@/src/infrastructure/providers/electromart/service";

export class InvestigationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "InvestigationError";
    this.code = code;
  }
}

async function loadAutonomy(
  client: SupabaseClient,
  userId: string,
): Promise<AutonomyPolicy> {
  const { data } = await client
    .from("autonomy_policies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return DEFAULT_AUTONOMY_POLICY;
  }

  return {
    investigateAllowed: Boolean(data.investigate_allowed),
    prepareAllowed: Boolean(data.prepare_allowed),
    highImpactAskAboveCents: Number(data.high_impact_ask_above_cents),
    killSwitch: Boolean(data.kill_switch),
  };
}

async function readLatestTextDocument(params: {
  client: SupabaseClient;
  userId: string;
  caseId: string;
}): Promise<{ text: string; filename: string; documentId: string } | null> {
  const documents = await listCaseDocuments(params);
  const textDoc = [...documents].reverse().find((doc) => doc.contentType === "text/plain");
  if (!textDoc) {
    return null;
  }

  const { data, error } = await params.client.storage.from("evidence").download(textDoc.storagePath);
  if (error || !data) {
    throw new InvestigationError("EVIDENCE_READ_FAILED", "Could not read the uploaded document.");
  }

  const text = await data.text();
  return { text, filename: textDoc.filename, documentId: textDoc.id };
}

function factValue(
  facts: Array<{ factKey: string; factValue: string }>,
  keys: string[],
): string | null {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const found = facts.find((fact) => wanted.has(fact.factKey.toLowerCase()));
  return found?.factValue?.trim() || null;
}

export async function investigateCase(params: {
  repository: CaseRepository;
  client: SupabaseClient;
  userId: string;
  caseId: string;
}): Promise<CaseRecord> {
  const service = new CaseService(params.repository);
  let caseRecord = await service.getCase(params.caseId, params.userId);

  const policy = await loadAutonomy(params.client, params.userId);
  if (!policy.investigateAllowed || policy.killSwitch) {
    throw new InvestigationError("INVESTIGATION_BLOCKED", "Investigation is disabled by autonomy policy.");
  }

  if (caseRecord.status === "DRAFT") {
    caseRecord = await service.transitionCase({
      caseId: caseRecord.id,
      userId: params.userId,
      toStatus: "INVESTIGATING",
      reason: "Investigation started",
      nextAction: "Look up the provider record",
    });
  }

  let locator = caseRecord.bookingLocator;
  let lastName = caseRecord.passengerLastName;
  let accountEmail = caseRecord.accountEmail;
  const providerId = resolveProviderId(caseRecord.provider);

  const textDocument = await readLatestTextDocument({
    client: params.client,
    userId: params.userId,
    caseId: caseRecord.id,
  });

  if (providerId !== "unspecified" && (!hasIdentity(providerId, locator, lastName, accountEmail) || !locator) && textDocument) {
    try {
      const extracted = await extractFactsFromText({
        documentText: textDocument.text,
        filename: textDocument.filename,
      });

      for (const fact of extracted.facts) {
        await params.client.from("evidence_facts").insert({
          case_id: caseRecord.id,
          user_id: params.userId,
          document_id: textDocument.documentId,
          fact_key: fact.factKey,
          fact_value: fact.factValue,
          confidence: fact.confidence ?? null,
          provenance: {
            quote: fact.quote ?? null,
            filename: textDocument.filename,
            prompt: "case.extract.v1",
          },
        });
      }

      locator =
        locator ??
        extracted.bookingLocator?.toUpperCase() ??
        factValue(extracted.facts, ["locator", "subscription_id", "order_id"])?.toUpperCase() ??
        null;
      lastName =
        lastName ??
        extracted.passengerLastName?.toUpperCase() ??
        factValue(extracted.facts, ["last_name", "passenger_last_name"])?.toUpperCase() ??
        null;
      accountEmail =
        accountEmail ??
        extracted.accountEmail?.toLowerCase() ??
        factValue(extracted.facts, ["account_email", "email"])?.toLowerCase() ??
        null;
    } catch (error) {
      if (error instanceof AiGatewayError) {
        throw new InvestigationError(error.code, error.message);
      }
      throw error;
    }
  }

  caseRecord = await params.repository.updateEngineFields({
    caseId: caseRecord.id,
    userId: params.userId,
    bookingLocator: locator,
    passengerLastName: lastName,
    accountEmail,
  });

  const lookup = await lookupProviderDecision({
    providerId,
    locator,
    lastName,
    accountEmail,
    currency: caseRecord.currency,
  });

  const { error: eligibilityError } = await params.client.from("eligibility_decisions").insert({
    case_id: caseRecord.id,
    user_id: params.userId,
    outcome: lookup.decision.outcome,
    amount: lookup.decision.amount,
    currency: lookup.decision.currency,
    rule_ids: lookup.decision.ruleIds,
    policy_id: lookup.policyId,
    reasons: lookup.decision.reasons,
    inputs: lookup.inputs,
  });

  if (eligibilityError) {
    throw new Error(eligibilityError.message);
  }

  if (lookup.decision.outcome !== "eligible" || !lookup.decision.amount) {
    caseRecord = await params.repository.updateEngineFields({
      caseId: caseRecord.id,
      userId: params.userId,
      amountAtRisk: null,
      nextAction: lookup.decision.reasons[0] ?? "Eligibility is incomplete",
    });

    if (caseRecord.status === "INVESTIGATING") {
      caseRecord = await service.transitionCase({
        caseId: caseRecord.id,
        userId: params.userId,
        toStatus: "READY_FOR_REVIEW",
        reason: "Investigation completed without an executable claim",
        nextAction: lookup.decision.reasons[0] ?? "Review eligibility",
      });
    }

    await params.repository.appendEvent({
      caseId: caseRecord.id,
      userId: params.userId,
      eventType: "ELIGIBILITY_CALCULATED",
      payload: { outcome: lookup.decision.outcome, reasons: lookup.decision.reasons },
    });

    return caseRecord;
  }

  const amountCents = parseDecimalToCents(lookup.decision.amount);
  const permission = evaluatePermission({
    riskClass: "HIGH_IMPACT",
    amountCents,
    policy,
  });

  const catalog = getProviderCatalog(providerId);
  const toolName = catalog.highImpactTool ?? "submit_claim";
  const idempotencyKey = `${providerId}:${toolName}:${caseRecord.id}:${locator}`;

  const { data: existingIntent } = await params.client
    .from("action_intents")
    .select("*")
    .eq("user_id", params.userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!existingIntent) {
    const initialStatus =
      permission.decision === "allow" ? "PROPOSED" : permission.decision === "deny" ? "FAILED" : "APPROVAL_REQUIRED";

    const { error: intentError } = await params.client.from("action_intents").insert({
      case_id: caseRecord.id,
      user_id: params.userId,
      idempotency_key: idempotencyKey,
      tool_name: toolName,
      risk_class: "HIGH_IMPACT",
      status: initialStatus,
      payload: lookup.payload,
      amount: lookup.decision.amount,
      currency: lookup.decision.currency,
    });

    if (intentError && intentError.code !== "23505") {
      throw new Error(intentError.message);
    }
  }

  caseRecord = await params.repository.updateEngineFields({
    caseId: caseRecord.id,
    userId: params.userId,
    amountAtRisk: lookup.decision.amount,
    nextAction:
      permission.decision === "require_approval"
        ? `Approve the ${catalog.name} submission`
        : permission.decision === "deny"
          ? permission.reasons[0] ?? "Action denied"
          : `Submit the ${catalog.name} action`,
  });

  if (caseRecord.status === "INVESTIGATING") {
    const toStatus = permission.decision === "require_approval" ? "AWAITING_APPROVAL" : "READY_FOR_REVIEW";
    caseRecord = await service.transitionCase({
      caseId: caseRecord.id,
      userId: params.userId,
      toStatus,
      reason: "Eligibility calculated from provider state",
      nextAction: caseRecord.nextAction,
    });
  }

  await params.repository.appendEvent({
    caseId: caseRecord.id,
    userId: params.userId,
    eventType: "ELIGIBILITY_CALCULATED",
    payload: {
      outcome: lookup.decision.outcome,
      amount: lookup.decision.amount,
      permission: permission.decision,
      provider: providerId,
    },
  });

  return caseRecord;
}

function hasIdentity(
  providerId: ReturnType<typeof resolveProviderId>,
  locator: string | null,
  lastName: string | null,
  accountEmail: string | null,
): boolean {
  if (providerId === "streamly") {
    return Boolean(locator && accountEmail);
  }
  if (providerId === "unspecified") {
    return true;
  }
  return Boolean(locator && lastName);
}

async function lookupProviderDecision(params: {
  providerId: ReturnType<typeof resolveProviderId>;
  locator: string | null;
  lastName: string | null;
  accountEmail: string | null;
  currency: string;
}): Promise<{
  decision: EligibilityDecision;
  policyId: string | null;
  payload: Record<string, unknown>;
  inputs: Record<string, unknown>;
}> {
  if (params.providerId === "unspecified") {
    return {
      decision: evaluateUnroutedMessage(params.currency),
      policyId: null,
      payload: {},
      inputs: { provider: "unspecified" },
    };
  }

  if (params.providerId === "flyright") {
    if (!params.locator || !params.lastName) {
      throw new InvestigationError(
        "NEEDS_BOOKING_IDENTITY",
        "Enter a booking locator and last name, or upload a text document that contains them.",
      );
    }

    const flyright = createFlyRightProvider();
    let booking = null;
    try {
      booking = await flyright.getBooking(params.locator, params.lastName);
    } catch (error) {
      if (!(error instanceof FlyRightNotFoundError)) {
        throw error;
      }
    }

    const existingClaim = booking ? await flyright.getClaimForBooking(booking.locator) : null;
    const policyRow = await flyright.getPolicy();
    const decision = evaluateFlightRefund({
      bookingFound: Boolean(booking),
      cancelledByCarrier: booking?.cancelledByCarrier ?? false,
      ticketUnused: booking?.ticketUnused ?? false,
      flightStatus: booking?.flightStatus ?? null,
      farePaid: booking?.farePaid ?? null,
      currency: booking?.currency ?? params.currency,
      existingClaim: Boolean(existingClaim),
    });

    return {
      decision,
      policyId: policyRow.id,
      payload: {
        locator: params.locator,
        lastName: params.lastName,
        amount: decision.amount,
        currency: decision.currency,
        flightNumber: booking?.flightNumber,
        origin: booking?.origin,
        destination: booking?.destination,
      },
      inputs: {
        locator: params.locator,
        bookingFound: Boolean(booking),
        flightStatus: booking?.flightStatus ?? null,
        farePaid: booking?.farePaid ?? null,
        existingClaim: Boolean(existingClaim),
      },
    };
  }

  if (params.providerId === "streamly") {
    if (!params.locator || !params.accountEmail) {
      throw new InvestigationError(
        "NEEDS_BOOKING_IDENTITY",
        "Enter the Streamly account email and subscription id, or open the billing mail.",
      );
    }

    const streamly = createStreamlyProvider();
    let subscription = null;
    try {
      subscription = await streamly.getSubscription(params.locator, params.accountEmail);
    } catch (error) {
      if (!(error instanceof StreamlyNotFoundError)) {
        throw error;
      }
    }

    const existingRefund = subscription
      ? await streamly.getRefundForSubscription(subscription.subscriptionId)
      : null;
    const policyRow = await streamly.getCancellationPolicy();
    const decision = evaluateSubscriptionRefund({
      subscriptionFound: Boolean(subscription),
      status: subscription?.status ?? null,
      cancelledAt: subscription?.cancelledAt ?? null,
      lastChargedAt: subscription?.lastChargedAt ?? null,
      lastChargeAmount: subscription?.lastChargeAmount ?? null,
      currency: subscription?.currency ?? params.currency,
      existingRefund: Boolean(existingRefund),
    });

    return {
      decision,
      policyId: policyRow.id,
      payload: {
        subscriptionId: params.locator,
        accountEmail: params.accountEmail,
        amount: decision.amount,
        currency: decision.currency,
        planName: subscription?.planName,
      },
      inputs: {
        subscriptionId: params.locator,
        accountEmail: params.accountEmail,
        subscriptionFound: Boolean(subscription),
        status: subscription?.status ?? null,
        lastChargeAmount: subscription?.lastChargeAmount ?? null,
        existingRefund: Boolean(existingRefund),
      },
    };
  }

  if (!params.locator || !params.lastName) {
    throw new InvestigationError(
      "NEEDS_BOOKING_IDENTITY",
      "Enter the ElectroMart order id and last name, or open the warranty mail.",
    );
  }

  const electromart = createElectroMartProvider();
  let order = null;
  try {
    order = await electromart.getOrder(params.locator, params.lastName);
  } catch (error) {
    if (!(error instanceof ElectroMartNotFoundError)) {
      throw error;
    }
  }

  const existingClaim = order ? await electromart.getClaimForOrder(order.orderId) : null;
  const policyRow = await electromart.getPublishedPolicy();
  const decision = evaluateWarrantyClaim({
    orderFound: Boolean(order),
    purchasedAt: order?.purchasedAt ?? null,
    warrantyMonths: order?.warrantyMonths ?? null,
    existingClaim: Boolean(existingClaim),
    returnOpened: order?.returnOpened ?? false,
    purchasePrice: order?.purchasePrice ?? null,
    currency: order?.currency ?? params.currency,
  });

  return {
    decision,
    policyId: policyRow.id,
    payload: {
      orderId: params.locator,
      lastName: params.lastName,
      amount: decision.amount,
      currency: decision.currency,
      productName: order?.productName,
    },
    inputs: {
      orderId: params.locator,
      orderFound: Boolean(order),
      purchasePrice: order?.purchasePrice ?? null,
      returnOpened: order?.returnOpened ?? false,
      existingClaim: Boolean(existingClaim),
    },
  };
}

export { CaseNotFoundError };
