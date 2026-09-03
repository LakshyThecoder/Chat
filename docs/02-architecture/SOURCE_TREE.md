# Target Source Tree

```text
app/
  (marketing)/
  (app)/
    dashboard/
    cases/
    cases/[caseId]/
    new-case/
    agent/
    settings/
  api/
    cases/
    evidence/
    claims/
    actions/
    permissions/
    monitoring/
    agent/

components/
  ui/
  cases/
  evidence/
  actions/
  agent/
  layout/

src/
  domain/
    cases/
    evidence/
    policies/
    eligibility/
    strategies/
    permissions/
    actions/
    monitoring/
    audit/
    shared/
  application/
    commands/
    queries/
    ports/
    dto/
  infrastructure/
    db/
    ai/
    storage/
    webmcp/
    providers/
    observability/
  config/
  lib/

providers/
  flyright/
  streamly/
  electromart/

supabase/
  migrations/
  tests/
  seed/

tests/
  unit/
  integration/
  contract/
  e2e/
  security/
  fixtures/
```

This structure is a target, not permission to create every folder immediately. Create modules when their phase arrives.
