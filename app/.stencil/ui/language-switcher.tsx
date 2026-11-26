import { createContext, useContext, useState } from "react";
import { readString, useStrings } from "./strings";

export type AppLocale = { locale: string; dir: "ltr" | "rtl"; locales: string[] };

const LocaleContext = createContext<AppLocale>({ locale: "en", dir: "ltr", locales: ["en"] });

/** Supplies the page's language to `<LanguageSwitcher>`; rendered at the app root by the framework adapter. */
export const LocaleProvider = LocaleContext.Provider;

/** The language this page is rendered in, its direction, and every language the app speaks. */
export function useAppLocale(): AppLocale {
  return useContext(LocaleContext);
}

/** A language's name in that language ("Español"), or the tag itself when the runtime has no name for it. */
function languageName(tag: string): string {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

const DEFAULT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

/**
 * The language control for the app header. Renders nothing while the app speaks one
 * language. A choice is posted to the platform, which remembers it for this browser and,
 * for a signed-in app user, on their account; the page then reloads in that language.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, locales } = useAppLocale();
  const [busy, setBusy] = useState(false);
  // The app's own `platform.languageSwitcher.label`, translated with the rest of its copy.
  const label = readString(useStrings(), "platform.languageSwitcher.label") ?? "Language";
  if (locales.length < 2) return null;

  async function choose(next: string) {
    if (next === locale || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/__stencil/locale", { method: "POST", body: new URLSearchParams({ locale: next }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch (err) {
      console.error(`language switcher: could not switch to ${next}`, err);
      setBusy(false);
    }
  }

  return (
    <select
      value={locale}
      disabled={busy}
      onChange={(event) => void choose(event.target.value)}
      aria-label={label}
      className={className ?? DEFAULT_CLASS}
      data-language-switcher
    >
      {locales.map((tag) => (
        <option key={tag} value={tag}>
          {languageName(tag)}
        </option>
      ))}
    </select>
  );
}
