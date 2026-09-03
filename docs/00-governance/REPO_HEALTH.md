# Repository Health Model

Green requires:
- TypeScript clean
- lint clean
- unit tests clean
- integration tests clean
- E2E primary workflow clean
- security checks clean
- migration checks clean
- WebMCP smoke test clean
- no known secret exposure
- no unresolved P0/P1 issues

Yellow:
- non-blocking known issues documented

Red:
- high-impact workflow not verifiably safe
- permission bypass
- false provider success
- data isolation failure
- release cannot reproduce demo
