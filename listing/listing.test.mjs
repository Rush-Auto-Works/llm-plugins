// Keeps the submission copy honest: field limits, tool names, example files, and the numbers a reviewer is told to expect.
// Run: node --test listing/listing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(repo, path), 'utf8');
const connectors = JSON.parse(read('listing/claude-connectors.json'));
const cases = JSON.parse(read('listing/chatgpt-test-cases.json'));
const engine = join(repo, 'plugin/skills/rush-sr-laps/scripts/engine.mjs');
const RAW = 'https://raw.githubusercontent.com/Rush-Auto-Works/llm-plugins/main/';

const toolNames = ['maintenance', 'laps'].flatMap((server) => {
  const source = read(`servers/${server}/src/tools.ts`);
  return [...source.matchAll(/(?:registerTool\(|const name = )"([a-z_]+)"/g)].map((match) => match[1]);
});

const run = (...args) => {
  const result = spawnSync(process.execPath, [engine, ...args.map((arg) => (arg.startsWith('examples/') ? join(repo, arg) : arg))], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
};

for (const key of ['laps', 'maintenance']) {
  test(`Claude connector copy for ${key} fits the portal limits`, () => {
    const entry = connectors[key];
    assert.ok(entry.name.length > 0 && entry.name.length <= 100, 'name <= 100');
    assert.ok(entry.oneLiner.length > 0 && entry.oneLiner.length <= 200, `one-liner <= 200 (${entry.oneLiner.length})`);
    assert.ok(entry.description.length > 0 && entry.description.length <= 2000, `description <= 2000 (${entry.description.length})`);
    assert.match(entry.slug, /^[a-z0-9-]+$/);
    for (const url of [entry.serverUrl, entry.documentationUrl, connectors.common.privacyPolicyUrl, connectors.common.website]) assert.match(url, /^https:\/\//);
    assert.match(entry.serverUrl, /^https:\/\/[a-z]+\.mcp\.rush\.sr\/mcp$/);
    assert.ok(entry.testInstructions.includes(entry.serverUrl), 'test instructions name the server URL');
    assert.equal(connectors.common.authentication, 'none');
  });
}

test('every tool the copy names exists in the servers', () => {
  assert.equal(new Set(toolNames).size, 7);
  for (const key of ['laps', 'maintenance']) {
    for (const [name] of connectors[key].description.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)) {
      if (['analyze_session', 'compare_laps', 'find_time_loss', 'compare_sessions', 'diagnose_symptom', 'maintenance_schedule', 'lookup_procedure'].includes(name)) assert.ok(toolNames.includes(name), name);
    }
  }
  for (const item of cases.positive) for (const tool of item.expectedTools) assert.ok(toolNames.includes(tool), `${item.id} names a real tool: ${tool}`);
});

test('ChatGPT test cases: five positive, three negative, attachments are committed examples', () => {
  assert.equal(cases.positive.length, 5);
  assert.equal(cases.negative.length, 3);
  for (const item of [...cases.positive, ...cases.negative]) assert.ok(item.prompt.length > 0);
  for (const item of cases.positive) {
    for (const url of item.attachments) {
      assert.ok(url.startsWith(`${RAW}examples/`), url);
      assert.ok(existsSync(join(repo, url.slice(RAW.length))), `${url} exists in the repo`);
    }
  }
});

test('the numbers a reviewer is told to expect are what the engine prints', () => {
  const analyze = run('analyze', 'examples/synthetic-session-a.csv');
  for (const expected of ['Best lap: 4 in 45.793 s', 'Theoretical best: 45.547 s', 'Valid laps: 4', 'Lap 1: 57.242 s, excluded (out-lap)', 'Lap 6: 58.710 s, excluded (in-lap)']) assert.ok(analyze.includes(expected), expected);
  assert.ok(run('compare', 'examples/synthetic-session-a.csv', '--lap-a', '2', '--lap-b', '3').includes('Delta A minus B: -1.282 s'));
  assert.ok(run('loss', 'examples/synthetic-session-a.csv', '--lap', '3').includes('995–1095 m: 1.002 s'));
  const sessions = run('compare-sessions', 'examples/synthetic-session-a.csv', 'examples/synthetic-session-b.csv');
  for (const expected of ['Delta A minus B: -1.416 s', 'best lap 4 in 45.793 s', 'best lap 4 in 47.209 s', 'Top speed: A 180.0 km/h, B 174.6 km/h']) assert.ok(sessions.includes(expected), expected);
});

test('the same numbers appear in the copy a reviewer reads', () => {
  const lapsCopy = connectors.laps.testInstructions;
  for (const expected of ['45.793', '45.547', '-1.282', '995-1095 m', '1.002', '-1.416', '180.0', '174.6']) assert.ok(lapsCopy.includes(expected), `connector test instructions mention ${expected}`);
  const analyze = cases.positive.find((item) => item.id === 'p4-analyze').expectedResult;
  for (const expected of ['45.793', '45.547']) assert.ok(analyze.includes(expected), `p4 mentions ${expected}`);
  const sessions = cases.positive.find((item) => item.id === 'p5-compare-sessions').expectedResult;
  for (const expected of ['-1.416', '45.793', '47.209', '180.0', '174.6']) assert.ok(sessions.includes(expected), `p5 mentions ${expected}`);
});
