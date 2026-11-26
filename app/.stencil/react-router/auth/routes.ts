import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/**
 * The Stencil auth route pack: /logout, the account page and its photos, the
 * two-factor pages, the set-password page, the sign-in link landing page, the
 * preview's setup reset and /api/auth/*.
 *
 * Spread into your routes config, with a RELATIVE path — React Router's
 * config loader runs before tsconfig aliases resolve:
 *
 *   import { stencilAuthRoutes } from "./.stencil/react-router/auth/routes";
 *
 *   export default [
 *     index("routes/home.tsx"),
 *     ...stencilAuthRoutes,
 *   ] satisfies RouteConfig;
 */
export const stencilAuthRoutes: RouteConfigEntry[] = [
  route("logout", ".stencil/react-router/auth/logout.tsx"),
  route("auth/account", ".stencil/react-router/auth/account.tsx"),
  route("auth/account/photo/*", ".stencil/react-router/auth/account-photo.tsx"),
  route("auth/two-factor", ".stencil/react-router/auth/two-factor.tsx"),
  route("auth/two-factor/setup", ".stencil/react-router/auth/two-factor-setup.tsx"),
  route("auth/set-password", ".stencil/react-router/auth/set-password.tsx"),
  route("auth/setup/reset", ".stencil/react-router/auth/setup-reset.tsx"),
  route("sign-in/link", ".stencil/react-router/auth/sign-in-link.tsx"),
  route("sign-in/signed", ".stencil/react-router/auth/signed-sign-in.tsx"),
  // Static path outranks the /api/auth/* splat below, so this never reaches
  // the Better Auth handler.
  route("api/auth/internal/grant-access", ".stencil/react-router/auth/grant-access.tsx"),
  route("api/auth/*", ".stencil/react-router/auth/api.auth.$.tsx"),
];
