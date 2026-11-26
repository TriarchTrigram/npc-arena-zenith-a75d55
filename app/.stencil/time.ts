/** Cookie the browser writes with its own IANA zone; the worker prefers it over the connection's. */
export const VIEWER_TIME_ZONE_COOKIE = "stencil_tz";

/** Display-preference writes; never authentication cookies.
 * Refresh the original Lax cookie first so same-site embeds cannot retain a stale
 * unpartitioned value ahead of the partitioned value in the Cookie header.
 * Cross-site HTTPS embeds also need a partitioned cookie; their Lax write is blocked.
 * Top-level and HTTP behavior remains byte-identical to the original preference. */
export function viewerTimeZoneCookies(zone: string, embedded: boolean, secure: boolean): string[] {
  if (!isValidTimeZone(zone)) throw new Error("Invalid viewer timezone");
  const preference = `${VIEWER_TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000`;
  const cookies = [`${preference}; samesite=lax`];
  if (embedded && secure) cookies.push(`${preference}; samesite=none; secure; partitioned`);
  return cookies;
}

export function isValidTimeZone(zone: string | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/**
 * The viewer's IANA timezone for one request: the zone the browser reported in
 * its cookie, else Cloudflare's IP-derived zone, else UTC. Called once per
 * request by the worker entry; loaders read `context.viewerTimeZone`.
 */
export function resolveViewerTimeZone(request: Request): string {
  const fromBrowser = readCookie(request, VIEWER_TIME_ZONE_COOKIE);
  if (isValidTimeZone(fromBrowser)) return fromBrowser;
  const zone = (request as Request & { cf?: { timezone?: string } }).cf
    ?.timezone;
  return isValidTimeZone(zone) ? zone : "UTC";
}

/**
 * The calendar date at `at` in `timeZone`, as `YYYY-MM-DD` — what "today" means
 * to the person in that zone. Pass the loader's clock: `todayInZone(timeZone, nowMs)`.
 */
export function todayInZone(
  timeZone: string,
  at: number | Date = Date.now(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The hour of the day (0–23) at `at` in `timeZone` — for "Good morning" and
 * anything else keyed to the time of day where the viewer is.
 */
export function hourInZone(
  timeZone: string,
  at: number | Date = Date.now(),
): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(at);
  return Number(hour);
}

/** The page's language and every language the app speaks: `useLocale()` in a component, `context` in a loader. */
export type ViewerLocale = { locale: string; locales: string[] };

// The language is never the runtime's own, which differs between the server and the
// browser. It is the page's once the app speaks a second language, else pinned to en-US.
function formatLocale(viewer: ViewerLocale | undefined): string {
  return viewer && viewer.locales.length > 1 ? viewer.locale : "en-US";
}

/**
 * A date formatted in an explicit zone, e.g. "Sep 7, 2026". Pass `locale` to write it
 * in the page's language ("7. Sept. 2026") when the app speaks more than one.
 */
export function formatDateInZone(
  at: number | Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
  locale?: ViewerLocale,
): string {
  return new Intl.DateTimeFormat(formatLocale(locale), {
    timeZone,
    ...(options ?? { month: "short", day: "numeric", year: "numeric" }),
  }).format(at);
}

/**
 * A time of day formatted in an explicit zone, labelled with it by default,
 * e.g. "3:30 PM EDT" — so a time shown to someone in another zone stays readable.
 */
export function formatTimeInZone(
  at: number | Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
  locale?: ViewerLocale,
): string {
  return new Intl.DateTimeFormat(formatLocale(locale), {
    timeZone,
    ...(options ?? {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }),
  }).format(at);
}

/**
 * A date and time together in an explicit zone, e.g. "Sep 7, 2026, 3:30 PM EDT" —
 * the default for a stored timestamp shown to an app user.
 */
export function formatDateTimeInZone(
  at: number | Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
  locale?: ViewerLocale,
): string {
  return new Intl.DateTimeFormat(formatLocale(locale), {
    timeZone,
    ...(options ?? {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }),
  }).format(at);
}

/**
 * A number in the page's language, e.g. "1,234.5", or "1.234,5" on a German page of an
 * app that speaks more than one. `options` covers currency, percent and rounding.
 */
export function formatNumberInLocale(
  value: number,
  locale: ViewerLocale | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(formatLocale(locale), options).format(value);
}
