import { type RouteConfig, index, route } from "@react-router/dev/routes";
import { stencilAuthRoutes } from "./.stencil/react-router/auth/routes";
import { stencilMcpRoutes } from "./.stencil/react-router/mcp/routes";
import { stencilEventRoutes } from "./.stencil/react-router/events/routes";
import { stencilAgentRoutes } from "./.stencil/react-router/agents/routes";
import { stencilLocaleRoutes } from "./.stencil/react-router/locale/routes";
import { stencilWaitlistRoutes } from "./.stencil/react-router/waitlist/routes";

export default [
  index("routes/home.tsx"),
  route("roster", "routes/roster.tsx"),
  route("quests", "routes/quests.tsx"),
  // The character creator's "Your own power": the AI designs a power someone typed in.
  route("api/own-power", "routes/api.own-power.tsx"),
  // Progress codes: save this browser's progress under a code, or load a code's progress back.
  route("api/progress-code", "routes/api.progress-code.tsx"),
  // Developer mode: checks the developer code on the server.
  route("api/dev-mode", "routes/api.dev-mode.tsx"),
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
  // LAST, and it must stay last: it matches every path nothing above did.
  // Redirects the pages the dispatcher owns and 404s for everything else.
  route("*", ".stencil/react-router/catch-all/route.tsx"),
] satisfies RouteConfig;
