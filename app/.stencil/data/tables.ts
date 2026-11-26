/**
 * Compile-time table types for the data SDK — `db.from("<slug>")` returns rows
 * typed per table, derived from `app/generated/db-schema.ts` (the same file the
 * drizzle path uses). Types only: nothing here changes a request or a response.
 *
 * `EntityRegistry` maps each table slug to its drizzle `$inferSelect` row —
 * camelCase keys, `boolean` for checkbox columns, `unknown` for json columns,
 * `T | null` for optional ones — which is exactly the shape the engine returns.
 * `EntityRefs` maps each table's foreign-key columns to the table they point at,
 * so an `expand` resolves to the target table's row type.
 */
import type { EntityRefs, EntityRegistry } from "~/generated/db-schema";
import type { ExpandSpec, GetOptions, ListOptions } from "./request";
import type { DataRow } from "./types";

/** `"picture_days"` → `"pictureDays"` — the camelCase spelling `from()` also accepts. */
type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
  : S;

/** A table slug as `createEntity` made it (snake_case). */
export type TableSlug = keyof EntityRegistry & string;

/** What `from()` accepts: a table slug, or its camelCase spelling. */
export type TableName = TableSlug | SnakeToCamel<TableSlug>;

/** The snake_case slug behind either spelling. */
type SlugOf<N extends string> = N extends TableSlug
  ? N
  : { [S in TableSlug]: SnakeToCamel<S> extends N ? S : never }[TableSlug];

/** The row `list`/`get`/`create`/`update` return for a table. */
export type RowOf<N extends TableName> = EntityRegistry[SlugOf<N>];

/** Columns the engine sets itself; a write that names one is rejected. */
export type SystemColumn = "id" | "createdAt" | "updatedAt";

/**
 * What `create` and `update` take: any subset of the row's own columns. `create`
 * fills `createdBy` (and any other scope column) from the access rule, so a
 * screen never has to pass it — but it may.
 */
export type WriteOf<N extends TableName> = Partial<Omit<RowOf<N>, SystemColumn>>;

/** The refs of a table — `{}` when it has none (or the registry is empty). */
type RefsOf<N extends TableName> = SlugOf<N> extends keyof EntityRefs ? EntityRefs[SlugOf<N>] : {};

/**
 * What one `expand` key resolves to: the target table's row when the spec is a
 * ref column of this table (`"projectId"`) or names the table (`{ column, table }`);
 * an untyped row otherwise (a column the schema has no ref for). Always `| null`
 * at the call site — a missing parent is null, never an error.
 */
type ExpandTarget<N extends TableName, S> = S extends { table: infer T extends TableName }
  ? RowOf<T>
  : S extends keyof RefsOf<N>
    ? RefsOf<N>[S] extends TableName
      ? RowOf<RefsOf<N>[S]>
      : DataRow
    : DataRow;

/** A row plus the keys an `expand` option adds to it. */
export type Expanded<N extends TableName, O extends ListOptions | GetOptions | undefined> = O extends {
  expand: infer X extends Record<string, ExpandSpec>;
}
  ? RowOf<N> & { [K in keyof X]: ExpandTarget<N, X[K]> | null }
  : RowOf<N>;
