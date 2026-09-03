# Prompt Architecture

## Prompt layers
SYSTEM
- Aegis identity
- safety invariants
- output rules

DEVELOPER
- task-specific reasoning instructions
- schema
- domain constraints

CONTEXT
- verified case facts
- policy
- evidence
- capability summaries

UNTRUSTED CONTENT
- clearly delimited and labeled as data only

USER
- explicit current request

## Prompt rule
Never allow untrusted content to be concatenated into system-level instructions.

## Versioning
Every production prompt has:
- stable ID
- semantic version
- change note
- evaluation fixture set
