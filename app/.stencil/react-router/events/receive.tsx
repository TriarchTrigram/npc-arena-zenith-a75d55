import type { ActionFunctionArgs } from "react-router";
import { handlersFor, type StencilEvent } from "../../events";
import { verifyPlatformBearer } from "../../internal";

const PROCESSED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let tableEnsured = false;

async function ensureProcessedEventsTable(env: Env): Promise<void> {
  if (tableEnsured) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS processed_events (id TEXT PRIMARY KEY, processed_at INTEGER NOT NULL)",
  ).run();
  tableEnsured = true;
}

function parseEnvelope(body: unknown): StencilEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== "string" || typeof b.type !== "string") return null;
  if (typeof b.app_id !== "string" || typeof b.created_at !== "string") return null;
  if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) return null;
  return b as StencilEvent;
}

/** `POST /api/internal/events` — the platform delivers one event per request and
 *  retries on a non-2xx, so an id is recorded only after every handler finished. */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const unauthorized = verifyPlatformBearer(request, env);
  if (unauthorized) return unauthorized;

  const event = parseEnvelope(await request.json().catch(() => null));
  if (!event) return Response.json({ error: "invalid event envelope" }, { status: 400 });

  await ensureProcessedEventsTable(env);
  const seen = await env.DB.prepare("SELECT 1 FROM processed_events WHERE id = ?")
    .bind(event.id)
    .first();
  if (seen) return Response.json({ ok: true, duplicate: true });

  // Imported here, not at module scope: the app's `on()` calls register as it
  // evaluates, and only an import inside a server export is kept out of the
  // client bundle, so handlers may use `.server` modules.
  await import("~/events");

  const handlers = handlersFor(event.type);
  try {
    for (const handler of handlers) await handler(event, env);
  } catch (err) {
    console.error(`[events] handler for ${event.type} failed:`, err);
    return Response.json({ ok: false, error: "handler failed" }, { status: 500 });
  }

  const now = Date.now();
  await env.DB.prepare("INSERT OR IGNORE INTO processed_events (id, processed_at) VALUES (?, ?)")
    .bind(event.id, now)
    .run();
  if (Math.random() < 0.02) {
    await env.DB.prepare("DELETE FROM processed_events WHERE processed_at < ?")
      .bind(now - PROCESSED_TTL_MS)
      .run();
  }

  return Response.json({ ok: true, handled: handlers.length });
}
