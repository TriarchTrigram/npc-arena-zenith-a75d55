import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { verifyPlatformBearer } from "../../internal";

const LIST_LIMIT = 1000;

/** The roots the platform may touch, as full bucket keys: run folders and the app's own prefix. */
function roots(env: Env): string[] {
  return ["agent-runs/", `public/${env.APP_ID}/`];
}

/** A clean full key under an allowed root, or null; `prefix` also accepts the root itself. */
function allowedKey(env: Env, raw: string | null, prefix = false): string | null {
  if (!raw) return null;
  const parts = raw.split("/");
  if (parts.some((p) => p === "..") || parts.slice(0, -1).some((p) => !p)) return null;
  const root = roots(env).find((r) => raw.startsWith(r));
  if (!root) return null;
  return prefix || raw.length > root.length ? raw : null;
}

function bad(error: string, status: number) {
  return Response.json({ error }, { status });
}

/**
 * `GET /api/internal/agent-files` — the platform reads the app's bucket: `?key=` streams an
 * object, `?key=&stat=1` answers its size, `?list=<prefix>&cursor=` pages keys under a prefix.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const unauthorized = verifyPlatformBearer(request, env);
  if (unauthorized) return unauthorized;
  const query = new URL(request.url).searchParams;

  if (query.has("list")) {
    const prefix = allowedKey(env, query.get("list"), true);
    if (!prefix) return bad("list prefix is not allowed", 403);
    const page = await env.STORAGE.list({ prefix, limit: LIST_LIMIT, cursor: query.get("cursor") || undefined });
    return Response.json({
      objects: page.objects.map((o: R2Object) => ({ key: o.key, size: o.size })),
      cursor: page.truncated ? page.cursor : null,
    });
  }

  const key = allowedKey(env, query.get("key"));
  if (!key) return bad("key is not allowed", query.get("key") ? 403 : 400);
  if (query.get("stat") === "1") {
    const head = await env.STORAGE.head(key);
    return head ? Response.json({ key, size: head.size }) : bad("not found", 404);
  }
  const object = await env.STORAGE.get(key);
  if (!object) return bad("not found", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

/**
 * `PUT /api/internal/agent-files?key=` writes one object; `POST` with `{ op: "copy", from, to }`
 * duplicates one inside the bucket and `{ op: "delete", keys }` removes several.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const unauthorized = verifyPlatformBearer(request, env);
  if (unauthorized) return unauthorized;

  if (request.method === "PUT") {
    const raw = new URL(request.url).searchParams.get("key");
    const key = allowedKey(env, raw);
    if (!key) return bad("key is not allowed", raw ? 403 : 400);
    const contentType = request.headers.get("content-type");
    const put = await env.STORAGE.put(key, await request.arrayBuffer(), contentType ? { httpMetadata: { contentType } } : undefined);
    return Response.json({ ok: true, key, size: put?.size ?? 0 });
  }
  if (request.method !== "POST") return bad("method not allowed", 405);

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (body.op === "copy") {
    const from = allowedKey(env, typeof body.from === "string" ? body.from : null);
    const to = allowedKey(env, typeof body.to === "string" ? body.to : null);
    if (!from || !to) return bad("from and to must be allowed keys", 403);
    const source = await env.STORAGE.get(from);
    if (!source) return bad("not found", 404);
    const put = await env.STORAGE.put(to, source.body, { httpMetadata: source.httpMetadata });
    return Response.json({ ok: true, size: put?.size ?? source.size });
  }
  if (body.op === "delete") {
    const keys = Array.isArray(body.keys) ? body.keys.map((k) => allowedKey(env, typeof k === "string" ? k : null)) : [];
    if (!keys.length || keys.some((k) => k === null)) return bad("keys must be allowed keys", keys.length ? 403 : 400);
    await env.STORAGE.delete(keys as string[]);
    return Response.json({ ok: true, deleted: keys.length });
  }
  return bad("unknown op", 400);
}
