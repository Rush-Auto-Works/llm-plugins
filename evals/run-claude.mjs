#!/usr/bin/env node
// Scores which Rush SR tool Claude calls for each golden prompt (evals/golden-prompts.json).
//
//   node evals/run-claude.mjs [--only id,id] [--runs 1] [--concurrency 4] [--model claude-sonnet-5-5] [--web] [--out evals/results/x.md]
//
// It runs headless Claude Code with only the two Rush SR connectors and no built-in tools, so the question is
// "given these tools, does the model pick the right one, and stay out of the way when none applies?". It does not
// model claude.ai's other tools unless --web gives it web search as a competitor; without it, negatives are easier
// than in a real chat.
//
// Set CLAUDE_BIN to use a different claude executable. RUSH_MAINTENANCE_URL and RUSH_LAPS_URL point the run at another
// build (for example a local `wrangler dev`) before a description change is deployed. Needs a logged-in Claude Code
// and network access.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const set = JSON.parse(readFileSync(join(here, 'golden-prompts.json'), 'utf8'));
const csvA = readFileSync(join(here, 'sample-session.csv'), 'utf8');
const csvB = readFileSync(join(here, 'sample-session-b.csv'), 'utf8');

function fail(message) {
  console.error(`run-claude: ${message}`);
  process.exit(2);
}

// The value after --name. A flag with no value, or followed by another flag, is an error, not a default.
function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  if (at < 0) return fallback;
  const value = process.argv[at + 1];
  if (value === undefined || value.startsWith('--')) fail(`--${name} needs a value`);
  return value;
}

function positiveInteger(name, fallback) {
  const raw = option(name, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) fail(`--${name} must be a whole number of at least 1, got "${raw}"`);
  return value;
}

const model = option('model', 'claude-sonnet-5-5');
const runs = positiveInteger('runs', 1);
const concurrency = positiveInteger('concurrency', 4);
const only = option('only', '').split(',').filter(Boolean);
const web = process.argv.includes('--web');
const bin = process.env.CLAUDE_BIN ?? 'claude';
const stamp = new Date().toISOString().slice(0, 10);
const out = option('out', join(here, 'results', `${stamp}-claude${web ? '-web' : ''}.md`));

const scratch = mkdtempSync(join(tmpdir(), 'rush-golden-'));
const mcpConfig = join(scratch, 'mcp.json');
writeFileSync(mcpConfig, JSON.stringify({
  mcpServers: {
    'rush-sr-maintenance': { type: 'http', url: process.env.RUSH_MAINTENANCE_URL ?? 'https://maintenance.mcp.rush.sr/mcp' },
    'rush-sr-laps': { type: 'http', url: process.env.RUSH_LAPS_URL ?? 'https://laps.mcp.rush.sr/mcp' },
  },
}));

// Function replacements: a string replacement would interpret $& and $' inside the CSV.
const expand = (text) => text.replaceAll('{{CSV_A}}', () => csvA).replaceAll('{{CSV_B}}', () => csvB);

function runOne(item) {
  const args = [
    '-p', '--model', model, '--no-session-persistence', '--disable-slash-commands', '--strict-mcp-config',
    '--mcp-config', mcpConfig, '--tools', web ? 'WebSearch' : '', '--allowedTools', 'mcp__rush-sr-maintenance', 'mcp__rush-sr-laps', ...(web ? ['WebSearch'] : []),
    '--output-format', 'stream-json', '--verbose', '--max-turns', '3',
    '--settings', '{"disableAllHooks":true}', expand(item.prompt),
  ];
  const env = { ...process.env, CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1', DISABLE_TELEMETRY: '1', DISABLE_ERROR_REPORTING: '1' };
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(bin, args, { env, cwd: scratch, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    let settled = false;
    const finish = (code, failure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const { called, down } = parseRun(stdout);
      const error = failure ?? (code !== 0 ? `exit ${code}: ${stderr.slice(0, 200).replaceAll('\n', ' ')}` : down.length ? `connector not connected: ${down.join(', ')}` : '');
      resolve({ item, called, ms: Date.now() - started, code, error });
    };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(null, 'timed out after 180 s'); }, 180_000);
    child.on('error', (error) => finish(null, `could not start ${bin}: ${error.message}`));
    child.on('close', (code) => finish(code));
  });
}

// Every tool call in order, plus any of our connectors that did not connect. Our tools arrive as
// mcp__<server>__<tool>; keep the tool part. Anything else (WebSearch) keeps its name, so a competing tool called first
// shows up as a miss. "No tool called" only means something when both connectors were up.
function parseRun(stdout) {
  const called = [];
  const down = [];
  for (const line of stdout.split('\n')) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'system' && event.subtype === 'init') {
      for (const server of event.mcp_servers ?? []) if (server.status !== 'connected') down.push(server.name);
    }
    if (event.type !== 'assistant') continue;
    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use') called.push(block.name.startsWith('mcp__rush-sr-') ? block.name.split('__').pop() : block.name);
    }
  }
  return { called, down };
}

const ours = (called) => called.filter((name) => set.tools.includes(name));

function passes({ item, called, error }) {
  if (error) return false;
  if (!item.expect) return ours(called).length === 0;
  return called[0] === item.expect || (item.accept ?? []).includes(called[0]);
}

async function pool(items, size, work) {
  const results = [];
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const mine = next;
      next += 1;
      results[mine] = await work(items[mine]);
      process.stderr.write(`${mine + 1}/${items.length} ${items[mine].id}\n`);
    }
  };
  await Promise.all(Array.from({ length: size }, lane));
  return results;
}

const ratio = (hits, total) => (total ? `${hits}/${total} (${Math.round((100 * hits) / total)}%)` : 'n/a');

function summary(all) {
  const results = all.filter((row) => !row.error);
  const lines = ['| group | pass |', '|---|---|'];
  for (const kind of [...new Set(set.prompts.map((item) => item.kind))]) {
    const rows = results.filter((row) => row.item.kind === kind);
    lines.push(`| ${kind} | ${ratio(rows.filter(passes).length, rows.length)} |`);
  }
  lines.push('', '| tool | recall (right tool first when it should run) | precision (right when it ran first) |', '|---|---|---|');
  for (const tool of set.tools) {
    const wanted = results.filter((row) => row.item.expect === tool);
    const firstCalls = results.filter((row) => row.called[0] === tool);
    const good = firstCalls.filter((row) => row.item.expect === tool || (row.item.accept ?? []).includes(tool));
    lines.push(`| ${tool} | ${ratio(wanted.filter(passes).length, wanted.length)} | ${ratio(good.length, firstCalls.length)} |`);
  }
  if (all.length !== results.length) lines.push('', `**${all.length - results.length} of ${all.length} runs errored and are not counted above. Fix the cause and re-run.**`);
  return lines.join('\n');
}

function table(results) {
  const rows = results.map((row) => {
    const status = row.error ? `ERROR ${row.error}` : passes(row) ? 'pass' : 'FAIL';
    const first = row.item.prompt.split('\n')[0].slice(0, 70).replaceAll('|', '/');
    return `| ${row.item.id} | ${row.item.kind} | ${row.item.expect ?? 'none'} | ${row.called.join(', ') || 'none'} | ${status} | ${first} |`;
  });
  return ['| id | kind | expected | called | result | prompt |', '|---|---|---|---|---|---|', ...rows].join('\n');
}

const unknown = only.filter((id) => !set.prompts.some((item) => item.id === id));
if (unknown.length) fail(`unknown prompt id: ${unknown.join(', ')}`);
const chosen = set.prompts.filter((item) => !only.length || only.includes(item.id));
const queue = Array.from({ length: runs }, () => chosen).flat();
const results = await pool(queue, concurrency, runOne);
const report = [
  `# Golden prompts, Claude Code (${model}, ${stamp})`,
  '',
  `${queue.length} runs of ${chosen.length} prompts. Headless Claude Code with the two Rush SR connectors${web ? ' and WebSearch as a competing tool' : ' and no built-in tools'}.`,
  '',
  summary(results),
  '',
  table(results),
  '',
].join('\n');
writeFileSync(out, report);
writeFileSync(`${out.endsWith('.md') ? out.slice(0, -3) : out}.json`, `${JSON.stringify(results.map((row) => ({ id: row.item.id, kind: row.item.kind, expect: row.item.expect ?? null, called: row.called, pass: passes(row), error: row.error || null, ms: row.ms, code: row.code })), null, 2)}\n`);
console.log(report);
if (results.some((row) => row.error)) process.exitCode = 1;
