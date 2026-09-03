# Aegis OS

**Live demo:** https://aegis-chamber.vercel.app

**Aegis OS** is a shared desktop for consumer disputes — not a chatbot. ChatGPT works the page through WebMCP. You sign money. Software owns entitlement math. Success is a provider re-read (`verify_filing` matched).

Two disputes can pay. **FR0999 / BERG is already claimed and must stay blocked.** Brands are labeled sandboxes. Rows are real and persisted. No login. Each visit issues a fresh FlyRight ticket and Streamly subscription.

## Judge path (about two minutes)

1. Open the live URL in **ChatGPT’s in-app browser** (or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`).
2. Boot into the **desktop** (Task Manager · Inspector · Console · dock).
3. Copy **“Go ahead.”** from the yellow command bar — not a tool recipe.
4. Agent calls `begin_resolution`. **UAC** opens for signatures.
5. Click **File without signature** once. It must fail with `APPROVAL_REQUIRED`.
6. **Sign** both eligible amounts in UAC. Say **“Continue.”**
7. `continue_resolution` runs execute → verify. Expected vs observed must match.
8. FR0999 / BERG stays blocked. Do not file it.

## Why this is a WebMCP use case

A refund is a two-sided job. Scraping a carrier desk, or calling a hidden API the human cannot see, breaks that. This desktop registers tools with `document.modelContext.registerTool`. Tools run in the page, mutate persisted sandbox state, and paint the same windows you see. Permission is enforced **inside `execute_filing`**.

## Tools on `/`

Orchestration: `begin_resolution` · `continue_resolution`

Atomic: `list_work_items` · `get_work_item` · `inspect_counter` · `compute_entitlement` · `prepare_filing` · `request_signature` · `execute_filing` · `verify_filing`

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Apply `supabase/migrations/`. See [`docs/11-operations/ENV_SCHEMA.md`](docs/11-operations/ENV_SCHEMA.md).

```bash
npm run preflight
npm run test:theater
```

`GET /api/health/theater` is the demo readiness gate.

## Paste this on Devpost

**Why WebMCP:** A refund is a two-sided job. The person owns the signature. The agent owns lookup and filing. WebMCP is how they share one live desktop instead of scraping a desk or calling a hidden API.

**Better UX:** Say “Go ahead.” The OS prepares filings and opens UAC. Unsigned file fails with APPROVAL_REQUIRED. After Continue, Aegis re-reads the row and shows expected vs observed.

**Together:** The agent cannot file without you. You should not type locators into forms. One URL, one session, ten tools, a real desktop — not a chat UI.

**How we implemented it:** `document.modelContext.registerTool` on `/` for begin/continue plus atomic inspect → verify. Each execute hits live sandbox tables and updates the same windows. FR0999 cannot be prepared. Amounts come from software, not the model.

## License

MIT
