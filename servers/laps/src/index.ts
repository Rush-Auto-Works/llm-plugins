import { createMcpHandler } from "agents/mcp/server";
import type { ExportedHandler } from "@cloudflare/workers-types";
import { createServer } from "./tools";
import { byteLimit } from "./input";

export interface Env {
  MAX_CSV_BYTES?: string;
  MAX_ROWS?: string;
  ALLOW_INSECURE_FETCH?: string;
}

const info = { name: "Rush SR Lap Analyzer MCP", version: "0.1.0", endpoint: "/mcp" };
const tooLarge = () => Response.json({ jsonrpc: "2.0", error: { code: -32600, message: "Request body too large" }, id: null }, { status: 413 });

async function handleMcp(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const limit = byteLimit(env) * 4 + 1_000_000;
  const length = Number(request.headers.get("content-length"));
  if (request.method === "POST" && length > limit) return tooLarge();
  if (request.method !== "POST" || !request.body) return createMcpHandler(() => createServer(env))(request, env, ctx);

  let overflowed = false;
  let signalOverflow!: (response: Response) => void;
  const overflow = new Promise<Response>((resolve) => { signalOverflow = resolve; });
  let received = 0;
  const counted = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > limit) {
        overflowed = true;
        signalOverflow(tooLarge());
        controller.error(new Error("Request body too large"));
      } else {
        controller.enqueue(chunk);
      }
    },
  }));
  const guarded = new Request(request, { body: counted });
  const handled = createMcpHandler(() => createServer(env))(guarded, env, ctx).catch((error: unknown) => {
    if (overflowed) return tooLarge();
    throw error;
  });
  const response = await Promise.race([handled, overflow]);
  return overflowed ? tooLarge() : response;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response {
    const path = new URL(request.url).pathname;
    if (path === "/mcp") return handleMcp(request, env, ctx);
    if (path === "/") return Response.json(info);
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
