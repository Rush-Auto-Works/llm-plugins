#!/usr/bin/env node
// Writes evals/chatgpt-sheet.md: the golden prompts as a table to fill in by hand in ChatGPT developer mode.
//
//   node evals/make-sheet.mjs > evals/chatgpt-sheet.md
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const set = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'golden-prompts.json'), 'utf8'));
const attach = (prompt) => prompt
  .replaceAll('{{CSV_A}}', '[attach sample-session.csv]')
  .replaceAll('{{CSV_B}}', '[attach sample-session-b.csv]')
  .replaceAll('\n', ' ')
  .replaceAll('|', '/');

const rows = set.prompts.map((item) => `| ${item.id} | ${item.kind} | ${item.expect ?? 'none'} | ${attach(item.prompt)} |  |  |`);
console.log([
  '# Golden prompts: ChatGPT sheet',
  '',
  'Run in ChatGPT developer mode with both Rush SR plugins enabled. One new chat per row. For rows with an attachment, attach the named file from `evals/` instead of pasting it.',
  '',
  'Write the first Rush SR tool ChatGPT called (or "none") in the "called" column, and mark "ok" when it equals the expected tool or the call was acceptable. For "none" rows any Rush SR tool call is a miss.',
  '',
  '| id | kind | expected | prompt | called | ok |',
  '|---|---|---|---|---|---|',
  ...rows,
  '',
  'Score: direct and indirect rows measure recall (did the right tool run?). Negative rows measure precision (did a tool stay out of the way?).',
  '',
].join('\n'));
