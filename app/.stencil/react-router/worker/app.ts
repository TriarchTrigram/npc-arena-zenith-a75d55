/// <reference types="node" />
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequestHandler, matchRoutes, type RouteObject, type ServerBuild } from "react-router";
import { callTag, normalizeFeature, type CallTag } from "~stencil/backend";
import { getSession, sessionCookies } from "~stencil/auth/server";
import { isDraft } from "~stencil/context";
import { dbCallLog, dbStatsSampleInterval, reportDbStats, summarizeDbCalls, type DbCallLog } from "~stencil/db-stats";
import { executionCtx, requestLanguage, requestMemo } from "~stencil/request-context";
import { storedLocale } from "~stencil/locale";
import { appLocales, loadStringsFromStorage, resolveLocale, textDirection } from "~stencil/strings";
import { resolveViewerTimeZone } from "~stencil/time";

// The one place the layer reaches Node's async context: this entry is never bundled for the browser.
callTag.install(new AsyncLocalStorage<CallTag>());
sessionCookies.install(new AsyncLocalStorage<string[]>());
dbCallLog.install(new AsyncLocalStorage<DbCallLog>());
requestMemo.install(new AsyncLocalStorage<Map<symbol, Promise<unknown>>>());
executionCtx.install(new AsyncLocalStorage<ExecutionContext>());
requestLanguage.install(new AsyncLocalStorage<{ language: string; languages: string[] }>());

// Every context field is declared in the file that supplies it, so a copy of this file
// older than the rest of the layer cannot advertise a field it does not pass: that
// mismatch fails the whole app to compile, not just the feature behind the field.
declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    /** Platform strings loaded before React Router renders — powers <Text> components. */
    strings: Record<string, unknown>;
    /** IANA timezone of the person viewing this request, resolved before render. */
    viewerTimeZone: string;
    /** The language this request reads, one of the app's; its default when the app has one language. */
    locale: string;
    /** The writing direction of `locale`. */
    dir: "ltr" | "rtl";
    /** Every language the app speaks, its default first. */
    locales: string[];
  }
}

const serverBuild = () => import("virtual:react-router/server-build");

const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

// True until this copy of the worker has answered its first request.
let fresh = true;

let routeTree: RouteObject[] | undefined;

// The build's flat route manifest as the tree `matchRoutes` walks, built once per isolate.
function routesOf(build: ServerBuild): RouteObject[] {
  if (routeTree) return routeTree;
  const children = new Map<string | undefined, RouteObject[]>();
  for (const route of Object.values(build.routes)) {
    if (!route) continue;
    const node = (
      route.index
        ? { id: route.id, path: route.path, caseSensitive: route.caseSensitive, index: true }
        : { id: route.id, path: route.path, caseSensitive: route.caseSensitive, children: [] }
    ) as RouteObject;
    children.set(route.parentId, [...(children.get(route.parentId) ?? []), node]);
  }
  const attach = (nodes: RouteObject[]): RouteObject[] =>
    nodes.map((node) => (node.index ? node : { ...node, children: attach(children.get(node.id) ?? []) }));
  routeTree = attach(children.get(undefined) ?? []);
  return routeTree;
}

/** The request's pathname with React Router's data-request suffix removed, as `matchRoutes` wants it. */
function pagePath(request: Request): string {
  return new URL(request.url).pathname.replace(/\/_root\.data$/, "/").replace(/\.data$/, "") || "/";
}

// The feature a platform call is recorded under when the code names none: the id of the
// route handling the request (`routes/api.chat` → `api.chat`), else the path itself.
async function routeFeature(request: Request): Promise<string | null> {
  const pathname = pagePath(request);
  const matches = matchRoutes(routesOf(await serverBuild()), pathname);
  const leaf = matches?.[matches.length - 1]?.route.id;
  return normalizeFeature(leaf ? leaf.replace(/^routes\//, "") : pathname);
}

/** The route pattern a path matches (`/gallery/:code`), so pages group without their ids; null when no route does. */
async function routePattern(pathname: string): Promise<string | null> {
  const matches = matchRoutes(routesOf(await serverBuild()), pathname);
  if (!matches) return null;
  let pattern = "";
  for (const m of matches) {
    const p = m.route.path;
    if (!p) continue;
    pattern = p.startsWith("/") ? p : `${pattern}/${p}`;
  }
  return pattern.replace(/\/+/g, "/").replace(/(.)\/$/, "$1") || "/";
}

/** Report the request's database use; a page that made no calls still counts, an asset that made none does not. */
async function recordDbStats(env: Env, log: DbCallLog, request: Request, cold: boolean): Promise<void> {
  try {
    const summary = summarizeDbCalls(log);
    const sampleInterval = dbStatsSampleInterval(summary);
    if (sampleInterval === null) return;
    const pathname = pagePath(request);
    const pattern = await routePattern(pathname);
    if (pattern === null && summary.calls === 0) return;
    await reportDbStats(env, { path: pattern ?? pathname, cold, sampleInterval, ...summary });
  } catch (err) {
    console.warn("[db-stats] could not record the request's database calls:", err);
  }
}

export default {
  async fetch(request, env, ctx) {
    const cold = fresh;
    fresh = false;
    // The jar and the memo ride the async context, not the Request: React Router hands the
    // handlers rebuilt Requests. Both open before the context is built, so the session read
    // that picks the language is the one the loaders reuse.
    const jar: string[] = [];
    const handle = async () => {
      // Only an app with a second language reads the signed-in app user's stored choice.
      const stored = appLocales(request).locales.length > 1 ? await storedLocale(request, env) : null;
      const { locale, defaultLocale, locales } = resolveLocale(request, stored);
      const context = {
        cloudflare: { env, ctx },
        strings: await loadStringsFromStorage(env, locale === defaultLocale ? undefined : locale),
        viewerTimeZone: resolveViewerTimeZone(request),
        locale,
        dir: textDirection(locale),
        locales,
      };
      let appUser: Promise<string | null> | undefined;
      const tag = {
        feature: await routeFeature(request),
        appUserId: () =>
          (appUser ??= getSession(request, env).then(
            (session) => session?.user.id ?? null,
            (err) => {
              console.warn("[usage] app user for the usage tag could not be read:", err);
              return null;
            },
          )),
      };
      const serve = () => callTag.run(tag, () => requestHandler(request, context));
      return locales.length > 1 ? requestLanguage.run({ language: locale, languages: locales }, serve) : serve();
    };
    const run = () =>
      executionCtx.run(ctx, () => requestMemo.run(new Map(), () => sessionCookies.run(jar, handle)));
    // Only the Published app measures its database use; the draft slot keeps no log at all.
    const log: DbCallLog | null = isDraft(env) ? null : { calls: [] };
    const res = log ? await dbCallLog.run(log, run) : await run();
    if (log) ctx.waitUntil(recordDbStats(env, log, request, cold));
    if (jar.length === 0) return res;
    const out = new Response(res.body, res);
    for (const cookie of jar) out.headers.append("set-cookie", cookie);
    return out;
  },
} satisfies ExportedHandler<Env>;
