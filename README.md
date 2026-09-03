# Aegis

**Live demo:** https://aegis-chamber.vercel.app

ChatGPT and a person share **one refund desk**. The agent inspects live sandbox rows and prepares a filing. The person signs the amount. The provider row must then match. Success is a re-read, not a model saying it worked.

Two disputes can pay. **FR0999 / BERG is already claimed and must stay blocked.** Brands are labeled sandboxes. The rows are real and persisted. There is no login. Each visit issues a fresh FlyRight ticket and Streamly subscription so two judges cannot collide.

## Judge path (about two minutes)

1. Open the live URL in **ChatGPT’s in-app browser** (or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`).
2. Read the manifesto, then **Open the live desk** (or go to `#desk` / `?desk=1`).
3. Copy the yellow **goal** (not a tool recipe).
4. Watch `inspect_counter` fill the passenger or plan on the desk.
5. Click **File without signature**. It must fail with `APPROVAL_REQUIRED`.
6. Let the agent prepare the two eligible filings. **Sign the amounts.**
7. Agent (or **File signed claim**) runs `execute_filing` then `verify_filing`. Expected vs observed must match.
8. The FR0999 / BERG row stays ineligible. Prepare must fail. Do not file it.

## Why this is a WebMCP use case

A refund is a two-sided job. Scraping a carrier desk, or calling a hidden API the human cannot see, breaks that. This page registers tools with `document.modelContext.registerTool`. Those tools run in the page, mutate persisted sandbox state, and dispatch into the same DOM the human is looking at. Permission is enforced **inside `execute_filing`**, not only in a parallel REST path the agent can skip.

## Tools on `/`

- `list_work_items`
- `get_work_item`
- `inspect_counter`
- `compute_entitlement`
- `prepare_filing`
- `request_signature`
- `execute_filing` (human-gated, idempotent)
- `verify_filing` (re-read; fail-closed)

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Apply `supabase/migrations/` including `theater_sessions` and `theater_hardening`. See [`docs/11-operations/ENV_SCHEMA.md`](docs/11-operations/ENV_SCHEMA.md).

```bash
npm run preflight
npm run test:theater
```

`GET /api/health/theater` is the demo readiness gate (tables, FR1842 template, FR0999 claim, Streamly template).

## Paste this on Devpost

**Why WebMCP:** A refund is a two-sided job. The person owns the signature. The agent owns lookup and filing. WebMCP is how they share one live page instead of scraping a desk or calling a hidden API.

**Better UX:** The counter fills when the agent inspects. Filing fails until you sign. After file, Aegis re-reads the row and shows expected vs observed.

**Together:** The agent cannot file without you. You should not have to type locators into forms. One URL, one session.

**How we implemented it:** `document.modelContext.registerTool` on `/` for inspect, compute, prepare, request signature, execute, and verify. Each `execute` hits live sandbox tables and updates the same DOM. Already-claimed catalog row FR0999 cannot be prepared. Amounts come from software, not the model.

## License

MIT
