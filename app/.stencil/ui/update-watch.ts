import { useEffect, useSyncExternalStore } from "react";

/** Whether this page still matches the version the app is serving. */
export type UpdateState = "unknown" | "current" | "stale";

const VERSION_PATH = "/_version.txt";
const POLL_MS = 60_000;

let state: UpdateState = "unknown";
let baseline: string | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: UpdateState): void {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

export function getUpdateState(): UpdateState {
  return state;
}

// The marker is written at deploy time, so the bundle cannot carry it: the first
// probe, run at mount, is what tells the page which version it is.
export function checkForUpdate(): Promise<void> {
  if (typeof window === "undefined" || state === "stale") return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(VERSION_PATH, { cache: "no-store" });
      // An undeployed slot answers 204: nothing to compare against.
      if (res.status !== 200) return;
      const marker = (await res.text()).trim();
      if (!marker) return;
      if (baseline === null) baseline = marker;
      setState(marker === baseline ? "current" : "stale");
    } catch {
      // Offline or blocked: nothing to learn this round; the next probe retries.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The update state, re-rendering when it changes. Probes nothing by itself. */
export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribe, getUpdateState, () => "unknown");
}

/** Probe at mount, then every minute while the tab is visible and whenever it returns to view. */
export function useUpdateWatch(): UpdateState {
  const current = useUpdateState();
  useEffect(() => {
    const probe = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    probe();
    const timer = window.setInterval(probe, POLL_MS);
    document.addEventListener("visibilitychange", probe);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", probe);
    };
  }, []);
  return current;
}
