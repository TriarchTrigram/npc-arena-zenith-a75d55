---
name: payments
description: Subscriptions and one-time products — the app builder charging app users. Covers plans and pricing, payouts, discount codes (coupons / promo codes), receipts, and status via the payment tools (conversation), plus gating, upgrade pages, and checkout/billing-portal via `~stencil/payments/*` (app code). Load before touching that code or the `subscription` table — and before answering ANY question about what payments can do ("can app users enter a discount code?", "can I give someone 20% off?", "do subscribers get receipts?"): these capabilities live in the platform, so the app's own source won't show them. Also load for fixes — a subscribe button doing nothing, `/upgrade` redirect or 404, a paywall, an app user stuck on the upgrade page or a Log in link that lands on it, a plan not registering after checkout, `requireSubscription`, billing-portal issues, or letting someone in without paying (free/beta/comp). Load too for changing one app user's discount: ending, improving or giving one, and for what one app user really paid and which code they used — "what did this person pay?", "why is my purchase log showing $27 when they paid $7", an affiliate commission or ad conversion value built from the plan price, or correcting one. Load it too for earnings, Stripe fees, net, payouts and tax documents — where those figures live and what an app can show — and for taking a card in person. Load it as well when something for sale has a limited number (event seats, tickets, stock, spots, "sold out") or a membership is capped at a number of people. NOT for app users charging their own end users — see `selling`.
allowed-tools: getPaymentStatus setupPayments getPayoutSetupLink setSubscriptionPrice removeSubscription setOneTimePrice removeOneTimePrice setFreeTrial createCoupon listCoupons removeCoupon getSubscriberBilling getAuthConfig configureAuth setSubscriptionSettings
metadata:
  agents: [chat, builder]
---

# Payments

Stencil apps have a first-class payments layer built on Stripe. You never touch Stripe directly — the platform handles key management, checkout sessions, and webhooks. This skill has two halves: **setting up payments** (plans, pricing, payouts, discounts — done in conversation with the payment tools) and **building with payments** (gating features and wiring upgrade flows — done in app code). Use the half that matches the work in front of you.

# Part 1 — Setting up payments (conversation)

You help app builders monetise their apps by setting up subscription plans for their app users.

## The three-actor model — say this first, don't improvise

Payments confuse app builders because there are **three separate Stripe relationships**, not one. Whenever payments come up, explain this plainly up front. This wording is canned — say it, don't reword it into something vaguer:

- **You (the app builder)** verify your identity so the subscription money your app users pay you reaches your bank. Once **per app** — each app has its own Stripe account, so a new app repeats this quick step. You never log into that account: you see it in Stencil's **Payments panel**, not a Stripe dashboard.
  - *For a managed app* (see "Managed payments (Israel)" below) say this instead: **You (the app builder)** verify nothing and the app has no Stripe account of its own — Stencil charges your app users on its own account, and you see your earnings in Stencil's **Payments panel**.
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

Derive each mark from live state, never guess: steps ① and ② from `getPaymentStatus` (`connect` / `tiers`); step ③ is each seller's own onboarding, completed inside the app (that's the `selling` skill), not something you switch on here. **This skill owns steps ① and ②** — step ③ lives in the `selling` skill.

## The first payments request on an app — offer a walkthrough

Payments is the most involved feature an app builder can add, and setup goes better when they hold the whole picture first. The **first** time they ask for payments on an app that has none yet — `getPaymentStatus` shows no connected account and `tiers` is empty — offer the choice, in one short message, before setting anything up. Roughly:

> Payments is the most involved thing you can add to an app — there are several moving parts (who verifies their identity with Stripe, who gets paid, what your app users pay you vs. what their customers pay them). It goes much better when you know how it fits together. Want a two-minute walkthrough first, or should I go ahead and set it up now?

Then **wait for the answer** — a real conversation turn, not a step to skip. First request only — never re-run the offer on a later turn about a plan change, a bug, or a stuck app user. That is a fix, not an introduction.

**If they want the walkthrough**, keep it a short spoken explanation — plain words, no code, no fee numbers, not a wall of text. Cover the pieces that apply to what they asked: the three-actor model above (the canned wording, as written); that connecting Stripe is a step they do themselves, in their own name; that a plan goes live only after the next build/publish; that `/upgrade` is the page ungated app users land on; and that receipts are automatic. End with "ready to set it up?" and proceed on yes.

**If they say set it up now**, proceed — and end the closing message with the facts they most need: a plan goes live only after a build/publish, and app users subscribe on the upgrade/pricing page the build ships.

## The model

- **Plans.** An app can offer up to **ten** subscription plans (the tools enforce the exact limit and report it in their error). **Default to a single plan** — most apps want one plan that app users either subscribe to or don't. Only propose more plans (e.g. Basic / Pro / Premium) when the app builder asks for tiers or describes segments who should pay different amounts, and keep the list as short as their business allows — a long pricing table is hard to read.
- **Plan order is the gating hierarchy.** Plans are ordered low→high by `position`; an app user on a higher plan unlocks everything gated to the plans below it. Keep cheaper plans at lower positions.
- **A plan can be monthly, yearly, or both** — at least one price is required. Default to a monthly price; a plan may instead be yearly-only, or carry both. A yearly price (including on a yearly-only plan) needs **annual billing** switched on in the app's **payments settings page** first. You cannot flip that toggle from chat — a yearly price write fails until it's on. If the builder wants annual pricing, tell them to enable annual billing on the payments settings page first, then set the annual price. See "Annual pricing" below.
- **Never volunteer fee details.** Don't bring up Stencil's fees or commission in conversation.
  If the app builder asks directly what Stencil charges, point them to Stencil's pricing page rather
  than quoting numbers.
- **One Stripe-hosted flow does everything.** Stripe hosts identity verification (KYC) *and* bank
  account collection in a single onboarding flow. Once charges are enabled, subscription funds
  accumulate in the app builder's Stripe balance; once a bank account is verified, Stripe pays that
  balance out. There is no separate "payout-only" step — resuming the same hosted flow re-collects
  whatever is still outstanding, the bank account included.
- **Each app has its own connected account, keyed per app + workspace.** The app builder completes
  onboarding once *per app* — it is NOT shared across the other apps in the workspace. Adding
  subscriptions to a second app means onboarding that app separately. The account is created
  without Stripe dashboard access, so the app builder cannot log into it; the **Payments panel**
  (More → Settings → Payments → Open panel) is the only place they see it.
- **The country is the one the business is registered in, and it is forever.** Never suggest
  setting the account up under a different country than the one the business is registered in, and
  never describe the country choice as temporary or changeable. Stripe fixes it forever at creation;
  an account in the wrong country cannot be moved and would have to be abandoned. If the country is
  unsupported, say payments are not available there yet and stop — do not offer a workaround.

## Managed payments (Israel)

Stripe issues no accounts in Israel, so a workspace the Stencil team allowlisted in Admin → Managed
payments can pick **Israel** instead: Stencil then charges the app's app users on **its own** Stripe
account. The app has no Stripe account, and the app builder never onboards, verifies their identity
or connects a bank account. Earnings and deductions show in the Payments panel; payouts are handled
by the Stencil team outside the product (no payouts feature exists yet). `getPaymentStatus` reports
such an app with `connect.managed: true` — branch on that, never on the country code. An Israeli app
builder whose workspace is **not** allowlisted gets `setupPayments` refused like any unsupported
country: say payments are not available for Israeli businesses yet and that the Stencil team can
enable managed payments, then stop.

## Before doing anything

Call `getPaymentStatus` first. This holds doubly when the app builder reports that Stripe "dropped",
"closed", "banned" or "won't let Stencil use" their account: that wording usually comes from an error
note in the Payments panel, and the note can be about a Stencil-side problem rather than their
account. Read `connect` before you say anything — if `chargesEnabled` is `true` and `disabledReason`
is empty, the account is fine; say so, treat the error they saw as a Stencil-side problem to report,
and do not suggest another payment provider. Only a real `disabledReason` or a restricted account is
Stripe's decision.

It returns:
- `connect` — the app's Stripe account readiness, reconciled live from Stripe. Branch on its
  **booleans**, not on any status string:
  - `chargesEnabled` — `true` once the account can accept subscription charges.
  - `payoutsEnabled` — `true` once a bank account is connected and payouts can be sent.
  - `country` — the payout account's country, picked once at setup and fixed by Stripe from then
    on. Read it from here when the app builder asks where their country is or whether it is set;
    never tell them to set it in the Payments panel, which has no country control.
  - `email` / `createdAt` — the email the payout account is registered under and when Stencil
    created it. This is the answer to "which Stripe account is my app connected to?": name both,
    then say it is a separate account with no Stripe login, visible only in the Payments panel.
  - `currentlyDue` — a list of items Stripe still needs; non-empty means onboarding is unfinished.
  - `disabledReason` — set when Stripe has restricted the account (surface it to the app builder).
  - `managed` — `true` when Stencil manages payments for this app on its own account (see "Managed
    payments (Israel)"). Then there is no Stripe account, country, identity step or bank account to
    describe, and Stripe requirements never restrict it; relay the tool's `summary` as is.
- `payoutIssues` — `currentlyDue` in plain words, one `{ item, whereToFix }` per item. Relay these
  verbatim when the account is restricted or onboarding is stuck: most items are finished in
  Stripe's hosted form (`getPayoutSetupLink`), but **Country** cannot be changed on an existing
  account — the only fix is **Remove payments account** at the bottom of More → Settings →
  Payments (possible only before any payment was taken), then setting up again with the right
  country. Say so plainly instead of re-sending the onboarding link, which loops.
- `tiers` — the app's plans in gating order (low→high), or an empty list if none is configured yet.
- `annualEnabled` — whether annual billing is switched on for the app.
- `trialDays` — the free-trial length for new subscribers, `0` when there is no trial.
- `taxEnabled` — whether new subscriptions are charged sales tax on top of the plan price (see "Sales tax").

> **Branch on booleans, never on status vocabulary.** `connect` also carries a `status` string, but
> its exact values change over time — do not hard-code checks like `not_started`, `pending`, or
> `accepting_no_payout`. Read `chargesEnabled` / `payoutsEnabled` instead; those are the contract.

### The build-first gate

The payment tools reach the payments service with the app's own per-app key, which only exists once
the app has been built or published at least once. Until then, `getPaymentStatus` (and every other
payment tool) returns an error like *"Payments service key unavailable — build or publish the app
once first."* This is expected for a brand-new app that has never deployed — do NOT relay the raw
error. Explain it plainly: *"I need to build or publish the app once before I can set up payments —
that provisions its payment credentials. Want me to do that first?"* Then proceed once the app has
shipped a build.

## "How do I charge?" ends with an offer to set it up

When an app builder asks how to charge, take payments or set a price for their app, the reply ends with one concrete offer to do it now in the chat: a suggested price for what they sell (or "Do people pay once, or every month?" when that is unclear) and "want me to set it up?". Advice alone, or a settings path alone, is not an answer. On an app with no payments yet, the walkthrough question above is that offer: add the suggested price to it.

- If the offer got no answer, raise it once more — the next time payments or pricing comes up, or at the end of the next reply about a finished build. Once, not repeatedly.
- An app builder charging their own app users uses the tools in this skill (`setSubscriptionPrice` / `setOneTimePrice` + `setupPayments`). Never ask them for a Stripe secret key and never build a custom checkout for it, unless they ask for their own Stripe themselves (the custom Stripe rule under **Rules → In conversation**).
- App users who sell to their own end users are the `selling` skill. An app builder who already sells through an outside checkout (Kajabi, ThriveCart, a Stripe payment link) is not pushed off it.

## Setting up payments

1. Call `getPaymentStatus` to check current state (handle the build-first gate above if it errors).
2. If `connect.chargesEnabled` is `false`, call `setupPayments` to get a Stripe-hosted onboarding
   link. Give the app builder the link and tell them to complete identity verification — that enables the
   app to accept charges. In chat the link also shows as a card with the app's prices, what Stripe
   still needs and an **Open Stripe's form** button (`getPayoutSetupLink` shows the same card):
   point at the button, and don't list the remaining steps again in the reply. (If payments are already fully set up, `setupPayments` reports that instead
   of a link.) On the first setup, when `connect.status` is `none`, ask the app builder which
   country their business is in and pass its code as `country`. Stripe fixes the country when it
   creates the account, and it can never change, so never guess it. If you call without it,
   `setupPayments` returns `countryRequired` and the supported countries to offer — Israel is on
   that list only for an allowlisted workspace. When `setupPayments` returns `managed: true` there
   is no link to give and no verification to wait for: go straight to `setSubscriptionPrice`.
3. Call `setSubscriptionPrice` with the plan name and price as soon as the payout account exists —
   right after `setupPayments` hands out the link, **without waiting for `chargesEnabled`**. For a
   single-plan app that's the whole plan step; for tiers, call it once per plan. The tool refuses
   only while the app has no payout account at all. While the account can't take charges yet, its
   result says so and puts an **Open payments settings** button in the chat, which opens Payments
   and plans at the Stripe payout account row: tell the app builder plainly that the plan is
   saved but no app user can subscribe until they finish Stripe setup there, and point at that
   button. Never leave a plan unset because verification is still pending.
4. If `connect.chargesEnabled` is `true` but `connect.payoutsEnabled` is still `false`, remind the
   app builder to connect a bank account so they can actually be paid — call `getPayoutSetupLink` for a
   direct link. Funds accumulate in the Stripe balance until then, and Stripe imposes a deadline
   (~30 days after funds first arrive), so don't let it wait too long. Skip this step entirely for
   a managed app (`connect.managed`): there is no bank account to connect and no Stripe deadline.

## A plan only goes live on the next build/publish — never claim otherwise

The deployed app reads its plans from a **snapshot baked in at build time**, not live at runtime. A plan you create or change with `setSubscriptionPrice` **after the last build is not in the live bundle yet** — the subscribe/pricing page silently bounces even though the plan is saved and synced with Stripe.

- `setSubscriptionPrice` tells you which case you're in — the staleness check spans **all** plans, so any unpublished plan change flags the whole app. When it returns `rebuildRequired: true`, the change is saved but the live app still runs the previous bundle. **Relay that verbatim — do not tell the app builder that app users can subscribe yet.** Say the plan is saved and the app needs one rebuild (or publish) first. Only when it returns `rebuildRequired: false` may you say the plan is live.
- A **publish alone** cures a stale snapshot (the redeploy/publish path re-bakes the current plans), so the app builder does not need a full rebuild — just get the app republished once after the plans are set.
- **Mandatory new-app sequence:** `build → configure the plans → rebuild (or publish)`. A brand-new app must be built before a plan can be created (payments tooling is gated until the first build), so plans are always created *after* that first build and the app must be built/published once more before subscribe works. Never hand off a just-configured new app as "ready to subscribe" without that second build.

### Stripe verification takes a minute or two

After the app builder completes the Stripe-hosted onboarding and tells you they're "done", `getPaymentStatus` often still reports `connect.chargesEnabled: false` for **~1–2 minutes**. Stripe verifies the details in the background and flips the account to ready a little later. This dead moment is normal — it is **not** a failure and does not mean the app builder did anything wrong.

When the app builder says they've finished but `getPaymentStatus` is still not ready:
- **Do NOT imply it failed, and do NOT call `setupPayments` again or re-send the onboarding link.** Handing them a fresh link reads as "your first attempt didn't count" and sends them back through onboarding they already completed.
- Tell them plainly: **"Stripe is verifying — this usually takes a minute or two."**
- Wait briefly, then call `getPaymentStatus` again. Re-check once or twice before concluding anything is wrong.
- Only if it is still not ready after a couple of re-checks should you escalate — and then offer to re-open the onboarding link so they can see any outstanding requirements Stripe is still asking for, rather than restarting from scratch.

## Pricing

- Minimum $0.50 per price (monthly or yearly). The one exception is a plan the app builder sets to **$0 on the payments settings page**: it is **assigned, never sold** — the builder gives it to people from Users → Add person, checkout refuses it, and it takes no yearly price and no trial. In app code it arrives in `tiers` with `priceCents: 0`, so leave it off the pricing and upgrade pages (filter on `priceCents !== 0`).
- Specify `priceCents` for a monthly price (e.g. $9.99/mo = `priceCents: 999`). A plan needs at least one price: pass a monthly price, a yearly price, or both. For a **yearly-only** plan omit `priceCents` and set only `yearlyPriceCents`.
- Set `position` when you want a specific plan order — lower numbers sit lower in the hierarchy. If you leave it out, new plans append to the end.
- Changing a price updates that plan's subscribers on their next renewal (Stripe handles the transition).

### Annual pricing

- A plan's annual price is set with `setSubscriptionPrice`'s `yearlyPriceCents` — but only after the app builder switches **annual billing** on in the app's payments settings page. This holds for a yearly-only plan too. You can't switch it on from chat; if the toggle is off, the write fails and you should tell the builder to enable annual billing there first.
- When the builder asks for an annual option, a good default discount is roughly **two months free (~17% off)** the monthly price × 12 — e.g. $10/mo → about $100/year. Suggest that only when they ask for annual pricing; don't push it otherwise.

### Free trial

- `setFreeTrial` sets the number of free days (1–90) new subscribers get before their first charge, on **every** plan — there is no per-plan trial. `days: 0` turns it off. The builder can also set it on the payments settings page.
- **Card upfront, always.** Checkout still collects the card; Stripe charges it automatically when the trial ends and the subscription simply carries on. There is no card-less trial. The app treats a trialing subscriber as subscribed from the moment they check out — nothing to gate differently, but the app must *show* it differently (see "Billing-page wording" below).
- **A trial is live the moment you set it — no rebuild, like a coupon.** Don't tell the builder to publish first. It applies to new checkouts only; existing subscribers are untouched.
- **Coupons still apply; the discount kicks in after the trial.** Checkout keeps the promo-code field (and honours a pre-applied code) whenever the app has a live coupon, trial or not. Stripe runs the trial first and applies the discount to the invoices that follow, and its checkout page shows the combined terms itself — pricing-page copy only needs the trial and the base price.
- **Pricing-page wording:** when `trialDays` is above `0`, the plan cards should say "N days free, then $X/mo" (and "then $Y/yr" for annual) so the app user knows the card is charged later. If a trial is switched on after the pricing page was built, offer a small copy update — the checkout itself already honours the trial without a rebuild.
- **Billing-page wording:** for the whole free period `getSubscription` returns `status: "trialing"`, and `currentPeriodEnd` is then the end of the trial — the date of the **first charge**, not a renewal. The billing page must say so: a "Free trial" status pill in its own tone (not the "Active" one) and "Free trial — first charge of $X on <date>", never "Active" or "Renews". Once the app user has cancelled during the trial (`cancelAt` set): "Trial ends <date> — you will not be charged". The snippet is under "Showing subscription status" in Part 2 §3; it is the billing-page counterpart of the pricing-page line above.
- Stencil emails the subscriber in the app's name when the trial starts (plan, trial length, first-charge date and amount, where to manage or cancel) and again three days before it ends. The builder configures nothing in Stripe for this.
- **An app user on a trial can start paying now.** `endTrial(request, context, returnUrl)` from `~stencil/payments/server` ends the signed-in app user's trial at once: Stripe charges the first period to their saved card and `getSubscription` reports `"active"` within seconds. Offer it as a "Start my plan now" button on the billing page while `sub.status === "trialing"`; with no card on file it sends them to the billing portal (back to `returnUrl`) to add one. Never fake it by storing a flag in the app's own table.

### Sales tax

- Sales tax is **optional**, and taxes are the **app builder's responsibility** whether or not it is on: Stencil never files or pays tax for them. Never tell the builder whether they owe tax — for that, suggest an accountant.
- To turn it on, the app builder finishes tax setup and adds a registration in the **Sales tax** card, right under Enable payments on the payments settings page (registrations in the Payments panel), then switches **Charge sales tax** on. You can't do any of that from chat — send the builder there.
- When it is on, Stripe adds the tax for the app user's address **on top of the plan price** at checkout and on every renewal, in the places the builder is registered. New checkouts only; existing subscribers are never changed. Like a trial, it is live the moment it is switched on — no rebuild.
- **Pricing-page wording:** when `getPaymentSettings` returns `taxEnabled: true`, show prices as "$X/mo plus applicable sales tax" (Part 2 §6). The app must **never compute tax itself** — no rates, no estimates, no tax line; Stripe shows the exact amount at checkout.
- **Sellers (app users selling to their own end users) are different: sales tax is always on for them, with no toggle.** Stencil sets it up on each seller's account at onboarding; the seller manages registrations in the Sales tax tab of their seller dashboard. See the `selling` skill.

## Managing plans

- To add or change a plan, call `setSubscriptionPrice` — it's keyed by plan **name**: reusing an existing name updates that plan in place, a new name adds a plan (up to ten).
- A legacy price kept only for the app users already on it (app users moved from another system keep their old price): pass `existingMembersOnly: true` to `setSubscriptionPrice`. The plan still renews and still gates, but it is left out of `~/generated/tiers` (so the pricing page never lists it), checkout refuses it (`plan_not_for_sale`) and Stripe's billing page never offers it as a switch. App users on it can still switch to an offered plan. Pass `false` to put it back on sale.
- A plan has no limit on how many app users can subscribe, and none can be set. For "cap my membership at 30" see the limited-number rule under **Rules → In conversation**.
- To remove a plan, call `removeSubscription` with the plan `name` (the name is optional only when the app has exactly one plan). This archives its Stripe product; existing subscribers on it complete their current period.

## One-time products

A one-time product is something an app user pays for once and keeps — a course, a template pack, a lifetime unlock. It sits in the same "Plans & products" list as the plans, but it is not a plan: on its own it never unlocks a plan, has no yearly price, no trial, and no place on the gating ladder. The one bridge is a lifetime unlock: after the purchase, app code gives the buyer the plan with `grantPlanFromPurchase` (Part 2 §3).

- Use a product when the app builder says "once", "one-time", "lifetime" or "buy"; use a plan when they say "monthly", "yearly" or "subscription". Ask when it is unclear.
- `setOneTimePrice` creates or updates a product, keyed by **name** like plans, with `priceCents` (the minimum is normally $5) and an optional `description`. `removeOneTimePrice` archives one; nobody new can buy it.
- `getPaymentStatus` returns them as `products`, separate from `tiers`.
- A product goes on sale in the app on the next build/publish, like a plan: app code reads it from `~/generated/tiers` and sells it with `buy` (Part 2 §10).
- An app user can own each product once. A refund or a lost dispute takes the access away by itself; the app builder refunds from the **Payments panel**. The exception is a product sold as a **top-up pack** (extra credits, minutes or uses): the Builder Agent sells it so the same app user can buy it again and again (the usage rule under **Rules → In conversation**).
- A plan-only coupon never discounts a product. For a product discount, call `createCoupon` with `productName` or `scope: "one_time"` (or `"both"`), and duration `once`.
- **One product per checkout; there is no built-in cart.** A buyer who wants several products pays for each one on its own. When the app builder asks for a cart, "add to cart" or one payment for several items, say it is not built in: the Builder Agent can build a cart page that lists the chosen products, but each product is still paid for in its own checkout, so managed payments cannot put one payment on the whole cart. The only route to a single basket payment is a custom Stripe integration, which gives up the Payments panel, refunds and dispute handling for those charges (the custom-Stripe rule under **Rules → In conversation**) — never raise it yourself and never brief it as the fix for a cart: name it only if the app builder asks what a single payment would take, never ask them for a Stripe key, and never promise a one-payment cart on top of managed payments.
- **A product has no quantity.** Nothing in the Payments panel or the payment tools stops sales at a number. For event seats, tickets or stock, the Builder Agent builds the limit into the app: see the limited-number rule under **Rules → In conversation**.
- **No EU right-of-withdrawal waiver at checkout.** Stripe's page collects no consent checkbox of the app builder's own, and there is no setting for one. The Builder Agent can add a required checkbox with the waiver text on the app's buy page, before the buy button sends the buyer to Stripe, and record that consent in the app's own table; it cannot put anything on Stripe's page. Say that split plainly, and say nothing about whether the waiver is legally enough — that is for their lawyer.

## Discount codes

A discount code is a string an app user types when they subscribe — `LAUNCH20`, `FRIENDS` — and it comes off their subscription price. You create and manage these here, in chat; the builder never has to open Stripe. App code can also **pre-apply** a code at checkout so the app user sees the reduced price with nothing to type — see `checkout` in Part 2.

- `createCoupon` makes one. It needs the `code` (3–32 characters, letters, digits, dashes and underscores — it's stored uppercase), either `percentOff` or `amountOffCents`, and a `duration`.
- **Duration is the whole point — always confirm which one they mean.** `once` = the first payment only, `repeating` with `durationInMonths` (1–36) = that many months of payments, `forever` = every payment for as long as they stay subscribed. "20% off" is ambiguous; ask if they haven't said.
- `planName` limits a code to one plan, matched by name. Leave it out and the code works on every plan. That plan has to be set up in Stripe already.
- `scope` says what a code works on: `subscriptions` (plans, the default), `one_time` (one-time products) or `both`. `productName` limits it to one product. A code scoped to products only never works on a plan.
- `maxRedemptions` caps how many app users can ever use the code, and `redeemBy` (`YYYY-MM-DD`) is the date it stops working. Both optional; suggest a limit or an expiry when the builder is running a launch or a promotion.
- **A code works the moment you create it — no rebuild, unlike a plan.** Don't tell the builder to publish first.
- `listCoupons` shows every live code with its terms and how many app users have redeemed it. Use it before answering "what discounts do I have running?" rather than guessing from the conversation.
- `removeCoupon` takes a code down (the `code` is optional only when the app has exactly one). Nobody new can redeem it; **app users who already redeemed it keep their discount for its full duration** — say that, because builders expect removal to claw it back.

**Terms are fixed once the code exists.** There's no editing a discount's percentage, duration or plan. If the builder wants different terms, create a new code and take the old one down — tell them that's what you're doing, since anyone holding the old code loses it.

**One app user's discount is changed from the Subscribers tab of the builder's payments panel, not from chat.** Each subscriber row has a Discount control that shows what they hold, ends it (their next payment is list price), or puts one of the app's live codes on them — in place of what they hold, or on someone paying full price — with the code's duration restarting from that day. That is the answer to "take the discount away from this person", "give the people who already redeemed it the new terms", "extend their free months", and "give this returning member their discount back without a code" — create the new code here if needed, then point the builder at the panel to apply it to those subscribers. Never suggest deleting the app user or doing it in Stripe.

When to suggest one: a launch, a first cohort of app users, winning back someone who's about to cancel (the app's cancel step can apply it for them — see `applyStayOffer` in Part 2 §3), or a partner deal (a named partner sharing a code with their audience, or any referral, affiliate or refer-a-friend program inside the app — load `app-referrals`). Don't push discounts unprompted on a builder who's just setting pricing up.

## Receipts are automatic

If the app builder asks *"do my customers get a receipt?"* (or a variant), the answer is **yes, automatically** — you don't set anything up and app code doesn't send it. Stencil emails the payer a receipt on every subscription charge (signup and each renewal) and on every one-time sale, the moment Stripe confirms the payment. It's sent from the app's own email domain when the builder has connected one (otherwise Stencil's shared sender), and links Stripe's own receipt. Its From name is the app's **Sender name** (More → Settings → General; the app title until the builder sets one), so *"can the receipt come from my business name instead of the app's?"* is answered with that setting — no build, and the app must never build a sender-name setting of its own. Nothing else to configure, and the app should not build its own receipt email on top of it.

## The business name buyers see at checkout

The name on the checkout page and on the Apple Pay sheet is the **app's name**. Stencil sets it on
the app's payout account every time the app builder publishes, so a renamed app shows its new name
after the next publish — a rename alone changes nothing at checkout until then. It is also the name
on the buyer's card statement.

If the app builder wants a different name there (a company name, say), they set it in the
**Payments panel → Account tab** (More → Settings → Payments → Open panel). Once
they have changed it by hand, publishing leaves it alone from then on. Never send them to Stripe for
this — they have no Stripe login.

## The look buyers see at checkout

The checkout page shows the **app's icon**, the **app's name**, and two colours from the app's
**Brand kit**: the Brand kit **Background** is the page background and the Brand kit **Accent** is
the pay button. Stencil copies them to checkout every time the app builder publishes, so to change
the look they change the Brand kit and then publish — a Brand kit change alone shows nothing at
checkout until then.

Checkout stays Stripe's own page, and nothing else on it is adjustable: no checkout-only colour,
no layout or font choice, no preview. Never invent a Payments panel control for the checkout look,
and never send the app builder to Stripe for it — they have no Stripe login.

# Part 2 — Building with payments (app code)

Your job in code is to (1) check whether a tier exists, (2) gate the right surfaces, and (3) wire up the upgrade and subscribe flows.

## 1. Check the tiers file first

Before writing any payments code, read `~/generated/tiers`:

```ts
import { tier, tiers } from "~/generated/tiers";
```

- `tiers` — object keyed by slug (e.g. `tiers.professional`). Each value has `id`, `name`, `priceCents`, `interval`, `benefits[]`, `description`.
- `tier` — convenience shorthand: `Object.values(tiers)[0] ?? null`. For single-tier apps (the common case), always use `tier`.

**If `tier` is `null`, the app has no subscription plan configured.** Do not build any payments UI — skip gating entirely and leave a TODO comment where the gate would go.

```ts
// TODO: gate this with requireSubscription() once a subscription plan is configured
```

## 2. `paymentsEnabled` — read this carefully

Both `requireSubscription` and `getSubscription` return a `paymentsEnabled` boolean alongside the subscription data. This flag indicates whether the workspace has Stripe connected and payments active.

**When `paymentsEnabled` is `false`, all gating is bypassed** — every user should be treated as subscribed.

**Always decide "does this app user have the plan?" with `hasPlan`**, which folds `paymentsEnabled` in:

```ts
import { hasPlan } from "~stencil/payments/server";

const isPro = hasPlan(sub, paymentsEnabled, tier!.id);
```

Never gate on `sub?.status === "active"` alone — that locks everyone out when payments are disabled, and in a multi-plan app it says only that the app user is paying, not which plan they hold, so every subscriber gets the top plan.

## 3. Server functions (`~stencil/payments/server`)

The payments server functions live in `~stencil/payments/server`. Import only what you use.

### `requireSubscription` — hard gate (redirect)

Blocks the route entirely. Unauthenticated users go to `/login`; authenticated users without an active subscription go to `/upgrade`. That makes `/upgrade` the one page a signed-in app user without a plan can reach, so it must offer a way out: every upgrade and pricing scaffold renders a Sign out for a signed-in app user — keep it when adapting the page (see §4).

**Returns `{ user, sub, paymentsEnabled }`.** When `paymentsEnabled` is `false` the function returns without throwing (gating bypassed). `sub` is the subscription row or `null` — it's nullable regardless of `paymentsEnabled`, so never use `sub` as a proxy for whether payments are enabled. Use `paymentsEnabled` directly for that.

```ts
import { requireSubscription } from "~stencil/payments/server";
import { tier } from "~/generated/tiers";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user, sub, paymentsEnabled } = await requireSubscription(request, context, tier!.id);
  return { user };
}
```

Pass `tier!.id` as the third argument. Omit it only when any active subscription qualifies (multi-tier apps, rare).

### `getSubscription` — soft gate (conditional UI)

Returns `{ sub, paymentsEnabled }`. Use when you want upgrade prompts inline rather than a redirect. `sub` is the subscription row or `null`. Turn it into a yes/no with `hasPlan(sub, paymentsEnabled, tierId, opts?)` — the same check `requireSubscription` makes, without the redirect: `true` when payments are off, otherwise only for an active subscription on that plan **or a higher one** (`{ exact: true }` for that plan only; omit `tierId` to accept any plan).

```ts
import { getSubscription, hasPlan } from "~stencil/payments/server";
import { tiers } from "~/generated/tiers";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { sub, paymentsEnabled } = await getSubscription(request, context);
  return {
    isPro: hasPlan(sub, paymentsEnabled, tiers.pro.id),
    isPremium: hasPlan(sub, paymentsEnabled, tiers.premium.id),
  };
}
```

One `hasPlan` call per plan-dependent decision, each naming the lowest plan that unlocks it. **Never write the comparison by hand from `sub.status` or `sub.tierId`, and never keep a copy of the plan in the app's own tables** (a `plan` or `tier` column on a profile row): the live `subscription` row is the only source of which plan an app user holds, and a stored copy drifts the moment they upgrade, downgrade or lapse. If the app needs the plan's name or slug for display, look `sub.tierId` up in `tiers` at render time.

Active statuses: `"active"`, `"trialing"` and `"past_due"`. A `"past_due"` subscription is one whose renewal charge failed and is being retried by Stripe; the app user keeps access while that runs, and if the retries run out Stripe cancels the subscription. `"canceled"` is not active.

### Showing subscription status — `"trialing"` and `sub.cancelAt`

Both count as active for gating, and both change what you display. Never collapse them into one "Active — renews on <date>" line. A third case, **free access**, is covered below the snippet:

- `sub.status === "trialing"` for the whole free period, and `currentPeriodEnd` is then the end of the trial — the date of the **first charge**, not a renewal. An app user who reads "Active — renews 9/26" has no way to tell they are in a free period, or that 9/26 is the first time their card is charged. Show a "Free trial" pill in its own tone, and name the first charge date and amount.
- `sub.cancelAt` (a date, or `null`) is set while a cancellation is pending: the app user cancelled, but the subscription stays entitled until that date, then ends instead of renewing (during a trial, it ends without ever charging). **It does not change the active check above.** If it isn't visible, the app user who just cancelled sees "renews on …" and thinks the cancellation failed.

```tsx
import { tiers } from "~/generated/tiers";
import { formatDateInZone } from "~stencil/time";
import { useViewerTimeZone } from "~stencil/react-router/root";

const timeZone = useViewerTimeZone();
const plan = Object.values(tiers).find((t) => t.id === sub?.tierId);
const price = plan ? `$${(plan.priceCents / 100).toFixed(0)}` : "";
const periodEnd = sub ? formatDateInZone(new Date(sub.currentPeriodEnd), timeZone) : "";
// `free` comes from the loader: isComplimentary(sub). An open-ended grant has currentPeriodEnd far in the future.
const openEnded = sub ? new Date(sub.currentPeriodEnd).getFullYear() >= 2099 : false;

{free ? (
  <p>Free access{openEnded ? "" : ` — until ${periodEnd}`}</p>
) : sub?.status === "trialing" ? (
  sub.cancelAt ? (
    <p>Trial ends {formatDateInZone(new Date(sub.cancelAt), timeZone)} — you will not be charged</p>
  ) : (
    <p>Free trial — first charge of {price} on {periodEnd}</p>
  )
) : sub?.cancelAt ? (
  <p>Cancelled — access until {formatDateInZone(new Date(sub.cancelAt), timeZone)}</p>
) : (
  sub && <p>Renews {periodEnd}</p>
)}
```

The status pill follows the same split: "Free trial" for `"trialing"`, "Active" for `"active"`, and a cancelling state whenever `cancelAt` is set.

**Free access** is a plan the app builder gave in More → Users without a purchase. The loader reads it with `isComplimentary(sub)` from `~stencil/payments/server` (the `subscription` row alone — never `getBilling` in a loader, §11) and passes it as `free`. On the billing page it shows a "Free access" pill and "Free access — until <date>" when the grant has an end date, nothing about renewing or a price, and **no Manage billing, Change plan, Subscribe or Start my plan button**: there is no Stripe subscription behind it, so every one of those helpers sends the app user straight back to `returnUrl` (`checkout` to `successUrl`) and nothing happens. `hasPlan` already returns `true` for it, so gating needs no change. The pricing page already says "N days free, then $X/mo" (Part 1, Free trial); the billing page is where the app user checks back later, so it must tell the same story.

### `checkout` — start a Stripe checkout session

Call from a form `action` (POST). Throws a redirect to Stripe-hosted checkout. Do not call client-side. **`checkout` resolves the payer from the signed-in app user.** With no session it opens the pay-first checkout on a payment-required app (the platform checks the access mode when the button is clicked, not when the app was built) and redirects the caller to `/login` on any other app. An app user who already holds free access to that plan is sent to `successUrl` with no Stripe page, so a subscribe button they reach anyway never charges them. The explicit no-session checkouts are `payFirstCheckout` for a plan on a payment-required app (see §4), and `buy()` for a one-time product on any app that is not invite-only (§10).

```ts
import { redirect } from "react-router";
import { checkout } from "~stencil/payments/server";
import { tier } from "~/generated/tiers";

// app/routes/subscribe.tsx
// A plain visit has nothing to post — send it to the page with the form, code intact.
export const loader = ({ request }: Route.LoaderArgs) =>
  redirect(`/upgrade${new URL(request.url).search}`);

export async function action({ request, context }: Route.ActionArgs) {
  await checkout(request, context, {
    tierId: tier!.id,
    successUrl: new URL("/app", request.url).toString(),
    cancelUrl: new URL("/upgrade", request.url).toString(),
  });
}
```

`successUrl` and `cancelUrl` default to `/app` and `/upgrade` — only override when you need a different redirect.

**`/subscribe` always ships with the loader above — never an action alone.** An action answers only the form's POST. Opening `/subscribe` as a link, refreshing it, or pressing back is a GET, and a route with no loader answers that with a raw "Unexpected Server Error" before checkout starts. The loader sends every plain visit to the page that holds the subscribe form (`/upgrade`, or `/pricing` in a multi-plan app) and keeps the query string, so a shared link like `/subscribe?c=LAUNCH20` lands on `/upgrade?c=LAUNCH20` with the code still there — see "Pre-applying a discount code" for how that page uses it.

**The loader never starts the checkout, even when the app builder asks to skip the upgrade page.** A GET of `/subscribe?c=CODE` from a link on any site, a reload or the back button would then redeem the code, send the welcome email and record the referral with nothing pressed, and the build refuses it. "Go straight to Stripe" means one tap: call `checkout` from the action of the form the app user just submitted, or from a single Continue button's action — never from a loader or a form that submits itself on load.

**The button must show it is working the moment it is clicked.** Starting a checkout and redirecting to Stripe takes a moment, and a plain submit button looks dead for that long — the app user clicks again or leaves. Every form that posts to `checkout`, `payFirstCheckout` or `buy` reads `useNavigation().state === "submitting"` and, while it is true, disables the button and swaps its label for "Opening checkout…". Take the pending state from the navigation, never from local state: a refused checkout settles back to idle and the button is usable again. The pay-first scaffolds already do this; a hand-built buy or subscribe button must too.

```tsx
import { Form, useNavigation } from "react-router";

export function SubscribeButton() {
  const submitting = useNavigation().state === "submitting";
  return (
    <Form method="post" action="/subscribe">
      <button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? "Opening checkout…" : "Subscribe"}
      </button>
    </Form>
  );
}
```

**Card only, and a required terms checkbox.** Only when the app builder asks: `link: false` hides Stripe's Link wallet (the Bank and Klarna rows it brings) so the card form is the only way to pay, and `termsUrl: "https://…"` adds a required "I agree to the Terms" checkbox linking to that address. Both are options on `checkout`, `payFirstCheckout` and `buy`, off unless passed, and not available on seller checkouts. The address must start with `https://`; on an account where Stripe cannot show the checkbox, the payment page shows "By paying you agree to the Terms: <address>" by the pay button instead, so never promise a checkbox was ticked.

**Pre-applying a discount code.** Pass `promoCode` to open checkout with one of the app's discount codes already applied: the app user sees the reduced price on the payment page with nothing to type. **The cost: the payment page then hides its own promo-code field** (it allows one or the other, never both), so a buyer who arrived holding a *different* code has nowhere to type it and no way to drop the applied one — they pay without their code or leave. So:

- **Do not pre-apply when the app has more than one live code for that plan** (`listCoupons`). Leave `promoCode` out and let the payment page's own field take whichever code the buyer holds. This includes codes that arrive by referral cookie or query param: if several codes are live, show the code on the page instead of applying it.
- The platform enforces that rule itself: when more than one live code covers the plan being bought, checkout ignores `promoCode` and opens the payment page with its code field showing instead of the discount — so a pre-applied code only ever takes effect while it is the only live code for its plan.
- **When you do pre-apply** — one live code, a promoted plan button, a sales-page CTA, a link carrying the code (`?c=LAUNCH20`) — the page that opens checkout must **name the applied code and offer a "Use a different code" control** that opens the same checkout without `promoCode`, so the payment page shows its field. Never pre-apply silently.
- Never hand-build a "type your code here" or "copy this code and paste it at checkout" box — the payment page's own field is the only place a buyer types a code.

A code on a link rides as `?c=` on the page with the subscribe form (`/upgrade?c=LAUNCH20`; a `/subscribe?c=LAUNCH20` link lands there too, through the subscribe loader above). The page's loader reads it, the form carries it as `promoCode`, and the action passes it on — so the code survives the buyer signing up or in along the way:

```tsx
// app/routes/upgrade.tsx
const PROMOTED_CODES = ["LAUNCH20"]; // the codes the app promotes — all live per listCoupons

export async function loader({ request }: Route.LoaderArgs) {
  const code = new URL(request.url).searchParams.get("c")?.trim().toUpperCase() || null;
  return { code, codeKnown: code != null && PROMOTED_CODES.includes(code) };
}

// In the page: only the first button sends the code; the second opens checkout with the field showing.
<Form method="post" action="/subscribe">
  {codeKnown ? (
    <>
      <p>Code {code} applied — 20% off your first 3 months.</p>
      <button type="submit" name="promoCode" value={code!}>Subscribe with {code}</button>
      <button type="submit">Use a different code</button>
    </>
  ) : (
    <>
      {code && <p>The code {code} isn't available. You can enter a code on the payment page.</p>}
      <button type="submit">Subscribe</button>
    </>
  )}
</Form>

// app/routes/subscribe.tsx
export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const promoCode = String(form.get("promoCode") ?? "") || undefined;
  await checkout(request, context, {
    tierId: tier!.id,
    promoCode,
    successUrl: new URL("/app", request.url).toString(),
    cancelUrl: new URL("/upgrade", request.url).toString(),
  });
}
```

The code must be one of the app's own live codes (check `listCoupons`; a code it lists with `ended` set has expired or been used up). An unknown, removed, expired or used-up code makes `checkout` throw, and an uncaught throw is a server error page for the app user. So never hand a code straight from the URL to `checkout`: check it against the codes the app promotes first, as above. When it is unknown, **say so on the page and leave `promoCode` out** so the payment page shows its own field — never quietly drop the code and open a full-price checkout, because the buyer followed that link for the discount. Also wrap the `checkout` call in a try/catch and read the error's `code`: `promo_not_found` (no such code), `promo_expired` (past its end date) or `promo_unavailable` (used up, or Stripe refused it for this buyer). Show the matching sentence next to the code field — "This code has expired", "This code has already been used up" — and let the buyer try another or continue without one; rethrow anything else. `payFirstCheckout` accepts the same option and throws the same codes, so on a pay-first app the same `promoCode` field and handling go on the pay-first form.

### `manageSubscription` — Stripe billing portal

Lets the user update payment details, change plan, or cancel. Call from a form action (POST). Redirects to `/upgrade` if the user has no subscription.

```ts
import { manageSubscription } from "~stencil/payments/server";

// app/routes/app.billing.tsx
export async function action({ request, context }: Route.ActionArgs) {
  await manageSubscription(
    request,
    context,
    new URL("/app/settings", request.url).toString(), // returnUrl after portal
  );
}
```

Only render the "Manage billing" button when `isPro` is `true` **and** `isComplimentary(sub)` is `false`: an app user with no subscription is redirected to `/upgrade`, and one on free access (More → Users) has no Stripe subscription to manage, so the helper sends them back to `returnUrl` with nothing to show — render the "Free access" line from "Showing subscription status" instead of the button. The billing page that hosts this button is also where the plan's status and next date are shown; render those per "Showing subscription status" above, so a trialing app user sees "Free trial — first charge of $X on <date>" there and not "Active — Renews".

### A cancel flow with a stay offer — `applyStayOffer` and `pauseSubscription`

When the app builder wants to give an app user a reason to stay before they cancel ("stay for 50% off", "pause instead of cancelling"), build the offer screens in the app and have their actions call these two helpers. Both act on the signed-in app user's **real** subscription through the platform — never hand-write Stripe calls, never store an "accepted" flag and call it done, and never send the app builder to a Stripe dashboard.

- `applyStayOffer(request, context, code)` puts one of the app's **own live discount codes** on the subscription. It applies from the next payment. The code comes from `listCoupons` (create one with `createCoupon` first if the builder has none — a `repeating` code for a set number of months is the usual "stay" offer). A code that isn't live or doesn't apply to the app user's plan throws, so catch and show the message.
- `pauseSubscription(request, context, months)` stops charges for 1, 2 or 3 months. The subscription stays active, so the app user keeps access, and billing resumes on the returned `resumesAt` date — tell them that date.
- Declining both ends at `manageSubscription()`, where they cancel in the billing portal as today. Never leave the "cancel anyway" step as a dead end.
- Each offer works once per subscription, and a discount is never put on top of one the app user already holds. When a helper throws with `code` `offer_already_used` or `already_discounted`, that is not an error to show: skip straight to the next step (pause, then cancel).

Chain them in whatever order the builder wants, one action per step:

```ts
// app/routes/app.cancel.tsx — a three-step cancel page
import { applyStayOffer, pauseSubscription, manageSubscription } from "~stencil/payments/server";

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  try {
    switch (form.get("intent")) {
      case "stay": {
        const discount = await applyStayOffer(request, context, "STAY50");
        return { done: "stayed", terms: discount.terms };
      }
      case "pause": {
        const { resumesAt } = await pauseSubscription(request, context, 2);
        return { done: "paused", resumesAt: resumesAt.toISOString() };
      }
      default:
        await manageSubscription(request, context, new URL("/app/billing", request.url).toString());
    }
  } catch (err) {
    if (err instanceof Response) throw err; // the portal redirect
    const code = (err as { code?: string }).code;
    if (code === "offer_already_used" || code === "already_discounted") return { skip: true };
    return { error: err instanceof Error ? err.message : "Something went wrong" };
  }
}
```

The page shows the offer for the current step and posts `intent=stay`, `intent=pause` or `intent=cancel`. On `skip`, it advances to the next step without a message. On `done`, confirm what happened in plain words ("You're on 50% off for the next 3 months", "Paused — your next payment is on <date>, and you keep access until then").

### Cancelling from app code — `cancelSubscription`

When something the app does replaces the plan, cancel it in the same action instead of asking the app user to go cancel it themselves. The usual case is a one-time "lifetime" purchase bought with `buy()`: once the purchase is claimed, call `cancelSubscription(request, context)` for that signed-in app user. It cancels their **own** plan at the end of the period they already paid for, so there are no more charges and they keep access until then (`getSubscription` shows `cancelAt`). Pass `{ mode: "immediate" }` only when access must end now. It never refunds, and it redirects to `/upgrade` when they have no plan. It throws with `code: "subscription_not_found"` once the plan has already ended, which is safe to ignore. A page where an app user chooses to leave still uses the stay-offer flow above, ending at `manageSubscription()`.

### A lifetime purchase that stands for a plan — `grantPlanFromPurchase`

When a one-time product is sold as lifetime access to a plan ("Founding Member Lifetime" for the Pro plan), the purchase alone unlocks nothing a plan gates: `requireSubscription`, `hasPlan` and seller onboarding (`onboardSeller`) read only the plan. Once the purchase is claimed, call `grantPlanFromPurchase(request, context, { productId: products.<slug>.id, tierId: tiers.<slug>.id })` for that signed-in app user, in the action or success-page step that already handles the purchase. The platform checks that this app user really paid for that product, then gives them the plan with no end date; they show under More → Users as having free access to that plan, and it never counts as subscription revenue.

- Order: `grantPlanFromPurchase` first, then `cancelSubscription`. With no plan, the grant lands at once. With a live paid plan it returns `{ granted: false, reason: "paid_subscription" }` and changes nothing: cancel the old plan with `cancelSubscription`, and call the grant again on a later visit once that plan has ended (for example in the signed-in layout's action or the page they land on), since it is safe to repeat.
- A past-due plan (a failed payment Stripe is still retrying) is also refused with `reason: "paid_subscription"`: cancel it first, the same way.
- `reason: "no_purchase"` means the platform holds no paid purchase of that product for this app user. Right after checkout the payment can take a few seconds to arrive, so show "confirming" and try again on the next load; never grant some other way.
- `reason: "already"` means they already hold this grant. Treat it as success.
- Never write the `subscription` table yourself, and never tell the app builder to give free access by hand for each lifetime buyer: this call is the way.
- A refund of the purchase does not take the plan away by itself. Tell the app builder that after refunding a lifetime purchase they end that person's access under More → Users.

## 4. Upgrade page

**The `/upgrade` route is mandatory the moment a subscription plan or selling is enabled.** `requireSubscription`, `manageSubscription`, and seller onboarding all hard-redirect unsubscribed app users to `/upgrade` — if the route isn't registered, every one of those redirects lands on a 404 and nobody can subscribe. Before finishing any payments turn, check `app/routes.ts` for the `upgrade` route; if it's missing, add it (create it from the scaffold below, or register a route that redirects to the app's own pricing page).

**The page must let a signed-in app user leave.** `requireSubscription` sends a signed-in app user without a plan here from every gated route, so if checkout fails or they decide not to pay, this page is the only one they can see. Every scaffold below renders `<SignOutButton>` for a signed-in app user; never remove it, and add it to an existing upgrade or pricing page that lacks one. A "Sign in" link on the page goes to the hosted `/login` (a plain `<a href="/login">` or `<Link to="/login">`), never to a page the app builds — see the `custom-auth` skill's "One sign-in page per app".

**Pick the scaffold by plan count — never guess it.** Read the count from `getPaymentStatus`
(`tiers.length`; in app code, the entries of `~/generated/tiers`):

| Plans | Session flow (open / invite-only) | Pay-first (`payment-required`) |
|---|---|---|
| 1 | `upgrade.tsx` | `upgrade-pay-first.tsx` |
| 2+ | `pricing.tsx` | `pricing-pay-first.tsx` |

The pay-first column applies only when `getAuthConfig` reports `payment-required` (see the
pay-first section below). **A multi-plan app must never ship a single-plan scaffold**: those
render `tier` — the first plan only — and silently hide every other plan.

**One plan** — do not build the page from scratch: start from the `subscriptions/upgrade.tsx`
scaffold for `app/routes/upgrade.tsx`.

The scaffold reads `tier` from `~/generated/tiers` and renders the plan name, price, interval, description, and benefits. Adapt the copy and visual design to match the app.

Register the route in `app/routes.ts`:

```ts
route("upgrade", "routes/upgrade.tsx"),
route("subscribe", "routes/subscribe.tsx"),  // resource route: loader redirects, action checks out
```

The upgrade scaffold's form posts to `/subscribe`. Create that resource route — the loader is not optional (§3 says why):

```ts
// app/routes/subscribe.tsx
import type { Route } from "./+types/subscribe";
import { redirect } from "react-router";
import { checkout } from "~stencil/payments/server";
import { tier } from "~/generated/tiers";

export const loader = ({ request }: Route.LoaderArgs) =>
  redirect(`/upgrade${new URL(request.url).search}`);

export async function action({ request, context }: Route.ActionArgs) {
  await checkout(request, context, {
    tierId: tier!.id,
    successUrl: new URL("/app", request.url).toString(),
    cancelUrl: new URL("/upgrade", request.url).toString(),
  });
}
```

**Two or more plans** — create `app/routes/pricing.tsx` from the `subscriptions/pricing.tsx`
scaffold instead.

It renders every plan from `tiers` in gating order, with a monthly/annual toggle when a plan
carries both prices. The gates still redirect to `/upgrade`, so register the pricing page and
keep `/upgrade` as a redirect to it:

```ts
route("pricing", "routes/pricing.tsx"),
route("upgrade", "routes/upgrade.tsx"),   // gates land here — redirect to /pricing
route("subscribe", "routes/subscribe.tsx"),
```

```ts
// app/routes/upgrade.tsx
import { redirect } from "react-router";
export const loader = () => redirect("/pricing");
```

Its plan cards post `tierId` and `interval`, so the `/subscribe` action reads both from the
form instead of hard-coding `tier`, and its loader sends a plain visit to `/pricing`:

```ts
export const loader = ({ request }: Route.LoaderArgs) =>
  redirect(`/pricing${new URL(request.url).search}`);

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  await checkout(request, context, {
    tierId: String(form.get("tierId")),
    interval: form.get("interval") === "year" ? "year" : "month",
    successUrl: new URL("/app", request.url).toString(),
    cancelUrl: new URL("/pricing", request.url).toString(),
  });
}
```

### Pay-first: the payment-required front door

An app can make a completed purchase the only way to get an account: access mode
`payment-required`, set with `configureAuth` (`accessMode: "payment-required"`). When the builder
asks for "paid only", "no free accounts", or "pay to join", **set the mode with `configureAuth`
and use the scaffolds below — never hand-roll a gate.** Do not block signup in app code, invent a
beta list, or bounce fresh accounts to a paywall: the hosted signup page of a payment-required app
already sends visitors to `/upgrade`, so `/upgrade` is the front door and must work logged out.

A pay-first app can still let some people in free: its **free sign-up link**
(`configureAuth` with `freeSignupLink: true`, see `login-settings`) opens the ordinary sign-up
screen for whoever arrives through it, and that account lands on no plan, so the paid screens'
`requireSubscription` sends it to `/upgrade` like on an open app. When the builder wants a free
page or campaign next to the paid door, hand them that link; do not build a second gate.

Pick the upgrade page at build time: call `getAuthConfig`, and only when it reports
`payment-required` copy the pay-first variant instead of the plain scaffold. The safety net lives
in `checkout()` itself: with no session it asks the platform for a pay-first checkout, which the
payments worker grants only to a payment-required app — read when the button is clicked, not when
the app was built — and refuses for any other app, which then sends the visitor to `/login`. So a
plan button wired to `checkout()` never strands a logged-out visitor on a pay-first app, but the
pay-first scaffold is still the right page: its copy tells the visitor the purchase creates their
account. **An open or invite-only app must never ship the pay-first scaffold** — its logged-out
visitors belong at `/signup` or `/login`.

Pick the pay-first scaffold by plan count, exactly as in the table above. Both variants become
`app/routes/upgrade.tsx` — `/upgrade` is the front door the hosted signup redirects to, so the
pay-first page lives there directly, with no `/pricing` redirect split. The scaffold, and the
file the app gets from it:

- one plan: `subscriptions/upgrade-pay-first.tsx` becomes `app/routes/upgrade.tsx`
- two or more plans: `subscriptions/pricing-pay-first.tsx` becomes `app/routes/upgrade.tsx`
- either way, the success page: `subscriptions/subscribe-success.tsx` becomes `app/routes/subscribe.success.tsx`

```ts
route("upgrade", "routes/upgrade.tsx"),
route("subscribe/success", "routes/subscribe.success.tsx"),
```

The pay-first page's forms post to its own action, so the `/subscribe` resource route is
not needed. How the flow works:

- A **logged-out** visitor sees the plan — every plan, on the multi-plan page — and a Subscribe
  button: no signup form and no email field. The action calls
  `payFirstCheckout(context, { request, tierId, interval?, successUrl, cancelUrl })` and the buyer
  enters their email once, on Stripe's page. Always pass the action's `request`: it carries the
  visitor's attribution cookie, which is how the account the platform creates records where the
  buyer came from.
- `email` is **optional**: pass it only when the page has a reason to collect the address itself
  (Stripe then locks its checkout email to that address). Never make a typed email a condition of
  the button working — a plan click that does nothing is exactly the failure this page exists to
  avoid.
- On payment the platform creates the account from the email on the Stripe subscription — the
  purchase itself is the signup; the app never creates the account.
- The success page signs the buyer **straight in, no email hop**: Stripe fills the `session_id`
  param `payFirstCheckout` puts on the success URL, and the scaffold's loader claims it with
  `claimPayFirstCheckout(context, sessionId)` and redirects into a signed-in session. Its
  check-your-email screen renders only when the claim is refused (reused or expired link) — the
  platform's emailed sign-in link is the recovery path for a closed tab or another device. Point
  `successUrl` at `/subscribe/success` (the scaffold already does, carrying `?email=` for the
  fallback).
- **Where the buyer lands, and a password.** The claim signs the buyer in and lands them on `/app`. To land them somewhere else — an onboarding page, a welcome screen — pass `next`: `claimPayFirstCheckout(context, sessionId, { next: "/onboarding" })`. It must be a path on this app (`safeReturnTo` rules); anything else falls back to `/app`. A pay-first account has **no password**: the buyer gets back in only by emailed link until they set one. When the builder wants buyers to choose a password, chain the platform's page in front of the landing page: `next: "/auth/set-password?next=/onboarding"`. That page asks for a password and a confirmation, offers "Skip for now", and sends an account that already has a password straight on to its own `next`. **Never set a first password from the browser**: `~stencil/auth/browser.client` has no `setPassword` (the call answers 404 and every password "fails"), and never hand-build a set-password page — link to `/auth/set-password?next=…` from the app instead.
- A **signed-in** visitor on the same page goes through `checkout()`, unchanged.
- A passed address that is not a valid email (no domain ending, for example) or whose account the
  builder removed is refused at checkout creation, before any
  Stripe page — `payFirstCheckout` throws with that reason, and the scaffold shows it inline. An
  address typed on Stripe's page is checked after payment instead: no account is created and the
  Stencil team is alerted.
- A passed address that already holds a live plan is sent back to `cancelUrl` with
  `?checkout_error=already_subscribed`, nothing charged. The page's loader must read that param
  and show "You already have a membership. Log in to change your plan" with a link to `/login`.
- **Returning app users sign in on the hosted `/login`.** The scaffold's "Sign in" link points there, and so must every other Log in control in the app. If a Log in link lands on `/upgrade` or anywhere else, the fix is the link (and the catch-all route in `app/routes.ts`, per the layer manifest), never a login page of the app's own — the platform already serves one that reads the login settings live. Never hand-build a login, signup or password page to repair this.
- **A signed-in app user who has not paid can always sign out.** The pay-first scaffolds render `<SignOutButton>` under the plan; keep it. Without it an app user whose checkout errored is sent back to `/upgrade` from every route with no way out.

## 5. Inline upgrade prompt (soft gate)

When you want to tease a feature without hard-blocking, the loader answers yes/no with `hasPlan` and the component hands that answer to `<PlanGate>` from `~stencil/ui/payments/plan-gate`:

```tsx
import { PlanGate } from "~stencil/ui/payments/plan-gate";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const { sub, paymentsEnabled } = await getSubscription(request, context);
  return { user, isPro: hasPlan(sub, paymentsEnabled, tier!.id) };
}

export default function FeaturePage({ loaderData }: Route.ComponentProps) {
  const { isPro } = loaderData;

  return (
    <PlanGate unlocked={isPro} planName={tier!.name} feature="Reports">
      <FeatureContent />
    </PlanGate>
  );
}
```

**A locked surface is always `hasPlan` in the loader plus `<PlanGate>` in the component; a route nobody without the plan may open is `requireSubscription` (§3). Never write locked-state markup or an upgrade link by hand, and never write the plan comparison by hand.** `<PlanGate>` decides nothing — it renders `children` when `unlocked` is true and the locked card otherwise, so the one `hasPlan` call in the loader stays the only place the plan is checked.

- `planName` is the plan the card names: in a one-plan app `tier!.name`, in a multi-plan app the lowest plan that unlocks the surface (§7 says which), looked up from `tiers` — never a string typed into the app.
- `feature` is an optional short label ("Reports", "Reels") for the card's sentence; leave it off for a generic "This is part of the Pro plan."
- `fallback` replaces the default card when the app builder asked for a specific locked state (a blurred preview, a teaser list). Pass it as JSX and keep the `<a href="/upgrade">` link inside it; do not rebuild the default card inline.

Usage caps and quotas — counting how many of something an app user did this month and stopping them at a number — are not plan locks: they stay ordinary app code, and `<PlanGate>` does not cover them.

## 6. Displaying plan details in UI

Use `tier` directly from `~/generated/tiers`:

```tsx
import { tier } from "~/generated/tiers";

// Price display
const price = tier ? `$${(tier.priceCents / 100).toFixed(0)} / ${tier.interval}` : null;

// Benefits list
{tier?.benefits.map((b) => <li key={b}>{b}</li>)}
```

When the app builder charges sales tax, say so next to the price and leave the amount to Stripe:

```ts
import { getPaymentSettings } from "~stencil/payments/server";

// in the loader
const { taxEnabled } = await getPaymentSettings(context);
// in the component
{price}{taxEnabled && " plus applicable sales tax"}
```

## 7. Single-plan vs multi-plan

Most apps have one plan — for those, always use the `tier` shorthand and pass `tier!.id` to `requireSubscription`. A multi-plan app (up to ten, ordered low→high) reads `tiers` instead and ships the pricing scaffolds (§4); gate each surface with the lowest plan that unlocks it — a subscriber on a higher plan qualifies automatically. That goes for soft gates too: a feature grid, a badge or a "your plan" label in a multi-plan app reads `hasPlan(sub, paymentsEnabled, tiers.<slug>.id)` per plan, never a bare "is there an active subscription" check — that check cannot tell Basic from Premium and hands every paying app user the top plan. If `tier` is `null`, don't pass `undefined` as a workaround — that accepts any active subscription and is semantically wrong. Don't call `requireSubscription` at all until a plan exists.

### Levels inside one plan

"One Pro plan with three sizes" is three plans, one per level, that the pricing page shows as **one card with a level picker**. Which plans belong to which card is a constant map in app code, keyed by each plan's key in `~/generated/tiers` — never worked out from the plan's name. A number per level (credits, seats) is a constant in the same map; Stripe does not hold it.

```ts
// app/lib/plan-levels.ts
import { tiers } from "~/generated/tiers";

export const planCards = [
  {
    name: "Pro",
    levels: [
      { plan: tiers.pro_100_credits, credits: 100 },
      { plan: tiers.pro_250_credits, credits: 250 },
      { plan: tiers.pro_500_credits, credits: 500 },
    ],
  },
];

export const levelOf = (tierId: string | undefined) =>
  planCards.flatMap((card) => card.levels).find((level) => level.plan.id === tierId);
```

- **Subscribe** posts the chosen level's `tierId` to `/subscribe`, which calls `checkout` with it (§4).
- **An app user who already subscribes sees "Change level", never Subscribe.** It posts to an action that calls `manageSubscription` — `checkout` refuses an app user who already has a plan. Next to the button, one line: "You'll pick the new level on the billing page. Moving up charges the difference today." No level change happens inside the app. An app user on free access (`isComplimentary(sub)`) gets no "Change level" button, the same as Manage billing and Change plan in §3: there is no Stripe subscription behind it.
- **The level's number** comes from the map: read the plan with `getSubscription`, confirm it with `hasPlan(sub, paymentsEnabled)`, then `levelOf(sub?.tierId)?.credits`.
- **Gating.** Or-higher — `hasPlan(sub, paymentsEnabled, level.plan.id)` — is right only when positions follow the levels. When two cards unlock different things (Team levels and Company levels), gate with that card's exact list of plans: `card.levels.some((level) => hasPlan(sub, paymentsEnabled, level.plan.id, { exact: true }))`.

## 8. Payment receipts are automatic — do not send your own

The platform sends the payment receipt email itself, on Stripe's settled-payment webhook: a new receipt on every subscription charge (signup and each renewal) and one on every one-time sale. It goes to the payer, from the app's own email domain when the builder has connected one (otherwise the shared sender), under the app's **Sender name** (More → Settings → General; the app title until set — a builder who wants their business name on receipts changes it there, not in code), and links Stripe's own receipt. **No wiring is required and app code must not send its own receipt** — adding one via the `email` skill (`~stencil/email`) just double-sends. Only add a *different* transactional email (e.g. an order-shipped notice) through that skill.

One exception, for sales by the app's sellers only (app users charging their own customers, the `selling` skill): an app that sends its own receipt for those should have the app builder turn **Send payment receipts** off in More → Settings → Payments. The app builder's own plans and products keep the platform receipt whatever that switch says.

## 9. Platform-owned tables are read-only

The tables `subscription`, `user`, `session`, `account`, `verification`, and every `oauth_*` table are platform-owned: `subscription` mirrors Stripe, the rest belong to the auth layer, and the platform rewrites all of them from its own sources. Reading them is always fine for one app user's access; a count, MRR or revenue total comes from `getSubscriberSummary` (§11), never from counting `subscription`. **Never INSERT, UPDATE, or DELETE them** — via `dbExecute`, raw SQL, or anything else. A hand-written row (for example a comped `subscription` marked active) is a forgery: it lies to every gate that reads it, and the platform will overwrite it.

If a platform gate blocks something the builder wants — most commonly "let these app users in without paying" — the answer is a Stencil-side path, never a row and never switching the gate off:

- **Never disable or bypass a paywall as a workaround.** Free, beta or comped access for chosen app users is a dashboard action, not app code: in **More → Users**, the builder opens a person and clicks **Give free access** (choosing the plan and an optional end date), or uses **Add person** on an invite-only or pay-first app to create the account with a plan and get a sign-in link. The grant writes the platform's own `subscription` row, so `requireSubscription` and `getSubscription` honour it with no app changes. Send the builder there — do not invent a "beta mode", a comp flag, an allowlist, or comment the gate out. **Add person** also takes a pasted list of addresses or a CSV, up to 100 at a time, and puts everyone on one plan; point the app builder to it before building an importer. An app builder who wants past their **own** paywall in the App preview simply buys the plan there as the preview user: the platform discounts that checkout to $0 (Stripe's page still asks for a card, no code appears, and the purchase never shows in the Payments panel or counts as a sale), and the preview user is entitled afterwards like any subscriber. That works for app plans only; one-time products still charge the real price in the preview.
- **Wiring real checkout retires every earlier self-grant path in the same build.** An app that had a beta unlock, an "approved" grant table, a test-pay intent, a hard-coded "remove before launch" account or a comp flag before payments existed keeps none of it once `requireSubscription` is in: delete the route and the button, and make the gate read the `subscription` row alone. A branch that "still honours the older grant for anyone unlocked before payments existed" is a paywall any signed-in app user can walk through, and the Security scan reports it as one. App users who were let in during the beta get **Give free access** from the app builder, not a legacy branch in code.
- **Never write a person into app code to open a gate.** No email, user id or list of accounts compared in source to skip a payment, a one-time product gate (`requirePurchase`, `hasPurchased`) or a usage limit ("3 free notes", "unlimited for me"): not for the app builder's own account, not "for testing", not "until the payout account is ready", and not when the brief asks for exactly that. The Published app runs the same code, the pass shows nowhere the app builder can see or end it, and only another build removes it. An email match is also claimable: password sign-up does not confirm the address unless the app's **Require email verification** login setting is on, so whoever registers a listed address first gets the access, and an email typed into a public form proves nothing at all. Free access is a record the app builder sets and removes on the Users page:
  - **An app plan**: **Give free access**, as above.
  - **A one-time product or a usage limit**: Give free access does not cover these, so the pass is a **role**, and the gate lets through that role **or `admin`**: read `getRole(env, user.id)` (from `~stencil/auth/roles`) once beside the purchase check or the limit, and pass when it is the named role (a lowercase name such as `unlimited`) or `"admin"`. An app user holds one role, so a gate on the named role alone shuts out the app's Admin, usually the app builder's own account, and setting the named role on that account would take Admin away. Admin also covers testing: the preview user reads as admin in the App preview. Say in the build summary that an Admin already passes and keeps their role; that for anyone else the app builder opens the person in **More → Users** and sets that role; that setting a role replaces the role the person has now; and that clearing it ends the pass. The person signs up first; the role goes on their account.
  - **Asked for an email pass anyway**: build the rest of the brief, leave every address out of the code, and name the role and the Users page in the build summary. From chat, never promise or hand off "a bypass by email": say the same thing instead.
  - **An app that already has such a list**: delete it in the build that touches the gate, replace it with the plan check or the role-or-admin check, and tell the app builder which people to set on the Users page, leaving out anyone who is already Admin.

  Any other rule that matches the signed-in email against stored data (an invite, a client portal) also requires `user.emailVerified === true`, then stores `user.id` and authorises by it.
- **Never claim Stencil is working on or restoring something.** State what the platform does today; if you don't know, say you don't know.

## 10. One-time products

A product is bought once and kept. Use it only for something the app builder sells once (a course, a template pack, a lifetime unlock); recurring access is always a plan. The one exception is a top-up pack, bought again with a fresh `reference` each time ("Top-up packs" below). **A product never replaces `requireSubscription`** — gate plan features on the plan and product content on the product, even in an app that has both. A lifetime product that stands for a plan gives the buyer that plan with `grantPlanFromPurchase` (Part 2 §3), and the plan gate stays as it is.

Read products from `~/generated/tiers`, keyed by slug like plans. A product removed after the code was written reads as a stub whose empty `id` nobody owns, so check `id` before showing a buy button:

```ts
import { products } from "~/generated/tiers";
const course = products.course_bundle; // { id, name, priceCents }
```

**Buy** — `buy()` is a server action like `checkout()` that throws a redirect to Stripe, and it works **logged out or logged in**: a signed-in app user is charged as themselves; a visitor with no account goes straight to Stripe, which collects their email, and on payment the platform creates the account for that address (or matches the existing one), unlocks the product on it and emails a sign-in link. So the buy page is a public page with a plain buy button — no signup form, no email field (pass `email` only when the page already collected it). The buy button shows "Opening checkout…" and is disabled while the form is submitting, exactly as the subscribe button in §3 does. On an invite-only app a logged-out buyer is sent to `/login` instead. Rejections come back on `cancelUrl` (the current page by default) as `?checkout_error=<code>` — `product_unavailable`, `already_purchased`, `not_ready`, `promo_not_found`, `promo_expired`, `promo_unavailable` or `access_revoked`. Read it in the loader and show a short notice ("This code has expired" for `promo_expired`); never let it crash the page.

```ts
import { buy } from "~stencil/payments/server";
export async function action({ request, context }: Route.ActionArgs) {
  const origin = new URL(request.url).origin;
  await buy(request, context, { productId: products.course_bundle.id, successUrl: `${origin}/purchase/success` });
}
```

The success page signs a guest buyer **straight in, no email hop**: `buy()` puts a `session_id` param on the success URL for Stripe to fill in, and the success route's loader claims it with `claimPurchaseCheckout(context, sessionId)` and redirects into a signed-in session — the same shape as the pay-first `subscribe-success.tsx` scaffold, with `claimPurchaseCheckout` in place of `claimPayFirstCheckout`. A signed-in buyer arrives without the param and just sees the page. When the claim is refused (reused or expired link, payment still settling), show a check-your-email screen: the platform's emailed sign-in link is the recovery path. The page says thank you and links to the content; the purchase usually lands within seconds, so if `hasPurchased` is still false there, say it is being confirmed and offer a reload — don't send them to buy again.

**Gate** — `requirePurchase(request, context, { productId, redirectTo })` redirects an app user who hasn't bought it (to `/` unless you pass `redirectTo`, normally the product's sales page). `hasPurchased(request, context, { productId })` returns a boolean for showing "Buy" or "Open". Both let everyone in while payments are off, the same as the subscription gates.

**Selling per order, request or gift** — when the same product is paid for once per record the app keeps (a kit order, a sponsor request, a gift), pass that record's id as `reference`: `buy(request, context, { productId, reference: order.id, successUrl, cancelUrl })`. The payment is then tied to that record, a buyer can pay for several records of one product, and `buy()` adds `?reference=<id>` to `successUrl`. Mark **only that record** paid, and only when `isReferencePaid(context, reference)` says so: on the success page, in a scheduled check, or in the `purchase.completed` handler. It asks the payments service, needs no session, is true for a guest's payment, and is `false` while payments are off (it never bypasses). Never decide "paid" from `hasPurchased({ productId })`, from an email typed into a form, from the product and the time of the payment, or from the success page opening, and do the mark-paid write as a claim (§12) so a reloaded page cannot run its side effects twice. Without a `reference`, a product stays bought once per app user.

**One product per `buy()`.** A checkout carries exactly one product at quantity one; there is no cart helper and no way to pass several `productId`s. A cart page can list what the buyer chose, but each product goes through its own `buy()`. **An EU withdrawal waiver** ("I agree to immediate delivery and lose my right to withdraw") is not collected on Stripe's page: when the builder asks for one, put a required checkbox with their wording on the buy page, refuse the action when it is unchecked, and store the consent with the buyer's email and a timestamp in an app table of its own — never claim Stripe's page shows it.

**A limited number** (40 seats, 12 in stock, "Sold out") is built as one row per unit, held through checkout by `reference`: §13.

**My purchases** — `getPurchases(request, context)` lists what the signed-in app user owns (`productId`, `orderId`, `purchasedAt`, newest first). Match `productId` against `products` for names. Build this page when the app sells more than one product.

The `purchase` table these read is platform-owned like `subscription` (§9): read it through these helpers, never write it.

### Top-up packs — a product bought again and again

A top-up pack is extra usage (credits, minutes, generations) an app user buys on top of their plan's allowance, as often as they like. It is the per-record `reference` sale above, with one record per purchase:

- **One one-time product per pack size**, set with `setOneTimePrice`. How many credits each pack gives is a constant in app code next to the product slug, never a value from the request.
- **Signed-in app users only.** The buy-more page sits behind login, so every purchase belongs to a known app user.
- **The buy action creates a row, then pays for that row.** Create a `topups` row (`userId`, `pack`, `credits` copied from the constant, `status: "pending"`) and call `buy` with `reference: row.id`. A fresh row, and so a fresh reference, on every click. Never call `buy` for a pack without a `reference`: the second purchase is refused with `already_purchased`.
- **Credit only on `isReferencePaid` plus a claim.** The success page's loader and the loader of the page that shows the balance both list the signed-in app user's `pending` rows; for each one where `isReferencePaid(context, row.id)` is true, `claim` it from `pending` to `credited` (§12). The credits count only on a returned row. Checking on the balance page too means a buyer who closed the tab is credited on their next visit. Never credit because the success page opened, from `hasPurchased`, from the `purchase` table (it keeps one row per app user per product, however many packs were bought) or from a `session_id`.
- **The balance is worked out, not stored.** It is the plan's allowance for the current period, plus the credits of every `credited` row, minus what was used. Keep packs as rows rather than adding to a wallet number, so crediting is one write that cannot half-happen. Key the period's usage counter by `sub.currentPeriodEnd` so the allowance resets on renewal; on a yearly plan that period is the year, so key a monthly allowance by calendar month instead. Spending is the allowance claim: count under the value read, before the paid work runs (§12 "A free allowance is a balance", and the `ai-sdk` skill's "Free uses, quotas and limits").
- **Refunds leave the credits.** `isReferencePaid` turns false after a refund, but a `credited` row stays credited. Say so in the build report, so the app builder can ask for refunded packs to be taken back.

```ts
// Buy action: a new pending row per purchase, and its id is the payment's reference.
const row = await db.from("topups").create({ userId: user.id, pack: "pack_100", credits: PACK_CREDITS.pack_100, status: "pending" });
await buy(request, context, { productId: products.pack_100.id, reference: row.id, successUrl: `${origin}/credits` });

// Loader of the success page and of the balance page: credit each paid pack once.
for (const row of await db.from("topups").list({ where: { userId: user.id, status: "pending" } })) {
  if (await isReferencePaid(context, row.id)) await db.from("topups").claim(row.id, { status: "credited" }, { where: { status: "pending" } });
}
```

The pack's real price is charged even in the App preview, so tell the app builder before they test a purchase.

## 11. What an app user really paid — `getBilling` / `getBillingFor`

**The `subscription` row tells you whether an app user is in. Stripe, through `getBilling`, tells you what they paid. Never compute money from the row or from the plan's list price in `~/generated/tiers`.** A discount code typed at checkout makes the list price wrong for that person — a $27 plan bought with a $20-off code is a $7 payment, and a purchase log, affiliate commission, referral credit or ad conversion built from `tier.priceCents` records $27 for every one of them.

`getBilling(request, context)` returns, for the signed-in app user:

```ts
{
  subscription: { tierId, status, currentPeriodEnd, interval, listPriceCents, complimentary, codeApplied } | null,
  payments: [{ invoiceId, number, paidAt, amountPaidCents, subtotalCents, discountCents, refundedCents, periodStart, periodEnd }], // newest first
  purchases: [{ orderId, productId, purchasedAt, amountPaidCents, subtotalCents, discountCents, codeApplied }],              // one-time products
}
```

`codeApplied` is the code they used (`{ code, percentOff, amountOffCents, duration, durationInMonths }`) or `null`. `amountPaidCents` is what Stripe collected — the number to log. It throws `BillingUnavailableError` when Stripe cannot be read; it never returns a guessed number, so catch it and try again later rather than falling back to the list price.

**When to call it.** On the checkout success page, when the app writes its own purchase, commission or referral record; inside form actions; inside a scheduled job in `schedules.ts`. **Never in a page loader** — it is a Stripe read of 300–800 ms that can fail, so a loader that calls it makes every visit slow and breaks the page when Stripe is down. The success page is the one loader that may call it, because it runs once per purchase.

```ts
// app/routes/subscribe.success.tsx
import { getBilling, BillingUnavailableError } from "~stencil/payments/server";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const { payments, subscription } = await getBilling(request, context);
    const latest = payments[0];
    if (latest) await recordPayment(context.cloudflare.env, latest.invoiceId, latest.amountPaidCents, subscription?.codeApplied?.code ?? null);
    return { confirmed: Boolean(latest) };
  } catch (err) {
    if (err instanceof BillingUnavailableError) return { confirmed: false }; // the daily job below catches it up
    throw err;
  }
}
```

**Renewals.** Nobody visits a page when month two is charged. An app that logs each payment (commissions, affiliate payouts, referral credit) must have a daily job in `schedules.ts` that calls `getBillingFor` for each active subscriber and inserts any `invoiceId` not yet in its own table. Make it idempotent by `invoiceId` (the `recurring-actions` skill has the manifest and handler shape):

```ts
// app/schedules.ts
export const schedules: ScheduleManifestEntry[] = [
  { name: "log-renewals", cron: "0 6 * * *", description: "Record each subscriber's latest payment so commissions use the amount really paid" },
];

// app/routes/api.internal.scheduled.tsx — inside SCHEDULE_HANDLERS
"log-renewals": async ({ env }) => {
  const db = createDb(env);
  const subscribers = await db.select({ userId: subscription.userId }).from(subscription).where(eq(subscription.status, "active"));
  for (const { userId } of subscribers) {
    const { payments } = await getBillingFor(userId, { cloudflare: { env } });
    for (const p of payments) {
      await db.insert(paymentLog).values({ id: p.invoiceId, userId, amountCents: p.amountPaidCents, paidAt: p.paidAt }).onConflictDoNothing();
    }
  }
},
```

**Scoping.** `getBilling` has no user parameter: it reads the session and returns the signed-in app user's own numbers, so app code cannot read someone else's money by mistake. `getBillingFor(userId, context)` takes an explicit id and is allowed only from a scheduled job or an action gated behind `requireRole(request, env, "admin")`. Never call it from a route where the app user id comes from the URL or form of a non-admin request.

**Store the result, then compute from the store.** Commission and referral math reads the app's own table that holds `invoiceId` + `amountPaidCents`; it does not call Stripe on every page. The success page and the daily job are the only two places that write that table.

**Complimentary subscribers** (access the app builder gave in More → Users) come back with `complimentary: true`, `listPriceCents: 0` and an empty `payments` array. Handle it — an empty `payments` array is not a bug, and there is nothing to log or pay commission on.

### Counts and totals across every app user — `getSubscriberSummary`

**Any dashboard count of subscribers, any MRR and any sales total comes from `getSubscriberSummary(context)`. Never count the `subscription` table for these.** It returns the Payments panel's own figures from the same ledger the panel reads, so the app's dashboard matches the panel by construction. A count built from `subscription` rows does not: it folds in complimentary access, free trials and subscriptions scheduled to cancel, and the app builder sees a different number from the one in their panel.

```ts
{
  subscribers: { all, active, canceling, past_due, canceled }, // the panel's Subscribers tab chips
  mrrCents, forecastMrrCents,                                  // the panel's MRR tile and its forecast
  sales: { count, grossCents, refundsCents },                  // one-time products
  currency,
}
```

`active` is a paying or trialing subscription with no cancellation scheduled; one with a cancellation scheduled is `canceling`, still in until its period ends. `forecastMrrCents` leaves out trials and pending cancellations. It throws `BillingUnavailableError` when the platform cannot be read; show "unavailable", never a number computed another way.

It is app-wide, so it belongs only behind `requireRole(request, env, "admin")` or inside a scheduled job — never in a route an ordinary app user can open:

```ts
// app/routes/admin.dashboard.tsx
import { requireRole } from "~stencil/auth/roles";
import { getSubscriberSummary } from "~stencil/payments/server";

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireRole(request, context.cloudflare.env, "admin");
  const summary = await getSubscriberSummary(context);
  return { active: summary.subscribers.active, mrrCents: summary.mrrCents };
}
```

An app whose dashboard already counts `subscription` rows or sums plan prices moves those tiles onto `getSubscriberSummary` the next time it is touched; the platform's update notes name this too.

## 12. Spend, redeem, confirm — once

Everything the platform charges is already safe to repeat: `checkout`, `buy` and `payFirstCheckout` refuse a repeat purchase (`buy` with a `reference` refuses one of the same reference), `claimPayFirstCheckout` accepts a session id once, and Stripe counts a discount code's uses. **Anything the app keeps in its own tables is the app's job to make happen once** — a points or credit balance, a cart or checkout the app turns into an order on its success page, an app-level coupon with a use limit, a seat or a slot, an approval or verdict that creates a payout, and a per-app-user allowance (N free uses of an AI feature or a trial, then upgrade). The failing shape is always the same: read the row, test it in code (enough balance, still pending, under the limit, still awaiting review), do the side effect, then write the new state. Two requests that arrive together — a double-click, a retried redirect, a success page loaded twice, two buyers on one slot — both read the old row and both pass, and the builder's own testing never produces two at once.

- **Claim first, then act.** The state change is one conditional write whose result gates the side effect: `db.from("checkouts").claim(id, { status: "used" }, { where: { status: "pending" } })` on the data SDK (the `data-sdk` skill's "Claim before a side effect" has the balance, coupon and slot shapes), or `UPDATE … WHERE … RETURNING` / an insert under a deterministic id with `onConflictDoNothing().returning()` on Drizzle. A `null` or empty result means another request won: tell the person, create nothing.
- **A success page that finalises on load is a request like any other.** The same claim guards it; never create the order from a bare page load without one.
- **Copy the amount that was charged; never re-price at confirmation.** The order row takes its total from the stored checkout, or from `getBilling` / `getBillingFor` (§11), not from a fresh calculation over the cart.
- **Count a coupon where it is checked.** Either reserve the use when the checkout opens and release it when the checkout is abandoned, or check and count in one claim at confirmation. A limit checked at open and counted after payment lets every open checkout pass. For codes on the app's own plans and products use `createCoupon` — Stripe counts those.
- **A hold is not a booking.** A held slot is confirmed only by a claim that re-checks it is still held by this buyer; a hold placed before the card page can lapse while they pay.
- **An approval that pays is a claim, not a status write.** Approve, accept, mark complete, mark shipped — when the transition creates a payout, an invoice or a ledger row, the transition itself is the claim (`claim(jobId, { status: "approved" }, { where: { status: "awaiting_review" } })`) and the dependent row is created only on a returned row. Two submits of one approval otherwise pay the contractor twice.
- **A free allowance is a balance.** "Three free prompts, then subscribe" is counted with the same claim as a coupon use — count under the value you read, before the paid call runs, never after. Counted after, parallel requests all pass and every one lands on the app builder's AI bill.

## 13. A limited number for sale

For a one-time product with a limited number: event seats, tickets, stock, spots. The platform keeps no count, sends the app no event when a payment page is abandoned or expires, and `buy()`'s payment page stays payable for 24 hours after the buyer leaves it. So the app holds one unit before the payment page opens, and frees it only once that page can no longer be paid.

- **One row per unit, never a counter.** A `spots` table: `itemId`, `status` (`available` / `held` / `sold`), `heldBy` (the hold's reference), `heldUntil`, `firstUnpaidAt`. Create N `available` rows when the item is set up. "X left" is the count of `available` rows; "Sold out" is none.
- **Every status change is one conditional write** (§12): `claim` on the data SDK, or `UPDATE … WHERE … RETURNING` on Drizzle where there is no session (a guest's buy, the scheduled job). Only server code writes `spots`.
- **Buy action.** Read one `available` row and claim it to `held` where `status` is still `available`, with `heldBy` = a new random id and `heldUntil` = now + 25 hours (the payment page's 24 hours plus a margin). No row back means another buyer took it: try the next `available` row, three in total at most, then show "That one just went, try again", or "Sold out" when none is left. Then call `buy()` with `reference` = that `heldBy` (§10). Each unit is one claim on one row, so two buyers can never get the same spot.
- **Never release on the cancel page**, or on a hold shorter than 25 hours: the payment page is still payable after the buyer leaves it, and a spot freed early is sold twice.
- **Settle.** The success page's loader reads `reference` from the URL and, when `isReferencePaid(context, reference)` is true, claims that row from `held` to `sold` where `heldBy` still matches. The scheduled job below does the same for every `held` row, for a buyer who paid and never came back to the success page.
- **Release.** A job in `schedules.ts` (hourly is enough; the `recurring-actions` skill has the shape) takes each `held` row past `heldUntil` and asks `isReferencePaid`:
  - Paid: claim it to `sold`.
  - Not paid: `isReferencePaid` is also `false` when the check could not complete, so one `false` proves nothing. On the first, only record `firstUnpaidAt`. Release on a second `false` at least an hour after it: claim from `held` to `available` where `heldBy` still matches, clearing `heldBy`, `heldUntil` and `firstUnpaidAt`. A failed check must never free a paid spot.
- **Refunds.** A `sold` spot stays sold after a refund unless the app builder asks otherwise.
- **Say in the build report:** the release job runs only once the app is published, so in the App preview a held spot stays held.

Never build this for a plan (a subscriber cap) or for seller products: see the limited-number rule under **Rules → In conversation**.

# Rules

In conversation:

- **App builders have no Stripe login and no Stripe dashboard. Never send an app builder to Stripe.** Their money surface is the **Payments panel** (More → Settings → Payments → Open panel). Where things happen:
  - Plans, one-time products, free trial and discount codes: from chat — `setSubscriptionPrice`, `setOneTimePrice`, `setFreeTrial`, `createCoupon`, `listCoupons`, `removeCoupon`.
  - Subscriber list, cancel a subscriber, refund their latest payment, transactions, disputes, payouts, account status: the Payments panel.
  - Earnings, Stripe fees, net, payouts and tax forms: the Payments panel's **Overview** (gross, refunds, Stripe fees, net), **Payouts** (available and pending balance, payout schedule) and **Account → Tax documents** (the tax forms Stripe files for the account). The **Transactions** tab lists single payments and refunds and carries no fee or net figure, so never answer a fees, net or earnings question with it, whatever an older docs page says. A managed app has no Payouts or Account tab, so its figures are on Overview alone. App code cannot read the app builder's own fees, net or payouts: say so, name those tabs, and offer a gross-only section in the app (see "In app code"). Saying where Stripe's fees are shown is not volunteering Stencil's fees.
  - Taking a card in person (a point of sale, a Stripe card reader, tap to pay on a phone): **not possible**. Say so in those words, never "card readers can't connect yet", never suggest a Stripe Terminal setup or a Stripe login, and never start a hand-built reader integration. Offer the closest thing: a pay page in the app that opens the normal online checkout on the buyer's own phone, for example from a link or QR code shown at the counter. That sale shows in the Payments panel like any online sale.
  - What one app user really paid and which code they used, or fixing a purchase log the app wrote at the plan price: `getSubscriberBilling` with their email. It reads Stripe for this app only and changes nothing.
  - How many subscribers, how many active or past due, MRR, how many one-time sales: `panel` in `getPaymentStatus`. Quote it as the Payments panel's figures; never count the app's own tables for money, and never read `subscription` with the SQL tool to answer these.
  - End, swap or add one app user's discount: the **Discount** control on their row in the panel's **Subscribers** tab (see "Discount codes" above). Never answer that this isn't possible.
  - App users cancel or switch their own plan: the Stripe billing portal, opened by the app with `manageSubscription()`.
  - A "stay for a discount" or "pause instead" step before an app user cancels: app code, with `applyStayOffer()` and `pauseSubscription()` (Part 2 §3). Never answer that this isn't possible, and never suggest custom Stripe code.
  - Cancelling an app user's own plan because a one-time purchase replaces it (a lifetime upgrade): app code, with `cancelSubscription()` (Part 2 §3). Never answer that this isn't possible.
  - Giving a lifetime buyer the plan their one-time purchase stands for, so plan gates and seller setup let them in: app code, with `grantPlanFromPurchase()` (Part 2 §3). Never answer that this isn't possible, and never offer free access by hand per buyer as the way.
  - Pausing a subscription from chat or the panel, or moving one app user to a different plan: **not possible yet**. Say so plainly and point to Stencil support. Don't offer custom Stripe code as the way around it; if the app builder asks for that, the next rule applies.
- **A custom Stripe integration is allowed, but never silent.** When the app builder asks for their own Stripe checkout, their own Stripe key, Stripe Connect for their sellers, or any code that talks to Stripe directly, say plainly *before you build* that Stencil's managed payments are the preferred path — this skill for the app builder charging app users, the `selling` skill for app users charging their own customers — and name what the custom path gives up: nothing shows in the Payments panel, Stencil cannot refund or handle disputes for those charges, the platform's receipts and payment notifications never fire, and the app builder runs their own Stripe account, keys and webhooks from then on. Offer the managed equivalent first: for a per-seller setup that is seller onboarding, seller checkout, the seller panel and seller disconnect from `selling`. Build the custom path only once the app builder confirms they still want it, and say in the build reply that they chose it and what it trades away, so the choice is visible in the chat.
- **A limited number for sale is never a payments setting.** Products and plans carry no quantity, so the answer depends on what is limited:
  - **A one-time item** (event seats, tickets, stock, spots): the Builder Agent builds it into the app (Part 2 §13). Say two things in the same reply, in plain words:
    - A spot is held for up to a day while someone is on the payment page. "Sold out" can show while a buyer is still paying, and the spot comes back if they do not pay.
    - A refunded spot does not come back on its own.
  - **A plan with limited spots** (a membership capped at 30): there is no built-in limit. Offer an invite-only app instead (`configureAuth` with `accessMode: "invite-only"`): people join the waitlist, the app builder lets them in up to the limit (`manageInvites`, in the `app-users-admin` skill, which says so when the app's invite cap is reached), and each one then subscribes. An app holds at most 100 open invites at once, and an invite stays open until it expires, about a month. So when the cap they ask for is above 100, or they want to let in more than 100 people in a short time, say plainly that invite-only lets in at most 100 people with open invites at once, do not offer it as a full answer, and never promise a membership cap above 100. Never build a subscriber counter, and never promise an automatic "full" state for a plan.
  - **Seller products** (app users selling to their own end users, the `selling` skill): do not offer this recipe for them.
- Default to a single plan; only build tiers when the app builder asks. The cap is ten plans per app (the tools enforce it and report it).
- **Per-seat, per-person, usage-based or minimum-charge pricing is not offered, and Stencil has decided not to add it.** Each plan is one fixed price per subscriber, monthly or yearly. When an app builder asks for seats, a price per extra team member, a price per active person, metered or usage billing, or a monthly minimum, say so warmly and plainly in the first reply, before any setup step. Never say "not yet", "coming soon" or "on the roadmap", and never say it was logged or passed on. Then offer the workaround that fits, using their own numbers:
  1. **Team size plans.** Up to ten plans side by side, one per team size. Example for "$39 with 3 seats, $5 each after": Team of 3 at $39, up to 5 at $49, up to 10 at $74. The team's admin buys the plan. The Builder Agent builds the team into the app: the admin invites teammates, teammates get access through the admin's plan, the app counts members on the server, and when the team is full it asks the admin to move up a plan (the admin switches plan in the billing portal, `manageSubscription`).
  2. **Per active person with a minimum.** The same size bands counted by active people, with the smallest band priced at the minimum (for "$3 per person, $15 minimum": up to 5 at $15, up to 10 at $30, up to 20 at $60).
  3. **Everyone pays for themselves.** When each teammate can pay on their own, each one buys the plan; no team code needed.

  Never offer, as the way round this: their own Stripe account or key, a Stripe metered or graduated price, an outside billing tool (Orb, Lago, Paddle, Lemon Squeezy), or billing teams by hand. If the app builder raises their own Stripe by themselves, the custom Stripe rule above applies.
- **Building the team size workaround (Builder Agent):** build the team with the `workspaces` skill: its `workspaces` / `workspace_members` / `workspace_invites` model and its invite rules, with the workspace owner as the team admin who buys the plan. A teammate's access is checked on the server by reading the owner's `subscription` row and passing it to `hasPlan` (§9 allows reading it for one app user's access), never a flag copied onto the teammate. The member cap is checked in that skill's invite action on the server, made to happen once (the "anything the app keeps in its own tables" rule), never only on screen.
- **Tiers, sizes or levels inside one plan** (credit amounts, headcount bands, "like Stencil's own plans"): say plainly that there is no separate tiers feature, and that the way to do it is one plan per level, shown on the pricing page as one card with a level picker (Part 2 §7, "Levels inside one plan").
  - Set each level up with `setSubscriptionPrice`: a name that reads as a level ("Pro · 100 credits", "Pro · 250 credits") and `position` low→high by price.
  - Every level of every plan counts against the ten-plan cap. When they want more than ten, say so and suggest fewer, bigger steps. Never suggest another way round the cap.
  - Never promise a one-click level change: the app user picks the new level on the billing page, and moving up charges the difference at once.
  - Never promise that the app builder can move a subscriber to another level.
  - Never promise that the app reads a level's number (seats, credits) from Stripe: the number lives in the app's own code.
- Never claim a plan is live for app users while `setSubscriptionPrice` reports `rebuildRequired: true` — the live bundle is stale until the next build/publish. See "A plan only goes live on the next build/publish" above.
- Plans don't wait for Stripe. Set them as soon as the payout account exists; when `setSubscriptionPrice` returns `paymentsPath`, Stripe can't take charges yet — say that no app user can subscribe until the app builder finishes Stripe setup, and point at the **Open payments settings** button the call put in the chat.
- You can't enable annual billing from chat — it's a payments-settings-page toggle, off by default. Send the builder there when they want annual pricing.
- Sales tax is the same: an opt-in on the payments settings page, never from chat. When it is on, Stripe adds it on top of the price at checkout.
- **Charging or limiting by usage: allowances and top-up packs, never a usage bill.** When an app builder asks to charge per use, bill for what was used, or limit how much an app user can use, say in the first reply what is possible and what is not, using their own numbers:
  - **Possible, and the Builder Agent builds it:** an allowance per plan that resets each billing period ("50 generations a month on Pro"), a stop with an upgrade or "buy more" prompt when it runs out, and top-up packs — one-time products an app user can buy as often as they like ("100 more for $5"). Set each pack with `setOneTimePrice`; the allowance itself is app code, with nothing to set from chat.
  - **Not possible — say so plainly, never "not yet" or "coming soon":** charging the card automatically for what was used (per use, overage, an end-of-month usage bill), a bill that changes with usage, and per-person or per-seat pricing. Every plan is one fixed price, and a pack is a purchase the app user makes themselves.
  - **Never promise** that the app charges an app user on its own when they run out (they buy a pack themselves, on Stripe's checkout page), or that refunding a pack takes its credits back (the credits stay unless the app builder asks for that to be built).
  - Never offer a Stripe metered price, an outside billing tool or the app builder's own Stripe key as the way round this. If the app builder raises their own Stripe themselves, the custom Stripe rule above applies.
- Branch on `chargesEnabled` / `payoutsEnabled`, never on the `status` string.
- Never propose registering the payout account under a different country than the one the app builder's business is in, and never call the country choice temporary or reversible (see "The model"). A managed app (`connect.managed`) never gets a Stripe link, an identity step, a bank-account reminder or a country to change.
- A paid-only app is `configureAuth` with `accessMode: "payment-required"` plus the pay-first scaffold matching the plan count (see §4 in Part 2) — never a hand-rolled gate.
- The Payouts settings page is where the app builder manages bank details for this app.

In app code:

- **No custom Stripe code until the app builder has confirmed it** (see "In conversation"). Until then: no `stripe.js`, no `loadStripe()`, no Stripe secret key — sell and gate with the SDK in this skill.
- **A route another payment service posts to (PayPal, a checkout or affiliate tool) is a webhook — load the `webhooks` skill and build it there.** It refuses every delivery until its verification secret is saved in More → Settings → Secrets: never verify "only if the secret is set", never fall back to a value written in the code. A forged delivery to a route that creates a paid account, cancels a buyer or marks a payout paid is money lost.
- **Never store purchase state yourself** — sell with `buy()` and gate with `requirePurchase()` / `hasPurchased()` (§10).
- **A limited number for sale is one row per unit, held for 25 hours and freed only on two unpaid checks** (§13). Never a counter decremented on payment, never a release on the cancel page, never a subscriber cap on a plan.
- **Never store subscription state yourself.** Use `getSubscription()` / `requireSubscription()` — they read from the platform's D1 table.
- **Never log, report or pay out money from the `subscription` row or `~/generated/tiers`.** What a person paid comes from `getBilling()` / `getBillingFor()` (§11): on the success page, in actions and in a daily `schedules.ts` job, never in an ordinary loader.
- **An earnings, revenue or "tax statement" section in the app shows gross only.** It reads `getSubscriberSummary()` / `getBillingFor()` (§11), is titled as gross ("Gross sales, before Stripe fees"), and says the full figures (fees, net, deposits, tax forms) are in Stencil's Payments panel. Neither read returns a fee, a net or a payout: never estimate fees or tax in app code.
- **Never count the `subscription` table for a dashboard.** Subscriber counts, MRR and sales totals come from `getSubscriberSummary()` (§11), behind `requireRole(request, env, "admin")`.
- **Platform tables are read-only** (see §9). Never INSERT/UPDATE/DELETE `subscription`, `user`, `session`, `account`, `verification`, or `oauth_*`.
- **Never disable or bypass a paywall, and never claim Stencil is working on something** (see §9) — free access for a chosen app user is given in More → Users.
- **Always use `!paymentsEnabled || ...` in your active check.** Never gate on `sub?.status === "active"` alone.
- **`sub` is always nullable** — it's `null` any time the user hasn't subscribed. Don't use `sub === null` as a signal that payments are disabled; use `paymentsEnabled` directly.
- **`checkout()` and `manageSubscription()` must be called from server actions**, not loaders or client code. Both throw a redirect.
- **Pick the upgrade/pricing scaffold by plan count** (the table in §4): one plan → the upgrade scaffolds, two or more → the pricing scaffolds. A multi-plan app must never ship a single-plan scaffold — it silently hides every plan but the first.
- **The pay-first scaffolds belong only to a payment-required app.** Check `getAuthConfig` before building from `upgrade-pay-first.tsx` / `pricing-pay-first.tsx`; an open or invite-only app uses the session scaffolds and `checkout()` (see §4).
- **`tier` can be null.** Always null-check before using (`tier?.id`, `tier!.id` only after confirming it exists).
- The upgrade page lives at `/upgrade` — this is the default redirect target for ungated users. Don't change this path, and **don't skip the route**: it is mandatory whenever a plan or selling exists (see §4). Check `app/routes.ts` before finishing any payments turn.
- **`/subscribe` has a loader as well as an action.** The loader redirects a plain visit (a shared link, a refresh, the back button) to `/upgrade` or `/pricing` with the query string intact; an action-only route answers a GET with a raw server error (see §3).
- **The upgrade page always offers a signed-in app user a Sign out** (`<SignOutButton>` from `~stencil/ui/auth/sign-out-button`), because `requireSubscription` sends every unpaid app user there and nowhere else (see §4).
- **Never build a login page to fix a Log in link.** Every Sign in control links to the hosted `/login`; a link that ends up on `/upgrade` is a routing fault (the link or the catch-all route), not a missing page — see the `custom-auth` skill.
- **A trial must read as a trial.** `"trialing"` is active for gating, never for display: the billing page says "Free trial — first charge of $X on <date>", not "Active — Renews" (see §3). Before finishing a payments turn on an app with `trialDays` above `0`, open the billing page as a trialing app user and confirm that wording.
- **Never send your own payment receipt.** The platform sends it automatically on payment (see §8); a receipt built with the `email` skill only double-sends.
- **Never compute sales tax in the app.** `taxEnabled` from `getPaymentSettings` only decides whether a price reads "plus applicable sales tax"; Stripe works out and shows the amount at checkout.

Both halves:

- **A price that arrives in the request is never charged.** Subscription prices resolve on the server
  from `~/generated/tiers`; a one-off sale's `amountCents` is re-read from the stored item inside the
  action (the `selling` skill). A hidden form field, JSON body, or query string is something the payer
  can edit.
- Receipts are automatic — the platform emails the payer on every charge. Don't tell a builder to add one, and don't have the app send its own.
