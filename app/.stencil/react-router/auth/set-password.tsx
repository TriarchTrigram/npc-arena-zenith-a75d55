import { Form, data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { APIError } from "better-auth/api";
import { and, eq, isNotNull } from "drizzle-orm";
import { requireAuth, safeReturnTo } from "../../auth/server";
import { createAuth } from "../../auth/utils";
import { account } from "../../auth/schema";
import { createDb } from "../../db";

const MIN_LENGTH = 8;

/** /auth/set-password — a signed-in app user with no password yet (a pay-first buyer, a
 *  magic-link account) chooses one so email and password sign-in works from then on. Apps
 *  chain it in front of a landing page with `?next=`; an account with a password skips it. */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const next = safeReturnTo(new URL(request.url).searchParams.get("next"));
  if (await hasPassword(env, user.id)) throw redirect(next);
  return { next };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  await requireAuth(request, env);
  const form = await request.formData();
  const next = safeReturnTo(String(form.get("next") ?? ""));
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < MIN_LENGTH) {
    return data({ error: `Use at least ${MIN_LENGTH} characters.` }, { status: 400 });
  }
  if (password !== confirm) {
    return data({ error: "The two passwords don't match." }, { status: 400 });
  }

  // Server-only in Better Auth: there is no browser route for a first password.
  const auth = createAuth(env, false, undefined, request);
  try {
    await auth.api.setPassword({ body: { newPassword: password }, headers: request.headers });
  } catch (err) {
    if (!(err instanceof APIError) || err.statusCode >= 500) throw err;
    return data({ error: err.message }, { status: 400 });
  }
  throw redirect(next);
}

/** A credential account with a password set; the account page reads the same answer. */
export async function hasPassword(env: Env, userId: string): Promise<boolean> {
  const [row] = await createDb(env)
    .select({ id: account.id })
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential"), isNotNull(account.password)),
    )
    .limit(1);
  return Boolean(row);
}

export default function SetPassword() {
  const { next } = useLoaderData() as { next: string };
  const result = useActionData() as { error: string } | undefined;
  const busy = useNavigation().state !== "idle";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Form method="post" className="w-full max-w-sm">
        <h1 className="text-2xl font-medium">Choose a password</h1>
        <p className="mt-2 text-muted-foreground">
          You're signed in. Set a password now so you can sign back in with your email next time.
        </p>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="password" className="mt-6 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          autoFocus
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
        />
        <label htmlFor="confirm" className="mt-4 block text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
        />
        {result?.error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {result.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <a href={next} className="hover:underline">
            Skip for now
          </a>
        </p>
      </Form>
    </main>
  );
}
