/**
 * Ambient global types for the platform layer — the `Env` binding surface and
 * the client-side `window.stencil` APIs. Refreshed on every build with the rest
 * of `app/.stencil/`, so a new platform binding reaches existing apps on their
 * next build instead of failing to compile against a frozen copy.
 */

/**
 * Client-side Stencil APIs injected by the platform on the published app.
 * Browser-only, and only on the live app (not the editor preview). The push
 * and install APIs additionally require Mobile app to be enabled in app settings.
 */
type StencilPushStatus =
  | "unsupported" // browser has no service worker / Push API
  | "needs-install" // iOS Safari: the app user must Add to Home Screen first
  | "denied" // notifications blocked by the app user
  | "default" // supported, permission not yet requested
  | "granted" // permission granted, no active subscription
  | "subscribed"; // permission granted and subscribed

type StencilPushResult =
  | { ok: true }
  | { ok: false; reason: StencilPushStatus | "not-configured" | "server" };

type StencilInstallStatus =
  | "installed" // running from the home screen, or installed during this visit
  | "promptable" // Android / desktop Chromium: prompt() opens the real install dialog
  | "manual" // iPhone and iPad: the app user must Add to Home Screen from the share sheet
  | "unsupported"; // no install path here (Mobile app is off, or the browser has none)

type StencilInstallResult =
  | { ok: true; outcome: "accepted" | "dismissed" }
  | { ok: false; reason: "installed" | "manual" | "unsupported" };

interface Window {
  stencil?: {
    /**
     * Web Push opt-in. Call subscribe() from a user gesture (e.g. a button
     * click) — iOS ignores permission prompts that aren't gesture-initiated.
     */
    push?: {
      subscribe(): Promise<StencilPushResult>;
      unsubscribe(): Promise<StencilPushResult>;
      status(): Promise<StencilPushStatus>;
    };
    /**
     * Home-screen install. status() is synchronous and can change after the page
     * loads (Chromium reports installability late), so subscribe with onChange().
     * Call prompt() from a user gesture.
     */
    install?: {
      status(): StencilInstallStatus;
      prompt(): Promise<StencilInstallResult>;
      onChange(listener: (status: StencilInstallStatus) => void): () => void;
    };
    /** Track a custom analytics event. */
    track?(name: string, props?: Record<string, unknown>): void;
    /** Declare every event name the app can track, so Insights lists the unused ones too. */
    declare?(names: string[]): void;
    /**
     * Session recording of this visit. Present only while this page is being recorded.
     * optOut() stops it and keeps this browser unrecorded on later page loads; the same
     * choice is `localStorage["stencil-replay-optout"] = "1"`. Nothing starts or resumes it.
     */
    replay?: {
      stop(): void;
      optOut(): void;
      sessionId(): string;
    };
    /**
     * The support widget's panel. Present only on the published app with
     * "Support in-app button" on in Support → Setup.
     * `window` also gets a `stencil:support-unread` event with `detail: { count }`
     * whenever the unread count changes.
     */
    support?: {
      /** Opens the panel; `tab` goes straight to that channel (Feedback opens on the form,
       *  `category` pre-selected). No argument, or a tab that is off, shows the channel menu. */
      open(options?: {
        tab?: "messages" | "feedback" | "help";
        category?: "problem" | "idea" | "other";
      }): void;
      close(): void;
      /** Conversations with a reply the app user has not opened yet. */
      readonly unread: number;
      /** Calls cb with the count now and on every change; returns an unsubscribe. */
      onUnread(cb: (count: number) => void): () => void;
    };
  };
}

// The workerd `caches.default` edge cache. lib.dom's `CacheStorage` wins the name
// over the workerd class in worker-configuration.d.ts and has no `default`, so this
// merges the member back in for the DOM-lib project that compiles worker code.
interface CacheStorage {
  readonly default: Cache;
}

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  BETTER_AUTH_SECRET: string;
  APP_SLUG: string;
  APP_ID: string;
  AUTH_ISSUER_URL: string;
  // The Stencil App origin of the environment this app was deployed to; the
  // app user connections broker answers there.
  PLATFORM_ORIGIN: string;
  AUTH?: Fetcher;
  BACKEND_SERVICE?: Fetcher;
  BACKEND_SERVICE_API_KEY?: string;
  PAYMENTS?: Fetcher;
  // Secret used to authenticate the platform's recurring-action triggers. Set
  // automatically at deploy; the scheduled route verifies inbound requests against it.
  SCHEDULE_TRIGGER_SECRET?: string;
  IS_DRAFT?: string;
  // "development" only when running locally; the platform strips it at deploy,
  // so a deployed app always leaves it unset.
  STENCIL_ENV?: string;
}
