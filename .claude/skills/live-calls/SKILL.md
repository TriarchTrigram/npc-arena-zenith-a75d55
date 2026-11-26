---
name: live-calls
description: Live video or voice between people inside the app — "video call", "voice call", "video chat", "audio room", "live room", "go live", "livestream to my members", "a Zoom alternative", "telehealth visit", "virtual classroom", "let two users call each other", camera and microphone calls, WebRTC, or an outside call service named by the app builder (Daily, LiveKit, Twilio, Agora, 100ms, Whereby, Jitsi, Vonage, Pipecat, the Zoom Video SDK). Load before answering whether the app can hold a call, before suggesting any call or streaming service, before saying which link starts a live session, and in a build before writing any call, room or stream screen. NOT for recorded video (the `storage` skill), speech to text (`voice-input`) or the app speaking (`runtime-audio`).
metadata:
  agents: [chat, builder]
---

# Live video and voice calls

Stencil has no built-in live call today. An app cannot yet hold a video or voice call
between people on one of its own pages: the platform ships no call component, no media
relay and no live channel between two browsers. Say that plainly, in one line, the first
time a call comes up, then offer what works. Never say it is impossible for good, never
promise a date, and never start a build that claims to add calling.

## What works today

Every working path opens the call in Zoom, Google Meet or another meeting tool, from a
link kept in the app.

- **A join link on the record.** A session, class, appointment or room row carries a
  "Join link" field, and its page shows a **Join call** button that opens the link in a
  new tab. The host makes the meeting in the tool they already use and pastes its link.
  This needs no connection, no key and no setup, so offer it first.
- **A Meet link made with the booking.** When app users connect their own Google
  Calendar, `createGoogleCalendarEvent` with `add_google_meet: true` returns a
  `meetLink` to store on the booking.
- **A Zoom meeting scheduled from the app.** When app users connect their own Zoom, the
  app can schedule a meeting on that person's account and store the join link it returns.
- **A public broadcast that plays in the page.** A YouTube live link plays through
  `<VideoEmbed>` like any other YouTube link. That is one person broadcasting to viewers,
  not a call: nobody watching has a camera or a microphone.

The two connection paths go through the `member-connections` skill. Load it and read the
connection status before you promise either one, because a service can need the app
builder's own credentials or the provider's review first.

## A meeting link is not a video link

A Zoom, Meet or Teams link cannot play inside the app: it only opens that tool. Never tell
anyone to paste one into a video, stream or recording field. `<VideoEmbed>` plays YouTube,
Vimeo, Loom, Descript and Google Drive links only. A screen that takes both kinds keeps
two separate fields, one "Join link" that opens in a new tab and one "Video link" that
plays in the page, and the validation message on each names what that field accepts.

Chat Agent: before you say which link goes in a field of an app that is already built,
hand the question to the Builder Agent, which can read what that field accepts.

## Never name an outside call service

Never write the name of a call service — Daily, LiveKit, Twilio, Agora, Pipecat, 100ms,
Whereby, Jitsi, Vonage, the Zoom Video SDK or any other — in a reply to an app builder
who has not named one themselves. Not as a suggestion, not as an example, not as an
aside, and not as an offer they could take up later: "if you already have an account
with a call service like X, tell me" is the same mistake as walking them through signing
up for one. That path is a second account, a per-minute bill and a set of keys to run,
for a feature Stencil cannot check or support, so an app builder who has not asked for
it must never learn from you that it exists. A reply about calls offers the working
paths above and stops there; never ask for a service's API key.

The steps below are an answer, never an opener. Use them only in a reply to a message
where the app builder named a call service themselves and has an account with it:

1. Say first what works today (above), and that a call built on their own account is
   theirs to run: their bill, their keys, and nothing Stencil can look into when a call
   fails.
2. If they still want it, the key is saved through the secure box (`requestSecret`, or
   **More → Settings → Secrets**) and never typed into the chat. The server creates rooms
   and short-lived join tokens from that secret, only for signed-in app users allowed in
   that room; the key never reaches the browser.
3. Say that camera and microphone access must be checked in the Published app on a real
   phone before anyone is invited, and never report the call as working from the build
   alone.

Never hand-roll a call with `RTCPeerConnection` or a public relay: two browsers cannot
find each other without a live channel the app does not have, and such a call fails on
most phone networks.

## What the build writes

For the join-link path: one optional link field on the record, saved only when it is an
`https://` address; a **Join call** button shown to the app users allowed to see that
record, opening in a new tab; and the start time beside it in the viewer's time zone.
Write the screen copy as "Join call" or "Join on Zoom", never "Start video" or "Go
live", so no one expects the call to open inside the page.
