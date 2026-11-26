const DEFAULT_MAX_BYTES = 20_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

export interface SafeFetchOptions {
  /** Largest body to read, in bytes (default 20 MB). */
  maxBytes?: number;
  /** Time each hop may take, in milliseconds (default 15 s). */
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Only for an app that really fetches from its own private network. */
  allowPrivate?: boolean;
}

export type SafeFetchResult =
  | { ok: true; bytes: Uint8Array; contentType: string | null; url: string }
  | { ok: false; code: "address" | "unreachable" | "status" | "too-big"; reason: string };

// The machine itself and private networks; WHATWG URL parsing has already
// normalised every IPv4 spelling to dotted decimal and bracketed IPv6.
function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return false;
  }
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b < 128) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b < 32) ||
      (a === 192 && b === 168)
    );
  }
  if (host.startsWith("[")) {
    const v6 = host.slice(1, -1);
    return !(v6 === "::" || v6 === "::1" || v6.startsWith("::ffff:") || /^f[cd]|^fe[89ab]/.test(v6));
  }
  return true;
}

/**
 * Why an address an app user supplied must not be fetched or passed on to another
 * service, in words plain enough to show them; null when it is a public http(s)
 * address. Compare the parsed hostname yourself for a host list: never match text.
 */
export function publicUrlProblem(url: string | URL, allowPrivate = false): string | null {
  let target: URL;
  try {
    target = typeof url === "string" ? new URL(url.trim()) : url;
  } catch {
    return "That doesn't look like a web address.";
  }
  if (!/^https?:$/.test(target.protocol) || !(allowPrivate || isPublicHost(target.hostname))) {
    return "Only public http(s) addresses can be used.";
  }
  return null;
}

// Past `max` the read stops and the byte count so far comes back instead, so a
// body with no Content-Length still can't make the worker buffer without limit.
export async function readCapped(
  body: ReadableStream<Uint8Array>,
  max: number,
): Promise<Uint8Array | number> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return total;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * GET an address an app user, a webhook or a fetched page supplied, in place of a bare
 * `fetch(url)`: public http(s) only, every redirect re-checked, size and time capped.
 * A refusal's `reason` is plain enough to show the app user.
 */
export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const refused = (code: "address" | "unreachable" | "status" | "too-big", reason: string): SafeFetchResult => ({
    ok: false,
    code,
    reason,
  });
  let target: URL;
  try {
    target = new URL(url.trim());
  } catch {
    return refused("address", "That doesn't look like a web address.");
  }
  let upstream: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS && !upstream; hop++) {
    const hopProblem = publicUrlProblem(target, options.allowPrivate);
    if (hopProblem) return refused("address", hopProblem);
    let res: Response;
    try {
      res = await fetch(target.toString(), {
        redirect: "manual",
        headers: options.headers,
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch {
      return refused("unreachable", "That address couldn't be reached.");
    }
    const location = res.headers.get("Location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      try {
        target = new URL(location, target);
      } catch {
        return refused("address", "That address redirects somewhere invalid.");
      }
      continue;
    }
    upstream = res;
  }
  if (!upstream) return refused("address", "That address redirects too many times.");
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel();
    return refused("status", `That address answered with an error (${upstream.status}).`);
  }
  if (Number(upstream.headers.get("Content-Length")) > maxBytes) {
    await upstream.body.cancel();
    return refused("too-big", "That file is too big.");
  }
  let bytes: Uint8Array | number;
  try {
    bytes = await readCapped(upstream.body, maxBytes);
  } catch {
    return refused("unreachable", "That address stopped answering.");
  }
  if (typeof bytes === "number") return refused("too-big", "That file is too big.");
  return { ok: true, bytes, contentType: upstream.headers.get("Content-Type"), url: target.toString() };
}
