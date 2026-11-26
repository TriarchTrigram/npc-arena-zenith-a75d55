/**
 * The access-rule engine behind `~stencil/data`.
 *
 * Gate, never filter: the engine does not add a table's access rule to a
 * query. It checks that the request already carries the rule (the SDK puts it
 * there), runs the request untouched, or rejects it. Identifiers are validated
 * against the generated table metadata before anything is interpolated into
 * SQL; every value is a bound `?` parameter.
 *
 * Self-contained: no imports from outside the layer, no ORM.
 */
import type {
  AccessClause,
  AccessCompareClause,
  AccessCondition,
  AccessRoleClause,
  AccessRules,
  AccessValue,
  Caller,
  ClaimRequest,
  ColumnType,
  CreateManyRequest,
  CreateRequest,
  DataRequest,
  DataResult,
  DataRow,
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

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export type Statement = { sql: string; params: unknown[] };

/** The only thing the engine needs from a database. */
export interface Executor {
  all(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  run(sql: string, params: unknown[]): Promise<{ changes: number }>;
  /** Runs every statement or none of them. */
  batch(statements: Statement[]): Promise<void>;
}

/** D1 rejects a statement with more than 100 bound parameters; 90 leaves headroom. */
export const MAX_BOUND_PARAMS = 90;

/** `col IN (…)` over a list of any length as ONE bound value: the list travels as a JSON
 *  array that json_each expands inside the database, so it can never hit the parameter cap. */
export function inListSql(col: string, list: unknown[], params: unknown[]): string {
  params.push(JSON.stringify(list.map(toParam)));
  return `${col} IN (SELECT value FROM json_each(?))`;
}

/** Executor over the app's D1 binding. */
export function d1Executor(db: D1Database): Executor {
  return {
    async all(sql, params) {
      const result = await db.prepare(sql).bind(...params).all();
      return (result.results ?? []) as Record<string, unknown>[];
    },
    async run(sql, params) {
      const result = await db.prepare(sql).bind(...params).run();
      return { changes: result.meta?.changes ?? 0 };
    },
    async batch(statements) {
      await db.batch(statements.map((s) => db.prepare(s.sql).bind(...s.params)));
    },
  };
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

export function camelToSnake(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Columns every entity table has, whether or not the generated metadata lists them. */
const SYSTEM_COLUMNS: Record<string, ColumnType> = {
  id: "text",
  created_at: "text",
  updated_at: "text",
};

/** snake_case columns and slugs; entity slugs may be kebab-case (`support-tickets`). */
const IDENT = /^[a-z_][a-z0-9_-]*$/;

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

// ---------------------------------------------------------------------------
// Rule compilation — shared by the SDK (to build) and the engine (to verify)
// ---------------------------------------------------------------------------

/**
 * Compile a rule's OR'd lines into the where the caller must carry.
 *
 * - `"none"`: no constraint — some line grants the caller everything.
 * - `"unsatisfiable"`: no line can hold for this caller → the action is forbidden.
 * - a `Where`: the constraint; lines are OR'd, clauses inside a line AND'd.
 *
 * An anonymous caller is satisfied only by `public`. A system caller never
 * needs a rule (`"none"`). A `me.role` clause is decided here, from the caller:
 * a line whose role test fails is dropped, and one with nothing else left grants.
 */
export function compileRule(
  conditions: AccessCondition[],
  caller: Caller,
): Where | "none" | "unsatisfiable" {
  if (caller.kind === "system") return "none";
  const lines: Where[] = [];
  for (const condition of conditions) {
    switch (condition.kind) {
      case "public":
        return "none";
      case "anyone":
        if (caller.kind === "user") return "none";
        break;
      case "nobody":
        break;
      case "all": {
        if (caller.kind !== "user") break;
        if (condition.clauses.some((c) => c.kind === "role" && !roleHolds(c, caller))) break;
        const rowClauses = condition.clauses.filter((c): c is RowClause => c.kind !== "role");
        if (rowClauses.length === 0) return "none";
        lines.push({
          and: rowClauses.map((clause) => compileClause(clause, caller.id)),
        });
        break;
      }
    }
  }
  if (lines.length === 0) return "unsatisfiable";
  return lines.length === 1 ? lines[0]! : { or: lines };
}

type RowClause = Exclude<AccessClause, AccessRoleClause>;

/** An app user the Users page gave no role is "user"; a visitor holds no role at all. */
export function roleHolds(clause: AccessRoleClause, caller: Caller): boolean {
  if (caller.kind !== "user") return false;
  const role = caller.role ?? "user";
  const v = clause.value;
  if (clause.op === "in") return v.kind === "list" && v.values.includes(role);
  const expected = v.kind === "literal" ? v.value : undefined;
  return clause.op === "=" ? role === expected : role !== expected;
}

function compileClause(clause: RowClause, me: string): Where {
  if (clause.kind === "compare") return compileCompare(clause, me);
  return {
    column: clause.column,
    op: "inSubquery",
    table: clause.table,
    targetColumn: clause.targetColumn,
    where: { and: clause.where.map((c) => compileCompare(c, me)) },
  };
}

function compileCompare(clause: AccessCompareClause, me: string): Where {
  return { column: clause.column, op: clause.op, value: bindValue(clause.value, me) };
}

function bindValue(value: AccessValue, me: string): unknown {
  switch (value.kind) {
    case "me":
      return me;
    case "literal":
      return value.value;
    case "list":
      return value.values;
  }
}

// ---------------------------------------------------------------------------
// Validation and normalization
// ---------------------------------------------------------------------------

function tableMeta(rules: AccessRules, name: string): TableMeta {
  const slug = camelToSnake(name);
  const meta = Object.hasOwn(rules.tables, slug) ? rules.tables[slug] : undefined;
  if (!meta || !IDENT.test(slug)) {
    throw new DataAccessError("unknownTable", `Unknown table "${name}".`);
  }
  return meta;
}

function columnType(meta: TableMeta, name: string): ColumnType {
  const col = camelToSnake(name);
  const type = lookupColumnType(meta, col);
  if (!type || !IDENT.test(col)) {
    throw new DataAccessError(
      "unknownColumn",
      `Unknown column "${name}" on table "${meta.slug}".`,
    );
  }
  return type;
}

/** Own-property lookup so `constructor`, `__proto__` and friends are unknown columns, not Object.prototype hits. */
function lookupColumnType(meta: TableMeta, col: string): ColumnType | undefined {
  if (Object.hasOwn(meta.columns, col)) return meta.columns[col];
  if (Object.hasOwn(SYSTEM_COLUMNS, col)) return SYSTEM_COLUMNS[col];
  return undefined;
}

/** Validate a column against the table and return its snake_case name. */
function column(meta: TableMeta, name: string): string {
  columnType(meta, name);
  return camelToSnake(name);
}

/** The `visibleTo` map with snake_case column keys. */
function visibleTo(meta: TableMeta): [string, AccessCondition[]][] {
  return Object.entries(meta.access.visibleTo ?? {}).map(([col, conditions]) => [camelToSnake(col), conditions]);
}

/** A line a visitor can be judged on: plain column tests, nothing about who is asking. */
function identityFree(condition: AccessCondition & { kind: "all" }): boolean {
  return condition.clauses.every((c) => c.kind === "compare" && c.value.kind !== "me");
}

/**
 * How a `visibleTo` column reaches this caller: on every row, on no row, or
 * decided per row. A visitor is only ever decided per row, by identity-free
 * lines, and that says nothing about reading the row: the read rule still
 * needs `public`.
 */
function columnVisibility(conditions: AccessCondition[], caller: Caller): "all" | "none" | "row" {
  if (caller.kind === "system") return "all";
  let perRow = false;
  for (const condition of conditions) {
    switch (condition.kind) {
      case "public":
        return "all";
      case "anyone":
        if (caller.kind === "user") return "all";
        break;
      case "nobody":
        break;
      case "all":
        if (caller.kind !== "user") {
          if (identityFree(condition)) perRow = true;
          break;
        }
        if (condition.clauses.some((c) => c.kind === "role" && !roleHolds(c, caller))) break;
        if (condition.clauses.every((c) => c.kind === "role")) return "all";
        perRow = true;
    }
  }
  return perRow ? "row" : "none";
}

/** Columns this caller may never see, filter, sort or write. */
function hiddenSet(meta: TableMeta, caller: Caller): Set<string> {
  if (caller.kind === "system") return new Set();
  const hidden = new Set(meta.access.hidden.map(camelToSnake));
  if (caller.kind === "anon") {
    for (const col of meta.access.hiddenFromPublic ?? []) hidden.add(camelToSnake(col));
  }
  for (const [col, conditions] of visibleTo(meta)) {
    if (columnVisibility(conditions, caller) === "none") hidden.add(col);
  }
  return hidden;
}

/** Columns this caller receives only on rows that satisfy their `visibleTo` conditions. */
function rowGatedSet(meta: TableMeta, caller: Caller): Set<string> {
  const gated = new Set<string>();
  if (caller.kind === "system") return gated;
  for (const [col, conditions] of visibleTo(meta)) {
    if (columnVisibility(conditions, caller) === "row") gated.add(col);
  }
  return gated;
}

/**
 * Columns this caller may not filter, sort or expand on. A row-gated column is
 * included: a filter on it would reveal its value on the rows that hide it.
 */
function unfilterableSet(meta: TableMeta, caller: Caller): Set<string> {
  const out = hiddenSet(meta, caller);
  for (const col of rowGatedSet(meta, caller)) out.add(col);
  return out;
}

/** The `visibleTo` conditions for one row, decided in memory (hops are not allowed in them). */
function visibleOnRow(meta: TableMeta, conditions: AccessCondition[], caller: Caller, row: DataRow): boolean {
  if (caller.kind === "system") return true;
  for (const condition of conditions) {
    switch (condition.kind) {
      case "public":
        return true;
      case "anyone":
        if (caller.kind === "user") return true;
        break;
      case "nobody":
        break;
      case "all":
        if (caller.kind !== "user" && !identityFree(condition)) break;
        if (condition.clauses.every((c) => c.kind !== "hop" && clauseHolds(meta, c, caller, row))) return true;
    }
  }
  return false;
}

/** A clause about who is asking (`me`, `me.role`) never holds for a visitor. */
function clauseHolds(
  meta: TableMeta,
  clause: AccessCompareClause | AccessRoleClause,
  caller: Caller,
  row: DataRow,
): boolean {
  if (clause.kind === "role") return roleHolds(clause, caller);
  if (caller.kind !== "user" && clause.value.kind === "me") return false;
  const col = column(meta, clause.column);
  return compare(row[snakeToCamel(col)], clause.op, bindValue(clause.value, caller.kind === "user" ? caller.id : ""));
}

/**
 * Who authored a where subtree. `rule` = compiled by the engine from the
 * table's access rule (may use `inSubquery` and may name hidden columns);
 * `client` = written by the app (no `inSubquery`, and for app users no hidden
 * columns — otherwise a `like` filter on a hidden column is an oracle for it);
 * `system` = a system caller's own where (identifier-checked only).
 */
type WhereSource = "rule" | "client" | "system";

/**
 * Validate every identifier in a where tree and return a copy with snake_case
 * columns. `inSubquery` targets are validated against their own table.
 */
function normalizeWhere(
  rules: AccessRules,
  meta: TableMeta,
  caller: Caller,
  where: Where,
  source: WhereSource,
): Where {
  if (!where || typeof where !== "object") throw invalid("A where clause must be an object.");
  if ("and" in where) {
    if (!Array.isArray(where.and)) throw invalid("`and` must be a list.");
    return { and: where.and.map((w) => normalizeWhere(rules, meta, caller, w, source)) };
  }
  if ("or" in where) {
    if (!Array.isArray(where.or)) throw invalid("`or` must be a list.");
    return { or: where.or.map((w) => normalizeWhere(rules, meta, caller, w, source)) };
  }
  if (typeof where.column !== "string") throw invalid("A where clause needs a column.");
  if (where.op === "inSubquery") {
    if (source === "client") {
      throw invalid('Operator "inSubquery" is engine-internal: a hop is expressed by the table\'s access rule, not by a filter.');
    }
    const col = column(meta, where.column);
    const target = tableMeta(rules, where.table);
    const targetColumn = column(target, where.targetColumn);
    return {
      column: col,
      op: "inSubquery",
      table: target.slug,
      targetColumn,
      where: normalizeWhere(rules, target, caller, where.where, source),
    };
  }
  if (!WHERE_OPS.has(where.op)) throw invalid(`Unknown operator "${String(where.op)}".`);
  const col = column(meta, where.column);
  if (source === "client" && unfilterableSet(meta, caller).has(col)) {
    throw new DataAccessError("forbidden", `forbidden: column "${col}" is hidden.`);
  }
  if (where.op === "in" && !Array.isArray(where.value)) {
    throw invalid(`Operator "in" on "${col}" needs a list value.`);
  }
  if (where.op === "isNull" || where.op === "isNotNull") {
    return { column: col, op: where.op };
  }
  return { column: col, op: where.op, value: where.value };
}

function invalid(message: string): DataAccessError {
  return new DataAccessError("invalid", message);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bKeys = Object.keys(bo).filter((k) => bo[k] !== undefined);
  if (keys.length !== bKeys.length) return false;
  return keys.every((k) => deepEqual(ao[k], bo[k]));
}

/**
 * The gate for reads: validate and normalize the request's where, and for an
 * app user or anonymous caller require the compiled read rule to be the first
 * member of a top-level `and`. Both sides are normalized before the deep-equal
 * so a camelCase spelling in the rule (a hop's table, a column) still matches.
 * The rule prefix is the only place `inSubquery` (and, for app users, a hidden
 * column) may appear; everything after it is the app's own filter.
 */
function verifyReadWhere(
  rules: AccessRules,
  meta: TableMeta,
  caller: Caller,
  where: Where | undefined,
): Where | undefined {
  if (caller.kind === "system") {
    return where ? normalizeWhere(rules, meta, caller, where, "system") : undefined;
  }
  const rule = compileRule(meta.access.read, caller);
  if (rule === "unsatisfiable") {
    throw new DataAccessError(
      "forbidden",
      `forbidden: ${callerLabel(caller)} may not read "${meta.slug}".`,
    );
  }
  if (rule === "none") {
    return where ? normalizeWhere(rules, meta, caller, where, "client") : undefined;
  }
  const expected = normalizeWhere(rules, meta, caller, rule, "rule");
  const first =
    where && typeof where === "object" && "and" in where && Array.isArray(where.and) ? where.and[0] : undefined;
  const actual = first ? normalizeWhere(rules, meta, caller, first, "rule") : undefined;
  if (!actual || !deepEqual(actual, expected)) {
    throw new DataAccessError(
      "forbidden",
      `forbidden: query does not satisfy the table's access rule for "${meta.slug}".`,
    );
  }
  const rest = (where as { and: Where[] }).and.slice(1).map((w) => normalizeWhere(rules, meta, caller, w, "client"));
  return { and: [expected, ...rest] };
}

function callerLabel(caller: Caller): string {
  return caller.kind === "anon" ? "an anonymous visitor" : "this app user";
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

function q(ident: string): string {
  // Identifiers are validated against the metadata before they get here; the
  // escape is belt-and-braces so an embedded quote can never close the string.
  return `"${ident.replace(/"/g, '""')}"`;
}

/** Compile an already-normalized where to SQL, pushing bound values onto `params`. */
function whereSql(where: Where, params: unknown[]): string {
  if ("and" in where) {
    if (where.and.length === 0) return "1=1";
    return `(${where.and.map((w) => whereSql(w, params)).join(" AND ")})`;
  }
  if ("or" in where) {
    if (where.or.length === 0) return "0=1";
    return `(${where.or.map((w) => whereSql(w, params)).join(" OR ")})`;
  }
  const col = q(where.column);
  if (where.op === "inSubquery") {
    const inner = whereSql(where.where, params);
    return `${col} IN (SELECT ${q(where.targetColumn)} FROM ${q(where.table)} WHERE ${inner})`;
  }
  switch (where.op) {
    case "isNull":
      return `${col} IS NULL`;
    case "isNotNull":
      return `${col} IS NOT NULL`;
    case "in": {
      const list = where.value as unknown[];
      if (list.length === 0) return "0=1";
      return inListSql(col, list, params);
    }
    case "=":
      if (where.value === null || where.value === undefined) return `${col} IS NULL`;
      params.push(toParam(where.value));
      return `${col} = ?`;
    case "!=":
      if (where.value === null || where.value === undefined) return `${col} IS NOT NULL`;
      params.push(toParam(where.value));
      return `${col} != ?`;
    case "like":
      params.push(toParam(where.value));
      return `${col} LIKE ?`;
    default:
      params.push(toParam(where.value));
      return `${col} ${where.op} ?`;
  }
}

/** A JS value as SQLite can bind it. */
function toParam(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return value;
}

// ---------------------------------------------------------------------------
// Row conversion
// ---------------------------------------------------------------------------

/** DB row → SDK row: camelCase keys, integer → boolean, json → parsed. */
function fromDb(meta: TableMeta, row: Record<string, unknown>): DataRow {
  const out: DataRow = {};
  for (const [key, raw] of Object.entries(row)) {
    const type = lookupColumnType(meta, key);
    let value = raw;
    if (raw !== null && raw !== undefined) {
      if (type === "integer") value = raw === 1 || raw === true || raw === "1";
      else if (type === "json" && typeof raw === "string") {
        try {
          value = JSON.parse(raw);
        } catch {
          value = raw;
        }
      }
    }
    out[snakeToCamel(key)] = value;
  }
  return out;
}

/** One SDK value → what gets bound for its column. */
function toDb(type: ColumnType, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (type === "json") return typeof value === "string" ? value : JSON.stringify(value);
  if (type === "integer" && typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

/** Drop what this caller may not receive on this row; runs on the whole row, before any `select`. */
function stripHidden(meta: TableMeta, caller: Caller, row: DataRow): DataRow {
  const hidden = hiddenSet(meta, caller);
  // An app user's id is never shown to a visitor, but a public page may still filter by it.
  if (caller.kind === "anon") hidden.add("created_by");
  for (const [col, conditions] of visibleTo(meta)) {
    if (!hidden.has(col) && !visibleOnRow(meta, conditions, caller, row)) hidden.add(col);
  }
  if (hidden.size === 0) return row;
  const out: DataRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (!hidden.has(camelToSnake(key))) out[key] = value;
  }
  return out;
}

/** Keep only the selected columns — plus every expansion key, which `select` never names. */
function project(row: DataRow, select: string[] | undefined, expandKeys: string[]): DataRow {
  if (!select) return row;
  const out: DataRow = {};
  for (const key of select) {
    const camel = snakeToCamel(camelToSnake(key));
    if (Object.hasOwn(row, camel)) out[camel] = row[camel];
  }
  for (const key of expandKeys) {
    if (Object.hasOwn(row, key)) out[key] = row[key];
  }
  return out;
}

/** Validate a `select` list: known columns, and never hidden for app users. */
function checkSelect(meta: TableMeta, caller: Caller, select: string[] | undefined): void {
  if (!select) return;
  const hidden = hiddenSet(meta, caller);
  for (const name of select) {
    const col = column(meta, name);
    if (hidden.has(col)) {
      throw new DataAccessError("forbidden", `forbidden: column "${col}" is hidden.`);
    }
  }
}

// ---------------------------------------------------------------------------
// In-memory rule evaluation (create / update / delete)
// ---------------------------------------------------------------------------

async function satisfiesAny(
  rules: AccessRules,
  meta: TableMeta,
  conditions: AccessCondition[],
  caller: Caller,
  row: DataRow,
  executor: Executor,
): Promise<boolean> {
  if (caller.kind === "system") return true;
  for (const condition of conditions) {
    switch (condition.kind) {
      case "public":
      case "anyone":
        if (caller.kind === "user") return true;
        break;
      case "nobody":
        break;
      case "all": {
        if (caller.kind !== "user") break;
        let ok = true;
        for (const clause of condition.clauses) {
          if (!(await satisfiesClause(rules, meta, clause, caller, row, executor))) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
    }
  }
  return false;
}

async function satisfiesClause(
  rules: AccessRules,
  meta: TableMeta,
  clause: AccessClause,
  caller: Caller & { kind: "user" },
  row: DataRow,
  executor: Executor,
): Promise<boolean> {
  if (clause.kind !== "hop") return clauseHolds(meta, clause, caller, row);
  const me = caller.id;
  const col = column(meta, clause.column);
  const value = row[snakeToCamel(col)];
  if (value === null || value === undefined) return false;
  const target = tableMeta(rules, clause.table);
  const params: unknown[] = [toParam(value)];
  const inner: Where = {
    and: clause.where.map((c) => compileCompare(c, me)),
  };
  const innerSql = whereSql(normalizeWhere(rules, target, caller, inner, "rule"), params);
  const sql = `SELECT COUNT(*) AS n FROM ${q(target.slug)} WHERE ${q(column(target, clause.targetColumn))} = ? AND ${innerSql}`;
  const rows = await executor.all(sql, params);
  return Number(rows[0]?.n ?? 0) > 0;
}

function compare(actual: unknown, op: AccessCompareClause["op"], expected: unknown): boolean {
  const a = actual === undefined ? null : actual;
  switch (op) {
    case "=":
      return looseEqual(a, expected);
    case "!=":
      return !looseEqual(a, expected);
    case "in":
      return Array.isArray(expected) && expected.some((v) => looseEqual(a, v));
    case "<":
    case "<=":
    case ">":
    case ">=": {
      if (a === null || expected === null || expected === undefined) return false;
      const x = a as number | string;
      const y = expected as number | string;
      if (typeof x !== typeof y) return false;
      if (op === "<") return x < y;
      if (op === "<=") return x <= y;
      if (op === ">") return x > y;
      return x >= y;
    }
  }
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  // A checkbox value may be a boolean in memory and 0/1 in a rule literal, or vice versa.
  if (typeof a === "boolean" && typeof b === "number") return a === (b === 1);
  if (typeof a === "number" && typeof b === "boolean") return (a === 1) === b;
  return false;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Verify `request` against the caller and the table's access rule, then run it.
 * Throws `DataAccessError` on any rejection.
 */
export async function verifyAndRun<R extends DataRequest>(
  request: R,
  caller: Caller,
  rules: AccessRules,
  executor: Executor,
): Promise<DataResult<R>> {
  const meta = tableMeta(rules, request.table);
  switch (request.kind) {
    case "list":
      return (await runList(request, caller, rules, meta, executor)) as DataResult<R>;
    case "get":
      return (await runGet(request, caller, rules, meta, executor)) as DataResult<R>;
    case "create":
      return (await runCreate(request, caller, rules, meta, executor)) as DataResult<R>;
    case "createMany":
      return (await runCreateMany(request, caller, rules, meta, executor)) as DataResult<R>;
    case "update":
      return (await runUpdate(request, caller, rules, meta, executor)) as DataResult<R>;
    case "claim":
      return (await runClaim(request, caller, rules, meta, executor)) as DataResult<R>;
    case "delete":
      return (await runDelete(request, caller, rules, meta, executor)) as DataResult<R>;
  }
  throw invalid(`Unknown request kind "${String((request as { kind: unknown }).kind)}".`);
}

async function runList(
  request: ListRequest,
  caller: Caller,
  rules: AccessRules,
  meta: TableMeta,
  executor: Executor,
): Promise<DataRow[]> {
  const where = verifyReadWhere(rules, meta, caller, request.where);
  checkSelect(meta, caller, request.select);
  const hidden = unfilterableSet(meta, caller);
  const orderBy = (request.orderBy ?? []).map((o) => {
    if (o.dir !== "asc" && o.dir !== "desc") throw invalid(`orderBy dir must be "asc" or "desc".`);
    const col = column(meta, o.column);
    if (hidden.has(col)) {
      throw new DataAccessError("forbidden", `forbidden: column "${col}" is hidden.`);
    }
    return { column: col, dir: o.dir };
  });
  if (request.limit !== undefined && !(Number.isInteger(request.limit) && request.limit >= 0)) {
    throw invalid("limit must be a non-negative integer.");
  }
  if (request.offset !== undefined && !(Number.isInteger(request.offset) && request.offset >= 0)) {
    throw invalid("offset must be a non-negative integer.");
  }
  const expand = normalizeExpand(rules, meta, caller, request.expand);

  const params: unknown[] = [];
  let sql = `SELECT * FROM ${q(meta.slug)}`;
  if (where) sql += ` WHERE ${whereSql(where, params)}`;
  if (orderBy.length > 0) {
    sql += ` ORDER BY ${orderBy.map((o) => `${q(o.column)} ${o.dir.toUpperCase()}`).join(", ")}`;
  }
  if (request.limit !== undefined) {
    sql += ` LIMIT ?`;
    params.push(request.limit);
    if (request.offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(request.offset);
    }
  } else if (request.offset !== undefined) {
    sql += ` LIMIT -1 OFFSET ?`;
    params.push(request.offset);
  }

  const raw = await executor.all(sql, params);
  const rows = raw.map((r) => fromDb(meta, r));
  const expanded = await attachExpansions(rules, caller, rows, expand, executor);
  return expanded.map((row) => project(stripHidden(meta, caller, row), request.select, Object.keys(expand)));
}

async function runGet(
  request: GetRequest,
  caller: Caller,
  rules: AccessRules,
  meta: TableMeta,
  executor: Executor,
): Promise<DataRow> {
  if (typeof request.id !== "string" || request.id.length === 0) throw invalid("get needs an id.");
  const where = verifyReadWhere(rules, meta, caller, request.where);
  checkSelect(meta, caller, request.select);
  const expand = normalizeExpand(rules, meta, caller, request.expand);

  const params: unknown[] = [request.id];
  let sql = `SELECT * FROM ${q(meta.slug)} WHERE ${q("id")} = ?`;
  if (where) sql += ` AND ${whereSql(where, params)}`;
  sql += " LIMIT 1";
  const raw = await executor.all(sql, params);
  if (raw.length === 0) {
    throw new DataAccessError("notFound", `No "${meta.slug}" row with id "${request.id}".`);
  }
  const [row] = await attachExpansions(rules, caller, [fromDb(meta, raw[0]!)], expand, executor);
  return project(stripHidden(meta, caller, row!), request.select, Object.keys(expand));
}

type NormalizedExpand = Record<string, { target: TableMeta; column: string }>;

function normalizeExpand(
  rules: AccessRules,
  meta: TableMeta,
  caller: Caller,
  expand: Expand | undefined,
): NormalizedExpand {
  const out: NormalizedExpand = {};
  if (!expand) return out;
  const hidden = unfilterableSet(meta, caller);
  for (const [key, spec] of Object.entries(expand)) {
    if (!spec || typeof spec.table !== "string" || typeof spec.column !== "string") {
      throw invalid(`expand "${key}" needs { table, column }.`);
    }
    const col = column(meta, spec.column);
    if (hidden.has(col)) {
      throw new DataAccessError("forbidden", `forbidden: column "${col}" is hidden.`);
    }
    // The expansion lands on row[key]; a key that names a column would replace the
    // value the column policy is then decided on.
    if (lookupColumnType(meta, camelToSnake(key))) {
      throw invalid(`expand "${key}" shadows a column of "${meta.slug}" — use another key.`);
    }
    out[key] = { target: tableMeta(rules, spec.table), column: col };
  }
  return out;
}

/**
 * One level of expansion: a second query per key on the target table, with the
 * target's compiled read rule applied by the engine (the SDK cannot express it),
 * hidden columns stripped. Attached as `row[key]` — the target row or null.
 */
async function attachExpansions(
  rules: AccessRules,
  caller: Caller,
  rows: DataRow[],
  expand: NormalizedExpand,
  executor: Executor,
): Promise<DataRow[]> {
  for (const [key, { target, column: col }] of Object.entries(expand)) {
    const camel = snakeToCamel(col);
    const ids = [...new Set(rows.map((r) => r[camel]).filter((v) => v !== null && v !== undefined))];
    const byId = new Map<unknown, DataRow>();
    if (ids.length > 0) {
      const rule = compileRule(target.access.read, caller);
      if (rule === "unsatisfiable") {
        throw new DataAccessError(
          "forbidden",
          `forbidden: ${callerLabel(caller)} may not read "${target.slug}" (expand "${key}").`,
        );
      }
      const params: unknown[] = [];
      const clauses: Where[] = [{ column: "id", op: "in", value: ids }];
      if (rule !== "none") clauses.unshift(normalizeWhere(rules, target, caller, rule, "rule"));
      const sql = `SELECT * FROM ${q(target.slug)} WHERE ${whereSql({ and: clauses }, params)}`;
      for (const raw of await executor.all(sql, params)) {
        const row = stripHidden(target, caller, fromDb(target, raw));
        byId.set(raw.id, row);
      }
    }
    for (const row of rows) {
      const fk = row[camel];
      row[key] = fk === null || fk === undefined ? null : (byId.get(fk) ?? null);
    }
  }
  return rows;
}

/** Validate write data: known columns, no system columns, no hidden columns for app users. */
function normalizeData(
  meta: TableMeta,
  caller: Caller,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw invalid("data must be an object.");
  const hidden = hiddenSet(meta, caller);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const col = column(meta, key);
    if (Object.hasOwn(SYSTEM_COLUMNS, col)) {
      throw invalid(`Column "${col}" is set by the platform and cannot be written.`);
    }
    if (hidden.has(col)) {
      throw new DataAccessError("forbidden", `forbidden: column "${col}" is hidden.`);
    }
    out[col] = value;
  }
  return out;
}

/** A row-gated column may be written only on a row where the caller receives it. */
function checkRowGatedWrite(meta: TableMeta, caller: Caller, data: Record<string, unknown>, row: DataRow): void {
  const gated = rowGatedSet(meta, caller);
  if (gated.size === 0) return;
  for (const [col, conditions] of visibleTo(meta)) {
    if (gated.has(col) && Object.hasOwn(data, col) && !visibleOnRow(meta, conditions, caller, row)) {
      throw new DataAccessError("forbidden", `forbidden: column "${col}" is hidden on this row.`);
    }
  }
}

async function readById(
  meta: TableMeta,
  id: string,
  executor: Executor,
): Promise<DataRow | null> {
  const rows = await executor.all(`SELECT * FROM ${q(meta.slug)} WHERE ${q("id")} = ? LIMIT 1`, [id]);
  return rows.length === 0 ? null : fromDb(meta, rows[0]!);
}

type InsertRow = { id: string; columns: string[]; values: unknown[] };

/** Validate one row against the create rule and lay out its INSERT columns and bound values. */
async function prepareInsert(
  meta: TableMeta,
  caller: Caller,
  rules: AccessRules,
  raw: Record<string, unknown>,
  now: string,
  executor: Executor,
): Promise<InsertRow> {
  const data = normalizeData(meta, caller, raw);

  // Evaluate the create rule against the new row as the app sees it (camelCase, JS values).
  const candidate: DataRow = {};
  for (const [col, value] of Object.entries(data)) candidate[snakeToCamel(col)] = value;
  if (!(await satisfiesAny(rules, meta, meta.access.create, caller, candidate, executor))) {
    throw new DataAccessError(
      "forbidden",
      `forbidden: ${callerLabel(caller)} may not create this "${meta.slug}" row.`,
    );
  }
  checkRowGatedWrite(meta, caller, data, candidate);

  const id = crypto.randomUUID();
  // Every entity table carries id / created_at / updated_at; normalizeData has
  // already rejected them in `data`, so the platform sets all three here.
  return {
    id,
    columns: ["id", ...Object.keys(data), "created_at", "updated_at"],
    values: [id, ...Object.entries(data).map(([col, v]) => toDb(columnType(meta, col), v)), now, now],
  };
}

function insertSql(meta: TableMeta, columns: string[], rowCount: number): string {
  const placeholders = `(${columns.map(() => "?").join(", ")})`;
  return `INSERT INTO ${q(meta.slug)} (${columns.map(q).join(", ")}) VALUES ${Array.from({ length: rowCount }, () => placeholders).join(", ")}`;
}

async function runCreate(
  request: CreateRequest,
  caller: Caller,
  rules: AccessRules,
  meta: TableMeta,
  executor: Executor,
): Promise<DataRow> {
  const now = new Date().toISOString();
  const { id, columns, values } = await prepareInsert(meta, caller, rules, request.data, now, executor);
  await executor.run(insertSql(meta, columns, 1), values);

  const row = await readById(meta, id, executor);
  if (!row) throw new DataAccessError("notFound", `Inserted "${meta.slug}" row "${id}" could not be read back.`);
  return stripHidden(meta, caller, row);
}

async function runCreateMany(
  request: CreateManyRequest,
  caller: Caller,
  rules: AccessRules,
  meta: TableMeta,
  executor: Executor,
): Promise<DataRow[]> {
  if (!Array.isArray(request.rows)) throw invalid("rows must be an array.");
  if (request.rows.length === 0) return [];
  const now = new Date().toISOString();
  const prepared: InsertRow[] = [];
  for (const raw of request.rows) prepared.push(await prepareInsert(meta, caller, rules, raw, now, executor));

  // Rows naming the same columns share a statement, so a column a row omits keeps
  // its default exactly as on a single-row create instead of being bound NULL.
  const groups = new Map<string, InsertRow[]>();
  for (const row of prepared) {
    const key = row.columns.join(",");
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const statements: Statement[] = [];
  for (const group of groups.values()) {
    const columns = group[0]!.columns;
    const perStatement = Math.max(1, Math.floor(MAX_BOUND_PARAMS / columns.length));
    for (let i = 0; i < group.length; i += perStatement) {
      const slice = group.slice(i, i + perStatement);
      statements.push({ sql: insertSql(meta, columns, slice.length), params: slice.flatMap((r) => r.values) });
    }
  }
  await executor.batch(statements);

  const ids = prepared.map((r) => r.id);
  const byId = new Map<string, DataRow>();
  const readBack: unknown[] = [];
  const rows = await executor.all(
    `SELECT * FROM ${q(meta.slug)} WHERE ${inListSql(q("id"), ids, readBack)}`,
    readBack,
  );
  for (const row of rows) byId.set(String(row.id), fromDb(meta, row));
  return ids.map((id) => {
    const row = byId.get(id);
    if (!row) throw new DataAccessError("notFound", `Inserted "${meta.slug}" row "${id}" could not be read back.`);
    return stripHidden(meta, caller, row);
  });
}

type UpdateWrite = { sets: string[]; params: unknown[] };

/**
 * Check the update rule against the row as it is and as it will be, then lay
 * out the SET clause and its bound values (with `updated_at` stamped last).
 */
async function prepareUpdate(
  meta: TableMeta,
  caller: Caller,
  rules: AccessRules,
  id: string,
  raw: Record<string, unknown>,
  executor: Executor,
): Promise<UpdateWrite> {
  const data = normalizeData(meta, caller, raw);

  const existing = await readById(meta, id, executor);
  if (!existing) throw new DataAccessError("notFound", `No "${meta.slug}" row with id "${id}".`);
  if (!(await satisfiesAny(rules, meta, meta.access.update, caller, existing, executor))) {
    throw new DataAccessError(
      "forbidden",
      `forbidden: ${callerLabel(caller)} may not update this "${meta.slug}" row.`,
    );
  }
  // The row as it will be after the write must satisfy the rule too — otherwise
  // an update could hand the row to someone else (rewrite `created_by`) or move
  // it out of the caller's own scope.
  const merged: DataRow = { ...existing };
  for (const [col, value] of Object.entries(data)) merged[snakeToCamel(col)] = value;
  if (!(await satisfiesAny(rules, meta, meta.access.update, caller, merged, executor))) {
    throw new DataAccessError(
      "forbidden",
      `forbidden: this update would take the "${meta.slug}" row out of ${callerLabel(caller)}'s scope.`,
    );
  }
  checkRowGatedWrite(meta, caller, data, existing);

  const sets = Object.entries(data).map(([col]) => `${q(col)} = ?`);
  const params: unknown[] = Object.entries(data).map(([col, v]) => toDb(columnType(meta, col), v));
  sets.push(`${q("updated_at")} = ?`);
  params.push(new Date().toISOString());
  return { sets, params };
}

async function runUpdate(
  request: UpdateRequest,
  caller: Caller,
  rules: AccessRules,
  meta: TableMeta,
  executor: Executor,
): Promise<DataRow> {
  if (typeof request.id !== "string" || request.id.length === 0) throw invalid("update needs an id.");
  const { sets, params } = await prepareUpdate(meta, caller, rules, request.id, request.data, executor);
  params.push(request.id);
  await executor.run(`UPDATE ${q(meta.slug)} SET ${sets.join(", ")} WHERE ${q("id")} = ?`, params);

  const row = await readById(meta, request.id, executor);
  if (!row) throw new DataAccessError("notFound", `No "${meta.slug}" row with id "${request.id}".`);
  return stripHidden(meta, caller, row);
}

async function runClaim(
  request: ClaimRequest,
  caller: Caller,
  rules: AccessRules,
  meta: TableMeta,
  executor: Executor,
): Promise<DataRow | null> {
  if (typeof request.id !== "string" || request.id.length === 0) throw invalid("claim needs an id.");
  const where = normalizeWhere(rules, meta, caller, request.where, caller.kind === "system" ? "system" : "client");
  const { sets, params } = await prepareUpdate(meta, caller, rules, request.id, request.data, executor);
  params.push(request.id);
  const condition = whereSql(where, params);
  // The condition is evaluated by the database inside the UPDATE, so a second
  // caller that read the same pre-state finds it already false and changes nothing.
  const { changes } = await executor.run(
    `UPDATE ${q(meta.slug)} SET ${sets.join(", ")} WHERE ${q("id")} = ? AND ${condition}`,
    params,
  );
  if (changes === 0) return null;

  const row = await readById(meta, request.id, executor);
  if (!row) throw new DataAccessError("notFound", `No "${meta.slug}" row with id "${request.id}".`);
  return stripHidden(meta, caller, row);
}

async function runDelete(
  request: DeleteRequest,
  caller: Caller,
  rules: AccessRules,
  meta: TableMeta,
  executor: Executor,
): Promise<{ id: string }> {
  if (typeof request.id !== "string" || request.id.length === 0) throw invalid("delete needs an id.");
  const existing = await readById(meta, request.id, executor);
  if (!existing) throw new DataAccessError("notFound", `No "${meta.slug}" row with id "${request.id}".`);
  if (!(await satisfiesAny(rules, meta, meta.access.delete, caller, existing, executor))) {
    throw new DataAccessError(
      "forbidden",
      `forbidden: ${callerLabel(caller)} may not delete this "${meta.slug}" row.`,
    );
  }
  await executor.run(`DELETE FROM ${q(meta.slug)} WHERE ${q("id")} = ?`, [request.id]);
  return { id: request.id };
}
