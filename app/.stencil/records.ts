/**
 * `~stencil/records` — search the app's own records, by word and by meaning.
 *
 * Both calls run over the whole table server-side and return ranked rows, so
 * a search never depends on which rows a page happened to load. Pass the scope
 * the loader would otherwise put in its own query (`eq(t.createdBy, user.id)`).
 * Server only — loaders, actions and scheduled handlers.
 *
 *   const db = createDb(env);
 *   const hits = await searchRecords(db, posts, "mothman sighting", { where: eq(posts.createdBy, user.id) });
 *   const near = await nearestRecords(db, posts, queryVector, { column: posts.embedding, where: eq(posts.createdBy, user.id) });
 */
import { and, getTableColumns, getTableName, isNotNull, sql, type InferSelectModel, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

type Db = Pick<DrizzleD1Database, "select">;

export type SearchRecordsOptions = {
  /** Text columns to match against. Default: every text column except ids, timestamps and `created_by`. */
  in?: SQLiteColumn[];
  /** The scope filter the loader would otherwise write itself, e.g. `eq(table.createdBy, user.id)`. */
  where?: SQL;
  /** Default 50. */
  limit?: number;
  offset?: number;
};

export type NearestRecordsOptions = {
  /** The json column holding each row's embedding, as `embed()` returned it. */
  column: SQLiteColumn;
  where?: SQL;
  /** Default 10. */
  limit?: number;
  offset?: number;
};

export type SearchHit<T extends SQLiteTable> = InferSelectModel<T> & { score: number };
export type NearestHit<T extends SQLiteTable> = InferSelectModel<T> & { similarity: number };

const MAX_TERMS = 8;
// Every term × column pair binds one value, and D1 refuses more than 100 per statement.
const MAX_MATCHES = 80;
const NOT_SEARCHED = new Set(["id", "created_at", "updated_at", "created_by"]);

/**
 * Word search: every word of `query` must appear (case-insensitively) in at
 * least one of the searched columns. Rows are ranked by how the words match —
 * a column that starts with the word outranks one that merely contains it —
 * and `score` is returned on each row.
 */
export async function searchRecords<T extends SQLiteTable>(
  db: Db,
  table: T,
  query: string,
  opts: SearchRecordsOptions = {},
): Promise<SearchHit<T>[]> {
  const terms = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))].slice(0, MAX_TERMS);
  if (terms.length === 0) return [];
  if ("score" in getTableColumns(table)) {
    throw new Error(`searchRecords: "${getTableName(table)}" has its own \`score\` column, which the match score would replace.`);
  }
  const columns = opts.in ?? defaultSearchColumns(table);
  if (columns.length === 0) {
    throw new Error(`searchRecords: "${getTableName(table)}" has no text column to search; pass \`in\`.`);
  }
  if (terms.length * columns.length > MAX_MATCHES) {
    throw new Error(
      `searchRecords: at most ${Math.floor(MAX_MATCHES / terms.length)} columns for a ${terms.length}-word query.`,
    );
  }

  // A product, not a sum, so one unmatched word (score 0) drops the row.
  const score = sql.join(
    terms.map((term) => termScore(columns, term)),
    sql` * `,
  );
  const ranked = db
    .select({ ...getTableColumns(table), score: score.as("score") })
    .from(table)
    .where(opts.where)
    .as("ranked");
  const rows = await db
    .select()
    .from(ranked)
    .where(sql`"ranked"."score" > 0`)
    .orderBy(sql`"ranked"."score" desc`)
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
  return rows as unknown as SearchHit<T>[];
}

/** 3 when the column starts with the term, 1 when it contains it, 0 otherwise; the best column wins. */
function termScore(columns: SQLiteColumn[], term: string): SQL {
  const perColumn = columns.map(
    (col) => sql`(case instr(lower(coalesce(${col}, '')), ${term}) when 0 then 0 when 1 then 3 else 1 end)`,
  );
  if (perColumn.length === 1) return perColumn[0]!;
  return sql`max(${sql.join(perColumn, sql`, `)})`;
}

function defaultSearchColumns(table: SQLiteTable): SQLiteColumn[] {
  return Object.values(getTableColumns(table)).filter(
    (col) => col.dataType === "string" && !col.name.endsWith("_id") && !NOT_SEARCHED.has(col.name),
  );
}

/**
 * Meaning search: the rows whose stored embedding is closest to `vector` by
 * cosine similarity, best first, with `similarity` (−1..1) on each row. The
 * comparison runs in the worker over every in-scope row that has an embedding,
 * which is fine up to a few thousand rows. Rows whose embedding is missing or
 * of another length than `vector` are skipped.
 */
export async function nearestRecords<T extends SQLiteTable>(
  db: Db,
  table: T,
  vector: number[],
  opts: NearestRecordsOptions,
): Promise<NearestHit<T>[]> {
  const tableColumns = getTableColumns(table);
  if ("similarity" in tableColumns) {
    throw new Error(`nearestRecords: "${getTableName(table)}" has its own \`similarity\` column, which the result would replace.`);
  }
  const key = Object.entries(tableColumns).find(([, col]) => col === opts.column)?.[0];
  if (!key) throw new Error(`nearestRecords: the column is not on "${getTableName(table)}".`);
  const rows = (await db
    .select()
    .from(table)
    .where(and(isNotNull(opts.column), opts.where))) as unknown as Record<string, unknown>[];

  const hits: (Record<string, unknown> & { similarity: number })[] = [];
  for (const row of rows) {
    const stored = toVector(row[key]);
    if (!stored || stored.length !== vector.length) continue;
    hits.push({ ...row, similarity: cosine(vector, stored) });
  }
  hits.sort((a, b) => b.similarity - a.similarity);
  const offset = opts.offset ?? 0;
  return hits.slice(offset, offset + (opts.limit ?? 10)) as unknown as NearestHit<T>[];
}

function toVector(value: unknown): number[] | null {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  return parsed.every((n) => typeof n === "number") ? (parsed as number[]) : null;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const norm = Math.sqrt(na) * Math.sqrt(nb);
  return norm === 0 ? 0 : dot / norm;
}
