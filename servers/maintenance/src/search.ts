import type { ManualChunk } from "./manual";

export interface SearchOptions {
  routes?: string[];
  routeBoosts?: Record<string, number>;
  limit?: number;
}

export interface SearchHit {
  chunk: ManualChunk;
  score: number;
}

interface Field {
  counts: Map<string, number>;
  length: number;
}

type FieldName = "title" | "heading" | "body";
type Doc = { chunk: ManualChunk; fields: Record<FieldName, Field> };

const FIELD_WEIGHTS: Record<FieldName, number> = { title: 2, heading: 6, body: 1 };
const FIELDS = Object.keys(FIELD_WEIGHTS) as FieldName[];

// Filler words plus the product name, which nearly every query and chunk contains.
const STOPWORDS = new Set(
  ("a an and are as at be been but by can did do does for from had has have how i if in into is it its my of on or so " +
    "than that the their then there these this to was we what when where which while who why with would you your me " +
    "our about up out rush sr").split(" "),
);

function stripSuffix(token: string): string {
  if (token.length >= 7 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length >= 6 && token.endsWith("ed")) return token.slice(0, -2);
  return token;
}

function stripPlural(token: string): string {
  if (/(ches|shes|xes|zes|sses)$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function stripSilentE(token: string): string {
  return token.length > 3 && token.endsWith("e") ? token.slice(0, -1) : token;
}

const stem = (token: string): string => stripSilentE(stripPlural(stripSuffix(token)));

function tokenize(value: string): string[] {
  const normalized = value.toLowerCase().replace(/[’‘]/g, "'").replace(/\bwon't\b/g, "will not");
  return (normalized.match(/[a-z0-9]+/g) ?? [])
    .filter((token) => (token.length > 1 || /\d/.test(token)) && !STOPWORDS.has(token))
    .map(stem);
}

function buildField(value: string): Field {
  const counts = new Map<string, number>();
  const tokens = tokenize(value);
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return { counts, length: tokens.length };
}

// Tokenizing the whole manual is the expensive part, so each chunk is prepared once and reused across queries.
const prepared = new WeakMap<ManualChunk, Doc>();

function prepare(chunk: ManualChunk): Doc {
  const cached = prepared.get(chunk);
  if (cached) return cached;
  const doc: Doc = {
    chunk,
    fields: { title: buildField(chunk.title), heading: buildField(chunk.heading), body: buildField(chunk.text) },
  };
  prepared.set(chunk, doc);
  return doc;
}

function matchesRoute(route: string, routes?: string[]): boolean {
  if (!routes) return true;
  return routes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

function routeBoost(route: string, boosts?: Record<string, number>): number {
  if (!boosts) return 1;
  const match = Object.entries(boosts).find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`));
  return match?.[1] ?? 1;
}

function averageLengths(docs: Doc[]): Record<FieldName, number> {
  const average = (name: FieldName) => docs.reduce((sum, doc) => sum + doc.fields[name].length, 0) / docs.length;
  return { title: average("title"), heading: average("heading"), body: average("body") };
}

function inverseDocFrequency(docs: Doc[], token: string): number {
  const df = docs.filter((doc) => FIELDS.some((name) => doc.fields[name].counts.has(token))).length;
  return Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
}

function bm25(frequency: number, length: number, averageLength: number): number {
  const norm = frequency + 1.2 * (0.25 + (0.75 * length) / Math.max(averageLength, 1));
  return (frequency * 2.2) / norm;
}

function tokenScore(doc: Doc, token: string, averages: Record<FieldName, number>): number {
  return FIELDS.reduce((sum, name) => {
    const field = doc.fields[name];
    const frequency = field.counts.get(token) ?? 0;
    return frequency === 0 ? sum : sum + FIELD_WEIGHTS[name] * bm25(frequency, field.length, averages[name]);
  }, 0);
}

function scoreDoc(doc: Doc, query: string[], averages: Record<FieldName, number>, idf: Map<string, number>) {
  let score = 0;
  let matched = 0;
  for (const token of query) {
    const tokenValue = tokenScore(doc, token, averages);
    if (tokenValue === 0) continue;
    matched += 1;
    score += (idf.get(token) ?? 0) * tokenValue;
  }
  return { doc, score, matched };
}

export function searchManual(chunks: ManualChunk[], queryText: string, options: SearchOptions = {}): SearchHit[] {
  const query = [...new Set(tokenize(queryText))];
  if (query.length === 0) return [];

  const docs = chunks.filter((chunk) => matchesRoute(chunk.route, options.routes)).map(prepare);
  if (docs.length === 0) return [];

  const averages = averageLengths(docs);
  const idf = new Map(query.map((token) => [token, inverseDocFrequency(docs, token)] as const));
  const minMatched = Math.ceil(query.length / 2);

  return docs
    .map((doc) => scoreDoc(doc, query, averages, idf))
    .filter((hit) => hit.matched >= minMatched && hit.score > 0)
    .map(({ doc, score }) => ({ chunk: doc.chunk, score: score * routeBoost(doc.chunk.route, options.routeBoosts) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 5);
}
