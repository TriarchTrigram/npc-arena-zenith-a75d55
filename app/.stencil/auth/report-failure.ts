/** Faults in the app's own sign-in setup that Better Auth answers without a
 *  log line of its own. An app user's mistakes (a wrong password, an unverified
 *  email, an expired link) are not errors of the app. */
const SETUP_FAULT_CODES: ReadonlySet<string> = new Set([
  "INVALID_OAUTH_CONFIGURATION",
  "TOKEN_URL_NOT_FOUND",
  "FAILED_TO_CREATE_USER",
  "FAILED_TO_UPDATE_USER",
  "FAILED_TO_CREATE_VERIFICATION",
]);

/** Refusals Better Auth logs itself (`ERROR [Better Auth]: …`) before it throws,
 *  keyed by route: the same code thrown elsewhere (sign-up, email verification,
 *  two-factor, change-password) has no line of its own and is not skipped. */
const LOGGED_BY_BETTER_AUTH: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["/sign-in/social", new Set(["PROVIDER_NOT_FOUND", "FAILED_TO_GET_USER_INFO"])],
  ["/link-social", new Set(["PROVIDER_NOT_FOUND", "FAILED_TO_GET_USER_INFO"])],
  ["/sign-in/email", new Set(["FAILED_TO_CREATE_SESSION"])],
  ["/get-session", new Set(["FAILED_TO_GET_SESSION"])],
]);

/** Logs an auth request the app itself could not complete, so it reaches the
 *  app's Errors feed: any 500, plus the setup faults above. Reads the finished
 *  response, the one place every refusal shows up. */
export async function reportAuthFailure(request: Request, response: Response): Promise<void> {
  if (response.status < 400) return;
  // Bodyless, so the library threw past its endpoints and reportUncaughtAuthError
  // already logged it with the error itself.
  if (!response.headers.get("content-type")?.includes("application/json")) return;

  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { code?: string; message?: string } | null;
  const code = body?.code;
  if (response.status < 500 && !(code && SETUP_FAULT_CODES.has(code))) return;

  const path = new URL(request.url).pathname;
  for (const [route, codes] of LOGGED_BY_BETTER_AUTH) {
    if (code && codes.has(code) && path.endsWith(route)) return;
  }

  console.error(
    `[auth] request failed (${response.status}${code ? ` ${code}` : ""}) on ${path}: ` +
      `${body?.message ?? response.statusText}`,
  );
}

/** Errors that escape Better Auth's endpoints. Never an expected refusal: the
 *  library turns those into a response before they can leave the router. */
export function reportUncaughtAuthError(error: unknown): void {
  console.error("[auth] request failed:", error);
}
