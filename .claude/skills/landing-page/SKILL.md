---
name: landing-page
description: >
  Full marketing landing pages — hero + social proof + features + testimonial + CTA. Three variants: editorial-serif (Fraunces, generous whitespace), product-tech (dense feature grid, dark accents), and minimal- startup (single column, big type, single CTA). For just the hero section, use heroes.jsx instead.
metadata:
  agents: [builder]
---
## Wiring rules for a real app (read FIRST — these are what break in production, not the visuals)

The reference below is design guidance. When you add a landing page to an **actual Stencil app**, three wiring rules matter more than the layout. Getting rule 1 wrong ships a page that looks completely blank.

1. **`<Text>` is safe to prerender — but a prerendered page must be pure content.** Prerendering bakes the published `<Text>` copy into the HTML at build time, so a prerendered landing page shows its real headline, tagline, and button labels. What a prerendered route must **not** have is a `loader` that reads app data or a platform binding (DB, STORAGE, AUTH, payments…) — none of those exist during the build, and the route fails prerendering with a 500. Therefore:
   - Keep landing copy in `<Text>` as usual — it is the mandatory editable-strings path (see CLAUDE.md), and it prerenders correctly.
   - A landing page is safe to add to `prerender.ts` **only if** it is pure content with no data loader. If it needs a loader that reads app data, leave it SSR — do **NOT** add its path.
   - The root loader in `app/root.tsx` runs for every prerendered path too, so if anything is prerendered it must not read `context.cloudflare.env` (or any binding) unguarded.
   - Prerendering only takes effect on a production publish for an allowlisted app; otherwise the page just SSRs, so adding a path is at worst a no-op.

2. **The landing page must be reachable when logged out.** It usually replaces a home route that `redirect(...)`s into the authed app. Remove any auth loader/redirect from the landing route so a signed-out visitor sees the page — the `/` index should render the landing component directly, with no loader guard.

3. **Wire the CTAs to the real auth routes.** Primary CTA → `/signup`; secondary / "Sign in" → `/login`. These exist via `stencilAuthRoutes` in `routes.ts` — use `<Link to="/signup">` / `<Link to="/login">`. When the request names a button and where it should lead (a contract `Copy:` line, or the app builder's own words), use that label and that path verbatim instead; the auth routes are the fallback, not the rule. An app with no signed-in area at all (no `app` route in `routes.ts`) has nothing to sign into: its CTAs go to a contact section, a public page or an external address, never `/signup`, `/login` or `/app`.

4. **A waitlist or "notify me" form is the platform waitlist, never an entity.** Every app has one waitlist, owned by the platform: the hosted sign-up page feeds it on an invite-only app, and the app builder sees it on the Users page (More → Users), invites people from it and gets each join synced to Flodesk when it is connected. A landing-page form that collects interest ("join the waitlist", "notify me when we launch", "get early access") posts to a route action that calls `joinWaitlist` from `~stencil/waitlist` with the email, the optional name, a `source` naming the page and the `request` (so the platform can rate-limit by visitor), then shows a "you're on the list" state. Do **not** create a `waitlist` entity, a `waitlist` table or a `leads` table for it, and do not call `addToFlodesk` for it — the join already syncs. On an invite-only app the primary CTA may simply link to `/signup`, which shows the waitlist form itself.

   **Use the ready-made form first.** `<WaitlistForm source="landing-page" />` from `~stencil/ui/waitlist/form` is one email field and one button that already posts to the platform waitlist: no action, no table, no handler to write. It covers every email opt-in whose addresses only need collecting — a waitlist, a newsletter box, a "get the free guide" box, a footer sign-up — and it goes in a hero, a section, a footer, or inside a `Dialog` for a pop-up. Props: `source`, `buttonLabel`, `placeholder`, `successMessage`, `errorMessage`, `className`. It needs `...stencilWaitlistRoutes` (from `./.stencil/react-router/waitlist/routes`) in `app/routes.ts` above the catch-all; add the line when it is missing. Write the action below only when the form collects more than an email. The one opt-in that keeps a table of its own is a list the app itself emails (the `email` skill's opt-in column).

   **"Show me my sign-ups" is the Users page, not an admin page.** App code can add to the platform waitlist but cannot read it, so never create a sign-ups table, or write each join twice, to list them inside the app. Tell the app builder their sign-ups are in More → Users, on the Waitlist card.

```ts
// app/routes/landing.tsx — the form's action
import { joinWaitlist } from "~stencil/waitlist";

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const ok = await joinWaitlist(context.cloudflare.env, {
    email: String(form.get("email") ?? ""),
    name: String(form.get("name") ?? "") || null,
    source: "landing-page",
    request,
  });
  return { ok };
}
```

5. **An app that already keeps sign-ups in an entity of its own keeps them.** Apps built before the platform waitlist existed often have a table named like `waitlist`, `waitlist_signups` or `waitlist_entries`, or a form the app builder calls a waitlist, notify-me or early-access list, with real people in it. When you repoint that form at `joinWaitlist`, those rows do not move: a build has no way to add rows to the platform waitlist, so the Users page list starts empty and the two lists are separate. Leave the entity and every row in it exactly as they are — never delete, rename or empty it — and stop writing to it once the form posts to `joinWaitlist`. Count its rows with `queryRecords` before you finish, and say in your reply how many sign-ups are still in the entity, that new joins now land on the Users page, and that the old ones are not there. A build that touches neither the form nor the entity leaves both alone.

6. **A waitlist or newsletter box replies the same way for every address.** Its action stores the email and shows one message whether or not the address was already on the list. The platform waitlist sends nothing to the person who joins, so a `<WaitlistForm>` or a `joinWaitlist` form says "You're on the list" (the form's default `successMessage`) and never "Check your inbox" or any other promise of an email. Only a form whose own action sends an email (a welcome, a download link, a confirmation) says "Check your inbox", and that email carries the real outcome. A different message, an echoed name or a redirect for a known address tells any visitor who has signed up (CLAUDE.md, "A public form that takes an email").


7. **Real-world subjects are real photographs.** A hero or section that shows people, a place, food, a product in use or nature is a photo placed with the `stock-photos` skill (`searchStockPhotos` → `placeStockPhoto` → `<UnsplashPhoto>` from `~stencil/ui/photo/unsplash`), never a generated picture and never a hand-typed URL. Generated images stay for the brand mark, illustrations and abstract art. In a first build the contract's `Images:` line says `photo` or `generated` per slot and the `imagery` helper places the photos into `app/stock-photos.ts`; the page renders a photo slot as `<UnsplashPhoto {...PHOTOS.<name>} ratio="16/9" />` with `PHOTOS` from `~/stock-photos`, not as `/assets/<name>.png`. The hero photo gets `priority`. A photo's credit shows on hover (the default) and in one `<UnsplashCredits />` line (no props) in the page footer, which the platform renders at the end of the page when the page does not place it. Never put a permanent caption on a photo; `caption="always"` is for an app builder who asks for it. A decorative photo (background at reduced opacity, texture, colour wash) may take `caption="none"`; it is still named in the footer line.

8. **The page moves, a little, in the subject's own vocabulary.** Every landing page ships with a short load moment and quiet scroll reveals, drawn from what the subject physically is, never a stock fade pasted onto every page. The method:
   - **Find the motif.** The contract's `Motif:` line names it: three to five concrete things from the subject's physical world. On a later build with no contract, derive it from the brief and the "About this app" section of `CLAUDE.md` before you write. `Motif: none`, or a subject with no physical world, means the plain fallback: one staggered fade-and-rise on the hero and uniform section reveals.
   - **One signature moment, in the hero, on load.** 1.2 to 1.8 seconds in total, staggered, built from the motif: a line that draws itself, a dial that turns, a timer that counts, a shutter that opens, a card that is dealt. The headline, subline, hero image and primary CTA arrive inside it and are all present when it ends. CSS keyframes only.
   - **Scroll reveals stay quiet, and every section carries one.** Each section below the hero reveals once as it enters the viewport, in the same vocabulary and with the same timing, never on scroll back up. Every section below the hero carries the reveal class or utility, and inside a grid every card carries it with a short stagger across siblings (`animation-delay` or `animation-range` offsets). A reveal that is defined and applied to nothing is a failed page. Prefer the platform utilities in `~stencil/ui/library.css` when one fits the motif: `scroll-parallax` for a photo inside an `overflow-hidden` frame, `scroll-draw` for an SVG line with `pathLength="1"`, `scroll-fill` for a rule that fills in; each is already wrapped in `@supports` and `prefers-reduced-motion` and is still by default. Write a custom reveal only when none fits: CSS scroll-driven animation (`animation-timeline: view()`) inside an `@supports (animation-timeline: view())` query, so where it is unsupported the section is simply visible. No JavaScript scroll listener, no `IntersectionObserver` for motion. A section that appears hidden in a page check is a capture problem to report, never a reason to delete the reveal.
   - **Where the CSS lives.** Hero keyframes and any custom reveal go in `app/theme.css` under a `/* Landing page */` comment, or in an `app/routes/home.css` imported by the page (`import "./home.css"`; it is bundled, so the no-loader and prerender rule holds), never in a `<style>` block or a string constant in `home.tsx`.
   - **Pairings, so you see the move** (a listed motif is never reused for an unrelated subject):
     - Basketball league: half-court lines draw themselves under the headline; a 24-second shot clock counts down to the CTA; sections tip off into view.
     - Bakery: a proofing timer's hand sweeps as the hero rises; the photo is revealed like an oven door opening; sections dust in.
     - Photographer: a shutter iris opens on the hero photo (`clip-path: circle()`); sections arrive as frames on a contact sheet.
     - Running club: a route line draws across the hero (`stroke-dashoffset`); the CTA is a start-line that drops; sections stride in from the lane.
     - Card game: the hero photo and CTA are dealt onto the table with a small rotation; sections flip face up.
     - Garden centre: the headline grows up from the baseline; the hero photo unfolds like a leaf; sections sprout one row at a time.
     - Recording studio: a fader slides the hero up; a VU needle settles on the CTA; sections fade up along a track.
     - Tailor: a chalk line is drawn, then the hero photo is cut along it (`clip-path`); sections are pinned in with a short settle.
   - **Guardrails:**
     - Complete at rest. Every element exists in the DOM and ends at its natural state; nothing waits for scroll or script to appear. A full-page screenshot shows the finished page; the `screenshot` dev tool settles scroll reveals before it captures.
     - The headline, the hero image and the primary CTA are never gated behind scroll progress.
     - No pinned or sticky scene taller than one viewport. The page's height is its content's height.
     - Animate `transform`, `opacity`, `clip-path` and `stroke-dashoffset` only. Never `height`, `width`, `top`, `left` or `font-size`.
     - Load motion has its own scale: 600 to 900 ms per element, delays staggered so the whole hero sequence runs 1.2 to 1.8 s and ends with every element at rest. The theme's `--duration-*` tokens are sized for buttons, menus and drawers and stay for hover, press and focus states only; the `--ease-*` tokens still apply. Nothing loops except a subtle hint such as a scroll arrow.
     - `prefers-reduced-motion: reduce` shows the finished state at once, with no animation at all.
     - No animation library. No preloader or spinner screen.
---

Reference implementation — read before writing this UI surface.

```jsx
// when_to_use: Full marketing landing pages — hero + social proof + features
// + testimonial + CTA. Three variants: editorial-serif (Fraunces, generous
// whitespace), product-tech (dense feature grid, dark accents), and minimal-
// startup (single column, big type, single CTA). For just the hero section,
// use heroes.jsx instead.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  accent: '#CC785C',
  bg: '#fafaf7',
  ink: '#1a1a1a',
  muted: '#666666',
  panel: '#ffffff',
  rule: '#ece8df',
} /*EDITMODE-END*/;

const SERIF = "'Fraunces', 'DM Serif Display', Georgia, serif";
const SANS = "'DM Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const NUM = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: "'tnum'",
  fontStyle: 'normal',
};

function LandingEditorial({ tokens = {} }) {
  const t = { ...TWEAK_DEFAULTS, ...tokens };
  const features = [
    {
      eyebrow: '01',
      title: 'Speed',
      body: 'From idea to working prototype in an afternoon. The system holds while you move.',
    },
    {
      eyebrow: '02',
      title: 'Trust',
      body: 'Tokens, components, and content all version-controlled. Nothing drifts in private files.',
    },
    {
      eyebrow: '03',
      title: 'Craft',
      body: 'Designed by people who ship products, not by people who write framework manifestos.',
    },
  ];
  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: SANS }}>
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '24px 56px',
          alignItems: 'center',
          borderBottom: `1px solid ${t.rule}`,
        }}
      >
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500 }}>Field Studio</div>
        <div
          style={{ display: 'flex', gap: 28, fontSize: 14, alignItems: 'center', color: t.muted }}
        >
          <a style={{ color: 'inherit' }}>Work</a>
          <a style={{ color: 'inherit' }}>Journal</a>
          <a style={{ color: 'inherit' }}>About</a>
          <button
            style={{
              padding: '8px 18px',
              borderRadius: 999,
              background: t.ink,
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Contact
          </button>
        </div>
      </nav>
      <section style={{ padding: '120px 56px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: t.accent,
            marginBottom: 24,
          }}
        >
          Volume 03 — Spring 2026
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 'clamp(56px, 8vw, 104px)',
            lineHeight: 1.02,
            fontWeight: 400,
            letterSpacing: -2.5,
            margin: '0 0 32px',
            maxWidth: 980,
          }}
        >
          A studio for things <span style={{ fontStyle: 'italic' }}>that take time</span> to make
          right.
        </h1>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 80,
            alignItems: 'start',
          }}
        >
          <p style={{ fontSize: 19, color: t.muted, lineHeight: 1.6, margin: 0, maxWidth: 520 }}>
            We build product and brand systems for teams who care about the small details. No
            frameworks, no playbooks — just careful work, finished slowly.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              style={{
                padding: '16px 28px',
                borderRadius: 999,
                background: t.accent,
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              See selected work →
            </button>
            <button
              style={{
                padding: '16px 28px',
                borderRadius: 999,
                background: 'transparent',
                color: t.ink,
                border: `1px solid ${t.rule}`,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Read the journal
            </button>
          </div>
        </div>
      </section>
      <section
        style={{
          padding: '32px 56px',
          borderTop: `1px solid ${t.rule}`,
          borderBottom: `1px solid ${t.rule}`,
          background: t.panel,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 24,
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: t.muted,
            }}
          >
            Trusted by
          </span>
          {['Acme', 'Linear', 'Vercel', 'Notion', 'Figma'].map((n) => (
            <span
              key={n}
              style={{ fontFamily: SERIF, fontSize: 22, color: t.muted, fontWeight: 500 }}
            >
              {n}
            </span>
          ))}
        </div>
      </section>
      <section
        style={{
          padding: '96px 56px',
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 56,
        }}
      >
        {features.map((f) => (
          <div key={f.title}>
            <div
              style={{ fontFamily: MONO, fontSize: 12, color: t.accent, marginBottom: 16, ...NUM }}
            >
              {f.eyebrow}
            </div>
            <h3
              style={{
                fontFamily: SERIF,
                fontSize: 32,
                fontWeight: 400,
                margin: '0 0 12px',
                letterSpacing: -0.5,
              }}
            >
              {f.title}
            </h3>
            <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.65, margin: 0 }}>{f.body}</p>
          </div>
        ))}
      </section>
      <section
        style={{ padding: '80px 56px', background: t.ink, color: '#fff', textAlign: 'center' }}
      >
        <blockquote
          style={{
            fontFamily: SERIF,
            fontSize: 32,
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.4,
            margin: '0 auto 24px',
            maxWidth: 720,
          }}
        >
          "Field worked the brief like it mattered. The system they built still feels right two
          years on."
        </blockquote>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          Sara Lin · Head of Design, Loom
        </div>
      </section>
    </div>
  );
}

function LandingProductTech({ tokens = {} }) {
  const t = {
    ...TWEAK_DEFAULTS,
    accent: '#6366f1',
    ink: '#0b1020',
    muted: '#94a3b8',
    bg: '#fafafe',
  };
  const stats = [
    ['240+', 'Components'],
    ['98.99%', 'Uptime · 90d'],
    ['<50', 'ms · p95'],
    ['12k+', 'Teams'],
  ];
  const features = [
    {
      i: '⚡',
      title: 'Edge runtime',
      body: 'Cold starts under 30 ms in 18 regions. Zero config required.',
    },
    { i: '🛡️', title: 'SSO + audit', body: 'SAML, SCIM, and granular audit logs ready on day one.' },
    { i: '🔌', title: 'Open APIs', body: 'REST and GraphQL with typed SDKs for TS, Python, Go.' },
    {
      i: '📊',
      title: 'Live insights',
      body: 'Real-time dashboards. Custom metrics. Instant alerts.',
    },
    {
      i: '🤝',
      title: 'Team handoff',
      body: 'Comment on anything. Resolve threads. Ship together.',
    },
    {
      i: '🌍',
      title: 'Global by default',
      body: 'i18n primitives, RTL support, locale-aware formatting.',
    },
  ];
  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: SANS }}>
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '18px 40px',
          alignItems: 'center',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}
        >
          <span style={{ width: 24, height: 24, borderRadius: 6, background: t.accent }} /> Vector
        </div>
        <div
          style={{ display: 'flex', gap: 24, fontSize: 14, color: t.muted, alignItems: 'center' }}
        >
          <a style={{ color: 'inherit' }}>Product</a>
          <a style={{ color: 'inherit' }}>Pricing</a>
          <a style={{ color: 'inherit' }}>Docs</a>
          <a style={{ color: 'inherit' }}>Customers</a>
          <button
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              background: t.accent,
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Start free
          </button>
        </div>
      </nav>
      <section
        style={{ padding: '80px 40px', maxWidth: 1080, margin: '0 auto', textAlign: 'center' }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 20,
            background: `${t.accent}15`,
            color: t.accent,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 24,
            letterSpacing: 0.3,
          }}
        >
          New · v3 just shipped
        </div>
        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: -1.5,
            margin: '0 0 20px',
          }}
        >
          Ship faster.
          <br />
          Sleep better.
        </h1>
        <p
          style={{
            fontSize: 18,
            color: t.muted,
            maxWidth: 560,
            margin: '0 auto 32px',
            lineHeight: 1.6,
          }}
        >
          The infrastructure platform that handles edge, auth, and observability so your team can
          focus on the product.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            style={{
              padding: '14px 28px',
              borderRadius: 10,
              background: t.ink,
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Start free →
          </button>
          <button
            style={{
              padding: '14px 28px',
              borderRadius: 10,
              background: '#fff',
              color: t.ink,
              border: '1px solid #e5e7eb',
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Read docs
          </button>
        </div>
        <div
          style={{ marginTop: 56, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}
        >
          {stats.map(([v, l]) => (
            <div key={l}>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, ...NUM }}>{v}</div>
              <div
                style={{
                  fontSize: 12,
                  color: t.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginTop: 4,
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ padding: '80px 40px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 12px', letterSpacing: -1 }}>
            Everything you'd build, already built.
          </h2>
          <p style={{ fontSize: 16, color: t.muted }}>The boring infrastructure, done well.</p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            background: '#e5e7eb',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
          }}
        >
          {features.map((f) => (
            <div key={f.title} style={{ background: '#fff', padding: '32px 28px' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${t.accent}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  fontSize: 18,
                }}
              >
                {f.i}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.6, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LandingMinimalStartup({ tokens = {} }) {
  const t = { ...TWEAK_DEFAULTS, ...tokens, bg: '#fffef9', ink: '#0a0a0a', accent: '#000' };
  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: SANS, minHeight: 600 }}>
      <nav
        style={{
          padding: '32px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, letterSpacing: -0.5 }}>
          monolith
        </div>
        <a style={{ fontSize: 13, color: '#666' }}>hello@monolith.studio</a>
      </nav>
      <section style={{ padding: '120px 48px 80px', maxWidth: 720, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 'clamp(48px, 7vw, 84px)',
            lineHeight: 1.04,
            fontWeight: 400,
            letterSpacing: -2,
            margin: '0 0 32px',
          }}
        >
          One product. One promise. <span style={{ fontStyle: 'italic' }}>No fluff.</span>
        </h1>
        <p
          style={{
            fontSize: 19,
            color: '#444',
            lineHeight: 1.7,
            margin: '0 0 48px',
            maxWidth: 560,
          }}
        >
          The simplest way to write, edit, and publish technical documentation. Markdown in,
          beautiful site out, version-controlled the entire way.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button
            style={{
              padding: '14px 32px',
              borderRadius: 8,
              background: t.accent,
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Try it free
          </button>
          <a
            style={{
              fontSize: 14,
              color: '#666',
              borderBottom: '1px solid currentColor',
              paddingBottom: 2,
            }}
          >
            See it in action →
          </a>
        </div>
        <div
          style={{
            marginTop: 80,
            paddingTop: 32,
            borderTop: '1px solid #e0d8c8',
            fontSize: 12,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#999',
          }}
        >
          Made in Brooklyn · Est. 2024
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { LandingEditorial, LandingProductTech, LandingMinimalStartup });

function Label({ name }) {
  return (
    <div
      style={{
        padding: '8px 20px',
        background: '#0a0a0a',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: 'uppercase',
        fontFamily: SANS,
      }}
    >
      {name}
    </div>
  );
}

function App() {
  return (
    <div style={{ minHeight: '100%' }}>
      <Label name="LandingEditorial" />
      <LandingEditorial />
      <Label name="LandingProductTech" />
      <LandingProductTech />
      <Label name="LandingMinimalStartup" />
      <LandingMinimalStartup />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

```
