import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/**
 * The Stencil maps route pack: the address lookup the pin picker's search box
 * calls. Spread into your routes config, with a RELATIVE path — React Router's
 * config loader runs before tsconfig aliases resolve:
 *
 *   import { stencilMapRoutes } from "./.stencil/react-router/maps/routes";
 *
 *   export default [
 *     index("routes/home.tsx"),
 *     ...stencilMapRoutes,
 *   ] satisfies RouteConfig;
 */
export const stencilMapRoutes: RouteConfigEntry[] = [
  route("api/geocode", ".stencil/react-router/maps/api.geocode.tsx"),
];
