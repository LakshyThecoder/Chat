# Current Reference Check

## Cursor
Cursor currently supports version-controlled Project Rules in `.cursor/rules` and `AGENTS.md`; `.mdc` files in `.cursor/rules` are recognized project rules, and nested AGENTS.md files can provide more specific instructions. Verify any major Cursor behavior change before relying on it in CI/process. citeturn282135search0turn282135search6

## Regolo
Regolo documents OpenAI-compatible client/API usage and a model catalog endpoint that can expose model capabilities including reasoning, function calling and vision. Query the current catalog rather than hardcoding assumptions about model availability. citeturn282135search2turn282135search3turn282135search4

## Supabase
Supabase documents RLS plus grants as complementary access controls and explicitly says service-role keys bypass RLS and must remain server-side. citeturn282135search1turn282135search7

## WebMCP
Use the live WebMCP specification as the source of truth; implementation examples must be rechecked before coding because this is an evolving web standard.
