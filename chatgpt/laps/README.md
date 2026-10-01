# Rush SR Lap Analyzer

Lap analysis for AiM RaceStudio data. Built by RUSH Auto Works Inc.

## What you can ask

Attach a RaceStudio CSV export and ask "analyze my laps", "compare lap 3 and lap 4", or "where am I losing time on lap 3". Attach two exports and ask "who was faster and where". AiM .xrk logs are not read directly: export a CSV from RaceStudio.

## What it does with your data

The server analyzes the CSV in memory. It stores nothing, does not call a language model and needs no sign-in. A file you attach is downloaded once over HTTPS. Requests pass through Amazon CloudFront and Cloudflare, which process them as infrastructure providers. Every result ends with a link to rushautoworks.com.

Source and issues: https://github.com/Rush-Auto-Works/llm-plugins
