import type { HandlerArgs } from "./types/context";

/**
 * How an outside service signs what it POSTs to this app. The sender's docs give
 * every value here; the secret comes from the app's Secrets.
 */
export type WebhookSignature = {
  /** The sender's signing secret, read from `env`. An empty value rejects every request. */
  secret: string | undefined;
  /** Header that carries the signature, e.g. `x-hub-signature-256` or `stripe-signature`. */
  header: string;
  /** Hash behind the HMAC. Defaults to `SHA-256`. */
  algorithm?: "SHA-1" | "SHA-256" | "SHA-512";
  /** How the digest is written in the header. Defaults to `hex`. */
  encoding?: "hex" | "base64";
  /** A fixed prefix before the digest, e.g. `sha256=` or `v1=`. */
  prefix?: string;
  /**
   * Set when the header holds comma-separated `key=value` pairs (Stripe's `t=…,v1=…`
   * shape): the pair carrying the signature (default `v1`) and the timestamp (default `t`).
   */
  pairs?: { signature?: string; timestamp?: string };
  /**
   * Replay window: the sender signs `${timestamp}.${body}` with the time (unix seconds)
   * in a header or a `pairs` field; older than the tolerance (default 300s) is rejected.
   */
  timestamp?: { header?: string; toleranceSeconds?: number };
  /** What the sender signed, when it is not the body alone or `${timestamp}.${body}`. */
  signedPayload?: (input: { body: string; request: Request; timestamp: string | null }) => string;
};

export type WebhookRejection =
  | "missing_secret"
  | "missing_signature"
  | "malformed_signature"
  | "missing_timestamp"
  | "stale_timestamp"
  | "signature_mismatch";

export type WebhookVerification =
  | { ok: true; rawBody: string; timestamp: string | null }
  | { ok: false; reason: WebhookRejection; response: Response };

/** Signatures Stencil's own Events page sends to a destination the app builder added. */
export const STENCIL_EVENT_SIGNATURE: Omit<WebhookSignature, "secret"> = {
  header: "stencil-signature",
  prefix: "v1=",
  timestamp: { header: "stencil-timestamp" },
};

function decodeDigest(value: string, encoding: "hex" | "base64"): Uint8Array | null {
  try {
    if (encoding === "base64") {
      const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
      return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
    }
    if (value.length % 2 !== 0 || /[^0-9a-f]/i.test(value)) return null;
    const out = new Uint8Array(value.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    return out;
  } catch {
    return null;
  }
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function parsePairs(header: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    out.set(key, [...(out.get(key) ?? []), value]);
  }
  return out;
}

/**
 * Check that a request really came from the service holding `secret`: hashes the exact
 * bytes transmitted, compares in constant time, and fails closed when the secret is unset.
 * On success hands back the raw body so the handler parses the same bytes it verified.
 */
export async function verifyWebhook(
  request: Request,
  signature: WebhookSignature,
): Promise<WebhookVerification> {
  const reject = (reason: WebhookRejection, detail = ""): WebhookVerification => {
    console.error(`[webhook] rejected ${new URL(request.url).pathname}: ${reason}${detail}`);
    return { ok: false, reason, response: Response.json({ error: "unauthorized", reason }, { status: 401 }) };
  };

  if (!signature.secret) return reject("missing_secret");

  const headerValue = request.headers.get(signature.header)?.trim() ?? "";
  if (!headerValue) return reject("missing_signature");

  let candidates: string[];
  let timestamp: string | null = null;
  if (signature.pairs) {
    const pairs = parsePairs(headerValue);
    candidates = pairs.get(signature.pairs.signature ?? "v1") ?? [];
    if (signature.timestamp) timestamp = pairs.get(signature.pairs.timestamp ?? "t")?.[0] ?? null;
  } else {
    candidates = [headerValue];
    if (signature.timestamp) {
      timestamp = signature.timestamp.header
        ? request.headers.get(signature.timestamp.header)?.trim() || null
        : null;
    }
  }
  if (candidates.length === 0) return reject("missing_signature");

  if (signature.timestamp) {
    if (!timestamp) return reject("missing_timestamp");
    const ts = Number(timestamp);
    const tolerance = signature.timestamp.toleranceSeconds ?? 300;
    const age = Math.floor(Date.now() / 1000) - ts;
    if (!Number.isFinite(ts) || Math.abs(age) > tolerance) {
      return reject("stale_timestamp", ` (signed ${age}s ago, tolerance ${tolerance}s)`);
    }
  }

  const prefix = signature.prefix ?? "";
  const encoding = signature.encoding ?? "hex";
  const received: Uint8Array[] = [];
  for (const candidate of candidates) {
    if (!candidate.startsWith(prefix)) continue;
    const digest = decodeDigest(candidate.slice(prefix.length), encoding);
    if (digest) received.push(digest);
  }
  if (received.length === 0) return reject("malformed_signature");

  const bodyBytes = new Uint8Array(await request.arrayBuffer());
  const rawBody = new TextDecoder().decode(bodyBytes);
  const encoder = new TextEncoder();
  const signed = signature.signedPayload
    ? encoder.encode(signature.signedPayload({ body: rawBody, request, timestamp }))
    : timestamp !== null
      ? concatBytes(encoder.encode(`${timestamp}.`), bodyBytes)
      : bodyBytes;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signature.secret),
    { name: "HMAC", hash: signature.algorithm ?? "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));

  if (!received.some((digest) => bytesEqual(digest, expected))) {
    // Byte counts, never values: a secret pasted with a stray newline or quote shows up as
    // an unexpected length here, which is otherwise indistinguishable from a wrong key.
    return reject(
      "signature_mismatch",
      ` (body ${bodyBytes.length} bytes, secret ${encoder.encode(signature.secret).length} bytes)`,
    );
  }

  return { ok: true, rawBody, timestamp };
}

/** What a webhook handler receives alongside the parsed payload. */
export type WebhookHandlerArgs = {
  env: Env;
  request: Request;
  /** The body exactly as the sender transmitted and signed it. */
  rawBody: string;
};

/**
 * Wrap an app callback as a signed-webhook receiver: verify, parse JSON, run. A callback
 * failure returns 500 so the sender retries, so the callback must be idempotent.
 */
export function webhookAction<T>(
  signature: (env: Env) => WebhookSignature,
  handle: (payload: T, args: WebhookHandlerArgs) => Promise<void> | void,
) {
  return async ({ request, context }: HandlerArgs) => {
    const env = context.cloudflare.env;

    const verified = await verifyWebhook(request, signature(env));
    if (!verified.ok) return verified.response;

    let payload: T;
    try {
      payload = JSON.parse(verified.rawBody) as T;
    } catch {
      return Response.json({ error: "invalid JSON body" }, { status: 400 });
    }

    try {
      await handle(payload, { env, request, rawBody: verified.rawBody });
    } catch (err) {
      console.error("webhook handler failed:", err);
      return Response.json({ ok: false, error: "handler failed" }, { status: 500 });
    }

    return Response.json({ ok: true });
  };
}
