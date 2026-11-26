import { useEffect } from "react";
import { RefreshCwIcon } from "lucide-react";
import { readString, useStrings } from "./strings";
import { useUpdateWatch } from "./update-watch";

export type UpdateCopy = { message: string; action: string };

const DEFAULT_COPY: UpdateCopy = {
  message: "A new version of this app is available.",
  action: "Refresh",
};

// Classes inlined, not imported from app-owned UI: this renders on a page whose
// bundle the server no longer serves, so it must depend on nothing else loading.
const ACTION =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-sm transition-all outline-none select-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px";

/** The notice copy: the app's own `platform.updateNotice.*` strings, or the default. */
export function resolveUpdateCopy(strings: Record<string, unknown> | undefined): UpdateCopy {
  return {
    message: readString(strings, "platform.updateNotice.message") ?? DEFAULT_COPY.message,
    action: readString(strings, "platform.updateNotice.action") ?? DEFAULT_COPY.action,
  };
}

// Shown once a publish has superseded the page. Nothing is interrupted: the page keeps
// working, and the next link click becomes a full navigation that lands on the new
// version where the app user was going.
export function UpdateNotice() {
  const stale = useUpdateWatch() === "stale";
  const copy = resolveUpdateCopy(useStrings());

  useEffect(() => {
    if (!stale) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const to = new URL(anchor.href, window.location.href);
      if (to.origin !== window.location.origin) return;
      if (to.hash && to.pathname === window.location.pathname && to.search === window.location.search) return;
      // The router's Link leaves a click alone once its default is prevented.
      event.preventDefault();
      window.location.assign(to.href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [stale]);

  if (!stale) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-background py-2 pr-2 pl-4 text-sm text-foreground shadow-lg">
        <RefreshCwIcon className="size-4 shrink-0 text-primary" />
        <span>{copy.message}</span>
        <button type="button" onClick={() => window.location.reload()} className={ACTION}>
          {copy.action}
        </button>
      </div>
    </div>
  );
}
