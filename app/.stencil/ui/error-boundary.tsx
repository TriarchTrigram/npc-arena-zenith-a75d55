import { useEffect } from "react";
import { CompassIcon, LockIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import type { PlatformError } from "../types/error";
import { resolveUpdateCopy, type UpdateCopy } from "./update-notice";
import { checkForUpdate, getUpdateState, useUpdateState } from "./update-watch";

// Button classes inlined, not imported from app-owned UI — this screen must render
// even when the app's own Button is broken or gone.
const ACTION =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px";
const PRIMARY =
  "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-none active:shadow-none";
const OUTLINE =
  "border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50";

// Names the missing page, and the page that linked to it when a full navigation
// carried a same-site referrer. An in-router navigation leaves no referrer.
function deadLinkMessage(): string {
  const target = window.location.pathname;
  try {
    const from = document.referrer ? new URL(document.referrer) : null;
    if (from && from.host === window.location.host && from.pathname !== target) {
      return `Page not found: ${target} (linked from ${from.pathname})`;
    }
  } catch {
    // an unparseable referrer just drops the "linked from" part
  }
  return `Page not found: ${target} (linked from inside the app)`;
}

/**
 * The screen shown when a page fails, and the only place that failure is reported
 * to the app builder. Copy is hardcoded, not <Text>: <Text> reads platform strings
 * and this renders when whatever loads them may have thrown.
 *
 * Takes an already-classified {@link PlatformError} — the framework adapter decides
 * what a route error response is, because that is the only router-shaped part of
 * this screen.
 *
 * `dev` gates the message and stack; the adapter passes its own dev flag, and a
 * published app must never render either.
 *
 * A 404 is reported only when `deadLink` is set: a stray URL an app user typed, a
 * crawler probe, or a loader that found no record is noise, but a link inside the
 * app to a page no route serves is a broken page the app builder needs to hear about.
 *
 * A 403 is the app refusing an account that lacks the role, which is the app working:
 * it gets a no-access screen and is never reported.
 *
 * A page a publish has superseded fails for reasons its app builder cannot fix, so
 * once the served version is known to differ the screen offers a refresh instead
 * and reports nothing.
 */
export function ErrorScreen({
  error,
  dev = false,
  deadLink = false,
  updateCopy = resolveUpdateCopy(undefined),
}: {
  error: PlatformError;
  dev?: boolean;
  /** The app's own navigation led to a path no route serves. */
  deadLink?: boolean;
  /** Copy for the superseded-page case; the adapter resolves the app's own strings. */
  updateCopy?: UpdateCopy;
}) {
  const notFound = error.status === 404;
  const noAccess = error.status === 403;
  const stale = useUpdateState() === "stale";

  let heading = "Something went wrong";
  let details = "This page didn't load. Trying again usually fixes it.";
  let statusLine: string | undefined;
  let stack: string | undefined;

  if (stale) {
    heading = "This app was just updated";
    details = "Refresh to load the latest version.";
  } else if (notFound) {
    heading = "Page not found";
    details = "This page doesn't exist, or it moved somewhere else.";
  } else if (noAccess) {
    heading = "You don't have access to this page";
    details = "Your account isn't allowed to open it. Go back home, or sign in with a different account.";
  } else if (error.status !== undefined) {
    // Keep the code on screen so an app user reporting the problem can quote it.
    statusLine = [error.status, error.statusText].filter(Boolean).join(" ");
  } else if (dev) {
    details = error.message;
    stack = error.stack;
  }

  // The framework renders this boundary for render-phase throws, so window's "error"
  // event never fires — this is the only place holding the error.
  useEffect(() => {
    let cancelled = false;
    void checkForUpdate().then(() => {
      if (cancelled || noAccess || (notFound && !deadLink) || getUpdateState() === "stale") return;
      try {
        window.postMessage(
          {
            source: "stencil-app",
            type: "render-error",
            status: error.status,
            error: {
              message: deadLink ? deadLinkMessage() : error.message,
              stack: error.stack ?? "",
            },
          },
          "*",
        );
      } catch {
        // best-effort — never let reporting throw inside the error boundary
      }
    });
    return () => {
      cancelled = true;
    };
  }, [error, notFound, noAccess, deadLink]);

  // Reloading a 404 or a refusal only re-renders it, so home leads those cases — unless
  // the page is stale, when a reload is exactly what fetches the version that has it.
  const reloads = stale || !(notFound || noAccess);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {stale ? (
            <RefreshCwIcon className="size-6" />
          ) : notFound ? (
            <CompassIcon className="size-6" />
          ) : noAccess ? (
            <LockIcon className="size-6" />
          ) : (
            <TriangleAlertIcon className="size-6" />
          )}
        </span>
        <h1 className="font-display text-2xl leading-tight tracking-tight text-balance">
          {heading}
        </h1>
        <p className="mt-2.5 text-muted-foreground text-balance">{details}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {reloads ? (
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`${ACTION} ${PRIMARY}`}
              >
                {stale ? updateCopy.action : "Try again"}
              </button>
              <a href="/" className={`${ACTION} ${OUTLINE}`}>
                Back to home
              </a>
            </>
          ) : (
            <>
              <a href="/" className={`${ACTION} ${PRIMARY}`}>
                Back to home
              </a>
              {noAccess ? (
                // /logout confirms before ending the session, and sends a signed-out visitor home.
                <a href="/logout" className={`${ACTION} ${OUTLINE}`}>
                  Use a different account
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className={`${ACTION} ${OUTLINE}`}
                >
                  Go back
                </button>
              )}
            </>
          )}
        </div>
        {statusLine && (
          <p className="mt-6 font-mono text-xs text-muted-foreground">{statusLine}</p>
        )}
        {stack && (
          <pre className="mt-8 max-h-40 w-full overflow-auto rounded-lg border bg-muted p-4 text-left font-mono text-xs text-muted-foreground">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
