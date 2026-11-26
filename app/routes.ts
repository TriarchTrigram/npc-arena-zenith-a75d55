import { type RouteConfig, index, route } from "@react-router/dev/routes";
import { stencilAuthRoutes } from "./.stencil/react-router/auth/routes";
import { stencilMcpRoutes } from "./.stencil/react-router/mcp/routes";
import { stencilEventRoutes } from "./.stencil/react-router/events/routes";
import { stencilAgentRoutes } from "./.stencil/react-router/agents/routes";
import { stencilLocaleRoutes } from "./.stencil/react-router/locale/routes";
import { stencilWaitlistRoutes } from "./.stencil/react-router/waitlist/routes";
import { stencilFormGuardRoutes } from "./.stencil/react-router/form-guard/routes";

export default [
  index("routes/home.tsx"),
  // The signed-in shell. An app nobody signs into drops this line and deletes the file.
  route("app", "routes/app.tsx"),
  // Trusted route the platform calls to run recurring actions (bearer-gated).
  // Keep it registered at this path.
  route("api/internal/scheduled", "routes/api.internal.scheduled.tsx"),
  // Trusted route the platform calls after deploy to verify payments is wired
  // up correctly (bearer-gated). Keep it registered.
  route("api/internal/payments-probe", "routes/api.internal.payments-probe.tsx"),
  // Trusted route the platform calls when a video render finishes (bearer-gated).
  // Keep it registered if the app renders video; remove it otherwise.
  route("api/internal/remotion-complete", "routes/api.internal.remotion-complete.tsx"),
  // Stencil auth route pack. Keep it registered even for a public-only app —
  // its files only type-check when these routes are registered, and an unused
  // /login costs nothing at runtime.
  ...stencilAuthRoutes,
  // Stencil events route pack (the platform's event receiver + this app's catalog).
  ...stencilEventRoutes,
  // Stencil MCP OAuth route pack (discovery documents + consent page).
  ...stencilMcpRoutes,
  // Stencil agents route pack (run status/stream, the platform's run events, the tool door).
  ...stencilAgentRoutes,
  // Stencil locale route pack (where <LanguageSwitcher> saves an app user's language).
  ...stencilLocaleRoutes,
  // Stencil waitlist route pack (where <WaitlistForm> sends an email sign-up).
  ...stencilWaitlistRoutes,
  // Stencil form-guard route pack (where <FormGuard> fetches a public form's bot-check token).
  ...stencilFormGuardRoutes,
  // LAST, and it must stay last: it matches every path nothing above did.
  // Redirects the pages the dispatcher owns and 404s for everything else.
  route("*", ".stencil/react-router/catch-all/route.tsx"),
] satisfies RouteConfig;
