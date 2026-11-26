import { redirect, useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { BACKEND_BASE, createBackendFetch } from "../../backend";
import { forwardCookies } from "../../auth/two-factor";
import { redeemSignInLink } from "../../auth/redeem-sign-in-link";
import { authCallbackUrl } from "../../auth/server";
import { isSignedLinkUsed, markSignedLinkUsed } from "../../auth/signed-sign-in";

type Refusal = "not_configured" | "invalid" | "expired" | "used" | "removed";

type PlatformAnswer =
  | { ok: true; signInUrl: string; next: string }
  | { ok: false; reason: Refusal };

const REFUSED: Record<Refusal, string> = {
  not_configured: "This app does not accept signed sign-in links.",
  invalid: "This sign-in link is not valid.",
  expired: "This sign-in link has expired.",
  used: "This sign-in link was already used.",
  removed: "The owner of this app removed your access.",
};

/** /sign-in/signed — where a signed sign-in link lands. As on /sign-in/link, a GET only shows a
 *  Continue button so a link preview changes nothing; the POST has the platform check the
 *  signature and create the account, then signs the person in. */
export async function loader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  return {
    host: new URL(request.url).hostname,
    complete: Boolean(params.get("email") && params.get("exp") && params.get("sig")),
  };
}

export function headers() {
  return { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const params = new URL(request.url).searchParams;
  const link = {
    email: params.get("email") ?? "",
    exp: params.get("exp") ?? "",
    next: params.get("next") ?? "",
    sig: params.get("sig") ?? "",
  };
  if (!link.email || !link.exp || !link.sig) return { refused: "invalid" as const };
  if (await isSignedLinkUsed(env, link.sig)) return { refused: "used" as const };

  // The platform holds the secret and the removed-address check, so it verifies the
  // link and creates or reactivates the account; the app only gets a sign-in token.
  const res = await createBackendFetch(env)(`${BACKEND_BASE}/users/signed-sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(link),
  });
  if (!res.ok) throw new Error(`signed sign-in: platform answered ${res.status}`);
  const answer = (await res.json()) as PlatformAnswer;
  if (!answer.ok) return { refused: answer.reason };
  if (!(await markSignedLinkUsed(env, link.sig, Number(link.exp)))) {
    return { refused: "used" as const };
  }

  const verified = await redeemSignInLink(request, env, {
    token: new URL(answer.signInUrl).searchParams.get("token"),
    callbackURL: authCallbackUrl(answer.next),
    errorCallbackURL: "/login",
  });
  const location = verified.headers.get("location");
  if (location) return redirect(location, { headers: forwardCookies(verified) });
  return verified;
}

export default function SignedSignIn() {
  const { host, complete } = useLoaderData() as { host: string; complete: boolean };
  const refused = (useActionData() as { refused?: Refusal } | undefined)?.refused;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form method="post" className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-medium">Sign in to {host}</h1>
        {complete && !refused ? (
          <>
            <p className="mt-2 text-muted-foreground">Tap to finish signing in.</p>
            <button
              type="submit"
              className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-muted-foreground">
              {refused ? REFUSED[refused] : "This link is not complete."}
            </p>
            <p className="mt-6 text-sm">
              <a href="/login" className="hover:underline">
                Go to sign in
              </a>
            </p>
          </>
        )}
      </form>
    </main>
  );
}
