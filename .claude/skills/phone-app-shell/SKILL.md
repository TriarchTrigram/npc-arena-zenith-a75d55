---
name: phone-app-shell
description: >
  Lay out an app so it keeps working on a phone after the keyboard opens and
  closes, especially once the app is installed on an iPhone home screen. Use
  when building a mobile bottom tab bar or bottom nav, a sheet or dialog that
  holds a text field, a post or comment composer, or any app meant to be
  installed on a phone. Also use to diagnose "the tab bar floats above the
  bottom", "the bar moved again", "buttons stop working until I close the app",
  "taps do nothing in the sheet but the page still scrolls", "the composer shows
  the page behind it", or anything that happens "only on iPhone" or "only in the
  home-screen app". An Errors entry titled "Taps are not responding (buttons did
  nothing)" is this problem.
metadata:
  agents: [chat, builder]
---

# Phone app shell

On a phone the browser scrolls the whole window to bring a focused text field into
view. When the keyboard closes, an app installed on an iPhone home screen often
keeps that scroll offset and loses track of where `position: fixed` elements are.
The bar drawn at `bottom: 0` is painted somewhere above the bottom, taps land on
the wrong spot and reach nothing, and a sheet over the page paints the page that
scrolled behind it. No error is thrown, so Errors shows nothing unless the dead-tap
reporter fires.

The fix is the shell, not the bar. A shell where the window never scrolls has no
offset to lose.

## Building: the window never scrolls

On phones, the app is a fixed full-screen frame with one scrolling area inside it.

- `html` and `body` never scroll. Give the shell `height: 100dvh` (fall back to
  `100vh`), `display: flex; flex-direction: column`, and `overflow: hidden`.
- Exactly one content area sits between the header and the tab bar and is the
  scroll container: `flex: 1; min-height: 0; overflow-y: auto;
  overscroll-behavior: contain`. Everything that scrolls, scrolls here.
- Infinite loading, scroll-to-top, "new posts" buttons and scroll restoration on
  route change read and set that container's `scrollTop`, never `window.scrollY`
  or `window.scrollTo`.
- The tab bar is a normal flex child at the end of the frame with
  `padding-bottom: env(safe-area-inset-bottom)`. It is not `position: fixed;
  bottom: 0`, not `sticky`, and never placed from `visualViewport` or
  `innerHeight` math. Those numbers are wrong in exactly the moments the bar
  floats, so a self-check built on them never fires.
- Tabs share the bar's width equally (`flex: 1; min-width: 0`). A label too long
  for its tab wraps to a second line, centred under the icon, and ends in an
  ellipsis after two lines (`line-clamp-2`, `overflow-wrap: anywhere`,
  `hyphens: auto`); every tab is as tall as the tallest. Never one clipped line: a
  phone has no hover to show the rest, and a translated label is often longer.
- A post or comment composer that holds more than a line of text is its own
  full-screen route on phones, not a sheet or dialog over a scrolled page. So is
  any text field that sits inside the scrolling content area: a comment or reply
  box in a feed card, an inline edit box in a list. The route shows what is being
  replied to at the top and the field below it, writes to the same endpoint the
  inline field did, and Cancel and Send return to the same scroll position. Only
  a field outside the scroll area may stay inline: a search box in the fixed
  header, or a rename field in a small dialog on a page that does not scroll.
  `overflow: hidden` does not stop the phone scrolling the window to show a
  focused field, and the `focusout` reset below only runs afterwards, so a field
  inside the scrolling area always gets the window scrolled behind the shell
  while it is focused.
- To keep a text field focused while the app user taps a button next to it (a
  send button, an emoji picker, a row in an @mention list), cancel `mousedown`
  only: `onMouseDown={(e) => e.preventDefault()}`. Never cancel `pointerdown` on
  an element that acts in `onClick`: on an iPhone, `preventDefault` on
  `pointerdown` can stop `click` from firing at all, so the button does nothing
  and no error is thrown. If `pointerdown` must be cancelled, run the action in
  `onPointerUp` instead of `onClick`, and guard it so one tap cannot run it
  twice (keep `onClick` for the keyboard, but skip it when `onPointerUp` already
  ran).
- When a text field loses focus on a phone and `window.scrollY` is not 0, scroll
  the window back to 0. One `focusout` listener on the shell is enough:

```tsx
useEffect(() => {
  const reset = () => {
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  };
  document.addEventListener("focusout", reset);
  return () => document.removeEventListener("focusout", reset);
}, []);
```

Desktop layouts may keep window scrolling; apply the frame at the phone
breakpoint.

## Diagnosing: these symptoms are layout

A floating tab bar, buttons in an open sheet that do nothing while the page still
scrolls, a composer that paints the page behind it, or a "Taps are not responding"
entry in Errors with `scrollY` above 0 and `standalone: true` all mean the window
scrolled behind fixed elements. They are not a stale build, a freeze, a cache
problem or a React bug, and they do not reproduce in a desktop browser.

- Say it plainly to the app builder: the phone scrolled the page behind the fixed
  bar when the keyboard opened, and the app lost the fixed positions when it
  closed. The fix is to make the window never scroll.
- Rebuild the shell as above: one scroll container, tab bar as a flex child,
  composers as routes, scroll reset on blur.
- Dead taps with `keyboardOpen: true`, the active element a text field inside
  the content scroll area and `scrollY` above 0 mean that field is inline in the
  feed. Move it to its own route as above; re-placing the bar or the field
  changes nothing.
- Dead taps with `scrollY` 0 and `keyboardOpen: true` on a button that has
  `onPointerDown` with `preventDefault` are not layout: cancelling `pointerdown`
  stopped the `click`. Fix the handler as above (cancel `mousedown` only, or act
  in `onPointerUp`); do not rebuild the shell.
- Do not keep re-placing the bar. Moving it with `visualViewport` listeners,
  resize handlers, or a different `bottom` value changes where it floats, not
  whether it floats.
