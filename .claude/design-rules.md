# Design rules

<!-- Platform-owned: refreshed from the Stencil template before every build and imported by CLAUDE.md. -->

### When this applies

Before writing or restyling any UI: a screen, a component, `theme.css`, an image, an empty
state. Not for a loader, an action, a schema change or a question.

**On a component-library app these rules are second.** When the prompt has a "Component
library" or "Composing screens from the library" section, or `app/scaffolds/manifest.json`
exists, the library's rules win wherever they speak; use these rules only for what they
leave open.

### 1. Whose design it is

The app's look already belongs to someone. Highest first:

1. This turn's request.
2. The app builder's saved instructions.
3. `app/theme.css` (the Brand kit) and, when present, `app/components/design.tsx`.
4. The screens the app already has.
5. These rules.
6. The reference skills in section 9.

- A change to one screen matches the screens around it: same page frame, header, panel,
  badge, spacing and type. Never restyle a screen the request did not name.
- `design.tsx` is the app's design language. When it exists, every screen uses its
  `PageContainer`, `PageHeader`, `SectionHeading`, `Panel`, `StatusBadge`, `EmptyState` and
  `MetricStrip`, and never writes its own version of one. A new shared piece goes into
  `design.tsx`, not into a screen.
- The taste rules in section 10 are for new work in a new app. They never override 1–4.

### 2. Theme and Brand kit

- `app/theme.css` is the Brand kit. It is seeded from the stored Brand kit before every
  build and saved back after, so what you leave there is what the Brand kit page shows.
- A theme that is not the neutral grey default was chosen by the app builder: keep it.
  Only on the default, or when the brief names colours the theme lacks, write a palette.
- Saved values sit in `:root`; a trailing `/* Stencil Tweaks */ … /* /Stencil Tweaks */`
  block overrides them. Read to the end of the file. To change a token, change it in the
  Tweaks block when it is there AND in `:root` and `.dark`; a value written only above
  the block loses silently. Never delete the block or its markers.
- One theme file. Never a second theme file, store or loader. Never edit `app.css` for
  theme changes; a new variable in `theme.css` gets its `@theme inline` entry in `app.css`.
- Colours in `oklch()`, both `:root` and `.dark`. `--primary` is the brand colour (with
  `--primary-hover/-muted/-soft/-tint` at matching depth); `--accent` stays a muted hover
  tint, never the brand colour.
- Every text token reaches 4.5:1 against its surface (foreground/background,
  card-foreground/card, muted-foreground on background and card, each `*-foreground` on its
  fill). Muted text is a solid colour, never foreground at low opacity.
- Web fonts load with `@import url(...)` at the top of `theme.css`, nowhere else (never a
  `<link>` in `root.tsx`, never in `app.css`). Uploaded font files: see "Assets" in CLAUDE.md.
- Keep CSS out of backtick template literals: component styles go in `theme.css`, `app.css`
  or a CSS module, never a multi-line `` <style>{`…`}</style> `` block. If an inline `<style>`
  is truly unavoidable, use a single-quoted string (`<style>{'.x{display:none}'}</style>`).
  Never write a backtick inside a comment inside any template literal (a `<style>` block, a
  script served from a route): the backtick closes the string and the compile error points
  at the comment, not the cause.

### 3. Type

- `--font-display` (h1–h4) and `--font-sans` (body, UI) are a deliberate pair. Never leave
  both as Inter. Inter, Geist, DM Sans or Plus Jakarta Sans are fine as the body font.
- One family first, two at most. A second family only for genuine contrast (a serif display
  with a sans body, or a mono for code). Never pair two similar-weight, similar-width
  sans-serifs: the near-match reads as an error, not a choice.
- Headings take their weight from `--font-weight-display`; never hardcode `font-bold` on a
  heading. Adjacent heading levels differ in size and colour.
- Floors, all baked into `app.css`: text ≥ 14px (`text-xs` is 14px; never an arbitrary size
  below `0.875rem`), body 16px, body line-height 1.5–1.7, headings never below 1.1. Make
  small text recede with colour and weight, never size. No `leading-none` or `leading-tight`
  on a paragraph, label, caption, list item or button.
- Font sizes in `rem`/`em`, never `px`. Never disable zoom.
- Widened tracking (`0.08–0.15em`) only on all-caps labels, eyebrows and badges. Headings of
  40px and up tighten to `-0.02em` to `-0.04em`. No weight 300 body text. Display font never
  below 18px.
- At most four sizes on a screen (display, heading, body, small), at least 1.25× apart above
  body, and never two sizes closer than 2px. Below body there is one step, small, at the 14px
  floor, set apart by weight, colour and casing. Fixed `rem` sizes in app screens; `clamp()`
  only for landing and editorial headings, with its max at most 2.5× its min.
- Vertical spacing follows the 24px rhythm unit (16px body × 1.5): margins, gaps and
  padding in multiples of it (24, 48, 72).
- Running text is 60–75 characters wide (`max-w-prose` or a `ch` width), never full-bleed.
- `text-wrap: balance` (`text-balance`) on h1–h3, never on paragraphs.
- Numbers that update or sit in columns use `tabular-nums`, and numbers are never italic.
- Italic text with descenders (`y g j p q f`): line-height at least 1.1 and bottom padding on
  its container, or the descenders clip.
- Dark mode compensates on three axes: body line-height up 0.05–0.1, body letter-spacing up
  `0.01–0.02em`, body weight one step up (400 → 450–500 with a variable font).
- Fonts: `font-display: swap` on every `@font-face`; for above-the-fold text, match the
  fallback font's metrics (`size-adjust`, `ascent-override`, `descent-override`) so the swap
  does not reflow. Use a variable font from three weights up, with `font-optical-sizing:
  auto`; preload only the body weight; never load weights the app does not use.
- Prose or AI answers rendered as Markdown: enable `@plugin "@tailwindcss/typography"` in
  `app.css` and use `prose`.

### 4. Colour and tokens

- Every colour, radius and shadow comes from a token: surfaces `bg-background` →
  `bg-background-secondary` → `bg-card` → `bg-surface-elevated`; borders
  `border-border-subtle` → `-muted` → `border-border` → `-strong`; text `text-foreground` →
  `text-foreground-secondary` → `text-muted-foreground`. No hex, no arbitrary radius.
- Interactive states use `bg-surface-hover` and `bg-surface-active`. Focus uses
  `ring-focus-ring` (the soft alpha-blended ring); `ring-ring` is the full-opacity variant.
- `text-error` / `border-error` is form validation; `bg-destructive` is a danger button.
- Never pure `#000` text: a near-black with a slight hue cast. Never colour alone to carry
  meaning (status, active nav, disabled).

### 5. Surfaces, cards, backgrounds

- App screens (dashboards, lists, records, forms, settings) sit on solid token surfaces.
  Cards: load `general-card` for a titled content panel and `metric-card` for a KPI tile
  before writing one; never the raw shadcn `<Card>` for either.
- Marketing surfaces (landing hero, CTA band, pricing, sign-in and sign-up pages) are never
  a flat fill: a real photo or generated image first, then a background scaffold
  (`backgrounds/*` via `scaffolds_read`), then a multi-stop gradient.
- shadcn defaults are a starting point: adjust with `className`, never fork the component.

### 6. Layout and interaction

- Mobile-first and responsive: every grid or multi-column layout carries `sm:`/`md:`/`lg:`
  variants; no sideways scrolling on a phone.
- A navigation label is shown whole or cut after two lines with an ellipsis: never clipped
  by its slot, never a fixed width, never pushing the page sideways. Size each slot for the
  longest of the app's languages. A top bar entry stays on one line (`whitespace-nowrap`)
  and is never truncated: when the app name, the entries and the user menu do not fit one
  row at 768px, the shell is a sidebar. A sidebar or menu drawer entry wraps to a second
  line and ends in an ellipsis after two (`line-clamp-2 wrap-anywhere hyphens-auto` on the
  label, in a `min-w-0` box); its row grows with the label, never a fixed height, and the
  icon stays beside the first line. A phone bottom-bar tab follows `phone-app-shell`. A
  label that can be cut carries its full text as the link's `title`. A turn that adds or
  renames a nav entry, or adds a language, checks every entry of the shell against this.
- Use <Sheet> panels for forms, detail views and edit flows — never <Dialog> for those. Reserve <Dialog> for brief destructive confirmations. Import SheetBody from ~/components/ui/sheet and always use it inside SheetContent.
- Never hide a control behind hover. Every button, link and row action is visible at rest on every screen size: `opacity-0 group-hover:opacity-100` is unreachable on a touch
  screen, and a `:hover` rule that changes what a row shows costs an iPhone a wasted first
  tap. Hover may emphasise a control, never reveal it. Tailwind's `hover:` already applies
  only with a pointer; a hand-written `:hover` rule goes inside `@media (hover: hover)`. A
  tap gets immediate feedback (`active:` styles, optimistic state from `useFetcher`).
- Every button and standalone link can be tapped within 40×40px. `Button` extends its hit
  area to at least 40×40px with a transparent `after:` at every size, so compact sizes keep
  their look: use it (or `buttonVariants`) rather than a bare `<button>`. Buttons that sit
  side by side (a toolbar, table row actions) keep their own width so a tap never lands on
  the neighbour; keep them direct siblings rather than wrapping each in its own element. The
  extension still reaches above and below the box, so stack compact Buttons (a sidebar menu
  of `size="sm"` ghost Buttons) at `gap-2` or wider, and give a horizontally scrolling row of
  them (`overflow-x-auto`) `py-1.5` or `overflow-y-clip` so the overhang does not add a
  vertical scrollbar. Give nav, footer and card-action links a 40px tall box with padding
  (`py-2.5` on 14px text). Links inside a paragraph are exempt.
- Every action has hover, press and focus styles, and hover and press each change at least
  two cues: surface, border, shadow, icon, text weight or transform.
- Never centre-align body paragraphs.
- Never ship a control that does nothing; wire it or leave it out. Never `href="#"`.
- A page with more than two or three sections: one component file per section.

### 7. Images and icons

- Real-world subjects (people, places, food, products) are real photographs:
  `searchStockPhotos` → `placeStockPhoto` → `<UnsplashPhoto>`, per `stock-photos`. Never a
  hand-typed or hotlinked URL.
- `generateImage` only for what a camera cannot shoot (brand marks, illustration, abstract
  art, empty-state art); load `generate-image` before writing prompts.
- Every `<img>` has `alt`, `width`, `height`; `/assets/` and `/api/files/` pictures are
  drawn with `<StoredPhoto>`, which sizes and lazy-loads them (see "Assets" in CLAUDE.md).
- Icons: `react-icons`, one family for the whole app, never mixed. By kind of app: `hi2`
  (Heroicons v2: SaaS, dashboards), `fa6` (Font Awesome 6: marketing), `tb` (Tabler: dense
  tools), `pi` (Phosphor: consumer, editorial), `md` (Material Design). 16px inline / 20px in
  buttons / 24px standalone; weight is in the component name, never a `weight` prop. Never
  emoji as UI, no hand-drawn SVG icons. Never `lucide-react` in app code: it powers the
  shadcn/ui internals, so leave shadcn's own icon imports as they are.
- Every feature card, step or category has an icon.

### 8. States and motion

- Every list, grid, table and chart has an empty state: icon (48–64px, muted) or
  empty-state art, a heading, one line, one next action.
- Loading uses skeletons shaped like the final layout. Errors say the cause and offer a
  retry or a way out.
- App-screen motion 120–300ms (a landing page's load moment and scroll reveals follow the
  `landing-page` skill instead) on `transform` and `opacity`, using the `ease-*` / `duration-*`
  tokens. Never `transition: all`; never animate width, height or font-size. Gate every
  animation with `prefers-reduced-motion` (`motion-safe:`). Focus rings visible on keyboard focus.
- Before you finish, remove debug labels, "TODO", dummy copy and fake filenames. An input's
  `placeholder` is example format, not dummy copy, and stays.
- Nothing changes size on hover, press or a state change: a card, button, tab or row keeps
  its box, so the layout around it never jumps.

### 9. Reference skills — load the one for what you are building

| Building | Load |
|---|---|
| Titled content panel / KPI tile | `general-card` / `metric-card` |
| Dashboard | `dashboard` |
| Table of records | `data-table` |
| Calendar or schedule | `calendar` |
| Chart | `chart-rendering` |
| Map | `maps` |
| Form layout | `form-layout` |
| Empty or loading state | `empty-states` / `loading-skeleton` |
| Pricing or plans page | `pricing` |
| Admin area | `admin-area` |
| Landing page / hero / footer | `landing-page` / `heroes` / `footers` |
| Phone-first app shell | `phone-app-shell` |
| Long-form reading, CJK text | `editorial-typography`, `cjk-typography` |

### 10. Taste — new work in a new app

Only where sections 1–4 leave the choice open (default theme, a screen with no neighbours):

- Pick one tone and commit: one palette, one type pair, one radius, one density.
- Avoid the generated look: purple gradients on white, default Tailwind blue, an all-grey
  palette, a dark dashboard of four sparse metric cards, six identical icon-title-sentence
  feature cards, star-rating avatar testimonials, a three-column link footer, a rounded
  square with one letter as a logo.
- One signature moment per new app: a single designed element native to this app's
  subject, not something assembled from a scaffold.
- Realistic, specific content. Never Lorem ipsum, "John Doe", "Acme", or round filler
  numbers.
