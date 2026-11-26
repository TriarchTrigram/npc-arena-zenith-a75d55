---
name: selling
description: Let the app's own users sell to and get paid by THEIR customers — one-time card or bank (ACH) payments, with optional extra lines such as a fee, or recurring subscriptions, sold from one product catalog in the app's own database, where each seller is the merchant of record and is paid directly to their own bank account. Use when the app builder wants their app users to charge people, e.g. "let my photographers sell photo packages to parents", "let tutors take payment from students", "add a buy button so sellers get paid", "marketplace where my users sell to their customers", "let coaches sell a monthly membership to their clients", "let my clients pay invoices by bank transfer", "add a 3% card fee at checkout", entitlement / "has this person paid" checks, a seller dashboard, the card fee and what the seller keeps on each sale, "hold the money until the buyer accepts" / pay on approval / escrow asks, or taking a card in person at a counter. DIFFERENT from the `payments` skill — `payments` is the app builder charging their own app users a subscription or a one-time product; `selling` is the app's users charging their own customers, once or every month or year.
allowed-tools: getPaymentStatus setupPayments getPayoutSetupLink setSubscriptionPrice
metadata:
  agents: [chat, builder]
---

You help app builders add **selling** to an app: the app's own users (**sellers**) accept card or bank
payments from **their** customers (**buyers**). Each seller is the merchant of record and is
paid directly on their own Stripe account.

Everything a seller sells is a **product** in one catalog: the `seller_products` table in the app's own
database, written and read through the SDK below. A product is one of two kinds, and a seller can sell both:

- **One-time** — pay once (`buyProduct`, gated with `hasPurchased({ productId })`). Buyers can be guests.
- **Recurring** — every month, 3 months, 6 months or year (`subscribeToProduct`, gated with `hasActiveSubscription`).
  **Buyers must be signed in**; see "Seller subscriptions" below.

Creating a product is one row in the app's database — nothing is created in Stripe until someone buys.
Every price is read from the product row on the server, never from the buyer's browser.

**Sales tax is handled by Stencil for every seller — on by default, no toggle, nothing for the seller to do
before they sell.** Stencil sets Stripe Tax up on the seller's account from the details they gave Stripe at
onboarding. Prices are shown **before tax**; checkout collects the buyer's billing address and adds tax on
top only where the seller holds a registration (no registration anywhere → no tax, never an error). The
seller files and pays the tax themselves; Stripe charges them 0.5% on each taxed sale. Show "plus
applicable tax" next to every seller price, never compute tax in the app, and send sellers to the **Sales
tax** tab of their dashboard — `sellerPanelLink(request, context, { panelPath: "/?tab=tax" })` — to add
registrations or fix a missing address. `getSellerStatus().taxReady` is informational only and never gates
selling.

Everything from here to "Seller subscriptions" is about one-time sales unless it says otherwise.

## Which one-time path — the catalog, or the app's own item tables

- **New apps, and apps with no item table of their own, sell from the catalog.** Products live in
  `seller_products`; the buy page calls `buyProduct` and gates with `hasPurchased({ productId })`.
- **An app that already has its own item tables and calls `sellerCheckout` keeps doing so.** That is the
  "app owns its catalog" path, and it is fully supported, not deprecated: the app prices its own items,
  carts or invoices, passes its own `reference`, and gates with `hasPurchased({ reference })` and
  `getPurchases`. A flat product row cannot hold price sheets, carts, tax, shipping or coupons.
- **Never move an existing app onto `seller_products` as a side effect of another task** — not while
  fixing a bug, restyling a page, or adding subscriptions. Only the app builder can ask for that move.
  An update build that touches selling leaves an existing `sellerCheckout` flow and its code as it is.
- Recurring products always come from the catalog (`subscribeToProduct`). Adding subscriptions to an app
  that owns its one-time items adds recurring products only; its one-time checkout stays put.

**Buyers need no app account.** Guest checkout is the default: the buy page collects the buyer's
email, they pay on Stripe Checkout, and that email is their whole identity — `hasPurchased({ productId,
buyerEmail })` is the gate. Stencil stores no token, link, or account for a guest; **how a buyer gets back
to what they bought is the app's design** (a link the app emails with `~stencil/email`, an access code,
or a sign-in — see the rules). Only put buying behind login if the app builder explicitly wants buyers to
register — and then roles and gating for registered buyers are the app builder's own job.

**Disambiguate first — this is not the app's own subscription.** The other `payments` skill is for *the app
builder charging their app users* (a subscription plan for the app). This skill is for *the app's
users charging their customers*. Anchor example: a school-photography app where each photographer
sells photo packages to parents — the parent→photographer payment. If the app builder means "charge
my users to use the app", or selling app users one thing once (a course, a lifetime unlock), that's the
`payments` skill, not this one.

## The three-actor model — say this first, don't improvise

Payments confuse app builders because there are **three separate Stripe relationships**, not one. Whenever payments come up, explain this plainly up front. This wording is canned — say it, don't reword it into something vaguer:

- **You (the app builder)** verify your identity so the subscription money your app users pay you reaches your bank. Once **per app** — each app has its own Stripe account, so a new app repeats this quick step. You never log into that account: you see it in Stencil's **Payments panel**, not a Stripe dashboard.
- **Your app users subscribe** to your app — they just pay by card, nothing for them to set up.
- **A subscribed app user who wants to sell** completes **their own** Stripe onboarding so **their** sale money reaches **their** bank; **their** end users just pay by card.

Two independent money flows: app users → you (subscriptions), and end users → your selling app users (sales). The identity you verify and the identity a seller verifies are **different Stripe accounts** — yours and theirs. Neither comes with a Stripe login: you see yours in the Payments panel, a seller sees theirs in the seller dashboard inside the app.

**Always present setup as a live checklist**, and re-render it with current status every time payments come up so the app builder can see exactly where they are:

```
Payments setup
  ① Verify your identity so subscriptions reach you   — Step 1 of 3  ✅ done
  ② Your app users subscribe                           — Step 2 of 3  ⬜ waiting on app users
  ③ Sellers onboard to get paid (end users just pay)   — Step 3 of 3  ⬜ not started
```

Derive each mark from live state, never guess: steps ① and ② from `getPaymentStatus` (`connect` / `tiers`); step ③ is each seller's own onboarding, surfaced by `getSellerStatus` and completed inside the app. **This skill owns step ③** — steps ① and ② live in the `payments` skill.

## The first selling request on an app — offer a walkthrough

Selling is the most involved feature an app builder can add, and builds go better when they hold the whole picture first. The **first** time they ask for it on an app that has no selling yet — nothing in the app imports `~stencil/payments/selling` — offer the choice, in one short message, before writing any code. Roughly:

> Payments is the most involved thing you can add to an app — there are several moving parts (who verifies their identity with Stripe, who gets paid, what your app users pay you vs. what their customers pay them, how buyers get back to what they bought). Builds go much better when you know how it fits together. Want a two-minute walkthrough first, or should I go ahead and build it now?

Then **wait for the answer** — like the "anything that spends money needs a yes first" rule, this is a conversation turn: no code until they choose. First request only — never re-run the offer on a later turn about a plan change, a bug, or a seller who is stuck. That is a fix, not an introduction.

**If they want the walkthrough**, keep it a short spoken explanation — plain words, no code, no fee numbers, not a wall of text. Cover the pieces that apply to what they asked:

- The three-actor model above — the canned wording, as written.
- Sellers do their own Stripe onboarding: real KYC and a real bank account, and it takes a minute or two to flip ready after they finish.
- Buyers pay as guests by default — their email is their identity, and the app decides how they get back to what they bought (a link the app emails, an access code, a sign-in). Or the builder can require buyers to register, and then roles and gating are theirs to build.
- Sellers see their money **only** in the hosted seller dashboard inside the app, never in a Stripe login of their own; refunds happen there too. Stencil sends the receipt, Stripe does not — and it goes out as the seller's business name from their Stripe KYC (their personal name if there is none), shown as `<seller> via <app sender name>`, as do the seller's add-a-card reminder, failed-payment and account notices. Nothing for the app to build.
- What the builder does themselves (set up the app's payout account from More → Settings → Payments — there is no Stripe login for it, the Payments panel is where they see it) and what each seller does (their own KYC).

End with "ready to build?" and build on yes.

**If they say build now**, build — the "After building" message below already carries the facts they most need.

## The SDK in `~stencil/payments/selling`

No Stripe objects or card data ever touch the app, and the only Stripe ids it sees are the ones listed below. Import from `~stencil/payments/selling`.
The catalog (both kinds of product):

| Function | What it does |
|---|---|
| `createProduct(request, context, { name, description?, kind, amountCents, interval?, position? })` | The signed-in seller adds a product. `kind` is `"one_time"` or `"recurring"`; `interval` (`"month"` \| `"quarter"` \| `"half_year"` \| `"year"`; a quarter is every 3 months, a half year every 6) is required for recurring and not allowed for one-time. Needs `getSellerStatus()` `active`. Returns `{ ok: true, product }` or `{ ok: false, code, error }`. |
| `updateProduct(request, context, { productId, name?, description?, amountCents?, position? })` | Edits one of the seller's own products. `kind` and `interval` never change. Same result shape. |
| `archiveProduct(request, context, { productId })` | Retires a product: no new buyers, everyone who bought or subscribes keeps access. Products are never deleted. |
| `listProducts(request, context, { sellerUserId?, includeArchived? })` | A seller's products in `position` order. Pass `sellerUserId` on a public storefront; omit it for the signed-in seller's own. |
| `getProduct(context, { productId })` | One product (archived ones too — check `active`), or `null`. No sign-in needed, so a public buy page can render it. |
| `buyProduct(request, context, { productId, buyerEmail?, paymentMethods?, extraLines?, savePaymentMethod?, successUrl?, cancelUrl? })` | "Buy" a one-time product — throws a redirect to Stripe Checkout at the price, seller and name on the row. Same guest rules, `paymentMethods`, `extraLines`, `savePaymentMethod` and `?checkout_error` redirects as `sellerCheckout`, plus `product_unavailable` (missing, archived, or recurring). |

Sellers, one-time checkout and purchases:

| Function | What it does |
|---|---|
| `onboardSeller(request, context, opts?)` | "Start accepting payments" — throws a redirect to Stripe-hosted onboarding/KYC. Also the "fix it" entry when a seller is `restricted`. First-time onboarding needs `opts.country` (see the country rule). |
| `getSellerStatus(request, context)` | `{ status: none \| onboarding \| active \| restricted, stripeAccountId, currentlyDue, taxReady, … }`. The *current user's* own status — gates the seller's tools. `taxReady` is informational (sales tax set up on their account) and never a gate. Never redirects. `stripeAccountId` is that seller's own Stripe account id (`acct_…`), `null` while `status` is `none`; show it only to that seller, and only when they need it for something they do with Stripe themselves, such as asking Stripe to copy saved cards into this account. |
| `getSellerReadiness(context, { sellerUserId })` | Can *this* seller take a payment right now? → `{ ready }`. Public — never authenticates or redirects; for the loaders of buy pages, where the viewer is a buyer. Fails closed. |
| `sellerCheckout(request, context, opts)` | "Buy" for an app that owns its catalog — the buyer pays a seller for the app's own `reference`; no account needed. `amountCents` and `sellerUserId` come from the stored item the action loads by `reference` — never from the request. Signed in they're identified by their user id; signed out they check out as a guest and **`buyerEmail` is required** (collect it on the buy page; missing → back to `cancelUrl` with `?checkout_error=buyer_required`). Throws a redirect to Stripe Checkout. Enforces $5 USD minimum server-side. `paymentMethods?: ("card" \| "us_bank_account")[]` — card only when omitted; `extraLines?: { label, amountCents }[]` — up to three lines shown under the item and added to the total, from the seller's stored settings, never from the request (see "Bank payments and extra lines"). `savePaymentMethod?: { futureCharges }` — keep the method for later charges, with the buyer's consent on Stripe's page (see "Charging a saved payment method later"). When the checkout can't start (seller not ready, below minimum, …) it redirects back to `cancelUrl` with `?checkout_error=<code>` instead of throwing. |
| `chargeSavedMethod(request, context, { sellerUserId, buyer: { customerId }, amountCents, reference, description? })` | Charge a buyer's payment method already saved on the seller's account, with nobody on a checkout page — the next installment, a retainer on autopay. Resolves to `{ status: "paid" \| "processing" \| "failed", orderId, reason? }` and never redirects; a refused charge throws an Error whose message starts with the code. `sellerUserId`, `amountCents` and `customerId` come from stored state, never a form. See "Charging a saved payment method later". |
| `updatePaymentMethodLink(request, context, { sellerUserId, buyer: { customerId }, returnUrl })` | → `{ url }` of a Stripe-hosted page where a saved buyer enters a new card, which replaces the one later charges use; redirect the buyer to it after a `failed` charge or when they ask to change their card. They come back to `returnUrl`. |
| `removeSavedMethod(request, context, { sellerUserId, buyer: { customerId } })` | Forget a buyer's saved method — their "stop automatic payments". A later `chargeSavedMethod` is refused with `no_payment_method`; past purchases are untouched. Throws `subscription_active: …` while a seller subscription still renews on it. |
| `guestBuyerRef(email)` | The buyer ref a guest is stored under (`email:<normalized email>`). Only needed when you store buyer refs yourself — `hasPurchased`/`getPurchases` build it from `buyerEmail`. |
| `hasPurchased(request, context, { productId \| reference, buyerEmail? })` | One-line entitlement check → `boolean`. `productId` for a catalog product, `reference` for the app's own item. Resolves the buyer as an explicit `buyerRef` alone, else guest `buyerEmail` and the signed-in session together (true if either owns it); returns `false` for a visitor with none — it never redirects to login. |
| `getPurchases(request, context, { buyerEmail? })` | The buyer's paid and still-processing purchases → `Purchase[]`, same buyer resolution — everything a guest bought under their email. Each carries `status`: `paid`, `processing` (a bank payment still clearing) or `failed`, and `buyer.customerId` when the checkout saved the buyer's method (null otherwise). |
| `listSellerSales(request, context, { sellerUserId, cursor?, limit?, includeCard? })` | Everything one seller has been paid, newest first → `{ sales, nextCursor }`. Each sale carries the app's own `reference`, `amountCents` and the real money as Stripe charged it, never an estimate: `stripeFeeCents` (Stripe's processing fee alone; null until the charge settles), `feeCents` (that plus any Stencil commission) and `netCents` (what the seller keeps). Also the order's `status` as stored (`paid`, `refunded`, `dispute_lost`, …), `paymentIntentId` / `chargeId` / `refundId` / `disputeId`, and `card` (brand and last four digits, or bank name and last four; null when unknown). `card` is read live from Stripe per row: pass `includeCard: false` for reports and exports, which skips that read and returns `card: null`. **Server-only** — gate the loader with `requireRole(..., "admin")`, or pass the signed-in seller's own id as `sellerUserId`, and never return it to another app user. See "Fees and net on each sale". |
| `sellerPanelLink(request, context, { panelPath? })` | Throws a redirect that logs the seller straight into their hosted dashboard (one click, no password). `panelPath` is a page inside the dashboard, e.g. `"/?tab=tax"` for a "Sales tax settings" link; never pass the app's own URL — the dashboard is on its own origin and the seller stays there; `returnUrl` is an `onboardSeller` concept only. |
| `listPanelViewers(request, context)` | The people the signed-in seller shares their money with → `PanelViewer[]` (`id`, `email`, `invitedAt`). See "Sharing with a bookkeeper". |
| `invitePanelViewer(request, context, { email })` | Emails that person a link to a view-only page of the seller's hosted dashboard (payouts, balance, transactions). → `{ ok: true, viewer }` or `{ ok: false, code, error }`. |
| `revokePanelViewer(request, context, { viewerId })` | Stops sharing with one viewer; their link and any open page stop working. |
| `disconnectSeller(request, context)` | Removes the seller's account and closes their Stripe account so they can start over (e.g. wrong onboarding country). Returns `{ removed, reason? }` — `removed: false` with a `reason` when they've already taken payments. |

A catalog sale is recorded under the product id, so `hasPurchased({ productId })` and each `Purchase`'s
`reference` carry it. On the "app owns its catalog" path, `reference` is **the app's own id** for the thing
being sold (a cart id, an invoice id, a listing id) — what it passes to `sellerCheckout` and later to
`hasPurchased`. Refunds, disputes, payouts and balance
are **not** in the SDK — sellers do those in the hosted dashboard
(`sellerPanelLink`), which is the **only** place a seller can issue a refund. Sellers have no Stripe
dashboard login of their own (the hosted panel is a magic-link view of their Connect account), so
never tell an app builder a refund can be done "in Stripe" — the hosted panel is the only path.

## Sharing with a bookkeeper

A seller's bookkeeper or accountant needs to see payouts, fees and transactions, and the seller has no
Stripe dashboard to add them to. The hosted dashboard has a view-only page for this. When an app
builder asks for "accountant access", "let my bookkeeper see my payouts" or "view-only access to
payments", build a **Share with your bookkeeper** block on the seller's page (`/app/sell`), shown
only when `getSellerStatus()` is `active`:

- **List** `listPanelViewers()` in the loader: each viewer's `email`, the date of `invitedAt`, and a
  **Remove** button that posts the viewer's `id` to `revokePanelViewer`.
- **Invite** with one email field posting to `invitePanelViewer`. On `ok: false`, show `error` next
  to the field; never build your own message from `code`. Up to 5 people per seller.
- **Resend** is the same call with the same email; the earlier link stops working.
- The viewer needs **no account in the app**. The email carries a link that signs them in for 30
  days of use; after that the seller invites them again. Say so under the form.
- A viewer sees payouts, balance and transactions with fees and net. They cannot refund, answer a
  dispute, or see bank details, account settings or tax documents. Do not promise more than that.
- A seller who connected their own Stripe account (`connectExistingStripeAccount`) gets
  `code: "account_connected"`: they add team members in their own Stripe dashboard instead.
- Do not build your own export, shared login or "accountant role" for this, and never share the
  seller's own `sellerPanelLink`.

## Fees and net on each sale

When the app builder asks for the card fee per sale, what each seller keeps, profit per order, or
Stripe's payment ids in the app's own reports or exports, build it from `listSellerSales` — never
answer that the fee is unavailable or that it can't be done, never estimate a fee with a percentage,
and never call Stripe or store Stripe ids at checkout.

- **`stripeFeeCents` is Stripe's processing fee alone; `feeCents` is that plus Stencil's commission;
  `netCents` is `amountCents` minus `feeCents`.** Stencil keeps no commission today, so on current
  sales the two fees are equal. Show `stripeFeeCents` as the card fee; label `feeCents` "Fees", not
  "Stripe fee": an older sale can include a small commission.
- **A fee Stripe has not reported yet has `stripeFeeCents` null**, with `netCents` equal to the
  amount, for a short while after the payment. Show that sale as "fee pending", never as free.
- **Rows match the app's own order by `reference`** — the id the app passed to `sellerCheckout`, or
  the product id on a catalog sale. Past sales are listed too; page with `nextCursor`.
- **`status` already covers refunds and lost disputes**, so the app needs no refund record of its
  own for a report. Pass `includeCard: false` in a report or export.
- **One-time sales only.** A seller subscription's renewals are not listed and no read returns their
  fee: say so. The seller dashboard's Subscribers tab lists subscribers and their revenue, not fees.
- **Payouts, balance and tax forms stay in the seller dashboard** (`sellerPanelLink`: Payouts, and
  Account → Tax documents). No read returns them, so never rebuild or estimate them in the app.

## Bank payments and extra lines

`sellerCheckout` and `buyProduct` take two options beyond the price. Use them instead of hand-rolled
Stripe code whenever an app builder asks for "pay by bank transfer / ACH", a card fee, a surcharge or
a service charge on the checkout.

- **`paymentMethods`** — what Stripe's page offers the buyer. Omitted means card only; pass
  `["card", "us_bank_account"]` to add bank (ACH). The seller must have bank payments on: a seller
  onboarded in the US gets it requested when their account is created, and an existing US seller
  turns it on with the **Accept bank payments** button on the Account status card of their hosted
  seller dashboard (`sellerPanelLink`). Sellers outside the US cannot take bank payments. A checkout
  that asks for bank from a seller who doesn't have it bounces to `cancelUrl` with
  `?checkout_error=ach_unavailable`, so offer the bank option only where the seller has it on — a
  per-seller setting the app stores, which the seller flips after pressing the button — and render
  that code as a notice like the others.
- **`extraLines`** — up to three `{ label, amountCents }` lines shown under the item on Stripe's page
  and added to the order total (the $5 minimum applies to `amountCents` alone). They are prices, so the
  buyer-supplied-amount rule applies in full: compute them on the server from settings the seller
  stored (a fee percentage on the seller row), never from the form, a JSON body or the query string.
- **A bank payment is `processing` for about 4 business days**, then `paid`, or `failed` if the bank
  declines or returns it. `hasPurchased` stays `false` the whole time, so read the purchase's `status`
  from `getPurchases` and show "bank payment processing" on the success page and in "My purchases" —
  not "not purchased", and never a failure. Grant access only on `paid`; never on `processing`. A
  second checkout for a reference whose bank payment is still clearing bounces with
  `?checkout_error=payment_processing`.

One call with both, inside the buy action after the invoice and the seller's settings are loaded:

```ts
await sellerCheckout(request, context, {
  sellerUserId: invoice.sellerUserId, reference: invoice.id, amountCents: invoice.totalCents,
  paymentMethods: seller.bankPaymentsOn ? ["card", "us_bank_account"] : ["card"],
  extraLines: seller.cardFeeBps ? [{ label: "Card fee", amountCents: Math.round(invoice.totalCents * seller.cardFeeBps / 10000) }] : [],
  buyerEmail, successUrl: new URL(`/invoices/${invoice.id}/paid`, request.url).toString(),
});
```

## Charging a saved payment method later

`chargeSavedMethod` is for money a buyer already agreed to pay on a later date — the rest of an
installment plan, a monthly retainer on autopay — where the buyer's card or bank account is already
saved on the seller's payments account as a saved buyer. The app stores that buyer's `customerId`
on its own row (the invoice, the plan) and calls `chargeSavedMethod` from its own scheduled action
(the `recurring-actions` skill) when a payment falls due. Stencil keeps no schedule and runs no
retries: the dates, the claims and the retry policy are the app's.

- **One charge per due date, keyed on a stable `reference`** — the invoice id plus the installment
  number (`inv_123:2`), never a timestamp. The call is idempotent on that reference per seller: a
  reference already `paid` or `processing` reports that order and charges nothing, so a schedule that
  runs twice is safe. Still claim the installment row before calling (the recurring-actions
  "claim before any side effect" rule), and store the returned `orderId` and `status` on it.
- **`failed` — tell both sides, retry once after a few days, never the same day.** `reason` is the
  bank's code (`insufficient_funds`, `card_declined`, `authentication_required`, …). Email the buyer
  (`~stencil/email`) that the payment did not go through and show the seller the failed installment
  in their own view. Schedule exactly one retry three or so days later under the same `reference`;
  if that fails too, stop and leave it to the seller.
- **A thrown `platform_permission` or `account_unreachable` is not a decline.** The payment
  service refused the charge, not the client's card: `platform_permission` is a problem on Stencil's
  side, `account_unreachable` means Stripe no longer lets Stencil use the seller's payments account.
  Nothing was charged. Catch the throw, read the code from the start of the message, and record
  the installment as refused by the payment service. Tell the seller exactly that ("the payment
  service refused the charge, not your client's card"); never email the buyer that their card
  failed. Do not retry on the same day; a later retry under the same `reference` is safe.
- **Never grant access on `processing`.** A bank debit clears over a few business days and ends `paid`
  or `failed` on its own; `hasPurchased({ reference, buyerEmail })` turns true only on `paid`. Show
  "payment processing" until then, as with a bank checkout.
- **Every charge is an order like any other**: it appears in the seller's hosted dashboard with its
  fee, and the seller refunds it there. `getPurchases` lists it under the buyer's email.
- **Where `customerId` comes from.** Either the buyer was already saved on the seller's account
  (a migrated plan) or the first payment's checkout saved them: pass
  `savePaymentMethod: { futureCharges }` to `sellerCheckout` / `buyProduct`, and once the purchase
  is `paid`, read it back (`getPurchases` by `reference`) and store `buyer.customerId` on your
  row. Never build a card form or call Stripe to save one.
- **Ask for consent only when the app will actually charge later.** A plain one-off sale never
  passes `savePaymentMethod`. When it does, `futureCharges` is one plain sentence of what will be
  charged and when, computed from the stored plan — `"$1,200 on Nov 1 and $900 on Dec 5"`,
  `"$300 on the 1st of each month until cancelled"` — never a vague "future charges". Stripe shows
  it under its own reuse agreement on the checkout page.
- **Always offer the buyer a way to stop.** A "stop automatic payments" action on the buyer's own
  page calls `removeSavedMethod`; a seller ending a plan does the same from theirs. The seller's
  hosted dashboard also lists every saved buyer under "Saved methods" and can remove one.
- **Replace a declined method through `updatePaymentMethodLink`.** After a `failed` charge, or
  when the buyer asks to change their card, redirect them to the `url` it returns; the new card
  becomes the one later charges use. Do not ask the buyer to pay the failed installment through a
  new checkout — retry `chargeSavedMethod` under the same `reference` once they are back.

### Pay on approval (marketplaces, jobs, escrow asks)

"Hold the buyer's money until they approve" has one supported shape, because Stencil never holds
money and an app cannot place a hold on a card: save the buyer's method at checkout
(`savePaymentMethod: { futureCharges: "$120 when you accept the item" }`), then call
`chargeSavedMethod` when the buyer approves.

- **Say the trade-off to the app builder before building:** the seller delivers before any money is
  taken, and the charge can still be declined at approval (the `failed` handling above applies).
- **The approval is a claim.** Claim the approval row with one conditional write first, and charge
  only on a returned row, so two submits never charge twice.
- **A missed deadline needs no refund** (a seller who never ships): nothing was charged, so do not
  charge, and call `removeSavedMethod`. Money already taken is refunded only in the seller
  dashboard (`sellerPanelLink`); app code cannot refund.
- **Never hand-build an escrow, a wallet or a payout system, and never offer interest on held money.**

```ts
// app/routes/plans.$id.pay.tsx — the first installment saves the method, with consent
export async function action({ request, context, params }: Route.ActionArgs) {
  const plan = await loadPlan(params.id); // seller, amounts and dates from stored state
  await sellerCheckout(request, context, {
    sellerUserId: plan.sellerUserId,
    amountCents: plan.installments[0].amountCents,
    reference: `${plan.invoiceId}:1`,
    buyerEmail: String((await request.formData()).get("email")),
    savePaymentMethod: { futureCharges: describeRemaining(plan) }, // "$900 on Dec 5 and $900 on Jan 5"
  });
}

// app/routes/plans.$id.success.tsx — store the saved buyer once the first payment is in
const purchase = (await getPurchases(request, context, { buyerEmail })).find(
  (p) => p.reference === `${plan.invoiceId}:1` && p.status === "paid",
);
if (purchase?.buyer.customerId) await savePlanBuyer(plan.id, purchase.buyer.customerId);

// app/routes/api.internal.scheduled.tsx — the "charge due installments" handler
const due = await claimDueInstallments(); // your own conditional write, see recurring-actions
for (const inst of due) {
  try {
    const result = await chargeSavedMethod(request, context, {
      sellerUserId: inst.sellerUserId,
      buyer: { customerId: inst.buyerCustomerId },
      amountCents: inst.amountCents,
      reference: `${inst.invoiceId}:${inst.number}`,
      description: `${inst.planTitle} — installment ${inst.number}`,
    });
    await recordInstallmentResult(inst.id, result); // status, orderId, reason
  } catch (err) {
    // "platform_permission: …" or "account_unreachable: …": the payment service refused, not the card.
    const code = err instanceof Error ? err.message.split(":")[0] : "charge_failed";
    await recordInstallmentRefused(inst.id, code); // seller is told; the buyer is not emailed
  }
}
```

## The rules that matter

- **The app builder earns nothing from sellers' sales.** Sale money goes to the seller. The app
  builder's only revenue is the app's subscription (the `payments` skill). There is no revenue-share
  or commission mechanism for the app builder — if they ask to take a cut of their app users' sales,
  say plainly that it isn't supported and steer them to subscription pricing as the way to
  monetize. Never claim or imply the app builder earns from sales, and never promise a cut as a
  future feature. A seller running a referral or affiliate program for their own end users: load
  `app-referrals` — tracking and discounts work, paying a share out does not.
- **Never volunteer fee details.** Don't bring up Stencil's fees or commission in conversation.
  If the app builder asks directly what Stencil charges, point them to Stencil's pricing page rather
  than quoting numbers.
- **Eligibility: only an app user with an active plan can become a seller.** Selling requires the
  app to have a subscription plan (set up with the `payments` skill) and the seller to be on it —
  paid, **or granted at no charge** by the app builder with **Give free access** on
  More → Users, which writes the same `subscription` row every gate honours.
  So chosen people can sell without paying: send the app builder to Give free access for that,
  never to a paid plan first and never to a hand-written row. `onboardSeller` and
  `connectExistingStripeAccount` enforce the plan check and redirect to
  `/upgrade?reason=seller-needs-plan` if the app user has no active plan. The platform shows the
  reason itself: `StencilRoot` renders a "Selling needs an active plan" notice on any page opened
  with that query, so the app user is never dropped on a pricing page with no explanation. Keep
  the query string when an `/upgrade` route of your own redirects somewhere else, or the notice
  is lost. A one-time purchase is not a plan and does not pass this check. If the app has no plan
  yet, set one up first (the `payments` skill).
- **Onboarding gate: no selling UI until `active`.** Always call `getSellerStatus` first and show the
  seller tools (a buy button configured by that seller, "manage sales", etc.) only when
  `status === "active"`. For `none` show "Start accepting payments" → `onboardSeller`; for
  `onboarding`/`restricted` show a "finish setup" nudge → `onboardSeller` again (it resumes and, when
  restricted, re-collects what's missing). A seller returns from Stripe to `returnUrl` (default
  `/app/sell`) possibly still pending: `chargesEnabled` takes **~1–2 minutes** to flip after KYC, so
  `status` stays `onboarding` for a bit even when they've finished. On the setup page, treat
  `onboarding` as *verification in progress*, not failure — **always set the expectation** ("Stripe is
  verifying your details — usually a minute or two; this page updates when it's done") and re-check
  status without the seller re-doing KYC, via light polling and/or a "Check again" affordance. Never
  bounce a returning seller straight back into `onboardSeller` as if they hadn't started.
- **Buyer-facing gate: check the seller, not the viewer.** `getSellerStatus` reads the *current
  user*, so it cannot gate a page where a buyer views someone else's item. In the loader of every
  buy surface, call `getSellerReadiness({ sellerUserId })` and, while `ready` is `false`, replace
  the buy button with a plain "not accepting payments yet" notice — a shared buy link often gets
  opened before the seller finishes Stripe onboarding, and that visit must degrade gracefully,
  never crash. Also read `?checkout_error` in the same loader and render it as a notice:
  `buyProduct` and `sellerCheckout` redirect back to `cancelUrl` with that code whenever a checkout
  can't start.
  Never let a failed checkout fall through to an error boundary.
- **The buy button shows it is working the moment it is clicked.** Starting a checkout and
  redirecting to Stripe takes a moment, and a plain submit button looks dead for that long. In every
  form that posts to `buyProduct` or `sellerCheckout`, read `useNavigation().state === "submitting"`
  and, while it is true, disable the button and swap its label for "Opening checkout…". Take the
  pending state from the navigation, not local state, so a refused checkout settles back to idle.
- **Default to guest checkout — never require (or create) a buyer account.** Buy pages work logged
  out and collect the buyer's email (required for a guest — it is their identity and enables the
  repeat-purchase check). Ask the app builder only if they *explicitly* want buyers to register, and state
  the cost plainly: registered-buyer roles and the routes gated on them are then theirs to design and
  build. Never create an app account on the buyer's behalf at checkout — the guest flow exists
  precisely so no account is needed.
- **The buyer's way back is the app's design — Stencil stores no link or token for guests.** The
  receipt Stencil sends carries the amount and Stripe's receipt, nothing more. Right after payment the
  success URL you passed carries what your landing page needs (`?ref=` + `?buyer=` in the scaffold).
  For anything the buyer must reach *later* (digital downloads, a gallery, a booking), build the way
  back in the app and offer the pattern to the builder: **(a) your own link** — on the confirmed success
  page mint a random token with `crypto.getRandomValues` (12+ characters, never `Math.random()`), store it on your order row with the buyer's email, and email
  `…/purchases/<token>` with `createEmail` from `~stencil/email`; that route looks the token up, then
  gates with `hasPurchased({ productId, buyerEmail })` (or `reference`) so a refund still revokes; **(b) an access code**
  the buyer already holds (a gallery code, a booking number) plus their email — set and checked with
  `~stencil/access-codes` (the `access-codes` skill), never stored as typed; **(c) a sign-in** when
  the builder wants registered buyers. Never deliver goods from an email read straight off an
  untrusted query string — that is what your token, code, or sign-in is for.
- **Gate buyer access with `hasPurchased`.** Put the check in the loader of any route that delivers
  what was bought, passing the guest's `buyerEmail` once your own token/code/sign-in has proven it.
  When it returns `false`, send the viewer to the buy page with a short notice. It reads live from paid orders, so a refunded or disputed-lost purchase flips to
  `false` automatically — you never write revocation logic.
- **Right after checkout, "confirming" — not "not purchased".** Payment confirmation is
  webhook-driven and can lag a few seconds, so the success page must render a light "confirming your
  payment" state that re-checks (see the purchase-success scaffold), never a hard failure the moment
  the buyer lands. Poll `hasPurchased` with the same `buyerEmail` you passed to `buyProduct` or `sellerCheckout`, and
  stop after about 60 seconds with "Payment received. Your confirmation is on its way by email"
  instead of spinning forever.
- **Collect the seller's country before first onboarding.** A seller's Stripe account is created in
  a country that is **fixed forever** — Stripe can never change it later. So the very first time a
  seller onboards, your UI must ask which country their business is in and pass it as
  `onboardSeller(request, context, { country })` (ISO 3166-1 alpha-2, e.g. `"GB"`). Put a country
  select on the `/app/sell` setup page, shown only when `status === "none"`. Tell them plainly it
  can't be changed and that they'll be paid in USD converted to their local currency. An unsupported
  country throws — catch it and let them pick another (don't leave them on a crashed page). Once the
  account exists, `country` is ignored, so resuming or fixing onboarding needs nothing extra.
- **A buyer-supplied amount is never charged.** `buyProduct` and `subscribeToProduct` read the price from
  the product row themselves, so their form carries only the `productId` (and a guest's email). On the
  "app owns its catalog" path, `sellerCheckout` charges exactly the `amountCents` the
  action passes and checks it against nothing but the $5 floor, so the action must derive the amount
  (and `sellerUserId`) from server-side state — re-read the item by `reference` inside the action
  and pass its stored price. Never put the price, the seller id, or a discount in a hidden form
  field, and never read them from form data, a JSON body, or the query string: a shopper can edit
  anything their browser sends, pay $5 for a $500 order, and the order is still recorded as paid.
  The same holds for totals built from several items or a discount — compute them on the server from
  stored prices and a server-validated code. Take the `reference` from the route param, then load.
- **What the app confirms, it confirms once.** `buyProduct` refuses a repeat purchase of one product by
  one buyer, but on the "app owns its catalog" path the cart or invoice the app turns into an order,
  the coupon it counts, the slot it books, the balance it spends, the approval that releases a payout
  and the free-use allowance it counts before a paid call are the app's to make happen once —
  however many requests race for them: a success page loaded twice, a retried redirect, two buyers on
  one slot, two submits of one approval. Never read the row, check it in code, act, then write the new state; both requests pass.
  Claim first with one conditional write (`db.from("checkouts").claim(id, { status: "used" }, { where:
  { status: "pending" } })` on the data SDK; `UPDATE … WHERE … RETURNING` or an insert with
  `onConflictDoNothing().returning()` on Drizzle), act only on a returned row, copy the order's total
  from the stored checkout or `getPurchases` rather than re-pricing it, and count a coupon under the
  same condition it was checked with. The `data-sdk` skill's "Claim before a side effect" has the shapes.
- **$5 USD minimum, USD only.** Amounts are in **cents** (`amountCents: 2500` = $25); `createProduct`
  refuses anything under 500 (`below_minimum`), and so does checkout. Charges are USD in every country — card everywhere,
  bank (ACH) only for US sellers (see "Bank payments and extra lines") — and a seller outside the US is still paid in
  their local currency (Stripe converts at payout).
- **Log access as dispute evidence.** When a buyer opens or downloads what they bought, record a
  timestamped access row (a small entity: buyer, `reference`, `accessedAt`). If the buyer later
  disputes the charge, that access log is the seller's evidence — surface it in the dashboard flow.
  Add this whenever the thing sold is digital/deliverable.

## Seller subscriptions — recurring products a seller sells

A seller can sell their own recurring products (a monthly coaching membership, a quarterly box, a yearly class pass). They
are ordinary catalog rows with `kind: "recurring"`, made with `createProduct` and listed with
`listProducts` like any other product. The seller onboarding, eligibility, country and live-money rules
above all still apply. These functions, also in `~stencil/payments/selling`:

| Function | What it does |
|---|---|
| `subscribeToProduct(request, context, { productId, successUrl?, cancelUrl? })` | "Subscribe" — throws a redirect to Stripe Checkout for the signed-in buyer, priced from the stored product. On a rejection it redirects to `cancelUrl` with `?checkout_error=<code>`. |
| `hasActiveSubscription(request, context, { productId })` | The gate → `boolean`. One read of the app's own database; `false` when signed out; never redirects. |
| `getSubscription(request, context, { productId })` / `getSubscriptions(request, context)` | The signed-in buyer's subscription(s): `productId`, `sellerUserId`, `status`, `currentPeriodEnd`, `cancelAt`, `active`. For status lines and "anything from this seller" gates. |
| `manageSellerSubscription(request, context, { productId, returnUrl? })` | The "Manage billing" button — throws a redirect to Stripe's billing portal. |
| `cancelSubscriber(request, context, { subscriberUserId, mode, sellerUserId? })` | The seller's side: stop billing one of their subscribers → `{ canceled: true, alreadyEnded }`, or `{ canceled: false, reason: "not_subscribed" }` for someone who never subscribed. `mode` is `"period_end"` or `"immediate"`. **Server-only.** See "Removing a paying subscriber". |

The rules:

- **Subscribing needs a signed-in buyer.** Guest checkout is one-time only. On a pricing page, show
  signed-out visitors "Sign in to subscribe" (a link to `/login?returnTo=…`); `subscribeToProduct`
  without a session bounces back with `?checkout_error=buyer_required`. If the app builder wants guests
  to subscribe, say plainly that it isn't supported and offer a one-time product instead.
- **Gate on the server with `hasActiveSubscription`, never on the success redirect.** Put it in the loader
  of every subscriber-only route. Access comes from Stripe's confirmation, which can land a few seconds
  after the buyer returns, so the page the buyer lands on shows a "confirming your subscription" state
  that re-checks — never "not subscribed" the moment they arrive. To gate on *any* product from one seller,
  use `getSubscriptions()` and match `sellerUserId` with `active`.
- **Access follows Stripe on its own.** A past-due subscriber keeps access while Stripe retries the card.
  A cancelled one keeps it until the paid period ends when the cancel was at period end (the portal, or
  `cancelSubscriber` with `"period_end"`), and loses it at once when it was `"immediate"`. Never write
  expiry or revocation logic, and never write to the `seller_subscription` table — it is
  platform-owned like `subscription`.
- **"Manage billing" is the subscriber's only billing UI.** Updating the card, invoices and cancelling
  their own subscription all happen in Stripe's portal through `manageSellerSubscription`. The portal has
  no plan switcher, so never promise one. Never build the subscriber their own cancel button, or an
  invoice list. Show the subscriber their product, its status and the next date
  (`currentPeriodEnd`, or "ends on" `cancelAt`) next to that button.
- **Removing a paying subscriber stops their billing in the same action.** Whenever the app takes
  someone out of what they pay a seller for (a seller removes a member, bans them, deletes the
  community or class, or the person leaves through the app's own "leave" button), that action calls
  `cancelSubscriber` before it changes the app's own record. Taking the access away without it leaves
  Stripe charging the person every month. Two rules go with it:
  - **Pick the mode on purpose.** `"period_end"` stops the renewal and keeps their access until the
    date they already paid for: the default for an ordinary removal or a "leave". `"immediate"` ends
    billing and access now and **does not refund**: use it when the person must be out today (a ban),
    and tell the seller that any money back is a refund they issue in the seller dashboard.
  - **Gate on the app's own record as well as the subscription.** After a `"period_end"` cancel
    `hasActiveSubscription` stays true until the paid date, so a removed person's access is decided by
    the app's membership row *and* the subscription, never by the subscription alone.

  The seller is the signed-in app user by default, which is right for a seller's own "remove" button.
  When someone else acts for the seller (the app's admin, an automation, the subscriber's own
  "leave"), pass `sellerUserId` read from the stored membership or product row, never from the form.
  It reaches only that seller's own subscribers and never an app plan.

  **With `sellerUserId` passed, the action itself decides who may cancel.** `cancelSubscriber` then
  checks nothing about the signed-in app user, so before the call the action confirms one of two
  things: the app's own admin or owner check passes for the signed-in app user (`requireRole`, or
  the stored row shows they own that community or class), or `subscriberUserId` is the signed-in
  app user's own id, taken from the session (the "leave" case). `subscriberUserId` never goes from
  the form to the call unchecked: when it names someone else, load that person's membership row
  and confirm the signed-in app user may remove them. Without this check any signed-in app user
  could cancel someone else's subscription.

  A seller can also cancel a subscriber by hand in the seller dashboard's Subscribers tab; the app
  still needs the call, so its own remove action never leaves billing running.
- **One subscription per buyer per seller.** A second `subscribeToProduct` to the same seller bounces with
  `?checkout_error=already_subscribed`. Show a current subscriber "Manage billing" instead of Subscribe
  buttons. To change product the buyer cancels in the portal, then subscribes to the other one; a
  subscription already set to end (`cancelAt`) does not block that. Different sellers are independent.
- **Handle every redirect code.** Render `?checkout_error` (`buyer_required`, `already_subscribed`,
  `seller_not_ready`, `product_unavailable`) on the pricing page and `?billing_error` (`not_subscribed`) on
  the page with the Manage billing button, as notices — never an error boundary.
- **Prices come from the stored product.** The buyer's form carries only the `productId`;
  `subscribeToProduct` prices the subscription from the product row, so a storefront is safe to render
  from `listProducts`.
- **Sellers see subscribers and MRR in the hosted dashboard.** The Subscribers tab of the seller dashboard
  (`sellerPanelLink`) lists each subscriber with the product they subscribe to, their status, monthly
  recurring revenue, and recent cancellations, and lets the seller cancel a subscriber (now or at
  period end) or refund a payment. Don't rebuild a subscriber list, a revenue report or a refund flow
  in the app. Products are managed only in the app's own catalog page, never in the dashboard.

## Managing the catalog — the seller's products page

- **Only for an `active` seller.** Show the create/edit/archive screen only when `getSellerStatus()` is
  `active`; otherwise send the seller to finish onboarding. Show a rejected write's `error` next to the
  form (`below_minimum`, `name_taken`, `interval_invalid`, `seller_not_ready`, …).
- **One page for both kinds.** A kind picker (one-time / every month / every 3 months / every 6 months /
  every year) on the create form; the list shows each product's kind and price, with edit and archive.
  Show `quarter` as "every 3 months" and `half_year` as "every 6 months", never the stored value. Archive, never delete — past buyers and
  current subscribers keep their access.
- **What a seller can change.** Name, description, price and order. A new price applies to **new buyers
  only**; current subscribers keep the price they signed up at. Kind and interval never change — to go
  from one interval to another, archive the product and create a new one. Say both in the editor. Product names
  are unique among a seller's active products (`name_taken`). Everything is USD, $5 minimum.
- **Never write to `seller_products` with raw SQL.** Go through `createProduct` / `updateProduct` /
  `archiveProduct`, which check the seller, the kind and the price.

## Preflight: verify before build

**Mandatory.** Run these checks **in order** before you write a single page, and resolve each one
*interactively with the app builder* rather than building on top of a failure. This flow exists
because a sell page built on an app that can't actually sell yet is **dead on arrival** — the app
builder finds out by clicking a broken production app. Call `getPaymentStatus` once up front: it
returns `connect` (the workspace Stripe Connect account) and `tiers` (the app's subscription plans),
which cover checks (b)–(d).

(b) and (d) below name `getPayoutSetupLink`/`setupPayments` — composer tools, not something a build
turn writing code can call. If you're the conversation, use them directly. If you're mid-build and
either check fails, don't reach for a tool you don't have: stop, report plainly what's missing, and
say it's handled from the app builder's payments settings panel.

- **(a) App deployed at least once.** Selling calls the app's live API, so the app has to exist in
  production. A brand-new app you're building for the first time is fine — it deploys as part of this
  build. But if you're *adding* selling to an app that already exists yet has never been deployed,
  stop and flag it: get it deployed once, then come back and add selling.
- **(b) Stripe account onboarded.** Read `connect.chargesEnabled` from `getPaymentStatus` and branch
  on the **boolean**: `chargesEnabled === true` means the account can charge — proceed. Treat
  anything else (e.g. `not_started`, `none`) as **not onboarded**. Do NOT branch on exact
  status-string vocabularies — those strings change and must never be hard-coded here; the boolean is
  the contract. If the account is not onboarded: **STOP.** In conversation, hand the app builder the
  link from `getPayoutSetupLink`; mid-build, just report that Stripe isn't connected yet — either way,
  explain that any pages built before Stripe onboarding completes are dead on arrival (the seller
  can't be paid and buyers can't check out). Offer to continue the build once onboarding is done.
- **(c) Subscription plan exists *and is live in the deployed bundle*.** Sellers must be paying
  subscribers, so the app needs a subscription plan. Check `tiers` from `getPaymentStatus`. If there
  is no plan, offer to create one in-chat with `setSubscriptionPrice` — a plan can be monthly-only,
  yearly-only, or both, so ask the app builder which price(s) they want (at least one is required)
  before creating it; see the `payments` skill for the details. Don't build selling until a plan
  exists. **Crucially, a plan that exists is not necessarily live:** the deployed app reads its plans
  from a snapshot baked in at build time, so a plan created or changed after the last build is not
  yet in the live bundle and `/upgrade` silently bounces. If `setSubscriptionPrice` returns
  `rebuildRequired: true` (or you just created the plan on a new app), the app must be
  rebuilt/published once before anyone — including a would-be seller — can subscribe. The mandatory
  new-app order is `build → configure the plans → rebuild`. Don't claim subscribe works, and don't
  hand off a sell flow, until that rebuild has happened. (See the `payments` skill for the full
  explanation.)
- **(d) Payments enabled on the app.** Check with `getPaymentStatus`. In conversation, call
  `setupPayments` to flip it on if it isn't; mid-build, just report that payments aren't enabled yet
  and stop — don't try to switch it on yourself.
- **(e) The `/upgrade` route exists.** `onboardSeller` and `requireSubscription` hard-redirect
  unsubscribed app users to `/upgrade`; if `app/routes.ts` has no `upgrade` route, every one of those
  redirects is a 404 and nobody can ever subscribe or become a seller. Check `app/routes.ts`; if
  the route is missing, add it (create it from the `subscriptions/upgrade.tsx` scaffold, or register
  a route that redirects to the app's own pricing page). Re-check it before finishing any selling
  or payments turn.

Only after (a)–(e) all pass do you build pages.

## Building a sell flow — the usual shape

For a new app, or one with no item table of its own, every step reads the catalog:

1. **Make sure a subscription plan exists** (the `payments` skill) — sellers must be paying subscribers.
2. **Seller setup page** (`/app/sell`): `getSellerStatus` in the loader; render the onboarding gate and,
   when `active`, a "manage sales" button (`sellerPanelLink`) and a link to the seller's products page.
   The `sellerPanelLink` button ships with this page from day one — the hosted panel is the only place
   a seller ever sees their money, and their own Stripe login (if they have one) will never show it.
   Say that to the app builder when you hand the page over.
3. **Seller products page** (`/app/sell/products`, linked from the setup page once `active`):
   `listProducts({ includeArchived: true })` and create / edit / archive forms for both kinds that surface
   each write's `error` (see "Managing the catalog").
4. **Storefront** for one seller (public, `/store/:sellerId`): `listProducts({ sellerUserId })`, gated on
   `getSellerReadiness`. One-time products link to the buy page; recurring products get a Subscribe form
   for a signed-in buyer, "Sign in to subscribe" otherwise, and "Manage billing" for a current
   subscriber. Render the `?checkout_error` notice.
5. **Buy page** (public, `/buy/:productId`): `getProduct` in the loader, `buyProduct` in the action with
   the route's `productId`, a `successUrl` carrying `?ref=` (and `?buyer=` for a guest), and the guest's
   `buyerEmail` from a required email field — the only field the form carries. Gate the button on
   `getSellerReadiness` and surface `?checkout_error` as a notice (the buyer-facing gate rule).
6. **Success + gated content**: on the success page verify with `hasPurchased({ productId, buyerEmail })`
   (rendering "confirming" while it is still false); on every route that delivers the purchase, gate
   with `hasPurchased` behind your own token / code / sign-in (the way-back rule above).
7. **Subscriber area**: gate in the loader (`hasActiveSubscription({ productId })` or `getSubscriptions`),
   a "confirming" state right after checkout, the product's status and next date, and a Manage billing
   button with the `?billing_error` notice.

A request like "my users sell coaching packages and a monthly membership" is one catalog: the packages
are one-time products and the membership is a recurring one, on the same products page and storefront.

**An app that owns its catalog** keeps its own item pages. Its buy action loads the item (or cart, or
invoice) by the app's own `reference` and calls `sellerCheckout` with the stored seller and price as
`sellerUserId` and `amountCents`; the success page and delivery routes gate with
`hasPurchased({ reference, buyerEmail })`. Steps 1–2 and the rules above are the same.

Start from the `selling/` scaffolds — `seller-setup.tsx`, `seller-products.tsx` (the catalog page),
`subscribe.tsx` (the storefront), `buy.tsx`, `purchase-success.tsx` and `subscriber-area.tsx` — adapted to
the app's design. Follow the JSDoc examples in `~stencil/payments/selling` for the exact call signatures.

## After building — tell the app builder how to test

Every selling build must **end with a message** that includes all of these:

- **Sellers see their money only in the hosted seller dashboard inside the app** (`sellerPanelLink`) — never in a Stripe login of their own. Refunds happen there too.
- **Stencil emails each seller's buyers for them.** The receipt, add-a-card reminder, failed-payment and account notices go out as the seller's business name from their Stripe KYC (their personal name if there is none), shown as `<seller> via <app sender name>`; the app builds none of these. An app that does send its own receipt for sellers' sales should have the app builder turn **Send payment receipts** off in More → Settings → Payments, or buyers get two.
- **Payments are LIVE — real money moves.** There is no test mode and no test card: every checkout is
  a real card charge, really billed to the buyer and really paid out to the seller's own Stripe
  account. To try it end to end, the app builder should make **one small real charge they can
  refund** — the $5 minimum is enough — and refund it afterwards from the seller's hosted dashboard
  (`sellerPanelLink`).
- **Sellers must complete real Stripe KYC before they can take a charge.** Onboarding asks for
  genuine identity details and a real bank account; placeholder data won't pass verification, and
  until it does the seller can't accept a single payment.
- **The end-to-end order flow to try**, in this order:
  1. Subscribe / upgrade on the app (sellers must be paying subscribers).
  2. Become a seller on `/app/sell` and complete the Stripe KYC onboarding.
  3. Add a one-time product on the seller's products page, then from a logged-out window (no second
     account needed — buyers are guests) buy it from the seller's storefront with a real email, land on the success page, then follow whatever way back the app built
     (its own emailed link, code, or sign-in) — this confirms the full buy → deliver flow.
- **For seller subscriptions, the order to try instead of step 3:** add a recurring product on the seller's
  products page, then sign in as a **different** app user (subscribing needs an account), subscribe on
  the seller's storefront, land in the subscriber area once "confirming" clears, and open **Manage billing** to see
  the portal. Cancel there afterwards and refund the charge from the seller dashboard, whose Subscribers
  tab shows the new subscriber with Refund and Cancel under Manage. If the app has a "remove" action,
  try it on a second test subscriber and check the Subscribers tab shows them ending.
- **Buy links go live only after step 2.** A buy link opened before its seller finishes Stripe
  onboarding shows buyers a "not accepting payments yet" notice — that's the built-in guard, not a
  bug. It starts selling the moment onboarding completes.

## Rules

- **Never create, edit, or reimplement anything under `~stencil/payments/`.** That module — including
  `~stencil/payments/selling` — is platform-owned and delivered automatically by build sync; it is not yours
  to write. If an import from `~stencil/payments/selling` fails, treat it as a **platform problem**: report
  it plainly in your closing note and stop. Do NOT fabricate a replacement module or invent endpoints
  to make it compile — a hand-written stand-in produces phantom endpoints and 500s in production.
- **Platform tables are read-only.** `subscription`, `user`, `session`, `account`, `verification`,
  and every `oauth_*` table mirror Stripe and the auth layer, and the platform rewrites them — never
  INSERT/UPDATE/DELETE them via `dbExecute` or any SQL. Reading them is fine. A hand-written row
  (e.g. a comped `subscription` marked active so `onboardSeller`'s gate passes) is a forgery the
  platform will overwrite.
- **Never disable or bypass a paywall as a workaround.** Free/beta/comp access for chosen app users
  is not something Stencil offers yet — say that plainly and point the builder to Stencil support.
  Do not invent a "beta mode" or switch the subscription gate off.
- **Never claim Stencil is working on or restoring something.** State what the platform does today;
  if you don't know, say you don't know.
- Do all money movement through the SDK functions — never call Stripe or the payments API directly.
- Never render selling UI (buy buttons, seller tools) before `getSellerStatus` returns `active`.
- Amounts are always in cents; enforce nothing client-side that the server already enforces — just
  surface the $5 minimum in the UI so buyers aren't surprised.
- Prices come from the product row (`buyProduct`, `subscribeToProduct`) or, on the "app owns its
  catalog" path, from the stored item the action re-reads for `sellerCheckout` — never from the
  request (the buyer-supplied-amount rule above).
- **Taking a card in person** (a point of sale, a Stripe card reader, tap to pay on a phone) is **not
  possible**. Say so plainly, never suggest a Stripe Terminal setup, and never hand-build a reader
  integration. The closest thing: a pay page that opens the normal online checkout on the buyer's own
  phone, for example from a link or QR code at the counter, using `sellerCheckout` with the amount
  read on the server. The sale shows in the seller dashboard like any online sale.
- **"Hold the money until the buyer approves" is save the method, then charge on approval** (see
  "Pay on approval"). Never an escrow built by hand.
- **Per-sale fees and net come from `listSellerSales`** (see "Fees and net on each sale"); a
  seller's payouts and tax forms are in their hosted dashboard.
- For the app builder's *own* subscription/monetisation, use the `payments` skill instead.
