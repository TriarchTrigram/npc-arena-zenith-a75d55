import { redirect } from "../http";
import { requireAuth, getSession } from "~stencil/auth/server";
import { getSubscription as getAppSubscription, hasPlan } from "./server";
import type { AppContext } from "../types/context";
import { buyerRefCandidates, guestBuyerRef } from "./buyer-refs";

export { guestBuyerRef };

/**
 * Selling SDK — let *your users* charge *their own* customers (one-time card
 * or bank payments and subscriptions to a seller's recurring products). This is the
 * opposite direction from `~stencil/payments/server.ts`, which is how *you*
 * charge *your* users (subscriptions). No Stripe types or ids ever leak into app
 * code.
 *
 * The seller is one of your app's users who has completed Stripe-hosted
 * onboarding; the buyer is whoever pays them. **Buyers do NOT need an account
 * in your app.** Two modes:
 *
 * - **Guest (the default):** collect the buyer's email on your buy page and pass
 *   it as `buyerEmail`. The email *is* the buyer's identity: entitlement is
 *   answered per (email, reference), so `hasPurchased({ reference, buyerEmail })`
 *   is the gate. How the buyer later proves that email is your design — a link
 *   you email them (`~stencil/email`), an access code, a sign-in — Stencil
 *   stores no token or link for them.
 * - **Signed-in:** if you want buyers to register, put the buy flow behind your
 *   app's auth — a signed-in buyer is identified by their user id, as before.
 *   Roles and gating for registered buyers are then yours to build.
 *
 * What a seller sells lives in the app's own `seller_products` table, managed
 * with `createProduct` and friends; `buyProduct` sells a one-time one and
 * `hasPurchased({ productId })` gates it, `subscribeToProduct` sells a recurring
 * one and `hasActiveSubscription({ productId })` gates it. `sellerCheckout`
 * takes a `reference` of *your* own id instead (a package id, a listing id, …)
 * for apps that keep their own price list.
 *
 * Every call authenticates with the app's own per-app key and talks to the
 * hosted payments worker; you never handle card data or Stripe objects.
 */

const PAYMENTS_BASE = "https://payments.hellostencil.com";

/**
 * The app's `appId`, resolved once and cached. A deployed app worker is a single
 * isolate with a constant bearer key, so one lookup per isolate is enough. The
 * per-app routes are scoped by `appId`, which the app only learns at runtime.
 */
let cachedAppId: string | null = null;

/**
 * Fetch the payments service with the app's per-app bearer key attached.
 *
 * A deployed app must reach the service through its `PAYMENTS` service binding —
 * a plain `fetch()` to `payments.hellostencil.com` doesn't reach it. The plain
 * `fetch()` fallback is only used on the local dev server, which has no binding.
 * The bearer header is set the same way for either transport.
 */
function paymentsFetch(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${env.BACKEND_SERVICE_API_KEY ?? ""}`);
  if (typeof init?.body === "string") headers.set("Content-Type", "application/json");
  const req = new Request(`${PAYMENTS_BASE}${path}`, { ...init, headers });
  return env.PAYMENTS ? env.PAYMENTS.fetch(req) : fetch(req);
}

async function resolveAppId(env: Env): Promise<string> {
  if (cachedAppId) return cachedAppId;
  const res = await paymentsFetch(env, "/v1/whoami");
  if (!res.ok) throw new Error("Could not reach the payments service");
  const { appId } = await res.json<{ appId: string }>();
  cachedAppId = appId;
  return appId;
}

export type SellerStatus = {
  /**
   * `none` — never started · `onboarding` — Stripe KYC incomplete ·
   * `active` — can accept charges · `restricted` — Stripe needs more info.
   * Show selling UI only when `active`.
   */
  status: "none" | "onboarding" | "active" | "restricted";
  /** The seller's Stripe account id (`acct_…`); null until they start onboarding. */
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** Requirement keys Stripe is still waiting on (drives a "finish setup" nudge). */
  currentlyDue: string[];
  disabledReason: string | null;
  /**
   * Informational only: Stencil set sales tax up on the seller's account from their
   * Stripe details, and Stripe can now calculate it at checkout. Selling is never
   * gated on it — a seller sells with or without it, and `false` only means a detail
   * (usually the business address) is still missing in the Sales tax tab of their
   * dashboard (`sellerPanelLink(..., { panelPath: "/?tab=tax" })`).
   */
  taxReady?: boolean;
};

export type Purchase = {
  orderId: string;
  /** Your own id for the thing that was sold. */
  reference: string;
  description: string;
  /** Amount paid, in cents — the item plus any `extraLines`. */
  amount: number;
  currency: string;
  /** ISO timestamp, or null if not yet captured. */
  purchasedAt: string | null;
  /**
   * `paid` — the money is in. A bank payment is `processing` for a few business
   * days after checkout and becomes `paid` when it clears, or `failed` if the
   * bank declines or returns it. Only `paid` grants access.
   */
  status: "paid" | "processing" | "failed";
  /**
   * The buyer as saved on the seller's payments account. `customerId` is set only
   * when the checkout asked for `savePaymentMethod` and the buyer agreed; store it
   * on your own row and pass it to `chargeSavedMethod`. Null otherwise.
   */
  buyer: { customerId: string | null };
};

/** One of a seller's sales as `listSellerSales` returns it. */
export type SellerSale = {
  orderId: string;
  reference: string;
  description: string | null;
  /** The buyer: their email on a guest sale, else their app user id. */
  buyer: string;
  amountCents: number;
  currency: string;
  /** Stencil's commission plus Stripe's processing fee, in cents. */
  feeCents: number;
  /** Stripe's processing fee alone, in cents, as Stripe charged it; null until the charge settles. */
  stripeFeeCents: number | null;
  /** What the seller keeps after fees, in cents. */
  netCents: number;
  /** The order's status as stored: `paid`, `processing`, `failed`, `refunded`, `dispute_lost`, … */
  status: string;
  /** ISO timestamp of when the order was created. */
  createdAt: string;
  /** Stripe's ids for the money behind this order; null when that step never happened. */
  paymentIntentId: string | null;
  chargeId: string | null;
  refundId: string | null;
  disputeId: string | null;
  /** The card (brand and last four digits) or bank account (bank name and last four) the
   *  buyer paid with; null when nothing was charged or the lookup failed. */
  card: { brand: string | null; last4: string | null } | null;
};

/** What Stripe's checkout page offers the buyer. `us_bank_account` is ACH Direct
 *  Debit: the buyer picks their US bank account and the money clears in a few
 *  business days, so the purchase shows as `processing` until then. */
export type CheckoutPaymentMethod = "card" | "us_bank_account";

/** An extra line on the checkout page, on top of the item — a convenience fee,
 *  a surcharge. Shown to the buyer with its label and added to the total. */
export type CheckoutExtraLine = { label: string; amountCents: number };

// Only an app user on a plan may become a seller. The redirect carries a reason so the
// root notice can say why they landed there instead of on Stripe.
async function requireSellerPlan(request: Request, context: AppContext) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const { sub, paymentsEnabled } = await getAppSubscription(request, context);
  if (!hasPlan(sub, paymentsEnabled)) throw redirect("/upgrade?reason=seller-needs-plan");
  return { user };
}

/**
 * Start (or resume) Stripe-hosted seller onboarding for the current user, then
 * throw a redirect to Stripe's hosted KYC. Also the "fix it" entry point when a
 * seller is `restricted` — Stripe re-collects whatever is missing.
 *
 * Gated on an active subscription: only a paying subscriber of this app may
 * become a seller, so this throws a redirect to `/upgrade?reason=seller-needs-plan`
 * if the user isn't subscribed. The platform renders the reason on the page they land on.
 *
 * The first time a seller onboards you MUST pass their `country` (ISO 3166-1
 * alpha-2, e.g. "GB") — collect it in your own UI, because a Stripe account's
 * country is fixed at creation and can never change afterwards. An unsupported
 * country throws an error; surface it and let them pick another. `country` is
 * ignored once the account exists (resuming/fixing onboarding). Call from a
 * form action:
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     const form = await request.formData();
 *     await onboardSeller(request, context, { country: String(form.get("country")) });
 *   }
 *
 * After Stripe, the seller returns to `returnUrl` (defaults to `/app/sell`) —
 * re-check `getSellerStatus()` there, since onboarding may still be pending.
 */
export async function onboardSeller(
  request: Request,
  context: AppContext,
  opts?: { country?: string; returnUrl?: string; refreshUrl?: string },
): Promise<never> {
  const env = context.cloudflare.env;
  const { user } = await requireSellerPlan(request, context);
  const appId = await resolveAppId(env);
  const base = new URL(request.url).origin;

  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(user.id)}/onboard`,
    {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        displayName: user.name,
        country: opts?.country,
        returnUrl: opts?.returnUrl ?? `${base}/app/sell`,
        refreshUrl: opts?.refreshUrl ?? `${base}/app/sell`,
      }),
    },
  );
  if (!res.ok) {
    const err = await res
      .json<{ error?: string }>()
      .catch(() => ({}) as { error?: string });
    throw new Error(err.error ?? "Failed to start seller onboarding");
  }
  const { url } = await res.json<{ url: string }>();
  throw redirect(url);
}

/**
 * Connect the Stripe account the current user already owns — a Stripe Standard
 * account with its own dashboard — instead of creating a new one through
 * `onboardSeller`. Throws a redirect to Stripe, where the seller signs in and
 * authorizes your app; existing customers, saved cards and payouts stay on
 * their account. Gated on an active subscription like `onboardSeller`.
 *
 * After Stripe, the seller returns to `returnUrl` (defaults to `/app/sell`)
 * with `?stripe_connect=connected`, or `?stripe_connect=error&code=…` when the
 * connection was refused (`account_in_use`: another seller already holds that
 * Stripe account; `has_transactions`: this seller's current account has taken
 * payments and can't be swapped). Readiness then comes from `getSellerStatus()`;
 * a connected account that still needs details is fixed in the seller's own
 * Stripe dashboard, not through `onboardSeller`.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await connectExistingStripeAccount(request, context);
 *   }
 */
export async function connectExistingStripeAccount(
  request: Request,
  context: AppContext,
  opts?: { returnUrl?: string },
): Promise<never> {
  const env = context.cloudflare.env;
  const { user } = await requireSellerPlan(request, context);
  const appId = await resolveAppId(env);
  const base = new URL(request.url).origin;

  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(user.id)}/connect-link`,
    {
      method: "POST",
      body: JSON.stringify({
        email: user.email,
        returnUrl: opts?.returnUrl ?? `${base}/app/sell`,
      }),
    },
  );
  if (!res.ok) {
    const err = await res
      .json<{ error?: string }>()
      .catch(() => ({}) as { error?: string });
    throw new Error(err.error ?? "Failed to start connecting your Stripe account");
  }
  const { url } = await res.json<{ url: string }>();
  throw redirect(url);
}

/**
 * The current user's seller status. Never redirects — use it to decide what
 * selling UI to render (a "Start accepting payments" button when `none`, a
 * "finish setup" nudge when `onboarding`/`restricted`, the seller tools when
 * `active`).
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     const seller = await getSellerStatus(request, context);
 *     return { canSell: seller.status === "active" };
 *   }
 */
export async function getSellerStatus(
  request: Request,
  context: AppContext,
): Promise<SellerStatus> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const appId = await resolveAppId(env);

  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(user.id)}`,
  );
  if (!res.ok) throw new Error("Failed to load seller status");
  const data = await res.json<Partial<SellerStatus>>();
  return {
    status: data.status ?? "none",
    stripeAccountId: data.stripeAccountId ?? null,
    chargesEnabled: data.chargesEnabled ?? false,
    payoutsEnabled: data.payoutsEnabled ?? false,
    detailsSubmitted: data.detailsSubmitted ?? false,
    currentlyDue: data.currentlyDue ?? [],
    disabledReason: data.disabledReason ?? null,
    taxReady: data.taxReady ?? false,
  };
}

/**
 * Can this seller take a payment right now? The buyer-side readiness check for
 * public buy pages: `getSellerStatus` reads the *current* user, so a buyer's
 * loader can't use it to ask about the seller — this one takes any seller's
 * user id and never authenticates or redirects. Fails closed: any lookup
 * problem reports `{ ready: false }`.
 *
 * Gate the buy button on it — when the seller isn't ready, render a "not
 * accepting payments yet" notice instead of a checkout that would be rejected.
 *
 *   export async function loader({ context, params }: Route.LoaderArgs) {
 *     const item = await loadItem(params.reference);
 *     const { ready } = await getSellerReadiness(context, {
 *       sellerUserId: item.sellerUserId,
 *     });
 *     return { item, sellerReady: ready };
 *   }
 */
export async function getSellerReadiness(
  context: AppContext,
  opts: { sellerUserId: string },
): Promise<{ ready: boolean }> {
  const env = context.cloudflare.env;
  try {
    const appId = await resolveAppId(env);
    const res = await paymentsFetch(
      env,
      `/v1/apps/${appId}/sellers/${encodeURIComponent(opts.sellerUserId)}`,
    );
    if (!res.ok) return { ready: false };
    const data = await res.json<{ chargesEnabled?: boolean }>();
    return { ready: data.chargesEnabled === true };
  } catch {
    return { ready: false };
  }
}

/**
 * Start a checkout: the buyer pays the given seller for `reference`.
 * Throws a redirect to Stripe Checkout; after payment the buyer is sent to
 * `successUrl`. Enforces a $5 USD minimum on the server.
 *
 * **`amountCents`, `extraLines` and `sellerUserId` must come from state the
 * buyer cannot write** — the stored item you look up by `reference` inside the
 * action, and the fee settings you store for the seller. The platform charges
 * exactly the amounts you pass and never checks them against a price list, so
 * a number read from a form field, JSON body, or query string is a number the
 * buyer chose: they can pay $5 for a $500 item and the order is recorded as
 * paid.
 *
 * `paymentMethods` defaults to card. Add `"us_bank_account"` to let the buyer
 * pay by bank (ACH): the checkout completes at once but the money takes a few
 * business days to clear, so `hasPurchased` stays `false` and the purchase
 * reads `status: "processing"` until then — show "bank payment processing"
 * rather than a failure. A seller whose account can't take bank payments yet
 * rejects with `ach_unavailable`; a second checkout for a reference whose bank
 * payment is still clearing rejects with `payment_processing`.
 *
 * Up to three `extraLines` appear on Stripe's page under the item, each with
 * its label, and the order amount is the sum. The minimum applies to
 * `amountCents` alone.
 *
 * The buyer needs no account. Signed in, they're identified by their user id.
 * Signed out, they check out as a guest and you MUST pass `buyerEmail` — collect
 * it on the buy page (it also pre-fills Stripe). A guest checkout without an
 * email redirects back to `cancelUrl` with `?checkout_error=buyer_required`.
 *
 * If this buyer already owns `reference` this resolves cleanly by redirecting
 * to `successUrl` — they keep their access, they're never charged twice.
 *
 * Put whatever your success/purchase page needs to identify the buyer into
 * `successUrl` yourself (e.g. `?ref=<reference>&buyer=<email>`); Stencil adds
 * nothing to it.
 *
 * `amountCents` is the price before tax. Checkout asks the buyer for a billing
 * address and adds sales tax on top where the seller is registered, so show
 * "plus applicable tax" next to the price and never compute tax in the app.
 *
 * Expected rejections never crash the page: when the checkout can't start —
 * the seller isn't charge-ready yet (`seller_not_onboarded` /
 * `seller_not_ready`), the price is below the minimum (`below_minimum`), or
 * the request is otherwise invalid — this redirects back to `cancelUrl` with
 * `?checkout_error=<code>` appended. Read that param in the buy page's loader
 * and render it as a notice. Gate the buy button with `getSellerReadiness` so
 * buyers rarely reach a checkout that would bounce.
 *
 *   export async function action({ request, context, params }: Route.ActionArgs) {
 *     const pkg = await loadPackage(params.packageId); // your own DB read
 *     const form = await request.formData();
 *     await sellerCheckout(request, context, {
 *       sellerUserId: pkg.sellerUserId,
 *       reference: pkg.id,
 *       amountCents: pkg.priceCents,
 *       description: pkg.title,
 *       buyerEmail: String(form.get("email") || "") || undefined,
 *       paymentMethods: ["card", "us_bank_account"],
 *       // From the seller's stored settings, never from the form.
 *       extraLines: seller.convenienceFeeCents
 *         ? [{ label: "Convenience fee", amountCents: seller.convenienceFeeCents }]
 *         : [],
 *       successUrl: new URL("/app/purchases/success", request.url).toString(),
 *     });
 *   }
 */
export async function sellerCheckout(
  request: Request,
  context: AppContext,
  opts: {
    sellerUserId: string;
    amountCents: number;
    reference: string;
    description?: string;
    successUrl?: string;
    cancelUrl?: string;
    /** The buyer's email — required when nobody is signed in. When given it is
     *  the address Stripe bills and receipts, even for a signed-in buyer. */
    buyerEmail?: string;
    /** What the buyer may pay with; card only when omitted. */
    paymentMethods?: CheckoutPaymentMethod[];
    /** Up to three extra lines, computed on the server from stored settings. */
    extraLines?: CheckoutExtraLine[];
    /**
     * Keep the buyer's payment method for later charges (`chargeSavedMethod`).
     * Stripe's page shows its own consent text plus `futureCharges`, your plain
     * sentence of what will be charged and when ("$1,200 on Nov 1 and $900 on
     * Dec 5"). Only ask when the app will actually charge later. After payment
     * the purchase's `buyer.customerId` is set.
     */
    savePaymentMethod?: { futureCharges: string };
  },
): Promise<never> {
  const env = context.cloudflare.env;
  const session = await getSession(request, env);
  const appId = await resolveAppId(env);
  const base = new URL(request.url).origin;
  const successUrl = opts.successUrl ?? `${base}/app/purchases/success`;
  const cancelUrl = opts.cancelUrl ?? `${base}/app`;

  // An email the buy page collected wins over the login address: a signed-in
  // seller buying on a client's behalf wants the receipt at the client's email.
  const buyerEmail = opts.buyerEmail?.trim() || session?.user.email;
  if (!session && !buyerEmail) {
    // A guest is identified by email alone — without one there is nobody to
    // sell to. Same shape as every other expected rejection: back with a code.
    const back = new URL(cancelUrl, base);
    back.searchParams.set("checkout_error", "buyer_required");
    throw redirect(back.toString());
  }

  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(opts.sellerUserId)}/checkout`,
    {
      method: "POST",
      body: JSON.stringify({
        buyerRef: session?.user.id,
        buyerEmail,
        amountCents: opts.amountCents,
        reference: opts.reference,
        description: opts.description,
        successUrl,
        cancelUrl,
        paymentMethods: opts.paymentMethods,
        extraLines: opts.extraLines,
        savePaymentMethod: opts.savePaymentMethod,
      }),
    },
  );
  const data = await res
    .json<{ url?: string; error?: string; code?: string }>()
    .catch(() => ({}) as { url?: string; error?: string; code?: string });

  if (res.ok && data.url) throw redirect(data.url);
  // Already owned — clean, idempotent: keep access, don't double-charge.
  if (res.status === 409 && data.code === "already_purchased") {
    throw redirect(successUrl);
  }
  // Every other 4xx is an expected business state (seller not charge-ready,
  // price below minimum, …), not a crash: send the buyer back with a
  // machine-readable code the page can render as a notice. A thrown Error here
  // would hit the root ErrorBoundary, which hides messages in production — the
  // buyer would see a blank "unexpected error" page.
  if (res.status >= 400 && res.status < 500) {
    const back = new URL(cancelUrl, base);
    back.searchParams.set("checkout_error", data.code ?? "checkout_failed");
    throw redirect(back.toString());
  }
  throw new Error(data.error ?? "Failed to start checkout");
}


/**
 * Charge a buyer's payment method that is already saved on the seller's
 * payments account — the next installment of a plan, a retainer on autopay —
 * with nobody on a checkout page. `buyer.customerId` is the saved buyer's id on
 * the seller's account, stored on your own row (an invoice, a plan) when the
 * buyer was saved there. `sellerUserId`, `amountCents` and `customerId` come
 * from the app's stored state, never from a form or a request body — the same
 * rule as `sellerCheckout`.
 *
 * Resolves to the charge's outcome, never a redirect:
 * - `paid` — the money is in; `hasPurchased({ reference, buyerEmail })` is true.
 * - `processing` — a bank debit still clearing (a few business days); it becomes
 *   `paid` or `failed` on its own. Grant nothing on `processing`.
 * - `failed` — declined; `reason` is the bank's code (e.g. `insufficient_funds`,
 *   `authentication_required`). Tell the buyer and the seller, and retry once
 *   after a few days, never the same day.
 *
 * Idempotent on `reference` per seller: calling it again with a reference that
 * is already `paid` or `processing` reports that order and charges nothing, so
 * key each due date on its own stable reference (invoice id + installment
 * number) and a re-run of the schedule is safe. A refused charge — the seller
 * can't take payments yet (`seller_not_ready`), the buyer isn't found on the
 * seller's account (`customer_not_found`), nothing is saved to charge
 * (`no_payment_method`), below the $5 minimum (`below_minimum`) — throws an
 * Error whose message starts with that code.
 *
 * Two thrown codes mean the payment service refused, not the buyer's card:
 * `platform_permission` (a problem on Stencil's side) and `account_unreachable`
 * (Stripe no longer lets Stencil use the seller's payments account). Nothing was
 * charged and the reference is free to charge again. Never tell the buyer their
 * card was declined: tell the seller the payment service refused the charge,
 * and do not retry on the same day.
 *
 *   // In a scheduled action, after claiming the installment row:
 *   const result = await chargeSavedMethod(request, context, {
 *     sellerUserId: plan.sellerUserId,
 *     buyer: { customerId: plan.buyerCustomerId },
 *     amountCents: installment.amountCents,
 *     reference: `${plan.invoiceId}:${installment.number}`,
 *     description: `${plan.title} — installment ${installment.number}`,
 *   });
 */
export async function chargeSavedMethod(
  _request: Request,
  context: AppContext,
  opts: {
    sellerUserId: string;
    buyer: { customerId: string };
    amountCents: number;
    reference: string;
    description?: string;
  },
): Promise<{ status: "paid" | "processing" | "failed"; orderId: string; reason?: string }> {
  const env = context.cloudflare.env;
  const appId = await resolveAppId(env);
  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(opts.sellerUserId)}/charge`,
    {
      method: "POST",
      body: JSON.stringify({
        customerId: opts.buyer.customerId,
        amountCents: opts.amountCents,
        reference: opts.reference,
        description: opts.description,
      }),
    },
  );
  const data = await res
    .json<{ status?: "paid" | "processing" | "failed"; orderId?: string; reason?: string; error?: string; code?: string }>()
    .catch(() => ({}) as { error?: string; code?: string });
  if (res.ok && "status" in data && data.status && data.orderId) {
    return { status: data.status, orderId: data.orderId, ...(data.reason ? { reason: data.reason } : {}) };
  }
  throw new Error(`${data.code ?? "charge_failed"}: ${data.error ?? "Failed to charge the saved payment method"}`);
}

/**
 * A Stripe-hosted page where a saved buyer enters a new card, which replaces the
 * one later charges use. Send the buyer there after a `failed` charge, or when
 * they ask to change their card; they come back to `returnUrl` whether or not
 * they saved one. Resolves to `{ url }` — redirect the buyer to it. A refused
 * request (`seller_not_onboarded`, `customer_not_found`) throws an Error whose
 * message starts with that code.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     const { url } = await updatePaymentMethodLink(request, context, {
 *       sellerUserId: plan.sellerUserId,
 *       buyer: { customerId: plan.buyerCustomerId },
 *       returnUrl: new URL("/app/plans/" + plan.id, request.url).toString(),
 *     });
 *     throw redirect(url);
 *   }
 */
export async function updatePaymentMethodLink(
  _request: Request,
  context: AppContext,
  opts: { sellerUserId: string; buyer: { customerId: string }; returnUrl: string },
): Promise<{ url: string }> {
  const env = context.cloudflare.env;
  const appId = await resolveAppId(env);
  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(opts.sellerUserId)}/buyers/${encodeURIComponent(opts.buyer.customerId)}/update-method-link`,
    { method: "POST", body: JSON.stringify({ returnUrl: opts.returnUrl }) },
  );
  const data = await res
    .json<{ url?: string; error?: string; code?: string }>()
    .catch(() => ({}) as { url?: string; error?: string; code?: string });
  if (res.ok && data.url) return { url: data.url };
  throw new Error(`${data.code ?? "link_failed"}: ${data.error ?? "Could not open the payment method page"}`);
}

/**
 * Forget a buyer's saved payment method — the buyer's "stop automatic payments",
 * or the seller ending a plan. Every card or bank account saved on the buyer is
 * detached, so a later `chargeSavedMethod` is refused with `no_payment_method`;
 * the buyer's past purchases are untouched. Refused with `subscription_active`
 * while one of the seller's subscriptions still renews on it (cancel that
 * first). A refused call throws an Error whose message starts with the code.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await removeSavedMethod(request, context, {
 *       sellerUserId: plan.sellerUserId,
 *       buyer: { customerId: plan.buyerCustomerId },
 *     });
 *     await markPlanStopped(plan.id);
 *     return { stopped: true };
 *   }
 */
export async function removeSavedMethod(
  _request: Request,
  context: AppContext,
  opts: { sellerUserId: string; buyer: { customerId: string } },
): Promise<{ removed: true }> {
  const env = context.cloudflare.env;
  const appId = await resolveAppId(env);
  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(opts.sellerUserId)}/buyers/${encodeURIComponent(opts.buyer.customerId)}/saved-method`,
    { method: "DELETE" },
  );
  if (res.ok) return { removed: true };
  const data = await res
    .json<{ error?: string; code?: string }>()
    .catch(() => ({}) as { error?: string; code?: string });
  throw new Error(`${data.code ?? "remove_failed"}: ${data.error ?? "Could not remove the saved payment method"}`);
}

/** The buyer identities a purchase read runs as: an explicit `buyerRef` alone,
 *  else a guest's `buyerEmail` and the signed-in user, whichever exist. Never
 *  redirects — a visitor with no identity simply has no purchases. */
async function resolveBuyerRefs(
  request: Request,
  env: Env,
  opts?: { buyerRef?: string; buyerEmail?: string },
): Promise<string[]> {
  const session = opts?.buyerRef ? null : await getSession(request, env);
  return buyerRefCandidates({
    buyerRef: opts?.buyerRef,
    buyerEmail: opts?.buyerEmail,
    sessionUserId: session?.user.id,
  });
}

/**
 * Has the buyer paid for `reference` (or catalog product `productId`, the
 * reference `buyProduct` sells under)? The one-line entitlement gate. The buyer
 * resolves from an explicit `buyerRef`, else from a guest's `buyerEmail` and the
 * signed-in user together (a buyer who paid while signed in is found either
 * way) — and reports `false` when none exists, never redirecting to login. Reads
 * live from paid orders, so a refunded or disputed-lost purchase reports `false`
 * automatically — no revocation bookkeeping on your side, and a bank payment
 * still clearing is `false` too (see `getPurchases` for its status). Fails
 * closed (returns `false`) if the check can't be completed.
 *
 * For a guest, *you* decide how they prove their email before you call this
 * with it — a link you emailed, an access code, a sign-in. Never read the email
 * straight from an untrusted query string on a page that delivers the purchase.
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     if (!(await hasPurchased(request, context, { productId }))) {
 *       throw redirect("/app/buy/" + productId);
 *     }
 *     return { unlocked: true };
 *   }
 */
export async function hasPurchased(
  request: Request,
  context: AppContext,
  opts: ({ reference: string } | { productId: string }) & { buyerRef?: string; buyerEmail?: string },
): Promise<boolean> {
  const env = context.cloudflare.env;
  const buyerRefs = await resolveBuyerRefs(request, env, opts);
  if (!buyerRefs.length) return false;
  const appId = await resolveAppId(env);
  const reference = "productId" in opts ? opts.productId : opts.reference;

  const results = await Promise.all(
    buyerRefs.map(async (buyerRef) => {
      try {
        const res = await paymentsFetch(
          env,
          `/v1/apps/${appId}/buyers/${encodeURIComponent(buyerRef)}/purchases/${encodeURIComponent(reference)}`,
        );
        if (!res.ok) return false;
        const { purchased } = await res.json<{ purchased: boolean }>();
        return purchased === true;
      } catch {
        return false;
      }
    }),
  );
  return results.some(Boolean);
}

/**
 * Every current paid purchase for a buyer, plus bank payments still clearing
 * (`status: "processing"`). The buyer resolves like `hasPurchased` (explicit
 * `buyerRef`, else guest `buyerEmail` and signed-in user together), and a
 * visitor with no identity gets `[]` — never a login redirect. Like
 * `hasPurchased`, refunds and lost disputes drop out automatically. Use it for
 * a "My purchases" screen, showing a processing purchase as pending.
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     return { purchases: await getPurchases(request, context) };
 *   }
 */
export async function getPurchases(
  request: Request,
  context: AppContext,
  opts?: { buyerRef?: string; buyerEmail?: string },
): Promise<Purchase[]> {
  const env = context.cloudflare.env;
  const buyerRefs = await resolveBuyerRefs(request, env, opts);
  if (!buyerRefs.length) return [];
  const appId = await resolveAppId(env);

  const perBuyer = await Promise.all(
    buyerRefs.map(async (buyerRef): Promise<Purchase[]> => {
      try {
        const res = await paymentsFetch(
          env,
          `/v1/apps/${appId}/buyers/${encodeURIComponent(buyerRef)}/purchases`,
        );
        if (!res.ok) return [];
        const { purchases } = await res.json<{ purchases: Purchase[] }>();
        return purchases ?? [];
      } catch {
        return [];
      }
    }),
  );
  const byOrder = new Map<string, Purchase>();
  for (const purchase of perBuyer.flat()) byOrder.set(purchase.orderId, purchase);
  return [...byOrder.values()].sort((a, b) => {
    if (a.purchasedAt === b.purchasedAt) return 0;
    if (a.purchasedAt === null) return 1;
    if (b.purchasedAt === null) return -1;
    return b.purchasedAt.localeCompare(a.purchasedAt);
  });
}

/**
 * Everything one seller has been paid, newest first, with the Stripe ids behind
 * each order and the card or bank digits the buyer paid with. **Server-only, for
 * the app's own staff screens** — a support view that answers "was this client
 * charged twice?", "which card?", "was it refunded?". Gate the loader with
 * `requireRole(request, env, "admin")` (or the seller's own session) and never
 * return the result to another app user: it names other people's purchases.
 *
 * Cursor-paged: pass the `nextCursor` you got back to read the next page;
 * `limit` is 1–100 (default 25). A seller with no payments account gets an
 * empty page. `card` is read live from Stripe for each row, so it is null when
 * a lookup fails rather than failing the whole call.
 *
 * Each sale carries the real money: `stripeFeeCents` (Stripe's processing fee),
 * `feeCents` (that plus any Stencil commission) and `netCents`. For a report or
 * export pass `includeCard: false`: it skips the per-row Stripe read, `card` is null.
 *
 *   export async function loader({ request, context, params }: Route.LoaderArgs) {
 *     await requireRole(request, context.cloudflare.env, "admin");
 *     return listSellerSales(request, context, { sellerUserId: params.sellerId });
 *   }
 */
export async function listSellerSales(
  _request: Request,
  context: AppContext,
  opts: { sellerUserId: string; cursor?: string | null; limit?: number; includeCard?: boolean },
): Promise<{ sales: SellerSale[]; nextCursor: string | null }> {
  const env = context.cloudflare.env;
  const appId = await resolveAppId(env);
  const query = new URLSearchParams();
  if (opts.cursor) query.set("cursor", opts.cursor);
  if (opts.limit) query.set("limit", String(opts.limit));
  if (opts.includeCard === false) query.set("includeCard", "false");
  const qs = query.toString();
  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(opts.sellerUserId)}/sales${qs ? `?${qs}` : ""}`,
  );
  if (!res.ok) throw new Error("Could not load the seller's sales");
  const data = await res.json<{ sales?: SellerSale[]; nextCursor?: string | null }>();
  return { sales: data.sales ?? [], nextCursor: data.nextCursor ?? null };
}

/**
 * Remove the current user's seller account entirely — closes their Stripe
 * account so they can start over (for example after onboarding in the wrong
 * country, which Stripe can't change). Re-onboarding afterwards mints a
 * brand-new Stripe account. Returns `{ removed: false, reason }` without
 * deleting anything if the seller has already taken payments — surface `reason`
 * to them rather than treating it as an error.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     return await disconnectSeller(request, context); // render reason when removed === false
 *   }
 */
export async function disconnectSeller(
  request: Request,
  context: AppContext,
): Promise<{ removed: boolean; reason?: string }> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const appId = await resolveAppId(env);

  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(user.id)}`,
    { method: "DELETE" },
  );
  if (res.ok) return { removed: true };

  const data = await res
    .json<{ error?: string; code?: string }>()
    .catch(() => ({}) as { error?: string; code?: string });
  if (res.status === 409 && data.code === "has_transactions") {
    return {
      removed: false,
      reason: data.error ?? "You have already taken payments, so this account can't be removed.",
    };
  }
  throw new Error(data.error ?? "Could not remove the seller account");
}

/**
 * Mint a single-use, short-lived magic link for the current user (a seller) and
 * throw a redirect straight into their hosted seller dashboard — one click, no
 * password, no email. The dashboard is where sellers see revenue and sales and
 * issue refunds / respond to disputes (all panel-only, not in this SDK).
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     await sellerPanelLink(request, context);
 *   }
 *
 * `panelPath` is an optional page inside the hosted dashboard to open (e.g. "/payouts",
 * or "/?tab=tax" for a "Sales tax settings" link, where the seller adds registrations or
 * fixes their address). It is never an app URL: the dashboard lives on its own origin, and
 * a URL outside it is ignored. Unlike `onboardSeller`'s `returnUrl`, the seller is not sent
 * back to the app.
 */
export async function sellerPanelLink(
  request: Request,
  context: AppContext,
  opts?: { panelPath?: string },
): Promise<never> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const appId = await resolveAppId(env);

  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(user.id)}/panel-link`,
    {
      method: "POST",
      body: JSON.stringify({ callbackURL: opts?.panelPath }),
    },
  );
  const data = await res
    .json<{ url?: string; error?: string }>()
    .catch(() => ({}) as { url?: string; error?: string });

  if (res.ok && data.url) throw redirect(data.url);
  throw new Error(data.error ?? "Could not open the seller dashboard");
}

/** Someone the seller lets read their payouts, balance and transactions. */
export type PanelViewer = {
  id: string;
  email: string;
  /** ISO time of the latest invite; its emailed link works for 30 days. */
  invitedAt: string;
};

export type PanelViewerResult =
  | { ok: true; viewer: PanelViewer }
  | {
      ok: false;
      /** `email_invalid`, `email_is_seller`, `seller_not_onboarded`, `viewer_limit` (5 per
       *  seller), `account_connected` (the seller uses their own Stripe account and adds
       *  team members there) or `invite_email_failed`. */
      code: string;
      /** Ready to show to the seller. */
      error: string;
    };

function viewersPath(appId: string, userId: string): string {
  return `/v1/apps/${appId}/sellers/${encodeURIComponent(userId)}/viewers`;
}

/**
 * The people the current user (a seller) shares their money with, oldest first.
 * A viewer, such as a bookkeeper, opens a view-only page of the seller's hosted
 * dashboard: payouts, balance and transactions, and nothing they can change.
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     return { viewers: await listPanelViewers(request, context) };
 *   }
 */
export async function listPanelViewers(
  request: Request,
  context: AppContext,
): Promise<PanelViewer[]> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const appId = await resolveAppId(env);
  const res = await paymentsFetch(env, viewersPath(appId, user.id));
  if (!res.ok) throw new Error("Could not load who you share your payments with");
  const data = await res.json<{ viewers?: PanelViewer[] }>();
  return data.viewers ?? [];
}

/**
 * Invite someone by email to view the current user's (a seller's) payouts,
 * balance and transactions. Stencil emails them a link that signs them in, with
 * no account in your app; the link works for 30 days. Inviting the same email
 * again re-sends the invite and retires the earlier link. A refusal comes back
 * as `{ ok: false, code, error }`: show `error` next to the form.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     const form = await request.formData();
 *     return invitePanelViewer(request, context, { email: String(form.get("email")) });
 *   }
 */
export async function invitePanelViewer(
  request: Request,
  context: AppContext,
  opts: { email: string },
): Promise<PanelViewerResult> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const appId = await resolveAppId(env);
  const res = await paymentsFetch(env, viewersPath(appId, user.id), {
    method: "POST",
    body: JSON.stringify({ email: opts.email }),
  });
  const data = await res
    .json<{ viewer?: PanelViewer; error?: string; code?: string }>()
    .catch(() => ({}) as { viewer?: PanelViewer; error?: string; code?: string });
  if (res.ok && data.viewer) return { ok: true, viewer: data.viewer };
  if (data.code) return { ok: false, code: data.code, error: data.error ?? "Could not send the invite" };
  throw new Error(data.error ?? "Could not send the invite");
}

/**
 * Stop sharing with one viewer of the current user (a seller). Their invite link
 * stops working and a page they already have open is refused on its next load.
 * `viewerId` is the `id` from `listPanelViewers`.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     const form = await request.formData();
 *     await revokePanelViewer(request, context, { viewerId: String(form.get("viewerId")) });
 *   }
 */
export async function revokePanelViewer(
  request: Request,
  context: AppContext,
  opts: { viewerId: string },
): Promise<void> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const appId = await resolveAppId(env);
  const res = await paymentsFetch(
    env,
    `${viewersPath(appId, user.id)}/${encodeURIComponent(opts.viewerId)}`,
    { method: "DELETE" },
  );
  // 404: already removed, which is what the caller asked for.
  if (!res.ok && res.status !== 404) throw new Error("Could not remove this person");
}

/** Card checkout's floor, in cents. The payments service enforces it again at checkout. */
const MIN_PRICE_CENTS = 500;

/** How often a recurring product renews: `quarter` is every 3 months, `half_year` every 6. */
export const SELLER_INTERVALS = ["month", "quarter", "half_year", "year"] as const;
export type SellerInterval = (typeof SELLER_INTERVALS)[number];

export type SellerProduct = {
  id: string;
  sellerUserId: string;
  name: string;
  description: string;
  /** `one_time` is bought once; `recurring` renews every `interval`. */
  kind: "one_time" | "recurring";
  amountCents: number;
  currency: string;
  /** Set for a recurring product; null for a one-time one. */
  interval: SellerInterval | null;
  /** Display order, low → high. */
  position: number;
  /** Archived products take no new buyers; they are never deleted. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * A rejected write is `ok: false` with a `code` (`seller_not_ready`,
 * `name_required`, `name_taken`, `below_minimum`, `kind_invalid`,
 * `interval_invalid`, `no_product`); show `error` to the seller.
 */
export type ProductResult =
  | { ok: true; product: SellerProduct }
  | { ok: false; code: string; error: string };

// The catalog ships in a new app's seed, but apps provisioned earlier have
// none. Create it on first use; the flag keeps it to one batch per isolate.
const SELLER_PRODUCTS_DDL = [
  "CREATE TABLE IF NOT EXISTS `seller_products` (`id` text PRIMARY KEY NOT NULL, `seller_user_id` text NOT NULL, `name` text NOT NULL, `description` text DEFAULT '' NOT NULL, `kind` text NOT NULL, `amount_cents` integer NOT NULL, `currency` text DEFAULT 'usd' NOT NULL, `interval` text, `position` integer DEFAULT 0 NOT NULL, `active` integer DEFAULT 1 NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);",
  "CREATE INDEX IF NOT EXISTS `seller_products_seller_active_idx` ON `seller_products` (`seller_user_id`, `active`);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `seller_products_seller_name_active_unique` ON `seller_products` (`seller_user_id`, `name`) WHERE `active` = 1;",
];

let productsEnsured = false;

async function ensureProductsTable(env: Env): Promise<void> {
  if (productsEnsured) return;
  await env.DB.batch(SELLER_PRODUCTS_DDL.map((sql) => env.DB.prepare(sql)));
  productsEnsured = true;
}

type SellerProductRow = {
  id: string;
  seller_user_id: string;
  name: string;
  description: string;
  kind: SellerProduct["kind"];
  amount_cents: number;
  currency: string;
  interval: SellerProduct["interval"];
  position: number;
  active: number;
  created_at: number;
  updated_at: number;
};

const PRODUCT_COLUMNS =
  "id, seller_user_id, name, description, kind, amount_cents, currency, interval, position, active, created_at, updated_at";

function toSellerProduct(r: SellerProductRow): SellerProduct {
  return {
    id: r.id,
    sellerUserId: r.seller_user_id,
    name: r.name,
    description: r.description,
    kind: r.kind,
    amountCents: r.amount_cents,
    currency: r.currency,
    interval: r.interval,
    position: r.position,
    active: r.active === 1,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

async function readProduct(env: Env, productId: string): Promise<SellerProduct | null> {
  await ensureProductsTable(env);
  const row = await env.DB.prepare(`SELECT ${PRODUCT_COLUMNS} FROM seller_products WHERE id = ?`)
    .bind(productId)
    .first<SellerProductRow>();
  return row ? toSellerProduct(row) : null;
}

const rejected = (code: string, error: string): ProductResult => ({ ok: false, code, error });

function checkAmount(amountCents: unknown): ProductResult | null {
  return typeof amountCents === "number" && Number.isInteger(amountCents) && amountCents >= MIN_PRICE_CENTS
    ? null
    : rejected("below_minimum", `The price must be a whole number of cents, at least ${MIN_PRICE_CENTS}.`);
}

/** Run a catalog write, reporting the partial unique index as `name_taken`. */
async function writeProduct(env: Env, stmt: D1PreparedStatement, productId: string): Promise<ProductResult> {
  try {
    await stmt.run();
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(String(err))) {
      return rejected("name_taken", "An active product already has this name.");
    }
    throw err;
  }
  const product = await readProduct(env, productId);
  if (!product) throw new Error("The product could not be saved");
  return { ok: true, product };
}

/**
 * Add a product the current user sells, stored in the app's own database.
 * Needs `getSellerStatus()` to be `active`. `interval` is required for a
 * `recurring` product and not allowed on a `one_time` one. `amountCents` is the
 * price before tax: checkout adds sales tax on top where the seller is
 * registered, so show "plus applicable tax" next to it.
 *
 *   export async function action({ request, context }: Route.ActionArgs) {
 *     const form = await request.formData();
 *     return await createProduct(request, context, {
 *       name: String(form.get("name")),
 *       kind: "one_time",
 *       amountCents: Math.round(Number(form.get("price")) * 100),
 *     }); // render `error` when ok === false
 *   }
 */
export async function createProduct(
  request: Request,
  context: AppContext,
  opts: {
    name: string;
    description?: string;
    kind: SellerProduct["kind"];
    amountCents: number;
    interval?: SellerInterval;
    position?: number;
  },
): Promise<ProductResult> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const name = opts.name?.trim();
  if (!name) return rejected("name_required", "A product needs a name.");
  if (opts.kind !== "one_time" && opts.kind !== "recurring") {
    return rejected("kind_invalid", "kind must be one_time or recurring.");
  }
  const badAmount = checkAmount(opts.amountCents);
  if (badAmount) return badAmount;
  const interval = opts.kind === "recurring" ? opts.interval : null;
  if (opts.kind === "recurring" && !SELLER_INTERVALS.includes(interval as SellerInterval)) {
    return rejected("interval_invalid", "A recurring product needs an interval of month, quarter, half_year or year.");
  }
  if (opts.kind === "one_time" && opts.interval != null) {
    return rejected("interval_invalid", "A one-time product has no interval.");
  }
  if ((await getSellerStatus(request, context)).status !== "active") {
    return rejected("seller_not_ready", "Finish payment setup before adding products.");
  }

  await ensureProductsTable(env);
  const id = `sprod_${crypto.randomUUID().replace(/-/g, "")}`;
  const now = Date.now();
  return writeProduct(
    env,
    env.DB.prepare(
      `INSERT INTO seller_products (${PRODUCT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, 'usd', ?, ?, 1, ?, ?)`,
    ).bind(
      id,
      user.id,
      name,
      opts.description?.trim() ?? "",
      opts.kind,
      opts.amountCents,
      interval,
      opts.position ?? 0,
      now,
      now,
    ),
    id,
  );
}

/**
 * Edit one of the current user's products. A new `amountCents` applies to new
 * buyers only; `kind` and `interval` can't change (archive and create a new one).
 */
export async function updateProduct(
  request: Request,
  context: AppContext,
  opts: { productId: string; name?: string; description?: string; amountCents?: number; position?: number },
): Promise<ProductResult> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const existing = await readProduct(env, opts.productId);
  if (!existing || existing.sellerUserId !== user.id) return rejected("no_product", "Product not found.");

  const name = opts.name === undefined ? existing.name : opts.name.trim();
  if (!name) return rejected("name_required", "A product needs a name.");
  const amountCents = opts.amountCents ?? existing.amountCents;
  const badAmount = checkAmount(amountCents);
  if (badAmount) return badAmount;

  return writeProduct(
    env,
    env.DB.prepare(
      "UPDATE seller_products SET name = ?, description = ?, amount_cents = ?, position = ?, updated_at = ? WHERE id = ?",
    ).bind(
      name,
      opts.description?.trim() ?? existing.description,
      amountCents,
      opts.position ?? existing.position,
      Date.now(),
      existing.id,
    ),
    existing.id,
  );
}

/** Archive one of the current user's products: no new buyers, and anyone who
 *  already bought or subscribes keeps their access. Products are never deleted. */
export async function archiveProduct(
  request: Request,
  context: AppContext,
  opts: { productId: string },
): Promise<ProductResult> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const existing = await readProduct(env, opts.productId);
  if (!existing || existing.sellerUserId !== user.id) return rejected("no_product", "Product not found.");
  return writeProduct(
    env,
    env.DB.prepare("UPDATE seller_products SET active = 0, updated_at = ? WHERE id = ?").bind(Date.now(), existing.id),
    existing.id,
  );
}

/**
 * A seller's products by `position`: `sellerUserId` for a public storefront (no
 * sign-in), else the current user's own. Archived products only with `includeArchived`.
 */
export async function listProducts(
  request: Request,
  context: AppContext,
  opts?: { sellerUserId?: string; includeArchived?: boolean },
): Promise<SellerProduct[]> {
  const env = context.cloudflare.env;
  const sellerUserId = opts?.sellerUserId ?? (await requireAuth(request, env)).user.id;
  await ensureProductsTable(env);
  const { results } = await env.DB.prepare(
    `SELECT ${PRODUCT_COLUMNS} FROM seller_products WHERE seller_user_id = ?` +
      (opts?.includeArchived ? "" : " AND active = 1") +
      " ORDER BY position, created_at",
  )
    .bind(sellerUserId)
    .all<SellerProductRow>();
  return results.map(toSellerProduct);
}

/** One product by id, archived ones included (check `active`), or null. Needs
 *  no sign-in, so a public buy page can render it. */
export async function getProduct(
  context: AppContext,
  opts: { productId: string },
): Promise<SellerProduct | null> {
  return readProduct(context.cloudflare.env, opts.productId);
}

/**
 * Buy a one-time catalog product: `sellerCheckout` with the price, seller and
 * name read from the product row on the server, and the product id as the
 * reference, so `hasPurchased({ productId })` is the gate afterwards. Guests
 * pass `buyerEmail` exactly as with `sellerCheckout`, `paymentMethods` and
 * `extraLines` work the same (and `extraLines` must likewise come from stored
 * settings, never the form), and every rejection redirects back to `cancelUrl`
 * with `?checkout_error=<code>` — including `product_unavailable` (missing,
 * archived, or not a one-time product). The price is before tax: Checkout asks
 * the buyer for a billing address and adds sales tax on top where the seller is
 * registered, so show "plus applicable tax" next to it.
 *
 *   export async function action({ request, context, params }: Route.ActionArgs) {
 *     const form = await request.formData();
 *     await buyProduct(request, context, {
 *       productId: params.productId,
 *       buyerEmail: String(form.get("email") || "") || undefined,
 *     });
 *   }
 */
export async function buyProduct(
  request: Request,
  context: AppContext,
  opts: {
    productId: string;
    successUrl?: string;
    cancelUrl?: string;
    buyerEmail?: string;
    paymentMethods?: CheckoutPaymentMethod[];
    extraLines?: CheckoutExtraLine[];
    savePaymentMethod?: { futureCharges: string };
  },
): Promise<never> {
  const product = await readProduct(context.cloudflare.env, opts.productId);
  if (!product || !product.active || product.kind !== "one_time") {
    const base = new URL(request.url).origin;
    const back = new URL(opts.cancelUrl ?? `${base}/app`, base);
    back.searchParams.set("checkout_error", "product_unavailable");
    throw redirect(back.toString());
  }
  return sellerCheckout(request, context, {
    sellerUserId: product.sellerUserId,
    amountCents: product.amountCents,
    reference: product.id,
    description: product.name,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
    buyerEmail: opts.buyerEmail,
    paymentMethods: opts.paymentMethods,
    extraLines: opts.extraLines,
    savePaymentMethod: opts.savePaymentMethod,
  });
}

export type SellerSubscription = {
  productId: string;
  sellerUserId: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired";
  /** End of the paid period. A canceled subscription keeps access until then. */
  currentPeriodEnd: Date | null;
  /** Set while a cancellation is pending: access runs until this date, then stops. */
  cancelAt: Date | null;
  /** Whether this subscription grants access right now. */
  active: boolean;
};

type SellerSubscriptionRow = {
  product_id: string;
  seller_user_id: string;
  status: SellerSubscription["status"];
  current_period_end: number | null;
  cancel_at: number | null;
};

function toSellerSubscription(r: SellerSubscriptionRow): SellerSubscription {
  const periodEnd = r.current_period_end ? new Date(r.current_period_end * 1000) : null;
  return {
    productId: r.product_id,
    sellerUserId: r.seller_user_id,
    status: r.status,
    currentPeriodEnd: periodEnd,
    cancelAt: r.cancel_at ? new Date(r.cancel_at * 1000) : null,
    active:
      r.status === "active" ||
      r.status === "trialing" ||
      r.status === "past_due" ||
      (r.status === "canceled" && !!periodEnd && periodEnd > new Date()),
  };
}

/** The signed-in user's seller subscriptions, from the app's own database. The
 *  table appears with the app's first subscriber, and a table still keyed by plan
 *  is rebuilt on its next sync, so until then there are none. */
async function readSellerSubscriptions(env: Env, userId: string, productId?: string) {
  try {
    const stmt = productId
      ? env.DB.prepare(
          "SELECT product_id, seller_user_id, status, current_period_end, cancel_at FROM seller_subscription WHERE user_id = ? AND product_id = ?",
        ).bind(userId, productId)
      : env.DB.prepare(
          "SELECT product_id, seller_user_id, status, current_period_end, cancel_at FROM seller_subscription WHERE user_id = ?",
        ).bind(userId);
    const { results } = await stmt.all<SellerSubscriptionRow>();
    return results.map(toSellerSubscription);
  } catch (err) {
    if (/no such (table|column)/i.test(String(err))) return [];
    throw err;
  }
}

/**
 * Subscribe the signed-in user to a recurring catalog product: throws a redirect
 * to Stripe Checkout, with the price, interval, seller and name read from the
 * product row on the server. **Access is granted by Stripe's confirmation, not by
 * the redirect** — the `successUrl` page may load a moment before it lands, so
 * gate every page with `hasActiveSubscription`, never with the success redirect.
 *
 * Subscriptions need a signed-in buyer. Expected rejections redirect back to
 * `cancelUrl` with `?checkout_error=<code>`: `buyer_required` (nobody signed in),
 * `product_unavailable` (missing, archived, or not a recurring product),
 * `already_subscribed` (they already subscribe to this seller — to change
 * product they cancel in `manageSellerSubscription`, then subscribe again),
 * `seller_not_ready`. The price is before tax: Checkout asks the buyer for a
 * billing address and adds sales tax on top where the seller is registered, so
 * show "plus applicable tax" next to it.
 *
 *   export async function action({ request, context, params }: Route.ActionArgs) {
 *     await subscribeToProduct(request, context, {
 *       productId: String((await request.formData()).get("productId")),
 *       successUrl: new URL("/app/members-area", request.url).toString(),
 *     });
 *   }
 */
export async function subscribeToProduct(
  request: Request,
  context: AppContext,
  opts: { productId: string; successUrl?: string; cancelUrl?: string },
): Promise<never> {
  const env = context.cloudflare.env;
  const session = await getSession(request, env);
  const base = new URL(request.url).origin;
  const successUrl = opts.successUrl ?? `${base}/app`;
  const cancelUrl = opts.cancelUrl ?? request.url;
  const back = (code: string) => {
    const url = new URL(cancelUrl, base);
    url.searchParams.set("checkout_error", code);
    return redirect(url.toString());
  };
  if (!session) throw back("buyer_required");
  const product = await readProduct(env, opts.productId);
  if (!product || !product.active || product.kind !== "recurring" || !product.interval) {
    throw back("product_unavailable");
  }

  const appId = await resolveAppId(env);
  const res = await paymentsFetch(
    env,
    `/v1/apps/${appId}/sellers/${encodeURIComponent(product.sellerUserId)}/subscribe`,
    {
      method: "POST",
      body: JSON.stringify({
        buyerUserId: session.user.id,
        buyerEmail: session.user.email,
        productId: product.id,
        amountCents: product.amountCents,
        interval: product.interval,
        name: product.name,
        successUrl,
        cancelUrl,
      }),
    },
  );
  const data = await res
    .json<{ url?: string; error?: string; code?: string }>()
    .catch(() => ({}) as { url?: string; error?: string; code?: string });
  if (res.ok && data.url) throw redirect(data.url);
  if (res.status >= 400 && res.status < 500) throw back(data.code ?? "checkout_failed");
  throw new Error(data.error ?? "Failed to start checkout");
}

/**
 * Does the signed-in user have access to `productId` right now? The gate for
 * subscriber-only pages: one read of the app's own database, `false` for a
 * signed-out visitor, never a redirect. Past-due subscribers keep access while
 * Stripe retries the card; a canceled one keeps it until the paid period ends.
 *
 *   export async function loader({ request, context }: Route.LoaderArgs) {
 *     if (!(await hasActiveSubscription(request, context, { productId }))) {
 *       throw redirect("/app/pricing");
 *     }
 *     return { unlocked: true };
 *   }
 */
export async function hasActiveSubscription(
  request: Request,
  context: AppContext,
  opts: { productId: string },
): Promise<boolean> {
  return (await getSubscription(request, context, opts))?.active === true;
}

/** The signed-in user's subscription to `productId` (status and next date
 *  for a billing section), or null. Never redirects. */
export async function getSubscription(
  request: Request,
  context: AppContext,
  opts: { productId: string },
): Promise<SellerSubscription | null> {
  const env = context.cloudflare.env;
  const session = await getSession(request, env);
  if (!session) return null;
  const [sub] = await readSellerSubscriptions(env, session.user.id, opts.productId);
  return sub ?? null;
}

/** Every seller subscription of the signed-in user, ended ones included (check
 *  `active`). `[]` for a signed-out visitor. */
export async function getSubscriptions(
  request: Request,
  context: AppContext,
): Promise<SellerSubscription[]> {
  const env = context.cloudflare.env;
  const session = await getSession(request, env);
  if (!session) return [];
  return readSellerSubscriptions(env, session.user.id);
}

/**
 * The "Manage billing" button: throws a redirect to Stripe's billing portal for
 * the signed-in user's subscription to `productId`, returning to `returnUrl`. The
 * portal is where subscribers update their card, see invoices and cancel — do
 * not build any of those in the app (a seller ending a subscriber's billing is
 * `cancelSubscriber`). Every change there flows back to
 * `hasActiveSubscription` on its own. Without a subscription it redirects to
 * `returnUrl` with `?billing_error=not_subscribed`.
 */
export async function manageSellerSubscription(
  request: Request,
  context: AppContext,
  opts: { productId: string; returnUrl?: string },
): Promise<never> {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const returnUrl = opts.returnUrl ?? request.url;
  const [sub] = await readSellerSubscriptions(env, user.id, opts.productId);
  const res = sub
    ? await paymentsFetch(
        env,
        `/v1/apps/${await resolveAppId(env)}/sellers/${encodeURIComponent(sub.sellerUserId)}/portal`,
        { method: "POST", body: JSON.stringify({ buyerUserId: user.id, returnUrl }) },
      )
    : null;
  const data = res
    ? await res
        .json<{ url?: string; error?: string; code?: string }>()
        .catch(() => ({}) as { url?: string; error?: string; code?: string })
    : { code: "not_subscribed" };
  if (res?.ok && data.url) throw redirect(data.url);
  if (!res || (res.status >= 400 && res.status < 500)) {
    const back = new URL(returnUrl, new URL(request.url).origin);
    back.searchParams.set("billing_error", data.code ?? "portal_failed");
    throw redirect(back.toString());
  }
  throw new Error(data.error ?? "Could not open billing");
}

export type CancelSubscriberResult =
  /** Billing is stopped. `alreadyEnded`: nothing was left to cancel. */
  | { canceled: true; alreadyEnded: boolean }
  /** This person never subscribed to the seller, so there was nothing to stop. */
  | { canceled: false; reason: "not_subscribed" };

/**
 * Stop billing one of a seller's subscribers, in the same action that removes them. `period_end`
 * keeps access to the paid date, `immediate` ends it now; neither refunds. The seller is the signed-in
 * user, or `sellerUserId` read from your own stored record, never from the request.
 */
export async function cancelSubscriber(
  request: Request,
  context: AppContext,
  opts: { subscriberUserId: string; mode: "period_end" | "immediate"; sellerUserId?: string },
): Promise<CancelSubscriberResult> {
  const env = context.cloudflare.env;
  const sellerUserId = opts.sellerUserId ?? (await requireAuth(request, env)).user.id;
  const res = await paymentsFetch(
    env,
    `/v1/apps/${await resolveAppId(env)}/sellers/${encodeURIComponent(sellerUserId)}/subscriptions/cancel`,
    { method: "POST", body: JSON.stringify({ buyerUserId: opts.subscriberUserId, mode: opts.mode }) },
  );
  const data = await res
    .json<{ alreadyCanceled?: boolean; error?: string; code?: string }>()
    .catch(() => ({}) as { alreadyCanceled?: boolean; error?: string; code?: string });
  if (res.ok) return { canceled: true, alreadyEnded: data.alreadyCanceled === true };
  if (res.status === 404 && data.code === "not_subscribed") return { canceled: false, reason: "not_subscribed" };
  throw new Error(`${data.code ?? "cancel_failed"}: ${data.error ?? "Could not cancel the subscription"}`);
}
