import type { LoaderFunctionArgs } from "react-router";
import { createStorage, imageTransformFromRequest, serveR2Object } from "../../storage";
import { ACCOUNT_PHOTO_PREFIX } from "../../auth/account-photos";

/** /auth/account/photo/* — serves a photo an app user uploaded on the account page.
 *  Public by key, like every stored avatar: the key carries a random id, and other
 *  app users must be able to see it beside a name. `?width=` and friends resize it. */
export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const file = params["*"] ?? "";
  if (!file || file.includes("..")) return new Response("Not found", { status: 404 });
  return serveR2Object(createStorage(env), `${ACCOUNT_PHOTO_PREFIX}${file}`, request, {
    transform: imageTransformFromRequest(request, env),
  });
}
