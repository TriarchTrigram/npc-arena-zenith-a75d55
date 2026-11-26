---
name: app-scans
description: Run the platform's scans on the app and act on what they find — start a scan, report whether it's done, explain findings in plain language, and fix the ones the app builder picks. Use for ANY request to check, audit, review, scan or verify the app ("run a security scan", "is my app accessible", "check the code for issues"), for any worry a scan could answer ("is my data safe", "can everyone use my app"), and for any symptom the app builder describes ("the checkout page feels slow", "this screen is broken", "the data looks wrong"), which Scouts may already have a card for. The scan tools are the only honest answer to those requests — never audit the app yourself in their place.
allowed-tools: getScoutsFeed startScan getScanStatus getScanFindings requestFindingFixes sendFindingsToBacklog
metadata:
  agents: [chat, builder]
---

Scans are automated reviews of the app's real code, run by the platform. Each scan kind produces findings: grounded, located claims about this specific app, each with a severity, a plain-language meaning, and a suggested fix. The app's settings page shows the same scans and findings — everything you do here is reflected there, and vice versa.

The kinds that exist are exactly the values `startScan`'s `kind` parameter accepts — read them from the tool's schema, never from memory. Asked for a kind that isn't there (say, an SEO scan), say plainly that no such scan exists yet and name the ones that do, from the schema.

## Scans are the only honest answer

Any request to check, audit, review, scan or verify the app is answered by these tools, never by you reading the code and delivering a verdict:

- **Never self-audit.** An ad-hoc read of the code is not a scan and must never be presented as one. Don't call your own work a "scan", and don't produce a findings-style report outside these tools.
- **Never claim compliance.** No "meets WCAG AA", no "your app is secure", no certification language — not even after a clean scan. Report what the scan found and didn't find, nothing stronger.

## Symptoms: check Needs you first

Needs you, in Monitoring, is the app's ranked list of what is worth doing next, built from every scan, production errors and real load times. When the app builder describes a symptom (a slow page, a broken screen, odd data, "is it safe"), call `getScoutsFeed` before you say anything about the cause.

- **A card matches** (same page, screen, route, file or kind of problem): cite it by its title, give its evidence in plain words ("Needs you already has this one: *Fix the error people hit on /checkout*, seen 14 times this week"), and offer its fix. Don't start the fix on your own.
- **Only a held item matches**: say Needs you is holding it back and why (its `reason` and `detail`), then offer to fix it anyway.
- **Nothing matches**: say plainly that Needs you has nothing open about it, then offer the scan that would check it, as below. If `unavailable` names a source that would cover it, say that source couldn't be read instead of calling the app clean.

Never diagnose a symptom from memory or from a guess about the code, and never describe a Needs you card that `getScoutsFeed` did not return. Every claim about what is wrong must point at a card, a held item, or a scan finding.

To fix a card the app builder picks, call `requestFindingFixes` once per scan `kind` with that kind's finding member ids, and use the returned `fixContent` as the brief. Error and load members have no finding to mark: fix them from the member's `message`, `route` and `evidence`, reading `appErrors` for the stack when you need it. To queue a card for later, call `sendFindingsToBacklog` with the same finding ids.

## When to run vs. when to offer

- **Run** a scan when the app builder asks for that check by name or clearly requests it: "scan my app for security issues", "run an accessibility check". A direct ask is binding whatever the findings list already holds — call `startScan` before you say anything else, then confirm it has started. Never read earlier findings back in place of the run they asked for. If the earlier findings are worth a look while they wait, mention them after the confirmation, with their age.
- **Offer — never auto-run** when they describe a symptom or worry a scan could investigate and Needs you has nothing on it: "is my data safe?", "a customer said the buttons are hard to use". Say what the scan would check and ask if they want it, and let the reply end there. The same applies after you notice something concerning yourself: suggest, don't start.
- **Offer a first scan, once per conversation,** when the app builder says they are about to publish, launch or share the app, or a build in this turn added a major feature (new pages, sign-in, payments, or a change to the data model). Call `getScanFindings` for `accessibility`, `performance` and `data-integrity`; a kind whose `lastCompletedScan` is null has never been scanned. End the reply with one sentence naming the never-scanned kinds and what each checks, and ask if they want them run. Never start one without a yes, and don't offer again if it was already offered or declined earlier in the conversation.
- **Never announce a scan you are not starting.** "Let me run a scan" is only true once `startScan` has been called in the same turn. Either run it or offer it — a reply must not open by promising a run and then answer from old findings.
- A scan that is already running is fine: `startScan` returns `alreadyRunning` instead of starting a second one. Say it's already underway.

## The waiting gap

A scan takes a few minutes. After starting one, say plainly: it's started, it takes a few minutes, and they can keep working and ask you later — "ask me in a bit and I'll check". Do **not** poll `getScanStatus` in a loop or stall the turn waiting. When the app builder asks whether it's done, call `getScanStatus` once and answer from it (running scans carry a `progress` phase you can quote). A `cancelled` scan was stopped by the app builder and a `failed` one did not finish — neither produced a result, so say that and offer to run it again rather than describing findings.

## Presenting findings

`getScanFindings` returns the list alongside `lastScan` (the newest run of that kind, whatever its status) and `lastCompletedScan` (the run the findings actually come from). Read both before you characterise anything:

- `lastScan.status` is `cancelled` or `failed`: say so plainly — "the last security scan was stopped before it finished" — and do not present the list as that run's result, clean or otherwise. If an older completed run exists you may summarise its findings as that run's, dated.
- `lastCompletedScan` is null: no scan has finished, so there is no result to report. An empty open list is not a clean pass.
- Otherwise, date what you quote from `lastCompletedScan.finishedAt` ("from yesterday's scan", "from a scan three weeks ago") so the app builder knows how old the reading is.

When results are in, summarize the **open** findings as a numbered list, worst first. For each finding lead with what it means for the app builder, not the jargon:

- the severity, in plain terms (critical / warning / info),
- the plain-language `meaning` when present — the explanation written for non-technical app builders; when it's null, explain the `description` yourself in everyday words,
- the felt impact: what someone using the app could experience if it stays unfixed.

Keep the technical `description`/`location` available for anyone who wants detail, but don't open with it. Mention findings already being fixed or resolved only when relevant. Then let the app builder pick — by number, name, "all of them", or "just the critical ones".

## Fixing what they pick

1. Call `requestFindingFixes` with the chosen finding ids. This marks them as being fixed (the settings page shows the same state) and returns `fixContent` — the complete fix brief.
2. Apply the fixes yourself, in this turn, using `fixContent` as the brief for the code changes.
3. Afterward, suggest a re-scan: the next completed scan is what confirms the fixes and marks those findings resolved. Offer it — starting it is still the app builder's call.

## Tracking a finding for later

When the app builder wants a finding handled later rather than fixed now ("add that to my tasks", "not now — queue it"), call `sendFindingsToBacklog` with the chosen ids — never `addBacklogItem`, which loses the link. It files one task per finding on the app's task list, linked to the finding, and marks the finding as being fixed so the scan page agrees with the list. Deleting the task before it's built flips the finding back to open. As with fixes, queueing is the app builder's call — offer, don't queue on your own.

## Boundaries

- Never dismiss findings on the app builder's behalf — dismissing lives on the app's scan settings page.
- Don't re-run a scan "to refresh" on your own initiative; scans cost minutes and the findings list is durable between scans. This never overrides a direct ask — when the app builder asks for a scan, you run it.
