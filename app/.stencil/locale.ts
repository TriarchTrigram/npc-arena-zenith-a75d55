import { ensureLocaleColumn } from "./auth/ensure-tables";
import { getSession } from "./auth/server";
import { requestLanguage } from "./request-context";
import { LOCALE_COOKIE, pickLocale } from "./strings";

/** The language the signed-in app user chose, or null when nobody is signed in or
 *  nothing was chosen. A failed read logs and resolves as no choice: the page still renders. */
export async function storedLocale(request: Request, env: Env): Promise<string | null> {
  try {
    const session = await getSession(request, env);
    if (!session) return null;
    await ensureLocaleColumn(env);
    const row = await env.DB.prepare("SELECT `stencil_locale` AS locale FROM `user` WHERE `id` = ?")
      .bind(session.user.id)
      .first<{ locale: string | null }>();
    return row?.locale ?? null;
  } catch (err) {
    console.warn(`[locale] stored language could not be read for app ${env.APP_ID}:`, err);
    return null;
  }
}

/**
 * The language app user `userId` chose, when the app still speaks it; undefined otherwise,
 * as on an app with one language. For work done for someone other than the person behind
 * the request (a schedule, a send to many): pass it as `language` to `ai.languageModel`.
 */
export async function appUserLanguage(env: Env, userId: string): Promise<string | undefined> {
  const languages = requestLanguage.getStore()?.languages;
  if (!languages) return undefined;
  try {
    const row = await env.DB.prepare("SELECT `stencil_locale` AS locale FROM `user` WHERE `id` = ?")
      .bind(userId)
      .first<{ locale: string | null }>();
    return pickLocale(row?.locale, languages);
  } catch (err) {
    // The column is added when the first app user saves a language, so it may not exist.
    if (!/no such column/i.test(String(err))) throw err;
    return undefined;
  }
}

/** Remember `locale` on the app user's row, so it follows them to their next device. */
export async function saveStoredLocale(env: Env, userId: string, locale: string): Promise<void> {
  await ensureLocaleColumn(env);
  await env.DB.prepare("UPDATE `user` SET `stencil_locale` = ? WHERE `id` = ?").bind(locale, userId).run();
}

/** The `Set-Cookie` value that remembers `locale` for a browser, signed in or not. */
export function localeCookie(locale: string): string {
  return `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
