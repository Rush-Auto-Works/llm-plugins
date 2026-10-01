// @ts-expect-error Node builtin types are outside the Worker type library.
import { readFile } from "node:fs/promises";
import { analyzeSession, compareLaps, compareSessions, findTimeLoss, forSession, prepare } from "./analysis";
import { clean } from "./clean";
import { parseCsv } from "./csv";
import { attribution, rushLink } from "./links";
import { rejectBinary } from "./input";
import { analysisText, comparisonText, lossText, sessionsText } from "./render";

const BINARY_MESSAGE = "This looks like a binary .xrk file. Run `python3 scripts/convert.py <file>.xrk <file>.csv` first.";
// The lap flags each command accepts. Anything else is refused by name rather than silently ignored.
const COMMANDS = {
  analyze: { tool: "analyze_session", files: 1, flags: [] as string[] },
  compare: { tool: "compare_laps", files: 1, flags: ["--lap-a", "--lap-b"] },
  loss: { tool: "find_time_loss", files: 1, flags: ["--lap"] },
  "compare-sessions": { tool: "compare_sessions", files: 2, flags: ["--lap-a", "--lap-b"] },
};
type Command = keyof typeof COMMANDS;
const LAP_FLAGS = ["--lap-a", "--lap-b", "--lap"];

interface LapOptions {
  lapA?: number;
  lapB?: number;
  lap?: number;
  json: boolean;
}

function finiteNumbers(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteNumbers);
  if (value && typeof value === "object") return Object.values(value).every(finiteNumbers);
  return true;
}

function lapNumber(option: string, raw: string | undefined): number {
  if (raw === undefined || raw.startsWith("--")) throw new Error(`${option} requires an integer lap number.`);
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${option} requires an integer lap number.`);
  return value;
}

function parseLapOptions(command: Command, args: string[]): LapOptions {
  const options: LapOptions = { json: false };
  for (let i = 0; i < args.length; i += 1) {
    const option = args[i];
    if (option === "--json") { options.json = true; continue; }
    if (!LAP_FLAGS.includes(option)) throw new Error(`Unknown option: ${clean(option, 200)}.`);
    if (!COMMANDS[command].flags.includes(option)) throw new Error(`${option} does not apply to ${command}.`);
    const value = lapNumber(option, args[i + 1]);
    if (option === "--lap-a") options.lapA = value;
    if (option === "--lap-b") options.lapB = value;
    if (option === "--lap") options.lap = value;
    i += 1;
  }
  if (command === "compare" && (options.lapA === undefined || options.lapB === undefined)) throw new Error("Compare requires --lap-a N and --lap-b N.");
  if (command === "loss" && options.lap === undefined) throw new Error("Loss requires --lap N.");
  return options;
}

function printFailure(command: string, error: unknown): void {
  const known = command in COMMANDS ? COMMANDS[command as Command].tool : "analyze_session";
  const message = error instanceof Error && error.message.endsWith(BINARY_MESSAGE)
    ? error.message
    : error instanceof Error ? clean(error.message, 2000) : "The CSV could not be analyzed. Export it again from AiM RaceStudio.";
  process.stdout.write(`${message}\n\n${attribution(known, "skill")}\n`);
  process.exitCode = 1;
}

async function loadSession(path: string) {
  const raw = await readFile(path, "utf8");
  rejectBinary(raw, BINARY_MESSAGE);
  return prepare(parseCsv(raw, 2_000_000, 20_000_000));
}

function filePaths(command: Command, argv: string[]): string[] {
  const { files } = COMMANDS[command];
  const paths = argv.slice(3, 3 + files);
  if (paths.length < files || paths.some((path) => !path || path.startsWith("--"))) {
    throw new Error(files === 2 ? "Provide two local CSV file paths: session A, then session B." : "Provide a local CSV file path.");
  }
  return paths;
}

async function compute(command: Command, paths: string[], options: LapOptions): Promise<{ result: object; summary: string }> {
  if (command === "compare-sessions") {
    const first = await forSession("A", () => loadSession(paths[0]));
    const second = await forSession("B", () => loadSession(paths[1]));
    const result = compareSessions(first, second, options.lapA, options.lapB);
    return { result, summary: sessionsText(result) };
  }
  const data = await loadSession(paths[0]);
  if (command === "analyze") {
    const result = analyzeSession(data);
    return { result, summary: analysisText(result) };
  }
  if (command === "compare") {
    const result = compareLaps(data, options.lapA!, options.lapB!);
    return { result, summary: comparisonText(result) };
  }
  const result = findTimeLoss(data, options.lap);
  return { result, summary: lossText(result) };
}

async function run(argv: string[]): Promise<void> {
  const command = argv[2] ?? "";
  try {
    if (!(command in COMMANDS)) throw new Error(command ? `Unknown command: ${clean(command, 200)}.` : "Choose analyze, compare, loss, or compare-sessions.");
    const known = command as Command;
    const paths = filePaths(known, argv);
    const options = parseLapOptions(known, argv.slice(3 + paths.length));
    const { result, summary } = await compute(known, paths, options);
    if (!finiteNumbers(result)) throw new Error("The data contains values that cannot be analyzed.");
    const tool = COMMANDS[known].tool;
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ ...result, rush: rushLink(tool, "skill") }, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${summary}\n\n${attribution(tool, "skill")}\n`);
  } catch (error) {
    printFailure(command, error);
  }
}

void run(process.argv);
