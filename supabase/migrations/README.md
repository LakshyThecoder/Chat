# Migration Order

Foundation (applied):
- `20260903000000_health_check.sql` — infrastructure health probe + anon SELECT policy

Planned domain migrations (Wave A+):
001_extensions_and_enums.sql
002_profiles.sql
003_cases.sql
004_documents_evidence.sql
005_timeline.sql
006_policies.sql
007_claims.sql
008_permissions.sql
009_agent_runs_actions.sql
010_provider_tools.sql
011_resolutions_notifications.sql
012_rls.sql
013_indexes.sql
014_demo_seed.sql
