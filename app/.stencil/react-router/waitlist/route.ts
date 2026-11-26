import type { ActionFunctionArgs } from "react-router";
import { joinWaitlist } from "../../waitlist";

/**
 * `POST /__stencil/waitlist` with `email`, optional `name` and `source` form fields: adds
 * the address to the app's one waitlist, the list on the Users page. The answer is the
 * same for a new and a known address; `ok` is false only when the join itself failed.
 */
export function loader() {
  throw new Response("Not found", { status: 404 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const form = await request.formData();
  // `company` is a field no person sees; a bot that fills it gets the normal answer and no join.
  if (String(form.get("company") ?? "")) return Response.json({ ok: true });
  const ok = await joinWaitlist(context.cloudflare.env, {
    email: String(form.get("email") ?? "").trim(),
    name: String(form.get("name") ?? "").trim() || null,
    source: String(form.get("source") ?? "").trim() || "sign-up-form",
    request,
  });
  return Response.json({ ok }, { status: ok ? 200 : 502 });
}
