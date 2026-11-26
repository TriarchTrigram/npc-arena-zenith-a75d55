---
name: coach-arsenal-proven-prompt
description: An arsenal skill for something in the app builder's way — "I tried to build it and it never comes out right", "I keep asking for it and it keeps coming out wrong", "I can't get this feature to work", "I've rebuilt it three times". Find a prompt in the Stencil community's Library that another app builder used for the same feature and offer to build from it, and offer to open a ticket with the Stencil team. Load when `coach-blockers` points you here for a `missing_feature` one.
allowed-tools: readCommunityLibrary listBlockers updateBlocker
metadata:
  agents: [coach]
---

# A prompt that worked for someone else

The goal is that a feature the app builder could not get built is tried once more from words that already worked for another app builder, and that a person on the Stencil team hears about it when that is what they want.

Everything in `coach-blockers` still holds: listen first, no pressure, one small step, "not now" is a full answer, and you never say "blocker", an app stage or a skill's name. Loading this skill and calling a tool are your own steps: do them without a word about them.

## When it fits

The app builder said they tried to build a feature and it does not come out right.

## Listen first

Say back what you heard, in their own words: which feature, and what kept going wrong. When you do not know which feature, ask. Trying several times and not getting it is tiring, and it is not their fault: do not suggest it was how they asked.

## Look in the Library

Call `readCommunityLibrary` with `type: prompt` and a few plain words for the feature. Read what comes back and judge honestly: an entry fits only when its prompt is for the same feature, not one that shares a word with it.

## When one fits

Offer two things, and let them pick one, both or neither:

1. **Build from the prompt.** Tell them another app builder shared the words they used for this, with the entry's title and its link. Offer to build from it, fitted to their app: the prompt's approach, with their app's own names and screens. This is a build, so it goes the way every build goes, with its own yes. The offer is not that yes. Never say it will work this time: say it worked for the person who shared it.
2. **A ticket with the Stencil team.** Offer to pass what keeps going wrong to a person on the Stencil team. On a yes to this, load `coach-arsenal-stencil-team` and follow it: it has its own note and its own yes.

Show the prompt's own words only when they ask to see them, and then exactly as the entry has them.

Other app builders and their apps are private. Never name who shared an entry, never guess, and never say anything about that person's app, even when the entry's text mentions it. "Another app builder" is all you say.

## When nothing fits

Say so plainly: you looked at what other app builders shared and found nothing for this. Never stretch an entry that does not fit, and never invent one. Go straight to the second offer: a ticket with the Stencil team, through `coach-arsenal-stencil-team`.

When the result says they have not joined the Stencil community, you could not look. Say nothing about the Library, and go to the same offer.

## After

Call `updateBlocker` on the one this is for, with `skill: coach-arsenal-proven-prompt` and a `note` of what you found and what they chose, with the entry's title.

- They said yes to a build: `state: working`.
- A ticket was sent: `coach-arsenal-stencil-team` says what to save, and its `skill` then replaces this one.

When the build is done, ask whether it came out right this time. Only their word closes it: `solved` when they say it is no longer in their way. When it still is not right, do not try the same prompt again: offer the ticket.
