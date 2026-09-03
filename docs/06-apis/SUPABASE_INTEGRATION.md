# Supabase Integration

## Responsibilities
- Auth
- Postgres
- Storage
- RLS

## Security
Supabase documentation recommends RLS on exposed tables, least-privilege grants, and server-only handling of service-role credentials. Treat that as the baseline for Aegis.

## Required setup
- migrations
- policies
- RLS tests
- server client
- browser client for allowed public/authenticated operations
