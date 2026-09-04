import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(
  amount: string | number | null | undefined,
  currency = "EUR",
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }
  const value = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(value)) {
    return String(amount);
  }
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(value);
}

export function formatEuro(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const value = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(value)) {
    return String(amount);
  }

  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}
