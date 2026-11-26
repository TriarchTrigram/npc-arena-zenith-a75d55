import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/**
 * The Stencil locale route pack: the endpoint `<LanguageSwitcher>` posts an app
 * user's language choice to. Spread it into `app/routes.ts` with a RELATIVE import,
 * above the catch-all, the way the other packs are.
 */
export const stencilLocaleRoutes: RouteConfigEntry[] = [
  route("__stencil/locale", ".stencil/react-router/locale/route.ts"),
];
