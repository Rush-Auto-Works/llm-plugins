// The CSV parser must stay inside a small heap on the largest inputs the caps allow, because the Worker has 128 MB
// in total and the request body, the JSON copies and the analysis arrays share it. The parser is the one part that
// can only be tested alone: the E2E suite cannot see heap use inside workerd.
//
// Baseline before the typed-array rewrite, measured on this machine: the string-row parser survives a 64 MB old-space
// limit and crashes at 48 MB, with peak RSS growing about 207-226 MB on these two shapes. The limit below is 32 MB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEAP_MB = 32;
// Typed arrays live outside V8's old space, so the heap limit cannot see them. Peak RSS growth in the child can: the
// string-row parser grew 207-226 MB on these shapes, the typed-array parser grows 50-57 MB. This bound sits well
// between the two and catches buffers that grow several times too large.
const MAX_GROWTH_MB = 120;
// Typed-array bytes requested during the parse (growth by doubling included). The typed-array parser allocates about
// 32-34 MB on these shapes. A buffer that grows 16x per step allocates 70-140 MB without touching the pages, which
// peak RSS does not show.
const MAX_ALLOCATED_MB = 60;

function bundleCsv() {
  const out = join(mkdtempSync(join(tmpdir(), 'laps-mem-')), 'csv.mjs');
  execFileSync(join(root, 'node_modules/.bin/esbuild'), ['src/csv.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error'], { cwd: root });
  return out;
}

for (const shape of ['wide', 'narrow']) {
  test(`parsing the ${shape} worst case fits in a ${HEAP_MB} MB heap`, () => {
    const bundle = bundleCsv();
    let stdout;
    try {
      stdout = execFileSync(process.execPath, [`--max-old-space-size=${HEAP_MB}`, join(root, 'e2e/mem-child.mjs'), bundle, shape], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      });
    } catch (error) {
      assert.fail(`parser did not fit in ${HEAP_MB} MB: ${String(error.stderr || error.message).slice(0, 300)}`);
    }
    const result = JSON.parse(stdout.trim().split('\n').at(-1));
    assert.equal(result.columns, shape === 'wide' ? 250 : 8);
    assert.equal(result.rows, shape === 'wide' ? 5900 : 140000);
    assert.equal(result.first, shape === 'wide' ? 12 : 123.456);
    assert.ok(result.growthMB <= MAX_GROWTH_MB, `peak RSS grew ${result.growthMB} MB, limit ${MAX_GROWTH_MB} MB`);
    assert.ok(result.allocatedMB <= MAX_ALLOCATED_MB, `allocated ${result.allocatedMB} MB of typed arrays, limit ${MAX_ALLOCATED_MB} MB`);
  });
}
