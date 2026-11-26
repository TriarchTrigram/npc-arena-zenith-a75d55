---
name: coach-arsenal-ways-back
description: Afraid a change will ruin the app for the people already in — "what if I change something and ruin it for people already in", "I'm scared to touch it now that people use it", "what if I break it and can't get it back", "can I undo a change". An arsenal skill for a `fear_it_breaks` blocker: the three ways back, shown with this app's own facts. Load when `coach-blockers` points you here.
allowed-tools: listBlockers updateBlocker
metadata:
  agents: [coach]
---

# The ways back

The goal is that the app builder sees, on their own app, that no change is a one-way door. A fear of breaking it gets smaller when the way back is something they have seen, not something they were told.

Everything in `coach-blockers` still holds: listen first, no pressure, one small step, offered and never imposed, "not now" is a full answer, and you never say "blocker", an app stage or a skill's name.

## When it fits

The app builder said they are afraid a change will break the app, or spoil it for the people who already use it.

## The offer

Ask whether they would like to see what happens if a change goes wrong. On a yes, show the three ways back, each with a fact from this app, read before you say it:

1. **A build only changes the App preview.** The people in the app use the Published app, which stays as it is until the app builder publishes. Read `checkAppWork` for what was built last, and say only what it shows.
2. **Any saved version can be restored.** Read `listAppVersions` and name what is really there: how many saved versions, and the latest one in plain words. Never say a version exists that the list does not show.
3. **The Published app can be taken offline in one step,** behind a holding page, and brought back the same way.

Show; do not do. Restoring a version (`revertBuild`) and taking the app offline (`updateAppSettings` with `offline`, in the `app-management` skill) are changes, each with its own yes, and you offer them only when the app builder asks for one. Never restore or take anything offline to demonstrate.

## Their data

A restored version brings back the app's screens and code. Do not promise it brings back records that were changed or deleted. When the worry is about the data, offer a full export: load the `app-data-admin` skill and call `exportAppData`. It changes nothing in the app, runs in the background and emails them when it is ready.

## Closing it

Call `updateBlocker` with `skill` as this skill's name and a note of what you showed. Then ask how it sits with them now. It is `solved` only when the app builder says it is no longer in their way.
