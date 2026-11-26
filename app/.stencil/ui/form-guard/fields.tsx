import { useEffect, useState } from "react";

// Half the token's one-day life, so a form left open still holds one its action accepts.
const REFRESH_MS = 12 * 60 * 60 * 1000;
const RETRY_MS = 5_000;
const MAX_RETRIES = 3;

export interface FormGuardProps {
  /** The form's name, the same one its action passes to `guardForm` (for example `contact`). */
  form: string;
}

/**
 * The invisible bot check for a public form: put it anywhere inside the `<form>`. It adds a
 * hidden field only bots fill and a signed token the page fetches after it loads; the form's
 * action checks both with `guardForm`. Needs `stencilFormGuardRoutes` in `app/routes.ts`.
 */
export function FormGuard({ form }: FormGuardProps) {
  const [token, setToken] = useState("");

  useEffect(() => {
    let live = true;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      fetch(`/__stencil/form-guard?form=${encodeURIComponent(form)}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ token?: string }>) : Promise.reject(new Error(`status ${res.status}`))))
        .then((body) => {
          if (!live) return;
          failures = 0;
          setToken(body.token ?? "");
          timer = setTimeout(load, REFRESH_MS);
        })
        .catch((err) => {
          if (!live) return;
          if (++failures <= MAX_RETRIES) timer = setTimeout(load, RETRY_MS);
          else console.error(`[form-guard] could not fetch the token for form "${form}", so its posts are refused:`, err);
        });
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [form]);

  return (
    <>
      <input type="text" name="form_note" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <input type="hidden" name="form_guard_token" value={token} />
    </>
  );
}
