import { createAuth } from "../../auth/utils";
import type { Route } from "./+types/api.auth.$";
import { handleBypass } from "../../auth/bypass";
import { ensureTwoFactorSchema } from "../../auth/ensure-tables";
import { ensureMcpTables } from "../../mcp/ensure-tables";
import { handleDcrThrottle } from "../../mcp/dcr-throttle";

/** Better Auth catch-all for /api/auth/*. */
async function authHandler({
  request,
  context,
}: Route.LoaderArgs | Route.ActionArgs) {
  await ensureTwoFactorSchema(context.cloudflare.env);

  // Apps provisioned before the MCP tables shipped create them on first OAuth
  // traffic; the register/authorize/token endpoints all live under these paths.
  const { pathname } = new URL(request.url);
  if (pathname.includes("/oauth2") || pathname.includes("/mcp")) {
    await ensureMcpTables(context.cloudflare.env);
  }

  const throttled = await handleDcrThrottle(request, context.cloudflare.env);
  if (throttled) return throttled;

  const auth = createAuth(context.cloudflare.env, false, context.cloudflare.ctx, request)

  const bypassResponse = await handleBypass(request, auth, context.cloudflare.env);
  if (bypassResponse) return bypassResponse;

  if (request.method !== "GET" || !pathname.endsWith("/get-session")) return auth.handler(request);
  // Better Auth answers a failed session lookup with a 500; a database error behind it is
  // usually gone a moment later, so the sign-in check gets one more try.
  const first = await auth.handler(request.clone() as typeof request);
  if (first.status !== 500) return first;
  await new Promise((resolve) => setTimeout(resolve, 150));
  return auth.handler(request);
}

export const loader = authHandler;
export const action = authHandler;
