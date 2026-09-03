# API Contract Rules

Every endpoint documents:
- method
- path
- auth requirement
- request schema
- response schema
- error schema
- idempotency behavior
- audit event
- rate limit expectations

## Mutation pattern
POST /api/cases/:id/actions
→ validates command
→ checks auth
→ evaluates permission
→ executes
→ verifies
→ returns action projection
