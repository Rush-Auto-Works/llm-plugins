// Synthetic AiM-style CSV sessions. NOT real RaceStudio exports: the layout follows the single-source evidence in
// docs/plan-1b-laps.md. Ground truth (lap times, corner positions) comes from this generator, never from the Worker.

export const TRACK_M = 2000;
export const CORNERS = [
  { frac: 0.25, vmin: 80, wIn: 60, wOut: 50 },
  { frac: 0.55, vmin: 60, wIn: 50, wOut: 45 },
  { frac: 0.85, vmin: 100, wIn: 70, wOut: 60 },
];
const VMAX = 180; // km/h
const HZ = 20;

// One entry per lap: out-lap, four flying laps, in-lap. `dv` lowers a corner's minimum speed, `shift` brakes earlier (m).
export const LAPS = [
  { scale: 0.8 }, // 1 out-lap
  { scale: 1, dv: [2, 0, 0], shift: [0, 0, 0] }, // 2
  { scale: 1, dv: [0, 9, 0], shift: [0, 30, 0] }, // 3 loses time in corner 2 (braking early, slow apex)
  { scale: 1, dv: [0, 0, 0], shift: [0, 0, 0] }, // 4 best lap
  { scale: 1, dv: [0, 0, 7], shift: [0, 0, 0] }, // 5 loses time in corner 3
  { scale: 0.78 }, // 6 in-lap
];

function speedKmh(s, lap) {
  let v = VMAX;
  CORNERS.forEach((c, i) => {
    const centre = c.frac * TRACK_M;
    const w = s < centre ? c.wIn + (lap.shift?.[i] ?? 0) : c.wOut;
    const depth = VMAX - (c.vmin - (lap.dv?.[i] ?? 0));
    v -= depth * Math.exp(-(((s - centre) / w) ** 2));
  });
  return Math.max(35, v * lap.scale);
}

function brakeBar(s, lap) {
  const slope = (speedKmh(s + 1, lap) - speedKmh(s - 1, lap)) / 2; // km/h per metre
  return Math.min(60, Math.max(0, -slope * 30));
}

// Integrate one lap in 0.25 m steps. Returns cumulative time at each step.
function simulateLap(lap) {
  const ds = 0.25;
  const steps = Math.round(TRACK_M / ds);
  const t = new Float64Array(steps + 1);
  for (let i = 0; i < steps; i += 1) {
    const v = speedKmh((i + 0.5) * ds, lap) / 3.6;
    t[i + 1] = t[i] + ds / v;
  }
  return { ds, t };
}

const timeToDistance = (sim, tLap) => {
  // binary search for the step whose cumulative time brackets tLap
  let lo = 0;
  let hi = sim.t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sim.t[mid] <= tLap) lo = mid;
    else hi = mid;
  }
  const span = sim.t[hi] - sim.t[lo] || 1;
  return (lo + (tLap - sim.t[lo]) / span) * sim.ds;
};

export function buildSession(laps = LAPS) {
  const sims = laps.map(simulateLap);
  const lapTimes = sims.map((s) => s.t[s.t.length - 1]);
  const beacons = [];
  lapTimes.reduce((acc, t) => {
    beacons.push(acc + t);
    return acc + t;
  }, 0);
  const total = beacons[beacons.length - 1];
  const rows = [];
  let lapIndex = 0;
  let lapStart = 0;
  for (let k = 0; k * (1 / HZ) <= total; k += 1) {
    const time = k / HZ;
    while (lapIndex < laps.length - 1 && time >= beacons[lapIndex]) {
      lapStart = beacons[lapIndex];
      lapIndex += 1;
    }
    const s = Math.min(TRACK_M, timeToDistance(sims[lapIndex], time - lapStart));
    const v = speedKmh(s, laps[lapIndex]);
    rows.push({
      time,
      distance: lapIndex * TRACK_M + s,
      speed: v,
      brake: brakeBar(s, laps[lapIndex]),
      lat: 40.8 + (s / TRACK_M) * 0.01,
      lon: -79.9 - (s / TRACK_M) * 0.01,
      rpm: 4000 + v * 20,
      lapIndex,
    });
  }
  return { rows, beacons, lapTimes, total };
}

const fmtSegment = (sec) => {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(3).padStart(6, '0')}`;
};

/**
 * Render a session as AiM-style CSV text.
 * opts: quoteAll, crlf, bom, semicolonComma, noUnits, speedName, noDistance, speedBlankEcef, noSpeedAtAll,
 *       noMarkers, badMarkers, truncateLaps (keep only the first N laps)
 */
export function renderCsv(session, opts = {}) {
  const { quoteAll = true, crlf = true, bom = false, semicolonComma = false } = opts;
  const delim = semicolonComma ? ';' : ',';
  const num = (x, d) => (x === '' ? '' : semicolonComma ? x.toFixed(d).replace('.', ',') : x.toFixed(d));
  const q = (v) => (quoteAll ? `"${String(v).replaceAll('"', '""')}"` : String(v));
  const line = (cells) => cells.map(q).join(delim);

  let beacons = session.beacons.slice(0, opts.truncateLaps ?? session.beacons.length);
  // One non-numeric marker and one out-of-order marker, wrapped around the real ones.
  if (opts.badMarkers) beacons = [beacons[0], 'NaN', beacons[0] - 1, ...beacons.slice(1)];
  const segments = beacons.map((b, i) => fmtSegment(typeof b === 'number' ? b - (beacons[i - 1] ?? 0) : 0));
  const header = [
    ['Format', 'AiM CSV File'],
    ['Session', 'Synthetic Fixture Raceway'],
    ['Vehicle', 'Rush SR Fixture'],
    ['Racer', 'Fixture Driver'],
    ['Championship', 'Fixture Series'],
    ['Comment', ''],
    ['Date', '11/04/2025'],
    ['Time', '15:50:07'],
    ['Sample Rate', '20'],
    ['Duration', session.total.toFixed(1)],
    ['Segment', 'Session'],
  ];
  if (!opts.noMarkers) {
    header.push(['Beacon Markers', ...beacons.map((b) => (typeof b === 'number' ? num(b, 3) : b))]);
    header.push(['Segment Times', ...segments]);
  }

  const speedName = opts.speedName ?? 'GPS Speed';
  const cols = [['Time', 's', (r) => num(r.time, 3)]];
  if (!opts.noDistance) cols.push(['Distance', 'm', (r) => num(r.distance, 2)]);
  if (!opts.noSpeedAtAll) {
    cols.push([speedName, 'km/h', (r) => (opts.speedBlankEcef ? '' : num(r.speed, 4))]);
  }
  cols.push(['Front_Brake_p', 'bar', (r) => num(r.brake, 2)]);
  cols.push(['GPS Latitude', 'deg', (r) => num(r.lat, 8)]);
  cols.push(['GPS Longitude', 'deg', (r) => num(r.lon, 8)]);
  cols.push(['RPM', 'rpm', (r) => num(r.rpm, 0)]);
  if (opts.speedBlankEcef) {
    cols.push(['ECEF velocity_X', 'm/s', (r) => num(r.speed / 3.6, 4)]);
    cols.push(['ECEF velocity_Y', 'm/s', () => num(0, 4)]);
    cols.push(['ECEF velocity_Z', 'm/s', () => num(0, 4)]);
  }

  const lines = header.map(line);
  lines.push('');
  lines.push(line(cols.map((c) => c[0])));
  if (!opts.noUnits) lines.push(line(cols.map((c) => c[1])));
  lines.push('');
  const keep = opts.truncateLaps ? session.rows.filter((r) => r.lapIndex < opts.truncateLaps) : session.rows;
  for (const r of keep) lines.push(cols.map((c) => q(c[2](r))).join(delim));
  const eol = crlf ? '\r\n' : '\n';
  return (bom ? '﻿' : '') + lines.join(eol) + eol;
}
