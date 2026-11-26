---
name: investigate-a-report
description: >
  Read what production already recorded before fixing something the app builder reports as
  broken in the running app: "it freezes", "it's slow", "taps do nothing", "the button does
  nothing on my phone", "the AI feature fails", "app users see an error", "it stopped working
  since yesterday". Use on any build request that describes a problem, a symptom or an error
  in the app as it runs, before any code is changed. Not for a request for a new feature or a
  change to how something looks.
allowed-tools: getScoutsFeed appErrors listEntities queryRecords
metadata:
  agents: [builder]
---

# Investigate a report before fixing it

A report describes what the app builder saw; production recorded what happened, on Needs you,
the Errors feed, often the app's own log tables, and git. A fix built from the description
alone is a guess that comes back as "still broken". Do these steps before you edit a file.

## 1. Pin down when and where

From the request and the conversation, settle three things: the time it happened or the window
("since yesterday", "this morning"; no time given means the last 7 days), the screen or route,
and who was affected — the app builder in the preview, app users on the Published app, one
person or everyone, a phone or a desktop.

## 2. Needs you

Call `getScoutsFeed` and follow the `app-scans` skill's "Symptoms: check Needs you first": a card
for the same page or kind of problem is the lead, and `unavailable` means a source is missing,
not clean.

## 3. Production Errors

Call `appErrors` with `environment: "production"` and a `since` that covers the window, then
once more with the `route` from step 1 if the first read is crowded. Read for:

- the route from step 1, and anything repeated many times inside the window;
- "Taps are not responding (buttons did nothing)" entries: their stack is a detail object with
  `target` (the control tapped), `path`, `scrollY`, `standalone` and `openDialog`. `scrollY`
  above 0 with `standalone: true` is the window scrolled behind a fixed element; the
  `phone-app-shell` skill says what that fix is;
- `kind: "network"` entries on the app's AI calls, and backend entries behind an AI feature
  that "fails";
- frontend console errors in the same minutes.

A clean preview says nothing about what app users hit. Read production even when the preview
looks fine.

## 4. The app's own diagnostics

Many apps keep a log of their own: a freeze report, error log, events or feedback entity. Call
`listEntities` and look for one. If it exists, `queryRecords` it (`{ entitySlug: "<table slug>", limit: 100 }`) for the window, newest first,
and read the rows the way you read Errors: which screen, which control, what state (keyboard
open, scrolled, offline).

## 5. What changed

Run `git log` in the workspace for the window. If the problem started after a particular build,
that commit's files are the first suspect, and its diff is what to read before anything else.

## 6. Fix what the evidence points to

Change the code the evidence names, not the code the description suggests. If steps 2 to 5
recorded nothing, say so in your reply and fix from the description as you would have.

## 7. Open your reply with the evidence

The first line of your reply to the app builder is one plain sentence on what the records
showed: "Every dead tap was in the comment box with the keyboard open", "Production has 31
timeouts on the AI summary call since Tuesday, none before", "Nothing is recorded for the feed
page this week, so this fix is from your description". Then what you changed.
