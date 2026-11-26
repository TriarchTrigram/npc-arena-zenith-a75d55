/**
 * A failure has two readers. The app builder reads the real error in the server log,
 * so it is logged whole; the person on screen reads a plain sentence, so nothing a
 * provider, a stack or a request said reaches the browser or a stored row.
 */

/** What an action returns when its work failed; `error` is safe to show on screen. */
export type Failed = { ok: false; error: string };

export const FAILURE_MESSAGE = "Something went wrong — please try again.";

/**
 * Log `error` for the app builder and return the result the screen shows: `message`,
 * a plain sentence of the app's own, or the default. `what` names the step that
 * failed ("smart fill", "sending the receipt"); never put what someone typed in it.
 */
export function failed(what: string, error: unknown, message: string = FAILURE_MESSAGE): Failed {
  console.error(`${what} failed:`, error);
  return { ok: false, error: message };
}
