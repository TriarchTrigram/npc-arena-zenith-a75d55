import { createContext, useContext, type JSX, type ReactNode } from "react";
import type { StringKey } from "../types/strings";

export type { StringKey } from "../types/strings";

const StringsContext = createContext<Record<string, unknown>>({});

/**
 * Supplies platform strings to every `<Text>` below it.
 *
 * Rendered once at the app root by the framework adapter, which is what knows
 * how the strings reached the page. `<Text>` outside a provider renders empty
 * and says so in the console rather than throwing — a missing provider must not
 * take the whole page down.
 */
export function StringsProvider({
  strings,
  children,
}: {
  strings: Record<string, unknown>;
  children?: ReactNode;
}) {
  return <StringsContext.Provider value={strings ?? {}}>{children}</StringsContext.Provider>;
}

/** Every string the nearest provider holds; `{}` outside one. */
export function useStrings(): Record<string, unknown> {
  return useContext(StringsContext);
}

/** The string at a dot-delimited key, or undefined when the app has no such key. */
export function readString(obj: unknown, path: string): string | undefined {
  if (obj === null || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  const dot = path.indexOf(".");
  if (dot !== -1) {
    const nested = readString(record[path.slice(0, dot)], path.slice(dot + 1));
    if (nested !== undefined) return nested;
  }
  // strings.json stores some leaves as flat dotted keys ({ "hero.title": "…" });
  // when the nested walk misses, the remaining path is tried as one direct key.
  const direct = record[path];
  return typeof direct === "string" ? direct : undefined;
}

function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
}

type TextProps = {
  /** Dot-delimited key into strings.json, e.g. "hero.title" */
  id: StringKey;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  /** Runtime values for {{var}} placeholders in the string template. */
  vars?: Record<string, unknown>;
  [key: string]: unknown;
};

/** Renders a platform-managed string by key. Copy lives in strings.json, never in JSX.
 *  Supports {{var}} interpolation via the vars prop — the raw template is stored in
 *  data-stencil-template so it can be edited in the Stencil editor.
 *  @example <Text id="hero.title" as="h1" className="text-4xl font-bold" />
 *  @example <Text id="cart.message" vars={{ count }} /> — strings.json: "You have {{count}} items" */
export function Text({ id, as: Tag = "span", vars, ...rest }: TextProps) {
  const strings = useContext(StringsContext);
  const resolved = readString(strings, id);
  if (resolved === undefined) {
    console.error(
      `<Text>: no string found for id "${id}" in strings.json — rendering empty. ` +
        `Add the key to app/strings/strings.json, or pass a valid key.`,
    );
  }
  const template = resolved ?? "";
  const value = vars ? interpolate(template, vars) : template;
  const Component = Tag as any;
  return (
    <Component
      data-stencil-text-key={id}
      data-stencil-vars={vars ? JSON.stringify(vars) : undefined}
      {...rest}
    >
      {value}
    </Component>
  );
}

/** The string at `id` as plain text, for attributes `<Text>` cannot render into
 *  (an input's placeholder, aria-label, title). A hook: call it at component top level.
 *  @example const hint = useString("contacts.form.email.placeholder"); <Input placeholder={hint} /> */
export function useString(id: StringKey): string {
  const resolved = readString(useContext(StringsContext), id);
  if (resolved === undefined) {
    console.error(
      `useString: no string found for id "${id}" in strings.json — returning "". ` +
        `Add the key to app/strings/strings.json, or pass a valid key.`,
    );
  }
  return resolved ?? "";
}
