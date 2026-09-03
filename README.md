# Aegis OS

**Live demo:** https://aegis-chamber.vercel.app

**Aegis OS** is the shared desktop where you and ChatGPT get consumer money back — not a chatbot. Two beats on one URL:

1. **Provider desk** — live sandbox rows, human UAC, `verify_filing` matched  
2. **Mail Disputes** — billed-after-cancel in the sandbox mailbox → import bill → policy → sign → send → `verify_sent` matched  

Software owns amounts. You own permission. Success is a re-read.

## Judge path (~2.5 minutes)

1. Open https://aegis-chamber.vercel.app in **ChatGPT’s in-app browser** (or Chrome 149+ WebMCP flag).
2. Wait for **WEBMCP ONLINE**.
3. **Beat A — Provider:** Copy **“Go ahead.”** → agent `begin_resolution` → **File without signature** must return `APPROVAL_REQUIRED` → Sign both amounts → **“Continue.”** → VERIFY matched. FR0999 stays blocked.
4. **Beat B — Mail:** Dock → **Mail Disputes** → say **“Check my email for CodeForge and prepare a refund.”** (or Begin mail resolution) → Sign outbound UAC → Send → VERIFY · SENT MATCHED.
5. Close: agent cannot move money or send without you.

## Tools on `/`

Provider: `begin_resolution` · `continue_resolution` · atomic inspect → verify  

Mail: `begin_mail_resolution` · `list_mail_disputes` · `import_bill` · `lookup_refund_policy` · `prepare_support_email` · `request_mail_signature` · `send_support_email` · `verify_sent`

## Why WebMCP

A refund is a two-sided job. Scraping a desk or calling a hidden API breaks that. Tools register with `document.modelContext.registerTool`, mutate live sandbox state, and paint the same windows you see. Permission is inside `execute_filing` / `send_support_email`.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Apply `supabase/migrations/` including `theater_*` and `mail_desk`.

```bash
npm run preflight
npm run test:theater
npx vitest run tests/integration/mail-desk.integration.test.ts
```

`GET /api/health/theater` — provider desk readiness.

## Paste this on Devpost

**Why WebMCP:** A refund is two-sided. The person signs. The agent looks up and files/sends. WebMCP is the shared desktop — not a scrape and not a hidden API.

**Better UX:** Say “Go ahead.” for provider filings. Say “Check my email for CodeForge…” for mail disputes. Unsigned actions fail with APPROVAL_REQUIRED. Success is expected vs observed.

**Together:** One URL, one session, provider + mailbox, human UAC, verified outcomes.

**How we implemented it:** `document.modelContext.registerTool` on `/` for theater + mail desk tools. Sandbox rows and outbound_mail are real. Amounts from software. Gmail ports exist for public launch; demo uses sandbox mail.

## License

MIT
