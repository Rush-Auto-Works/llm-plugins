# MCP Registry listing

Both servers are listed in the official [MCP Registry](https://registry.modelcontextprotocol.io) under the `sr.rush/` namespace, which is verified by a DNS TXT record on `rush.sr`.

| Registry name | Server file | Remote |
|---|---|---|
| `sr.rush/lap-analyzer` | `laps.server.json` | `https://laps.mcp.rush.sr/mcp` |
| `sr.rush/maintenance` | `maintenance.server.json` | `https://maintenance.mcp.rush.sr/mcp` |

Look one up: `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=sr.rush"`.

## Update a listing

1. Edit the `version` and any text in the server file. A registry version cannot be republished, so each change needs a new version.
2. Check it: `mcp-publisher validate registry/laps.server.json`.
3. Log in with the `rush.sr` proof, using the private key Rush keeps outside this repository, then publish:

```
mcp-publisher login dns --domain rush.sr --private-key "$PRIVATE_KEY_HEX"
mcp-publisher publish registry/laps.server.json
```

The matching public key is the `v=MCPv1; k=ed25519` value in the `rush.sr` TXT records. Descriptions are limited to 100 characters.
