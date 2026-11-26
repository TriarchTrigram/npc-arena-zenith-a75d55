// Internal plumbing — use createAI, createEmail, etc. instead. Never import this directly in app code.
import { requestStore } from "./request-context";

export const BACKEND_BASE = "https://backend.hellostencil.com";

/** How long a background report to the platform may take before it is dropped. */
export const BACKGROUND_REPORT_TIMEOUT_MS = 10_000;

/**
 * Who and what is making the platform calls of the current request. The worker opens one
 * per request; `withFeature` narrows it for one AI call. Travels on the async context, so
 * an SDK created from `env` alone still knows the feature and the signed-in app user.
 */
export type CallTag = {
  /** The in-app feature: the label the code gave the call, else the route handling the request. */
  feature: string | null;
  /** The signed-in app user's id in this app's own database, or null when nobody is signed in. */
  appUserId: () => Promise<string | null>;
};

export const callTag = requestStore<CallTag>();

const FEATURE_MAX = 80;

/** A feature label as the usage record stores it: lowercase, no whitespace, short. */
export function normalizeFeature(label: string): string | null {
  const feature = label.trim().toLowerCase().replace(/\s+/g, "-").slice(0, FEATURE_MAX);
  return feature || null;
}

/** Run `fn` with its platform calls tagged as `feature`, keeping the request's app user. */
export function withFeature<T>(feature: string, fn: () => T): T {
  const current = callTag.getStore();
  return callTag.run({ feature: normalizeFeature(feature), appUserId: current?.appUserId ?? (async () => null) }, fn);
}

/** Returns a fetch function that routes requests through the Stencil backend service with bearer auth. */
export function createBackendFetch(env: Env) {
  return async function backendFetch(input: RequestInfo | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    if (env.BACKEND_SERVICE_API_KEY) {
      headers.set("Authorization", `Bearer ${env.BACKEND_SERVICE_API_KEY}`);
    }

    headers.set("x-stencil-preview", env.IS_DRAFT === "true" ? "true" : "false");
    const tag = callTag.getStore();
    if (tag?.feature) headers.set("x-stencil-feature", tag.feature);
    const appUserId = await tag?.appUserId();
    if (appUserId) headers.set("x-stencil-app-user", appUserId);
    const req = new Request(input, { ...init, headers });
    return env.BACKEND_SERVICE ? env.BACKEND_SERVICE.fetch(req) : fetch(req);
  };
}
