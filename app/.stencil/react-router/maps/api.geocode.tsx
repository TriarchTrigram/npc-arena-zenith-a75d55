import type { LoaderFunctionArgs } from "react-router";
import { getSession } from "../../auth/server";
import { createGeocoder } from "../../geocode";

/**
 * `GET /api/geocode?q=<address>` — what the pin picker's search box calls.
 * Signed-in app users only, so an open page cannot run up the lookup bill.
 * Typed from react-router's own argument types: this pack is opt-in, so typegen
 * has no `./+types` for it in an app that has not spread it.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const session = await getSession(request, env);
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    throw new Response("Missing q", { status: 400 });
  }
  const result = await createGeocoder(env).lookup(q);
  return Response.json({ result });
}
