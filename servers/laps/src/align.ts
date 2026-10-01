import type { Channels } from "./channels";
import type { Lap } from "./laps";

export interface AlignedLap extends Lap {
  samples: number[];
  distance: Float64Array;
  total_m: number;
  boundary_s: number[];
}

function interpolate(x: number[], y: number[], target: number): number {
  if (target <= x[0]) return y[0];
  for (let i = 1; i < x.length; i += 1) {
    if (x[i] < target) continue;
    const fraction = (target - x[i - 1]) / (x[i] - x[i - 1] || 1);
    return y[i - 1] + fraction * (y[i] - y[i - 1]);
  }
  return y.at(-1)!;
}

function bucketSamples(laps: Lap[], channels: Channels): number[][] {
  const buckets = laps.map(() => [] as number[]);
  let lap = 0;
  let previous = -Infinity;
  for (let i = 0; i < channels.time.values.length && lap < laps.length; i += 1) {
    const t = channels.time.values[i];
    if (!Number.isFinite(t)) continue;
    if (t < previous) throw new Error("The data contains values that cannot be analyzed.");
    previous = t;
    while (lap < laps.length && t > laps[lap].end) lap += 1;
    if (lap >= laps.length || t < laps[lap].start) continue;
    buckets[lap].push(i);
    if (t === laps[lap].end && lap + 1 < laps.length && t === laps[lap + 1].start) buckets[lap + 1].push(i);
  }
  return buckets;
}

function integratedDistance(samples: number[], lap: Lap, channels: Channels): Float64Array {
  const result = new Float64Array(samples.length);
  let previousTime = lap.start;
  let previousSpeed = NaN;
  for (let k = 0; k < samples.length; k += 1) {
    const i = samples[k];
    const time = channels.time.values[i];
    const speed = channels.speed.values[i];
    const used = Number.isFinite(speed) ? speed : previousSpeed;
    result[k] = (k ? result[k - 1] : 0) + Math.max(0, time - previousTime) * (Number.isFinite(used) ? used : 0);
    previousTime = time;
    if (Number.isFinite(speed)) previousSpeed = speed;
  }
  return result;
}

function channelDistance(samples: number[], channels: Channels): Float64Array {
  const values = channels.distance!.values;
  const first = samples.find((i) => Number.isFinite(values[i]));
  if (first === undefined) return new Float64Array(samples.length);
  const result = new Float64Array(samples.length);
  let previous = 0;
  for (let k = 0; k < samples.length; k += 1) {
    const value = values[samples[k]] - values[first];
    if (Number.isFinite(value)) previous = Math.max(previous, value);
    result[k] = previous;
  }
  return result;
}

export function alignLaps(laps: Lap[], channels: Channels, notes: string[]): AlignedLap[] {
  if (!channels.distance) notes.push("No Distance channel: integrated speed over time for lap distance.");
  const buckets = bucketSamples(laps, channels);
  return laps.map((lap, index) => {
    const samples = buckets[index];
    if (samples.length < 2) throw new Error(`Lap ${lap.lap} has too few samples. Export a full timed session from AiM RaceStudio.`);
    const distance = channels.distance ? channelDistance(samples, channels) : integratedDistance(samples, lap, channels);
    const total_m = distance.at(-1)!;
    if (total_m <= 0) throw new Error(`Lap ${lap.lap} has no usable distance. Export Distance or speed from AiM RaceStudio.`);
    const xs = [0, ...distance, total_m];
    const ys = [0, ...samples.map((i) => channels.time.values[i] - lap.start), lap.time_s];
    const boundary_s = Array.from({ length: 21 }, (_, n) => n === 20 ? lap.time_s : interpolate(xs, ys, total_m * n / 20));
    boundary_s[0] = 0;
    return { ...lap, samples, distance, total_m, boundary_s };
  });
}
