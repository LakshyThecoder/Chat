# E2E Scenarios

## E2E-001 Happy path
Upload → extract → evidence → eligibility → claim → approval → WebMCP → verify.

## E2E-002 Permission denial
Attempt high-impact action without approval → denied → no provider mutation.

## E2E-003 Duplicate action
Repeat same submit intent → same claim reference returned → one provider-side claim.

## E2E-004 State conflict
Provider changes state between plan and execution → action pauses/replans.

## E2E-005 Missing evidence
Claim requires receipt → case enters Needs Information.
