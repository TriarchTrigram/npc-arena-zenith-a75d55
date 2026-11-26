import { useEffect } from "react";
import { isDispatcherPage } from "../platform-paths";

/**
 * A click on an in-app link to a dispatcher-owned page becomes a full-document navigation,
 * whatever the app's route table does with that path. A capture listener on the document
 * runs before the router's click handler, and `preventDefault` makes that handler stand down.
 */
export function usePlatformPageLinks(): void {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !isDispatcherPage(url.pathname)) return;
      event.preventDefault();
      window.location.assign(url.href);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}
