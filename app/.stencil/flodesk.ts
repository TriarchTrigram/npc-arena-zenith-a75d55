import { BACKEND_BASE, createBackendFetch } from "./backend";
import { isDev } from "./context";
import { limitVisitor } from "./form-guard";

export interface AddToFlodeskParams {
  email: string;
  /** Full name; the platform splits it into Flodesk's first and last name. */
  name?: string | null;
  /** Flodesk segment ids to join on top of the ones saved on the app's Users page. */
  segmentIds?: string[];
  /** The visitor's request, when the email comes from a form: adds are then capped per visitor. */
  request?: Request | null;
  /** The per-visitor cap when `request` is given. Defaults to 3 adds per hour. */
  limit?: { max?: number; windowSeconds?: number };
}

/** Add an email the app collected to the Flodesk segments saved on the app's Users
 *  page, plus any `segmentIds` given, on the same queue and retry as signups.
 *  Skipped in local dev and never throws; resolves false when Flodesk is not set
 *  up for this app. */
export async function addToFlodesk(env: Env, params: AddToFlodeskParams): Promise<boolean> {
  if (isDev(env) || !env.BACKEND_SERVICE) return false;
  try {
    if (params.request && !(await limitVisitor(env, params.request, { name: "stencil-flodesk", kind: "mail", maxBodyBytes: Infinity, ...params.limit })).ok) return false;
    const res = await createBackendFetch(env)(`${BACKEND_BASE}/flodesk/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: params.email,
        name: params.name ?? null,
        segmentIds: params.segmentIds ?? [],
      }),
    });
    if (!res.ok) {
      console.warn("[flodesk] add skipped:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[flodesk] add failed:", err);
    return false;
  }
}
