/**
 * App secrets, set by the app builder in More → Settings → Secrets and injected
 * as worker bindings at deploy. They are not declared on `Env`, so read them here.
 */
import { authSecret } from "./auth/utils";

/** The secret's value, or undefined until the app builder sets it. */
export function secret(env: Env, name: string): string | undefined {
  return (env as unknown as Record<string, string | undefined>)[name];
}

const SEALED_PREFIX = "sealed:v1:";
const SEAL_INFO = "stencil/sealed/v1";

/** AES-GCM key derived from the app's platform secret, which lives in the deploy's
 *  bindings and never in the app's database. HKDF keeps it distinct from the
 *  session-signing uses of the same secret. */
async function sealingKey(env: Env): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const root = await crypto.subtle.importKey("raw", encoder.encode(authSecret(env)), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: encoder.encode(SEAL_INFO) },
    root,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** True when `value` is a string `seal` produced. */
export function isSealed(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(SEALED_PREFIX);
}

/** Seal a credential someone typed into the app (an outside service's key, token or password)
 *  before it is saved, so a copy of the database cannot read it. Keep the column `hidden`
 *  and `unseal` only in the server code that calls the service. */
export async function seal(env: Env, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sealingKey(env);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${SEALED_PREFIX}${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

/** The value `seal` was given. Throws on a value `seal` did not produce for this app. */
export async function unseal(env: Env, sealed: string): Promise<string> {
  if (!isSealed(sealed)) throw new Error("unseal: the value was not produced by seal().");
  const [iv, ciphertext] = sealed.slice(SEALED_PREFIX.length).split(".");
  if (!iv || !ciphertext) throw new Error("unseal: the sealed value is malformed.");
  const key = await sealingKey(env);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, key, fromBase64Url(ciphertext));
  } catch {
    throw new Error("unseal: the sealed value was altered or sealed under another app's key.");
  }
  return new TextDecoder().decode(plain);
}
