import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "~/generated/db-schema";
import { instrumentD1 } from "~stencil/db-stats";

/** Create a Drizzle database client backed by the workspace D1 database. */
export function createDb(env: Env) {
  return drizzle(instrumentD1(env.DB), { schema });
}

/** `column IN (values)` for a list of any length. Drizzle's `inArray` binds one parameter per
 *  value and D1 rejects a statement with more than 100; this sends the list as one JSON value. */
export function inList(column: AnyColumn, values: readonly (string | number)[]): SQL {
  return sql`${column} IN (SELECT value FROM json_each(${JSON.stringify(values)}))`;
}
