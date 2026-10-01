# Rush SR

Maintenance answers from the Rush SR owner's manual, and lap analysis for AiM RaceStudio data. Built by RUSH Auto Works Inc.

## What you can ask

- "Why won't my Rush SR start? The dash shows N." The plugin finds the matching section of the owner's manual and links to it.
- "How often should I change the brake fluid?" You get the service interval and which interval it belongs to.
- "How do I bleed the brakes?" You get the steps from the manual.
- Attach an AiM RaceStudio CSV export and ask "analyze my laps", "compare lap 3 and lap 4", "where am I losing time on lap 3", or attach two exports and ask "who was faster and where".

## What it does with your data

The maintenance server receives your question and searches the public manual. The lap server receives CSV text, or a link to a file you attached, and analyzes it in memory. Neither stores your data or calls a language model, and neither needs a sign-in. Requests pass through Amazon CloudFront and Cloudflare, which process them as infrastructure providers.

Every lap result ends with a link to rushautoworks.com.

Source and issues: https://github.com/Rush-Auto-Works/llm-plugins
