import { redirect, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { forwardCookies } from "../../auth/two-factor";
import { redeemSignInLink } from "../../auth/redeem-sign-in-link";

/** /sign-in/link — where every emailed or shared sign-in link lands. A GET only
 *  shows a Continue button, so a chat app or mail scanner fetching the link for a
 *  preview changes nothing; the POST is what verifies the one-time token. */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return { host: url.hostname, hasToken: Boolean(url.searchParams.get("token")) };
}

export function headers() {
  return { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const res = await redeemSignInLink(request, context.cloudflare.env, {
    token: params.get("token"),
    callbackURL: params.get("callbackURL"),
    errorCallbackURL: params.get("errorCallbackURL"),
  });
  const location = res.headers.get("location");
  if (location) return redirect(location, { headers: forwardCookies(res) });
  return res;
}

export default function SignInLink() {
  const { host, hasToken } = useLoaderData() as { host: string; hasToken: boolean };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form method="post" className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-medium">Sign in to {host}</h1>
        {hasToken ? (
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
            <p className="mt-2 text-muted-foreground">This link is not complete.</p>
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
