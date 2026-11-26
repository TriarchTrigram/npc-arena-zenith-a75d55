import { BACKEND_BASE, createBackendFetch } from "./backend";
import { isDev } from "./context";
import { limitVisitor } from "./form-guard";

export interface AddToMailingListParams {
  /** The mailing list service's id, as the app's Users page names it (for example "kit"). */
  service: string;
  email: string;
  /** Full name; a service that keeps a first name only gets the first word. */
  name?: string | null;
  /** Destination ids on the service (Kit tags, for one) to join on top of the ones saved on the app's Users page. */
  destinationIds?: string[];
  /** The visitor's request, when the email comes from a form: adds are then capped per visitor. */
  request?: Request | null;
  /** The per-visitor cap when `request` is given. Defaults to 3 adds per hour. */
  limit?: { max?: number; windowSeconds?: number };
}

/** Add an email the app collected to the destinations saved for the service on the app's
 *  Users page, plus any `destinationIds` given, on the same queue and retry as signups.
 *  Skipped in local dev and never throws; resolves false when the service is not set up
 *  for this app. */
export async function addToMailingList(env: Env, params: AddToMailingListParams): Promise<boolean> {
  if (isDev(env) || !env.BACKEND_SERVICE) return false;
  try {
    if (params.request && !(await limitVisitor(env, params.request, { name: `stencil-mailing-list-${params.service}`, kind: "mail", maxBodyBytes: Infinity, ...params.limit })).ok) return false;
    const res = await createBackendFetch(env)(`${BACKEND_BASE}/mailing-list/${encodeURIComponent(params.service)}/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: params.email,
        name: params.name ?? null,
        destinationIds: params.destinationIds ?? [],
      }),
    });
    if (!res.ok) {
      console.warn("[mailing-list] add skipped:", params.service, res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mailing-list] add failed:", params.service, err);
    return false;
  }
}
