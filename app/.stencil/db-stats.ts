import { requestStore } from "~stencil/request-context";
import { BACKEND_BASE, createBackendFetch } from "~stencil/backend";

/** One database call: when it ran, how long it took, and what it touched (never its parameters). */
interface DbCall {
  start: number;
  end: number;
  table: string;
  op: string;
  error?: string;
}

/** The calls one request has made so far. */
export interface DbCallLog {
  calls: DbCall[];
}

/** What a request reports about its database use once it has been answered. */
export interface DbStatsSummary {
  calls: number;
  /** The longest run of calls that waited for each other instead of running together. */
  chain: number;
  waitMs: number;
  slowestMs: number;
  /** Calls that failed or took longer than SLOW_CALL_MS, by table and operation only. */
  slow: { table: string; op: string; ms: number; error?: string }[];
}

/**
 * One request's report: its summary, the route pattern it served, whether the worker copy
 * was fresh, and how many requests it stands for (1 for a slow or failed one, which always
 * reports; the sample interval for a clean one).
 */
export interface DbStatsReport extends DbStatsSummary {
  path: string;
  cold: boolean;
  sampleInterval: number;
}

const SLOW_CALL_MS = 1000;
const MAX_SLOW_REPORTED = 10;
const MAX_ERROR_CHARS = 200;
// One clean request in this many reports; the reader multiplies its figures back up.
const SAMPLE_INTERVAL = 5;

/** The request's call log rides the async context, like the session cookie jar. */
export const dbCallLog = requestStore<DbCallLog>();

// The real statement behind each wrapper, so batch() can hand D1 its own objects.
const unwrapped = new WeakMap<D1PreparedStatement, D1PreparedStatement>();

/** The operation and first table of a statement, from its SQL text alone: no values are read. */
export function describeSql(sql: string): { op: string; table: string } {
  const verb = /\b(select|insert|update|delete)\b/i.exec(sql)?.[1];
  const op = (verb ?? sql.trim().split(/\s+/)[0] ?? "").toLowerCase();
  const table = /\b(?:from|into|update|join)\s+[`"']?([\w.]+)/i.exec(sql)?.[1] ?? "";
  return { op, table };
}

async function timed<T>(sql: string, run: () => Promise<T>): Promise<T> {
  const log = dbCallLog.getStore();
  if (!log) return run();
  const { op, table } = describeSql(sql);
  const call: DbCall = { start: Date.now(), end: 0, table, op };
  log.calls.push(call);
  try {
    return await run();
  } catch (err) {
    call.error = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_CHARS);
    throw err;
  } finally {
    call.end = Date.now();
  }
}

function wrapStatement(stmt: D1PreparedStatement, sql: string): D1PreparedStatement {
  const wrapper = new Proxy(stmt, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      switch (prop) {
        case "bind":
          return (...values: unknown[]) => wrapStatement(target.bind(...values), sql);
        case "all":
        case "first":
        case "run":
        case "raw":
          return (...args: unknown[]) => timed(sql, () => (value as Function).apply(target, args));
        default:
          return value.bind(target);
      }
    },
  });
  unwrapped.set(wrapper, stmt);
  return wrapper;
}

/**
 * The D1 binding with every call timed into the current request's log. Outside a
 * request (a schedule, a queue) there is no log and the wrapper adds nothing.
 */
export function instrumentD1(db: D1Database): D1Database {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      switch (prop) {
        case "prepare":
          return (sql: string) => wrapStatement(target.prepare(sql), sql);
        case "batch":
          return (stmts: D1PreparedStatement[]) => {
            const originals = stmts.map((s) => unwrapped.get(s) ?? s);
            const first: unknown = originals[0];
            const sql =
              first && typeof first === "object" && "statement" in first && typeof first.statement === "string"
                ? first.statement
                : "batch";
            return timed(sql, () => target.batch(originals));
          };
        case "exec":
          return (sql: string) => timed(sql, () => target.exec(sql));
        default:
          return value.bind(target);
      }
    },
  });
}

/** Fold a request's calls into the figures it reports. */
export function summarizeDbCalls(log: DbCallLog): DbStatsSummary {
  const done = log.calls.filter((c) => c.end > 0);
  let waitMs = 0;
  let slowestMs = 0;
  const slow: DbStatsSummary["slow"] = [];
  for (const c of done) {
    const ms = c.end - c.start;
    waitMs += ms;
    if (ms > slowestMs) slowestMs = ms;
    if ((c.error || ms > SLOW_CALL_MS) && slow.length < MAX_SLOW_REPORTED) {
      slow.push({ table: c.table, op: c.op, ms, ...(c.error ? { error: c.error } : {}) });
    }
  }
  // Calls that overlap ran together; the chain is the most that could only run one after another.
  let chain = 0;
  let lastEnd = -Infinity;
  for (const c of [...done].sort((a, b) => a.end - b.end)) {
    if (c.start >= lastEnd) {
      chain++;
      lastEnd = c.end;
    }
  }
  return { calls: done.length, chain, waitMs, slowestMs, slow };
}

/**
 * How many requests this one's report stands for, or null when it is not reported:
 * a request with a failed or slow call always reports for itself, the rest one in
 * SAMPLE_INTERVAL. Decided before any other work so a skipped request costs nothing.
 */
export function dbStatsSampleInterval(summary: DbStatsSummary): number | null {
  if (summary.slow.length > 0) return 1;
  return Math.random() * SAMPLE_INTERVAL < 1 ? SAMPLE_INTERVAL : null;
}

/** Send one request's report to the platform, off the request path. */
export async function reportDbStats(env: Env, report: DbStatsReport): Promise<void> {
  try {
    const res = await createBackendFetch(env)(`${BACKEND_BASE}/analytics/db-stats`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!res.ok) console.warn(`[db-stats] report for ${report.path} answered ${res.status}`);
  } catch (err) {
    console.warn(`[db-stats] report for ${report.path} failed:`, err);
  }
}
