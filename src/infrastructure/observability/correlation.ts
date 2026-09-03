export const CORRELATION_ID_HEADER = "x-correlation-id";

export function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getCorrelationIdFromHeaders(
  headers: Headers | Record<string, string | null | undefined>,
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(CORRELATION_ID_HEADER) ?? undefined;
  }

  const value = headers[CORRELATION_ID_HEADER] ?? headers[CORRELATION_ID_HEADER.toLowerCase()];
  return value ?? undefined;
}
