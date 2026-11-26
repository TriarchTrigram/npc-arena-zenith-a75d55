/**
 * A page or record behind a short code or password, for someone with no account: the code
 * stored one-way, minted codes unguessable and unique, guesses counted and slowed, and a
 * correct guess earning an opaque, expiring pass that dies when the code behind it changes.
 */

import { authConfig } from "./auth/utils";

const WINDOW_SECONDS = 15 * 60;
const MAX_GUESSES_PER_RECORD = 10;
const MAX_GUESSES_PER_CALLER = 30;
const DEFAULT_PASS_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_MINTED_LENGTH = 6;
const DEFAULT_MINTED_LENGTH = 8;
// No 0/O/1/I: these codes are read aloud and typed from paper.
const MINT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASS_BYTES = 32;
const COOKIE_PREFIX = "stencil_access_";

export interface SetAccessCodeOptions {
  /** The one record or page the code opens — a row id, or a fixed name such as "members-area". */
  subject: string;
  /** What the code is for, e.g. "gallery". A pass earned under one purpose is refused by another. */
  purpose: string;
  /** The code the app builder or app user chose. Whitespace around it is ignored. */
  code: string;
}

export interface MintAccessCodeOptions {
  subject: string;
  purpose: string;
  /** Characters in the code; 8 by default, never fewer than 6. */
  length?: number;
}

export interface VerifyAccessCodeOptions {
  purpose: string;
  /** What the visitor typed. */
  code: string;
  /** The record the visitor is opening. Omit only when a minted code alone names it. */
  subject?: string;
  /** How long the pass lasts. Defaults to 7 days. */
  passTtlSeconds?: number;
}

export interface AccessPass {
  /** The pass's own id. Revoke with this. */
  id: string;
  /** The record the pass opens. */
  subject: string;
  purpose: string;
  expiresAt: Date;
}

export type AccessCheck =
  | {
      ok: true;
      pass: AccessPass;
      /** The `Set-Cookie` header value that hands the pass to the browser. */
      setCookie: string;
    }
  | { ok: false; reason: "wrong" }
  | { ok: false; reason: "too_many"; retryAfterSeconds: number };

export interface LimitGuessOptions {
  /** The thing being guessed, never the guesser's own row or account: `"vault-pin:" + sectionId`,
   *  `"email-link:" + address`. Everyone guessing at it shares one budget. */
  key: string;
  /** Guesses allowed in one window. */
  max: number;
  /** Seconds until a full budget returns. Defaults to 15 minutes. */
  windowSeconds?: number;
}

export type GuessLimit = { ok: true } | { ok: false; reason: "too_many"; retryAfterSeconds: number };

interface CodeRow {
  id: string;
  subject: string;
}

interface PassRow {
  id: string;
  subject: string;
  purpose: string;
  expires_at: number;
  revoked_at: number | null;
  code_id: string | null;
}

const ACCESS_DDL = [
  "CREATE TABLE IF NOT EXISTS `stencil_access_code` (`id` text PRIMARY KEY NOT NULL, `digest` text NOT NULL UNIQUE, `subject` text NOT NULL, `purpose` text NOT NULL, `created_at` integer NOT NULL);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `stencil_access_code_subject_purpose` ON `stencil_access_code` (`subject`, `purpose`);",
  "CREATE TABLE IF NOT EXISTS `stencil_access_pass` (`id` text PRIMARY KEY NOT NULL, `token_hash` text NOT NULL UNIQUE, `code_id` text NOT NULL, `subject` text NOT NULL, `purpose` text NOT NULL, `expires_at` integer NOT NULL, `revoked_at` integer, `created_at` integer NOT NULL, FOREIGN KEY (`code_id`) REFERENCES `stencil_access_code`(`id`) ON UPDATE no action ON DELETE cascade);",
  "CREATE INDEX IF NOT EXISTS `stencil_access_pass_subject_purpose` ON `stencil_access_pass` (`subject`, `purpose`);",
  "CREATE TABLE IF NOT EXISTS `stencil_access_attempt` (`scope` text PRIMARY KEY NOT NULL, `guesses` integer NOT NULL, `window_start` integer NOT NULL);",
];

let ensured = false;

async function ensureTables(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.batch(ACCESS_DDL.map((sql) => env.DB.prepare(sql)));
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

// A chosen code is bound to its record (two records may share a password); a minted one to
// its purpose alone, so it can name its record and the UNIQUE digest keeps it unique. The
// labelled subkey keeps the session secret and these digests from ever verifying each other.
async function codeDigest(env: Env, purpose: string, subject: string | null, code: string): Promise<string> {
  const subkey = await hmac(encoder.encode(authConfig.betterAuthSecret(env)), "stencil.access-code.v1");
  return hex(await hmac(subkey, `${purpose}\n${subject ?? ""}\n${code}`));
}

// Passes are 256 random bits, so a plain digest is enough; no secret is involved.
async function passHash(token: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}

function mintPassToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASS_BYTES));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Rejection sampling keeps every character equally likely; a bare modulo would not.
function mintCode(length: number): string {
  const limit = 256 - (256 % MINT_ALPHABET.length);
  let code = "";
  while (code.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit) code += MINT_ALPHABET[b % MINT_ALPHABET.length];
      if (code.length === length) break;
    }
  }
  return code;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function cookieName(purpose: string): string {
  return COOKIE_PREFIX + purpose.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function requireNames(subject: string | undefined, purpose: string, fn: string): void {
  if (!purpose) throw new Error(`${fn} needs a purpose.`);
  if (subject !== undefined && !subject) throw new Error(`${fn} needs a subject.`);
}

async function storeCode(env: Env, subject: string, purpose: string, digest: string): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await env.DB.batch([
    // The old row's passes go with it (cascade): changing the code is how an app cuts
    // off everyone who had the old one.
    env.DB.prepare("DELETE FROM `stencil_access_code` WHERE `subject` = ? AND `purpose` = ?").bind(subject, purpose),
    env.DB.prepare(
      "INSERT INTO `stencil_access_code` (`id`, `digest`, `subject`, `purpose`, `created_at`) VALUES (?, ?, ?, ?, ?)",
    ).bind(id, digest, subject, purpose, nowSeconds()),
  ]);
  return { id };
}

/** Store a code the app builder or an app user chose for one record and purpose.
 *  Replaces any earlier code for that pair and withdraws every pass earned under it. */
export async function setAccessCode(env: Env, options: SetAccessCodeOptions): Promise<{ id: string }> {
  const { subject, purpose } = options;
  requireNames(subject, purpose, "setAccessCode");
  const code = options.code.trim();
  if (!code) throw new Error("setAccessCode needs a non-empty code.");
  await ensureTables(env);
  return storeCode(env, subject, purpose, await codeDigest(env, purpose, subject, code));
}

/** Keep the stored code for this record and purpose equal to `code`: a no-op when it already
 *  is, otherwise it replaces the old code and withdraws every pass earned under it. Never
 *  counts a guess. Call it before the gate's `getAccessPass` and `verifyAccessCode`. */
export async function syncAccessCode(env: Env, options: SetAccessCodeOptions): Promise<void> {
  const { subject, purpose } = options;
  requireNames(subject, purpose, "syncAccessCode");
  const code = options.code.trim();
  if (!code) throw new Error("syncAccessCode needs a non-empty code.");
  await ensureTables(env);
  const digest = await codeDigest(env, purpose, subject, code);
  // Compared and replaced in one transaction: two overlapping syncs of the same code
  // must not delete a row (and the passes under it) the other one just stored.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM `stencil_access_code` WHERE `subject` = ? AND `purpose` = ? AND `digest` <> ?").bind(
      subject,
      purpose,
      digest,
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO `stencil_access_code` (`id`, `digest`, `subject`, `purpose`, `created_at`) VALUES (?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), digest, subject, purpose, nowSeconds()),
  ]);
}

/** Mint a fresh code for one record and purpose, unique within the purpose so a visitor can
 *  type it alone and reach the record. The returned `code` is the only readable copy — show
 *  or email it now. Replaces any earlier code for the pair and withdraws its passes. */
export async function mintAccessCode(env: Env, options: MintAccessCodeOptions): Promise<{ id: string; code: string }> {
  const { subject, purpose } = options;
  requireNames(subject, purpose, "mintAccessCode");
  const length = Math.max(MIN_MINTED_LENGTH, options.length ?? DEFAULT_MINTED_LENGTH);
  await ensureTables(env);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = mintCode(length);
    const digest = await codeDigest(env, purpose, null, code);
    const taken = await env.DB.prepare("SELECT 1 FROM `stencil_access_code` WHERE `digest` = ?").bind(digest).first();
    if (taken) continue;
    try {
      const { id } = await storeCode(env, subject, purpose, digest);
      return { id, code };
    } catch (err) {
      // Lost a race to the same digest between the lookup and the insert; mint again.
      if (!/UNIQUE constraint failed: stencil_access_code\.digest/.test(String(err))) throw err;
    }
  }
  throw new Error(`mintAccessCode could not find a free ${length}-character code for purpose "${purpose}".`);
}

/** Count one guess against `scope` in one statement, so concurrent guesses are all
 *  counted and none slips through while another is being judged. Returns the seconds
 *  until the window reopens, or 0 when this guess may proceed. */
async function countGuess(env: Env, scope: string, max: number, windowSeconds = WINDOW_SECONDS): Promise<number> {
  const now = nowSeconds();
  const row = await env.DB.prepare(
    "INSERT INTO `stencil_access_attempt` (`scope`, `guesses`, `window_start`) VALUES (?, 1, ?) " +
      "ON CONFLICT(`scope`) DO UPDATE SET " +
      "`guesses` = CASE WHEN `window_start` <= ? THEN 1 ELSE `guesses` + 1 END, " +
      "`window_start` = CASE WHEN `window_start` <= ? THEN excluded.`window_start` ELSE `window_start` END " +
      "RETURNING `guesses`, `window_start`",
  )
    .bind(scope, now, now - windowSeconds, now - windowSeconds)
    .first<{ guesses: number; window_start: number }>();
  if (!row || row.guesses <= max) return 0;
  return Math.max(1, row.window_start + windowSeconds - now);
}

/** Count one guess at a secret the app compares itself (a PIN, an emailed code), before the
 *  compare. Concurrent guesses are all counted, and the count lives outside the app's own
 *  rows, so a new code, a re-added row or a closed account never restores the budget. */
export async function limitGuess(env: Env, options: LimitGuessOptions): Promise<GuessLimit> {
  if (!options.key) throw new Error("limitGuess needs a key.");
  await ensureTables(env);
  const windowSeconds = options.windowSeconds ?? WINDOW_SECONDS;
  const retryAfterSeconds = await countGuess(env, `guess:${options.key}`, options.max, windowSeconds);
  return retryAfterSeconds > 0 ? { ok: false, reason: "too_many", retryAfterSeconds } : { ok: true };
}

/** Uncount the guess `limitGuess` just counted under `key`, once it proved right, so correct
 *  entries never lock anyone out. Wrong guesses before it stay counted. */
export async function forgiveGuess(env: Env, key: string): Promise<void> {
  await env.DB.prepare("UPDATE `stencil_access_attempt` SET `guesses` = `guesses` - 1 WHERE `scope` = ? AND `guesses` > 0")
    .bind(`guess:${key}`)
    .run();
}

function callerKey(request: Request): string {
  // Only cf-connecting-ip: Cloudflare sets it and strips client-supplied copies.
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

/** Check a typed code and, when it is right, issue a pass. Too many guesses in a window are
 *  refused before the code is looked at: per caller always, per record when `subject` is
 *  given (a minted code alone is wide enough for the caller cap). A right guess does not
 *  count; wrong ones before it stay counted. Every refusal looks alike. */
export async function verifyAccessCode(env: Env, request: Request, options: VerifyAccessCodeOptions): Promise<AccessCheck> {
  const { purpose, subject } = options;
  requireNames(subject, purpose, "verifyAccessCode");
  const code = options.code.trim();
  await ensureTables(env);

  const callerScope = `caller:${purpose}:${callerKey(request)}`;
  const recordScope = subject ? `record:${purpose}:${subject}` : null;
  let retryAfterSeconds = await countGuess(env, callerScope, MAX_GUESSES_PER_CALLER);
  if (recordScope) retryAfterSeconds = Math.max(retryAfterSeconds, await countGuess(env, recordScope, MAX_GUESSES_PER_RECORD));
  if (retryAfterSeconds > 0) return { ok: false, reason: "too_many", retryAfterSeconds };
  if (!code) return { ok: false, reason: "wrong" };

  // Minted codes are uppercase, so a visitor typing one in lowercase is still right;
  // a chosen code is matched as typed.
  const digests = subject
    ? [await codeDigest(env, purpose, subject, code), await codeDigest(env, purpose, null, code.toUpperCase())]
    : [await codeDigest(env, purpose, null, code.toUpperCase())];
  const row = subject
    ? await env.DB.prepare("SELECT `id`, `subject` FROM `stencil_access_code` WHERE `digest` IN (?, ?) AND `subject` = ?")
        .bind(digests[0], digests[1], subject)
        .first<CodeRow>()
    : await env.DB.prepare("SELECT `id`, `subject` FROM `stencil_access_code` WHERE `digest` = ?").bind(digests[0]).first<CodeRow>();
  if (!row) return { ok: false, reason: "wrong" };

  const ttl = options.passTtlSeconds ?? DEFAULT_PASS_TTL_SECONDS;
  const now = nowSeconds();
  const expiresAt = now + ttl;
  const id = crypto.randomUUID();
  const token = mintPassToken();
  const writes = [
    env.DB.prepare(
      "INSERT INTO `stencil_access_pass` (`id`, `token_hash`, `code_id`, `subject`, `purpose`, `expires_at`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, await passHash(token), row.id, row.subject, purpose, expiresAt, now),
  ];
  // A right guess uncounts itself, so a shared IP (a classroom, an office) is not locked
  // out by its own correct entries, while wrong guesses before it still count.
  const uncount = "UPDATE `stencil_access_attempt` SET `guesses` = `guesses` - 1 WHERE `scope` = ? AND `guesses` > 0";
  writes.push(env.DB.prepare(uncount).bind(callerScope));
  if (recordScope) writes.push(env.DB.prepare(uncount).bind(recordScope));
  await env.DB.batch(writes);

  const pass: AccessPass = { id, subject: row.subject, purpose, expiresAt: new Date(expiresAt * 1000) };
  const setCookie = `${cookieName(purpose)}=${token}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Lax`;
  return { ok: true, pass, setCookie };
}

function readPassCookie(request: Request, purpose: string): string | null {
  const name = cookieName(purpose);
  for (const part of request.headers.get("cookie")?.split(/;\s*/) ?? []) {
    if (part.startsWith(`${name}=`)) return part.slice(name.length + 1) || null;
  }
  return null;
}

/** The pass the request carries for this purpose, or null: unknown, expired, revoked,
 *  its code since changed or cleared, or (when `subject` is given) earned for another
 *  record. Every refusal looks alike. Read it in the loader of every gated route. */
export async function getAccessPass(
  request: Request,
  env: Env,
  options: { purpose: string; subject?: string },
): Promise<AccessPass | null> {
  const { purpose, subject } = options;
  requireNames(subject, purpose, "getAccessPass");
  const token = readPassCookie(request, purpose);
  if (!token) return null;

  await ensureTables(env);
  const row = await env.DB.prepare(
    "SELECT `p`.`id`, `p`.`subject`, `p`.`purpose`, `p`.`expires_at`, `p`.`revoked_at`, `c`.`id` AS `code_id` " +
      "FROM `stencil_access_pass` `p` LEFT JOIN `stencil_access_code` `c` ON `c`.`id` = `p`.`code_id` " +
      "WHERE `p`.`token_hash` = ?",
  )
    .bind(await passHash(token))
    .first<PassRow>();

  if (!row || row.purpose !== purpose) return null;
  if (row.revoked_at != null || row.code_id == null) return null;
  if (row.expires_at < nowSeconds()) return null;
  if (subject && row.subject !== subject) return null;
  return { id: row.id, subject: row.subject, purpose: row.purpose, expiresAt: new Date(row.expires_at * 1000) };
}

/** The `Set-Cookie` header value that drops the pass for this purpose from the browser. */
export function clearAccessPassCookie(purpose: string): string {
  return `${cookieName(purpose)}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/** Withdraw passes before they expire: one by `id`, or every pass to a record (optionally
 *  one purpose). Returns how many were revoked. The code itself stays valid. */
export async function revokeAccessPasses(
  env: Env,
  selector: { id: string } | { subject: string; purpose?: string },
): Promise<number> {
  await ensureTables(env);
  const now = nowSeconds();
  const statement =
    "id" in selector
      ? env.DB.prepare("UPDATE `stencil_access_pass` SET `revoked_at` = ? WHERE `id` = ? AND `revoked_at` IS NULL").bind(now, selector.id)
      : selector.purpose
        ? env.DB.prepare(
            "UPDATE `stencil_access_pass` SET `revoked_at` = ? WHERE `subject` = ? AND `purpose` = ? AND `revoked_at` IS NULL",
          ).bind(now, selector.subject, selector.purpose)
        : env.DB.prepare("UPDATE `stencil_access_pass` SET `revoked_at` = ? WHERE `subject` = ? AND `revoked_at` IS NULL").bind(
            now,
            selector.subject,
          );
  const result = await statement.run();
  return result.meta.changes ?? 0;
}

/** Remove the code on a record and purpose, and with it every pass it earned. Nothing
 *  unlocks the record again until a new code is set or minted. */
export async function clearAccessCode(env: Env, options: { subject: string; purpose: string }): Promise<void> {
  requireNames(options.subject, options.purpose, "clearAccessCode");
  await ensureTables(env);
  await env.DB.prepare("DELETE FROM `stencil_access_code` WHERE `subject` = ? AND `purpose` = ?")
    .bind(options.subject, options.purpose)
    .run();
}
