import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/**
 * The Stencil form-guard route pack: the endpoint `<FormGuard>` fetches its token from.
 * Spread it into `app/routes.ts` with a RELATIVE import, above the catch-all, the way
 * the other packs are.
 */
export const stencilFormGuardRoutes: RouteConfigEntry[] = [
  route("__stencil/form-guard", ".stencil/react-router/form-guard/route.ts"),
];
