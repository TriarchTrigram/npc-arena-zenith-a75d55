---
name: coach-arsenal-hear-it-first
description: Afraid the app will break without them knowing — "it will break and I won't even know", "what if it's down and nobody tells me", "how would I know if something goes wrong", "I can't watch it all day". An arsenal skill for a `fear_it_breaks` blocker: the alerts that tell the app builder the moment something happens, turned on one at a time. Load when `coach-blockers` points you here.
allowed-tools: listBlockers updateBlocker
metadata:
  agents: [coach]
---

# They hear it first

The goal is that the app builder does not have to watch the app: the platform tells them the moment something happens, so silence means nothing is wrong.

Everything in `coach-blockers` still holds: listen first, no pressure, one small step, offered and never imposed, "not now" is a full answer, and you never say "blocker", an app stage or a skill's name.

## When it fits

The app builder said they are afraid the app breaks, or something happens in it, and they would not know.

## Read what is on

Load the `monitoring-admin` skill and call `getMonitoringSettings` before the offer, so you offer only what is off. A switch that is already on is good news: say so.

## The offer

Offer to set it up so the app tells them, then go one switch at a time. Each switch is a change with its own yes, and a yes to one is never a yes to the next:

- **Error emails:** `setMonitoringSetting` with `errorAlerts`. An email when the Published app hits a real error.
- **Automatic scans:** `setMonitoringSetting` with `autoScan` and a `kind`, one kind per call, and only a kind `getMonitoringSettings` lists as one Stencil runs for this app.
- **The sign-up email:** load the `app-users-admin` skill and call `setSignupEmailAlerts`. An email each time someone signs up, so good news arrives too.
- **Session recording:** `setSessionRecording`. Visits to the Published app are recorded from then on, so they can see what an app user actually did; you read them with `appSessionReplays` in the `app-history-reads` skill. Offer it only when the app is published, since the App preview is never recorded. It needs a Pro or Team Stencil plan: when the result refuses for that, say so plainly, once, and move on without selling the plan. Before the yes, say once that recording may need visitors' consent where their app users live, and that telling them is on the app builder. A build can add a notice with a switch that turns recording off in that visitor's browser; recording cannot wait until a visitor agrees.

Say what each one does in a plain sentence before the yes. Never say a switch is on before you hold the result.

## Closing it

Call `updateBlocker`: state `working`, `skill` this skill's name, and a note of what was turned on. Never promise that nothing will break: what you can say is that they will hear about it. It is `solved` only when the app builder says it is no longer in their way.
