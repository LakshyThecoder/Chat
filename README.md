# Aegis

**Live demo:** https://aegis-chamber.vercel.app

A cancelled airline ticket, a person, and ChatGPT on **the same page**.

The human holds the stub and the signature. The agent looks up the booking, calculates the unused-fare refund, and files. `submit_claim` fails until a person signs. The FlyRight desk paints from the tool call — it does not wait for a refresh. Success is a re-read of the claim row, not a model saying it worked.

There is no login on the demo. Each visit issues a **new sandbox ticket** cloned from FlyRight’s cancelled catalog record. The fare comes from that row. The engine does not hardcode €183.40.

## Judge path (90 seconds)

1. Open the live URL in **ChatGPT’s in-app browser** (or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`).
2. Copy the yellow prompt on the page. It includes this browser’s locator and last name.
3. Watch `get_booking` fill the carrier desk.
4. Let the agent call `submit_claim` **before** anyone signs. It must fail with `APPROVAL_REQUIRED`.
5. Click **Sign the filing**.
6. Let the agent file. The claim appears on the desk. The page re-reads FlyRight and stamps verified.

Failure catalog (read-only probes, not this page’s ticket):

| Locator | Last name | What happens |
| --- | --- | --- |
| FR2201 | KLEIN | Scheduled — ineligible |
| FR0999 | BERG | Cancelled but already claimed |

## Why this is a WebMCP use case

Agents should not scrape an airline desk. The page registers tools with `document.modelContext.registerTool`. Those tools run in the page, mutate FlyRight, and dispatch into the same DOM the human is looking at. Permission is enforced **in `submit_claim`**, not only in a parallel REST path the agent can skip.

## What is implemented

Tools on `/`:

- `get_booking`
- `get_flight_status`
- `get_policy`
- `calculate_compensation`
- `get_claim_status`
- `get_chamber`
- `submit_claim` (human-gated, idempotent, then verified)

Chamber tickets (`AG……`) cannot be filed from `/providers/flyright`. That back door is closed.

## Run

```bash
npm install
cp .env.example .env.local   # if present; otherwise set env vars
npm run dev
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. See [`docs/11-operations/ENV_SCHEMA.md`](docs/11-operations/ENV_SCHEMA.md).
## Run

```bash
npm install
cp .env.example .env.local   # if present; otherwise set env vars
npm run dev
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. See [`docs/11-operations/ENV_SCHEMA.md`](docs/11-operations/ENV_SCHEMA.md).
## Run

```bash
npm install
cp .env.example .env.local   # if present; otherwise set env vars
npm run dev
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. See [`docs/11-operations/ENV_SCHEMA.md`](docs/11-operations/ENV_SCHEMA.md).

```bash
npm test
npm run typecheck
```

## Paste this on Devpost

**Why WebMCP:** A cancelled flight is a two-sided job. The person owns the signature. The agent owns the lookup and the filing. WebMCP is the only way they share one live page instead of the agent scraping a desk or calling a hidden API.

**Better UX:** ChatGPT looks up the ticket and the carrier desk fills in. `submit_claim` fails until the human signs. After the agent files, Aegis re-reads FlyRight and stamps verified. That was clumsy when the agent had to guess through forms.

**Together:** The human cannot file without the agent (or the same gated tool). The agent cannot file without the human. They stay on one URL, one session.

**How we implemented it:** `document.modelContext.registerTool` on `/` for `get_booking`, `get_flight_status`, `get_policy`, `calculate_compensation`, `get_claim_status`, `get_chamber`, and `submit_claim`. Each `execute` hits the live FlyRight sandbox and dispatches into the same DOM. Chamber tickets cannot be filed from the public counter.

## License

MIT
