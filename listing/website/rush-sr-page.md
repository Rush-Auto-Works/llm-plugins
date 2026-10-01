# /rush-sr/ page: AI assistant section (draft)

https://rushautoworks.com/rush-sr/ is where every connector result links to, and both directory listings cite it as the website. This is a section to add to that page. Plain text, because search engines and AI search read it. Replace the bracketed items before publishing.

---

## Ask Claude or ChatGPT about your Rush SR

Rush Auto Works has two connectors that let an AI assistant answer from the Rush SR owner's manual and analyze your AiM lap data. There is no sign-in, and they work in Claude and in ChatGPT.

### Maintenance answers from the manual

Ask "why won't my Rush SR start?", "how often should I change the brake fluid?" or "how do I bleed the brakes?" and the assistant finds the matching section of the [owner's manual](https://manual.rush.sr) and links to it. It covers the Rush SR only.

### Lap analysis for AiM RaceStudio and .xrk data

Give it a RaceStudio CSV export, or an AiM `.xrk` log in Claude, and ask:

- "Analyze my laps": lap times, best lap, theoretical best, consistency.
- "Compare lap 3 and lap 4": time delta, braking points and corner minimum speeds.
- "Where am I losing time on lap 3?": the sectors that cost the most.
- "Compare these two sessions: who was faster and where?": two drivers or two cars on the same track.

### How to add it

**Claude.** Open Customize, then Connectors, then add a custom connector with `https://maintenance.mcp.rush.sr/mcp` or `https://laps.mcp.rush.sr/mcp`. For `.xrk` files, install the Rush SR plugin from [the repository](https://github.com/Rush-Auto-Works/llm-plugins) (zip the `plugin` folder and upload it under Customize, Plugins). [Replace with the directory link once listed.]

**ChatGPT.** [Replace with the plugin directory link once listed.] In developer mode, add the same two URLs under ChatGPT Plugins.

### What happens to your data

The connectors analyze what you send in memory and store nothing. See the [privacy policy](https://rushautoworks.com/privacy-policy/).

### Source

The servers, the plugin and the tests are open source (MIT): https://github.com/Rush-Auto-Works/llm-plugins. Listed in the official MCP Registry as `sr.rush/maintenance` and `sr.rush/lap-analyzer`.
