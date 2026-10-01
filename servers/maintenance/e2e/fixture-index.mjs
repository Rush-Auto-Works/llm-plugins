// Synthetic stand-in for https://manual.rush.sr/assistant/index.json.
// Same shape as the real file (version, embed_model, dims, chunks[]) with a handful of fake chunks.
// Nothing here is a real Rush SR spec.

const chunk = (route, title, heading, anchor, text) => ({
  id: `${route}#${anchor || 0}`,
  route,
  title,
  heading,
  anchor,
  text,
  vec: [],
});

export const HUGE_TEXT = `Fixture oversize section. ${'Repeat this sentence about the fixture gearbox. '.repeat(600)}`;

export const fixtureIndex = {
  version: 1,
  embed_model: 'bge-small-en-v1.5',
  dims: 384,
  chunks: [
    chunk(
      'whats-wrong',
      "What's Wrong?",
      'Engine will not start',
      'engine-will-not-start',
      'Engine will not start. Check the fixture kill switch first, then the fuel pump prime and the battery voltage.',
    ),
    chunk(
      'whats-wrong',
      "What's Wrong?",
      'Low oil pressure on the dash',
      'low-oil-pressure-on-the-dash',
      'Low oil pressure warning on the dash. Stop the engine and check the fixture oil level before restarting.',
    ),
    chunk(
      'maintenance/each-session',
      'Each Session',
      'Chain tension and lube',
      'chain-tension-and-lube',
      'Every session: check chain tension and lube the chain with fixture chain wax.',
    ),
    chunk(
      'maintenance/each-year',
      'Each Year',
      'Replace brake fluid',
      'replace-brake-fluid',
      'Every year: replace brake fluid with fresh fixture DOT 4 fluid.',
    ),
    chunk(
      'maintenance/long-term-maintenance-150hr+',
      'Long Term Maintenance',
      'Valve clearance check',
      'valve-clearance-check',
      'At 150 hours: check valve clearance and replace the fixture timing chain.',
    ),
    chunk(
      'maintenance/fluids',
      'Fluids',
      'Bleeding the brakes',
      'bleeding-the-brakes',
      'Bleeding the brakes, step 1: fill the fixture reservoir. Step 2: open the bleeder and pump the pedal. Step 3: close the bleeder before releasing.',
    ),
    chunk(
      'maintenance/each-session',
      'Each Session',
      'Torquing wheels',
      'torquing-wheels',
      'Torque the wheel nuts to the fixture value after every session.',
    ),
    chunk(
      'maintenance/engine-and-gearbox',
      'Engine and Gearbox',
      'Coolant drain',
      'coolant-drain',
      '<iframe src="https://evil.example/x"></iframe><script>alert(1)</script>Drain the fixture coolant from the lower hose.',
    ),
    chunk(
      'maintenance/engine-and-gearbox',
      'Engine and Gearbox',
      'Gearbox oil',
      'gearbox-oil',
      HUGE_TEXT,
    ),
    chunk(
      'service-bulletins',
      'Service Bulletins',
      'Fixture bulletin',
      'fixture-bulletin',
      'Service bulletin: inspect the fixture shifter pneumatic line for chafing.',
    ),
    // Hostile index text: markdown that would inject a link, a bold break, and a URL that would end the link early.
    chunk(
      'whats-wrong/x) y\n[z]#?\t\\q',
      '**Boom** <b>title</b> `tick`',
      'x](https://evil.example/pwn) [y',
      'a)b c\n[d]?',
      'hostilekeyword [Open this](https://evil.example/pwn) ![pixel](https://evil.example/i.png) `code` <b>bold</b> appears in this fixture section only.',
    ),
    // A lone surrogate is malformed UTF-16 that JSON can still carry. encodeURIComponent throws on it.
    chunk(
      'whats-wrong/lone\uD800surrogate',
      'Surrogate title',
      'Surrogate heading\uDC00',
      'anchor\uD800end',
      'surrogatekeyword appears in this fixture section only.',
    ),
    chunk(
      'tunables',
      'Tunables',
      'Shift cut time',
      'shift-cut-time',
      'Tunable shift cut time for the fixture paddle shift.',
    ),
  ],
};
