import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { displayName } from "./display-name";
import { user } from "./schema";
import { PLATFORM_USER_EMAILS } from "./server";

/** What anyone may see of an app user: the name and photo they set on the account page. */
export type PublicProfile = { id: string; name: string; image: string | null };

/** The public profile of one app user, or null when there is no such account. Never
 *  returns the email; the platform's own preview accounts have no profile. */
export async function getPublicProfile(env: Env, userId: string): Promise<PublicProfile | null> {
  const [row] = await createDb(env)
    .select({ id: user.id, name: user.name, image: user.image, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row || PLATFORM_USER_EMAILS.includes(row.email)) return null;
  return { id: row.id, name: displayName(row), image: row.image ?? null };
}
