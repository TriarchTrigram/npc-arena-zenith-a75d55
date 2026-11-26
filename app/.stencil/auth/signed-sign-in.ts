import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { verification } from "./schema";
import { secret } from "../secrets";

/**
 * Signed sign-in links: one click from the app builder's other system into this app, signed in.
 * `sig = HMAC-SHA256(SIGNED_SIGN_IN_SECRET, email + "\n" + exp + "\n" + next)`, verified by the platform.
 */

export const SIGNED_SIGN_IN_SECRET = "SIGNED_SIGN_IN_SECRET";
export const SIGNED_SIGN_IN_PATH = "/sign-in/signed";
/** Minted links expire sooner than the platform's 15-minute ceiling, so clock drift never refuses one. */
const SIGNED_SIGN_IN_LINK_EXPIRES_IN = 60 * 10;

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The signature over a link's parts, exactly as the platform recomputes it. */
export function signSignInLink(
  key: string,
  email: string,
  exp: number | string,
  next: string,
): Promise<string> {
  return hmacHex(key, `${email}\n${exp}\n${next}`);
}

export interface SignedSignInLinkInput {
  email: string;
  /** Where the person lands once signed in: a path on this app. Defaults to `/app`. */
  next?: string;
  /** The origin the link lives on, normally `new URL(request.url).origin`. */
  origin: string;
}

/** Mint a signed sign-in link: Continue signs the person in, creating the account first if needed
 *  (also on an invite-only app), no welcome email. Ten minutes, single use. Throws until the app
 *  builder has saved `SIGNED_SIGN_IN_SECRET` in More → Settings → Secrets. */
export async function signedSignInLink(env: Env, input: SignedSignInLinkInput): Promise<string> {
  const key = secret(env, SIGNED_SIGN_IN_SECRET);
  if (!key) {
    throw new Error(
      `signedSignInLink: ${SIGNED_SIGN_IN_SECRET} is not set (More → Settings → Secrets)`,
    );
  }
  const email = input.email.trim().toLowerCase();
  const next = input.next || "/app";
  const exp = Math.floor(Date.now() / 1000) + SIGNED_SIGN_IN_LINK_EXPIRES_IN;
  const url = new URL(SIGNED_SIGN_IN_PATH, input.origin);
  url.searchParams.set("email", email);
  url.searchParams.set("exp", String(exp));
  url.searchParams.set("next", next);
  url.searchParams.set("sig", await signSignInLink(key, email, exp, next));
  return url.toString();
}

// A used link is a `verification` row. Its id is a keyed hash of the signature rather
// than the signature itself: the magic-link verify endpoint deletes whatever row it is
// handed as a token, and the signature is in the link for anyone to hand it.
async function usedLinkId(env: Env, sig: string): Promise<string> {
  return `signed-sign-in:${await hmacHex(env.BETTER_AUTH_SECRET, sig)}`;
}

/** Whether this link was used before. */
export async function isSignedLinkUsed(env: Env, sig: string): Promise<boolean> {
  const id = await usedLinkId(env, sig);
  const [row] = await drizzle(env.DB)
    .select({ id: verification.id })
    .from(verification)
    .where(eq(verification.id, id))
    .limit(1);
  return Boolean(row);
}

/** Record this link as used until it expires. False when another use got there first. */
export async function markSignedLinkUsed(env: Env, sig: string, exp: number): Promise<boolean> {
  const id = await usedLinkId(env, sig);
  const now = new Date();
  try {
    await drizzle(env.DB).insert(verification).values({
      id,
      identifier: id,
      value: "used",
      expiresAt: new Date(exp * 1000),
      createdAt: now,
      updatedAt: now,
    });
    return true;
  } catch (err) {
    if (/UNIQUE constraint/i.test(err instanceof Error ? err.message : String(err))) return false;
    throw err;
  }
}
