import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { ActionFunctionArgs } from "react-router";
import * as authSchema from "../../auth/schema";
import { verifyAgentRunToken, type AgentRunTokenPayload } from "../../agents/token";
import type { AgentTool, AgentToolContext } from "../../agents/define";

const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

function rpcError(id: string | number | null, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

export async function loader() {
  return rpcError(null, -32000, "Method not allowed", 405);
}

/**
 * `POST /mcp/agent-run` — the door a running agent calls the app's tools through. The
 * run token says which run, which app user and which tool names it may use; everything
 * else is refused before a handler runs.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  if (request.method !== "POST") return rpcError(null, -32000, "Method not allowed", 405);

  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const payload = env.SCHEDULE_TRIGGER_SECRET
    ? await verifyAgentRunToken(token, env.SCHEDULE_TRIGGER_SECRET)
    : null;
  if (!payload) return rpcError(null, -32001, "Unauthorized", 401);
  if (payload.appId !== env.APP_ID) return Response.json({ error: "token is for another app" }, { status: 403 });

  let req: JsonRpcRequest;
  try {
    req = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  const id = req.id ?? null;
  const ok = (result: unknown) => Response.json({ jsonrpc: "2.0", id, result });

  if (req.method?.startsWith("notifications/")) return new Response(null, { status: 204 });

  // Imported here, not at module scope, so the definitions stay out of the client bundle.
  const { toolByName } = await import("../../agents/registry");
  const allowed = payload.tools
    .map(toolByName)
    .filter((t): t is { agent: string; tool: AgentTool } => t !== null);

  if (req.method === "initialize") {
    const asked = req.params?.protocolVersion;
    return ok({
      protocolVersion: typeof asked === "string" ? asked : PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: `${env.APP_SLUG} agent tools`, version: "1.0.0" },
    });
  }

  if (req.method === "tools/list") {
    return ok({
      tools: allowed.map(({ tool }) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: z.toJSONSchema(tool.input),
      })),
    });
  }

  if (req.method === "tools/call") {
    const params = req.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    if (!params?.name) return rpcError(id, -32602, "Missing tool name");
    const entry = allowed.find((t) => t.tool.name === params.name);
    if (!entry) return Response.json({ error: "tool not allowed for this run" }, { status: 403 });
    const { tool, agent } = entry;

    const args = params.arguments ?? {};
    for (const key of ["run_id", "runId"]) {
      if (key in args && args[key] !== payload.runId) {
        return Response.json({ error: "argument names another run" }, { status: 403 });
      }
    }

    const parsed = tool.input.safeParse(args);
    if (!parsed.success) return ok({ content: [{ type: "text", text: z.prettifyError(parsed.error) }], isError: true });

    const member = await loadMember(env, payload);
    if (!member) return rpcError(id, -32001, "Unauthorized", 401);

    try {
      const run = { id: payload.runId, agent, onBehalfOf: payload.appUserId };
      const result = await tool.handler(parsed.data, { env, run, member });
      return ok({ content: [{ type: "text", text: JSON.stringify(result ?? null) }] });
    } catch (err) {
      // The model still reads a failed call, so it is a result with isError, not a
      // JSON-RPC error; the message may carry internals, so stay generic.
      console.error(`[agents] tool ${tool.name} failed for run ${payload.runId}:`, err);
      return ok({ content: [{ type: "text", text: "The tool failed to run." }], isError: true });
    }
  }

  return rpcError(id, -32601, "Method not found");
}

async function loadMember(env: Env, payload: AgentRunTokenPayload): Promise<AgentToolContext["member"] | null> {
  const db = drizzle(env.DB, { schema: authSchema });
  const [member] = await db
    .select({
      id: authSchema.user.id,
      name: authSchema.user.name,
      email: authSchema.user.email,
      emailVerified: authSchema.user.emailVerified,
      image: authSchema.user.image,
      createdAt: authSchema.user.createdAt,
      updatedAt: authSchema.user.updatedAt,
    })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, payload.appUserId))
    .limit(1);
  return member ?? null;
}
