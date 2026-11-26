---
name: browser-verify
description: Drive the app's private preview in a real browser to check that a flow works, when the app builder asked in this turn to check that a specific flow works ("can you check sign-up works?", "does adding a client save?", "test it", "verify it", "make sure the checkout goes through"), reported a behaviour bug in a specific flow that a run would show or confirm ("adding a client doesn't save"), or when this turn's build changed a state that only shows after a click, a form or a tap and the post-build screenshot's critique read "cannot tell from a still" for that state. Also read it before you reply whenever a post-build screenshot read "cannot tell from a still" for any reason: it says which further look can settle the ask. Never to explore the app, never on a first build, never on a headless turn (the command refuses), never by seeding the preview account's data instead. Appearance is `dev-tools screenshot`'s job.
metadata:
  agents: [builder]
---

# Browser verification

`dev-tools verify <plan.json>` opens the deployed preview in a real browser, signed in as the
app's verify user, and walks a plan of plain-language steps. A separate decision model chooses
which control to use for each step and judges each checkpoint from the page's text; what it
cannot settle from text goes to a vision judge. The app builder watches the session live in the
App preview while it runs. You read the verdict and the stills, not the browser.

In a turn whose tool list has `mcp__dev__verify`, the command is that tool: pass the plan
object as its `plan` argument instead of writing a file, and read `dev-tools build` and
`dev-tools screenshot` below as the `build` and `screenshot` tools. `dev-tools` in the shell
refuses to run in such a turn.

This is the flow run. Looking at a page after a build — the critique of what is on screen at
desktop and phone width, and measuring one element for a layout ask — is `dev-tools screenshot`,
which runs on the same browser but needs no plan and no asking: your main instructions
(Shipping your changes) say when to run it.

## Gate — run it only when ALL of these hold

- **One of three reasons.** Either **the app builder asked, in this turn, to check that a
  specific flow works** — "can you check sign-up works?", "test that adding a client saves",
  "verify it", "make sure the checkout goes through" — or **reported a behaviour bug in a
  specific flow** that a run would show or confirm: "adding a client doesn't save", "the
  filter does nothing", "sign-in loops back" — or **this turn's build changed a state the
  screenshot cannot reach**: what you changed only shows after a click, a form or a tap (a
  panel or dialog a button opens, what a submitted form shows, an animation an action
  triggers, a step behind a sign-up or a tap), and the post-build screenshot's critique read
  "cannot tell from a still" for that state. The screenshot's expect line names the state
  behind the action (the panel, the result page), never the control that opens it: `ASKED
  FOR: visible` on the button settles nothing about the panel and is not this reason. That
  third reason is the **unasked run**: one run, on just that state, with at most five steps,
  and the rules below for it. The flow
  has to be nameable: a form that creates or edits a record, sign-in or role gating, search,
  filters, sorting, pagination, a wizard or checkout-like sequence, a state that only appears
  after an action.
- **These are not reasons for a run:** a request in an earlier turn, a change the screenshot
  already confirmed with `ASKED FOR: visible`, a change to a page that shows without any
  action, "is my app secure or accessible?" (that is `app-scans`), "does it look right?"
  (that is `dev-tools screenshot`), a vague "it's buggy" with no flow named (ask `appErrors`
  and then for the symptom, as the `fixing-bugs` skill says). If you are unsure whether they
  asked, they did not; if you are unsure whether a still can see the change, screenshot
  first and let its critique decide.
- **Never reach the state by changing the preview account's data instead.** Inserting,
  editing or deleting a row for the preview user to skip the click (a profile so onboarding
  is skipped, a record so a result page has content) changes what the app builder's App
  preview shows and is not a check. The run is how a state behind an action is reached; a
  state it cannot reach is reported as unverified.
- **The App preview is deployed.** The run drives what is deployed, so "check that X works"
  qualifies with no change in this turn; a turn that changed the flow builds first. If the
  command says the App preview was deployed before verify sign-in existed, emit
  `[STATUS: Rebuilding the preview so the check can sign in]`, run `dev-tools build` (it
  deploys the preview with the current sign-in code; no app code changes) and then run the
  check once more; in a turn that builds anyway, run it after that build. The status line
  is what the app builder sees while it happens; say it again in your reply, so they know
  the preview was rebuilt so the check could sign in. Never sign in as the preview user
  instead.
- What they want checked is **behaviour**, not appearance. Appearance is `dev-tools
  screenshot`'s job and stays so.
- **Not a first build. Not a headless turn** — an auto-run (the request opens with
  "Auto-run:"), a "Run build now" click from the task list, any turn nobody is watching. The
  command refuses on such a turn, because no conversation is behind it; do not plan one.
- **Runs per turn.** One run to reproduce a reported bug before the fix, one to confirm it
  after the build, and one more if the confirm run was not a pass and you fixed again (verify,
  fix, build, verify). An unasked run is one run after the build, plus one more only if it
  failed and you fixed and built again. **Hard ceiling: three runs in a turn.** `dev-tools
  screenshot` is not counted. If the last run is not a pass, report exactly what failed and
  stop.

Never on a question turn. Never to explore the app or "see what is there". Never for a change
the still can judge. A run takes minutes and the app builder watches it live: an asked run is
theirs, and an unasked one is spent only on the one state your build put behind an action.

## When the screenshot reads "cannot tell from a still"

"Not visible" and "cannot tell" are two different findings. Never treat one as the other.

- **"Not visible": the check looked where the change should be and did not find it.** The
  change is not on the page. Fix it once and build, or say plainly that it did not land. The
  warning over your reply is right, and nothing below softens it.
- **"Cannot tell": that one still could not show the change.** It says nothing about whether
  the change landed. Left as it is, it puts the same warning over your reply as a real miss,
  and the app builder re-checks or re-asks for work that is already done. So before you
  reply, look once more in the way that can see it, with the same expect line, word for word:
  - **"below the still"**: the same screenshot with the full-page option.
  - **One element** (a photo, a label, a heading's style, a line in the footer): the same
    screenshot with a focus selector on that element. For something you removed, focus the
    section it sat in (the footer, the card), so the close-up shows it is gone.
  - **Behind a tab, a click or a tap** (the cards on a tab, a tray a button opens): the
    unasked run from the gate above.
  - **A comparison with the page as it was** (bigger, moved, more even): the measure
    option, and only when a measurement was taken before the build. Without one, no further
    still settles it.
  - **Nothing a still of the loaded page can show** (how a link behaves, timing, what a
    route answers, a code-only change such as an accessibility attribute): no further
    screenshot. Use the proof or the non-visual tag your main instructions describe.
- **One further look per ask**, inside the check time, and never a second one of the same
  kind. If it reads "visible", the ask is confirmed. If it reads "not visible", the first
  rule applies.
- **Still "cannot tell", or no look can reach it:** your reply says what you changed and
  exactly what the app builder should check, in plain words ("open the Charge tab: it should
  show the battery card and five level pills"). Do not call the work unverified, and do not
  say it "may not have landed" or "did not land": those words are for "not visible". Do not
  say you saw or confirmed it either.
- **A code-only change needs no made-up visual ask.** When nothing new should appear, do not
  write an expect line that claims a change. "The Missions page still renders normally" is a
  no-change check and goes on its own line, as your main instructions say.

## Hard invariants

- **No secrets in the plan.** Values to type are literals; nothing from the app's config or
  the app builder's data.
- **No selectors, no code, no URLs outside the app.** `goto` takes a path like `/app/clients`.
- **One action per step, one concrete checkpoint per step.** A checkpoint is something a
  person could confirm from the screen without interpretation: text that appears, a row with
  given text, a control present or disabled, a count, a URL. "Works correctly" is not one.
- **At most 10 steps.** Verify the one flow the turn is about, not the app.
- **Guardrails are code and you do not loosen them.** The run cannot publish, delete, send
  email or SMS, pay, connect or disconnect services, invite, touch domains, or create app-user
  accounts. It is signed in already. A step that legitimately needs a blocked label names it
  in `"allow": ["Delete"]`, and you say so in your reply.
- **The verdict is data, not a mood.** `pass` means every checkpoint held. `fail` names the
  checkpoint and what the page showed. `inconclusive` or a blocked step means the run could
  not settle it: open the step's still, fix the plan if the plan was wrong, and otherwise say
  the flow is unverified. Never report a flow as working on a run that did not pass.
- **Records the run creates are real data, and you remove them.** The App preview and the
  Published app share one database, and what the run writes is the verify user's, so the app
  builder's own lists may not show it while their data views, emails and automations do.
  - Name it so it reads as a test (`Verify Client`, `verify-test@example.com`), never like
    real data.
  - Create a handful of records, never a whole import or catalogue. An import, a sync or a
    bulk add is run on a sample of a few items. When only the full source can be used, do
    not run it: say the import is unverified and that the app builder can run it themselves,
    so the records land in their own account.
  - Record the id of each record a run creates, at the moment it creates it: read the new row
    with `dbExecute` right after the run, in every table the flow wrote to. An id counts as
    captured only when you are sure that run made the row.
  - After the turn's last run, delete only those ids with `dbExecute` (`WHERE id IN (...)`),
    then read the tables once more to confirm they are gone. Never delete by name, email,
    owner or any other match: it can hit the app builder's real rows.
  - A record that has to stay (its id was not captured, a delete was refused, or the app
    builder asked to keep it) is left alone and named in your reply: how many, in which table,
    and that they belong to the verify user.

## Writing the plan

```json
{
  "goal": "A signed-in user can add a client and see it in the list.",
  "viewport": "desktop",
  "steps": [
    { "id": "s1", "kind": "goto", "url": "/app/clients", "checkpoint": "The Clients heading is visible" },
    { "id": "s2", "action": "Type the client name into the Name field and press Add",
      "values": { "name": "Verify Client" },
      "checkpoint": "A row with the text Verify Client is visible in the list" },
    { "id": "s3", "kind": "reload", "checkpoint": "A row with the text Verify Client is still visible" }
  ]
}
```

- Steps default to `act`. Other kinds: `goto` (path), `reload`, `observe` (judge only).
- Name controls by their visible label, the way the app builder would say it.
- Put every literal in `values` and refer to the field in `action`; the runner types it.
- A slow result belongs in the checkpoint, with `"timeoutMs"` for its worst case, never as a
  "wait" action.
- Check for something that appears, never for something that goes away. The judge reads the
  page's text, and a sheet that is closing, or hidden but still in the page, leaves its title
  there: "the form sheet closes" reads as a fail when it worked. Write what the page shows once
  the action has worked instead: "A row with the text 77 minutes is visible in the list", "the
  Log a session button is visible again".
- Add `"viewport": "phone"` on a step only when the flow differs on a phone.
- For a reported bug, the plan's last checkpoint is what the app builder says should happen;
  a `FAIL` there before the fix is the reproduction, a `PASS` after the build is the confirmation.
- Write the file with your file-writing tool, then `dev-tools verify /tmp/plan.json`. On the
  unasked run add `--expect` (the `expect` argument of the tool) with the screenshot's expect
  line, word for word: a `PASS` then confirms that ask for your reply, where the still could
  only say "cannot tell". Left out, it stands for your newest unconfirmed ask, and the result
  says which. One line names one ask for the whole turn, so word it for the page.

The run signs in as the verify user, a fixed test account in the app's own login table, never
the preview app user. A page that shows the signed-in app user's own data can look emptier
than it does to the app builder; that is expected, not a bug to fix.

That account counts as **admin** on the App preview. A flow behind another platform role — a
screen whose loader calls `requireRole(request, env, "creator")` answers 403 to an admin — is
run with `--as-role "<role>"` (the `role` argument of the tool), naming the role exactly as the
app passes it to `requireRole`. The verify user then holds that role for this run only, in the
App preview only; nothing is written to the app's data, and the Published app is untouched. Say
in your reply which role the run used. A gate the app wrote itself (an approved list, a site
password, a paid plan, a welcome tour) is not a role: the run cannot pass it, and the screen
behind it is reported as unverified, by name.

## Reading the result

The command prints one line per step: `PASS`, `FAIL`, `BLOCKED`, `UNCLEAR` or `SKIPPED`, with
the checkpoint, the runner's note and the path of that step's still. Open the still of any step
that is not `PASS` before deciding whether the app or the plan is wrong:

- `FAIL` with a page that shows the opposite of the checkpoint: the app is wrong. Fix, build,
  run once more.
- `BLOCKED` naming a control it could not find: usually the plan named a label that is not on
  the screen, or the control is behind a step you skipped. Fix the plan, not the app.
- `UNCLEAR`: the checkpoint was not concrete enough to judge. Rewrite it as something visible.
- A verdict that starts with `mixed` (`s4 failed but s5 passed, needs a look`): a checkpoint
  did not hold from the page's text, but a later step passed that could only hold if the
  earlier action had worked. Open the `UNCLEAR` step's still: if it shows the flow worked, say
  so and rewrite that checkpoint as something that appears; if it shows the opposite, treat it
  as a `FAIL`.

In your reply, say what the run did and saw in plain words ("it added a client named Verify
Client and the list showed it after a reload"), and that you removed the test records it
made, or which ones are still there and where. A run that did not pass is reported as such,
with the failing step.
