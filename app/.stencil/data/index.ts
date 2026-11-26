/**
 * `~stencil/data` — the server-side data SDK.
 *
 * One call in a loader or action resolves the app user's session, and every
 * read or write it makes carries the table's access rule (from the entity's
 * `x-access`) and is verified by the engine before it runs. Rows come back
 * camelCase with booleans and parsed JSON, hidden columns stripped — and typed:
 * `from()` takes only a table the schema has, and every row is typed per column
 * from `app/generated/db-schema.ts` (see `./tables`), so no `String(row.x)`.
 *
 *   const db = await data(request, context.cloudflare.env);
 *   const tasks = await db.from("tasks").list({ where: { status: "open" }, orderBy: [["createdAt", "desc"]] });
 *   tasks[0].title.toUpperCase();                    // string, from the schema
 *   await db.from("tasks").create({ title });        // created_by filled from the rule
 *   await db.from("tasks").createMany(rows);         // any length: split under the database's limit, all or nothing
 *
 * Server only — import it from loaders, actions and server modules, never from
 * a component.
 */
import { accessRules } from "~/generated/access-rules";
import { getRole } from "../auth/roles";
import { getSession, isPreviewUser, requireAuth } from "../auth/server";
import { camelToSnake, d1Executor, verifyAndRun, type Executor } from "./engine";
import {
  buildClaimRequest,
  buildCreateManyRequest,
  buildCreateRequest,
  buildDeleteRequest,
  buildGetRequest,
  buildListRequest,
  buildUpdateRequest,
  type ClaimOptions,
  type GetOptions,
  type ListOptions,
} from "./request";
import type { Expanded, RowOf, TableName, WriteOf } from "./tables";
import type { AccessRules, Caller, DataRow, TableMeta } from "./types";
import { DataAccessError, isDataAccessError } from "./types";

export { DataAccessError, isDataAccessError };
export { moveRow, nextPosition, POSITION_GAP, type OrderOptions } from "./order";
export type { AccessRules, Caller, DataRow, TableMeta } from "./types";
export type { ClaimOptions, ExpandSpec, GetOptions, ListOptions, WhereValue } from "./request";
export type { Expanded, RowOf, SystemColumn, TableName, TableSlug, WriteOf } from "./tables";

/**
 * CRUD on one table, as the caller the client was created for. Rows are typed
 * from the schema (`RowOf<N>`); `expand` adds its keys to the row type, each
 * `<target row> | null`. `create`/`createMany`/`update` take any subset of the
 * row's own columns — never `id`, `createdAt` or `updatedAt`, which the engine
 * sets. `createMany` writes a list of any length in one atomic batch and returns
 * the new rows in input order. `claim` is an `update` that only lands while the
 * row still matches `where`, and returns null instead of the row when it did not
 * — the guard for anything that must happen once (a balance spent, a checkout
 * finalised, a slot booked) however many requests race for it.
 */
export interface TableClient<N extends TableName = TableName> {
  list<const O extends ListOptions = ListOptions>(opts?: O): Promise<Expanded<N, O>[]>;
  get<const O extends GetOptions = GetOptions>(id: string, opts?: O): Promise<Expanded<N, O>>;
  create(data: WriteOf<N>): Promise<RowOf<N>>;
  createMany(rows: WriteOf<N>[]): Promise<RowOf<N>[]>;
  update(id: string, data: WriteOf<N>): Promise<RowOf<N>>;
  claim(id: string, data: WriteOf<N>, opts: ClaimOptions): Promise<RowOf<N> | null>;
  delete(id: string): Promise<{ id: string }>;
}

export interface DataClient {
  /** The signed-in app user's id, or null for an anonymous visitor or the system caller. */
  readonly me: string | null;
  /** Who this client acts as. */
  readonly caller: Caller;
  /**
   * A table by slug (snake_case, or its camelCase spelling). Only a table the
   * schema has compiles; a dynamic name must be narrowed to `TableName` first.
   * Throws `unknownTable` at runtime for a table the app's rules do not have.
   */
  from<N extends TableName>(table: N): TableClient<N>;
}

export type DataOptions = {
  /** Redirect to /login when there is no session (default). `false` gives an anonymous caller for public pages. */
  requireUser?: boolean;
};

/**
 * A client for the app user behind `request`. With `requireUser` (the default)
 * an unauthenticated request is redirected to /login exactly like `requireAuth`.
 */
export async function data(request: Request, env: Env, opts: DataOptions = {}): Promise<DataClient> {
  const requireUser = opts.requireUser ?? true;
  let caller: Caller;
  if (requireUser) {
    const { user } = await requireAuth(request, env);
    caller = await userCaller(env, user);
  } else {
    const session = await getSession(request, env);
    caller = session ? await userCaller(env, session.user) : { kind: "anon" };
  }
  return createDataClient(caller, d1Executor(env.DB), accessRules);
}

/** The role is one extra query, so it is read only when some rule names `me.role`. */
const rulesUseRoles = JSON.stringify(accessRules).includes('"kind":"role"');

/** The preview user counts as admin on the App preview only, exactly as `requireRole` has it. */
async function userCaller(env: Env, user: { id: string; email: string }): Promise<Caller> {
  if (!rulesUseRoles) return { kind: "user", id: user.id };
  const role = isPreviewUser(user, env) ? "admin" : await getRole(env, user.id);
  return { kind: "user", id: user.id, role };
}

/**
 * A client that bypasses access rules — for server-only code such as webhooks,
 * crons and seeding. Never for a screen: a loader must go through `data()`.
 */
export function system(env: Env): DataClient {
  return createDataClient({ kind: "system" }, d1Executor(env.DB), accessRules);
}

/** Wire a caller, an executor and a rule set into a client. Exported for server code with its own executor. */
export function createDataClient(caller: Caller, executor: Executor, rules: AccessRules): DataClient {
  return {
    me: caller.kind === "user" ? caller.id : null,
    caller,
    from<N extends TableName>(table: N): TableClient<N> {
      const slug = camelToSnake(table);
      const meta: TableMeta | undefined = Object.hasOwn(rules.tables, slug) ? rules.tables[slug] : undefined;
      if (!meta) throw new DataAccessError("unknownTable", `Unknown table "${table}".`);
      // The engine works on untyped rows; the casts below are the one place the
      // schema-derived types meet it. Nothing about the requests changes.
      const client: TableClient<TableName> = {
        list: (opts) =>
          verifyAndRun(buildListRequest(meta, caller, opts), caller, rules, executor) as Promise<never>,
        get: (id, opts) =>
          verifyAndRun(buildGetRequest(meta, caller, id, opts), caller, rules, executor) as Promise<never>,
        create: (row) =>
          verifyAndRun(buildCreateRequest(meta, caller, row as DataRow), caller, rules, executor) as Promise<never>,
        createMany: (rows) =>
          verifyAndRun(buildCreateManyRequest(meta, caller, rows as DataRow[]), caller, rules, executor) as Promise<never>,
        update: (id, row) =>
          verifyAndRun(buildUpdateRequest(meta, id, row as DataRow), caller, rules, executor) as Promise<never>,
        claim: (id, row, opts) =>
          verifyAndRun(buildClaimRequest(meta, id, row as DataRow, opts), caller, rules, executor) as Promise<never>,
        delete: (id) => verifyAndRun(buildDeleteRequest(meta, id), caller, rules, executor),
      };
      return client as TableClient<N>;
    },
  };
}
