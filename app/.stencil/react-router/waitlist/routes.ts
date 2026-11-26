import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/**
 * The Stencil waitlist route pack: the endpoint `<WaitlistForm>` posts an email to.
 * Spread it into `app/routes.ts` with a RELATIVE import, above the catch-all, the way
 * the other packs are.
 */
export const stencilWaitlistRoutes: RouteConfigEntry[] = [
  route("__stencil/waitlist", ".stencil/react-router/waitlist/route.ts"),
];
