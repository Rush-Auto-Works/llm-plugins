import type { ParsedCsv } from "./csv";
import { findChannel } from "./channels";

export const MAX_LAPS = 500;

function appendLap(laps: Lap[], start: number, end: number): void {
  if (!Number.isFinite(end) || end <= start) return;
  if (laps.length >= MAX_LAPS) throw new Error("The CSV has too many laps.");
  laps.push({ lap: laps.length + 1, start, end, time_s: end - start, excluded: false });
}

export interface Lap {
  lap: number;
  start: number;
  end: number;
  time_s: number;
  excluded: boolean;
  reason?: string;
}

function markerLaps(values: string[], notes: string[]): Lap[] {
  const laps: Lap[] = [];
  let start = 0;
  let skipped = 0;
  const examples: string[] = [];
  for (const raw of values) {
    const end = Number(raw.replace(/^([+-]?\d+),(\d+)$/, "$1.$2"));
    if (!raw || !Number.isFinite(end) || end <= start) {
      skipped += 1;
      // Echo only numeric-looking values: anything else is file prose that would reach the model unfiltered.
      if (examples.length < 3) examples.push(/^[0-9.,eE+-]{1,20}$/.test(raw) ? raw : "(non-numeric)");
      continue;
    }
    appendLap(laps, start, end);
    start = end;
  }
  if (skipped) notes.push(`Skipped ${skipped} Beacon Markers (first values: ${examples.join(", ")}).`);
  return laps;
}

function numberedLaps(csv: ParsedCsv): Lap[] {
  const channel = findChannel(csv, ["lapnumber"]);
  const time = findChannel(csv, ["time"]);
  if (!channel || !time) return [];
  const laps: Lap[] = [];
  let current = NaN;
  let start = NaN;
  let lastTime = NaN;
  for (let i = 0; i < channel.values.length; i += 1) {
    const value = channel.values[i];
    const t = time.values[i];
    if (!Number.isFinite(t)) continue;
    lastTime = t;
    if (!Number.isFinite(value)) continue;
    if (!Number.isFinite(current)) { current = value; start = Math.max(0, t); continue; }
    if (value === current) continue;
    appendLap(laps, start, t);
    current = value;
    start = t;
  }
  if (Number.isFinite(current)) appendLap(laps, start, lastTime);
  return laps;
}

// RaceStudio and libxrk close the last Beacon Markers segment at the end of the data (the marker equals Duration), so
// that segment never ends on a beacon crossing. It is the in-lap however fast it is.
const DURATION_TOLERANCE_S = 0.5;

function endsWithData(csv: ParsedCsv, laps: Lap[]): boolean {
  const raw = [...csv.header].find(([key]) => key.toLowerCase() === "duration")?.[1]?.[0] ?? "";
  const duration = Number(raw.replace(/^([+-]?\d+),(\d+)$/, "$1.$2"));
  return laps.length > 1 && Number.isFinite(duration) && Math.abs(laps[laps.length - 1].end - duration) <= DURATION_TOLERANCE_S;
}

export function resolveLaps(csv: ParsedCsv, notes: string[]): Lap[] {
  const markers = [...csv.header].find(([key]) => key.toLowerCase() === "beacon markers")?.[1];
  const laps = markers ? markerLaps(markers, notes) : numberedLaps(csv);
  if (!laps.length) throw new Error("No laps found. Export Beacon Markers or a Lap Number channel from AiM RaceStudio.");
  const partial = markers !== undefined && endsWithData(csv, laps);
  const best = Math.min(...(partial ? laps.slice(0, -1) : laps).map((lap) => lap.time_s));
  for (const lap of laps) {
    const isFinal = lap.lap === laps.length;
    if (laps.length === 1 || (lap.time_s <= best * 1.07 && !(partial && isFinal))) continue;
    lap.excluded = true;
    lap.reason = lap.lap === 1 ? "out-lap" : isFinal ? "in-lap" : "slower than 107% of the best lap";
  }
  return laps;
}
