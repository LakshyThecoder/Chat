# Aegis Flight Desk

**Live demo:** https://aegis-chamber.vercel.app

Aegis is a two-sided passenger-rights control plane. An agent turns airline mail into a travel graph, prices the claim with deterministic law, stops for a human signature, files through the airline's own WebMCP surface, and verifies the provider row. Software owns the money. You own permission.

The homepage **is** the product. No boot splash. No fake operating system.

## Judge path (~2.5 minutes)

1. Open https://aegis-chamber.vercel.app in **ChatGPT’s in-app browser** (or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`).
2. Wait for **WebMCP live**.
3. Keep the **Live Judge Mission** in view; it starts at 0/6 and only advances from observed workflow state.
4. Copy **“Check my airline email and tell me what I’m owed.”**
5. Agent scans the airline inbox (bookings, cancellations, **promos**), builds the travel graph, computes rights, and stops for signature. FR0999 / BERG stays blocked.
6. **File without signature** must return `APPROVAL_REQUIRED`; the mission cannot skip consent.
7. Authorize the exact unused-fare amount from the mission board.
8. Click **File and verify**. Filing executes, the carrier is re-read, and the mission reaches 6/6 only when `verify_filing` matches.

## What people and agents do together

- **You** connect the airline inbox, read evidence, and sign the amount.
- **ChatGPT** calls WebMCP tools on this page: scan mail, compute rights, prepare, file, verify.
- **Software** calculates unused-fare refund plus EU261 / UK261 / DOT lines. The model never owns the number.
- **FlyRight** is a second WebMCP surface — a live airline counter the agent can inspect and file against.

Promotional mail is kept on purpose. A sale email can reveal a future itinerary before it breaks.

## WebMCP tools on `/`

Orchestration: `begin_resolution` · `continue_resolution`

Flight desk: `scan_airline_mail` · `get_travel_graph` · `get_disruption` · `compute_rights` · `research_passenger_rights` · `prepare_claim`

Carrier loop: `inspect_counter` · `compute_entitlement` · `prepare_filing` · `request_signature` · `execute_filing` · `verify_filing`

Registered with `document.modelContext.registerTool`. Amounts come from deterministic policy. Unsigned mutations fail.

## Why WebMCP

A refund is two-sided. Scraping a carrier site or calling a hidden API breaks the shared desk. Tools mutate live sandbox rows and paint the same itinerary, rights, and permission sheet you see.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Apply `supabase/migrations/` including `theater_*`.

Optional: `EXA_API_KEY` enables citation-preserving passenger-rights research. The server limits retrieval to official government domains for the applicable regime; Exa evidence never replaces deterministic money calculation.

The current judge path uses the seeded airline inbox. Gmail OAuth credentials must be rotated if exposed and must not be enabled until refresh-token storage is encrypted, user-owned, and protected by RLS.

```bash
npm run preflight
npm run test:theater
```

## Paste this on Devpost

**Why WebMCP:** Passenger rights cross multiple live contexts: the traveler’s inbox, an eligibility engine, human consent, and airline state. WebMCP lets one agent use typed capabilities across that entire path while sharing the visible page and signed-in session with the person. This cannot be delivered reliably by DOM guessing or a hidden backend action.

**Better UX:** The homepage is a flight desk — inbox, itinerary ribbon, rights, permission. Say “Check my airline email…”. Unsigned filings return `APPROVAL_REQUIRED`. Success is expected vs observed.

**Together:** ChatGPT reconstructs the trip, reads the carrier, computes the claim, and prepares execution. The person inspects evidence and signs the exact amount. The agent then files and verifies. Promotional mail can become a watched future trip; an existing claim becomes a replay block.

**How we implemented it:** `/` registers route-scoped typed tools with `document.modelContext.registerTool`. Read, compute, prepare, mutate, and verify capabilities have explicit schemas and side-effect semantics. Sandbox bookings and claims are persisted rows. High-impact execution checks server-side approval immediately before mutation, uses idempotency keys, and only reports success after a provider re-read matches the signed amount.

## License

MIT
