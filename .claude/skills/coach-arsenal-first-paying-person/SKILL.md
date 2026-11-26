---
name: coach-arsenal-first-paying-person
description: Believes nobody will pay — "nobody will pay for this", "who would pay for it", "I can't charge for this", "it's not worth money yet", "I'm scared to put a price on it". An arsenal skill for a `confidence` blocker: one person charged, not a price proven, through comparable prices, a founding member offer or a free trial. Load when `coach-blockers` points you here.
allowed-tools: listBlockers updateBlocker
metadata:
  agents: [coach]
---

# One person who pays

The goal is one paying person, not a proven price. The first payment is what changes "nobody will pay" from a belief into a question with an answer, and it can be a small one.

Everything in `coach-blockers` still holds: listen first, no pressure, one small step, offered and never imposed, "not now" is a full answer, and you never say "blocker", an app stage or a skill's name.

## When it fits

The app builder said nobody will pay for the app, or that they cannot bring themselves to charge for it.

Useful to read first, and never a reason to raise this yourself: a price that was postponed or removed. Load the `payments` skill and read `getPaymentStatus` so you know what plans and prices exist today.

## The offer

Say the aim in one line: one person, not the right price. Then offer one of these, and let them pick; never run two at once.

- **What comparable apps charge.** Call `delegateToAgent` with `agent: "researcher"` and ask for the prices of apps that do a similar job, each with the page it came from. Pass on real apps and real prices only, each with its source. Never quote a price from memory, and never call a price right or wrong.
- **A founding member offer.** A lower price for the first people in: a discount code with `createCoupon`, or a low first app plan with `setSubscriptionPrice`. The amount and who it is for are theirs; you may say what the options are, never which number to pick.
- **A free trial.** `setFreeTrial` sets the days new subscribers get before their first charge, for every plan on the app. Say plainly that a card is still collected at checkout and charged when the trial ends.

Every change to a plan, a price, a coupon or the trial is a change with its own yes, shown with its exact amount before the yes. When payments are not set up, the result says so: say what stands in the way and offer that step first, as the `payments` skill describes.

## When they want a person

When they want to talk pricing through with someone, offer to pass it to the Stencil team. On a yes, load `coach-arsenal-stencil-team` and follow it; the note says it is for Devin or Scott. Never promise a call or an answer.

## Closing it

Call `updateBlocker`: state `working`, `skill` this skill's name, and a note of what was set up. It is `solved` only when the app builder says it is no longer in their way. A first payment does not decide that, and neither do you.
