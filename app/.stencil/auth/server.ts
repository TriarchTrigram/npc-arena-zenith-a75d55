import { forgetPerRequest, memoPerRequest, requestMemo, requestStore } from "../request-context";
import { redirect } from "../http";
import { BACKEND_BASE, createBackendFetch } from "../backend";
import { isDraft } from "../context";
import { APIError } from "better-auth/api";
import { createAuth } from "./utils";

/** The account the App preview is signed in as. It exists in every app's user table. */
export const PREVIEW_USER_EMAIL = "preview@stencil.local";
/** The account the Builder Agent's browser verification signs in as, created on first use. */
export const VERIFY_USER_EMAIL = "verify@stencil.local";
/** The platform's own accounts: both sign in only on the draft slot, through the bypass. */
export const PLATFORM_USER_EMAILS: readonly string[] = [PREVIEW_USER_EMAIL, VERIFY_USER_EMAIL];

/** Whether `user` is the preview user (or the verify user), seen from the App preview. True
 *  only on the draft slot, so an admin or owner gate keyed on it opens in the preview and
 *  nowhere else; prefer it to seeding the preview user into role data the published app reads. */
export function isPreviewUser(user: { email: string }, env: Env): boolean {
  return isDraft(env) && PLATFORM_USER_EMAILS.includes(user.email);
}

/** The role a platform account is seen as on the App preview, set by the bypass from the sign-in token. */
export const PREVIEW_ROLE_COOKIE = "stencil_preview_role";
/** A role name as the Stencil Users page accepts it; the mint route refuses anything else. */
export const PREVIEW_ROLE_PATTERN = /^[A-Za-z0-9 _-]{1,40}$/;
const PREVIEW_ROLE = Symbol("preview-role");

/** The role the Builder Agent's check asked to be seen as, read from the cookie by the session read of
 *  this fetch; undefined when it asked for none. `getRole` consults it for a platform account only. */
export function previewRole(): Promise<string | undefined> {
  return memoPerRequest(PREVIEW_ROLE, async () => undefined);
}

function roleCookie(header: string | null): string | undefined {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${PREVIEW_ROLE_COOKIE}=([^;]*)`));
  if (!match) return undefined;
  try {
    const role = decodeURIComponent(match[1]);
    return PREVIEW_ROLE_PATTERN.test(role) ? role : undefined;
  } catch {
    return undefined;
  }
}

// One session read per fetch: the root loader, requireAuth and the platform helpers
// (getSubscription, requireRole, …) all ask for it, and each read is a database round trip.
const SESSION = Symbol("session");
// Outside the worker no memo store is open, so a read is shared per Request object instead.
const perRequest = new WeakMap<Request, Promise<Awaited<ReturnType<typeof readSession>>>>();

/**
 * Get the current session without redirecting. Returns null if unauthenticated.
 * Inside the worker this is one read per fetch; `request` is read by the first call only.
 *
 * Use this in the root loader to make session data available to useOptionalAuthUser().
 */
export async function getSession(request: Request, env: Env) {
  if (requestMemo.getStore()) return memoPerRequest(SESSION, () => readSession(request, env));
  let pending = perRequest.get(request);
  if (!pending) {
    pending = readSession(request, env);
    perRequest.set(request, pending);
  }
  return pending;
}

/**
 * Drop the memoised session so the next read in this fetch hits the database. An action that
 * updates the signed-in app user's row and returns data calls it first, or a document post's
 * loaders (same fetch) render the row from before the update.
 */
export function forgetSession(): void {
  forgetPerRequest(SESSION);
}

// Better Auth slides a session's expiry on a read once a day and answers with a refreshed
// cookie. The worker opens a jar per request and appends whatever a session read drops in
// it to the response, so the browser's copy slides along with the row.
export const sessionCookies = requestStore<string[]>();

async function readSession(request: Request, env: Env) {
  const auth = createAuth(env, false, undefined, request);
  const read = () => auth.api.getSession({ headers: request.headers, returnHeaders: true });
  // A database error on the session read is usually gone a moment later, so it gets one
  // more try; a 4xx is Better Auth's own answer and is never retried.
  const { headers, response: result } = await read().catch(async (err) => {
    if (err instanceof APIError && err.statusCode >= 400 && err.statusCode < 500) throw err;
    console.error("[auth] session read failed, retrying once:", err);
    await new Promise((resolve) => setTimeout(resolve, 150));
    return read();
  });
  const jar = sessionCookies.getStore();
  if (jar) jar.push(...headers.getSetCookie());
  // The platform's users are signed out everywhere but the draft slot, so no gate
  // an app writes for them can open on the published app.
  if (result && !isDraft(env) && PLATFORM_USER_EMAILS.includes(result.user.email)) return null;
  if (result && isPreviewUser(result.user, env)) {
    const role = roleCookie(request.headers.get("cookie"));
    forgetPerRequest(PREVIEW_ROLE);
    void memoPerRequest(PREVIEW_ROLE, async () => role);
  }
  return result;
}

/**
 * Confine a caller-supplied redirect target to this app's own origin. The value
 * is resolved by the URL parser and rejected unless it stays same-origin, which
 * catches absolute, protocol-relative (//host) and backslash forms a string test misses.
 */
export function safeReturnTo(
  raw: string | null | undefined,
  fallback = "/app",
): string {
  if (!raw) return fallback;
  const base = "https://app.invalid";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  // A dot segment can normalise to a `//host` path (`/.//evil`), which a redirect reads as another host.
  if (url.pathname.startsWith("//")) return fallback;
  return url.pathname + url.search + url.hash;
}

/** The relative callback the sign-in library accepts: its trusted-origin check runs this
 *  pattern on the decoded value, so `#`, `~`, `:` or a `%`-escape in the path all fail it. */
const LIBRARY_SAFE_CALLBACK = /^\/(?!\/|\\|%2f|%5c)[\w\-.\+/@]*(?:\?[\w\-.\+/=&%@]*)?$/;

/** Served by the dispatcher: unwraps a callback `authCallbackUrl` wrapped and redirects. */
export const AUTH_RETURN_PATH = "/auth/return";

/**
 * A callback the sign-in library accepts for a `safeReturnTo` address: one outside its pattern
 * travels base64url-encoded through {@link AUTH_RETURN_PATH}, which survives the library's extra
 * decoding. Twin of `authCallbackUrl` in `shared/safe-return-to.ts` — keep them identical.
 */
export function authCallbackUrl(returnTo: string): string {
  if (LIBRARY_SAFE_CALLBACK.test(returnTo)) return returnTo;
  const bytes = new TextEncoder().encode(returnTo);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${AUTH_RETURN_PATH}?to=${b64}`;
}

/**
 * Require an authenticated session. Redirects to /login if unauthenticated.
 *
 * Usage in any route loader:
 *   const { user, session } = await requireAuth(request, context.cloudflare.env);
 */
export async function requireAuth(request: Request, env: Env) {
  const result = await getSession(request, env);
  if (!result) {
    const url = new URL(request.url);
    const returnTo = url.pathname + url.search;
    throw redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return result;
}

/**
 * End the current session from server code and redirect to `redirectTo`: a POST
 * replayed to Better Auth's sign-out deletes the session row and clears the cookie.
 * Throws the redirect, so call it last in an action (as `/logout` does).
 */
export async function signOut(request: Request, env: Env, redirectTo = "/"): Promise<never> {
  const auth = createAuth(env, false, undefined, request);
  // The replay has no body, so the incoming body headers must not travel with it.
  const headers = new Headers(request.headers);
  headers.delete("content-type");
  headers.delete("content-length");
  const res = await auth.handler(
    new Request(new URL("/api/auth/sign-out", request.url), { method: "POST", headers }),
  );

  const outHeaders = new Headers({ Location: redirectTo });
  for (const cookie of res.headers.getSetCookie()) outHeaders.append("set-cookie", cookie);
  // An action that catches this redirect must not read the session that just ended.
  forgetPerRequest(SESSION);
  throw new Response(null, { status: 302, headers: outHeaders });
}

/** Why the platform left the account intact. `active_subscription`: it would charge again. */
export type CloseAccountError = { error: string; code?: "active_subscription" };

/**
 * Close the signed-in app user's own account: the platform deletes it and every session,
 * then the browser is signed out and redirected. Billing is never touched — a subscription
 * that will charge again returns `{ error, code: "active_subscription" }` and nothing changes.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     return closeAccount(request, context.cloudflare.env);
 *   }
 */
export async function closeAccount(
  request: Request,
  env: Env,
  redirectTo = "/",
): Promise<CloseAccountError> {
  const { user } = await requireAuth(request, env);
  let res: Response;
  try {
    res = await createBackendFetch(env)(`${BACKEND_BASE}/users/close-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
  } catch (err) {
    console.error("[closeAccount] transport error", String(err));
    return { error: "We couldn't reach the service that closes accounts. Please try again." };
  }
  if (!res.ok) {
    const body = await res.json<CloseAccountError>().catch(() => ({}) as Partial<CloseAccountError>);
    return {
      error: body.error ?? "Your account could not be closed. Please try again.",
      ...(body.code === "active_subscription" ? { code: body.code } : {}),
    };
  }
  return signOut(request, env, redirectTo);
}
