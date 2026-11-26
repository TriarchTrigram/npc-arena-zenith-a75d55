/**
 * Pure request builders for the data SDK — the sugar an app writes in a loader
 * turned into the exact request the engine verifies. No I/O, no session: given
 * a table's metadata and the caller, they compile the table's read rule with
 * the same `compileRule` the engine uses and put it first in the where, so the
 * engine's gate passes for a request the SDK built and fails for any other.
 */
import { camelToSnake, compileRule, roleHolds } from "./engine";
import type {
  AccessCondition,
  Caller,
  ClaimRequest,
  CreateManyRequest,
  CreateRequest,
  DeleteRequest,
  Expand,
  GetRequest,
  ListRequest,
  TableMeta,
  UpdateRequest,
  Where,
  WhereOp,
} from "./types";
import { DataAccessError } from "./types";

/** A filter value: plain equality, or `{ op, value }` for anything else. */
const CREATED_BY = "created_by";

export type WhereValue = unknown | { op: WhereOp; value?: unknown };

/** `expand: { project: "projectId" }` resolves the target via the column's ref; pass `{ column, table }` when it has none. */
export type ExpandSpec = string | { column: string; table: string };

export type ListOptions = {
  where?: Record<string, WhereValue>;
  orderBy?: [column: string, dir: "asc" | "desc"][];
  limit?: number;
  offset?: number;
  select?: string[];
  expand?: Record<string, ExpandSpec>;
};

export type GetOptions = {
  select?: string[];
  expand?: Record<string, ExpandSpec>;
};

/** What a `claim` must still find true on the row for its write to land; the same sugar as a list `where`. */
export type ClaimOptions = {
  where: Record<string, WhereValue>;
};

const WHERE_OPS: ReadonlySet<string> = new Set<WhereOp>([
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "in",
  "like",
  "isNull",
  "isNotNull",
]);

function isOpObject(value: unknown): value is { op: WhereOp; value?: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { op?: unknown }).op === "string" &&
    WHERE_OPS.has((value as { op: string }).op)
  );
}

/** The `where` sugar → a where tree (an `and` of one clause per key). */
export function whereFromSugar(where: Record<string, WhereValue> | undefined): Where | undefined {
  if (!where) return undefined;
  const clauses: Where[] = [];
  for (const [column, raw] of Object.entries(where)) {
    if (raw === undefined) continue;
    if (isOpObject(raw)) {
      if (raw.op === "isNull" || raw.op === "isNotNull") clauses.push({ column, op: raw.op });
      else clauses.push({ column, op: raw.op, value: raw.value });
    } else {
      clauses.push({ column, op: "=", value: raw });
    }
  }
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : { and: clauses };
}

/**
 * The where the engine will accept: the compiled read rule first, the app's
 * own filter after it. An unsatisfiable rule is passed through as the plain
 * filter — the engine is what says "forbidden", loudly, not the SDK.
 */
export function gatedWhere(
  meta: TableMeta,
  caller: Caller,
  clientWhere: Where | undefined,
): Where | undefined {
  const rule = compileRule(meta.access.read, caller);
  if (rule === "none" || rule === "unsatisfiable") return clientWhere;
  return clientWhere ? { and: [rule, clientWhere] } : { and: [rule] };
}

export function resolveExpand(
  meta: TableMeta,
  expand: Record<string, ExpandSpec> | undefined,
): Expand | undefined {
  if (!expand) return undefined;
  const out: Expand = {};
  for (const [key, spec] of Object.entries(expand)) {
    if (typeof spec === "string") {
      const col = camelToSnake(spec);
      const table = Object.hasOwn(meta.refs, col) ? meta.refs[col] : undefined;
      if (!table) {
        throw new DataAccessError(
          "invalid",
          `expand "${key}": column "${spec}" on "${meta.slug}" has no ref — pass { column, table }.`,
        );
      }
      out[key] = { column: spec, table };
    } else {
      out[key] = { column: spec.column, table: spec.table };
    }
  }
  return out;
}

export function buildListRequest(meta: TableMeta, caller: Caller, opts: ListOptions = {}): ListRequest {
  const request: ListRequest = { kind: "list", table: meta.slug };
  const where = gatedWhere(meta, caller, whereFromSugar(opts.where));
  if (where) request.where = where;
  if (opts.orderBy) request.orderBy = opts.orderBy.map(([column, dir]) => ({ column, dir }));
  if (opts.limit !== undefined) request.limit = opts.limit;
  if (opts.offset !== undefined) request.offset = opts.offset;
  if (opts.select) request.select = opts.select;
  const expand = resolveExpand(meta, opts.expand);
  if (expand) request.expand = expand;
  return request;
}

export function buildGetRequest(meta: TableMeta, caller: Caller, id: string, opts: GetOptions = {}): GetRequest {
  const request: GetRequest = { kind: "get", table: meta.slug, id };
  const where = gatedWhere(meta, caller, undefined);
  if (where) request.where = where;
  if (opts.select) request.select = opts.select;
  const expand = resolveExpand(meta, opts.expand);
  if (expand) request.expand = expand;
  return request;
}

/**
 * Columns the SDK fills with the caller's id on create: the `X = me` clauses of
 * the first `create` rule line that has any and whose role tests this caller
 * passes. This replaces the hand-written "scope column = signed-in app user id"
 * boilerplate.
 */
export function scopeColumns(conditions: AccessCondition[], caller: Caller): string[] {
  if (caller.kind !== "user") return [];
  for (const condition of conditions) {
    if (condition.kind !== "all") continue;
    if (condition.clauses.some((c) => c.kind === "role" && !roleHolds(c, caller))) continue;
    const cols: string[] = [];
    for (const c of condition.clauses) {
      if (c.kind === "compare" && c.op === "=" && c.value.kind === "me") cols.push(c.column);
    }
    if (cols.length > 0) return cols;
  }
  return [];
}

export function buildCreateRequest(
  meta: TableMeta,
  caller: Caller,
  data: Record<string, unknown>,
): CreateRequest {
  const filled: Record<string, unknown> = { ...data };
  if (caller.kind === "user") {
    const present = new Set(Object.keys(data).map(camelToSnake));
    for (const col of scopeColumns(meta.access.create, caller)) {
      if (!present.has(camelToSnake(col))) filled[col] = caller.id;
    }
    // `created_by` is the platform's creator stamp: fill it whenever the table has
    // the column, even when the create rule scopes by something else (a team hop,
    // say). Tables usually declare it NOT NULL, and a screen has no reason to pass it.
    if (Object.hasOwn(meta.columns, CREATED_BY) && !present.has(CREATED_BY)) {
      filled[CREATED_BY] = caller.id;
    }
  }
  return { kind: "create", table: meta.slug, data: filled };
}

export function buildCreateManyRequest(
  meta: TableMeta,
  caller: Caller,
  rows: Record<string, unknown>[],
): CreateManyRequest {
  return { kind: "createMany", table: meta.slug, rows: rows.map((row) => buildCreateRequest(meta, caller, row).data) };
}

export function buildUpdateRequest(meta: TableMeta, id: string, data: Record<string, unknown>): UpdateRequest {
  return { kind: "update", table: meta.slug, id, data };
}

export function buildClaimRequest(
  meta: TableMeta,
  id: string,
  data: Record<string, unknown>,
  opts: ClaimOptions,
): ClaimRequest {
  const where = whereFromSugar(opts?.where);
  if (!where) throw new DataAccessError("invalid", "claim needs at least one where condition.");
  return { kind: "claim", table: meta.slug, id, data, where };
}

export function buildDeleteRequest(meta: TableMeta, id: string): DeleteRequest {
  return { kind: "delete", table: meta.slug, id };
}
