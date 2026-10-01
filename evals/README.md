# Discovery evals

How well do Claude and ChatGPT pick the right Rush SR tool from a plain question?

`golden-prompts.json` holds 36 prompts: direct (names the car and the job), indirect (natural wording) and negative (no tool should run), for all seven tools. The method follows OpenAI's guidance on testing app metadata with a golden prompt set, scored for recall (did the right tool run?) and precision (did it stay out of the way?).

## Claude

```
CLAUDE_BIN=claude node evals/run-claude.mjs            # all prompts, writes evals/results/<date>-claude.md
node evals/run-claude.mjs --only diag-d1,neg-4         # a few prompts
node evals/run-claude.mjs --runs 3                     # repeat each prompt to see variance
```

It runs headless Claude Code with only the two Rush SR connectors and no built-in tools, then reads which tool was called first. It needs a logged-in Claude Code and network access. It does not model claude.ai's other tools (web search), so negatives here are easier than in a real chat.

## ChatGPT

`chatgpt-sheet.md` is the same prompts as a table to fill in by hand in developer mode. Regenerate it with `node evals/make-sheet.mjs > evals/chatgpt-sheet.md`.

## Changing a tool description

Tool names, descriptions and parameter docs are what the clients match on. After changing one, re-run both and compare against `results/`. A description that fixes one miss and creates another is not progress.
