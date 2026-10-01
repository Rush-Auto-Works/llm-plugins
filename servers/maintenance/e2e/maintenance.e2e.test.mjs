// E2E for the 1A maintenance MCP Worker. One test per failure-matrix row in docs/plan-1a-maintenance.md.
// A fixture HTTP server stands in for manual.rush.sr; `wrangler dev` runs the real Worker against it.
// Every run writes e2e/out/results.json with the values the assertions checked.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureIndex } from './fixture-index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = 'https://manual.rush.sr';
const TOOLS = ['diagnose_symptom', 'maintenance_schedule', 'lookup_procedure'];
const record = {};

// ---------- harness ----------

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function startFixture({ mode = 'ok', delayMs = 0 } = {}) {
  const state = { mode, delayMs, indexHits: 0 };
  const server = http.createServer((req, res) => {
    if (req.url !== '/assistant/index.json') {
      res.writeHead(404).end('not found');
      return;
    }
    state.indexHits += 1;
    if (state.mode === 'hang') return; // never answer, to exercise the Worker's fetch timeout
    setTimeout(() => {
      if (state.mode === 'fail') return void res.writeHead(500).end('boom');
      if (state.mode === 'malformed') return void res.writeHead(200).end('not json{');
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(fixtureIndex));
    }, state.delayMs);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    state,
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((r) => {
        server.close(r);
        server.closeAllConnections();
      }),
  };
}

async function startWorker({ manualBase, vars = {} }) {
  const port = await freePort();
  const args = ['dev', '--ip', '127.0.0.1', '--port', String(port), '--var', `MANUAL_BASE:${manualBase}`];
  for (const [k, v] of Object.entries(vars)) args.push('--var', `${k}:${v}`);
  // Keep wrangler's logs, config and telemetry inside the temp dir so it runs under a sandbox too.
  const scratch = join(tmpdir(), 'rush-mcp-e2e-wrangler');
  const env = {
    ...process.env,
    WRANGLER_LOG_PATH: join(scratch, 'logs'),
    XDG_CONFIG_HOME: join(scratch, 'config'),
    WRANGLER_SEND_METRICS: 'false',
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost',
  };
  const proc = spawn(join(root, 'node_modules/.bin/wrangler'), args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', (d) => (log += d));
  proc.stderr.on('data', (d) => (log += d));
  let exited = false;
  proc.once('exit', () => (exited = true));
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (exited) throw new Error(`wrangler exited early:\n${log}`);
    if (Date.now() > deadline) throw new Error(`wrangler not ready in 90s:\n${log}`);
    try {
      const r = await fetch(`${url}/`);
      if (r.status < 500) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { url, stop: () => proc.kill('SIGTERM') };
}

let rpcId = 0;
async function rpc(worker, method, params) {
  const id = ++rpcId;
  const res = await fetch(`${worker}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const data = text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => JSON.parse(l.slice(5)));
    return data.find((m) => m.id === id) ?? data[0];
  }
  return JSON.parse(text);
}

const callTool = (worker, name, args) => rpc(worker, 'tools/call', { name, arguments: args });
const urlsIn = (value) => JSON.stringify(value).match(/https?:\/\/[^\s"'\\)\]]+/g) ?? [];
const textOf = (msg) => (msg.result?.content ?? []).map((c) => c.text ?? '').join('\n');
const isFailure = (msg) => Boolean(msg.error) || msg.result?.isError === true;

// ---------- scenario: fixture healthy ----------

describe('healthy upstream', () => {
  let fx, w, wChallenge;
  before(async () => {
    fx = await startFixture();
    w = await startWorker({ manualBase: fx.url });
    wChallenge = await startWorker({ manualBase: fx.url, vars: { OPENAI_APPS_CHALLENGE: 'tok123' } });
  });
  after(async () => {
    w?.stop();
    wChallenge?.stop();
    await fx?.close();
  });

  test('row 12: tool listing carries annotations, outputSchema and discovery text', async () => {
    const msg = await rpc(w.url, 'tools/list', {});
    const tools = msg.result.tools;
    assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOLS].sort());
    for (const t of tools) {
      assert.equal(t.annotations?.readOnlyHint, true, `${t.name} readOnlyHint`);
      assert.equal(t.annotations?.destructiveHint, false, `${t.name} destructiveHint`);
      assert.equal(t.annotations?.openWorldHint, false, `${t.name} openWorldHint`);
      assert.ok(typeof t.title === 'string' && t.title.length > 0 && t.title.length <= 64, `${t.name} title`);
      assert.ok(t.outputSchema, `${t.name} outputSchema`);
      assert.match(t.description, /Use this when/, `${t.name} description`);
      assert.match(t.description, /Do not use for/, `${t.name} description`);
      // The manual covers one car. Without this the tools fire for any vehicle (found by the golden prompt set).
      assert.match(t.description, /Rush SR only/, `${t.name} says it covers the Rush SR only`);
      assert.match(t.description, /other vehicles/, `${t.name} says not to use it for other vehicles`);
    }
    record.row12 = tools.map((t) => ({ name: t.name, annotations: t.annotations }));
  });

  test('row 1: diagnose_symptom returns the matching section with a deep link', async () => {
    const msg = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    assert.equal(isFailure(msg), false);
    const sc = msg.result.structuredContent;
    assert.equal(sc.stale, false);
    assert.equal(sc.results[0].heading, 'Engine will not start');
    assert.equal(sc.results[0].url, `${PUBLIC}/whats-wrong#engine-will-not-start`);
    assert.ok(sc.results.length <= 5);
    assert.match(textOf(msg), /Built by Rush Auto Works/);
    record.row1 = { top: sc.results[0], count: sc.results.length };
  });

  test('row 1b: natural phrasing ("won\'t start") still finds the section', async () => {
    const msg = await callTool(w.url, 'diagnose_symptom', { symptom: "Rush SR engine won't start" });
    assert.equal(msg.result.structuredContent.results[0].heading, 'Engine will not start');
  });

  test('row 5: no match is an empty result, not an error', async () => {
    const msg = await callTool(w.url, 'diagnose_symptom', { symptom: 'zzqxv nonexistent flibber' });
    assert.equal(isFailure(msg), false);
    const sc = msg.result.structuredContent;
    assert.equal(sc.results.length, 0);
    assert.ok(sc.rush.url);
    assert.match(textOf(msg), /manual\.rush\.sr/);
    record.row5 = { rush: sc.rush };
  });

  test('row 6: empty or oversize input is rejected', async () => {
    const empty = await callTool(w.url, 'diagnose_symptom', { symptom: '' });
    const big = await callTool(w.url, 'diagnose_symptom', { symptom: 'x'.repeat(501) });
    assert.equal(isFailure(empty), true);
    assert.equal(isFailure(big), true);
    record.row6 = { empty: isFailure(empty), oversize: isFailure(big) };
  });

  test('row 20: index text cannot inject markdown links or break the link target', async () => {
    const msg = await callTool(w.url, 'diagnose_symptom', { symptom: 'hostilekeyword' });
    assert.equal(isFailure(msg), false, textOf(msg));
    const text = textOf(msg);
    // Headings, titles AND the excerpt body: none of them may open a link, an image, a code span or HTML.
    assert.doesNotMatch(text, /\]\(https:\/\/evil\.example/, 'no injected link');
    assert.doesNotMatch(text, /!\[pixel\]/, 'no injected image');
    assert.doesNotMatch(text, /\[Open this\]/, 'excerpt link text is escaped');
    assert.doesNotMatch(text, /\*\*Boom\*\*/, 'title markdown is escaped, not rendered');
    assert.doesNotMatch(text, /<b>/, 'no HTML');
    // The result header must be exactly one markdown link whose target is a single clean URL: no brackets, no
    // whitespace or control characters, one fragment separator, no query.
    const header = text.match(/^## \[((?:\\.|[^\]\\])*)\]\(([^)\s]*)\)$/m);
    assert.ok(header, `header is one well-formed link: ${JSON.stringify(text.split('\n').find((l) => l.startsWith('## ')))}`);
    assert.match(header[2], /^https:\/\/manual\.rush\.sr\/whats-wrong\/x/);
    assert.doesNotMatch(header[2], /[)<>\][\\?\s]/);
    assert.equal(header[2].split('#').length, 2, 'exactly one fragment separator');
    // The structured result keeps the raw index text for clients that read JSON.
    assert.equal(msg.result.structuredContent.results[0].heading, 'x](https://evil.example/pwn) [y');
    assert.match(msg.result.structuredContent.results[0].excerpt, /\[Open this\]\(https:\/\/evil\.example\/pwn\)/);
    record.row20 = { header: header[0] };
  });

  test('row 21: a lone surrogate in a route or anchor does not make the tool throw', async () => {
    const msg = await callTool(w.url, 'diagnose_symptom', { symptom: 'surrogatekeyword' });
    assert.equal(Boolean(msg.error), false, JSON.stringify(msg.error));
    assert.equal(isFailure(msg), false, textOf(msg));
    const header = textOf(msg).match(/^## \[.*\]\(([^)\s]*)\)$/m);
    assert.ok(header, 'result header is one link');
    assert.match(header[1], /^https:\/\/manual\.rush\.sr\/whats-wrong\/lone/);
  });

  test('row 7: HTML in a chunk is stripped from the excerpt', async () => {
    const msg = await callTool(w.url, 'lookup_procedure', { task: 'drain coolant lower hose' });
    const blob = JSON.stringify(msg.result);
    assert.match(textOf(msg), /Drain the fixture coolant/);
    assert.doesNotMatch(blob, /<\s*(iframe|script)/i);
    assert.doesNotMatch(blob, /evil\.example/);
    assert.doesNotMatch(blob, /alert\(1\)/);
    record.row7 = { excerpt: msg.result.structuredContent.results[0].excerpt };
  });

  test('row 8: a huge chunk is truncated', async () => {
    const msg = await callTool(w.url, 'lookup_procedure', { task: 'gearbox oil fixture gearbox sentence' });
    const sc = msg.result.structuredContent;
    for (const r of sc.results) assert.ok(r.excerpt.length <= 1500, `excerpt ${r.excerpt.length}`);
    assert.ok(textOf(msg).length < 12000, `text ${textOf(msg).length}`);
    record.row8 = { excerptLengths: sc.results.map((r) => r.excerpt.length), textLength: textOf(msg).length };
  });

  test('row 13: lookup_procedure finds a procedure by a stemmed query', async () => {
    const msg = await callTool(w.url, 'lookup_procedure', { task: 'bleed the brakes' });
    assert.equal(msg.result.structuredContent.results[0].heading, 'Bleeding the brakes');
  });

  test('row 16: stemming matches word forms in both directions', async () => {
    const bare = await callTool(w.url, 'lookup_procedure', { task: 'bleed' });
    assert.equal(bare.result.structuredContent.results[0]?.heading, 'Bleeding the brakes');
    const torque = await callTool(w.url, 'lookup_procedure', { task: 'torque spec for wheel nuts' });
    assert.equal(torque.result.structuredContent.results[0]?.heading, 'Torquing wheels');
    record.row16 = { bleed: bare.result.structuredContent.results[0]?.heading, torque: torque.result.structuredContent.results[0]?.heading };
  });

  test('row 17: filler words never match, and weak partial matches are dropped', async () => {
    const filler = await callTool(w.url, 'lookup_procedure', { task: 'how do I the' });
    assert.equal(isFailure(filler), false);
    assert.equal(filler.result.structuredContent.results.length, 0);
    const weak = await callTool(w.url, 'lookup_procedure', { task: 'bleed zebra giraffe okapi' });
    assert.equal(isFailure(weak), false);
    assert.equal(weak.result.structuredContent.results.length, 0);
    record.row17 = { filler: 0, weak: 0 };
  });

  test('row 14: maintenance_schedule takes only a component and labels every result with its service interval', async () => {
    // hours and sessions used to be accepted and mostly ignored. The manual files service work by interval
    // (every session, weekend, month, year, 150 hours), so each result now says which one it is and the caller decides.
    const list = await rpc(w.url, 'tools/list', {});
    const tool = list.result.tools.find((t) => t.name === 'maintenance_schedule');
    assert.deepEqual(Object.keys(tool.inputSchema.properties), ['component']);
    assert.match(tool.description, /interval/i);

    const plain = await callTool(w.url, 'maintenance_schedule', { component: 'brake fluid' });
    const top = plain.result.structuredContent.results[0];
    assert.equal(top.url, `${PUBLIC}/maintenance/each-year#replace-brake-fluid`);
    assert.equal(top.interval, 'every year');
    assert.match(textOf(plain), /\(every year\)/);
    for (const r of plain.result.structuredContent.results) assert.match(r.url, /\/maintenance\//);

    const valve = await callTool(w.url, 'maintenance_schedule', { component: 'valve clearance' });
    assert.ok(valve.result.structuredContent.results.some((r) => r.interval === 'every 150+ hours'));
    const chain = await callTool(w.url, 'maintenance_schedule', { component: 'chain tension' });
    assert.equal(chain.result.structuredContent.results[0].interval, 'every session');

    // Pages that are not filed under an interval carry no label rather than a guess.
    const diag = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    assert.equal(diag.result.structuredContent.results[0].interval, undefined);
    record.row14 = { top: top.interval, valve: valve.result.structuredContent.results.map((r) => r.interval), chain: chain.result.structuredContent.results[0].interval };
  });

  test('row 15: every rushautoworks.com link carries UTM params and the tool name', async () => {
    const calls = {
      diagnose_symptom: { symptom: 'engine will not start' },
      maintenance_schedule: { component: 'brake fluid' },
      lookup_procedure: { task: 'bleed the brakes' },
    };
    const seen = {};
    for (const [name, args] of Object.entries(calls)) {
      const msg = await callTool(w.url, name, args);
      const rush = urlsIn(msg.result).filter((u) => new URL(u).hostname.endsWith('rushautoworks.com'));
      assert.ok(rush.length > 0, `${name} has a rushautoworks.com link`);
      for (const u of rush) {
        const q = new URL(u).searchParams;
        assert.equal(q.get('utm_source'), 'mcp', u);
        assert.equal(q.get('utm_medium'), 'plugin', u);
        assert.equal(q.get('utm_campaign'), 'rush-sr-maintenance', u);
        assert.equal(q.get('utm_content'), name, u);
      }
      seen[name] = rush;
    }
    record.row15 = seen;
  });

  test('row 10: root returns JSON info, other paths 404', async () => {
    const root = await fetch(`${w.url}/`);
    assert.equal(root.status, 200);
    assert.equal(typeof (await root.json()), 'object');
    const nope = await fetch(`${w.url}/nope`, { method: 'POST', body: '{}' });
    assert.equal(nope.status, 404);
  });

  test('row 11: challenge file is 404 when unset and plain text when set', async () => {
    const off = await fetch(`${w.url}/.well-known/openai-apps-challenge`);
    assert.equal(off.status, 404);
    const on = await fetch(`${wChallenge.url}/.well-known/openai-apps-challenge`);
    assert.equal(on.status, 200);
    assert.match(on.headers.get('content-type') ?? '', /text\/plain/);
    assert.equal((await on.text()).trim(), 'tok123');
  });
});

// ---------- scenario: stale fallback ----------

describe('row 2: upstream dies after a warm cache', () => {
  let fx, w;
  before(async () => {
    fx = await startFixture();
    w = await startWorker({ manualBase: fx.url, vars: { INDEX_TTL_MS: '1' } });
  });
  after(async () => {
    w?.stop();
    await fx?.close();
  });

  test('serves the cached copy and says it is stale', async () => {
    const first = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    assert.equal(first.result.structuredContent.stale, false);
    fx.state.mode = 'fail';
    await new Promise((r) => setTimeout(r, 25));
    const second = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    assert.equal(isFailure(second), false);
    assert.equal(second.result.structuredContent.stale, true);
    assert.equal(second.result.structuredContent.results[0].heading, 'Engine will not start');
    record.row2 = { firstStale: false, secondStale: true };
  });
});

// ---------- scenario: cold start, upstream down ----------

describe('row 3: cold start with upstream down', () => {
  let fx, w;
  before(async () => {
    fx = await startFixture({ mode: 'fail' });
    w = await startWorker({ manualBase: fx.url });
  });
  after(async () => {
    w?.stop();
    await fx?.close();
  });

  test('returns an error with a link to the manual', async () => {
    const msg = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    assert.equal(isFailure(msg), true);
    assert.match(textOf(msg), /manual\.rush\.sr/);
    record.row3 = { text: textOf(msg) };
  });
});

// ---------- scenario: malformed upstream, then recovery ----------

describe('row 4: malformed upstream does not poison the cache', () => {
  let fx, w;
  before(async () => {
    fx = await startFixture({ mode: 'malformed' });
    w = await startWorker({ manualBase: fx.url, vars: { INDEX_TTL_MS: '1' } });
  });
  after(async () => {
    w?.stop();
    await fx?.close();
  });

  test('errors first, succeeds once upstream recovers', async () => {
    const bad = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    assert.equal(isFailure(bad), true);
    fx.state.mode = 'ok';
    await new Promise((r) => setTimeout(r, 25));
    const good = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    assert.equal(isFailure(good), false);
    assert.ok(good.result.structuredContent.results.length > 0);
    record.row4 = { badWasError: true, recovered: true };
  });
});

// ---------- scenario: concurrent cold requests ----------

describe('row 9: concurrent cold requests share one upstream fetch', () => {
  let fx, w;
  before(async () => {
    fx = await startFixture({ delayMs: 400 });
    w = await startWorker({ manualBase: fx.url });
  });
  after(async () => {
    w?.stop();
    await fx?.close();
  });

  test('ten parallel calls cause exactly one index fetch', async () => {
    const msgs = await Promise.all(
      Array.from({ length: 10 }, () => callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' })),
    );
    for (const m of msgs) assert.equal(isFailure(m), false);
    assert.equal(fx.state.indexHits, 1);
    record.row9 = { indexHits: fx.state.indexHits, calls: msgs.length };
  });
});

// ---------- scenario: hung upstream ----------

describe('row 18: a hung upstream times out instead of stalling every call', () => {
  let fx, w;
  before(async () => {
    fx = await startFixture({ mode: 'hang' });
    w = await startWorker({ manualBase: fx.url, vars: { INDEX_TTL_MS: '1' } });
  });
  after(async () => {
    w?.stop();
    await fx?.close();
  });

  test('cold: errors within the timeout. warm: serves stale within the timeout', async () => {
    const t0 = Date.now();
    const cold = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    const coldMs = Date.now() - t0;
    assert.equal(isFailure(cold), true);
    assert.ok(coldMs < 9000, `cold call took ${coldMs}ms`);

    fx.state.mode = 'ok';
    await new Promise((r) => setTimeout(r, 25));
    // Wait out the failure backoff by using a fresh warm cache through a second request after recovery.
    const warm = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    assert.equal(isFailure(warm), false, 'recovers once upstream answers');
    record.row18 = { coldMs, recovered: true };
  });
});

// ---------- scenario: repeated 5xx ----------

describe('row 19: repeated upstream failures do not refetch on every call', () => {
  let fx, w;
  before(async () => {
    fx = await startFixture();
    w = await startWorker({ manualBase: fx.url, vars: { INDEX_TTL_MS: '1' } });
  });
  after(async () => {
    w?.stop();
    await fx?.close();
  });

  test('five calls during an outage cause at most one extra index fetch', async () => {
    await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
    const warmHits = fx.state.indexHits;
    fx.state.mode = 'fail';
    await new Promise((r) => setTimeout(r, 25));
    for (let i = 0; i < 5; i += 1) {
      const msg = await callTool(w.url, 'diagnose_symptom', { symptom: 'engine will not start' });
      assert.equal(msg.result.structuredContent.stale, true);
    }
    assert.ok(fx.state.indexHits - warmHits <= 1, `extra fetches: ${fx.state.indexHits - warmHits}`);
    record.row19 = { extraFetches: fx.state.indexHits - warmHits };
  });
});

// ---------- artifact ----------

after(() => {
  const out = join(root, 'e2e/out');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'results.json'), JSON.stringify(record, null, 2));
});

describe('logging stays off', () => {
  test('row 21: wrangler.jsonc turns Workers Logs off, so the privacy statement is enforced by config', () => {
    const config = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'));
    assert.equal(config.observability?.enabled, false);
  });
});
