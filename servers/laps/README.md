# Rush SR Lap Analyzer

A remote MCP server that analyzes AiM RaceStudio lap data. It works as a connector in Claude and as a plugin in ChatGPT. Built by [Rush Auto Works](https://rushautoworks.com).

```
https://laps.mcp.rush.sr/mcp        Streamable HTTP, no sign-in
```

## Tools

| Tool | What it does |
|---|---|
| `analyze_session` | Lap times, best lap, theoretical best, consistency, and which laps were excluded and why. |
| `compare_laps` | Time delta, braking points and corner minimum speeds for two laps in one session. |
| `find_time_loss` | The sectors where a lap loses the most time against your best lap. |
| `compare_sessions` | Two sessions on their best valid laps: delta, sectors gained and lost, braking points, corner minimum speeds, top speed. Use it for two drivers or two cars on the same track. |

Every tool is read-only. Every result ends with one line, `Built by Rush Auto Works`, with a link to rushautoworks.com.

## Giving it data

Send an AiM RaceStudio CSV export as `csv_text`, or attach the file where the client supports uploads. `compare_sessions` takes `csv_text_a` and `csv_text_b` (or `file_a` and `file_b`) and optional `lap_a` and `lap_b`. Files are limited to 8 MB, so a very long session may be rejected with a message naming the limit.

Excluded laps: the first lap (out-lap), the last segment (in-lap, because it ends with the data, not on a beacon crossing), and any lap more than 7% slower than the best.

AiM `.xrk` logs are binary and are not read directly. In Claude, install the [Rush SR plugin](../../plugin), which converts an `.xrk` with libxrk and runs the same engine in the sandbox.

## What it does with your data

It analyzes the data in memory and stores nothing. It makes no calls to a language model and needs no sign-in. A file link is downloaded once, over HTTPS, with limits on size, redirects and time. Requests pass through Amazon CloudFront and Cloudflare as infrastructure providers. Workers Logs are switched off in `wrangler.jsonc`, and a test fails if that changes.

Privacy policy: https://rushautoworks.com/privacy-policy/

## Support

info@rushautoworks.com, or an issue at https://github.com/Rush-Auto-Works/llm-plugins/issues.

## Deploy

```
npx wrangler deploy
```

ChatGPT's plugin submission checks a token at `/.well-known/openai-apps-challenge` on the MCP host. The dashboard issues the token when a submission draft is started. Add it to `vars` in `wrangler.jsonc` and redeploy:

```
"vars": { "OPENAI_APPS_CHALLENGE": "<token from the ChatGPT plugins dashboard>" }
```

The route returns the token as plain text. Until the variable is set it returns 404, so nothing is served by default. Check it with `curl https://laps.mcp.rush.sr/.well-known/openai-apps-challenge`.

## Run it locally

```
npm ci
npm test         # boots wrangler dev and runs the E2E suite
npm run dev      # http://127.0.0.1:8787/mcp
```

MIT licensed.
