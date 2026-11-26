import { BACKEND_BASE, createBackendFetch } from "./backend";
import { isDev } from "./context";

export interface JoinWaitlistParams {
  email: string;
  name?: string | null;
  /** Where the person joined from, shown on the Users page (for example `landing-page`). */
  source?: string | null;
  /** The visitor's request, when the join comes from a form; its address feeds the platform's per-visitor limit. */
  request?: Request | null;
}

/** Add an email to the app's one waitlist: the list the app builder sees on the
 *  Users page and invites from, the same one the hosted sign-up page feeds on an
 *  invite-only app. Deduped by address, and synced to the app's Flodesk segments
 *  when Flodesk is connected. Skipped in local dev and never throws; resolves
 *  false when the join failed, so the form can say so. */
export async function joinWaitlist(env: Env, params: JoinWaitlistParams): Promise<boolean> {
  if (isDev(env) || !env.BACKEND_SERVICE) return false;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const ip = params.request?.headers.get("cf-connecting-ip");
    if (ip) headers["cf-connecting-ip"] = ip;
    const res = await createBackendFetch(env)(`${BACKEND_BASE}/waitlist/join`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: params.email,
        name: params.name ?? null,
        source: params.source ?? "app",
      }),
    });
    if (!res.ok) {
      console.error("[waitlist] join refused:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[waitlist] join failed:", err);
    return false;
  }
}
