/**
 * Who uploaded each stored file and how big it is, so an app user's stored bytes can be
 * counted. A file never recorded here (stored without an `allowance`) is in nobody's total.
 */

const DDL = [
  "CREATE TABLE IF NOT EXISTS `stencil_stored_file` (`key` text PRIMARY KEY NOT NULL, `owner` text NOT NULL, `size` integer NOT NULL, `created_at` integer NOT NULL);",
  "CREATE INDEX IF NOT EXISTS `stencil_stored_file_owner` ON `stencil_stored_file` (`owner`);",
];
// D1 refuses a statement with more than 100 bound values.
const KEYS_PER_STATEMENT = 90;

let ensured = false;

async function ensureTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.batch(DDL.map((sql) => env.DB.prepare(sql)));
  ensured = true;
}

/** The bytes `owner` has stored through routes that count an allowance. */
export async function storedBytesFor(env: Env, owner: string): Promise<number> {
  await ensureTable(env);
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(`size`), 0) AS `bytes` FROM `stencil_stored_file` WHERE `owner` = ?",
  )
    .bind(owner)
    .first<{ bytes: number }>();
  return row?.bytes ?? 0;
}

/** Record a finished file against the app user who uploaded it. Returns their stored bytes
 *  up to and including this file, so of two uploads finishing together only the later one
 *  can be over the total. */
export async function recordStoredFile(env: Env, file: { key: string; owner: string; size: number }): Promise<number> {
  await ensureTable(env);
  const [, counted] = await env.DB.batch<{ bytes: number }>([
    env.DB.prepare(
      "INSERT OR REPLACE INTO `stencil_stored_file` (`key`, `owner`, `size`, `created_at`) VALUES (?, ?, ?, ?)",
    ).bind(file.key, file.owner, file.size, Math.floor(Date.now() / 1000)),
    env.DB.prepare(
      "SELECT COALESCE(SUM(`size`), 0) AS `bytes` FROM `stencil_stored_file` WHERE `owner` = ? " +
        "AND `rowid` <= (SELECT `rowid` FROM `stencil_stored_file` WHERE `key` = ?)",
    ).bind(file.owner, file.key),
  ]);
  const row = counted?.results[0];
  if (!row) throw new Error(`stored-file count for ${file.key} returned no row`);
  return row.bytes;
}

/** Stop counting deleted files. `createStorage(env).delete` calls it; app code never does. */
export async function forgetStoredFiles(env: Env, keys: string[]): Promise<void> {
  await ensureTable(env);
  for (let i = 0; i < keys.length; i += KEYS_PER_STATEMENT) {
    const slice = keys.slice(i, i + KEYS_PER_STATEMENT);
    await env.DB.prepare(`DELETE FROM \`stencil_stored_file\` WHERE \`key\` IN (${slice.map(() => "?").join(", ")})`)
      .bind(...slice)
      .run();
  }
}
