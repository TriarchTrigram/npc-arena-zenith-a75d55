import type { LoaderFunctionArgs } from "react-router";
import { isGuardName, issueFormToken } from "../../form-guard";

/**
 * `GET /__stencil/form-guard?form=<name>`: the signed token `<FormGuard>` puts in a public
 * form, which `guardForm` checks when the form is posted. Fetched by the page once it has
 * loaded, so a prerendered page gets a fresh one too.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const form = new URL(request.url).searchParams.get("form") ?? "";
  if (!isGuardName(form)) throw new Response("Unknown form name", { status: 400 });
  const token = await issueFormToken(context.cloudflare.env, form);
  return Response.json({ token }, { headers: { "cache-control": "no-store" } });
}
