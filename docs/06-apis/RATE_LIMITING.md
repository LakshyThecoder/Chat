# Rate Limiting

## Protect
- AI routes
- file upload
- case mutation endpoints
- provider mutations
- proactive scanning

## Approach
Use user + IP + route-aware limits.
High-impact mutations use stricter limits and idempotency.
