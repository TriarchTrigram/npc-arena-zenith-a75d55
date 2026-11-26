import type { ActionFunctionArgs } from "react-router";
import { AgentsError, createAgents } from "../../agents/client";
import { MAX_DATA_URL_BYTES, downMessage, type DownMessage, type DownPart } from "../../agents/wire";
import { loadOwnedRun } from "./owned-run";

function bad(error: string, status = 400) {
  return Response.json({ error }, { status });
}

async function dataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

/** A `text` field plus `files` entries; each file rides as a data URL, so it is capped at 1 MB. */
async function fromForm(form: FormData): Promise<DownMessage | Response> {
  const parts: DownPart[] = [];
  const text = form.get("text");
  if (typeof text === "string" && text.trim()) parts.push({ type: "text", text: text.trim() });
  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (entry.size > MAX_DATA_URL_BYTES) return bad(`${entry.name} is over 1 MB`, 413);
    parts.push({ type: "file", url: await dataUrl(entry), mediaType: entry.type || "application/octet-stream", filename: entry.name });
  }
  if (!parts.length) return bad("missing text or files");
  return { id: crypto.randomUUID(), role: "user", parts };
}

/** `{ message }` as a full down message, or `{ text }` for one text part. */
function fromJson(body: unknown): DownMessage | Response {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.text === "string" && b.text.trim()) {
    return { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: b.text.trim() }] };
  }
  const parsed = downMessage.safeParse(b.message);
  if (!parsed.success) return bad("missing message or text");
  if (parsed.data.parts.some((p) => p.type === "data-control")) return bad("control parts are not accepted here");
  for (const p of parsed.data.parts) {
    if (p.type === "file" && p.url.startsWith("data:") && p.url.length > MAX_DATA_URL_BYTES * 1.4) return bad(`${p.filename ?? "a file"} is over 1 MB`, 413);
  }
  return parsed.data;
}

/** `POST /api/agents/runs/:runId/messages|stop` — the app user steering their own run. */
export async function action({ request, context, params }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const command = params.command;
  if (request.method !== "POST" || (command !== "messages" && command !== "stop")) return bad("not found", 404);
  const run = await loadOwnedRun(request, env, params.runId);
  const agents = createAgents(env);

  try {
    if (command === "stop") return Response.json({ run: await agents.stop(run.id) });
    const message = request.headers.get("content-type")?.includes("multipart/form-data")
      ? await fromForm(await request.formData())
      : fromJson(await request.json().catch(() => null));
    if (message instanceof Response) return message;
    return Response.json({ run: await agents.send(run.id, message) });
  } catch (err) {
    if (err instanceof AgentsError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
