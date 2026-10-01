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

const SERVER_TOOLS = {
  maintenance: ['diagnose_symptom', 'maintenance_schedule', 'lookup_procedure'],
  laps: ['analyze_session', 'compare_laps', 'find_time_loss', 'compare_sessions'],
};

test('every tool the copy names exists in the servers', () => {
  assert.equal(new Set(toolNames).size, 7);
  for (const key of ['laps', 'maintenance']) {
    for (const [name] of connectors[key].description.matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)) {
      if (Object.values(SERVER_TOOLS).flat().includes(name)) assert.ok(toolNames.includes(name), name);
    }
  }
  for (const [plugin, tools] of Object.entries(SERVER_TOOLS)) {
    for (const item of cases[plugin].positive) {
      for (const tool of item.expectedTools) assert.ok(tools.includes(tool), `${item.id} uses a ${plugin} tool: ${tool}`);
    }
  }
});

test('ChatGPT test cases: one set per plugin, five positive and three negative, attachments are committed examples', () => {
  for (const plugin of ['maintenance', 'laps']) {
    assert.equal(cases[plugin].positive.length, 5, `${plugin} positive`);
    assert.equal(cases[plugin].negative.length, 3, `${plugin} negative`);
    for (const item of [...cases[plugin].positive, ...cases[plugin].negative]) assert.ok(item.prompt.length > 0);
    for (const item of cases[plugin].positive) {
      for (const url of item.attachments) {
        assert.ok(url.startsWith(`${RAW}examples/`), url);
        assert.ok(existsSync(join(repo, url.slice(RAW.length))), `${url} exists in the repo`);
      }
    }
  }
  assert.ok(cases.laps.positive.every((item) => item.attachments.length > 0), 'every lap case attaches a file');
});

test('the examples are small enough to paste into a chat', () => {
  for (const file of ['examples/synthetic-session-a.csv', 'examples/synthetic-session-b.csv']) {
    const bytes = readFileSync(join(repo, file)).length;
    assert.ok(bytes < 64 * 1024, `${file} is ${bytes} bytes`);
  }
});

test('the numbers a reviewer is told to expect are what the engine prints', () => {
  const analyzeA = run('analyze', 'examples/synthetic-session-a.csv');
  for (const expected of ['Best lap: 4 in 45.793 s', 'Theoretical best: 45.547 s', 'Valid laps: 4', 'Lap 1: 57.242 s, excluded (out-lap)', 'Lap 6: 58.710 s, excluded (in-lap)']) assert.ok(analyzeA.includes(expected), expected);
  const analyzeB = run('analyze', 'examples/synthetic-session-b.csv');
  for (const expected of ['Best lap: 4 in 47.209 s', 'Theoretical best: 46.894 s', 'Valid laps: 4']) assert.ok(analyzeB.includes(expected), expected);
  assert.ok(run('compare', 'examples/synthetic-session-a.csv', '--lap-a', '2', '--lap-b', '3').includes('Delta A minus B: -1.282 s'));
  assert.ok(run('loss', 'examples/synthetic-session-a.csv', '--lap', '3').includes('995\u20131095 m: 1.002 s'));
  const sessions = run('compare-sessions', 'examples/synthetic-session-a.csv', 'examples/synthetic-session-b.csv');
  for (const expected of ['Delta A minus B: -1.416 s', 'best lap 4 in 45.793 s', 'best lap 4 in 47.209 s', 'Top speed: A 180.0 km/h, B 174.6 km/h']) assert.ok(sessions.includes(expected), expected);
});

test('the same numbers appear in the copy a reviewer reads', () => {
  const lapsCopy = connectors.laps.testInstructions;
  for (const expected of ['45.793', '45.547', '-1.282', '995-1095 m', '1.002', '-1.416', '180.0', '174.6']) assert.ok(lapsCopy.includes(expected), `connector test instructions mention ${expected}`);
  const expectedOf = (id) => cases.laps.positive.find((item) => item.id === id).expectedResult;
  for (const [id, numbers] of Object.entries({
    'l1-analyze': ['45.793', '45.547'],
    'l2-compare-laps': ['-1.282'],
    'l3-time-loss': ['995-1095 m', '1.002'],
    'l4-compare-sessions': ['-1.416', '45.793', '47.209', '180.0', '174.6'],
    'l5-analyze-b': ['47.209', '46.894'],
  })) {
    for (const number of numbers) assert.ok(expectedOf(id).includes(number), `${id} mentions ${number}`);
  }
});
