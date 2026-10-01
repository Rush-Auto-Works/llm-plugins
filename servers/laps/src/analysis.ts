import type { ParsedCsv } from "./csv";
import { resolveChannels, type Channels } from "./channels";
import { alignLaps, type AlignedLap } from "./align";
import { resolveLaps } from "./laps";
import { label } from "./clean";

interface SessionData {
  csv: ParsedCsv;
  channels: Channels;
  laps: AlignedLap[];
  notes: string[];
}

export function prepare(csv: ParsedCsv): SessionData {
  const channels = resolveChannels(csv);
  const notes = [...channels.notes];
  const laps = alignLaps(resolveLaps(csv, notes), channels, notes);
  return { csv, channels, laps, notes };
}

const validLaps = (data: SessionData) => data.laps.filter((lap) => !lap.excluded);
const bestLap = (data: SessionData) => validLaps(data).reduce((best, lap) => lap.time_s < best.time_s ? lap : best);

function stats(times: number[]) {
  const mean_s = times.reduce((sum, time) => sum + time, 0) / times.length;
  const variance = times.length > 1 ? times.reduce((sum, time) => sum + (time - mean_s) ** 2, 0) / (times.length - 1) : 0;
  return { valid_laps: times.length, mean_s, stdev_s: Math.sqrt(variance), spread_s: Math.max(...times) - Math.min(...times) };
}

function sectorTime(lap: AlignedLap, sector: number): number {
  return lap.boundary_s[sector + 1] - lap.boundary_s[sector];
}

function sessionInfo({ csv }: SessionData) {
  return {
    name: label(csv.header.get("Session")?.[0] ?? csv.header.get("Venue")?.[0] ?? "AiM session"),
    vehicle: label(csv.header.get("Vehicle")?.[0] ?? "Unknown vehicle"),
    racer: label(csv.header.get("Racer")?.[0] ?? ""),
    date: label(csv.header.get("Date")?.[0] ?? ""),
  };
}

export function analyzeSession(data: SessionData) {
  const valid = validLaps(data);
  const best = bestLap(data);
  const theoretical_best_s = Array.from({ length: 20 }, (_, sector) => Math.min(...valid.map((lap) => sectorTime(lap, sector))))
    .reduce((sum, time) => sum + time, 0);
  const { channels } = data;
  return {
    session: sessionInfo(data),
    laps: data.laps.map(({ lap, time_s, excluded, reason }) => ({ lap, time_s, excluded, ...(reason ? { reason } : {}) })),
    best_lap: { lap: best.lap, time_s: best.time_s },
    theoretical_best_s,
    consistency: stats(valid.map((lap) => lap.time_s)),
    channels: { speed: label(channels.speed.name), distance: label(channels.distance?.name ?? "integrated speed"), ...(channels.brake ? { brake: label(channels.brake.name) } : {}) },
    notes: data.notes,
  };
}

function selectedPair(data: SessionData, a: number, b: number): [AlignedLap, AlignedLap] {
  if (data.laps.length < 2) throw new Error("Compare laps needs at least 2 laps. Export a session with two laps from AiM RaceStudio.");
  const first = data.laps.find((lap) => lap.lap === a);
  const second = data.laps.find((lap) => lap.lap === b);
  if (!first || !second || a === b) {
    throw new Error(`Choose two different valid lap numbers: ${data.laps.map((lap) => lap.lap).join(", ")}.`);
  }
  return [first, second];
}

interface Zone {
  onset_m: number;
  entry_speed_kmh: number;
}

const MAX_FEATURES = 50;
interface FeatureSet<T> { items: T[]; total: number }
interface Ranked<T> { value: T; score: number }

function retainStrongest<T>(items: Ranked<T>[], value: T, score: number): void {
  if (items.length < MAX_FEATURES) { items.push({ value, score }); return; }
  let weakest = 0;
  for (let i = 1; i < items.length; i += 1) {
    if (items[i].score < items[weakest].score) weakest = i;
  }
  if (score > items[weakest].score) items[weakest] = { value, score };
}

function firstFiniteSpeed(lap: AlignedLap, channels: Channels): number {
  for (const sample of lap.samples) {
    const value = channels.speed.values[sample];
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function brakeFlags(lap: AlignedLap, channels: Channels): boolean[] {
  if (channels.brake) {
    let max = 0;
    for (const i of lap.samples) {
      const value = channels.brake.values[i];
      if (Number.isFinite(value)) max = Math.max(max, value);
    }
    return lap.samples.map((i) => channels.brake!.values[i] > max * 0.1);
  }
  if (channels.accel) {
    const inG = channels.accel.unit?.trim().toLowerCase() === "g";
    const threshold = inG ? -0.3 : -0.3 * 9.80665;
    return lap.samples.map((i) => channels.accel!.values[i] < threshold);
  }
  return lap.samples.map((i, k) => {
    if (!k) return false;
    const previous = lap.samples[k - 1];
    const dt = channels.time.values[i] - channels.time.values[previous];
    return dt > 0 && (channels.speed.values[i] - channels.speed.values[previous]) / dt < -0.3 * 9.80665;
  });
}

function brakingZones(lap: AlignedLap, channels: Channels): FeatureSet<Zone> {
  const flags = brakeFlags(lap, channels);
  const ranked: Ranked<Zone>[] = [];
  const fallbackSpeed = firstFiniteSpeed(lap, channels);
  let total = 0;
  let start = -1;
  let last = -1;
  let peak = 0;
  let minimum = Infinity;
  const finish = () => {
    if (start < 0 || channels.time.values[lap.samples[last]] - channels.time.values[lap.samples[start]] < 0.3) return;
    const rawEntry = channels.speed.values[lap.samples[start]];
    const entry = Number.isFinite(rawEntry) ? rawEntry : fallbackSpeed;
    const score = channels.brake ? peak : Math.max(0, entry - minimum);
    retainStrongest(ranked, { onset_m: lap.distance[start], entry_speed_kmh: entry * 3.6 }, score);
    total += 1;
  };
  for (let k = 0; k < flags.length; k += 1) {
    if (!flags[k]) continue;
    const gap = last < 0 ? Infinity : channels.time.values[lap.samples[k]] - channels.time.values[lap.samples[last]];
    if (start >= 0 && gap >= 0.3) finish();
    if (start < 0 || gap >= 0.3) { start = k; peak = 0; minimum = Infinity; }
    if (channels.brake) peak = Math.max(peak, channels.brake.values[lap.samples[k]]);
    const speed = channels.speed.values[lap.samples[k]];
    if (Number.isFinite(speed)) minimum = Math.min(minimum, speed);
    last = k;
  }
  finish();
  return { items: ranked.map(({ value }) => value).sort((a, b) => a.onset_m - b.onset_m), total };
}

function matchedIndices(first: number[], second: number[]): Array<[number, number]> {
  const aShorter = first.length <= second.length;
  const short = aShorter ? first : second;
  const long = aShorter ? second : first;
  const pairs: Array<[number, number]> = [];
  let j = 0;
  for (let i = 0; i < short.length; i += 1) {
    const lastChoice = long.length - (short.length - i);
    while (j < lastChoice && Math.abs(long[j + 1] - short[i]) < Math.abs(long[j] - short[i])) j += 1;
    pairs.push(aShorter ? [i, j] : [j, i]);
    j += 1;
  }
  return pairs;
}

function matchedBraking(zonesA: Zone[], zonesB: Zone[]) {
  return matchedIndices(zonesA.map((zone) => zone.onset_m), zonesB.map((zone) => zone.onset_m))
    .map(([i, j], index) => ({
      zone: index + 1,
      lap_a: zonesA[i],
      lap_b: zonesB[j],
      onset_diff_m: zonesA[i].onset_m - zonesB[j].onset_m,
    }));
}

interface Minimum { distance_m: number; speed_kmh: number }

function windowMaxima(lap: AlignedLap, channels: Channels, smooth: number[], reverse: boolean): number[] {
  const times = channels.time.values;
  const speed = channels.speed.values;
  const queue: number[] = [];
  const result = new Array<number>(smooth.length);
  let head = 0;
  for (let step = 0; step < smooth.length; step += 1) {
    const k = reverse ? smooth.length - step - 1 : step;
    const centre = times[lap.samples[k]];
    while (head < queue.length && Math.abs(centre - times[lap.samples[queue[head]]]) > 3) head += 1;
    result[k] = head < queue.length ? smooth[queue[head]] : -Infinity;
    if (!Number.isFinite(speed[lap.samples[k]]) || !Number.isFinite(smooth[k])) continue;
    while (queue.length > head && smooth[queue.at(-1)!] <= smooth[k]) queue.pop();
    queue.push(k);
  }
  return result;
}

function windowRawMinima(lap: AlignedLap, channels: Channels): number[] {
  const times = channels.time.values;
  const speed = channels.speed.values;
  const samples = lap.samples;
  const queue: number[] = [];
  const result = new Array<number>(samples.length);
  let left = 0;
  let right = 0;
  let head = 0;
  for (let k = 0; k < samples.length; k += 1) {
    const centre = times[samples[k]];
    while (right < samples.length && times[samples[right]] <= centre + 0.5) {
      const value = speed[samples[right]];
      if (Number.isFinite(value)) {
        while (queue.length > head && speed[samples[queue.at(-1)!]] > value) queue.pop();
        queue.push(right);
      }
      right += 1;
    }
    while (left < samples.length && times[samples[left]] < centre - 0.5) left += 1;
    while (head < queue.length && queue[head] < left) head += 1;
    result[k] = head < queue.length ? queue[head] : -1;
  }
  return result;
}

function smoothedSpeed(lap: AlignedLap, channels: Channels): number[] {
  const times = channels.time.values;
  const speed = channels.speed.values;
  const samples = lap.samples;
  const result: number[] = [];
  let left = 0;
  let right = 0;
  let sum = 0;
  let count = 0;
  for (const sample of samples) {
    while (right < samples.length && times[samples[right]] <= times[sample] + 0.5) {
      const value = speed[samples[right++]];
      if (Number.isFinite(value)) { sum += value; count += 1; }
    }
    while (left < samples.length && times[samples[left]] < times[sample] - 0.5) {
      const value = speed[samples[left++]];
      if (Number.isFinite(value)) { sum -= value; count -= 1; }
    }
    result.push(count ? sum / count : NaN);
  }
  return result;
}

function cornerMinima(lap: AlignedLap, channels: Channels): FeatureSet<Minimum> {
  const smooth = smoothedSpeed(lap, channels);
  const speed = channels.speed.values;
  const leftMax = windowMaxima(lap, channels, smooth, false);
  const rightMax = windowMaxima(lap, channels, smooth, true);
  const rawMin = windowRawMinima(lap, channels);
  const ranked: Ranked<Minimum>[] = [];
  let total = 0;
  for (let k = 1; k < smooth.length - 1; k += 1) {
    if (!(smooth[k] < smooth[k - 1] && smooth[k] <= smooth[k + 1])) continue;
    const index = rawMin[k];
    const drop = (Math.min(leftMax[k], rightMax[k]) - smooth[k]) * 3.6;
    if (index < 0 || drop < 10) continue;
    retainStrongest(ranked, { distance_m: lap.distance[index], speed_kmh: speed[lap.samples[index]] * 3.6 }, drop);
    total += 1;
  }
  return { items: ranked.map(({ value }) => value).sort((a, b) => a.distance_m - b.distance_m), total };
}

function matchedMinima(first: Minimum[], second: Minimum[]) {
  return matchedIndices(first.map((item) => item.distance_m), second.map((item) => item.distance_m)).map(([i, j], index) => ({
    corner: index + 1,
    distance_m: second[j].distance_m,
    lap_a_kmh: first[i].speed_kmh,
    lap_b_kmh: second[j].speed_kmh,
    diff_kmh: first[i].speed_kmh - second[j].speed_kmh,
  }));
}

interface Features {
  braking: ReturnType<typeof matchedBraking>;
  min_speeds: ReturnType<typeof matchedMinima>;
  capNote?: string;
}

// Distances of the first lap are multiplied by `scale` so laps of slightly different length line up. Within one
// session the scale is 1 and nothing changes.
function compareFeatures(a: AlignedLap, channelsA: Channels, b: AlignedLap, channelsB: Channels, scale: number): Features {
  const brakingA = brakingZones(a, channelsA);
  const brakingB = brakingZones(b, channelsB);
  const minimaA = cornerMinima(a, channelsA);
  const minimaB = cornerMinima(b, channelsB);
  const capped: string[] = [];
  if (brakingA.total > MAX_FEATURES) capped.push(`lap ${a.lap} braking: showing the first 50 of ${brakingA.total} strongest peaks`);
  if (brakingB.total > MAX_FEATURES) capped.push(`lap ${b.lap} braking: showing the first 50 of ${brakingB.total} strongest peaks`);
  if (minimaA.total > MAX_FEATURES) capped.push(`lap ${a.lap} minimum speeds: showing the first 50 of ${minimaA.total} deepest drops`);
  if (minimaB.total > MAX_FEATURES) capped.push(`lap ${b.lap} minimum speeds: showing the first 50 of ${minimaB.total} deepest drops`);
  return {
    braking: matchedBraking(brakingA.items.map((zone) => ({ ...zone, onset_m: zone.onset_m * scale })), brakingB.items),
    min_speeds: matchedMinima(minimaA.items.map((item) => ({ ...item, distance_m: item.distance_m * scale })), minimaB.items),
    ...(capped.length ? { capNote: `Comparison features capped at ${MAX_FEATURES} per lap (${capped.join("; ")}).` } : {}),
  };
}

function deltaByDistance(a: AlignedLap, b: AlignedLap, delta_s: number) {
  return Array.from({ length: 20 }, (_, index) => ({
    distance_m: b.total_m * (index + 1) / 20,
    delta_s: index === 19 ? delta_s : a.boundary_s[index + 1] - b.boundary_s[index + 1],
  }));
}

export function compareLaps(data: SessionData, lapA: number, lapB: number) {
  const [a, b] = selectedPair(data, lapA, lapB);
  const delta_s = a.time_s - b.time_s;
  const features = compareFeatures(a, data.channels, b, data.channels, 1);
  const notes = [...data.notes];
  if (features.capNote) notes.push(features.capNote);
  return {
    lap_a: a.lap,
    lap_b: b.lap,
    time_a_s: a.time_s,
    time_b_s: b.time_s,
    delta_s,
    delta_by_distance: deltaByDistance(a, b, delta_s),
    braking: features.braking,
    min_speeds: features.min_speeds,
    notes,
  };
}

function pickLap(data: SessionData, requested: number | undefined, side: "A" | "B"): AlignedLap {
  if (requested === undefined) {
    if (!validLaps(data).length) throw new Error(`Session ${side}: No valid laps to compare. Export a full timed session from AiM RaceStudio.`);
    return bestLap(data);
  }
  const lap = data.laps.find((item) => item.lap === requested);
  if (!lap) throw new Error(`Session ${side}: Choose a valid lap number: ${data.laps.map((item) => item.lap).join(", ")}.`);
  return lap;
}

function topSpeedKmh(lap: AlignedLap, channels: Channels): number {
  let top = 0;
  for (const sample of lap.samples) {
    const value = channels.speed.values[sample];
    if (Number.isFinite(value)) top = Math.max(top, value);
  }
  return top * 3.6;
}

// Two sessions, usually two drivers or cars on the same track: each session's best valid lap unless a lap is named.
export function compareSessions(dataA: SessionData, dataB: SessionData, lapA?: number, lapB?: number) {
  const a = pickLap(dataA, lapA, "A");
  const b = pickLap(dataB, lapB, "B");
  const delta_s = a.time_s - b.time_s;
  const scale = b.total_m / a.total_m;
  const features = compareFeatures(a, dataA.channels, b, dataB.channels, scale);
  const notes = [...dataA.notes.map((note) => `Session A: ${note}`), ...dataB.notes.map((note) => `Session B: ${note}`)];
  if (Math.abs(scale - 1) > 0.02) notes.push(`Lap lengths differ by ${(Math.abs(scale - 1) * 100).toFixed(1)}%: distances are scaled to session B's lap length.`);
  if (features.capNote) notes.push(features.capNote);
  return {
    session_a: sessionInfo(dataA),
    session_b: sessionInfo(dataB),
    lap_a: a.lap,
    lap_b: b.lap,
    time_a_s: a.time_s,
    time_b_s: b.time_s,
    delta_s,
    lap_length_m: { a: a.total_m, b: b.total_m },
    top_speed_kmh: { a: topSpeedKmh(a, dataA.channels), b: topSpeedKmh(b, dataB.channels) },
    delta_by_distance: deltaByDistance(a, b, delta_s),
    sectors: Array.from({ length: 20 }, (_, sector) => ({
      start_m: b.total_m * sector / 20,
      end_m: b.total_m * (sector + 1) / 20,
      delta_s: sectorTime(a, sector) - sectorTime(b, sector),
    })),
    braking: features.braking,
    min_speeds: features.min_speeds,
    notes,
  };
}

// Names the session in an error, so "No laps found" says which of the two files it is about.
export async function forSession<T>(side: "A" | "B", work: () => Promise<T> | T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new Error(`Session ${side}: ${error instanceof Error ? error.message : "The CSV could not be read."}`);
  }
}

export function findTimeLoss(data: SessionData, requested?: number) {
  const reference = bestLap(data);
  const alternatives = validLaps(data).filter((lap) => lap.lap !== reference.lap).sort((a, b) => a.time_s - b.time_s);
  const notes = [...data.notes];
  const target = requested === undefined ? alternatives[Math.floor(alternatives.length / 2)] : data.laps.find((lap) => lap.lap === requested);
  if (requested === undefined) notes.push("Selected the median valid lap other than the reference lap by default.");
  if (!target) throw new Error(`Choose a valid lap number: ${data.laps.map((lap) => lap.lap).join(", ")}. A comparison needs another valid lap.`);
  const segments = Array.from({ length: 20 }, (_, sector) => ({
    start_m: reference.total_m * sector / 20,
    end_m: reference.total_m * (sector + 1) / 20,
    loss_s: sectorTime(target, sector) - sectorTime(reference, sector),
  })).sort((a, b) => b.loss_s - a.loss_s).slice(0, 5);
  return {
    lap: target.lap,
    reference_lap: reference.lap,
    lap_time_s: target.time_s,
    reference_time_s: reference.time_s,
    total_loss_s: target.time_s - reference.time_s,
    segments,
    notes,
  };
}
