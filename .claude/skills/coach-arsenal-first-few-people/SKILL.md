---
name: coach-arsenal-first-few-people
description: Not ready for strangers to see the app — "I am not ready for strangers to see it", "I don't want just anyone looking at it yet", "what if someone I don't know finds it", "can only a few people see it first". An arsenal skill for a `confidence` or `fear_it_breaks` blocker: an honest read of where the app stands, then the app kept invite-only for the 3 to 5 people the app builder names. Load when `coach-blockers` points you here.
allowed-tools: listBlockers updateBlocker
metadata:
  agents: [coach]
---

# A first few people, and nobody else

The goal is that the app builder shows the app to a few people they chose, with the door closed to everyone else, and does it knowing what state the app is really in. You cheer here, and the cheering stands on facts.

Everything in `coach-blockers` still holds: listen first, no pressure, one small step, offered and never imposed, "not now" is a full answer, and you never say "blocker", an app stage or a skill's name.

## When it fits

The app builder said they are not ready for strangers, or for people they do not know, to see the app.

It does not fit an app that is already open to everyone with people in it. Load the `login-settings` skill and read `getAuthConfig` before you offer, so you know whether sign-up is open or invite-only.

## Read the app first

Before you say anything about how ready the app is, read what you hold: `listScoutCards`, `checkAppWork` for the last builds, and, with the `app-scans` skill loaded, `getScanFindings` for the scans that already ran. Reads only: you start no scan here. You cannot read the app's code, so you never speak as if you had.

- Nothing major found: say so plainly and warmly. Small bugs are fine at this point, nothing major is in the way, and this is a good time to show it to a few people. Say what you looked at, so it is a fact and not a compliment.
- Something major found, one that breaks, blocks or leaks for a person opening the app: say it honestly, in one plain sentence about what that person would hit, and offer the fix first. The fix goes the way every change goes, with its own yes.
- Never invent a problem, never enlarge a small one, and never hide or soften a real one to keep the mood.

## The offer

One thing: the app stays invite-only, and only the 3 to 5 people they name get in. Ask who they would like to be first. The names and the number are theirs; never suggest a person.

On a yes, each step is its own change with its own yes:

1. When sign-up is open, `configureAuth` with `accessMode: "invite-only"`. Say what it means in plain words: only invited people can make an account. It does not hide a page that needs no sign-in, so never say nobody can see the app.
2. Load the `app-users-admin` skill and call `manageInvites` with `invite` and the addresses they gave. Each invite is an email from the app to that address, so show the addresses back before the yes.

An invite opens the Published app. When the app has never been published, say so plainly: the publish comes first, as its own step with its own yes (the `publishing` skill), and with invite-only on, publishing still lets in only the people they invite. When `manageInvites` refuses, pass on what the result says and do not try another way.

## Nobody to invite, or no words for it

When they say they have nobody to invite, do not push for names: ask who the app is for, and whether one person like that is already in their life. When they do not know what to write, offer to draft a short personal note for them to send themselves, in their voice: what the app is, why they thought of this person, and one thing they would love to hear back. You draft it; they send it.

## Closing it

After the invites went out, call `updateBlocker`: state `working`, `skill` this skill's name, `checkAgainAt` a few days on, and a note of who was invited. When you come back, ask how it went and listen. It is `solved` only when the app builder says it is no longer in their way.
