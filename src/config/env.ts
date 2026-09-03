import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().url().optional(),
);

const optionalSecret = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
);

export const publicEnvSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalSecret,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalSecret,
  })
  .strict();

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
    REGOLO_API_KEY: optionalSecret,
    REGOLO_BASE_URL: z.preprocess(
      emptyToUndefined,
      z.string().url().default("https://api.regolo.ai/v1"),
    ),
    REGOLO_MODEL_FAST: optionalSecret,
    REGOLO_MODEL_REASONING: optionalSecret,
    SENTRY_DSN: optionalSecret,
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    NOTIFICATION_PROVIDER_API_KEY: optionalSecret,
  })
  .strict();

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const SERVER_ENV_KEYS = [
  "NODE_ENV",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REGOLO_API_KEY",
  "REGOLO_BASE_URL",
  "REGOLO_MODEL_FAST",
  "REGOLO_MODEL_REASONING",
  "SENTRY_DSN",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "NOTIFICATION_PROVIDER_API_KEY",
] as const;

function pickEnv(
  source: Record<string, string | undefined>,
  keys: readonly string[],
): Record<string, string | undefined> {
  const picked: Record<string, string | undefined> = {};
  for (const key of keys) {
    picked[key] = source[key];
  }
  return picked;
}

/**
 * Next.js only inlines NEXT_PUBLIC_* when accessed as static property reads
 * (`process.env.NEXT_PUBLIC_FOO`). Dynamic `process.env[key]` is empty in the
 * browser bundle, which made login throw "Supabase browser client is not configured".
 */
function readPublicProcessEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };
}

export function parsePublicEnv(
  source: Record<string, string | undefined> = readPublicProcessEnv(),
): PublicEnv {
  const picked = pickEnv(source, PUBLIC_ENV_KEYS);
  const sourceWithDefaults = {
    ...picked,
    NEXT_PUBLIC_APP_URL:
      picked.NEXT_PUBLIC_APP_URL ??
      (source.NODE_ENV !== "production" ? "http://localhost:3000" : undefined),
    // Prefer explicit anon key; fall back to publishable key (new Supabase format).
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      picked.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      picked.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };

  const result = publicEnvSchema.safeParse(sourceWithDefaults);

  if (!result.success) {
    throw new Error(`Invalid public environment: ${formatZodError(result.error)}`);
  }

  return result.data;
}

export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(pickEnv(source, SERVER_ENV_KEYS));

  if (!result.success) {
    throw new Error(`Invalid server environment: ${formatZodError(result.error)}`);
  }

  return result.data;
}

export function isSupabasePublicConfigured(env: PublicEnv): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isSupabaseConfigured(
  env: PublicEnv & Pick<ServerEnv, "SUPABASE_SERVICE_ROLE_KEY">,
): boolean {
  return Boolean(isSupabasePublicConfigured(env) && env.SUPABASE_SERVICE_ROLE_KEY);
}

let cachedPublicEnv: PublicEnv | undefined;
let cachedServerEnv: ServerEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    cachedPublicEnv = parsePublicEnv();
  }

  return cachedPublicEnv;
}

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = parseServerEnv();
  }

  return cachedServerEnv;
}

export function resetEnvCacheForTests(): void {
  cachedPublicEnv = undefined;
  cachedServerEnv = undefined;
}
