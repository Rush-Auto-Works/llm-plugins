# Rush SR Maintenance

A remote MCP server that answers questions about the Rush SR from the public [owner's manual](https://manual.rush.sr). It works as a connector in Claude and as a plugin in ChatGPT. Built by [Rush Auto Works](https://rushautoworks.com).

```
https://maintenance.mcp.rush.sr/mcp        Streamable HTTP, no sign-in
```

## Tools

| Tool | What it does | Example |
|---|---|---|
| `diagnose_symptom` | Finds the manual sections that explain a symptom. | "My Rush SR won't start and the dash shows N." |
| `maintenance_schedule` | Finds the service interval for a component and says which interval it belongs to. | "How often should I change the brake fluid?" |
| `lookup_procedure` | Finds the steps for a task. | "How do I bleed the brakes?" |

Every tool is read-only and covers the Rush SR only; the descriptions tell the assistant not to use them for other vehicles. Each result links to the exact manual section and ends with one line, `Built by Rush Auto Works`, with a link to rushautoworks.com.

## How it answers

It searches the manual's published index (385 sections at the time of writing) and returns the matching excerpts. It makes no calls to a language model, so the assistant that called it does the reasoning and the manual is the source. Excerpts from the manual are escaped before they reach the assistant.

## What it does with your data

It receives your question, searches the public manual, stores nothing and needs no sign-in. Requests pass through Amazon CloudFront and Cloudflare as infrastructure providers. Workers Logs are switched off in `wrangler.jsonc`, and a test fails if that changes.

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

The route returns the token as plain text. Until the variable is set it returns 404, so nothing is served by default. Check it with `curl https://maintenance.mcp.rush.sr/.well-known/openai-apps-challenge`.

## Run it locally

```
npm ci
npm test         # boots wrangler dev against a fixture of the manual index
npm run dev      # http://127.0.0.1:8787/mcp
```

MIT licensed.
