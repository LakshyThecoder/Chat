# Environment Schema

## Public
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

## Secret
SUPABASE_SERVICE_ROLE_KEY
REGOLO_API_KEY
REGOLO_BASE_URL
REGOLO_MODEL_FAST
REGOLO_MODEL_REASONING
SENTRY_DSN
OTEL_EXPORTER_OTLP_ENDPOINT
NOTIFICATION_PROVIDER_API_KEY

## Notes
- Prefer legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` (JWT) for supabase-js clients.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_*`) is accepted as a fallback for the anon key.
- `SUPABASE_SERVICE_ROLE_KEY` may be legacy JWT `service_role` or new `sb_secret_*` format; server-only.

## Rule
Every variable must be classified as public or secret. Application env parsers only consume the classified keys above (picked + `.strict()`); undeclared Aegis keys are not read by application code.
