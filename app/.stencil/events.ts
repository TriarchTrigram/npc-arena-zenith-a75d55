import { BACKEND_BASE, createBackendFetch } from "./backend";
import { isDev } from "./context";

/**
 * Stencil Events: what the platform tells this app about (`on()`) and what the
 * app tells the platform (`emit()`), both delivered as the same envelope.
 *
 * `emit()` is best-effort: it is skipped in local dev and whenever the backend
 * binding is missing, and a failed publish is logged and dropped rather than
 * thrown, so a flaky event never fails the request that produced it. Platform
 * events reach `on()` handlers at least once — key irreversible side effects
 * on `event.id`.
 */
export type StencilEvent<T = Record<string, unknown>> = {
  id: string;
  type: string;
  app_id: string;
  created_at: string;
  data: T;
};

/** The app's own catalog: one entry per custom event type it `emit()`s. */
export type EventSpec = Record<
  string,
  { description: string; example?: Record<string, unknown> }
>;

export type EventName<E extends EventSpec> = keyof E & string;

type NameChar =
  | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
  | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z"
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "_";

type NameWord<S extends string> = S extends `${infer H}${infer R}`
  ? H extends NameChar
    ? R extends "" ? true : NameWord<R>
    : false
  : false;

// Mirrors PLATFORM_EVENTS in the monorepo's shared/events-catalog.ts, which this layer
// cannot import; publish refuses these names from an app.
type PlatformEventName =
  | "subscription.trial_started"
  | "subscription.trial_ended"
  | "subscription.activated"
  | "subscription.changed"
  | "subscription.payment_succeeded"
  | "subscription.payment_failed"
  | "subscription.cancel_scheduled"
  | "subscription.canceled"
  | "purchase.completed"
  | "app_user.signed_up"
  | "email.delivered"
  | "test.ping";

/** The publish route's rule (lowercase object.past_tense, exactly one dot): a name that
 *  breaks it is refused there and silently dropped, so tsc refuses it here instead. */
type ValidEventName<S extends string> = S extends `${infer A}.${infer B}`
  ? NameWord<A> extends true ? NameWord<B> : false
  : false;

type EventNameProblem<S extends string> = S extends PlatformEventName
  ? `Event name ${S} is a platform event and cannot be published by an app`
  : `Event name ${S} is invalid: use lowercase object.past_tense with exactly one dot, e.g. booking.created`;

/** A literal name that passes stays itself; one that fails gains a brand that no string
 *  satisfies, so the tsc error carries the problem text. A plain `string` is left alone. */
type CheckedEventName<S extends string> = string extends S
  ? S
  : S extends PlatformEventName
    ? S & { eventNameProblem: EventNameProblem<S> }
    : ValidEventName<S> extends true
      ? S
      : S & { eventNameProblem: EventNameProblem<S> };

type CheckedEventSpec<T extends EventSpec> = {
  [K in keyof T]: K extends string
    ? K extends CheckedEventName<K> ? T[K] : EventNameProblem<K>
    : never;
};

export function defineEvents<T extends EventSpec>(spec: T & CheckedEventSpec<T>): T {
  return spec;
}

export type EventHandler = (event: StencilEvent, env: Env) => Promise<void> | void;

const registry = new Map<string, EventHandler[]>();

/** Register a handler for a platform event type; several may share one type. */
export function on(type: string, handler: EventHandler): void {
  const list = registry.get(type);
  if (list) list.push(handler);
  else registry.set(type, [handler]);
}

export function handlersFor(type: string): EventHandler[] {
  return registry.get(type) ?? [];
}

/** Publish a custom event to the platform, which fans it out to the app
 *  builder's destinations. Never throws. */
export async function emit<E extends EventSpec = EventSpec, T extends EventName<E> = EventName<E>>(
  env: Env,
  type: T & CheckedEventName<T>,
  data: Record<string, unknown>,
): Promise<void> {
  if (isDev(env) || !env.BACKEND_SERVICE) return;
  try {
    const res = await createBackendFetch(env)(`${BACKEND_BASE}/events/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
    if (!res.ok) {
      console.error("[events] emit failed:", type, `backend returned ${res.status}`);
    }
  } catch (err) {
    console.error("[events] emit failed:", type, err);
  }
}
