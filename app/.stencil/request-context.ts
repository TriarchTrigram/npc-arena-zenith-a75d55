/**
 * A per-request value that follows the request through its async calls. The worker entry
 * backs each store with Node's AsyncLocalStorage before it answers anything; no other file
 * in the layer names that Node-only module, so the browser build never meets it.
 */
export interface RequestStore<T> {
  getStore(): T | undefined;
  run<R>(value: T, fn: () => R): R;
}

/** A store that is empty until `install` gives it a backing store; until then `run` just calls `fn`. */
export function requestStore<T>(): RequestStore<T> & { install(backing: RequestStore<T>): void } {
  let backing: RequestStore<T> | undefined;
  return {
    getStore: () => backing?.getStore(),
    run: (value, fn) => (backing ? backing.run(value, fn) : fn()),
    install: (store) => {
      backing = store;
    },
  };
}

/** The language the current request reads and every language the app speaks, default first;
 *  open only on an app with a second language. */
export const requestLanguage = requestStore<{ language: string; languages: string[] }>();

/** The worker fetch's own execution context, for work that must outlive the response. */
export const executionCtx = requestStore<ExecutionContext>();

/** Keep `task` running past the response, on `ctx` or the request's own context. */
export function runPastResponse(task: Promise<unknown>, ctx?: ExecutionContext): void {
  (ctx ?? executionCtx.getStore())?.waitUntil(task);
}

/** One memoised promise per key for a whole worker fetch; `memoPerRequest` reads it. */
export const requestMemo = requestStore<Map<symbol, Promise<unknown>>>();

/**
 * Run `fn` once per `key` for one worker fetch, whichever rebuilt Request objects React
 * Router hands the handlers inside it. A rejected promise is evicted; with no store open,
 * `fn` just runs.
 */
export function memoPerRequest<T>(key: symbol, fn: () => Promise<T>): Promise<T> {
  const memo = requestMemo.getStore();
  if (!memo) return fn();
  const cached = memo.get(key);
  if (cached) return cached as Promise<T>;
  const pending = fn();
  memo.set(key, pending);
  pending.catch(() => {
    if (memo.get(key) === pending) memo.delete(key);
  });
  return pending;
}

/** Drop what `memoPerRequest` holds under `key`, so the next call runs `fn` again. */
export function forgetPerRequest(key: symbol): void {
  requestMemo.getStore()?.delete(key);
}
