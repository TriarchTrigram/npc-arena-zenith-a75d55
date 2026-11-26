import { createAuth } from "./utils";
import { VERIFY_PATH } from "./sign-in-link";

/** Verify a sign-in link token in-process, on the caller's origin and with their cookies, so the
 *  auth response's cookies belong to the page that asked. A redirect to the callback on success. */
export async function redeemSignInLink(
  request: Request,
  env: Env,
  params: { token?: string | null; callbackURL?: string | null; errorCallbackURL?: string | null },
): Promise<Response> {
  const verify = new URL(VERIFY_PATH, new URL(request.url).origin);
  for (const key of ["token", "callbackURL", "errorCallbackURL"] as const) {
    const value = params[key];
    if (value) verify.searchParams.set(key, value);
  }
  // The form post's cookies and origin travel with the verify call; its body headers do not.
  const headers = new Headers(request.headers);
  headers.delete("content-type");
  headers.delete("content-length");
  const auth = createAuth(env, false, undefined, request);
  return auth.handler(new Request(verify, { headers }));
}
