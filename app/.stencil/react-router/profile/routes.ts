import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/**
 * The Stencil public-profile route pack: /profile/:userId, a page anyone can open that
 * shows one app user's name and photo. Off unless the app spreads it into `app/routes.ts`
 * (RELATIVE import, above the catch-all): only an app whose builder asked for profiles does.
 */
export const stencilPublicProfileRoutes: RouteConfigEntry[] = [
  route("profile/:userId", ".stencil/react-router/profile/public-profile.tsx"),
];
