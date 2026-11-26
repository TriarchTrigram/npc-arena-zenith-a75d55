---
name: share-to-apps
description: Sending a file from a built app into another app on the phone — "share to Instagram", "post to stories", "open in Instagram", "share to WhatsApp / TikTok / Messages", "share sheet", "share this image to another app", a "Share" button next to Download on a generated story, flyer, card, or clip. Load before wiring any share button, and whenever the brief asks for an Edits-style or native-app handoff into Instagram Stories — this skill says what a web app can and cannot do there. Also "save to my camera roll" / "save all to Photos" for a set of generated images on a phone. Uses `shareFiles` from `~stencil/files` (the Web Share API with files), gated so desktop keeps a Download.
metadata:
  agents: [chat, builder]
---

# Share to other apps (Web Share API)

A web app cannot post into Instagram Stories, TikTok, or WhatsApp for the app user. What it
can do, on a phone, is open the **OS share sheet with the file attached** — the app user
taps Instagram, picks Story, and posts. That is `navigator.share({ files })`, and it is the
only browser path. No Meta app id, no OAuth, no app review.

## What is and is not possible — say it plainly

- **Not available to a web app:** the `instagram-stories://` URL scheme with a pasteboard
  payload, Meta's Edits-style "send to Stories" pre-load, any handoff that lands inside
  Instagram's story editor with the image already placed. Those are native-app APIs.
  Do not promise them, and do not try to fake them with a deep link — the link opens
  Instagram empty.
- **Available:** the share sheet with the image as a file. From there Instagram, WhatsApp,
  Messages, TikTok and the rest are the phone's targets, not the app's. The app user
  chooses the target and the mode (Story vs Post) inside Instagram.
- Tell the app builder this before building: "Share opens the phone's share sheet with
  the image attached; the app user picks Instagram, then Story. A web app can't skip
  that step." Then build it alongside Download, never instead of it.

## Support matrix

| Where | `share({ files })` |
| --- | --- |
| iOS Safari 15+, and Chrome / in-app browsers on iOS (same engine) | Yes — the phone share sheet |
| Android Chrome | Yes |
| Desktop Safari / Chrome | Technically yes, but only to OS targets (Mail, AirDrop); not useful for social |
| Firefox | Mostly no |

Needs a secure context (https) — app previews and published apps already are. Treat it as
a **phone feature with a desktop fallback**: gate on support and keep Download visible.

## The code shape

`~stencil/files` owns the share call: `canShareFiles(files)` is the gate, `shareFiles(files)`
opens the sheet and falls back to `saveFiles` where sharing is unsupported, `toFile(blob,
name)` builds the `File`s both take. Never call `navigator.share` by hand.

1. **Share `File`s, not a URL.** `toFile(blob, "story-1.png")` — a URL share opens a link
   preview in the target, not the image. PNG or JPEG only; the extension names the type,
   and Instagram refuses a file whose two disagree.
2. **Gate before rendering the button** with `canShareFiles(files)`. Unsupported → render
   nothing; the Download button (the `file-export` skill) stays.
3. **Call `shareFiles` synchronously inside the tap.** iOS drops the user gesture after an
   `await` — rendering the canvas or fetching the blob first makes the call throw
   `NotAllowedError`. Build the `File`s when the images render (or in a prior step) and
   call `shareFiles` from the click handler with no `await` before it. If the bytes truly
   can't exist earlier, fetch inside the handler and keep the chain to one short `await` —
   and tell the app builder it is a known iOS trade-off.
4. **Read the outcome, don't catch the cancel.** `shareFiles` resolves `"shared"`,
   `"cancelled"` (the app user closed the sheet — say nothing) or `"saved"` (it fell back to
   a download). Anything it throws is real: show it.
5. **All images in one share to save them; one image per share to post a story.** The
   sheet's Save Image puts every attached image in Photos at once, so **Save to Photos** /
   **Share all** passes the whole set. Instagram, though, treats several images as one post
   or carousel, not a set of stories: for "post my 3 stories" render "Share story 1 / 2 / 3",
   one tap each, and say so in the copy.
6. `title` is optional and ignored by many targets. Never put anything that matters in it.

## UI

- Label: **"Share to Instagram"** when the brief names Instagram, **"Save to Photos"** when
  the ask is the camera roll, otherwise **"Share"**.
- One-line hint under the button: _"Opens your share sheet. Pick Instagram, then Story."_ or
  _"Opens your share sheet. Tap Save Image."_
- Download stays visible on every device. On desktop it is the only button.
- Mobile-first: the share button is the primary action on a phone, full-width, above
  Download.

## Worked example

```tsx
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { canShareFiles, shareFiles } from "~stencil/files";
import { useHydrated } from "~stencil/ui/hydration";

// Renders nothing on the server and wherever the browser can't share files;
// the Download button next to it stays. `files` are built when the images render.
export function ShareFilesButton({ files, label, hint }: { files: File[]; label: string; hint: string }) {
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  if (!hydrated || !canShareFiles(files)) return null;

  const share = () => {
    setError(null);
    shareFiles(files).catch(() => {
      setError("Couldn't open the share sheet. Download the images instead.");
    });
  };

  return (
    <div className="space-y-1">
      <Button type="button" className="w-full" onClick={share}>
        {label}
      </Button>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

Usage next to the download, with the `File`s produced when the story set renders (see
"Several files from one click" in the `file-export` skill for the canvas → `toFile` step):

```tsx
<ShareFilesButton
  files={storyFiles}
  label="Save all to Photos"
  hint="Opens your share sheet. Tap Save Image to put every slide in Photos."
/>
{storyFiles.map((file, i) => (
  <ShareFilesButton
    key={file.name}
    files={[file]}
    label={`Share story ${i + 1} to Instagram`}
    hint="Opens your share sheet. Pick Instagram, then Story."
  />
))}
<Button variant="outline" onClick={() => saveFiles(storyFiles)}>Download all</Button>
```

`useHydrated` keeps the first client render identical to the server's (the
`hydration-safe-rendering` skill); the button appears right after mount on a phone.
