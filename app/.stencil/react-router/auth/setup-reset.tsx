import { Form, redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { isPreviewUser, requireAuth, safeReturnTo } from "../../auth/server";
import { resetSetup } from "../../auth/setup";

/** /auth/setup/reset — the App preview's account starts first-login setup over, so the
 *  flow can be checked without editing data. Only the platform's own accounts may use it,
 *  and only on the draft slot, so no app user can be sent back through setup from here. */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  if (!isPreviewUser(user, env)) throw new Response("Not Found", { status: 404 });
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  if (!isPreviewUser(user, env)) throw new Response("Forbidden", { status: 403 });
  await resetSetup(env, user.id);
  const form = await request.formData();
  throw redirect(safeReturnTo(form.get("returnTo")?.toString()));
}

export default function SetupReset() {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-medium">Start setup over?</h1>
      <p className="mt-2 text-muted-foreground">
        The preview account goes back to the first setup step, as a new app user would see it.
      </p>
      <Form method="post" className="mt-6 flex gap-3">
        <button
          type="submit"
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Start over
        </button>
        <a
          href="/app"
          className="flex-1 rounded-md border border-border px-4 py-2 text-center text-sm font-medium hover:bg-muted"
        >
          Cancel
        </a>
      </Form>
    </main>
  );
}
