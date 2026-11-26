// The two_factor table and the user.two_factor_enabled flag ship in a new app's
// seed, but apps provisioned earlier have neither. Create them on first auth
// traffic; the flag keeps it to one pass per isolate (see mcp/ensure-tables.ts).
const TWO_FACTOR_DDL = [
  "CREATE TABLE IF NOT EXISTS `two_factor` (`id` text PRIMARY KEY NOT NULL, `secret` text NOT NULL, `backup_codes` text NOT NULL, `user_id` text NOT NULL, FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade);",
  "CREATE INDEX IF NOT EXISTS `two_factor_secret_idx` ON `two_factor` (`secret`);",
  "CREATE INDEX IF NOT EXISTS `two_factor_user_id_idx` ON `two_factor` (`user_id`);",
];

/** Add a `user` column once. A duplicate column is what an already-migrated
 *  app looks like, so it is the expected path. */
async function addUserColumn(env: Env, column: string): Promise<void> {
  try {
    await env.DB.prepare(`ALTER TABLE \`user\` ADD COLUMN ${column}`).run();
  } catch (err) {
    if (!/duplicate column name/i.test(String(err))) throw err;
  }
}

let ensured = false;

/** Idempotently add the two-factor schema to the workspace D1. */
export async function ensureTwoFactorSchema(env: Env): Promise<void> {
  if (ensured) return;
  // Only two-factor needs this schema, so a database error here must not fail the
  // auth request it rides on; `ensured` stays false and a later request tries again.
  try {
    await addUserColumn(env, "`two_factor_enabled` integer DEFAULT false");
    await env.DB.batch(TWO_FACTOR_DDL.map((sql) => env.DB.prepare(sql)));
    ensured = true;
  } catch (err) {
    console.error("[auth] two-factor schema setup failed, will retry on a later request:", err);
  }
}

let localeEnsured = false;

/** Idempotently add `user.stencil_locale`, the app user's chosen language. Called only
 *  on an app with a second language, so a one-language app's database is never touched. */
export async function ensureLocaleColumn(env: Env): Promise<void> {
  if (localeEnsured) return;
  await addUserColumn(env, "`stencil_locale` text");
  localeEnsured = true;
}
