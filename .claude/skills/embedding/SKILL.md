---
name: embedding
description: Showing a page of the app inside another website — "embed this form on my site", "iframe", "embed code", "a widget for my Squarespace/Wix/WordPress/Webflow page", "put the booking form on my homepage", "the embed shows a blank box", "refused to connect", "frame-ancestors". Load before writing or explaining any iframe or embed snippet, before building an "embed code" panel, and when a build finds the Published app refusing to load inside another site. NOT for giving app users their own addresses (see `subdomains`) or for outside services that post data into the app (see `webhooks`).
metadata:
  agents: [chat, builder]
---

# Embedding a page of the app on another website

Stencil's hosting refuses to show a Published app's pages inside a frame on any other
website. The only places a page may be framed are the app's own address and the Stencil
editor. The app builder's own website counts as another site — `acme.com` cannot frame
`hub.acme.com` — and so does the parent of a custom domain. App code cannot loosen this:
Stencil strips any frame rule the app sets and writes its own on every response.

The block is silent. The page answers normally, the browser just draws an empty or broken
box, and no error reaches the app. An `<iframe>` snippet, an auto-resize script or a
"copy this embed code" panel therefore ships a feature that cannot work until the
Stencil team steps in.

## What the Stencil team can do

On request, a Stencil team member allows specific websites to frame one app. There is no
switch for it in More and nothing either agent can set; the app builder asks
through **Stencil Support** at the bottom of the sidebar. The request needs the full
address of each site that will show the page, with `https://`, and both forms when a site
answers to both: `https://acme.com` and `https://www.acme.com` are two separate entries, and
a bare `acme.com` cannot be used. `https://*.acme.com` covers every subdomain but not the
bare domain. Once a site is allowed the frame starts working by itself; no build is needed.

## What to do when asked for an embed

1. **Say it first.** Before writing any code, tell the app builder that pages of their
   Published app do not load inside other websites until the Stencil team allows their
   site, and how to ask (above). Never say it is impossible, and never say they can switch
   it on themselves.
2. **Offer what works today.** A link or button on their website that opens the page in a
   new tab, or a pop-out link on the page itself, works everywhere right now. Build that on
   request.
3. **Write embed code only once they confirm their site has been allowed.** The app's code
   cannot tell you whether it has; ask rather than assume. Then frame the page with
   `?embed=1` on its address: Stencil serves that address signed out, so only pages a
   visitor can use without an account belong in a frame — a public form, a schedule, a
   price list — and the page should render without the app's navigation when it sees the
   flag. A signed-in page shows the sign-in screen inside the frame instead.
4. **Mid-build, if a check of the Published app shows its frame rule refusing an outside
   site, stop there.** That is the block above, not a bug in the app. Report it in plain
   words with the request to make, and do not write iframe code, resize scripts or embed
   panels in that turn.

An app that already carries an embed-code panel keeps it; mention the block the next time
the app builder brings embedding up, and offer the link alternative.
