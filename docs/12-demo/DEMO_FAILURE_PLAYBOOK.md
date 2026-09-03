# Demo Failure Playbook

## If WebMCP is off
Do not claim tools are live. The header must stay red. Open ChatGPT’s in-app browser or Chrome with WebMCP testing enabled.

## If unsigned file is attempted
Expected: `APPROVAL_REQUIRED`. That is the demo, not a failure.

## If provider mutation fails
Do not display fake success. The work item goes to `FAILED`. Retry `execute_filing` after the signature is still valid, then `verify_filing`.

## If verification mismatches
Leave the item `FAILED`. Do not say it paid.

## If the desk will not open
Check `GET /api/health/theater`. Apply theater migrations. Use **Fresh desk** only after the cooldown (a few seconds).

## If FR0999 prepare succeeds
Stop. The blocked catalog row is missing or was cleared. Restore the seed claim before recording.
