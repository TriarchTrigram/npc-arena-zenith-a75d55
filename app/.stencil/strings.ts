import bundledStrings from "~/strings/strings.json";
import { readCookie } from "./time";

// Mirror of shared/app-languages.ts, which this layer cannot import. The dispatcher
// stamps both headers on every request and leaves both off a one-language app.
const DEFAULT_LOCALE_HEADER = "x-stencil-default-locale";
const LOCALES_HEADER = "x-stencil-locales";
export const LOCALE_COOKIE = "stencil_locale";

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

// Only a tag shaped like a language (`es`, `pt-br`) may name a strings document: the
// locale is part of the storage key, and a stray value such as `draft` would read
// the App preview's unpublished copy on the Published app.
const LANGUAGE_TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;

/** `value` as a lower-cased language tag, or undefined when it is not one. */
function languageTag(value: string | null | undefined): string | undefined {
  const tag = value?.trim().toLowerCase();
  return tag && LANGUAGE_TAG.test(tag) ? tag : undefined;
}

export function textDirection(locale: string): "ltr" | "rtl" {
  return RTL_LANGUAGES.has(locale.split("-")[0].toLowerCase()) ? "rtl" : "ltr";
}

/** The request's `Accept-Language` tags, most wanted first, lower-cased. */
function acceptedLanguages(request: Request): string[] {
  const header = request.headers.get("accept-language");
  if (!header) return [];
  return header
    .split(",")
    .map((part, order) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))?.slice(2);
      return { tag: tag.trim().toLowerCase(), q: q === undefined ? 1 : Number(q) || 0, order };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q || a.order - b.order)
    .map((x) => x.tag);
}

/** `wanted` as one of `available`: the same tag, else the same language (`es-mx` → `es`). */
function matchLocale(wanted: string, available: string[]): string | undefined {
  if (available.includes(wanted)) return wanted;
  const language = wanted.split("-")[0];
  return available.find((a) => a.split("-")[0] === language);
}

export type AppLocales = { defaultLocale: string; locales: string[] };

/** The languages the app speaks, default first; only the default when it has one language. */
export function appLocales(request: Request): AppLocales {
  const defaultLocale = languageTag(request.headers.get(DEFAULT_LOCALE_HEADER)) ?? "en";
  const extra = (request.headers.get(LOCALES_HEADER) ?? "")
    .split(",")
    .map(languageTag)
    .filter((tag): tag is string => tag !== undefined && tag !== defaultLocale);
  return { defaultLocale, locales: [defaultLocale, ...extra] };
}

/** `value` as one of `locales` (the same tag, else the same language), or undefined. */
export function pickLocale(value: string | null | undefined, locales: string[]): string | undefined {
  const tag = languageTag(value);
  return tag ? matchLocale(tag, locales) : undefined;
}

/**
 * The language this request reads. An app with no second language resolves straight to
 * its default: no stored choice, no cookie, no `Accept-Language`. Otherwise the signed-in
 * app user's `stored` choice wins, then the `stencil_locale` cookie, then the best
 * `Accept-Language` match, then the default; it sits last so every earlier choice is honoured.
 */
export function resolveLocale(request: Request, stored?: string | null): AppLocales & { locale: string } {
  const app = appLocales(request);
  const { defaultLocale, locales } = app;
  if (locales.length === 1) return { ...app, locale: defaultLocale };
  const locale =
    pickLocale(stored, locales) ||
    pickLocale(readCookie(request, LOCALE_COOKIE), locales) ||
    acceptedLanguages(request)
      .map((tag) => matchLocale(tag, locales))
      .find(Boolean) ||
    defaultLocale;
  return { ...app, locale };
}


const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** `base` with every key `over` has, so a key the translation lacks keeps its default copy. */
function mergeStrings(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    out[key] = isRecord(value) && isRecord(current) ? mergeStrings(current, value) : value;
  }
  return out;
}

// Published strings change only on publish, which deploys a new script version and
// so recycles this isolate; the TTL covers the window where a fresh isolate reads
// the object just before the publish promotes the draft copy over it.
const CACHE_TTL_MS = 60_000;
type Cached = { strings: Record<string, unknown> | null; expiresAt: number };
const cached = new Map<string, Cached>();
const warnedMissing = new Set<string>();

type StringsEnv = { STORAGE: R2Bucket; IS_DRAFT?: string; APP_ID?: string };

/** One strings document: the default language's (bundled copy as the floor), or a
 *  translation's, which is null while the app has no document for that language. */
async function readStringsDocument(env: StringsEnv, locale: string | undefined): Promise<Record<string, unknown> | null> {
  const isDraft = env.IS_DRAFT === "true";
  const key = `__stencil/strings${locale ? `.${locale}` : ""}${isDraft ? ".draft" : ""}.json`;
  const cacheKey = `${env.APP_ID}:${key}`;
  // Draft strings are edited live between builds (copy editing), so the draft
  // slot always reads from storage.
  const hit = cached.get(cacheKey);
  if (!isDraft && hit && hit.expiresAt > Date.now()) return hit.strings;
  let strings: Record<string, unknown> | null;
  try {
    const obj = await env.STORAGE.get(key);
    const stored: Record<string, unknown> | null = obj ? await obj.json() : null;
    // R2 is the live source, laid over the strings baked into the bundle: a key the
    // stored default document lacks (a failed strings push, a publish whose copy has
    // not landed yet) still renders the shipped text instead of blank.
    strings = locale ? stored : stored ? mergeStrings(bundledStrings, stored) : bundledStrings;
    if (strings === null && !warnedMissing.has(cacheKey)) {
      warnedMissing.add(cacheKey);
      console.warn(`[strings] no ${key} for app ${env.APP_ID}; serving the default language`);
    }
  } catch (err) {
    // A storage outage must not take the page down: serve the last copy this isolate
    // read, else the bundled copy, and read storage again on the next uncached call.
    console.error(`[strings] storage read failed (${key}), serving fallback copy:`, err);
    strings = hit ? hit.strings : locale ? null : bundledStrings;
  }
  if (!isDraft) cached.set(cacheKey, { strings, expiresAt: Date.now() + CACHE_TTL_MS });
  return strings;
}

/** The app's copy for `locale`: its translation laid over the default language's document,
 *  so a key missing from the translation still renders. No `locale` reads the default alone. */
export async function loadStringsFromStorage(env: StringsEnv, locale?: string): Promise<Record<string, unknown>> {
  const [base, translated] = await Promise.all([
    readStringsDocument(env, undefined),
    locale ? readStringsDocument(env, locale) : null,
  ]);
  return translated ? mergeStrings(base ?? bundledStrings, translated) : (base ?? bundledStrings);
}
