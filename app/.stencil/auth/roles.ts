import { isDraft } from "../context";
import { requireAuth, PLATFORM_USER_EMAILS, previewRole } from "./server";

// The one answer to "is this app user an admin": the Role field on the Stencil Users page
// writes `app_role`, and every admin gate in the app reads it through these helpers. The
// preview user is admin on the App preview only (or the role the Builder Agent's check signed in
// with), and every reader here says so, not just the gate.

// Roles live in their own table rather than on Better Auth's `user` table, so the
// sign-up insert never touches them and an app whose D1 predates roles keeps working.
const ROLE_TABLE_DDL =
  "CREATE TABLE IF NOT EXISTS `app_role` (`user_id` text PRIMARY KEY NOT NULL, `role` text NOT NULL);";

let ensured = false;

async function ensureRoleTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.prepare(ROLE_TABLE_DDL).run();
  ensured = true;
}

// Keyed on the draft slot first so the published app never pays the lookup and never
// answers admin for a platform account (it holds no session for one there anyway).
async function isPlatformUserId(env: Env, userId: string): Promise<boolean> {
  if (!isDraft(env)) return false;
  const marks = PLATFORM_USER_EMAILS.map(() => "?").join(", ");
  const row = await env.DB.prepare(`SELECT 1 AS hit FROM \`user\` WHERE \`id\` = ? AND \`email\` IN (${marks})`)
    .bind(userId, ...PLATFORM_USER_EMAILS)
    .first();
  return row != null;
}

/** The role the Stencil Users page gave this app user, or "user" when it gave none. The
 *  preview user reads as "admin" on the App preview, or as the role the Builder Agent's check
 *  asked to be seen as, so landing redirects and nav built on this answer agree with `requireRole`. */
export async function getRole(env: Env, userId: string): Promise<string> {
  if (await isPlatformUserId(env, userId)) return (await previewRole()) ?? "admin";
  await ensureRoleTable(env);
  const row = await env.DB.prepare("SELECT `role` FROM `app_role` WHERE `user_id` = ?")
    .bind(userId)
    .first<{ role: string }>();
  return row?.role ?? "user";
}

export async function hasRole(env: Env, userId: string, role: string): Promise<boolean> {
  return (await getRole(env, userId)) === role;
}

/** Give an app user a role, or take it away with `null`. One role per app user. */
export async function setRole(env: Env, userId: string, role: string | null): Promise<void> {
  await ensureRoleTable(env);
  if (role === null) {
    await env.DB.prepare("DELETE FROM `app_role` WHERE `user_id` = ?").bind(userId).run();
    return;
  }
  await env.DB.prepare(
    "INSERT INTO `app_role` (`user_id`, `role`) VALUES (?, ?) ON CONFLICT(`user_id`) DO UPDATE SET `role` = excluded.`role`",
  )
    .bind(userId, role)
    .run();
}

/** Require a signed-in app user who holds `role`: redirects to /login when signed out,
 *  throws a 403 for anyone else. */
export async function requireRole(request: Request, env: Env, role: string) {
  const result = await requireAuth(request, env);
  const held = await getRole(env, result.user.id);
  if (held !== role) throw new Response("Forbidden", { status: 403 });
  return { ...result, role: held };
}
