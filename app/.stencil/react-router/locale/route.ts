import type { ActionFunctionArgs } from "react-router";
import { getSession } from "../../auth/server";
import { localeCookie, saveStoredLocale } from "../../locale";
import { appLocales, pickLocale } from "../../strings";

/**
 * `POST /__stencil/locale` with a `locale` form field: remembers the choice in the
 * `stencil_locale` cookie and, for a signed-in app user, on their row; a failed row write
 * answers 500 with no cookie. An app with one language answers 404.
 */
export function loader() {
  throw new Response("Not found", { status: 404 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const { locales } = appLocales(request);
  if (locales.length < 2) throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  const locale = pickLocale(String(form.get("locale") ?? ""), locales);
  if (!locale) throw new Response("Unknown language", { status: 400 });

  const session = await getSession(request, env);
  if (session) {
    try {
      await saveStoredLocale(env, session.user.id, locale);
    } catch (err) {
      // The stored language outranks the cookie, so a cookie alone would reload the old one.
      console.error(`[locale] could not save language ${locale} for app user ${session.user.id}:`, err);
      return Response.json({ error: "Language could not be saved" }, { status: 500 });
    }
  }
  return Response.json({ ok: true, locale }, { headers: { "set-cookie": localeCookie(locale) } });
}
