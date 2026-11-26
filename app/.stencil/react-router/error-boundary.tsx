import { isRouteErrorResponse, useMatches, useRouteLoaderData } from "react-router";
import type { PlatformError } from "../types/error";
import { ErrorScreen } from "../ui/error-boundary";
import { resolveUpdateCopy } from "../ui/update-notice";

/** Classify whatever React Router threw into the shape the error screen renders. */
function normalise(error: unknown): PlatformError {
  if (isRouteErrorResponse(error)) {
    return {
      status: error.status,
      statusText: error.statusText,
      message: `${error.status} ${error.statusText || "error"}`.trim(),
    };
  }
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return {
    message: typeof error === "string" ? error : "An unexpected error occurred.",
  };
}

// The splat route that catches every path no other route serves; its loader is the
// only one that 404s because the page itself is missing.
const CATCH_ALL_ROUTE_ID = ".stencil/react-router/catch-all/route";

// React Router stamps an index on every in-router navigation, so a document that
// has moved at least once was navigated from inside the app; a full-page navigation
// starts over at zero and shows only through a same-site referrer.
function fromInsideApp(): boolean {
  if (typeof window === "undefined") return false;
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) return true;
  try {
    return !!document.referrer && new URL(document.referrer).host === window.location.host;
  } catch {
    return false;
  }
}

/**
 * The app's `ErrorBoundary`, pinned as a one-liner in `app/root.tsx`.
 *
 * Everything router-shaped lives here — deciding what counts as a route error
 * response, and whether this is a dev build. The screen itself is framework-free.
 */
export function PlatformErrorBoundary({ error }: { error: unknown }) {
  const unmatched = useMatches().some((m) => m.id === CATCH_ALL_ROUTE_ID);
  // Root loader data survives into the boundary unless the root loader itself threw.
  const data = useRouteLoaderData("root") as { strings?: Record<string, unknown> } | undefined;
  return (
    <ErrorScreen
      error={normalise(error)}
      dev={import.meta.env.DEV}
      deadLink={unmatched && fromInsideApp()}
      updateCopy={resolveUpdateCopy(data?.strings)}
    />
  );
}
