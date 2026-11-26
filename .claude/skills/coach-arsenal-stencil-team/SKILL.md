---
name: coach-arsenal-stencil-team
description: Handing something in the app builder's way to the Stencil team — "Stencil can't do this", "I need Stencil to decide", "I need an exception", "can I talk to a person", "can someone at Stencil look at this", "I'm waiting on Stencil". Load when a saved blocker needs something only the Stencil team can solve or decide, and when you come back to one that waits on them.
allowed-tools: sendBlockerToStencilTeam listBlockers updateBlocker
metadata:
  agents: [coach]
---

# Handing it to the Stencil team

The goal is that something only the Stencil team can solve or decide reaches a person there, in the app builder's own words, and that it is not forgotten while they wait.

## When it fits

- The app builder needs something Stencil does not do today.
- They need a decision or an exception from the Stencil team.
- They want to talk to a person.
- They have a problem that you, the chat and a build cannot solve.

Never for something you or a build can do. Try that first, and hand over only what is left.

## What you do

Loading this skill, reading your record and making a call are your own steps. Do them without a word, and never tell the app builder about them.

1. Save what they said with `saveBlocker` first, when it is not saved yet. The hand-over needs its id.
2. Write a short note for the Stencil team: what is in their way, in their own words; what they are trying to reach; what was already tried. Add a subject of one line. No tool names, no internals, no guesses about the cause, and never your private words (blocker, the app stages).
3. Call `sendBlockerToStencilTeam` with that subject and note, in the same reply. The call is held, so nothing is sent.
4. Then write the reply: say back what you heard in their own words, say you can pass it to a person on the Stencil team, show the exact subject and note, word for word, and ask for their yes to that text. That is the one ask: never ask whether to hand it over before you show the note.
5. It is sent only after that yes. "Not now" is a full answer. A change to the text is a new call and a new ask. Until you hold the real result, never say it was sent and never say you are sending it now: say what you will send.

The Stencil team sees that you sent it for the app builder, and which app it is about. It goes to a person.

## After it is sent

Call `updateBlocker` with `state: on_hold`, `waitingOn: stencil_team`, `skill: coach-arsenal-stencil-team`, `checkAgainAt` three days ahead, and a `note` with the ticket's number.

A call or a meeting on a date, whenever they name one, now or later in the conversation: call `updateBlocker` with `eventOn`, the date they said, and no `checkAgainAt`. The check-again day is then set for you to the day after it, because on the day of the call they have nothing to tell you yet. The result names that day: say it to them, so they can correct it.

Tell them the ticket's number, that the answer arrives on their Support page, and that they get an email when it does.

- Never promise what the Stencil team will answer, or when.
- You cannot schedule a call or a meeting, and you never say one will happen.

## When it cannot be sent

When the result says this account cannot open a ticket with the Stencil team yet, nothing was sent. Say so plainly: you cannot pass it to the Stencil team from here yet. Do not try another way, and do not promise that someone will see it. Leave the state as it was, add a `note` that it could not be sent, and keep helping in the conversation with what you hold.

When the result says Stencil Support could not be reached, nothing was sent either. Say so and offer to try again; a new try needs their yes again.

## When you come back to it

On the check-again day, ask how it went, warmly and with no pressure: did they hear back, did it help. Then update it from their answer:

- It is no longer in their way: `solved`. Their word decides.
- They got an answer and there is a next step: `working`, with a `note` of what was agreed.
- Still waiting: keep `on_hold` and move `checkAgainAt` a few days on. Do not send it a second time; they can reply on the same ticket on their Support page.
- They say to leave it: `dropped`.
