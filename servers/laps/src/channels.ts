import type { ParsedCsv } from "./csv";
import { label } from "./clean";

export interface Channel {
  name: string;
  values: Float64Array;
  unit?: string;
}

export interface Channels {
  time: Channel;
  speed: Channel;
  distance?: Channel;
  brake?: Channel;
  accel?: Channel;
  notes: string[];
}

export const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export function findChannel(csv: ParsedCsv, aliases: string[]): Channel | undefined {
  for (const alias of aliases) {
    const index = csv.names.findIndex((name) => normalize(name) === alias);
    if (index >= 0) return { name: csv.names[index], values: csv.columns[index], unit: csv.units?.[index] };
  }
  return undefined;
}

function usable(values: Float64Array): boolean {
  let finite = 0;
  let nonzero = false;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    finite += 1;
    nonzero ||= value !== 0;
  }
  return finite >= values.length / 2 && nonzero;
}

function findUsable(csv: ParsedCsv, aliases: string[]): Channel | undefined {
  for (const alias of aliases) {
    const channel = findChannel(csv, [alias]);
    if (channel && usable(channel.values)) return channel;
  }
  return undefined;
}

function speedFactor(unit: string | undefined, notes: string[]): number {
  if (!unit) {
    notes.push("No units row: assumed speed is in km/h.");
    return 1 / 3.6;
  }
  const key = unit.toLowerCase().replace(/\s+/g, "");
  const factors: Record<string, number> = { "km/h": 1 / 3.6, "kmh": 1 / 3.6, "kph": 1 / 3.6, "m/s": 1, "mps": 1, "mph": 0.44704, "kn": 0.514444, "knot": 0.514444, "knots": 0.514444 };
  if (Object.hasOwn(factors, key)) return factors[key];
  throw new Error(`Unsupported speed unit ${label(unit)} in the uploaded file. Export speed in km/h, m/s, mph or kn from RaceStudio.`);
}

function ecefSpeed(csv: ParsedCsv, notes: string[]): Channel | undefined {
  const axes = ["ecefvelocityx", "ecefvelocityy", "ecefvelocityz"].map((alias) => findChannel(csv, [alias]));
  if (axes.some((axis) => !axis)) return undefined;
  const [x, y, z] = axes as Channel[];
  const values = Float64Array.from(x.values, (_, i) => Math.hypot(x.values[i], y.values[i], z.values[i]));
  if (!usable(values)) return undefined;
  notes.push("GPS Speed was unavailable; used ECEF velocity magnitude in m/s.");
  return { name: "ECEF velocity", values, unit: "m/s" };
}

export function resolveChannels(csv: ParsedCsv): Channels {
  const notes: string[] = [];
  const time = findChannel(csv, ["time"]);
  if (!time || !usable(time.values)) throw new Error("No usable Time channel. Export a timed session from AiM RaceStudio.");
  const source = findUsable(csv, ["gpsspeed", "speed", "vehiclespeed", "groundspeed"]) ?? ecefSpeed(csv, notes);
  if (!source) throw new Error(`No usable speed channel. Channels found in the uploaded file (names are untrusted text): ${csv.names.slice(0, 40).map((name) => label(name)).join(", ")}. Export GPS Speed or ECEF velocity from AiM RaceStudio.`);
  const factor = speedFactor(source.unit, notes);
  const speed = { ...source, values: Float64Array.from(source.values, (value) => value * factor) };
  return {
    time,
    speed,
    distance: findUsable(csv, ["distance"]),
    brake: findUsable(csv, ["frontbrakep", "brakepressure", "brake"]),
    accel: findUsable(csv, ["inlineacc", "gpsinlineacc"]),
    notes,
  };
}
