# Directory listings

What to submit, where, and with what text. The copy is data, so tests keep it honest: `claude-connectors.json` and `chatgpt-test-cases.json` are checked for field limits, real tool names, committed example files, and the numbers a reviewer is told to expect (`node --test listing/listing.test.mjs`). The ChatGPT package is built and checked by `chatgpt/`.

```
 Claude (claude.ai/directory/manage)                ChatGPT (platform.openai.com/plugins)
 ───────────────────────────────────                ─────────────────────────────────────
 1  MCP connector  laps.mcp.rush.sr                 1  one plugin ZIP: both servers
 2  MCP connector  maintenance.mcp.rush.sr             node chatgpt/build.mjs
 3  Plugin bundle  repo path "plugin"               2  domain token on each host
                                                    3  5 positive + 3 negative test cases
```

| Submission | Source of every field | Before you start |
|---|---|---|
| Claude connector, laps | `listing/claude-connectors.json` → `laps` | the site pages above are live |
| Claude connector, maintenance | `listing/claude-connectors.json` → `maintenance` | same |
| Claude plugin | read from `plugin/.claude-plugin/plugin.json` and `plugin/README.md` | both connectors submitted first, repo public (it is) |
| ChatGPT plugin | `chatgpt/plugin.json`, `listing/chatgpt-test-cases.json` | OpenAI verification, owner role, a screen recording |

## Claude: three submissions

You need a Pro, Max, Team or Enterprise account (an Owner on Team or Enterprise), with your GitHub account connected on claude.ai. Submit the two connectors first. Anthropic asks for a remote server to be submitted as a connector even when a plugin references it.

1. Open https://claude.ai/directory/manage, choose **Submit new**, then **MCP connector**.
2. **Connection**: paste `https://laps.mcp.rush.sr/mcp`. **Tools**: they sync from the server; each has a title and a read-only hint.
3. **Listing**: paste name, one-liner, description, slug and the two URLs from the JSON. Pick one to five categories from the portal's list (closest fits: Automotive, Sports, Data analysis). Add the icon `chatgpt/assets/icon.png`. The slug is permanent once published.
4. **Use cases**, **Company** (`RUSH Auto Works Inc`, https://rushautoworks.com, a contact you read), **Authentication**: none.
5. **Data handling**: first-party, no personal health data, no sponsored content. The attribution line is Rush's own link, not a paid placement; the description says so.
6. **Test & launch**: paste `testInstructions`. No test account is needed. Confirm you ran every tool as a custom connector in Claude.
7. **Compliance**: tick the seven acknowledgements. **Submit for review**.
8. Repeat for `maintenance`.
9. **Plugin bundle**: repository `Rush-Auto-Works/llm-plugins`, plugin path `plugin`, branch `main`. **Validate**, fix anything blocking, then answer the data handling questions below and submit.

Plugin data handling answers: it reads and stores no personal data; the only service it contacts besides its two declared connectors is PyPI, to install `libxrk` 0.13.0 in the user's sandbox; it keeps no data; it is not intended for people under 18.

## ChatGPT: one plugin

1. Complete individual or business verification in OpenAI organization settings, and use an Owner account (or one with Apps Management Write).
2. Start a plugin in the dashboard. It issues a challenge token for each MCP host. For each of `laps` and `maintenance`, add it to `vars` in `servers/<name>/wrangler.jsonc` as `OPENAI_APPS_CHALLENGE`, deploy, and check `curl https://<host>.mcp.rush.sr/.well-known/openai-apps-challenge`.
3. Build the package with `node chatgpt/build.mjs` and upload `dist/rush-sr-chatgpt-<version>.zip`.
4. Fill the form from the manifest. Enter the five positive and three negative cases from `chatgpt-test-cases.json`, with the example files as attachments. Pick the category from the dashboard's list; `Productivity` in the manifest is a guess until you see it.
5. Add a screen recording that runs all eight cases, and release notes. Complete the policy attestations. **Submit for review**.

First package scope: the two MCP servers only. ChatGPT plugins can carry a `skills/` folder, but whether a bundled script can run in ChatGPT's sandbox is unverified, so the `.xrk` skill stays Claude-only until it is tested.

## Pre-flight

```
node --test chatgpt/package.test.mjs listing/listing.test.mjs
claude plugin validate ./plugin
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=sr.rush"
```

## Website text

The pages both submissions link to are live content in the `rushautoworks` repo (PR 567): a plugins section in https://rushautoworks.com/privacy-policy/ (with a last-updated date), a clause in https://rushautoworks.com/terms-and-conditions/, and https://rushautoworks.com/ai-assistants/, which is the documentation and website URL in every listing. Content pages are pushed to WordPress with `scripts/sync-content.sh push prod <slug>`; a merge alone does not publish them.
