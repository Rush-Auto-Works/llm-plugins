# Platform findings (checked 2026-09-30)

What we verified before building, and what we could not. Sources are primary docs. "UNVERIFIED" means no primary
source was found or the page could not be opened.

## ChatGPT plugins and Claude connectors

| Question | Finding | Source |
|---|---|---|
| Rename from apps to plugins | Reported as 2026-07-09. UNVERIFIED beyond a search snippet, because the help page returned 403 | help.openai.com/en/articles/20001256-plugins-in-codex |
| Submission | Upload a ZIP, pass automated checks, submit, publish. Hosted MCP changes need no resubmission, but metadata changes need a new ZIP | developers.openai.com/apps-sdk/deploy/submission |
| Who can submit | Org owners, or members with "Apps Management Write". Individual or business verification is required | same |
| Required URLs | Website, support, privacy policy, and terms of service over HTTPS, all naming the same publisher | same |
| Domain check | Serve a token at `/.well-known/openai-apps-challenge` on the MCP host | same |
| Listing rules | Verified publishers, a privacy policy, data minimization. Only physical goods can be sold | developers.openai.com/apps-sdk/app-submission-guidelines |
| Suggestion | Tool names, descriptions ("Use this when" and "Do not use for"), parameter docs, and the read-only, destructive, and open-world hints drive tool selection. Proactive suggestion is an eligibility perk. The ranking mechanism is UNVERIFIED | developers.openai.com/apps-sdk/guides/optimize-metadata |
| File uploads | ChatGPT: a tool declares `_meta["openai/fileParams"]` and receives `download_url` and `file_id`. Claude connectors: no file mechanism documented. Plugin size limits UNVERIFIED | developers.openai.com/apps-sdk/reference, claude.com/docs/connectors/building |
| Widgets | Optional. Plain tool output works in both clients | developers.openai.com/apps-sdk/build/chatgpt-ui |
| Transport | Streamable HTTP at a stable URL, usually `/mcp`. SSE is deprecated | developers.openai.com/apps-sdk/build/mcp-server, developers.cloudflare.com/agents/model-context-protocol/transport/ |
| MCP spec | Current revision 2026-07-28. Whether either client speaks it yet is UNVERIFIED | modelcontextprotocol.io/specification/latest |
| Auth | ChatGPT allows `noauth` per tool. Claude allows no-auth and static headers | developers.openai.com/apps-sdk/build/auth, claude.com/docs/connectors/building |

## Cloudflare Workers

- `createMcpHandler` from `agents/mcp/server` is the recommended stateless path. `McpAgent` is deprecated.
- Version URLs (preview URLs) do not work for Workers that use Durable Objects, so the Workers here avoid them.
- Version URLs need `workers.dev` and `"preview_urls": true`. Aliases use `--preview-alias`.
- A minimum wrangler version was not stated. UNVERIFIED.

Source: developers.cloudflare.com/agents/model-context-protocol/transport/ and
developers.cloudflare.com/workers/configuration/previews/.

## Implications

1. One stateless Worker per tool set, Streamable HTTP at `/mcp`, no Durable Objects.
2. Start public and no-auth for read-only tools. Add OAuth only when a tool needs per-user data.
3. Prepare the submission items now: business verification, four HTTPS URLs on one publisher, the challenge file.
4. Treat file upload as untested. Keep a pasted-CSV fallback for the lap analyzer (1B), since Claude documents no file mechanism.
5. Every tool carries explicit annotations and a "Use this when / Do not use for" description.
