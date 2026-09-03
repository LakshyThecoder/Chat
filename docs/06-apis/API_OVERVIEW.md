# API Overview

## Internal domains
- /api/cases
- /api/evidence
- /api/policies
- /api/eligibility
- /api/strategies
- /api/claims
- /api/permissions
- /api/actions
- /api/monitoring
- /api/proactive
- /api/agent

## External services
Regolo AI, Supabase, storage, notification provider (optional).

## Rules
Server-side authorization is mandatory.
API DTOs are typed and validated.
Do not expose database implementation details directly to clients.
