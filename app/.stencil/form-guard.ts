/**
 * Spam protection for anything a signed-out visitor can post or trigger: a per-visitor cap
 * on how often and how much, and for a form a hidden field only bots fill plus a signed
 * token only a loaded page holds.
 */

import { authConfig } from "./auth/utils";
import { isDev, isDraft } from "./context";

const DEFAULT_MAX = 5;
const DEFAULT_WINDOW_SECONDS = 10 * 60;
// A stranger repeating one of these costs more than a form post does, so each kind of
// use has a tighter cap than the default.
const KIND_CAPS = {
  mail: { max: 3, windowSeconds: 60 * 60 },
  paid: { max: 10, windowSeconds: 60 * 60 },
  spot: { max: 3, windowSeconds: 60 * 60 },
} as const;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
// A visitor's bytes per window, counted in posts of the biggest size the route takes.
const WINDOW_BODIES = 4;
const TOKEN_TTL_SECONDS = 24 * 60 * 60;
// A person needs longer than this to fill a form in; a script that posts on load does not.
const MIN_FILL_SECONDS = 2;
const REFUSAL_DAYS_KEPT = 90;
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

// The two hidden fields `<FormGuard>` renders: one no person fills, one carrying the token.
const TRAP_FIELD = "form_note";
const TOKEN_FIELD = "form_guard_token";

/** `max` and `windowSeconds` are the route's own numbers: what the app builder set for
 *  `name` in the app's settings wins over them. */
export interface LimitVisitorOptions {
  /** What is being limited, e.g. `"contact"` or `"plan-preview"`: lowercase letters, digits, `-` and `_`. */
  name: string;
  /** What one use does, when it is costly: `"mail"` sends an email or a text or adds to a
   *  mailing list, `"paid"` runs AI or another service billed per use, `"spot"` claims a
   *  seat, a slot or a name nobody else can then have. Each has a stricter default cap. */
  kind?: keyof typeof KIND_CAPS;
  /** Uses one visitor is allowed in one window. Defaults to 5, or to the `kind`'s cap. */
  max?: number;
  /** Seconds until a full budget returns. Defaults to 10 minutes, or to the `kind`'s window. */
  windowSeconds?: number;
  /** The biggest request body one use may carry, in bytes. Defaults to 1 MB. */
  maxBodyBytes?: number;
  /** The biggest single file in a posted form, in bytes. Defaults to `maxBodyBytes`. */
  maxFileBytes?: number;
  /** Bytes one visitor may send in one window. Defaults to four times `maxBodyBytes`. */
  maxWindowBytes?: number;
}

export type FormGuardResult =
  | { ok: true }
  /** The hidden field was filled: certainly a bot. */
  | { ok: false; reason: "bot" }
  /** No valid token: missing, expired, too fresh or not this form's. A real person can
   *  land here (a slow page, a form left open for days), so never answer as a success. */
  | { ok: false; reason: "unverified" }
  | { ok: false; reason: "too_many"; retryAfterSeconds: number }
  /** The body, or one file in it, is over the cap of `maxBytes`. Sending it again cannot help. */
  | { ok: false; reason: "too_large"; maxBytes: number }
  /** The app builder switched this form or route off in the app's settings. */
  | { ok: false; reason: "closed" }
  /** The count could not be kept. Refuse and ask the visitor to try again shortly. */
  | { ok: false; reason: "unavailable" };

const DDL = [
  "CREATE TABLE IF NOT EXISTS `stencil_form_guard` (`scope` text PRIMARY KEY NOT NULL, `uses` integer NOT NULL, `resets_at` integer NOT NULL);",
  "CREATE INDEX IF NOT EXISTS `stencil_form_guard_resets_at` ON `stencil_form_guard` (`resets_at`);",
  "CREATE TABLE IF NOT EXISTS `stencil_form_guard_refusal` (`day` text NOT NULL, `name` text NOT NULL, `reason` text NOT NULL, `refusals` integer NOT NULL, PRIMARY KEY (`day`, `name`, `reason`));",
  // One row per limit: the route's own numbers, and what the app builder set over them.
  "CREATE TABLE IF NOT EXISTS `stencil_form_guard_limit` (`name` text PRIMARY KEY NOT NULL, `max` integer NOT NULL, `window_seconds` integer NOT NULL, `set_max` integer, `set_window_seconds` integer, `closed` integer NOT NULL DEFAULT 0);",
];

let ensured = false;

async function ensureTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.batch(DDL.map((sql) => env.DB.prepare(sql)));
  ensured = true;
}

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

// A labelled subkey, so nothing signed here can ever verify as a session or an access code.
async function sign(env: Env, data: string): Promise<string> {
  const subkey = await hmac(encoder.encode(authConfig.betterAuthSecret(env)), "stencil.form-guard.v1");
  return hex(await hmac(subkey, data));
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Whether `name` can name a guarded form or limit. */
export function isGuardName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

function requireName(name: string, fn: string): void {
  if (!isGuardName(name)) throw new Error(`${fn} needs a name of lowercase letters, digits, "-" or "_" (got "${name}").`);
}

/** Add `amount` (one use, or a body's bytes) to `scope` in one statement, so uses sent at
 *  once are all counted and the count is the same in every copy of the app. Returns the
 *  seconds until the window reopens, or 0 when this use may proceed. */
async function countUse(env: Env, scope: string, max: number, windowSeconds: number, amount = 1): Promise<number> {
  await ensureTable(env);
  const now = nowSeconds();
  const [, counted] = await env.DB.batch<{ uses: number; resets_at: number }>([
    env.DB.prepare("DELETE FROM `stencil_form_guard` WHERE `resets_at` <= ?").bind(now),
    env.DB.prepare(
      "INSERT INTO `stencil_form_guard` (`scope`, `uses`, `resets_at`) VALUES (?, ?, ?) " +
        "ON CONFLICT(`scope`) DO UPDATE SET `uses` = `uses` + excluded.`uses` RETURNING `uses`, `resets_at`",
    ).bind(scope, amount, now + windowSeconds),
  ]);
  const row = counted?.results[0];
  if (!row) throw new Error(`form guard count for ${scope} returned no row`);
  return row.uses <= max ? 0 : Math.max(1, row.resets_at - now);
}

interface Limit {
  max: number;
  windowSeconds: number;
  closed: boolean;
}

/** The limit in force for `options.name`: the app builder's numbers and off switch when set,
 *  else the route's own. The route's numbers are stored, so the app's settings can list the limit. */
async function limitFor(env: Env, options: LimitVisitorOptions): Promise<Limit> {
  await ensureTable(env);
  const kind = options.kind ? KIND_CAPS[options.kind] : undefined;
  const max = options.max ?? kind?.max ?? DEFAULT_MAX;
  const windowSeconds = options.windowSeconds ?? kind?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const row = await env.DB.prepare(
    "SELECT `max`, `window_seconds`, `set_max`, `set_window_seconds`, `closed` FROM `stencil_form_guard_limit` WHERE `name` = ?",
  )
    .bind(options.name)
    .first<{ max: number; window_seconds: number; set_max: number | null; set_window_seconds: number | null; closed: number }>();
  if (!row || row.max !== max || row.window_seconds !== windowSeconds) {
    await env.DB.prepare(
      "INSERT INTO `stencil_form_guard_limit` (`name`, `max`, `window_seconds`) VALUES (?, ?, ?) " +
        "ON CONFLICT(`name`) DO UPDATE SET `max` = excluded.`max`, `window_seconds` = excluded.`window_seconds`",
    )
      .bind(options.name, max, windowSeconds)
      .run();
  }
  return { max: row?.set_max ?? max, windowSeconds: row?.set_window_seconds ?? windowSeconds, closed: row?.closed === 1 };
}

type Refusal = Exclude<FormGuardResult, { ok: true }>;

/** Return `refusal` after adding it to the day's count for `name` (UTC day, kept 90 days).
 *  Only the Published app is counted, and only as a number: no visitor, nothing posted.
 *  A count that cannot be written is logged and never changes the answer. */
async function refuse(env: Env, name: string, refusal: Refusal): Promise<Refusal> {
  if (isDraft(env)) return refusal;
  try {
    await ensureTable(env);
    const now = Date.now();
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM `stencil_form_guard_refusal` WHERE `day` < ?").bind(day(now - REFUSAL_DAYS_KEPT * 86_400_000)),
      env.DB.prepare(
        "INSERT INTO `stencil_form_guard_refusal` (`day`, `name`, `reason`, `refusals`) VALUES (?, ?, ?, 1) " +
          "ON CONFLICT(`day`, `name`, `reason`) DO UPDATE SET `refusals` = `refusals` + 1",
      ).bind(day(now), name, refusal.reason),
    ]);
  } catch (err) {
    console.warn(`[form-guard] could not record a "${refusal.reason}" refusal for "${name}":`, err);
  }
  return refusal;
}

// The body size the request declared: 0 with no body, null with a body of undeclared size.
function declaredBytes(request: Request): number | null {
  const header = request.headers.get("content-length");
  if (header !== null && /^\d+$/.test(header)) return Number(header);
  return request.body ? null : 0;
}

// The size of a body that declared none (a chunked post), read from a copy so the route
// can still read the body. Past `cap`, or with the body already read, it is Infinity.
async function measuredBytes(request: Request, cap: number): Promise<number> {
  const copy = request.bodyUsed ? null : request.clone().body;
  if (!copy) return Infinity;
  const reader = copy.getReader();
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return bytes;
    bytes += value.byteLength;
    if (bytes > cap) {
      await reader.cancel();
      return Infinity;
    }
  }
}

/** Refuse a body of `bytes` over the route's cap, then count the use and the bytes against
 *  the visitor within `limit`. Nothing is counted for a body that is too large. */
async function countVisitor(env: Env, request: Request, options: LimitVisitorOptions, limit: Limit, bytes: number): Promise<FormGuardResult> {
  const { name } = options;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const maxWindowBytes = options.maxWindowBytes ?? WINDOW_BODIES * maxBodyBytes;
  if (bytes > maxBodyBytes) return refuse(env, name, { ok: false, reason: "too_large", maxBytes: maxBodyBytes });
  // Only cf-connecting-ip: Cloudflare sets it and strips client-supplied copies.
  const visitor = (await sign(env, `visitor\n${request.headers.get("cf-connecting-ip") ?? "unknown"}`)).slice(0, 32);
  let retryAfterSeconds = await countUse(env, `visitor:${name}:${visitor}`, limit.max, limit.windowSeconds);
  if (retryAfterSeconds === 0 && bytes > 0 && Number.isFinite(bytes) && Number.isFinite(maxWindowBytes)) {
    retryAfterSeconds = await countUse(env, `bytes:${name}:${visitor}`, maxWindowBytes, limit.windowSeconds, bytes);
  }
  return retryAfterSeconds > 0 ? refuse(env, name, { ok: false, reason: "too_many", retryAfterSeconds }) : { ok: true };
}

/** Count one use of `name` by the visitor behind `request` (the address Cloudflare saw, kept
 *  as a keyed fingerprint) against the caps on count and size. Call it first, before the
 *  route reads the body: a body that declares no size is measured. Not counted in local dev. */
export async function limitVisitor(env: Env, request: Request, options: LimitVisitorOptions): Promise<FormGuardResult> {
  requireName(options.name, "limitVisitor");
  if (isDev(env)) return { ok: true };
  const bytes = declaredBytes(request) ?? (await measuredBytes(request, options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES));
  try {
    const limit = await limitFor(env, options);
    if (limit.closed) return await refuse(env, options.name, { ok: false, reason: "closed" });
    return await countVisitor(env, request, options, limit, bytes);
  } catch (err) {
    console.error(`[form-guard] could not count a visitor for "${options.name}", refusing the request:`, err);
    return refuse(env, options.name, { ok: false, reason: "unavailable" });
  }
}

/** A signed token for the form called `form`, good for a day. `<FormGuard>` fetches one
 *  from the form-guard route pack; app code rarely calls this itself. */
export async function issueFormToken(env: Env, form: string): Promise<string> {
  requireName(form, "issueFormToken");
  const issuedAt = nowSeconds();
  const nonce = crypto.randomUUID();
  return `${issuedAt}.${nonce}.${await sign(env, `token\n${form}\n${issuedAt}\n${nonce}`)}`;
}

async function tokenNonce(env: Env, form: string, token: string): Promise<string | null> {
  const [issued, nonce, signature, ...rest] = token.split(".");
  if (!issued || !nonce || !signature || rest.length > 0 || !/^\d+$/.test(issued)) return null;
  const age = nowSeconds() - Number(issued);
  if (age < MIN_FILL_SECONDS || age > TOKEN_TTL_SECONDS) return null;
  return sameText(signature, await sign(env, `token\n${form}\n${issued}\n${nonce}`)) ? nonce : null;
}

function field(fields: FormData | Record<string, unknown>, name: string): string {
  const value = fields instanceof FormData ? fields.get(name) : fields[name];
  return typeof value === "string" ? value : "";
}

// What a parsed post holds: the bytes of all its fields, and of its biggest file.
function measure(fields: FormData | Record<string, unknown>): { bytes: number; largestFile: number } {
  if (!(fields instanceof FormData)) return { bytes: encoder.encode(JSON.stringify(fields)).length, largestFile: 0 };
  let bytes = 0;
  let largestFile = 0;
  fields.forEach((value) => {
    const size = typeof value === "string" ? encoder.encode(value).length : value.size;
    bytes += size;
    if (typeof value !== "string") largestFile = Math.max(largestFile, size);
  });
  return { bytes, largestFile };
}

/** Check a public form's post first in its action: the bot check `<FormGuard>` put in the
 *  form, then the per-visitor caps. `fields` is the form data or the parsed JSON body, sized
 *  as measured. One token is good for `max` posts per window, so a copy buys no more. */
export async function guardForm(
  env: Env,
  request: Request,
  fields: FormData | Record<string, unknown>,
  options: LimitVisitorOptions,
): Promise<FormGuardResult> {
  requireName(options.name, "guardForm");
  if (isDev(env)) return { ok: true };
  if (field(fields, TRAP_FIELD)) return refuse(env, options.name, { ok: false, reason: "bot" });
  const nonce = await tokenNonce(env, options.name, field(fields, TOKEN_FIELD));
  if (!nonce) return refuse(env, options.name, { ok: false, reason: "unverified" });
  const { bytes, largestFile } = measure(fields);
  const maxFileBytes = options.maxFileBytes ?? options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  try {
    const limit = await limitFor(env, options);
    if (limit.closed) return await refuse(env, options.name, { ok: false, reason: "closed" });
    if (largestFile > maxFileBytes) return await refuse(env, options.name, { ok: false, reason: "too_large", maxBytes: maxFileBytes });
    const retryAfterSeconds = await countUse(env, `token:${nonce}`, limit.max, limit.windowSeconds);
    if (retryAfterSeconds > 0) return await refuse(env, options.name, { ok: false, reason: "too_many", retryAfterSeconds });
    return await countVisitor(env, request, options, limit, Math.max(bytes, declaredBytes(request) ?? 0));
  } catch (err) {
    console.error(`[form-guard] could not count a post for "${options.name}", refusing the request:`, err);
    return refuse(env, options.name, { ok: false, reason: "unavailable" });
  }
}
