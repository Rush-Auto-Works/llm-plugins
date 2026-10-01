#!/usr/bin/env node
// Writes two small synthetic AiM RaceStudio CSV exports for trying the tools: node examples/make-examples.mjs
// Session A is a clean car; session B is the same track about 3% slower. Both come from the test fixtures, not from a real
// driver. They keep the four channels the tools use at 5 Hz, so each is small enough to paste into a chat (about 57 KB).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSession, renderCsv, LAPS } from '../servers/laps/e2e/fixtures.mjs';

const KEEP = ['Time', 'GPS Speed', 'Distance', 'Front_Brake_p'];
const EVERY = 4; // the fixtures sample at 20 Hz

const cells = (line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, ''));
const quote = (values) => values.map((value) => `"${value}"`).join(',');

function thin(csv) {
  const lines = csv.split(/\r?\n/);
  // The header block also has a Time key (the clock time), so the channel-name row is the one that lists Distance too.
  const namesAt = lines.findIndex((line) => cells(line)[0] === 'Time' && cells(line).includes('Distance'));
  const names = cells(lines[namesAt]);
  const picks = KEEP.map((name) => {
    const at = names.indexOf(name);
    if (at < 0) throw new Error(`fixture has no ${name} channel`);
    return at;
  });
  const pick = (line) => quote(picks.map((at) => cells(line)[at]));
  const header = lines.slice(0, namesAt);
  const data = lines.slice(namesAt + 3).filter((line) => line.length);
  return [...header, pick(lines[namesAt]), pick(lines[namesAt + 1]), '', ...data.filter((_, index) => index % EVERY === 0).map(pick), ''].join('\n');
}

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'synthetic-session-a.csv'), thin(renderCsv(buildSession())));
writeFileSync(join(here, 'synthetic-session-b.csv'), thin(renderCsv(buildSession(LAPS.map((lap) => ({ ...lap, scale: lap.scale * 0.97 }))))));
console.log('wrote synthetic-session-a.csv and synthetic-session-b.csv');
