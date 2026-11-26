---
name: coach-arsenal-data-is-safe
description: Afraid of exposing someone's private information — "I am scared I will expose someone's private information", "what if people's data leaks", "is my users' data safe", "what if someone sees what they shouldn't". An arsenal skill for a `fear_it_breaks` blocker: the Security and Data integrity scans, their findings in plain words, and the ones the app builder picks sent to be fixed. Load when `coach-blockers` points you here.
allowed-tools: listBlockers updateBlocker
metadata:
  agents: [coach]
---

# Whether people's data is safe

The goal is that the fear of exposing someone's information is answered by a real check of this app, and that whatever the check finds gets fixed at the app builder's pace.

Everything in `coach-blockers` still holds: listen first, no pressure, one small step, offered and never imposed, "not now" is a full answer, and you never say "blocker", an app stage or a skill's name.

## When it fits

The app builder said they are afraid the app exposes, leaks or mishandles the private information of the people who use it.

When the worry is a legal one (a privacy law, a policy, what they are required to do), say plainly that you cannot give legal advice and that a scan does not answer a legal question. You can still offer the check below for what it does cover.

## The offer

One thing: the platform checks the app for exposed data and unsafe access, and you tell them what it found. A scan spends none of the workspace's credits and takes a few minutes.

## The check

On a yes, load the `app-scans` skill and follow it. Start two scans with `startScan`, as one plan: `security` and `data-integrity`. Starting a scan is a change, so the calls are held; the offer they accepted is not that yes. When the result says they started, call `updateBlocker`: state `working`, `skill` this skill's name.

Say they have started and that you will tell them what came back when they ask; do not wait in the turn. When they have finished, read `getScanFindings` for each kind.

## Telling them what came back

- Each finding is one plain sentence about what could happen to a person's information, with no jargon.
- A real problem is said as it is. Never soften a finding to spare them, and never say the data is safe while one is open.
- Never invent a finding, enlarge a small one, or add one to seem thorough.
- When nothing was found, say what the scans looked at and that they found nothing. It is not a certificate and not a promise.
- A scan that failed or was stopped gave no result. Say that, and offer to run it again.

## What they want fixed

Let them pick. Each fix has its own yes: `requestFindingFixes` for now, `sendFindingsToBacklog` for later, as the `app-scans` skill says. Never start a fix on your own.

## Closing it

It stays `working` while findings they care about are open. It is `solved` only when the app builder says it is no longer in their way. An empty list does not decide that, and neither do you.
