---
name: agent-knowledge
description: Teaching an app agent what it needs to know — "the agent should follow our house style", "here is the guide it should use", "it got the tone wrong, fix it", "use this document when summarising", "it keeps skipping the totals". Use whenever an app agent (app/agents/<name>/) needs domain knowledge, a style, a rule set, or a correction after a test run. Covers writing skills/<topic>/SKILL.md from a chat, from an uploaded document, and from a correction, and the test-and-correct loop.
metadata:
  agents: [chat, builder]
---

# Agent knowledge

An app agent's knowledge lives beside its definition, one folder per topic:

```
app/agents/<name>/
  index.ts
  skills/
    <topic>/SKILL.md
```

The platform hands every `SKILL.md` to the agent at the start of each run, after the prompt. The prompt says *what to do*; a skill says *what to know* — the house style, the glossary, the rules of the domain, the examples of a good result. Keep them apart: a prompt that embeds a style guide is hard to change, a skill folder is one file.

**Two authors.** You write skills from chat, and an app builder can edit one themselves in More → Agents (Edit on the skill; saving writes the file into the app's source and redeploys the App preview, no build). The page labels each skill "Written by Stencil's Builder Agent" or "Edited by you". An app builder's save stamps `edited-by-app-builder: <time>` into the file's frontmatter. **Before you change a file that carries that stamp, ask the app builder** ("you edited house-style yourself on 12 May — may I change it, or would you rather add the rule?") and only edit it once they say yes; keep the stamp when you do. A file without the stamp is yours to change when chat asks for it ("the agent should also flag late fees"): edit the file and rebuild.

Every skill loads on every run, so size costs credits each time; the Agents page shows the total and warns when it grows large. Keep each file short and split topics rather than growing one.

## The file

```markdown
---
name: house-style
description: How summaries read: tone, length, what to always include.
---

# House style for summaries

- Plain English, second person, no jargon. "You owe £120 by 3 May", not "The obligor's liability…".
- Three to five sentences, then bullets for dates, amounts and decisions.
- Always state the document date and the parties in the first sentence.
- Never invent a figure; write "not stated" when the document is silent.

## Example

> Signed 12 March 2026 between Acme Ltd and you. You rent the office at 4 High St for two years from 1 April 2026 at £1,200 a month, due on the 1st. …
```

- `name` is the folder name; `description` is one line the Agents page shows.
- Short, concrete, rule-shaped. Bullets and one example beat prose.
- One topic per folder: `house-style`, `refund-policy`, `product-catalog`. Split when a file passes about 200 lines.

## Three ways knowledge arrives

### From chat

The app builder describes the rule in conversation ("summaries must mention who signed and when"). Write it down as a rule in the matching skill, creating the folder when the topic is new. Read the rule back in one sentence so they can correct it before the build.

### From a document

The app builder uploads a guide, a policy, a catalogue. Read it from the chat attachment or the app's bucket (`createStorage(env).get(key)`), then write `app/agents/<name>/skills/<topic>/SKILL.md` as a **distillation**: the rules and facts the agent needs, in the shape above, not the document pasted whole. A forty-page policy becomes the twenty rules that decide outcomes, with the document's own wording kept for anything the agent must quote exactly. Say which parts you left out and why.

### From a correction after a test run

The app builder ran the agent and did not like a result ("it called the client 'the customer'", "it skipped the totals"). Find the rule that was missing or wrong, add or change that one rule, and name the file and line in your reply. Do not rewrite the prompt for a knowledge problem.

## The loop: build, run, correct — three to four rounds

A new agent is rarely right the first time, and that is expected. Run the loop explicitly with the app builder:

1. **Build** the definition with a first skill from what they told you.
2. **Run** it on two or three real files (ask them to upload some, or use what the app already holds) and look at `/work/out` and the summary together.
3. **Correct**: for each thing they would change, add one rule to the right skill. Rebuild.
4. **Repeat** until a run needs no corrections. Three or four rounds is normal; say so up front so nobody reads round two as failure.

Keep a short "What changed" note in the chat per round so the app builder sees the knowledge growing rather than the agent being fixed over and over.

## What a skill is not

- Not credentials, keys or anything secret — those go in More → Settings → Secrets and reach the app through `env`.
- Not the app user's data; a skill is the same for every run. Per-run input is the files the trigger hands over.
- Not a place for instructions about tools or the output folder — those belong in the prompt.
