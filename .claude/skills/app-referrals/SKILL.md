---
name: app-referrals
description: A referral, refer-a-friend, affiliate, partner, ambassador or invite-rewards program INSIDE the app builder's own app — their app users or outside partners bringing people to the app. Use when the app builder says "add a referral program", "give each member an invite link", "refer a friend and get a free month", "track which partners send me clients", "affiliate program", "ambassadors", "partner discount codes", "commission for referrals", or an app user wants to run their own affiliate program for their end users. Covers naming the shape, tracking who came from whom at sign-up, what rewards the platform can and cannot apply, and recording commissions that are paid outside the app. NOT Stencil's own referral programme for app builders (credits, letters, Stencil Partner, "how do I get paid for referring people to Stencil") — that is `referrals-and-billing`.
allowed-tools: createCoupon listCoupons removeCoupon
metadata:
  agents: [chat, builder]
---

# Referral programs inside an app

## When to use this skill

Load it whenever the app builder wants people to bring other people to **their** app and get something for it: a referral or refer-a-friend program for app users, an affiliate or ambassador program, a partner who shares a discount code, a commission on referred sales, or a tracker of who sends them clients. Load it before answering "can my members refer friends?" or "can I pay partners a commission?" — the honest answers below depend on what the platform ships, and the app's own source will not show that.

Not this skill: what Stencil pays the app builder for referring other app builders (`referrals-and-billing`), charging app users (`payments`), app users charging their own customers (`selling`).

## Name the shape first — and ask if it is unclear

"Referral program" means three different builds. Say which one you are building before you build it, and ask the app builder when the request could be more than one:

| Shape | Who refers | What is tracked | Works today |
|---|---|---|---|
| **Referral partner tracker** | Outside people who send the app builder clients | A partner, who they sent, what each is worth so far, check-ins | Fully — records and a dashboard, no payments code |
| **Refer a friend** | Each app user, with a personal link | Which sign-ups came through whose link | Attribution and a discount for the new person — yes; an automatic reward for the referrer — **no** |
| **Partner discount codes** | A named partner shares a code with their audience | Sign-ups and purchases under each code | Yes, on the app's discount codes (`payments`) |

A request that mixes them ("partners get a code and my members get a link") is two of these built side by side, sharing the attribution rule below.

## Shape 1 — Referral partner tracker

Plain records, nothing special: a `partners` table (name, contact, status, notes), a `partner_referrals` table (partner, client name, date, `valueCents`, status) and a `partner_checkins` table if they want follow-ups. The dashboard groups referrals by partner: count, total value, last check-in. `valueCents` is what the app builder types in, since these clients are not paying through the app.

Do not add payments, codes or hooks to this shape. If the app builder later wants partners to share a code, that is Shape 3 on top.

## Shape 2 — Refer a friend, the one correct way

### Data

- **The referrer is the durable record.** A `referrers` table: `userId`, `code`, `createdAt`. The code is a property of the referrer row — unique, generated when the row is issued, checked for collisions **at issue time**. Never look a code up at redemption and hope.
- **A `referrals` table is the only source of truth for who came from whom.** One row per referred sign-up: `referredUserId` (one row per app user, ever), `referrerUserId` (nullable), `partnerId` (nullable, Shape 3), `code`, `createdAt` — exactly one of `referrerUserId` and `partnerId` is set. Every count the app builder or a referrer sees is a count of these rows. Never derive "referred sign-ups" from all sign-ups, and never reconstruct attribution afterwards by joining sign-ups back to codes — that is how commission gets paid on people nobody referred.
- Access rules: app users read their own `referrers` row and the `referrals` rows where `referrerUserId = me`; nobody creates a `referrals` row from a screen — only the sign-up hook writes it, with `system(env)`.

### Issue the code once

```ts
// app/routes/app.invite.tsx — loader; the code is created the first time the referrer opens the page
const db = await data(request, context.cloudflare.env);
const [mine] = await db.from("referrers").list({ where: { userId: db.me }, limit: 1 });
if (mine) return { code: mine.code };
for (let attempt = 0; attempt < 5; attempt++) {
  const code = newCode(); // 8 upper-case letters and digits from crypto.getRandomValues
  const [taken] = await db.from("referrers").list({ where: { code }, limit: 1 });
  if (taken) continue;
  const row = await db.from("referrers").create({ userId: db.me, code });
  return { code: row.code };
}
throw new Error("could not issue a referral code");
```

The personal link is the app's URL with `?ref=<code>`. Show the link with a copy button; never make the referred person type the code.

### Capture `?ref=` on the client, in the app's own cookie

The platform's sign-up attribution (`~stencil/auth/attribution.ts`) captures `utm_*` tags and the outside referrer only — it does not capture `ref`, and `app/.stencil/` is not the app's to edit. The app sets its own cookie from `app/root.tsx`:

```tsx
// app/root.tsx — inside the component that renders <Outlet />. First touch wins, like the platform's own stash.
useEffect(() => {
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref || document.cookie.split(/;\s*/).some((c) => c.startsWith("app_ref="))) return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  // SameSite=Lax so the cookie survives the Google sign-in popup and hosted checkout round trips.
  document.cookie = `app_ref=${encodeURIComponent(ref.slice(0, 32))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${secure}`;
}, []);
```

### Record attribution at sign-up, in a `user.create.after` hook

The app's `app/auth-hooks.server.ts` default-exports Better Auth `databaseHooks` (see `~stencil/auth/hooks.ts`; the `custom-auth` skill covers the file). The hook runs once, inside the sign-up, for every login method — password, Google, magic link, one-time code — and its context carries the request, so the cookie is readable there. This is the only place a `referrals` row is written.

**If `app/auth-hooks.server.ts` already exists, read it first and add this `user.create.after` into the existing export** — merge it into an existing `user.create` branch if there is one, keeping whatever that branch already does. Never replace the file: apps with custom auth flows keep their own hooks there, and overwriting it silently drops them. The snippet below is the whole file only for an app that has no hooks yet.

The same hook serves Shape 3: a code that belongs to no referrer is looked up on `partners`, and credits only a partner whose status is active. Leave the partner branch out of an app that has no partners.

```ts
// app/auth-hooks.server.ts
import type { AuthHooks } from "~stencil/auth/hooks";
import { system } from "~stencil/data";

function refFromCookie(headers: Headers | undefined): string | null {
  const match = headers?.get("cookie")?.split(/;\s*/).find((c) => c.startsWith("app_ref="));
  return match ? decodeURIComponent(match.slice("app_ref=".length)).slice(0, 32) : null;
}

const hooks: AuthHooks = (env) => ({
  user: {
    create: {
      after: async (user, hookCtx) => {
        const endpoint = hookCtx as { request?: Request; headers?: Headers } | undefined;
        const code = refFromCookie(endpoint?.request?.headers ?? endpoint?.headers);
        if (!code) return;
        try {
          const db = system(env);
          const [referrer] = await db.from("referrers").list({ where: { code }, limit: 1 });
          if (referrer) {
            if (referrer.userId === user.id) return; // self-referral
            await db.from("referrals").create({ referredUserId: user.id, referrerUserId: referrer.userId, code });
            return;
          }
          // Shape 3: the status filter is what keeps an ended partner's code from crediting anyone.
          const [partner] = await db.from("partners").list({ where: { code, status: "active" }, limit: 1 });
          if (!partner) return; // unknown or retired code
          await db.from("referrals").create({ referredUserId: user.id, partnerId: partner.id, code });
        } catch (err) {
          // A lost referral must never turn a sign-up into an error.
          console.error("[referrals] attribution failed:", err);
        }
      },
    },
  },
});

export default hooks;
```

Rules the hook enforces, and the app must not undo elsewhere:

- **Self-referral is ignored.** A referrer opening their own link creates nothing.
- **Unknown or retired codes create nothing.** No "pending" row to fix up later. A partner code credits its partner only while that partner's status is active.
- **One referral row per referred app user**, written at sign-up. A later purchase, renewal or login never creates another.

### Counts

"You referred 4 friends" and the app builder's referral dashboard both count `referrals` rows (grouped by `referrerUserId`), optionally joined to `subscription` for "of which paying". Never count all sign-ups, never count cookies, never count link clicks as referrals.

## Shape 3 — Partner discount codes

A partner is a `partners` row (name, contact, `code`, status). The code is one of the app's **live discount codes**, created with `createCoupon` for that partner (one code per partner, so redemptions are attributable); `listCoupons` is the source of truth for whether it is live — the partner row never claims that on its own. The partner shares a link with `?ref=<code>`; the cookie and hook above attribute sign-ups the same way — the hook's partner branch looks the code up on `partners` with `status: "active"` and writes the `referrals` row with `partnerId` and no `referrerUserId`, so a code never credits a partner the app builder has ended. Checkout pre-applies the code under the `payments` rules. What each partner is owed, if anything, is the owed ledger below.

## Rewards — say what is automatic and what is not

**For the referred person: a discount works today.** Create one discount code with `createCoupon` (the `payments` skill has the terms), and have the subscribe action pass it as `promoCode` so checkout opens with it applied. Follow the `payments` rules for pre-applying: name the applied code on the page, offer "Use a different code", and do not pre-apply at all when the app has more than one live code (`listCoupons`). Never re-implement the discount in app code — a price the app computes itself is not what Stripe charges, and the mismatch fails silently.

**For the referrer: nothing automatic exists today.** There is no way for app code to put a free month, a discount or a credit on *another* app user's subscription. `applyStayOffer` works only inside the app user's own session, once per subscription, and never on top of a discount they already hold — it is not a reward mechanism. So before you build, tell the app builder plainly:

> A free month for the referrer can't be applied automatically yet. What works today: the app shows you who has earned a reward, and you apply it by hand from the Subscribers tab of the Payments panel.

Build that: an admin-gated list of referrers with a reward earned and not yet applied, which the app builder marks applied after putting the discount on that subscriber in the panel. Label it accordingly in the app ("Reward earned — we'll apply it to your next bill"). Never show "free month applied" for something the platform did not apply.

**Do not offer the referrer a discount code as the reward.** A discount code is created with `createCoupon`, never by the app while it runs, so a "referrer code" is one shared code — and the payment page takes a live code from anyone who types it. Every referrer, and anyone they pass it to, could redeem it without having referred anyone. The same holds for the new person's discount above: it is an ordinary public code, so say so when the app builder expects only referred people to get it.

**A reward that depends on the referred person paying is based on what they actually paid.** Read it with `getBillingFor` from a scheduled job or an admin-gated action, store `invoiceId` and `amountPaidCents` in the app's own table, and compute from that table — never from the plan's list price, which a discount code makes wrong (`payments` §11). A referred person on a paid plan the app builder placed at no charge comes back `complimentary` with no payments: nothing was earned.

## Cash commissions — not possible today; a ledger is

The platform does not move money to app users or outside partners, and app code cannot either. If the app builder wants commissions, say that first, then offer what the app *can* do: an **owed ledger**.

- One `commission_events` row per earning event, written from the stored payment record (`invoiceId` or `orderId`) — **the row's id is that key**, so a success page loaded twice, a retried job or a double submit cannot create two payable rows (`onConflictDoNothing()` on Drizzle, or a `list` for the key before `create` on the data SDK).
- Amount from `amountPaidCents`, not list price. Refunds reduce what is owed; read `refundedCents` on the next run.
- A status of `owed` / `paid_outside` that only the app builder flips, from an admin-gated action. Label it everywhere as "paid outside the app". The app never marks a commission paid on its own, and never shows a partner "payout sent".
- Tell the app builder that real payouts from inside the app are a tracked request on Stencil's side, without promising a date.

## Two levels — an app user running their own affiliate program

When the referrer is an app user who sells to their own end users (the `selling` skill), the same rules apply one level down:

- Attribution: the same `?ref=` cookie, and a row written where the end user is recorded — at sign-up through the hook if the buyer gets an account, or on the order when a guest buys.
- Discounts: the app sets the price it passes to `sellerCheckout` as `amountCents` from the stored item, so an affiliate discount is applied on the stored price before checkout, server side, and recorded on the order.
- Payouts to the affiliate: the same limit as above — an owed ledger the seller settles outside the app.

## Never

- Count sign-ups, clicks or cookies as referrals — only `referrals` rows.
- Reconstruct attribution after the fact by matching sign-ups to codes.
- Compute a reward or commission from the plan's list price.
- Imply a referrer reward is automatic, or show one as applied when the platform did not apply it.
- Put a discount code meant for a chosen group (a reward, a private offer, a partners-only deal) in app code or in anything every visitor receives — a page, a strings file, a loader's data, an email sent to everyone — or hand one shared code to several people as a reward. Checkout takes a live code from anyone who types it.
- Keep a "live" partner code the app validates itself: the partner's code is one of the app's discount codes, and when the deal ends the Chat Agent takes it down with `removeCoupon` in the same step the app marks the partner inactive.
- Send the app builder to Stripe. Their money surface is the Payments panel.
- Edit `app/.stencil/` to capture `ref` — the app's own cookie and hook do the job.
- Replace an existing `app/auth-hooks.server.ts` — read it and merge the `user.create.after` into it.
