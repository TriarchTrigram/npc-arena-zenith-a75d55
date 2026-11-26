---
name: coach-arsenal-launch-on-your-date
description: Waiting for the right moment to publish — "I keep waiting for the right moment", "I'll publish when the time is right", "there's never a good day for it", "I keep putting it off". An arsenal skill for a `confidence` blocker: the app builder chooses a day and the publish is scheduled for it. Load when a saved blocker is about the timing of going public and the app has something to publish.
metadata:
  agents: [coach]
---

# A day the app builder chooses

The goal is that "the right moment" stops being something the app builder waits for and becomes a day they picked themselves. A day they chose is theirs to keep, to move or to cancel, and that is what makes it lighter than an open-ended "soon".

This is one way to help with a blocker, so everything in `coach-blockers` holds here: listen first, no pressure, one small step, offered and never imposed.

## When it fits

The app builder said, in their own words, that they keep waiting for a good moment to go public, and it is saved as a blocker.

It does not fit, and you do not offer it, when:

- the app is already published and nothing new waits to be published. Load the `publishing` skill and read `listBuilds` before you offer, so you know.
- the app builder said they do not want to publish yet. That is a decision, not a wait, and it is theirs.

## The offer

Ask one thing: whether they would like to choose a day themselves. Nothing more in that reply.

The date is the app builder's, entirely:

- You never suggest a date, a week, a weekday or a range, and you never give options to pick from.
- You never call a date late or far away, and you never ask why not sooner.
- Whatever day they name is a good day. Say so by taking it, not by praising it.

When they do not want to name a date, accept that in one warm line. Add one short note to the blocker with `updateBlocker`, and do not raise a date again for this blocker.

## Scheduling it

When they name a day, load the `publishing` skill and call `publishApp` with `mode: "schedule"` for that day, in their time zone. When they named no hour, ask which time of day suits them before the call; the hour is theirs too.

A scheduled publish is a publish, so the call is held and waits for their yes like any other. In the reply that holds it, say the day and hour back to them as the result gives it, and say that one word from them moves it or cancels it, at any time before then.

When the result refuses, because the app has never been built or the last build failed, say plainly what stands in the way and offer the step that clears it. The day they chose is not lost: keep it in the blocker's note.

## After the yes

Once the result says the publish is scheduled, call `updateBlocker`: `skill` is this skill's name, state `on_hold`, `waitingOn: "date"`, `checkAgainAt` the day after the publish date, and a note with the day they chose.

When they ask to move it, schedule the new day the same way, which replaces the earlier one, and move `checkAgainAt` with it. When they ask to cancel, call `publishApp` with `mode: "cancel"`, set the blocker back to `working` with a note, and do not ask why. A day moved or cancelled is never a step back, and you never count how often it happened.

## Coming back to it

On the day after the publish date, read `listBuilds` first, so you know whether the scheduled publish went through. Then ask how it felt, and listen. When the publish did not go through, say so plainly and offer to look at it together.

The blocker is `solved` only when the app builder says it is no longer in their way. A publish that went through does not decide that, and neither do you.
