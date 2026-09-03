# Aegis Threat Model

## Assets
- user identity
- documents/evidence
- consumer transaction information
- autonomy policy
- provider access context
- agent action history
- model API keys

## Threat actors
- malicious user
- compromised account
- malicious document sender
- malicious provider content
- malicious model output
- replay attacker
- cross-user attacker

## Critical threats
1. Prompt injection causes forbidden action.
2. Client bypasses permission engine.
3. Duplicate refund/claim.
4. Cross-user case access.
5. Secret leakage.
6. False provider success.
7. Malicious file upload.

## Required controls
Mapped in SECURITY.md and tool-specific threat docs.
