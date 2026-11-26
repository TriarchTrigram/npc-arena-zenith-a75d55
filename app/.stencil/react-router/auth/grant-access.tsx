import type { HandlerArgs } from "../../types/context";
import { verifyPlatformBearer } from "../../internal";
import { grantAccess, type WelcomeCopy } from "../../auth/grant";
import { SignupRefusedError } from "../../auth/hooks";

/**
 * POST /api/auth/internal/grant-access — the platform→app entry point for
 * `grantAccess`, bearer-gated with the same injected secret as the scheduled
 * route. Body: { email, name?, linkOrigin?, signInLink?, welcomeEmail?,
 * welcomeCopy?, signupAttribution?, emailVerified? } →
 * { userId, outcome, signInUrl? } as JSON, or 422 { error } when the app's own
 * sign-up rules decline the address; the welcome token is only ever
 * emailed, never part of the response — except under `signInLink` (see
 * `GrantAccessInput`), which additionally returns a short-lived sign-in URL.
 * `signInLink`, `welcomeEmail`, `welcomeCopy` and `emailVerified` are honoured
 * only with the `x-stencil-internal` header, which the dispatcher strips from
 * public traffic — so a caller holding just the bearer secret can neither obtain
 * a URL, suppress the email, nor create a verified account.
 */
export async function action({ request, context }: HandlerArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  const env = context.cloudflare.env;

  const unauthorized = verifyPlatformBearer(request, env);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    name?: unknown;
    linkOrigin?: unknown;
    signInLink?: unknown;
    welcomeEmail?: unknown;
    welcomeCopy?: unknown;
    signupAttribution?: unknown;
    emailVerified?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email.includes("@")) {
    return Response.json({ error: "a valid email is required" }, { status: 400 });
  }
  const name = typeof body?.name === "string" ? body.name : undefined;
  const signupAttribution =
    typeof body?.signupAttribution === "string" ? body.signupAttribution : undefined;
  // An unparseable origin falls back to the request host rather than failing the
  // grant — the emailed link must go out either way.
  let linkOrigin: string | undefined;
  if (typeof body?.linkOrigin === "string") {
    try {
      linkOrigin = new URL(body.linkOrigin).origin;
    } catch {}
  }

  const internal = request.headers.has("x-stencil-internal");
  const welcomeCopy = internal ? welcomeCopyFrom(body?.welcomeCopy) : undefined;

  try {
    const { userId, outcome, signInUrl } = await grantAccess(
      request,
      env,
      {
        email,
        name,
        linkOrigin,
        signInLink: body?.signInLink === true && internal,
        welcomeEmail: body?.welcomeEmail === false && internal ? false : true,
        welcomeCopy,
        signupAttribution,
        emailVerified: body?.emailVerified === true && internal,
      },
      context.cloudflare.ctx,
    );
    return Response.json({ userId, outcome, ...(signInUrl ? { signInUrl } : {}) });
  } catch (err) {
    if (err instanceof SignupRefusedError) {
      return Response.json({ error: err.message }, { status: 422 });
    }
    // Surface a 500 so the calling worker retries, instead of throwing past here.
    console.error("[grant-access] failed:", err);
    return Response.json({ error: "grant failed" }, { status: 500 });
  }
}

const WELCOME_COPY_FIELDS = ["subject", "heading", "intro", "buttonLabel"] as const;

/** The string fields of a welcomeCopy body, or undefined when none is usable. */
function welcomeCopyFrom(value: unknown): WelcomeCopy | undefined {
  if (!value || typeof value !== "object") return undefined;
  const copy: WelcomeCopy = {};
  for (const key of WELCOME_COPY_FIELDS) {
    const text = (value as Record<string, unknown>)[key];
    if (typeof text === "string" && text.trim()) copy[key] = text.trim();
  }
  return Object.keys(copy).length ? copy : undefined;
}
