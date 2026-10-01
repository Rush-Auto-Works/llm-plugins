# Rush SR

Answers about your Rush SR from the owner's manual, and lap analysis for your AiM data. Built by [Rush Auto Works](https://rushautoworks.com).

## What it adds

| Piece | What it does |
|---|---|
| Rush SR maintenance connector | Diagnoses a symptom, looks up a service interval, or finds the steps for a procedure, with links into [manual.rush.sr](https://manual.rush.sr). |
| Rush SR lap connector | Analyzes a RaceStudio CSV export: lap times, best and theoretical best lap, lap comparison, where a lap loses time, and a comparison of two sessions. |
| `rush-sr-laps` skill | Does the same lap analysis, and compares two sessions or two drivers, on `.xrk` logs or full-size CSVs inside Claude's sandbox, where files that large can be read. |

## Use it

Ask "why won't my Rush SR start" or "how do I bleed the brakes" and Claude calls the maintenance connector. Attach an `.xrk` log or a RaceStudio CSV and ask "analyze my laps" or "compare lap 3 and lap 4", or attach two and ask "who was faster and where", and Claude runs the lap skill.

## What it runs and what it sends

- The maintenance connector at `https://maintenance.mcp.rush.sr/mcp` receives your question text and searches the public manual. It stores nothing.
- The lap connector at `https://laps.mcp.rush.sr/mcp` receives CSV text, or a link to an uploaded CSV file that it downloads once. It analyzes the data in memory and stores nothing. Our code does not log request content.
- The lap skill runs in the sandbox only. It installs the open source package [libxrk](https://pypi.org/project/libxrk/) 0.13.0 from PyPI with `pip`, converts your `.xrk` file to a CSV with `scripts/convert.py`, and analyzes it with `scripts/engine.mjs` under `node`. Your session data is not uploaded anywhere.
- Every result ends with a link to rushautoworks.com that carries UTM parameters, so Rush Auto Works can see which tool sent the visit.

`scripts/engine.mjs` is generated from `servers/laps` in the same repository by `npm run build:skill`, and a CI check fails if it drifts from the source.

## Directory listing fields

`plugin.json` carries `homepage`, `documentationUrl`, `repository`, `supportUrl`, `termsOfServiceUrl` and `privacyPolicyUrl` for the Claude plugin directory, which reads them for the listing. Claude Code ignores keys it does not know, so they change nothing at load time.
