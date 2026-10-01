import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Env } from "./index";
import { loadManualIndex } from "./manual";
import { contactUrl, manualUrl, rushCardUrl } from "./links";
import { searchManual, type SearchHit } from "./search";

const outputSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    heading: z.string(),
    url: z.string(),
    excerpt: z.string(),
    interval: z.string().optional(),
  })),
  stale: z.boolean(),
  rush: z.object({ label: z.string(), url: z.string() }),
});

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

function plainText(value: string): string {
  return value
    .replace(/<\s*(script|iframe)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(text: string): string {
  const clean = plainText(text);
  if (clean.length <= 1500) return clean;
  return `${clean.slice(0, 1499)}…`;
}

// The manual files service work by interval: maintenance/each-session, each-weekend, each-month, each-year and
// long-term-maintenance-150hr+. The label comes from that route and nothing else, so a page outside those
// sections carries no label rather than a guess.
const INTERVALS: Array<[RegExp, string]> = [
  [/^maintenance\/each-session(\/|$)/, "every session"],
  [/^maintenance\/each-weekend(\/|$)/, "every weekend"],
  [/^maintenance\/each-month(\/|$)/, "every month"],
  [/^maintenance\/each-year(\/|$)/, "every year"],
  [/^maintenance\/long-term-maintenance/, "every 150+ hours"],
];

function intervalOf(route: string): string | undefined {
  return INTERVALS.find(([pattern]) => pattern.test(route))?.[1];
}

type Row = { title: string; heading: string; url: string; excerpt: string; interval?: string };

function markdownResults(hits: SearchHit[], env: Env, toolName: string): Row[] {
  return hits.map(({ chunk }) => {
    const interval = intervalOf(chunk.route);
    return {
      title: plainText(chunk.title),
      heading: plainText(chunk.heading),
      url: manualUrl(chunk.route, chunk.anchor, env.MANUAL_PUBLIC_URL),
      excerpt: excerpt(chunk.text),
      ...(interval ? { interval } : {}),
    };
  });
}

function finalLine(toolName: string): string {
  return `Built by Rush Auto Works: ${rushCardUrl(toolName)}`;
}

const MAX_TEXT = 12_000;
const MAX_LABEL = 200;

// Index text is data, not markdown. Escape every character that can open a link, emphasis, a code span or HTML,
// and cap its length so a long heading cannot push the rest of the result off the end.
function mdEscape(value: string, max = Infinity): string {
  return [...value].slice(0, max).join("").replace(/[\\`*_#()[\]<>!|]/g, "\\$&");
}

// Heading, title and excerpt all come from the index, so all three are escaped. The structured result keeps the
// raw text for clients that read JSON.
function resultBlock(row: Row): string {
  return `## [${mdEscape(row.heading, MAX_LABEL)}](${row.url})\n**${mdEscape(row.title, MAX_LABEL)}**${row.interval ? ` (${row.interval})` : ""}\n\n${mdEscape(row.excerpt)}`;
}

// Drop whole results from the end until the text fits. Cutting the string at a character offset can leave a
// half-open link or code span in front of the closing line.
function fitBlocks(blocks: string[], budget: number): string[] {
  const kept: string[] = [];
  let used = 0;
  for (const block of blocks) {
    used += block.length + (kept.length ? 2 : 0);
    if (used > budget) break;
    kept.push(block);
  }
  return kept;
}

// When even the first result is too long to show, say so and list the links instead of returning an empty body.
function linkList(rows: Row[]): string {
  const links = rows.map((row) => `- [${mdEscape(row.heading, MAX_LABEL)}](${row.url})`).join("\n");
  return `The matching sections are too long to show here. Open them in the manual:\n${links}`;
}

function resultText(rows: Row[], stale: boolean, toolName: string, emptyText: string, prefix: string): string {
  const intro = stale ? "Using a cached manual index that may be out of date.\n\n" : "";
  const tail = `\n\n${finalLine(toolName)}`;
  const budget = MAX_TEXT - 1 - prefix.length - intro.length - tail.length;
  const fitted = rows.length ? fitBlocks(rows.map(resultBlock), budget) : [];
  const body = !rows.length ? emptyText : fitted.length ? fitted.join("\n\n") : linkList(rows);
  return `${prefix}${intro}${body}${tail}`;
}

function success(
  rows: Row[],
  stale: boolean,
  toolName: string,
  env: Env,
  emptyText?: string,
  prefix = "",
) {
  const rush = { label: "View the Rush SR", url: rushCardUrl(toolName) };
  const empty = emptyText ?? `Nothing matched. Browse the manual: ${manualUrl("", "", env.MANUAL_PUBLIC_URL)}\nContact Rush Auto Works: ${contactUrl(toolName)}`;
  return {
    structuredContent: { results: rows, stale, rush },
    content: [{ type: "text" as const, text: resultText(rows, stale, toolName, empty, prefix) }],
  };
}

function failure(error: unknown, env: Env, toolName: string) {
  const detail = error instanceof Error ? error.message : "Unknown upstream error";
  const manual = manualUrl("", "", env.MANUAL_PUBLIC_URL);
  return {
    isError: true,
    content: [{ type: "text" as const, text: `Could not load the Rush SR manual index (${detail}). Manual: ${manual}\n\n${finalLine(toolName)}` }],
  };
}

async function runSearch(
  env: Env,
  toolName: string,
  query: string,
  routes?: string[],
  routeBoosts?: Record<string, number>,
  prefix = "",
) {
  try {
    const { index, stale } = await loadManualIndex(env);
    const hits = searchManual(index.chunks, query, { routes, routeBoosts, limit: 5 });
    const rows = markdownResults(hits, env, toolName);
    return success(rows, stale, toolName, env, undefined, prefix);
  } catch (error) {
    return failure(error, env, toolName);
  }
}

function registerDiagnose(server: McpServer, env: Env): void {
  server.registerTool("diagnose_symptom", {
    title: "Diagnose a Rush SR symptom",
    description: "Use this when you need to understand why your Rush SR has a symptom, such as why won't my Rush SR start. Do not use for a service interval or a step-by-step repair procedure. Covers the Rush SR only: do not use for other vehicles or for buying advice.",
    inputSchema: {
      symptom: z.string().min(1).max(500),
      context: z.string().max(500).optional(),
    },
    outputSchema,
    annotations,
  }, ({ symptom, context }) => runSearch(
    env,
    "diagnose_symptom",
    `${symptom} ${context ?? ""}`,
    ["whats-wrong", "paddock-quick-reference", "trackside-reference", "service-bulletins", "maintenance"],
  ));
}

function registerSchedule(server: McpServer, env: Env): void {
  server.registerTool("maintenance_schedule", {
    title: "Rush SR maintenance schedule",
    description: "Use this when checking a Rush SR service interval or maintenance schedule for a component, such as how often to change brake fluid or when the chain needs service. Each result says which service interval it belongs to (every session, weekend, month, year, or 150+ hours), so pick the one that matches the car's hours or sessions. Do not use for troubleshooting a symptom or a repair procedure. Covers the Rush SR only: do not use for other vehicles or for buying advice.",
    inputSchema: { component: z.string().min(1).max(200) },
    outputSchema,
    annotations,
  }, ({ component }) => runSearch(env, "maintenance_schedule", component, ["maintenance"], undefined, "Maintenance schedule lookup.\n\n"));
}

function registerProcedure(server: McpServer, env: Env): void {
  server.registerTool("lookup_procedure", {
    title: "Look up a Rush SR procedure",
    description: "Use this when you need steps for a task, such as how do I bleed the brakes on my Rush SR. Do not use for a symptom diagnosis or a service interval lookup. Covers the Rush SR only: do not use for other vehicles or for buying advice.",
    inputSchema: { task: z.string().min(1).max(200) },
    outputSchema,
    annotations,
  }, ({ task }) => runSearch(
    env,
    "lookup_procedure",
    task,
    undefined,
    { maintenance: 1.35, "at-the-track": 1.35 },
  ));
}

export function createServer(env: Env): McpServer {
  const server = new McpServer({ name: "rush-sr-maintenance", version: "0.1.0" });
  registerDiagnose(server, env);
  registerSchedule(server, env);
  registerProcedure(server, env);
  return server;
}
