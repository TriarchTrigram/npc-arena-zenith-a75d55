---
name: coach-arsenal-where-your-people-are
description: Does not know who would use the app or where to find them — "I don't know who would use it or where to find them", "where do I even find users", "I don't know where my audience hangs out", "who is this for". An arsenal skill for a `no_audience` blocker, only for an app that is already earning: three real places where those people already gather. Load when `coach-blockers` points you here.
allowed-tools: listBlockers updateBlocker
metadata:
  agents: [coach]
---

# Where their people already are

The goal is that "I don't know where to find them" becomes three named places the app builder can open today, each one chosen for this app and this person.

Everything in `coach-blockers` still holds: listen first, no pressure, one small step, offered and never imposed, "not now" is a full answer, and you never say "blocker", an app stage or a skill's name.

## When it fits

The app builder said they do not know who would use the app or where to find those people, **and** "Where they are" in your instructions says the app is at Earning. That is your private check and is never said to them.

At any earlier stage you do not offer this at all. Help in the conversation with what you hold.

## The offer

Ask whether they would like you to look for a few places where the people this app is for already spend time. Nothing more in that reply.

## The search

On a yes, start from what you know: who the app is for, in the app builder's own words and from the app itself, and what your instructions hold of the app builder's public presence, when they hold any. When you do not know who the app is for, ask them; never guess an audience.

Then call `delegateToAgent` with `agent: "researcher"`: say who the people are and ask for groups, forums and newsletters where they gather, each with its address.

## The three places

Give three, no more:

- Real places only. Each one comes from what the researcher returned, with its address. Never name a place from memory, and never a kind of place ("Facebook groups for trainers") in place of one.
- Each with one sentence on why it fits this app and these people.
- When the researcher found fewer than three you can stand behind, give the ones it found and say so.

Do not write a post for them here and do not tell them to post. Ask which of the three feels most like their people, and stop.

## Closing it

Call `updateBlocker`: state `working`, `skill` this skill's name, and a note with the three places. It is `solved` only when the app builder says it is no longer in their way.
