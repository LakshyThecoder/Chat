# Implementation Plan

## Phase 00 — Foundation
Deliver:
- Next.js shell
- strict TypeScript
- environment validation
- logging baseline
- Supabase connection
- design tokens
- CI

Exit:
- deployable shell
- health endpoint
- CI green

## Phase 01 — Case domain
Deliver:
- case entity
- state machine
- commands/queries
- case detail skeleton
- audit events

Exit:
- create/read/update case lifecycle works

## Phase 02 — Evidence
Deliver:
- secure upload
- document metadata
- extraction contract
- provenance model
- evidence panel

Exit:
- fixture document becomes structured evidence

## Phase 03 — AI gateway
Deliver:
- Regolo gateway
- timeout/retry
- structured output
- model routing
- evaluation fixtures

Exit:
- known fixtures pass extraction/strategy evaluations

## Phase 04 — Eligibility
Deliver:
- explicit rules
- policy representation
- deterministic calculations
- uncertainty handling

Exit:
- primary FlyRight case produces expected eligibility result

## Phase 05 — Permission engine
Deliver:
- policy schema
- thresholds
- action risk classes
- server-side enforcement
- approval records

Exit:
- forbidden action cannot execute even with malicious client request

## Phase 06 — WebMCP capability registry
Deliver:
- capability metadata
- discovery
- tool contract validation
- adapter

Exit:
- Aegis can inspect a provider's capabilities in target browser

## Phase 07 — FlyRight
Deliver:
- provider UI
- persistent provider DB
- 7+ tools
- state transitions
- reset fixture
- verification

Exit:
- end-to-end claim submission changes provider state and Aegis state

## Phase 08 — Monitoring
Deliver:
- scheduled checks
- status sync
- follow-up recommendation
- requested-information workflow

Exit:
- submitted case can progress after initial action

## Phase 09 — Generalization
Deliver:
- Streamly
- ElectroMart
- provider-neutral orchestration

Exit:
- same Aegis engine supports three distinct capability sets

## Phase 10 — Trust/quality
Deliver:
- security hardening
- RLS tests
- permission tests
- AI evals
- E2E suite
- observability
- error recovery

## Phase 11 — Product polish
Deliver:
- Command Center
- premium motion
- accessibility
- responsive design
- onboarding
- empty/error states
- agent console

## Phase 12 — Competition
Deliver:
- final demo fixture
- live URL
- README
- public repo
- license
- testing instructions
- <3 minute video
- submission freeze checklist
