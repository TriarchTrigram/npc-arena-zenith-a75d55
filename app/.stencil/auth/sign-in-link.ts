/** The landing page a sign-in link opens; only its Continue button verifies the token. */
export const SIGN_IN_LINK_PATH = "/sign-in/link";

export const VERIFY_PATH = "/api/auth/magic-link/verify";

/** Build the landing-page URL for a magic-link token. A one-time token must not be
 *  consumed by a GET, because chat apps and mail scanners fetch links for previews. */
export function signInLinkUrl(
  origin: string,
  token: string,
  callbackURL: string | null,
  errorCallbackURL: string | null,
): string {
  const url = new URL(SIGN_IN_LINK_PATH, origin);
  url.searchParams.set("token", token);
  if (callbackURL) url.searchParams.set("callbackURL", callbackURL);
  if (errorCallbackURL) url.searchParams.set("errorCallbackURL", errorCallbackURL);
  return url.toString();
}

/** Rewrite the verify URL Better Auth mints onto the landing page, same origin. */
export function toSignInLink(verifyUrl: string): string {
  const url = new URL(verifyUrl);
  if (url.pathname !== VERIFY_PATH) return verifyUrl;
  const token = url.searchParams.get("token");
  if (!token) return verifyUrl;
  return signInLinkUrl(
    url.origin,
    token,
    url.searchParams.get("callbackURL"),
    url.searchParams.get("errorCallbackURL"),
  );
}
