import { redirect } from "../http";
import { authCallbackUrl, getSession, requireAuth, safeReturnTo } from "~stencil/auth/server";
import { readAttributionCookie, readMetaBrowserIds } from "~stencil/auth/attribution";
import { createDb } from "~stencil/db";
import { purchase, subscription } from "~stencil/auth/schema";
import { tierOrder } from "~/generated/tiers";
import { and, eq, sql } from "drizzle-orm";
import type { AppContext } from "../types/context";

// Drizzle rethrows a D1 failure as a query error whose message is the SQL; the
// driver's own text ("no such table: …") is only on `cause`, so match the chain.
function d1ErrorText(err: unknown): string {
  const parts: string[] = [];
  for (let e = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    parts.push(String(e));
  }
  return parts.join("\n");
}

/**
 * Read the current user's subscription row. An app provisioned before the table
 * or its `cancel_at` column joined the seed reads as "not subscribed" until the
 * platform's first sync write creates the table; the column is added on demand.
 */
async function selectSubscription(
  env: Env,
  userId: string,
): Promise<typeof subscription.$inferSelect | null> {
  const db = createDb(env);
  const query = () =>
    db.select().from(subscription).where(eq(subscription.userId, userId)).limit(1);
  try {
    const [sub] = await query();
    return sub ?? null;
  } catch (err) {
    const text = d1ErrorText(err);
    if (/no such table.*subscription/i.test(text)) return null;
    if (!/no such column.*cancel_at/i.test(text)) throw err;
    await db.run(sql`ALTER TABLE subscription ADD COLUMN cancel_at integer`);
    const [sub] = await query();
    return sub ?? null;
  }
}

// A higher plan unlocks lower ones: `tierOrder` ranks plans low→high, so a member
// qualifies at or above the gated plan. `exact`, or a plan absent from the order
// (e.g. archived), falls back to an exact id match.
function planSatisfies(subTierId: string, requiredTierId: string, exact?: boolean): boolean {
  if (subTierId === requiredTierId) return true;
  if (exact) return false;
  const have = tierOrder.indexOf(subTierId);
  const need = tierOrder.indexOf(requiredTierId);
  if (have === -1 || need === -1) return false;
  return have >= need;
}

/**
 * Whether a subscription row grants access: true when payments are off (gating
 * bypassed), otherwise only for an active, trialing or past-due subscription
 * inside its period that holds `tierId` or a higher plan (`{ exact: true }` for
 * that exact plan; omit `tierId` to accept any plan).
 *
 * The one check for conditional UI in a multi-plan app — a status check alone
 * says "paying", not which plan:
 *
 *   const { sub, paymentsEnabled } = await getSubscription(request, context);
 *   const isPremium = hasPlan(sub, paymentsEnabled, tiers.premium.id);
 */
export function hasPlan(
  sub: typeof subscription.$inferSelect | null,
  paymentsEnabled: boolean,
  tierId?: string,
  opts?: { exact?: boolean },
): boolean {
  if (!paymentsEnabled) return true;
  return (
    !!sub &&
    (tierId ? planSatisfies(sub.tierId, tierId, opts?.exact) : true) &&
    (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") &&
    sub.currentPeriodEnd !== null &&
    sub.currentPeriodEnd > new Date()
  );
}

/**
 * Whether a subscription row is free access the app builder gave in More → Users.
 * Such a row has no Stripe customer or subscription behind it: nothing to manage in
 * the billing portal, nothing to pay for.
 */
export function isComplimentary(sub: typeof subscription.$inferSelect | null): boolean {
  return !!sub && sub.subscriptionId.startsWith("comp_");
}

// The manage helpers act on a Stripe subscription. Free access has none, so they
// send the app user back to the page they came from rather than to /upgrade.
async function requireStripeSubscription(
  request: Request,
  context: AppContext,
  backTo?: string,
): Promise<typeof subscription.$inferSelect> {
  const { sub } = await getSubscription(request, context);
  if (isComplimentary(sub)) throw redirect(backTo ?? "/app");
  if (!sub?.customerId) throw redirect("/upgrade");
  return sub;
}

/**
 * Subscription transport — how *this app* charges *its own* users. Every call
 * goes to the hosted payments service's `/v1` API over the `PAYMENTS` service
 * binding, the same service and per-app bearer the selling SDK (`./selling.ts`)
 * uses. Card data and Stripe ids never touch app code.
 */

const PAYMENTS_BASE = "https://payments.hellostencil.com";
const PAYMENTS_TIMEOUT_MS = 15_000;

/**
 * The app's `appId` lookup, started once and shared. A deployed app worker is a
 * single isolate with a constant bearer key, so one lookup per isolate is enough;
 * the per-app `/v1/apps/:appId/...` routes need the id, which the app only learns
 * at runtime. A failed lookup is dropped so the next call retries it.
 */
let appIdLookup: Promise<string> | null = null;

/**
 * Fetch the payments service with the app's per-app bearer key attached.
 *
 * A deployed app must reach the service through its `PAYMENTS` service binding —
 * a plain `fetch()` to `payments.hellostencil.com` doesn't reach it. The plain
 * `fetch()` fallback is only used on the local dev server, which has no binding.
 * The bearer header is set the same way for either transport.
 */
function paymentsFetch(env: Env, path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${env.BACKEND_SERVICE_API_KEY ?? ""}`);
  if (typeof init?.body === "string") headers.set("Content-Type", "application/json");
  const req = new Request(`${PAYMENTS_BASE}${path}`, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(PAYMENTS_TIMEOUT_MS),
  });
  return env.PAYMENTS ? env.PAYMENTS.fetch(req) : fetch(req);
}

function resolveAppId(env: Env): Promise<string> {
  if (appIdLookup) return appIdLookup;
  const lookup = (async () => {
    const res = await paymentsFetch(env, "/v1/whoami");
    if (!res.ok) throw new Error("Could not reach the payments service");
    const { appId } = await res.json<{ appId: string }>();
    return appId;
  })();
  appIdLookup = lookup;
  lookup.catch(() => {
    if (appIdLookup === lookup) appIdLookup = null;
  });
  return lookup;
}

/**
 * POST to a payments-worker endpoint and return its JSON. Throws on non-OK
 * responses with the worker's message — pass `errorMessage` to override the
 * generic fallback.
 */
async function paymentsPost<T>(
  env: Env,
  path: string,
  body: Record<string, unknown>,
  errorMessage?: string,
): Promise<T> {
  const res = await paymentsFetch(env, path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res
      .json<{ error?: string; code?: string }>()
      .catch(() => ({}) as { error?: string; code?: string });
    throw Object.assign(new Error(err.error ?? errorMessage ?? `Payments request to ${path} failed`), {
      code: err.code,
    });
  }
  return res.json<T>();
}

/** The sign-in page, returning to this request with a passed discount code kept as `?c=`. */
function loginUrl(request: Request, promoCode?: string): string {
  const url = new URL(request.url);
  if (promoCode) url.searchParams.set("c", promoCode);
  return `/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`;
}

/** POST to a payments-worker endpoint, then redirect the user to the URL it returns. */
async function paymentsRedirect(
  env: Env,
  path: string,
  body: Record<string, unknown>,
  errorMessage?: string,
): Promise<never> {
  const { url } = await paymentsPost<{ url: string }>(env, path, body, errorMessage);
  throw redirect(url);
}

async function fetchPaymentSettings(
  env: Env,
): Promise<{ paymentsEnabled: boolean; taxEnabled: boolean }> {
  try {
    const appId = await resolveAppId(env);
    const res = await paymentsFetch(env, `/v1/apps/${appId}/payments/enabled`);
    if (!res.ok) throw new Error(`payments/enabled returned ${res.status}`);
    const { enabled, taxEnabled } = await res.json<{ enabled: boolean; taxEnabled: boolean }>();
    return { paymentsEnabled: enabled, taxEnabled };
  } catch (err) {
    // Fail open: a payments outage shouldn't lock every user out of a gated app.
    console.warn("[payments] could not read payment settings, treating payments as on:", err);
    return { paymentsEnabled: true, taxEnabled: false };
  }
}

async function fetchPaymentsEnabled(env: Env): Promise<boolean> {
  return (await fetchPaymentSettings(env)).paymentsEnabled;
}

/**
 * The app's payment settings: whether payments are enabled, and whether new
 * subscriptions pay sales tax on top of the plan price. Use `taxEnabled` to add
 * "plus applicable sales tax" next to a price — never compute tax in the app;
 * Stripe works out the exact amount at checkout.
 *
 *   const { taxEnabled } = await getPaymentSettings(context);
 */
export async function getPaymentSettings(
  context: AppContext,
): Promise<{ paymentsEnabled: boolean; taxEnabled: boolean }> {
  return fetchPaymentSettings(context.cloudflare.env);
}

/**
 * Require an active subscription at the given tier.
 * Redirects to /login if unauthenticated, /upgrade if not subscribed.
 *
 * Returns `{ user, sub }` on success. `sub` is null when payments are disabled
 * for the app (gating bypassed) — always treat it as nullable.
 *
 * If tierId is omitted, any active subscription qualifies. When you pass one, a
 * higher plan also qualifies ("this plan or higher") per the plan order in
 * `~/generated/tiers`; pass `{ exact: true }` to require that exact plan.
 *
 * Use in loaders for gated routes:
 *
 *   import { requireSubscription } from "~stencil/payments/server";
 *   import { tiers } from "~/generated/tiers";
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     const { user } = await requireSubscription(request, context, tiers.pro.id);
 *     return { user };
 *   }
 */
export async function requireSubscription(
  request: Request,
  context: AppContext,
  tierId?: string,
  opts?: { exact?: boolean },
): Promise<{
  user: Awaited<ReturnType<typeof requireAuth>>["user"];
  sub: typeof subscription.$inferSelect | null;
  paymentsEnabled: boolean;
}> {
  const { user } = await requireAuth(request, context.cloudflare.env);

  const [sub, paymentsEnabled] = await Promise.all([
    selectSubscription(context.cloudflare.env, user.id),
    fetchPaymentsEnabled(context.cloudflare.env),
  ]);

  if (!paymentsEnabled) return { user, sub, paymentsEnabled: false };

  if (!hasPlan(sub, paymentsEnabled, tierId, opts)) throw redirect("/upgrade");

  return { user, sub: sub!, paymentsEnabled: true };
}

/**
 * Return the current user's subscription and whether payments are enabled.
 * Use this for conditional UI (upgrade banners, feature locks) without
 * hard-blocking access to the page. Decide access with `hasPlan`, never from
 * `sub.status` alone and never from a plan the app stored in its own table:
 *
 *   const { sub, paymentsEnabled } = await getSubscription(request, context);
 *   return { isPro: hasPlan(sub, paymentsEnabled, tiers.pro.id) };
 *
 * `sub.cancelAt` is set while a cancellation is pending: the subscription stays
 * `active` (and entitled) until that date, but will not renew — show
 * "Cancelled — access until {cancelAt}" instead of a renewal date.
 */
export async function getSubscription(
  request: Request,
  context: AppContext,
): Promise<{
  sub: typeof subscription.$inferSelect | null;
  paymentsEnabled: boolean;
}> {
  const { user } = await requireAuth(request, context.cloudflare.env);

  const [sub, paymentsEnabled] = await Promise.all([
    selectSubscription(context.cloudflare.env, user.id),
    fetchPaymentsEnabled(context.cloudflare.env),
  ]);

  return { sub, paymentsEnabled };
}

/**
 * Start a checkout flow for the given tier. Throws a redirect to the hosted
 * checkout page — after payment the user is sent to successUrl.
 *
 * With no session, a payment-required app opens the pay-first checkout instead
 * (see `payFirstCheckout`: the purchase creates the account, and the buyer
 * enters their email on Stripe's page); any other app redirects to `/login`.
 *
 * Pass `promoCode` (one of the app's own discount codes) to open checkout with
 * that discount already applied — the reduced price shows with nothing to type,
 * and the manual promo-code field is hidden (the payment page allows one or the
 * other, never both). When two or more live codes cover the plan being bought, the
 * code is set aside and the field shows instead, so a buyer holding another code
 * can type it. An unknown or removed code fails the checkout rather than silently
 * charging full price, so only pass a code the app is promoting. A signed-out
 * visitor is sent to sign in with the code kept as `?c=` in the return address.
 *
 * `link: false` leaves the card form as the only way to pay, and `termsUrl` adds a
 * required "I agree to the Terms" checkbox linking to that address. Both are off
 * unless passed, and work the same on `payFirstCheckout` and `buy`.
 *
 * Call in a form action:
 *
 *   import { tier } from "~/generated/tiers";
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await checkout(request, context, {
 *       tierId: tier!.id,
 *       successUrl: new URL("/subscribe/success", request.url).toString(),
 *       cancelUrl: new URL("/upgrade", request.url).toString(),
 *     });
 *   }
 */
export async function checkout(
  request: Request,
  context: AppContext,
  opts: {
    tierId: string;
    interval?: "month" | "year";
    successUrl?: string;
    cancelUrl?: string;
    promoCode?: string;
    /** `false` hides Stripe's Link wallet, leaving the card form only. */
    link?: boolean;
    /** An `https://` address of the app's terms; the buyer must tick a box agreeing to them. */
    termsUrl?: string;
  },
): Promise<void> {
  const env = context.cloudflare.env;
  const base = new URL(request.url).origin;
  const session = await getSession(request, env);
  if (!session) {
    // The worker reads the app's access mode and refuses pay-first anywhere else;
    // that refusal sends a logged-out visitor to sign in, code kept in the return address.
    try {
      await payFirstCheckout(context, {
        request,
        tierId: opts.tierId,
        interval: opts.interval,
        promoCode: opts.promoCode,
        link: opts.link,
        termsUrl: opts.termsUrl,
        successUrl: opts.successUrl ?? `${base}/app`,
        cancelUrl: opts.cancelUrl ?? `${base}/upgrade`,
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "pay_first_disabled" && code !== "pay_first_unavailable") throw err;
    }
    throw redirect(loginUrl(request, opts.promoCode));
  }
  const { user } = session;
  const successUrl = opts.successUrl ?? `${base}/app`;

  // Free access already covers this plan: a paid checkout would charge for it.
  const sub = await selectSubscription(env, user.id);
  if (isComplimentary(sub) && hasPlan(sub, true, opts.tierId, { exact: true })) {
    throw redirect(successUrl);
  }

  const appId = await resolveAppId(env);

  await paymentsRedirect(
    env,
    `/v1/apps/${appId}/subscriptions/checkout`,
    {
      tierId: opts.tierId,
      // Omit interval when the caller didn't set one, so the worker bills the
      // interval the plan actually offers (a yearly-only plan has no monthly price).
      ...(opts.interval ? { interval: opts.interval } : {}),
      ...(opts.promoCode ? { promoCode: opts.promoCode } : {}),
      ...(opts.link === false ? { link: false } : {}),
      ...(opts.termsUrl ? { termsUrl: opts.termsUrl } : {}),
      endUserId: user.id,
      successUrl,
      cancelUrl: opts.cancelUrl ?? `${base}/upgrade`,
      customerEmail: user.email,
      ...readMetaBrowserIds(request.headers),
    },
    "Failed to start checkout",
  );
}

/**
 * Start a pay-first checkout for a visitor with **no account**. On payment the
 * platform creates (or reactivates) the account for the email Stripe collected —
 * the purchase itself is the signup. `email` is optional: pass it when the page
 * already collected it (Stripe then locks its checkout email field to it); leave
 * it out to send the buyer straight to Stripe, where they enter it once. Point
 * successUrl at a route whose loader calls
 * `claimPayFirstCheckout` with the `session_id` query param (appended here for
 * Stripe to fill in) so the buyer lands signed in with no email hop; the
 * platform's emailed sign-in link remains the recovery path for a closed tab.
 * Only for an app whose access mode is pay-first (the platform refuses
 * otherwise); anywhere a session exists, use `checkout`. A passed address that is
 * not a valid email, or whose account the app's builder removed, is refused before
 * any charge — the thrown error says so. `promoCode` pre-applies a discount
 * exactly as on `checkout`.
 * Pass the action's `request` so the campaign tags the buyer arrived with land on
 * the account the platform creates for them, as they would on a browser signup.
 *
 * Call in a form action on a public page — a plain subscribe button, no fields:
 *
 *   import { tier } from "~/generated/tiers";
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await payFirstCheckout(context, {
 *       request,
 *       tierId: tier!.id,
 *       successUrl: new URL("/subscribe/success", request.url).toString(),
 *       cancelUrl: new URL("/", request.url).toString(),
 *     });
 *   }
 */
export async function payFirstCheckout(
  context: AppContext,
  opts: {
    /** The buyer's request — the only carrier of their attribution and ad-click cookies. */
    request?: Request;
    email?: string;
    tierId: string;
    interval?: "month" | "year";
    successUrl: string;
    cancelUrl: string;
    promoCode?: string;
    /** `false` hides Stripe's Link wallet, leaving the card form only. */
    link?: boolean;
    /** An `https://` address of the app's terms; the buyer must tick a box agreeing to them. */
    termsUrl?: string;
  },
): Promise<void> {
  const env = context.cloudflare.env;
  const appId = await resolveAppId(env);
  const signupAttribution = readAttributionCookie(opts.request?.headers);

  // Appended by hand: Stripe only substitutes the literal `{CHECKOUT_SESSION_ID}`
  // placeholder, and URL/searchParams helpers would percent-encode the braces.
  const successUrl =
    opts.successUrl +
    (opts.successUrl.includes("?") ? "&" : "?") +
    "session_id={CHECKOUT_SESSION_ID}";

  await paymentsRedirect(
    env,
    `/v1/apps/${appId}/subscriptions/checkout`,
    {
      ...(opts.email ? { customerEmail: opts.email } : {}),
      tierId: opts.tierId,
      ...(opts.interval ? { interval: opts.interval } : {}),
      ...(opts.promoCode ? { promoCode: opts.promoCode } : {}),
      ...(opts.link === false ? { link: false } : {}),
      ...(opts.termsUrl ? { termsUrl: opts.termsUrl } : {}),
      payFirst: true,
      ...(signupAttribution ? { signupAttribution } : {}),
      ...readMetaBrowserIds(opts.request?.headers),
      successUrl,
      cancelUrl: opts.cancelUrl,
    },
    "Failed to start checkout",
  );
}

/**
 * Sign in the buyer who just completed a pay-first checkout, in the browser
 * Stripe redirected back. Pass the `session_id` query param from the success
 * URL; returns a short-lived single-use sign-in URL to redirect the browser to
 * (magic-link verify → session cookie → `next`, `/app` by default), or null
 * when the claim is refused — already used, expired, or the payment didn't
 * complete. On null, render a fallback: the platform's emailed sign-in link
 * covers a closed tab or another device. `next` must be a path on this app;
 * anything else falls back to `/app`. To offer a password first, chain the
 * platform's page: `next: "/auth/set-password?next=/onboarding"`.
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     const sessionId = new URL(request.url).searchParams.get("session_id");
 *     if (sessionId) {
 *       const url = await claimPayFirstCheckout(context, sessionId, { next: "/onboarding" });
 *       if (url) throw redirect(url);
 *     }
 *     return {};
 *   }
 */
export async function claimPayFirstCheckout(
  context: AppContext,
  sessionId: string,
  opts: { next?: string } = {},
): Promise<string | null> {
  const env = context.cloudflare.env;
  try {
    const appId = await resolveAppId(env);
    const res = await paymentsFetch(env, `/v1/apps/${appId}/subscriptions/claim`, {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) {
      // A refusal (reused/expired session) is an expected path the success page
      // handles; log it so a systemic failure is still visible.
      console.warn(`Pay-first claim refused (${res.status})`);
      return null;
    }
    const { url } = await res.json<{ url?: string }>();
    if (!url) return null;
    if (!opts.next) return url;
    const link = new URL(url);
    link.searchParams.set("callbackURL", authCallbackUrl(safeReturnTo(opts.next)));
    return link.toString();
  } catch (err) {
    // Never crash the success page over the claim — the buyer's recovery is the
    // emailed sign-in link, which the fallback screen points at.
    console.warn(`Pay-first claim failed: ${String(err)}`);
    return null;
  }
}

/**
 * Open the subscription management portal for the current user. Throws a
 * redirect to the hosted portal where they can change plan, update payment
 * details, or cancel. Redirects to /upgrade if they have no subscription.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await manageSubscription(request, context,
 *       new URL("/app/settings", request.url).toString()
 *     );
 *   }
 */
export async function manageSubscription(
  request: Request,
  context: AppContext,
  returnUrl?: string,
): Promise<void> {
  const env = context.cloudflare.env;
  const sub = await requireStripeSubscription(request, context, returnUrl);

  const appId = await resolveAppId(env);

  await paymentsRedirect(
    env,
    `/v1/apps/${appId}/subscriptions/portal`,
    { customerId: sub.customerId, returnUrl: returnUrl ?? request.url },
    "Failed to open subscription portal",
  );
}

/**
 * Offer the current user a discount to stay instead of cancelling: put one of
 * the app's own live discount codes on their running subscription. It applies
 * from their next payment. Redirects to /upgrade if they have no subscription;
 * throws if the code is not live or does not apply to their plan, if the offer
 * was already used (`code: "offer_already_used"`), or if they already hold a
 * discount (`code: "already_discounted"`) — wrap it in a try/catch.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     const discount = await applyStayOffer(request, context, "STAY50");
 *     return { stayed: true, terms: discount.terms };
 *   }
 */
export async function applyStayOffer(
  request: Request,
  context: AppContext,
  couponCode: string,
): Promise<{ code: string; terms: string; end: Date | null }> {
  const env = context.cloudflare.env;
  const sub = await requireStripeSubscription(request, context);

  const appId = await resolveAppId(env);
  const { discount } = await paymentsPost<{
    discount: { code: string; terms: string; end: number | null } | null;
  }>(
    env,
    `/v1/apps/${appId}/subscriptions/stay-offer`,
    { customerId: sub.customerId, couponCode },
    "Failed to apply the discount",
  );
  if (!discount) throw new Error("Failed to apply the discount");
  return { code: discount.code, terms: discount.terms, end: discount.end ? new Date(discount.end * 1000) : null };
}

/**
 * Offer the current user a pause instead of cancelling: stop charging them for
 * `months` (1 to 3). Their subscription stays active, so they keep access, and
 * billing resumes on the returned date. Redirects to /upgrade if they have no
 * subscription; throws with `code: "offer_already_used"` after one pause.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     const { resumesAt } = await pauseSubscription(request, context, 2);
 *     return { paused: true, resumesAt };
 *   }
 */
export async function pauseSubscription(
  request: Request,
  context: AppContext,
  months: 1 | 2 | 3,
): Promise<{ resumesAt: Date }> {
  const env = context.cloudflare.env;
  const sub = await requireStripeSubscription(request, context);

  const appId = await resolveAppId(env);
  const { resumesAt } = await paymentsPost<{ resumesAt: string }>(
    env,
    `/v1/apps/${appId}/subscriptions/pause`,
    { customerId: sub.customerId, months },
    "Failed to pause the subscription",
  );
  return { resumesAt: new Date(resumesAt) };
}

/**
 * Cancel the current user's own plan from app code — for when a one-time
 * purchase replaces it (a lifetime upgrade), or an explicit "cancel now"
 * control. `mode` is `"period_end"` (the default: no more charges, access runs
 * to the end of the period they paid for, and `getSubscription` shows
 * `cancelAt`) or `"immediate"` (access ends now). Never refunds. Redirects to
 * /upgrade if they have no subscription; throws with
 * `code: "subscription_not_found"` if it has already ended. A normal cancel
 * page keeps the stay offer and the billing portal (`applyStayOffer`,
 * `pauseSubscription`, `manageSubscription`).
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await cancelSubscription(request, context); // at period end
 *     return { canceled: true };
 *   }
 */
export async function cancelSubscription(
  request: Request,
  context: AppContext,
  opts?: { mode?: "period_end" | "immediate" },
): Promise<{ alreadyCanceled: boolean }> {
  const env = context.cloudflare.env;
  const sub = await requireStripeSubscription(request, context);

  const appId = await resolveAppId(env);
  const { alreadyCanceled } = await paymentsPost<{ canceled: boolean; alreadyCanceled: boolean }>(
    env,
    `/v1/apps/${appId}/subscriptions/cancel`,
    { customerId: sub.customerId, mode: opts?.mode ?? "period_end" },
    "Failed to cancel the subscription",
  );
  return { alreadyCanceled };
}

/**
 * After a paid one-time purchase that stands for a plan (a lifetime unlock), give the
 * signed-in app user that plan for good, so `requireSubscription`, `hasPlan` and seller
 * onboarding all let them in. Refuses unless the platform holds a paid purchase of
 * `productId` by this app user (`reason: "no_purchase"`; right after checkout the
 * payment can take a few seconds to land, so call it again on the next load). A live
 * paid subscription is never replaced (`reason: "paid_subscription"`): cancel it with
 * `cancelSubscription` and call this again once it has ended. Safe to repeat: an
 * existing grant of the same plan returns `reason: "already"`. Throws with
 * `code: "tier_mismatch"` when `tierId` is not one of the app's plans. A later refund
 * does not remove the plan; the app builder ends it under More → Users.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     const { granted, reason } = await grantPlanFromPurchase(request, context, {
 *       productId: products.lifetime.id,
 *       tierId: tiers.pro.id,
 *     });
 *     return { granted, reason };
 *   }
 */
export async function grantPlanFromPurchase(
  request: Request,
  context: AppContext,
  input: { productId: string; tierId: string },
): Promise<{ granted: boolean; reason?: "no_purchase" | "paid_subscription" | "already" }> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const appId = await resolveAppId(env);
  return paymentsPost<{ granted: boolean; reason?: "no_purchase" | "paid_subscription" | "already" }>(
    env,
    `/v1/apps/${appId}/subscriptions/grant-from-purchase`,
    { endUserId: user.id, productId: input.productId, tierId: input.tierId },
    "Failed to grant the plan",
  );
}

/**
 * Let the current user end their free trial and start paying now: Stripe
 * charges the first period to their saved card at once, and `getSubscription`
 * reports `status: "active"` within seconds. Redirects to /upgrade if they
 * have no subscription. With no card on file, redirects to the billing portal
 * (back to `returnUrl`) so they add one, then press the button again. Throws
 * with `code: "not_trialing"` when there is no trial to end.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await endTrial(request, context, new URL("/app/billing", request.url).toString());
 *     return { started: true };
 *   }
 */
export async function endTrial(
  request: Request,
  context: AppContext,
  returnUrl?: string,
): Promise<void> {
  const env = context.cloudflare.env;
  const sub = await requireStripeSubscription(request, context, returnUrl);

  const appId = await resolveAppId(env);
  try {
    await paymentsPost(
      env,
      `/v1/apps/${appId}/subscriptions/end-trial`,
      { customerId: sub.customerId },
      "Failed to end the trial",
    );
  } catch (err) {
    if ((err as { code?: string }).code !== "no_payment_method") throw err;
    await paymentsRedirect(
      env,
      `/v1/apps/${appId}/subscriptions/portal`,
      { customerId: sub.customerId, returnUrl: returnUrl ?? request.url },
      "Failed to open subscription portal",
    );
  }
}

/**
 * Start a checkout for one of the app's one-time products (`products.<slug>.id`
 * from `~/generated/tiers`). Throws a redirect to the hosted payment page; after
 * payment the buyer lands on successUrl and the purchase shows up in
 * `hasPurchased` within seconds.
 *
 * Works signed in or not. A logged-out visitor goes straight to Stripe, which
 * collects their email; on payment the platform creates the account for that
 * address (or matches the existing one) and emails a sign-in link. Point
 * successUrl at a route whose loader calls `claimPurchaseCheckout` with the
 * `session_id` query param (appended here for Stripe to fill in) so the buyer
 * lands signed in with no email hop. Pass `email` only when the page already
 * collected it (Stripe then locks its checkout email to it). An invite-only app
 * still sends a logged-out buyer to /login.
 *
 * Expected rejections never crash the page: they come back on cancelUrl as
 * `?checkout_error=<code>` — `product_unavailable`, `already_purchased`,
 * `not_ready` (payments not set up yet), `promo_not_found`, or `access_revoked`
 * (a passed email the app builder removed). Read that param in the page's
 * loader and show a notice. `promoCode` works as on `checkout`.
 *
 * Selling the same product per order, request or gift: pass the app's own
 * record id as `reference`. The payment is tied to that record, a buyer can pay
 * for several records of one product, `?reference=<id>` is added to
 * `successUrl`, and `isReferencePaid` answers for exactly that record.
 *
 *   import { products } from "~/generated/tiers";
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await buy(request, context, {
 *       productId: products.course_bundle.id,
 *       successUrl: new URL("/purchase/success", request.url).toString(),
 *       cancelUrl: new URL("/course", request.url).toString(),
 *     });
 *   }
 */
export async function buy(
  request: Request,
  context: AppContext,
  opts: {
    productId: string;
    successUrl?: string;
    cancelUrl?: string;
    promoCode?: string;
    email?: string;
    reference?: string;
    /** `false` hides Stripe's Link wallet, leaving the card form only. */
    link?: boolean;
    /** An `https://` address of the app's terms; the buyer must tick a box agreeing to them. */
    termsUrl?: string;
  },
): Promise<void> {
  const env = context.cloudflare.env;
  const session = await getSession(request, env);
  const base = new URL(request.url).origin;
  const cancelUrl = opts.cancelUrl ?? request.url;
  const appId = await resolveAppId(env);

  let successUrl = opts.successUrl ?? `${base}/app`;
  if (opts.reference) {
    const url = new URL(successUrl, base);
    url.searchParams.set("reference", opts.reference);
    successUrl = url.toString();
  }
  if (!session) {
    // Appended by hand: Stripe only substitutes the literal `{CHECKOUT_SESSION_ID}`
    // placeholder, and URL/searchParams helpers would percent-encode the braces.
    successUrl += (successUrl.includes("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}";
  }
  const identity = session
    ? { endUserId: session.user.id, customerEmail: session.user.email }
    : { guest: true, ...(opts.email ? { customerEmail: opts.email } : {}) };

  const res = await paymentsFetch(env, `/v1/apps/${appId}/purchases/checkout`, {
    method: "POST",
    body: JSON.stringify({
      ...identity,
      productId: opts.productId,
      ...(opts.promoCode ? { promoCode: opts.promoCode } : {}),
      ...(opts.reference ? { reference: opts.reference } : {}),
      ...(opts.link === false ? { link: false } : {}),
      ...(opts.termsUrl ? { termsUrl: opts.termsUrl } : {}),
      ...readMetaBrowserIds(request.headers),
      successUrl,
      cancelUrl,
    }),
  });
  const data = await res
    .json<{ url?: string; error?: string; code?: string }>()
    .catch(() => ({}) as { url?: string; error?: string; code?: string });
  if (res.ok && data.url) throw redirect(data.url);
  if (data.code === "sign_in_required") throw redirect(loginUrl(request, opts.promoCode));
  // A thrown Error would reach the root ErrorBoundary, which hides messages in
  // production; an expected business state goes back to the page as a code.
  if (res.status >= 400 && res.status < 500) {
    const back = new URL(cancelUrl, base);
    back.searchParams.set("checkout_error", data.code ?? "checkout_failed");
    throw redirect(back.toString());
  }
  throw new Error(data.error ?? "Failed to start checkout");
}

/**
 * Sign in the guest who just bought a one-time product, in the browser Stripe
 * redirected back. Pass the `session_id` query param from the success URL;
 * returns a short-lived single-use sign-in URL to redirect the browser to, or
 * null when the claim is refused — already used, expired, the payment didn't
 * complete, or the buyer was signed in all along (no `session_id` then). On
 * null, render a fallback: the platform's emailed sign-in link covers a closed
 * tab or another device.
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     const sessionId = new URL(request.url).searchParams.get("session_id");
 *     if (sessionId) {
 *       const url = await claimPurchaseCheckout(context, sessionId);
 *       if (url) throw redirect(url);
 *     }
 *     return {};
 *   }
 */
export async function claimPurchaseCheckout(
  context: AppContext,
  sessionId: string,
): Promise<string | null> {
  const env = context.cloudflare.env;
  try {
    const appId = await resolveAppId(env);
    const res = await paymentsFetch(env, `/v1/apps/${appId}/purchases/claim`, {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) {
      console.warn(`Purchase claim refused (${res.status})`);
      return null;
    }
    const { url } = await res.json<{ url?: string }>();
    return url || null;
  } catch (err) {
    // Never crash the success page over the claim — the buyer's recovery is the
    // emailed sign-in link, which the fallback screen points at.
    console.warn(`Purchase claim failed: ${String(err)}`);
    return null;
  }
}

/**
 * Whether the one-time purchase started with `buy({ reference })` for this record
 * has been paid. Asks the payments service, so it needs no session and is true for
 * a guest's payment too; a refund or lost dispute turns it false again. It never
 * bypasses: with payments off, or when the check cannot complete, it is false.
 * Mark your own record paid on this answer alone — never on the success page
 * opening, an email typed into a form, or a product the buyer owns.
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     const reference = new URL(request.url).searchParams.get("reference");
 *     if (reference && (await isReferencePaid(context, reference))) {
 *       await db.from("orders").claim(reference, { status: "paid" }, { where: { status: "pending" } });
 *     }
 *     return {};
 *   }
 */
export async function isReferencePaid(context: AppContext, reference: string): Promise<boolean> {
  const env = context.cloudflare.env;
  try {
    const appId = await resolveAppId(env);
    const res = await paymentsFetch(
      env,
      `/v1/apps/${appId}/purchases/reference/${encodeURIComponent(reference)}`,
    );
    if (!res.ok) {
      console.warn(`Reference purchase check refused (${res.status})`);
      return false;
    }
    const { purchased } = await res.json<{ purchased?: boolean }>();
    return purchased === true;
  } catch (err) {
    console.warn(`Reference purchase check failed: ${String(err)}`);
    return false;
  }
}

// Apps provisioned before `purchase` joined the seed have no table; the seed's DDL.
const PURCHASE_DDL = [
  "CREATE TABLE IF NOT EXISTS `purchase` (`user_id` text NOT NULL, `product_id` text NOT NULL, `order_id` text NOT NULL, `status` text NOT NULL, `purchased_at` integer NOT NULL, `updated_at` integer NOT NULL, PRIMARY KEY(`user_id`, `product_id`), FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `purchase_order_id_unique` ON `purchase` (`order_id`);",
];

/** The user's owned one-time products. A missing table is created and reads as none. */
async function selectPurchases(
  env: Env,
  userId: string,
  productId?: string,
): Promise<(typeof purchase.$inferSelect)[]> {
  const db = createDb(env);
  try {
    return await db
      .select()
      .from(purchase)
      .where(
        productId
          ? and(eq(purchase.userId, userId), eq(purchase.productId, productId))
          : eq(purchase.userId, userId),
      );
  } catch (err) {
    if (!/no such table.*purchase/i.test(d1ErrorText(err))) throw err;
    await env.DB.batch(PURCHASE_DDL.map((stmt) => env.DB.prepare(stmt)));
    return [];
  }
}

/**
 * Whether the signed-in user owns a one-time product. Reads the app's own
 * `purchase` table — no network call besides the payments-enabled check. When
 * payments are off for the app, everyone counts as having bought.
 * Redirects to /login if unauthenticated.
 *
 *   const owned = await hasPurchased(request, context, { productId: products.course_bundle.id });
 */
export async function hasPurchased(
  request: Request,
  context: AppContext,
  opts: { productId: string },
): Promise<boolean> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const [rows, paymentsEnabled] = await Promise.all([
    selectPurchases(env, user.id, opts.productId),
    fetchPaymentsEnabled(env),
  ]);
  return !paymentsEnabled || rows.length > 0;
}

/**
 * Require that the signed-in user owns a one-time product — the one-time twin of
 * `requireSubscription`. Redirects to /login if unauthenticated and to
 * `redirectTo` (default `/`) if they have not bought it. A refund or dispute
 * removes the purchase, so access ends on its own. Bypassed when payments are off.
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     const { user } = await requirePurchase(request, context, {
 *       productId: products.course_bundle.id,
 *       redirectTo: "/course",
 *     });
 *     return { user };
 *   }
 */
export async function requirePurchase(
  request: Request,
  context: AppContext,
  opts: { productId: string; redirectTo?: string },
): Promise<{ user: Awaited<ReturnType<typeof requireAuth>>["user"]; paymentsEnabled: boolean }> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const [rows, paymentsEnabled] = await Promise.all([
    selectPurchases(env, user.id, opts.productId),
    fetchPaymentsEnabled(env),
  ]);
  if (!paymentsEnabled) return { user, paymentsEnabled: false };
  if (rows.length === 0) throw redirect(opts.redirectTo ?? "/");
  return { user, paymentsEnabled: true };
}

/**
 * Every one-time product the signed-in user owns, newest first — for a
 * "My purchases" page. Match `productId` against `products` from
 * `~/generated/tiers` for names. Redirects to /login if unauthenticated.
 */
export async function getPurchases(
  request: Request,
  context: AppContext,
): Promise<{ productId: string; orderId: string; purchasedAt: Date }[]> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const rows = await selectPurchases(env, user.id);
  return rows
    .map((r) => ({ productId: r.productId, orderId: r.orderId, purchasedAt: r.purchasedAt }))
    .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
}

/** The discount code on a subscription or purchase, with the coupon's terms. */
export type BillingCode = {
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
  duration: "forever" | "once" | "repeating";
  durationInMonths: number | null;
};

/** One paid subscription invoice. `amountPaidCents` is what Stripe collected. */
export type BillingPayment = {
  invoiceId: string;
  number: string | null;
  status: "paid";
  paidAt: string | null;
  amountPaidCents: number;
  subtotalCents: number;
  discountCents: number;
  refundedCents: number;
  periodStart: string | null;
  periodEnd: string | null;
};

/** One paid one-time product. `amountPaidCents` is what Stripe collected. */
export type BillingPurchase = {
  orderId: string;
  productId: string | null;
  purchasedAt: string | null;
  amountPaidCents: number;
  subtotalCents: number;
  discountCents: number;
  codeApplied: { code: string } | null;
};

export type Billing = {
  /** Null when the app user has no subscription. */
  subscription: {
    tierId: string | null;
    status: string;
    currentPeriodEnd: string | null;
    interval: "month" | "year" | null;
    /** The plan's price before any code; 0 on a complimentary plan. */
    listPriceCents: number | null;
    /** Access the app builder gave without a purchase: no payments, nothing to log. */
    complimentary: boolean;
    codeApplied: BillingCode | null;
  } | null;
  /** Paid invoices, newest first. Empty until the first charge and on a complimentary plan. */
  payments: BillingPayment[];
  /** Paid one-time products, newest first. */
  purchases: BillingPurchase[];
};

/** Stripe could not be read. Never substitute a plan price — retry later instead. */
export class BillingUnavailableError extends Error {
  constructor() {
    super("Billing is unavailable right now");
    this.name = "BillingUnavailableError";
  }
}

async function fetchBilling(env: Env, userId: string): Promise<Billing> {
  const appId = await resolveAppId(env);
  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/subscribers/${encodeURIComponent(userId)}/billing`,
  );
  if (!res.ok) throw new BillingUnavailableError();
  return res.json<Billing>();
}

/**
 * What the signed-in app user really paid, read live from Stripe — the only source for
 * money; the `subscription` row and `~/generated/tiers` say what a plan costs, not what this
 * person paid. A slow network read: call it on a success page, in an action or a scheduled job.
 */
export async function getBilling(request: Request, context: AppContext): Promise<Billing> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  return fetchBilling(env, user.id);
}

/**
 * `getBilling` for a named app user: for a scheduled job that logs renewals and for actions
 * gated behind `requireRole(request, env, "admin")`. Never pass an id taken from the URL or
 * form of an ordinary app user's request — that lets one app user read another's payments.
 */
export async function getBillingFor(
  userId: string,
  context: { cloudflare: { env: Env } },
): Promise<Billing> {
  return fetchBilling(context.cloudflare.env, userId);
}

/** The Payments panel's own figures for the whole app. Counts are the Subscribers tab's
 *  status chips: `active` excludes a subscription scheduled to cancel, which is `canceling`. */
export type SubscriberSummary = {
  subscribers: { all: number; active: number; canceling: number; past_due: number; canceled: number };
  /** Monthly recurring revenue of active and trialing subscriptions, yearly plans ÷ 12. */
  mrrCents: number;
  /** MRR of what renews next month: no trials, no pending cancellations. */
  forecastMrrCents: number;
  /** One-time products: paid orders, their gross, and what was refunded. */
  sales: { count: number; grossCents: number; refundsCents: number };
  currency: string;
};

/**
 * Subscriber counts, MRR and one-time sales totals across every app user, read from the same
 * ledger the Payments panel shows, so a dashboard built on it matches the panel. Only for an
 * admin screen or a scheduled job: gate the route with `requireRole(request, env, "admin")`.
 */
export async function getSubscriberSummary(context: {
  cloudflare: { env: Env };
}): Promise<SubscriberSummary> {
  const env = context.cloudflare.env;
  const appId = await resolveAppId(env);
  const res = await paymentsFetch(env, `/v1/apps/${appId}/subscribers/summary`);
  if (!res.ok) throw new BillingUnavailableError();
  return res.json<SubscriberSummary>();
}
