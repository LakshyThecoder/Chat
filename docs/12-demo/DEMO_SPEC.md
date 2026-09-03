# Demo Spec — Resolution Theater

The shipped judge demo is **Resolution Theater** at `/`.

## What it is
A person and ChatGPT on the same desk. The agent inspects persisted sandbox rows, software computes entitlement, the human signs, the agent files, Aegis re-reads the provider row.

## What it is not
- Not the Bureau inbox / evidence-upload 180s script (that product exists, production middleware keeps judges on `/`).
- Not a chatbot that writes complaint letters.
- Not a fake WebMCP success path.

## Fixtures
- Fresh FlyRight ticket cloned from FR1842 / MOREAU (eligible).
- Fresh Streamly subscription cloned from SL-1001 (eligible billed-after-cancel).
- Shared catalog booking FR0999 / BERG (already claimed — must not file).

## Success
Two eligible items reach `VERIFIED` with matched expected vs observed. FR0999 remains ineligible. Unsigned execute returns `APPROVAL_REQUIRED`.
