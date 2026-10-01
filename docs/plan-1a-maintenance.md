# 1A: Rush SR maintenance MCP server

A standalone Cloudflare Worker, retrieval-only. This server makes no LLM calls. It returns manual excerpts and the host
model (ChatGPT, Claude) does the reasoning, so a public endpoint has no spend to cap.

## Data

`GET {MANUAL_BASE}/assistant/index.json`, public, S3 + CloudFront, `cache-control: public, max-age=3600`.
Shape: `{version, embed_model, dims, chunks:[{id, route, title, heading, anchor, text, vec}]}`, 385 chunks,
1.25 MB. `vec` is ignored in v1 (lexical BM25 search). Deep link: `{MANUAL_PUBLIC_URL}/{route}#{anchor}`.

## Worker

- `createMcpHandler` from `agents/mcp/server`, stateless, Streamable HTTP at `/mcp`. No Durable Objects (version
  URLs do not work with them).
- Env vars: `MANUAL_BASE` (default `https://manual.rush.sr`), `MANUAL_PUBLIC_URL` (default
  `https://manual.rush.sr`, used for links so tests can point `MANUAL_BASE` at a fixture), `INDEX_TTL_MS`
  (default 3600000), `OPENAI_APPS_CHALLENGE` (token served at `/.well-known/openai-apps-challenge`, 404 if unset).
- Index cache: module-level, TTL, one in-flight fetch shared by concurrent callers, stale copy kept for fallback.

## Tools (all `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`, with `outputSchema`)

| Tool | Input | Route filter |
|---|---|---|
| `diagnose_symptom` | `symptom` (1-500 chars), `context?` (<=500 chars) | whats-wrong, paddock-quick-reference, trackside-reference, service-bulletins, maintenance |
| `maintenance_schedule` | `component` (1-200) | `maintenance/*` only. Each result carries an `interval` from its route (every session, weekend, month, year, 150+ hours) so the caller picks the one that applies. `hours` and `sessions` were dropped: they were accepted and mostly ignored |
| `lookup_procedure` | `task` (1-200) | whole manual, `maintenance/` and `at-the-track/` weighted up |

Result: `structuredContent = {results:[{title, heading, url, excerpt}], stale, rush:{label, url}}`. Excerpts are
capped at 1500 chars, at most 5 results, HTML tags stripped. Every link to rushautoworks.com carries
`utm_source=mcp&utm_medium=plugin&utm_campaign=rush-sr-maintenance&utm_content=<tool name>`.
The text content ends with a "Built by Rush Auto Works" line carrying that link.

## Failure matrix

| # | State or input | What the operation does | How it fails | Caller is told |
|---|---|---|---|---|
| 1 | index fetch ok, query matches | BM25 over route-filtered chunks | none | top results, `stale: false` |
| 2 | cache expired, upstream now 5xx | serve the cached copy | stale data | results with `stale: true` |
| 3 | cold start, upstream 5xx | nothing to serve | no data at all | `isError`, plain message, manual homepage link |
| 4 | upstream returns malformed JSON or wrong `version` | reject, keep nothing | poisoned cache | `isError`; the next request after upstream recovers succeeds |
| 5 | query matches nothing | empty result set | none | NOT an error: empty `results`, manual link and contact link |
| 6 | empty or oversize input | schema validation | none | validation error, no upstream call |
| 7 | chunk text carries HTML (iframe, script) | strip tags before returning | markup reaches the host model | plain text only |
| 8 | one chunk is huge | truncate excerpt | oversize tool result | excerpt <= 1500 chars, total text < 12000 |
| 9 | 10 concurrent cold requests | share one in-flight fetch | upstream stampede | all succeed, upstream sees exactly 1 index fetch |
| 10 | wrong path or method | handler rejects | none | 404 off `/mcp`, `/` returns small JSON info |
| 11 | challenge token unset or set | `/.well-known/openai-apps-challenge` | token leak when unset | 404 when unset, plain-text token when set |
| 12 | tool listing | metadata | weak discovery text | 3 tools, annotations, `outputSchema`, descriptions contain "Use this when" and "Do not use for" |

## Test list (E2E, `e2e/maintenance.e2e.test.mjs`)

Starts a fixture HTTP server standing in for manual.rush.sr, boots `wrangler dev` with `MANUAL_BASE` pointed at it,
and speaks raw JSON-RPC to `/mcp`. Writes `e2e/out/results.json` with the checked values on every run. One test per
matrix row, plus: UTM check on every rushautoworks.com link, deep-link shape, and `maintenance_schedule` bucket logic.

## Deploy

`wrangler versions upload --preview-alias preview`, Worker without Durable Objects, `preview_urls: true`. Needs
`wrangler` login to a Cloudflare account, which is checked at deploy time. Out of scope here: ChatGPT submission
(business verification, privacy policy, terms, support URL).
