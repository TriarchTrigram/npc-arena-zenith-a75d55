import { APIError, createAuthMiddleware } from "better-auth/api";

/**
 * Consent rules the mcp plugin leaves to the client: it skips the consent screen unless the
 * request says `prompt=consent`, and its token endpoint also exchanges a code nobody approved.
 * Matched on Better Auth's own route, so no spelling of the URL reaches a handler around it.
 */
export const mcpOAuthGuard = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/mcp/authorize") {
    // An <img> or fetch aimed here carries the viewer's session; only a page they opened may ask.
    const dest = ctx.headers?.get("sec-fetch-dest");
    const mode = ctx.headers?.get("sec-fetch-mode");
    if ((dest && dest !== "document") || (mode && mode !== "navigate")) {
      console.warn(
        `[mcp-oauth] authorize refused for client ${ctx.query?.client_id}: not a page navigation (dest=${dest}, mode=${mode})`,
      );
      throw new APIError("BAD_REQUEST", {
        error: "invalid_request",
        error_description: "Open this link in a browser tab to continue.",
      });
    }
    return { context: { query: { ...ctx.query, prompt: "consent" } } };
  }

  if (ctx.path === "/mcp/token") {
    const body = ctx.body instanceof FormData ? Object.fromEntries(ctx.body.entries()) : ctx.body;
    const code = body?.code ? String(body.code) : null;
    if (!code) return;
    const row = await ctx.context.internalAdapter.findVerificationValue(code);
    const grant = row ? (JSON.parse(row.value) as { requireConsent?: boolean; clientId?: string }) : null;
    if (grant?.requireConsent) {
      console.warn(`[mcp-oauth] token refused for client ${grant.clientId}: the code was never approved`);
      throw new APIError("UNAUTHORIZED", { error: "invalid_grant", error_description: "invalid code" });
    }
  }
});
