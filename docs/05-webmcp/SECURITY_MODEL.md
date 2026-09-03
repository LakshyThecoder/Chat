# WebMCP Security Model

## Threats
- malicious tool arguments
- malicious provider content
- tool spoofing
- replay
- stale provider state
- permission mismatch
- cross-origin exposure mistakes

## Controls
- schema validation
- authorization
- permission check
- state precondition check
- idempotency
- provider verification
- least-privilege origins/capabilities where the platform supports it
- audit trail

## Fail closed
If capability metadata is incomplete or permission context is unavailable, do not execute a high-impact mutation.
