// One number per server: package.json, the version the server reports, and its MCP Registry file must agree, and the lap
// server's version is the Claude plugin's version (compare_sessions was the 0.2.0 change). Run: node --test listing/versions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(repo, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const SERVERS = { laps: 'laps', maintenance: 'maintenance' };

for (const server of Object.values(SERVERS)) {
  test(`${server}: package.json, lockfile, reported version and registry file agree`, () => {
    const { version } = json(`servers/${server}/package.json`);
    const lock = json(`servers/${server}/package-lock.json`);
    assert.equal(lock.version, version, 'package-lock.json top-level version');
    assert.equal(lock.packages[''].version, version, 'package-lock.json root package version');
    assert.equal(json(`registry/${server}.server.json`).version, version, 'registry file');
    for (const file of ['tools.ts', 'index.ts']) {
      const reported = [...read(`servers/${server}/src/${file}`).matchAll(/version: "(\d+\.\d+\.\d+)"/g)].map((match) => match[1]);
      assert.ok(reported.length > 0, `${file} reports a version`);
      assert.ok(reported.every((value) => value === version), `${file} reports ${reported.join(', ')}, package.json says ${version}`);
    }
  });
}

test('the lap server is at the Claude plugin version', () => {
  assert.equal(json('servers/laps/package.json').version, json('plugin/.claude-plugin/plugin.json').version);
});
