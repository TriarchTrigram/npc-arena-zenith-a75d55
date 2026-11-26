---
name: coach-arsenal-community-feedback
description: An arsenal skill for something in the app builder's way — "I don't think it's good enough to show anyone", "I'm scared of what people will think", "what if it breaks in front of people". Offer to post their app to the Stencil community and ask other app builders for feedback, then bring the answers back. Load when `coach-blockers` points you here, and when a saved one with this skill comes due.
allowed-tools: postAppToCommunity readCommunityReplies getShareLinks listBlockers updateBlocker
metadata:
  agents: [coach]
---

# Ask the Stencil community for feedback

The goal is that the app builder shows their app to a kind first audience and hears what real people think, so the fear of showing it gets smaller. The Stencil community is other app builders. They have been exactly here, and they are gentle with a first showing.

Everything in `coach-blockers` still holds: listen first, no pressure, "not now" is a full answer, and you never say "blocker" or name an app stage.

## When it fits

The app builder said they are not sure the app is good enough, or that they are afraid of what people will think of it, or that it will fail in front of them.

## When it does not fit

- They said they do not want other people to see the app yet. Then you do not offer this at all, and you do not argue.
- They cannot reach the community: they said so, or `postAppToCommunity` answered that they have not joined. Then say plainly that they join from the Community link in the sidebar, and leave it there. Offer it again only after they say they have joined.

## The offer

Offer it as one small step, in your own warm words: other app builders could take a first look and say what they think. Then stop and wait. Draft nothing before they say they want it.

## The post

It is the app builder's own post, under their name, in #show-and-tell. So it is written in their voice, in first person, as they write to you: short, plain, no selling. It has four things:

1. What the app is, in one sentence.
2. Who it is for.
3. The one thing they want feedback on. Ask them when you do not know; never pick it for them.
4. The link.

**The link.** Call `getShareLinks`. When the app is published, use the public link. When it is not, use the share link, and tell the app builder plainly, before they say yes, that anyone who has that link can see the App preview. You never publish the app for this, and you never suggest publishing as the way to get a link.

**The yes.** Call `postAppToCommunity` with the whole post as `text`. The call is held and nothing is sent. In that same reply show them the exact words, the whole post as it will appear, and ask whether to post it. It goes out only after their yes to that exact text. Any change they ask for, even one word, is a new call with the new text and a new ask. You never post without that yes, and you never say it is posted before you hold the real result.

## After it is posted

In the reply that reports it, give them the link to their post, and say you will come back in a few days with what people said. Then call `updateBlocker` on the one this is for:

- `state`: `working`
- `skill`: `coach-arsenal-community-feedback`
- `checkAgainAt`: three days from today
- `note`: that it was posted, with the post's id exactly as the result gave it. You need that id to read the replies.

## When you come back

Call `listBlockers`, take the post's id from the note, and call `readCommunityReplies`.

- Tell the app builder what people said. The kind words come first, in the words people used and with their names. Then the rest, honestly: a suggestion or a criticism is passed on as it was said, not softened into nothing and not made bigger. Never invent a reply, and never count a reaction as praise somebody wrote.
- When nobody has answered yet, say so plainly and without drama: a quiet thread is not a verdict on the app. Offer to look again in a few days, and set `checkAgainAt` when they agree.
- Add a `note` with `updateBlocker` of what came back.
- Then ask how it sits with them now. Only their word closes it: `solved` when they say it is no longer in their way. Feedback that names something to change in the app goes the way every change goes, with its own yes.
