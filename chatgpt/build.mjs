#!/usr/bin/env node
// Builds dist/rush-sr-chatgpt-<version>.zip for the ChatGPT plugins dashboard from this folder.
//
//   node chatgpt/build.mjs
//
// The version comes from the Claude plugin manifest, so the two plugins always ship the same number. Needs python3 for the
// zip (its zipfile module is on every CI image and every Mac). The test in package.test.mjs checks the result.
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const { version } = JSON.parse(readFileSync(join(repo, 'plugin/.claude-plugin/plugin.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(here, 'plugin.json'), 'utf8'));
manifest.version = version;

const stage = mkdtempSync(join(tmpdir(), 'rush-sr-chatgpt-'));
writeFileSync(join(stage, 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(join(here, 'mcp.json'), join(stage, 'mcp.json'));
copyFileSync(join(here, 'README.md'), join(stage, 'README.md'));
copyFileSync(join(repo, 'plugin/LICENSE'), join(stage, 'LICENSE'));
cpSync(join(here, 'assets'), join(stage, 'assets'), { recursive: true });

mkdirSync(join(repo, 'dist'), { recursive: true });
const out = join(repo, 'dist', `rush-sr-chatgpt-${version}.zip`);
rmSync(out, { force: true });
const zip = spawnSync('python3', ['-m', 'zipfile', '-c', out, 'plugin.json', 'mcp.json', 'README.md', 'LICENSE', 'assets'], { cwd: stage, encoding: 'utf8' });
rmSync(stage, { recursive: true, force: true });
if (zip.status !== 0) {
  console.error(`zip failed: ${zip.stderr || zip.stdout}`);
  process.exit(1);
}
console.log(out);
