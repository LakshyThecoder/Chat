# Aegis

Agent-native consumer advocacy. A case file, not a chatbot.

Aegis reconstructs a consumer problem, calculates eligibility with deterministic money rules, asks for permission at consequential boundaries, executes typed WebMCP tools against a **labeled provider sandbox**, and re-reads provider state before calling anything successful.

There is no pre-won demo case. New accounts are empty.

## Honest sandbox (not a cheat)

FlyRight is a simulated airline, like Stripe test mode. Lookups require **locator + last name**. The catalog includes failures:

| Locator | Last name | What happens |
| --- | --- | --- |
| FR1842 | MOREAU | Cancelled, unused fare €183.40 — eligible after lookup |
| FR2201 | KLEIN | Scheduled — ineligible |
| FR0999 | BERG | Cancelled but already claimed — conflict / ineligible |

€183.40 is FR1842’s **fare field**, not a constant in the eligibility engine.

A sample cancellation email is in [`fixtures/evidence/flyright-cancellation.txt`](fixtures/evidence/flyright-cancellation.txt). Upload it yourself. It is not inserted into your account.

## WebMCP

Tools register with `document.modelContext.registerTool` on:

- `/providers/flyright` — `get_booking`, `get_flight_status`, `get_policy`, `calculate_compensation`, `submit_claim`, `get_claim_status`, `request_follow_up`
- `/cases/[id]` — inspect/prepare tools only. `submit_claim` and approve are **not** registered for the agent.

Use ChatGPT’s in-app browser, or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`.

## Run

```bash
npm install
cp .env.example .env.local   # if present; otherwise set env vars
npm run dev
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REGOLO_API_KEY`, `REGOLO_MODEL_FAST`. See [`docs/11-operations/ENV_SCHEMA.md`](docs/11-operations/ENV_SCHEMA.md).

If Regolo is missing, document extraction fails closed. Booking locator + last name still works without AI.

```bash
npm test
npm run typecheck
```

## License

MIT
