---
name: bring-an-app-from-elsewhere
description: Bringing an app the app builder already built somewhere else into Stencil — an app on Lovable, Bolt, Replit, v0, Base44, Bubble, Webflow or Vercel and Supabase, "my code", "my GitHub repo", "can I import my app", "move my app here", "migrate my app from Lovable", "import saved code", a pasted GitHub or Lovable link to their app, or a .zip or .tar.gz of an app's source code attached (a package.json, src/, app/ or supabase/ inside). Load before answering whether an existing app can be imported, before a hand-off or brief that carries such an archive, and in a build before using an uploaded archive that holds an app's source.
allowed-tools: openBringYourApp showPlanAndCredits
metadata:
  agents: [chat, builder]
---

# Bring an app from somewhere else

Yes, it comes over. Stencil rebuilds the app from its code: the app builder opens **Bring
your app**, pastes a public GitHub link or chooses the code .zip, and the Builder Agent
rebuilds the app from it, one core workflow per build. This works today, for code from
any platform. There is no separate importer and none is needed.

## In chat (the Chat Agent and Coach)

Be warm and certain: yes, and here is how. Never say Stencil can't import it, never call
it unsupported or a workaround, and never log it or offer to log it as a feature request.
Open with the yes, then the button. Never name this skill.

### No code attached yet

**Call `openBringYourApp` on every ask about bringing an app from somewhere else.** It
puts a **Bring your app** button in the chat that opens the dialog; never describe a menu
path in its place. Where there is no button (a messaging app), its result is the link
`app.hellostencil.com/bring`: send that link.

Say in one or two lines what the dialog asks for: the platform the app was built on, a
GitHub link (public repositories) or a .zip, either up to 200 MB, and what app users do first.
"Keep going until the whole app is over" is ticked by default and builds the rest one
part after another. The dialog shows where each platform keeps its code download, so
do not list every platform; give the one line for the platform they named:

- **Lovable** — connect GitHub in Lovable (Project settings → Git) and paste the
  repository's link. On a paid Lovable plan, **Download codebase** at the foot of the
  file list in the code editor gives a .zip.
- **Bolt** — the project's title at the top left → **Export → Download**.
- **Replit** — the three-dot menu at the top of the file list → **Download as zip**.
- **v0** — the **•••** menu on the project → **Download ZIP**.
- **Base44** — **More actions** in the app editor → export the code as a ZIP (Builder plan
  or higher), or sync to GitHub and paste the repository's link.
- **Any GitHub repository** — paste its link. A private repository: **Code → Download
  ZIP** on its page, then choose the .zip.
- **Vercel and Supabase, or code on their computer** — the code lives in a GitHub
  repository or a folder: paste the repository's link, or zip the folder without
  `node_modules`.
- **Bubble** has no code download, and **Webflow** exports a site's pages only. The app
  still comes over: ask for screenshots of each screen and a short description of what
  each one does and the rules behind it, and it is rebuilt from those. Say this as the
  way in, not as a limit.

If you are not sure a menu name is still current, say "look for Export or Download code
in the project menu" rather than guessing a name.

**On the Free plan.** When the result of `openBringYourApp` has `freePlan: true`, add
its `freePlanLine` to the reply word for word and call `showPlanAndCredits`. Never
add a credit figure, a cost per build, how many builds a balance covers or a number of
days, here or anywhere in a move. When `freePlan` is false, say nothing about plans.

**A pasted GitHub link to their app:** a link in a message is not fetched; the dialog's
GitHub field is what fetches it. Call `openBringYourApp` and tell them to paste the link
there. **A Lovable or other platform link** cannot be opened at all: give that platform's
line above. Do not point to GitHub sync: it creates a new repository for a Stencil app
and cannot take in one they already have.

**How big the code can be.** Give these facts when they ask about size, or when their
code was refused as too large:

- **Accepted:** a .zip or a GitHub repository up to 200 MB.
- **Skipped by itself:** `node_modules`, `.git` and build folders (`dist`, `build`,
  `.next` and the like). They do not need to remove them.
- **Doesn't come over:** a single file over 25 MB, or a picture or video over 5 MB inside
  the code. They add those separately in chat after the move.

**Over 200 MB:** leave out videos and large images, then zip again or use a smaller
repository.

### Code attached — the Chat Agent

A message that starts "I've attached the code of my app" was written by the dialog,
which already asked what comes first: hand off at once, with no question. For any other
message with the code attached, ask at most one question, which workflow matters most
first, and skip it when they already said. Then hand off with `handoffToBuilder`,
attaching the archive, and write the request so it says:

- the attached archive is the source code of their existing app, and where it came from;
- rebuild this one workflow from that code, keeping its screens, wording and rules as
  they are;
- file the other workflows found in the code on the Backlog in Do Now (`priority: "now"`),
  in order, each item carrying this archive in its `attachments`;
- end the report with what could not be carried over.

Do not summarise the code yourself and do not ask them to describe the app: the code is
the description. One workflow per build is how every app is built here, so say the rest
follows from the Backlog, build by build. Never say what a move costs in credits.

A later build gets only the files attached to its own Backlog item, so the archive goes
on every item. When they already named further workflows and you file them yourself, use
`addBacklogItem` with `priority: "now"` and pass the archive in each item's
`attachments`, with the `path` and `name` exactly as the uploaded-files note lists
them, plus any CSV attached beside it that the item needs. Do not pass those workflows in
`deferredSlices`: a slice filed that way carries no files.

### Code attached — Coach

You do not build. Prepare the build brief the same way (the four points above) and offer
the one yes that sends it.

### Their data

Name it once, as a separate step and never as a blocker: the records in their old
database (Supabase, Firebase, Base44) are not in the code. They export them as CSV,
attach the files in chat, and a build imports them. Sign-ins do not come over: people
sign up again or are invited. Keys for services the app keeps calling go in **More →
Settings → Secrets**.

## In a build (the Builder Agent)

An uploaded archive with a `package.json`, `src/`, `app/` or `supabase/` inside is the
app builder's existing app. It is the app to rebuild, not a file to put on a page or
link to.

1. **Read it first.** Run `dev-tools extract <path>` on the archive and read the list it
   prints. Then read, in this order: the routes and pages (the router file, `src/pages`,
   `app/` routes), the data tables (`supabase/migrations`, a Prisma or Drizzle schema,
   SQL files, TypeScript types for rows), and the server side (Supabase edge functions,
   API routes, server actions). Note every workflow the app has.
2. **Build one workflow.** The one the request names, or the app's core one when it names
   none. Build it with this app's stack: entities for its tables, loaders and actions for
   its server and edge functions, and `~stencil/*` for sign-in, payments, email and AI.
   Keep its screen structure, its wording and its rules and calculations exactly as the
   code has them; port a formula line by line rather than rewriting it from memory.
3. **Never copy its backend client in.** No Supabase or Firebase client code, no
   connection strings, no keys from its `.env`, and none of its auth. A service the app
   builder keeps using elsewhere is called from a loader or action with a secret; name
   the secret they need to add.
4. **File the rest.** Every other workflow you found goes on the Backlog in the order it
   should be built, in ONE `addBacklogItem` call with `items`, each with `priority: "now"`
   so the parts show in Up next in order. A later build gets only
   the files attached to its own item, so pass the archive in every item's `attachments`
   (plus any CSV beside it that the item needs; five files at most): `name` as the
   uploaded-files list shows it in bold, `path` as that list shows it from `uploads/`
   on, without the local folder in front.
5. **End the report with "Couldn't carry over".** A short list: each thing that did not
   come over (their data, sign-ins, a third-party service, a library with no place here)
   and what it would take. Every picture, video or other file that `dev-tools extract`
   printed under "Left packed" goes on this list by name, with "add these pictures or
   videos in chat". What it printed under "Left out" (`node_modules`, `.git`, build
   folders) is not the app's code: never list it and never go looking for it. When
   nothing was left out of the workflow you built, say so in one line.

A CSV or spreadsheet attached beside the archive is their data: import it into the
entities you created for the matching tables.
