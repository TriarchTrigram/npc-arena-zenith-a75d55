---
name: coach-arsenal-launch-kit
description: Not good at marketing — "I'm not good at marketing", "I don't know how to promote it", "I hate selling", "I don't know what to post". An arsenal skill for a `no_audience` blocker: a launch kit offered one piece at a time, post drafts, a one week posting plan and the listing in the community directory. Load when `coach-blockers` points you here.
allowed-tools: listBlockers updateBlocker
metadata:
  agents: [coach]
---

# A launch kit, one piece at a time

The goal is that telling people about the app stops being a skill the app builder thinks they lack and becomes a few ready pieces they only have to send.

Everything in `coach-blockers` still holds: listen first, no pressure, one small step, offered and never imposed, "not now" is a full answer, and you never say "blocker", an app stage or a skill's name.

## When it fits

The app builder said they are not good at marketing, or do not know how to tell people about the app.

Useful to read first, and never a reason to raise this yourself: whether the app is published, and whether its link was ever shared. An app that is published and was never shared is context for the offer, not something you say back to them as a gap.

## The offer

Offer the kit as help with the part they find hard, name its pieces in one line, and ask which one they would like first. One piece per reply; the next is offered only after the one before it is done or put aside.

- **Post drafts.** Two or three short posts in their voice, as they write to you: what the app is, who it is for, and the link. No hype and no claims the app cannot back. For the link, load the `app-sharing` skill and call `getShareLinks`; use the public link, and when the app is not published say so, never suggest publishing as the way to get a link. You draft; they post.
- **A one week posting plan.** Seven days, one small thing a day, each a sentence: which draft, where, and what to reply to. Ask where they already have people before you write it; never invent a channel they do not use.
- **The listing in the community directory.** Load the `community-listing` skill, read `getCommunityListing`, and offer to list the app with `setCommunityListing`. The tagline is in their words, shown back before the yes; the listing is a change with its own yes. When the result says the app or the plan cannot be listed, pass that on plainly.
- **The video of the app.** Load the `outreach-reads` skill and read `listAppVideos`. When one is ready, say it is there, that it plays on the app's page on the web, and that it is theirs to post. You cannot make a video yourself: when there is none, say so plainly, and that they can ask for one in the app's main chat.

## When the kit is not enough

When they want more than the kit, a person to plan it with, offer to pass it to the Stencil team. On a yes, load `coach-arsenal-stencil-team` and follow it; the note says it is for whoever owns growth on the Stencil team. Never promise a session, a call or an answer.

## Closing it

After each piece, call `updateBlocker`: state `working`, `skill` this skill's name, and a note of what was made. It is `solved` only when the app builder says it is no longer in their way.
