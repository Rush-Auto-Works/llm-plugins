# llm-plugins

Remote MCP servers and a Claude plugin for Rush SR owners and anyone who analyzes AiM data. Built by [Rush Auto Works](https://rushautoworks.com).

They work in Claude and in ChatGPT: ask a question about your Rush SR, or give it an AiM RaceStudio lap export or an `.xrk` log and ask who was faster and where.

| Piece | What it does | Where |
|---|---|---|
| Rush SR maintenance server | Diagnoses a symptom, looks up a service interval, finds the steps for a procedure, all from the public [owner's manual](https://manual.rush.sr), with deep links | `servers/maintenance`, `https://maintenance.mcp.rush.sr/mcp` |
| Rush SR lap server | AiM RaceStudio CSV analysis: lap times, best and theoretical best lap, compare two laps, where a lap loses time, compare two sessions or two drivers | `servers/laps`, `https://laps.mcp.rush.sr/mcp` |
| Rush SR plugin for Claude | Both servers plus a skill that reads AiM `.xrk` logs and full-size CSVs in Claude's sandbox | `plugin/` |
| US road courses | 93 road-racing venues with street address, coordinates and whether each is still running; the same list the dealer CRM uses for "Nearest tracks" | `data/us-road-courses.csv` |

## Use it

Add either URL as a custom connector in Claude (Customize, Connectors) or in ChatGPT developer mode (Settings, Security and login, Developer mode, then ChatGPT Plugins). No sign-in is needed.

For `.xrk` files in Claude, zip the `plugin/` folder and upload it under Customize, Plugins, Add, Upload plugin. Attach an `.xrk` file and ask "analyze my laps". The skill converts it with [libxrk](https://pypi.org/project/libxrk/) and runs the same analysis engine as the lap server.

```
 AiM .xrk ─▶ convert.py (libxrk) ─▶ RaceStudio-style CSV ─▶ engine.mjs (node) ─▶ lap analysis
```

## What it does with your data

The servers analyze a CSV in memory and store nothing. They are retrieval and arithmetic only and make no calls to a language model. The plugin README lists everything the skill runs and sends.

## Develop

Each server is its own package.

```
cd servers/laps          # or servers/maintenance
npm ci
npm run typecheck
npm test                 # boots wrangler dev and runs the E2E suite
npm run build:skill      # laps only: regenerates plugin/skills/rush-sr-laps/scripts/engine.mjs
```

The converter tests need `numpy` and run with `python3 -m unittest discover -s plugin/skills/rush-sr-laps/tests`. CI fails if `engine.mjs` drifts from the source.

Design notes are in `docs/`: platform findings, and a plan with a failure matrix for each server and for the skill.

## License

MIT, see `plugin/LICENSE` and `LICENSE`.
