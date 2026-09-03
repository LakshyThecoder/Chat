const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateChamberLocator(random: () => number = Math.random): string {
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return `AG${suffix}`;
}

export function isChamberLocator(locator: string): boolean {
  return /^AG[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(locator.trim().toUpperCase());
}
