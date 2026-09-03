export class MoneyParseError extends Error {
  readonly code = "MONEY_PARSE_FAILED";

  constructor(value: string) {
    super(`Invalid monetary amount: ${value}`);
    this.name = "MoneyParseError";
  }
}

const DECIMAL = /^\d+(\.\d{1,2})?$/;

export function normalizeSqlMoney(value: unknown): string {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new MoneyParseError(raw);
  }
  const fraction = (match[2] ?? "").padEnd(2, "0").slice(0, 2);
  return `${match[1]}.${fraction}`;
}

export function parseDecimalToCents(value: string): number {
  const normalized = DECIMAL.test(value) ? value : normalizeSqlMoney(value);
  if (!DECIMAL.test(normalized)) {
    throw new MoneyParseError(value);
  }

  const [whole = "0", fraction = ""] = normalized.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0"), 10);
}

export function centsToDecimal(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new MoneyParseError(String(cents));
  }

  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function compareCents(left: number, right: number): number {
  return left - right;
}
