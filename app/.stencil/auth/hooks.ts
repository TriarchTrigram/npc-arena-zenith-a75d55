import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";

/** Better Auth's native database-hook map: user/session/account/verification,
 *  each with create/update and before/after. */
export type DatabaseHooks = NonNullable<BetterAuthOptions["databaseHooks"]>;

/** What an app default-exports from `app/auth-hooks.server.ts`. The factory form
 *  gets the worker `env` for bindings/secrets — the usual case, since hooks exist
 *  to call out with a stored key; a plain object works when `env` is unused. */
export type AuthHooks = DatabaseHooks | ((env: Env) => DatabaseHooks);

/** The app's own sign-up rule declined the address; `message` is what the person
 *  sees. The grant route answers it with a 422, the hosted sign-up with its status. */
export class SignupRefusedError extends APIError {
  constructor(message: string) {
    super("UNPROCESSABLE_ENTITY", { message });
    this.name = "SignupRefusedError";
  }
}

const DECLINED_BY_RULES = "This app's sign-up rules declined the address.";

/** Refuse a sign-up from a `before` hook, with the sentence the person sees. */
export function refuseSignup(reason: string): never {
  throw new SignupRefusedError(reason);
}

/** Is this account being created by the app builder from their Users page rather
 *  than by someone signing up? The platform's call carries a header the dispatcher
 *  strips from public traffic, so a rule can wave these through safely. */
export function isPlatformGrant(hookCtx: unknown): boolean {
  const request = (hookCtx as { request?: Request } | null | undefined)?.request;
  return request?.headers.has("x-stencil-internal") ?? false;
}

/** A platform grant that also asked for none of the sign-up side effects (builder
 *  ping, sign-up event, Flodesk, Meta, analytics): a bulk import of existing people. */
export function isQuietGrant(hookCtx: unknown): boolean {
  const request = (hookCtx as { request?: Request } | null | undefined)?.request;
  return isPlatformGrant(hookCtx) && (request?.headers.has("x-stencil-quiet") ?? false);
}

let appHooks: AuthHooks | undefined;

/** The server entry (react-router/worker/entry.server) registers the app's
 *  `~/auth-hooks.server` here. The import cannot live in this module: it is
 *  reachable from the client graph via auth/utils, and a `.server` specifier on
 *  that path fails the client build. */
export function registerAuthHooks(hooks: AuthHooks): void {
  appHooks = hooks;
}

/** The app's optional hooks, factory resolved against `env`. */
function loadAppHooks(env: Env): DatabaseHooks | undefined {
  if (!appHooks) return undefined;
  return typeof appHooks === "function" ? appHooks(env) : appHooks;
}

type Hook = (data: unknown, ctx: unknown) => unknown;

/** Chain two hooks that land on the same leaf so both run, platform first. An
 *  `after` leaf is observe-only; a `before` leaf threads each hook's returned data
 *  into the next. The app's before hook is its sign-up rule: returning false or
 *  throwing becomes one typed refusal, so a reason reaches the person as a 4xx. */
function chainHooks(timing: string, platform: Hook, app: Hook): Hook {
  if (timing !== "before") {
    return async (data, ctx) => {
      await platform(data, ctx);
      await app(data, ctx);
    };
  }
  return async (data, ctx) => {
    const first = await platform(data, ctx);
    if (first === false) return false;
    const threaded =
      first && typeof first === "object" && "data" in first ? (first as { data: unknown }).data : data;
    let second: unknown;
    try {
      second = await app(threaded, ctx);
    } catch (err) {
      if (err instanceof SignupRefusedError) throw err;
      // Only a deliberate 4xx answer carries its wording; a crash gets the generic line.
      const deliberate = err instanceof APIError && err.statusCode < 500 && err.message;
      throw new SignupRefusedError(deliberate || DECLINED_BY_RULES);
    }
    if (second === false) throw new SignupRefusedError(DECLINED_BY_RULES);
    return second ?? { data: threaded };
  };
}

/** Deep-merge the app's hook map over the platform's. A branch only one side has
 *  passes through untouched; where both define the same leaf hook, chainHooks runs
 *  both; branches both sides share recurse. */
function mergeHooks(platform: DatabaseHooks, app: DatabaseHooks): DatabaseHooks {
  const merged = { ...platform } as Record<string, unknown>;
  for (const [key, appNode] of Object.entries(app)) {
    const platformNode = merged[key];
    if (typeof platformNode === "function" && typeof appNode === "function") {
      merged[key] = chainHooks(key, platformNode as Hook, appNode as Hook);
    } else if (platformNode && typeof platformNode === "object" && appNode && typeof appNode === "object") {
      merged[key] = mergeHooks(platformNode as DatabaseHooks, appNode as DatabaseHooks);
    } else {
      merged[key] = appNode;
    }
  }
  return merged as DatabaseHooks;
}

/** The `databaseHooks` for this app: the app's optional `auth-hooks.server.ts`
 *  merged over `platformHooks` (ours — empty until we add some), colliding leaves
 *  composed so both run, platform first. Empty on both sides yields `{}`. */
export function withConsumerHooks(env: Env, platformHooks: DatabaseHooks = {}): DatabaseHooks {
  const appHooks = loadAppHooks(env);
  return appHooks ? mergeHooks(platformHooks, appHooks) : platformHooks;
}
