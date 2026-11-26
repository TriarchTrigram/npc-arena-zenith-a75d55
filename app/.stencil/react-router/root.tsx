import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useMatches, useNavigate, useRevalidator, useRouteLoaderData } from "react-router";
import { captureFirstTouch } from "../auth/attribution";
import { isValidTimeZone, viewerTimeZoneCookies } from "../time";
import type { Tenant } from "../types/tenant";
import { NavigationBridge } from "../ui/navigation-bridge";
import { LocaleProvider, type AppLocale } from "../ui/language-switcher";
import { UnsplashCreditsProvider } from "../ui/photo/unsplash";
import { StringsProvider } from "../ui/strings";
import { isSellerPlanRedirect, SellerPlanNotice } from "../ui/payments/seller-plan-notice";
import { UpdateNotice } from "../ui/update-notice";
import { usePlatformPageLinks } from "./platform-page-links";
import { mergeStrings } from "./strings";

/**
 * Everything the platform needs rendered at the app root, in one wrapper.
 *
 * Pinned in `app/root.tsx` around `<Outlet />`. It supplies platform strings to
 * every `<Text>` below it, runs the preview navigation bridge, keeps the viewer's
 * timezone in step with their browser, credits every Unsplash photo whose caption is
 * hidden, shows the update notice once a publish has superseded the page and tells a
 * seller sent to the upgrade page that selling needs a plan.
 * All need the router, which is why they are wired here rather than in the
 * components themselves — those stay framework-free so a static frontend can
 * render them.
 *
 *   export default function App() {
 *     return (
 *       <StencilRoot>
 *         <Outlet />
 *       </StencilRoot>
 *     );
 *   }
 *
 * Strings come from the root loader, which `withStrings` populates, plus any
 * `strings` a matched route's loader returns (`privateStrings` after its access
 * check). A root that lost its loader renders copy as empty rather than throwing.
 */
export function StencilRoot({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const matches = useMatches();
  useEffect(() => {
    captureFirstTouch();
  }, []);
  usePlatformPageLinks();
  useViewerTimeZoneSync();
  const locale = useLocale();
  const sellerNeedsPlan = isSellerPlanRedirect(useLocation().search);

  const strings = matches.reduce<Record<string, unknown>>((all, match) => {
    const own = (match.data as { strings?: unknown } | undefined)?.strings;
    return own && typeof own === "object" ? mergeStrings(all, own as Record<string, unknown>) : all;
  }, {});

  return (
    <>
      {/* Read by the App preview editor, which writes a text edit to the language the page rendered. */}
      <meta name="stencil-locale" content={locale.locale} />
      <NavigationBridge navigate={navigate} />
      <StringsProvider strings={strings}>
        <LocaleProvider value={locale}>
          <UnsplashCreditsProvider>{children}</UnsplashCreditsProvider>
          <SellerPlanNotice shown={sellerNeedsPlan} />
          <UpdateNotice />
        </LocaleProvider>
      </StringsProvider>
    </>
  );
}

/**
 * The IANA timezone of the person viewing this page, as the server resolved it
 * for this request. Read from the root loader, which `withStrings` populates, so
 * any component can format a stored timestamp without threading the zone through
 * its own loader: `formatDateTimeInZone(row.createdAt, useViewerTimeZone())`.
 */
export function useViewerTimeZone(): string {
  const data = useRouteLoaderData("root") as { viewerTimeZone?: string } | undefined;
  return data?.viewerTimeZone ?? "UTC";
}

// The server only knows the connection's zone, which can be missing or wrong. After
// mount the browser's own zone is written to a cookie and the loaders re-run once, so
// this and every later request render in the zone the viewer actually lives in.
function useViewerTimeZoneSync(): void {
  const serverZone = useViewerTimeZone();
  const { revalidate } = useRevalidator();
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(browserZone) || browserZone === serverZone) return;
    for (const cookie of viewerTimeZoneCookies(browserZone, window.self !== window.top, window.location.protocol === "https:")) {
      document.cookie = cookie;
    }
    revalidate();
  }, [serverZone, revalidate]);
}

/**
 * The language this page is rendered in, its writing direction and every language the
 * app speaks, as the server resolved them for this request. Read from the root loader,
 * which `withStrings` populates; a root that lost its loader reads as English, left to right.
 */
export function useLocale(): AppLocale {
  const data = useRouteLoaderData("root") as Partial<AppLocale> | undefined;
  const locale = data?.locale ?? "en";
  return { locale, dir: data?.dir ?? "ltr", locales: data?.locales ?? [locale] };
}

/**
 * The app user whose subdomain this page is being served on, or null when it is
 * not on anyone's own address. Read from the root loader, which `withTenant`
 * populates — resolving it here means one lookup for the whole page.
 */
export function useTenant(): Tenant | null {
  const data = useRouteLoaderData("root") as { tenant?: Tenant | null } | undefined;
  return data?.tenant ?? null;
}
