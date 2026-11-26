import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/**
 * The Stencil events route pack: the receiver the platform POSTs platform
 * events to (`on()` handlers run there) and the catalog of the events this
 * app declares in `app/events.ts`. Both are bearer-gated.
 *
 * Spread into your routes config, with a RELATIVE path — React Router's
 * config loader runs before tsconfig aliases resolve:
 *
 *   import { stencilEventRoutes } from "./.stencil/react-router/events/routes";
 *
 *   export default [
 *     ...stencilAuthRoutes,
 *     ...stencilEventRoutes,
 *   ] satisfies RouteConfig;
 */
export const stencilEventRoutes: RouteConfigEntry[] = [
  route("api/internal/events", ".stencil/react-router/events/receive.tsx"),
  route("api/internal/events/catalog", ".stencil/react-router/events/catalog.tsx"),
];
