import { clean } from "./clean";
import { MAX_LAPS } from "./laps";

export const MAX_COLUMNS = 256;
const MAX_HEADER_ROWS = 200;
const MAX_TEXT_CELL = 4096;
const MAX_NUMERIC_CELL = 64;

export interface ParsedCsv {
  header: Map<string, string[]>;
  names: string[];
  units: string[] | undefined;
  columns: Float64Array[];
}

function firstLine(text: string): string {
  let quoted = false;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && text[i + 1] === '"' && quoted) { i += 1; continue; }
    if (ch === '"') quoted = !quoted;
    if (!quoted && (ch === "\n" || ch === "\r")) {
      if (text.slice(start, i).trim()) return text.slice(start, i);
      start = ch === "\r" && text[i + 1] === "\n" ? i + 2 : i + 1;
      i = start - 1;
    }
  }
  return text.slice(start);
}

function delimiterOf(text: string): string {
  const line = firstLine(text);
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"' && line[i + 1] === '"' && quoted) { i += 1; continue; }
    if (line[i] === '"') { quoted = !quoted; continue; }
    if (!quoted && line[i] in counts) counts[line[i]] += 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

type CsvPhase = "header" | "names" | "first" | "numeric";

interface CsvParser {
  text: string;
  maxRows: number;
  maxCells: number;
  decimalComma: boolean;
  rows: string[][];
  row?: string[];
  rowPresent: boolean;
  fragments: string[];
  pendingEmpty: number;
  columns: number;
  buffers: Float64Array[];
  dataRows: number;
  storedRows: number;
  hasUnits?: boolean;
  markerRow: boolean;
  quoted: boolean;
  widest: number;
  headerEnd: number;
  rowCount: number;
  start: number;
  cellLength: number;
  phase: CsvPhase;
  sawCellSyntax: boolean;
}

function cellLimit(state: CsvParser): number {
  return state.phase === "numeric" ? MAX_NUMERIC_CELL : MAX_TEXT_CELL;
}

function appendFragment(state: CsvParser, end: number): void {
  if (end <= state.start) return;
  state.cellLength += end - state.start;
  if (state.cellLength > cellLimit(state)) throw new Error("The CSV has a cell that is too long.");
  state.fragments.push(state.text.slice(state.start, end));
}

function pushCell(state: CsvParser, end: number): void {
  appendFragment(state, end);
  const cell = state.fragments.join("");
  if (state.columns === 0) state.markerRow = state.phase === "header" && cell.trim().toLowerCase() === "beacon markers";
  state.columns += 1;
  if (state.columns > (state.markerRow ? MAX_LAPS + 1 : MAX_COLUMNS)) {
    throw new Error(state.markerRow ? "The CSV has too many laps." : "The CSV has too many columns.");
  }
  if (state.phase === "numeric") {
    if (cell.trim()) state.rowPresent = true;
    if (state.columns <= state.buffers.length) writeNumber(state, state.columns - 1, numeric(cell, state.decimalComma));
  } else if (state.row) state.row.push(cell);
  else if (!cell.trim()) state.pendingEmpty += 1;
  else { state.row = Array(state.pendingEmpty).fill(""); state.row.push(cell); }
  state.fragments.length = 0;
  state.cellLength = 0;
  state.start = end + 1;
  state.sawCellSyntax = false;
}

function writeNumber(state: CsvParser, index: number, value: number): void {
  let buffer = state.buffers[index];
  if (state.dataRows === buffer.length) {
    const grown = new Float64Array(buffer.length * 2);
    grown.set(buffer);
    buffer = grown;
    state.buffers[index] = buffer;
  }
  buffer[state.dataRows] = value;
}

function finishDataRow(state: CsvParser, width: number): void {
  for (let i = width; i < state.buffers.length; i += 1) writeNumber(state, i, NaN);
  state.dataRows += 1;
}

function storeRow(state: CsvParser, width: number): void {
  state.storedRows += 1;
  state.widest = Math.max(state.widest, width);
  if (state.storedRows * state.widest > state.maxCells) throw new Error("The CSV has too many cells.");
  if (state.phase === "header" && state.storedRows > MAX_HEADER_ROWS) throw new Error("The CSV header has too many rows.");
}

function advancePhase(state: CsvParser, row: string[]): void {
  if (state.phase === "names") {
    state.buffers = row.map(() => new Float64Array(256));
    state.phase = "first";
  } else if (state.phase === "first") {
    const hasUnits = !row.some((cell) => Number.isFinite(numeric(cell, state.decimalComma)));
    if (!hasUnits) checkNumericRow(row);
    state.hasUnits = hasUnits;
    if (!hasUnits) {
      for (let i = 0; i < state.buffers.length; i += 1) writeNumber(state, i, numeric(row[i] ?? "", state.decimalComma));
      finishDataRow(state, state.buffers.length);
      state.rows.pop();
    }
    state.phase = "numeric";
  }
}

function pushRow(state: CsvParser): void {
  state.rowCount += 1;
  if (state.rowCount > state.maxRows) throw new Error(`The CSV has too many rows (limit ${state.maxRows}).`);
  if (state.phase === "numeric") {
    if (state.rowPresent) {
      storeRow(state, state.columns);
      finishDataRow(state, Math.min(state.columns, state.buffers.length));
    }
  } else if (state.row) {
    state.rows.push(state.row);
    storeRow(state, state.row.length);
    advancePhase(state, state.row);
  } else if (state.phase === "header") {
    state.headerEnd = state.rows.length;
    state.phase = "names";
  }
  state.row = undefined;
  state.rowPresent = false;
  state.pendingEmpty = 0;
  state.columns = 0;
  state.markerRow = false;
}

function checkNumericRow(row: string[]): void {
  for (const cell of row) if (cell.length > MAX_NUMERIC_CELL) throw new Error("The CSV has a numeric cell that is too long.");
}

function consumeQuote(state: CsvParser, index: number): number {
  appendFragment(state, index);
  if (state.quoted && state.text[index + 1] === '"') {
    state.fragments.push('"');
    state.cellLength += 1;
    if (state.cellLength > cellLimit(state)) throw new Error("The CSV has a cell that is too long.");
    index += 1;
  } else state.quoted = !state.quoted;
  state.start = index + 1;
  state.sawCellSyntax = true;
  return index;
}

function rowsOf(text: string, delimiter: string, maxRows: number, maxCells: number): CsvParser {
  const state: CsvParser = {
    text, maxRows, maxCells, decimalComma: delimiter !== ",", rows: [], rowPresent: false, fragments: [], pendingEmpty: 0, columns: 0,
    buffers: [], dataRows: 0, storedRows: 0,
    markerRow: false, quoted: false, widest: 0, headerEnd: -1, rowCount: 0, start: 0,
    cellLength: 0, phase: "header", sawCellSyntax: false,
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') { i = consumeQuote(state, i); continue; }
    if (!state.quoted && ch === delimiter) { pushCell(state, i); continue; }
    if (!state.quoted && (ch === "\n" || ch === "\r")) {
      pushCell(state, i);
      pushRow(state);
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      state.start = i + 1;
      continue;
    }
    if (state.cellLength + i - state.start + 1 > cellLimit(state)) throw new Error("The CSV has a cell that is too long.");
  }
  if (state.quoted) throw new Error("The CSV has an unfinished quoted cell. Export it again from AiM RaceStudio.");
  if (state.start < text.length || state.fragments.length || state.columns || state.sawCellSyntax) {
    pushCell(state, text.length);
    pushRow(state);
  }
  return state;
}

function numeric(cell: string, decimalComma: boolean): number {
  const value = decimalComma ? cell.trim().replace(/^([+-]?\d+),(\d+)$/, "$1.$2") : cell.trim();
  if (!value) return NaN;
  const number = Number(value);
  return Math.abs(number) > 1e9 ? NaN : number;
}

export function parseCsv(raw: string, maxRows = 300_000, maxCells = 1_500_000): ParsedCsv {
  const text = raw.replace(/^\uFEFF/, "");
  const delimiter = delimiterOf(text);
  const { rows, headerEnd: gap, hasUnits, dataRows, buffers } = rowsOf(text, delimiter, maxRows, maxCells);
  if (gap < 0) throw new Error("The CSV has no AiM header block. Export the session again from RaceStudio.");
  if (gap > MAX_HEADER_ROWS) throw new Error("The CSV header has too many rows.");
  const header = new Map<string, string[]>();
  for (let i = 0; i < gap; i += 1) header.set(clean(rows[i][0]?.trim() ?? ""), rows[i].slice(1).map((cell) => clean(cell.trim())));
  if (gap >= rows.length) throw new Error("The CSV has no channel names. Export channels from AiM RaceStudio.");
  const names = rows[gap].map((cell) => clean(cell.trim()));
  if (hasUnits === undefined) throw new Error("The CSV has no samples. Export a session with data from AiM RaceStudio.");
  const units = hasUnits ? rows[gap + 1].map((cell) => clean(cell.trim())) : undefined;
  if (!dataRows) throw new Error("The CSV has no samples. Export a session with data from AiM RaceStudio.");
  // Trim the doubling slack. Within 25% of full, keep a view of the buffer (a copy would put a second full-size array
  // in memory at the peak); beyond that, copy so a mostly empty buffer is released.
  const columns = buffers.map((buffer) => (buffer.length <= dataRows * 1.25 ? buffer.subarray(0, dataRows) : buffer.slice(0, dataRows)));
  return { header, names, units, columns };
}
