/**
 * First-touch sign-up attribution: the campaign tags and outside referrer an app
 * user arrived with, stashed in a cookie on landing and written onto their
 * account at sign-up so Insights can credit the source.
 */

const COOKIE = "stencil_app_attribution";
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer"] as const;
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
// Real values are short; the cap keeps a hostile query string inside the cookie size limit.
const MAX_VALUE_LENGTH = 200;

export type SignupAttribution = Partial<Record<(typeof KEYS)[number], string>>;

// A sign-in provider or hosted checkout sending the visitor back is a return trip, not a source.
const RETURN_TRIP_HOSTS = ["accounts.google.com", "appleid.apple.com", "login.microsoftonline.com"];

function isReturnTrip(host: string): boolean {
  return RETURN_TRIP_HOSTS.includes(host) || host === "stripe.com" || host.endsWith(".stripe.com");
}

function outsideReferrer(): string | null {
  try {
    const referrer = document.referrer;
    if (!referrer) return null;
    const host = new URL(referrer).host;
    if (host === window.location.host || isReturnTrip(host.toLowerCase())) return null;
    return referrer;
  } catch {
    return null;
  }
}

/** Call once on the first client render. First touch wins: an existing stash is
 *  left alone, and a visit with neither campaign tags nor an outside referrer writes nothing. */
export function captureFirstTouch(): void {
  try {
    if (document.cookie.split(/;\s*/).some((c) => c.startsWith(`${COOKIE}=`))) return;
    const params = new URLSearchParams(window.location.search);
    const captured: SignupAttribution = {};
    for (const key of KEYS) {
      const value = key === "referrer" ? outsideReferrer() : params.get(key);
      if (value) captured[key] = value.slice(0, MAX_VALUE_LENGTH);
    }
    if (Object.keys(captured).length === 0) return;
    // SameSite=Lax so the stash survives the Google sign-in and hosted checkout round trips.
    document.cookie =
      `${COOKIE}=${encodeURIComponent(JSON.stringify(captured))}; path=/;` +
      ` max-age=${THIRTY_DAYS_SECONDS}; samesite=lax` +
      (window.location.protocol === "https:" ? "; secure" : "");
  } catch {
    // Lost attribution must never break page load.
  }
}

/** Re-validate attribution from an untrusted source — a cookie, or a value the
 *  platform relays — as the JSON stored on the user row, or null when nothing survives. */
export function sanitizeAttribution(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const result: SignupAttribution = {};
    for (const key of KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && value) result[key] = value.slice(0, MAX_VALUE_LENGTH);
    }
    return Object.keys(result).length > 0 ? JSON.stringify(result) : null;
  } catch {
    return null;
  }
}

/** The stash from a request's cookies, as the JSON stored on the user row, or
 *  null when there is none. */
export function readAttributionCookie(headers: Headers | undefined): string | null {
  const match = headers
    ?.get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return null;
  try {
    return sanitizeAttribution(decodeURIComponent(match.slice(COOKIE.length + 1)));
  } catch {
    return null;
  }
}

/** The Meta pixel's `_fbc` (ad click) and `_fbp` (browser) cookies on a request,
 *  relayed with a checkout so the platform's sale report can name the ad. */
export function readMetaBrowserIds(headers: Headers | undefined): { fbc?: string; fbp?: string } {
  const cookies = headers?.get("cookie")?.split(/;\s*/) ?? [];
  const read = (name: string) => {
    const match = cookies.find((c) => c.startsWith(`${name}=`));
    return match ? match.slice(name.length + 1) || undefined : undefined;
  };
  const fbc = read("_fbc");
  const fbp = read("_fbp");
  return { ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) };
}
