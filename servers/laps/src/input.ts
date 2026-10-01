import type { Env } from "./index";
import { downloadCsv } from "./fetch";

export interface FileInput {
  download_url: string;
  file_id: string;
  mime_type?: string;
  file_name?: string;
}

export interface CsvInput {
  file?: FileInput;
  csv_text?: string;
}

export function byteLimit(env: Env): number {
  const value = Number(env.MAX_CSV_BYTES);
  return Number.isSafeInteger(value) && value > 0 ? value : 8_000_000;
}

export function rowLimit(env: Env): number {
  const value = Number(env.MAX_ROWS);
  return Number.isSafeInteger(value) && value > 0 ? value : 300_000;
}

export function rejectBinary(text: string, message = "This looks like a binary .xrk file. Export CSV from AiM RaceStudio and upload that CSV."): void {
  const sample = text.slice(0, 4096);
  const controls = [...sample].filter((ch) => {
    const code = ch.codePointAt(0)!;
    return ((code < 32 && ch !== "\r" && ch !== "\n" && ch !== "\t") || (code >= 127 && code <= 159) || code === 0xfffd);
  }).length;
  if (text.includes("\0") || (sample.length > 0 && controls / sample.length > 0.1)) {
    throw new Error(message);
  }
}

export async function resolveCsv(input: CsvInput, env: Env): Promise<string> {
  if (Boolean(input.file) === (input.csv_text !== undefined)) {
    throw new Error("Provide exactly one AiM RaceStudio CSV export: upload a file or paste csv_text.");
  }
  const limit = byteLimit(env);
  const text = input.file ? await downloadCsv(input.file.download_url, env, limit) : input.csv_text!;
  if (text.length > limit || new TextEncoder().encode(text).byteLength > limit) {
    throw new Error(`CSV exceeds the ${limit} byte limit. Export a smaller session from RaceStudio.`);
  }
  rejectBinary(text);
  if (!text.length) throw new Error("The CSV is empty. Export a session with lap data from AiM RaceStudio.");
  return text;
}
