import { getCookies } from "better-auth/cookies";
import { makeSignature } from "better-auth/crypto";
import { isDraft } from "../context";
import { createAuth, verifyJwt } from "./utils";
import { PLATFORM_USER_EMAILS, PREVIEW_ROLE_COOKIE, PREVIEW_ROLE_PATTERN, safeReturnTo } from "./server";

export async function handleBypass(
  request: Request,
  auth: ReturnType<typeof createAuth>,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/auth/bypass") return null;

  const fallback = Response.redirect(
    new URL("/app", request.url).toString(),
    302,
  );
  try {
    // The preview user only ever signs in on the draft slot.
    if (!isDraft(env)) return fallback;
    const token = url.searchParams.get("token");
    if (!token) return fallback;

    const payload = await verifyJwt<{ sub: string; role?: string }>(token, env.BETTER_AUTH_SECRET);
    if (!payload?.sub) return fallback;

    const ctx = await auth.$context;
    // Only the platform's own users may enter here: the preview flow and the
    // Builder Agent's verification are the sole legitimate signers, so a token
    // for any other app user is rejected.
    const user = await ctx.internalAdapter.findUserById(payload.sub);
    if (!user || !PLATFORM_USER_EMAILS.includes(user.email)) return fallback;

    const session = await ctx.internalAdapter.createSession(payload.sub);
    const signedToken = `${session.token}.${await makeSignature(session.token, ctx.secret)}`;

    const { sessionToken } = getCookies(auth.options);
    const a = sessionToken.attributes;
    const cookieParts = [
      `${sessionToken.name}=${signedToken}`,
      `Path=${a.path}`,
      a.httpOnly ? "HttpOnly" : null,
      a.secure ? "Secure" : null,
      `SameSite=${a.sameSite}`,
      a.maxAge != null ? `Max-Age=${a.maxAge}` : null,
    ]
      .filter(Boolean)
      .join("; ");

    const dest = safeReturnTo(url.searchParams.get("returnTo"));
    const headers = new Headers({ Location: dest });
    headers.append("Set-Cookie", cookieParts);
    // The role the signer asked this account to be seen as; the role helpers read it on the draft slot.
    if (typeof payload.role === "string" && PREVIEW_ROLE_PATTERN.test(payload.role)) {
      const flags = `Path=/; HttpOnly; SameSite=Lax${a.secure ? "; Secure" : ""}`;
      headers.append("Set-Cookie", `${PREVIEW_ROLE_COOKIE}=${encodeURIComponent(payload.role)}; ${flags}`);
    }

    return new Response(null, { status: 302, headers });
  } catch {
    return fallback;
  }
}
