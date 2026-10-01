#!/usr/bin/env node
// Builds one ZIP per ChatGPT plugin for the plugins dashboard: dist/<name>-chatgpt-<version>.zip
//
//   node chatgpt/build.mjs
//
// OpenAI allows a package to declare several MCP servers but only one connected per plugin, so the maintenance and lap
// servers are two plugins, each with its own folder under chatgpt/. The version comes from the Claude plugin manifest, so
// all the packages ship the same number. Needs python3 for the zip (its zipfile module is on every CI image and every Mac).
// The test in package.test.mjs checks the results.
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const PLUGINS = ['maintenance', 'laps'];
const { version } = JSON.parse(readFileSync(join(repo, 'plugin/.claude-plugin/plugin.json'), 'utf8'));

function build(folder) {
  const manifest = JSON.parse(readFileSync(join(here, folder, 'plugin.json'), 'utf8'));
  manifest.version = version;
  const stage = mkdtempSync(join(tmpdir(), `${manifest.name}-`));
  writeFileSync(join(stage, 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  copyFileSync(join(here, folder, 'mcp.json'), join(stage, 'mcp.json'));
  copyFileSync(join(here, folder, 'README.md'), join(stage, 'README.md'));
  copyFileSync(join(repo, 'plugin/LICENSE'), join(stage, 'LICENSE'));
  cpSync(join(here, 'assets'), join(stage, 'assets'), { recursive: true });

  mkdirSync(join(repo, 'dist'), { recursive: true });
  const out = join(repo, 'dist', `${manifest.name}-chatgpt-${version}.zip`);
  rmSync(out, { force: true });
  const zip = spawnSync('python3', ['-m', 'zipfile', '-c', out, 'plugin.json', 'mcp.json', 'README.md', 'LICENSE', 'assets'], { cwd: stage, encoding: 'utf8' });
  rmSync(stage, { recursive: true, force: true });
  if (zip.status !== 0) throw new Error(`zip failed for ${manifest.name}: ${zip.stderr || zip.stdout}`);
  return out;
}

try {
  for (const folder of PLUGINS) console.log(build(folder));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
