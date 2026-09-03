# Demo Preflight

## Product
- `GET /api/health/theater` returns `ok`.
- `/` opens three work items without login.
- FR0999 / BERG is visibly blocked.

## WebMCP
- Chrome 149+ with `chrome://flags/#enable-webmcp-testing` **or** ChatGPT in-app browser.
- Header shows WebMCP ready and eight tool names.
- `document.modelContext.getTools()` (if present) lists the same names.

## Permission
- File without signature → `APPROVAL_REQUIRED`.
- Sign → execute → verify matched.
- Replay execute does not duplicate the provider row.

## Browser
- Console free of blocking errors.
- Network: `/api/demo/theater/session` 200, tools 200/403 as expected.
- Hard refresh after deploy.

## Narrative
- Yellow goal copied, not a tool recipe.
- Video script: `docs/12-demo/VIDEO_SCRIPT.md`
