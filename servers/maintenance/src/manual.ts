import type { Env } from "./index";

export interface ManualChunk {
  route: string;
  title: string;
  heading: string;
  anchor: string;
  text: string;
}

interface ManualIndex {
  version: 1;
  chunks: ManualChunk[];
}

export interface LoadedIndex {
  index: ManualIndex;
  stale: boolean;
}

export class InvalidIndexError extends Error {}

const DEFAULT_MANUAL_BASE = "https://manual.rush.sr";
const DEFAULT_TTL_MS = 3_600_000;
const FETCH_TIMEOUT_MS = 5_000;
const FAILURE_BACKOFF_MS = 30_000;
let cached: { index: ManualIndex; expiresAt: number; stale: boolean } | undefined;
let inFlight: Promise<LoadedIndex> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChunk(value: unknown): value is ManualChunk {
  if (!isRecord(value)) return false;
  return ["route", "title", "heading", "anchor", "text"].every(
    (key) => typeof value[key] === "string",
  );
}

function parseIndex(value: unknown): ManualIndex {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.chunks)) {
    throw new InvalidIndexError("Manual index has an unsupported shape");
  }
  if (!value.chunks.every(isChunk)) {
    throw new InvalidIndexError("Manual index contains an invalid chunk");
  }
  return { version: 1, chunks: value.chunks };
}

function ttlMs(env: Env): number {
  const parsed = Number(env.INDEX_TTL_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_TTL_MS;
}

function manualIndexUrl(env: Env): string {
  const base = (env.MANUAL_BASE || DEFAULT_MANUAL_BASE).replace(/\/+$/, "");
  return `${base}/assistant/index.json`;
}

async function fetchIndex(env: Env): Promise<ManualIndex> {
  const response = await fetch(manualIndexUrl(env), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Manual index returned HTTP ${response.status}`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new InvalidIndexError("Manual index was not valid JSON");
  }
  return parseIndex(payload);
}

async function refresh(env: Env): Promise<LoadedIndex> {
  try {
    const index = await fetchIndex(env);
    cached = { index, expiresAt: Date.now() + ttlMs(env), stale: false };
    return { index, stale: false };
  } catch (error) {
    if (!cached) throw error;
    // Serve the last good copy, and leave the upstream alone for a while instead of refetching on every call.
    cached = { ...cached, expiresAt: Date.now() + FAILURE_BACKOFF_MS, stale: true };
    return { index: cached.index, stale: true };
  }
}

export async function loadManualIndex(env: Env): Promise<LoadedIndex> {
  if (cached && Date.now() < cached.expiresAt) return { index: cached.index, stale: cached.stale };
  if (!inFlight) {
    inFlight = refresh(env).finally(() => {
      inFlight = undefined;
    });
  }
  return inFlight;
}
