import { createMcpHandler } from "agents/mcp/server";
import type { ExportedHandler } from "@cloudflare/workers-types";
import { createServer } from "./tools";

export interface Env {
  MANUAL_BASE?: string;
  MANUAL_PUBLIC_URL?: string;
  INDEX_TTL_MS?: string;
  OPENAI_APPS_CHALLENGE?: string;
}

const INFO = {
  name: "Rush SR Maintenance MCP",
  version: "0.1.0",
  endpoint: "/mcp",
};

const notFound = () => new Response("Not found", { status: 404 });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      return createMcpHandler(() => createServer(env))(request, env, ctx);
    }
    if (url.pathname === "/") {
      return Response.json(INFO);
    }
    if (url.pathname === "/.well-known/openai-apps-challenge" && env.OPENAI_APPS_CHALLENGE) {
      return new Response(env.OPENAI_APPS_CHALLENGE, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return notFound();
  },
} satisfies ExportedHandler<Env>;
