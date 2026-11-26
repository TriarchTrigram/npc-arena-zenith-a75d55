---
name: fixing-bugs
description: >
  The procedure for a turn about something broken: "it doesn't work", "I can't see it",
  "it shows an error", "still broken", "glitchy", "crashes", "the wrong thing is saved",
  "accounts see each other's data", an "Unexpected Server Error" card. Load it first on any
  such report, including one mentioned in the middle of a request for something new, and on
  a repeat report ("still", "again", "not fixed"). Covers finding the symptom behind a vague
  report, reading a server error card, confirming the failing case again after the build,
  repeat reports, and repairing the data the bug already saved. Not for a new feature or a
  change to how something looks.
allowed-tools: appErrors dbExecute
metadata:
  agents: [builder]
---

# Fixing something that is broken

Your main instructions carry the rules that hold on every turn: find the cause before you edit,
`appErrors` first on "doesn't work", a change that type-checks is not a fix, claim only the paths
you checked, name only causes you checked this turn, and never claim a Stencil bug. This skill
is the procedure around them. A report about the Published app as app users hit it ("it freezes
on my phone", "since yesterday") also gets `investigate-a-report`, which reads production's
records.

## Runtime errors first

Call `appErrors` before you form a theory or edit a file. Quote what it returned in your
reply — the error text and the route — or say plainly that nothing is recorded. A recorded
stack trace names the file and line; it is where the turn starts, not something to find
after several rebuilds.

## A vague report needs the symptom before a fix

When the report names a feeling or a general symptom ("glitchy", "buggy", "crashes", "acts
weird", "doesn't work properly") but no screen, element or steps, and the message carries no
screenshot, recording, drawn region or picked element, you do not yet know what to fix. Climb
this ladder and stop at the first rung that shows the symptom:

1. `appErrors`, as above.
2. When the report names a flow a browser run could reproduce ("adding a client doesn't
   save"), run that flow with `dev-tools verify` through the `browser-verify` skill — a
   reported behaviour bug in a specific flow is one of the two things that earn a run. When
   it is about how a page looks, `dev-tools screenshot` that page. (In a turn whose tool list
   has `mcp__dev__verify`, these commands are the `verify`, `screenshot` and `build` tools.)
3. If neither `appErrors` nor the browser shows the symptom they described, do not edit or
   build. Reply in one or two plain sentences asking for a screenshot or a screen recording
   of it and which screen it happened on.

Something else you found broken on the way may be fixed, but never as the answer to their
report: say you have not seen their problem yet. Never say the complaint is fixed when you did
not reproduce or trace it.

On a turn nobody is watching — a headless turn, an auto-run (the request opens with
"Auto-run:"), or a "Run build now" click from the task list — do not ask: report that the
symptom could not be reproduced instead, and still claim no fix. If the app builder already
answered, skipped, or said they have no screenshot, do not ask again: make a best effort and
say what was and was not verified.

## A server error card names the page, not the cause

An auto-detected card reading "Unexpected Server Error", or a bare status such as "500
Internal Server Error", means the server threw while loading the page named in its `route`;
the framework strips the stack before the browser sees it. When such a card names a route but
carries no stack, call `appErrors` with `kind: "backend"`, `environment: "preview"` and that
route before anything else — the recorded entry holds the real message and stack. A thrown
response (a deliberate 500 or 4xx) leaves no backend entry; then read that route's loader or
action.

## Check the failing case again after the build

If the bug left something you can read, read it again after `dev-tools build` and confirm it
changed — a sent email in the app's own log, a saved row, a stored or computed value, read
with `dbExecute` or by reading the file. The evidence that showed you the bug is the evidence
that shows it is gone. A bug a browser run reproduced before the fix is confirmed the same
way: the same `dev-tools verify` plan again after the build, and only a pass says it is gone.
If only the app builder can trigger the path (a real send, an approval, a payment), say
exactly what to try and what they should see. Do not say it is fixed.

## A repeat report means the last fix was wrong or incomplete

When the app builder reports the same symptom again ("still", "again", "not fixed"), start by
saying to yourself what the previous turn changed and why it did not cover this case. Before
changing anything, list every path the symptom can travel — for email that means sent by hand,
from a template, through a workflow, after an approval step, and scheduled. Then check each
one.

**Stop after the third failed turn.** If the same complaint comes back a third time with no
change in outcome, do not try another "completely different approach", and never rebuild a
route, screen or control the app already has — that is a defect, not a fallback. Stop
building. List what you have ruled out, say what is still unknown, and ask for the one thing
that would settle it: a screenshot, the exact error text, or which screen they were on.

## Fix the data the bug already saved

A code fix stops new bad data. It does not repair rows the bug already wrote — a saved
per-client email copy, a cached value, a wrong total. Find those rows with `dbExecute` and
repair them, or tell the app builder plainly which items still carry the old version. The
rules on platform-owned tables still hold: never write `subscription`, `user`, `session`,
`account`, `verification` or `oauth_*`.

## "Accounts see each other's data"

The builder preview is automatically signed in as one shared test user — everything done
there happens as that same account, whichever one the app builder believes they're using.
When the complaint involves accounts mixing or wrong data, first have them test on the
published app in a regular or private/incognito window, signed in for real — not inside the
preview. That one test resolves most of these reports.
