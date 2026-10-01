// The ChatGPT plugin ZIPs must meet the dashboard's limits before anyone uploads them. Run: node --test chatgpt/package.test.mjs
// Limits come from https://developers.openai.com/apps-sdk/deploy/submission (checked 2026-10-01). That page says a package
// can declare several MCP servers but only one can be connected per plugin, so the two Rush SR servers ship as two plugins.
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const claudeManifest = JSON.parse(readFileSync(join(repo, 'plugin/.claude-plugin/plugin.json'), 'utf8'));
const claudeMcp = JSON.parse(readFileSync(join(repo, 'plugin/.mcp.json'), 'utf8'));

const PLUGINS = {
  maintenance: { name: 'rush-sr-maintenance', server: 'rush-sr-maintenance', host: 'maintenance' },
  laps: { name: 'rush-sr-lap-analyzer', server: 'rush-sr-laps', host: 'laps' },
};

const python = (code, ...args) => spawnSync('python3', ['-c', code, ...args], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
const zipFor = (spec) => join(repo, 'dist', `${spec.name}-chatgpt-${claudeManifest.version}.zip`);

before(() => {
  const build = spawnSync(process.execPath, [join(repo, 'chatgpt/build.mjs')], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stdout + build.stderr);
});

for (const [key, spec] of Object.entries(PLUGINS)) {
  describe(`ChatGPT plugin ${spec.name}`, () => {
    const names = () => python('import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zipFor(spec)).stdout.toString().split('\n').filter(Boolean);
    const read = (name) => python('import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))', zipFor(spec), name).stdout;
    const json = (name) => JSON.parse(read(name).toString('utf8'));

    test('the ZIP has the portable layout and leaves out everything Claude-only', () => {
      const files = names();
      for (const required of ['plugin.json', 'mcp.json', 'assets/icon.png', 'assets/logo.png', 'LICENSE', 'README.md']) {
        assert.ok(files.includes(required), `${required} is in the ZIP`);
      }
      assert.ok(!files.some((name) => name.startsWith('.claude-plugin') || name.startsWith('skills/') || name.includes('engine.mjs')), 'no Claude-only files');
      assert.ok(!files.some((name) => /\.(pem|key|env)$/.test(name)), 'no secrets');
    });

    test('plugin.json meets the dashboard limits', () => {
      const manifest = json('plugin.json');
      assert.match(manifest.$schema, /^https:\/\/agent-plugins\.org\/schemas\//);
      assert.equal(manifest.name, spec.name);
      assert.match(manifest.name, /^[a-z0-9-]{1,64}$/);
      assert.equal(manifest.version, claudeManifest.version, 'same version as the Claude plugin');
      assert.equal(manifest.license, 'MIT');
      const face = manifest.extensions['com.openai'].interface;
      assert.ok(face.displayName.length > 0 && face.displayName.length <= 30, 'displayName <= 30');
      assert.ok(face.shortDescription.length > 0 && face.shortDescription.length <= 30, `shortDescription <= 30 (${face.shortDescription.length})`);
      assert.ok(face.longDescription.length > 200 && face.longDescription.length <= 4000, `longDescription <= 4000 (${face.longDescription.length})`);
      assert.ok(face.developerName.length > 0 && face.developerName.length <= 80, 'developerName <= 80');
      assert.ok(face.category);
      assert.ok(Array.isArray(face.defaultPrompt) && face.defaultPrompt.length >= 2 && face.defaultPrompt.every((prompt) => typeof prompt === 'string' && prompt.length > 0));
      assert.match(face.brandColor, /^#[0-9A-Fa-f]{6}$/);
      for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
        assert.match(face[field], /^https:\/\//, `${field} is HTTPS`);
        assert.ok(face[field].length <= 1024, `${field} <= 1024`);
      }
      assert.ok(!JSON.stringify(manifest).toLowerCase().includes('claude'), 'no Claude references in the ChatGPT manifest');
    });

    test('icons are PNGs of at least 48x48 and under 5 MiB, and the manifest points at files in the ZIP', () => {
      const face = json('plugin.json').extensions['com.openai'].interface;
      const files = names();
      for (const field of ['composerIcon', 'logo']) {
        const path = face[field].replace(/^\.\//, '');
        assert.ok(files.includes(path), `${field} ${path} is in the ZIP`);
        const bytes = read(path);
        assert.ok(bytes.length < 5 * 1024 * 1024, `${path} under 5 MiB`);
        assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${path} is a PNG`);
        assert.ok(bytes.readUInt32BE(16) >= 48 && bytes.readUInt32BE(20) >= 48, `${path} is at least 48x48`);
      }
    });

    test('mcp.json connects exactly one server, the right one, over streamable-http', () => {
      const mcp = json('mcp.json');
      assert.match(mcp.$schema, /^https:\/\/agent-plugins\.org\/schemas\//);
      const servers = Object.entries(mcp.mcpServers);
      assert.equal(servers.length, 1, 'only one MCP server can be connected per plugin');
      const [id, server] = servers[0];
      assert.equal(id, spec.server);
      assert.equal(server.type, 'streamable-http');
      assert.equal(server.url, `https://${spec.host}.mcp.rush.sr/mcp`);
      assert.equal(server.url, claudeMcp.mcpServers[spec.server].url, 'same URL as the Claude plugin');
    });
  });
}
