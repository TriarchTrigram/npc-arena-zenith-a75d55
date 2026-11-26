type Strings = Record<string, unknown>;
type StringsContext = {
  context: { strings: Strings; viewerTimeZone: string; locale: string; dir: "ltr" | "rtl"; locales: string[] };
};

/** The top-level strings.json section the root loader never ships. */
export const PRIVATE_SECTION = "private";

/** Every section of strings.json except `private`, which only a gated loader hands down. */
export function publicStrings(strings: Strings): Strings {
  const rest = { ...strings };
  delete rest[PRIVATE_SECTION];
  return rest;
}

/** Loader factory that injects platform strings, the viewer's timezone and the request's
 *  language into loader data. Optionally compose with additional loader logic:
 *  `export const loader = withStrings<Route.LoaderArgs>(({ context }) => ({ user: ... }))` */
export function withStrings<TArgs extends StringsContext>(
  loader?: (args: TArgs) => Strings | Promise<Strings>,
) {
  return async (args: TArgs) => ({
    ...(loader ? await loader(args) : {}),
    strings: publicStrings(args.context.strings),
    viewerTimeZone: args.context.viewerTimeZone,
    locale: args.context.locale,
    dir: args.context.dir,
    locales: args.context.locales,
  });
}

/** One `private` section of strings.json, shaped for a route's loader data so
 *  `<Text id="private.<section>.…">` resolves on that page. Return it as `strings`
 *  only after the loader's own access check: `{ strings: privateStrings(context, "recap") }`. */
export function privateStrings(context: StringsContext["context"], section: string): Strings {
  const all = context.strings[PRIVATE_SECTION];
  const own = all && typeof all === "object" ? (all as Strings)[section] : undefined;
  return { [PRIVATE_SECTION]: { [section]: own ?? {} } };
}

/** Strings from every matched route folded into one object; `private` sections merge rather than replace. */
export function mergeStrings(base: Strings, next: Strings): Strings {
  const merged: Strings = { ...base, ...next };
  const a = base[PRIVATE_SECTION];
  const b = next[PRIVATE_SECTION];
  if (a && typeof a === "object" && b && typeof b === "object") {
    merged[PRIVATE_SECTION] = { ...(a as Strings), ...(b as Strings) };
  }
  return merged;
}
