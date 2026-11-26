/**
 * The per-run token: HMAC-signed with the app's trigger secret, carried by the agent on every
 * call to the `mcp/agent-run` door. A copy of the platform's token module; the template cannot import `shared/`.
 */
import type { AgentEnvironment } from "../types/agents";

export type AgentRunTokenPayload = {
  appId: string;
  environment: AgentEnvironment;
  appUserId: string;
  runId: string;
  tools: string[];
  /** Epoch seconds. */
  exp: number;
};

const PREFIX = "agr-";

export async function signAgentRunToken(payload: AgentRunTokenPayload, secret: string): Promise<string> {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer);
  return `${PREFIX}${body}.${await hmacSign(body, secret)}`;
}

export async function verifyAgentRunToken(
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): Promise<AgentRunTokenPayload | null> {
  if (!token?.startsWith(PREFIX)) return null;
  const rest = token.slice(PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot === -1) return null;
  const body = rest.slice(0, dot);
  try {
    if (!(await hmacVerify(body, rest.slice(dot + 1), secret))) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as AgentRunTokenPayload;
    if (typeof payload.exp !== "number" || now / 1000 >= payload.exp) return null;
    if (typeof payload.runId !== "string" || typeof payload.appId !== "string") return null;
    return payload;
  } catch {
    // A malformed token is unauthenticated, not a crash.
    return null;
  }
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importCryptoKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await importCryptoKey(secret, "sign");
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(sig);
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const key = await importCryptoKey(secret, "verify");
  const sigBytes = base64UrlDecode(signature);
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
}
