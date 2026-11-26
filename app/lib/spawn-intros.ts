// How each of the 16 fighters enters a fight. Before READY / FIGHT every fighter plays its own entrance:
// how its body appears (offset, fade, squash, a solid tint), the pose it holds, the particle bursts it throws
// and a drawing behind and in front of it. The engine (`arena-engine.ts`) times and plays them; a hybrid,
// a team-attack fighter or a juggernaut uses the entrance of the element it carries.
import type { Power, BossDesign } from "./fighters";
import { drawCrane, type PShape } from "./move-looks";

/** Seconds one entrance lasts. */
export const INTRO_LEN = 1.5;
/** Share of the entrance after which the fighter counts as arrived (health bar and team ring show). */
export const INTRO_ARRIVED = 0.7;

export type IntroPose = "stance" | "air" | "crouch" | "rise" | "flex" | "land" | "guard" | "float";

/** How the body shows at one moment. Offsets and squash are measured from the feet. */
export type IntroBody = {
  dx: number; dy: number; alpha: number; sx: number; sy: number;
  pose: IntroPose;
  /** A flat colour laid over the body (frozen, glowing, shadow, metal) and how strongly. */
  solid?: string; solidA?: number;
  /** Hide anything below the floor line (rising out of the ground). */
  clip?: boolean;
  /** Copies of the body either side, closing in (Chrono). */
  echo?: { spread: number; alpha: number };
};

export type IntroBurst = {
  at: number; n: number; spd: number; shape: PShape; a: string; b: string; grav: number; add: boolean;
  from: "feet" | "body" | "sky";
  /** up: a cone upwards; out: every way; flat: along the floor; in: from a ring, closing on the body. */
  dir: "up" | "out" | "flat" | "in";
  spread?: number; size?: [number, number]; life?: number;
};

export type IntroDraw = {
  ctx: CanvasRenderingContext2D;
  /** Where the fighter will stand, the floor line, its scale, the entrance's progress 0..1, seconds in, facing. */
  x: number; y: number; ground: number; s: number; u: number; t: number; face: number;
  body: IntroBody;
};

export type IntroSpec = {
  /** Seconds this entrance lasts, when it is not the usual `INTRO_LEN` (a boss takes its time). */
  len?: number;
  /** The moment it lands: the entrance sound, screen shake and an optional blast ring. */
  hit: number; shake: number; wave?: [string, string];
  body(u: number, s: number): IntroBody;
  bursts: IntroBurst[];
  /** A steady stream of particles until `until`. */
  trickle?: Omit<IntroBurst, "at" | "n"> & { rate: number; until: number };
  back?(d: IntroDraw): void;
  front?(d: IntroDraw): void;
};

// ---------- helpers ----------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const seg = (u: number, a: number, b: number) => clamp((u - a) / (b - a), 0, 1);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeIn = (k: number) => k * k;
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const hsla = (h: number, s: number, l: number, a: number) => `hsl(${h} ${s}% ${l}% / ${clamp(a, 0, 1)})`;
const base = (pose: IntroPose, o: Partial<IntroBody> = {}): IntroBody => ({ dx: 0, dy: 0, alpha: 1, sx: 1, sy: 1, pose, ...o });
/** Stable wobble for a seed, so a drawing does not jitter randomly between frames unless it should. */
const wob = (seed: number) => Math.sin(seed * 12.9898) * 0.5 + Math.sin(seed * 4.1414) * 0.5;
/** Rising, ready, then the normal stance: the tail every entrance ends on. */
const settle = (u: number, held: IntroPose, until: number): IntroPose => (u < until ? held : u < 0.86 ? "flex" : "stance");

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, inner: string, outer: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A jagged line from one point to another; `seed` changes the zigzag. */
function jag(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, parts: number, amp: number, seed: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let i = 1; i < parts; i++) {
    const k = i / parts;
    const o = wob(seed + i * 3.7) * amp;
    ctx.lineTo(x0 + dx * k + nx * o, y0 + dy * k + ny * o);
  }
  ctx.lineTo(x1, y1);
}

// ---------- the entrances ----------
export const INTROS: Record<Power, IntroSpec> = {
  // Pyro: a column of fire roars up and Pyro steps out of it, still white-hot.
  pyro: {
    hit: 0.45, shake: 7, wave: ["hsl(14 95% 55%)", "hsl(45 100% 65%)"],
    body: (u) => base(settle(u, "rise", 0.62), { alpha: seg(u, 0.18, 0.42), solid: "hsl(42 100% 72%)", solidA: 1 - seg(u, 0.42, 0.72) }),
    bursts: [
      { at: 0, n: 12, spd: 220, shape: "ember", a: "hsl(22 95% 55%)", b: "hsl(45 100% 62%)", grav: -200, add: true, from: "feet", dir: "up" },
      { at: 0.45, n: 34, spd: 560, shape: "ember", a: "hsl(14 95% 55%)", b: "hsl(48 100% 66%)", grav: -160, add: true, from: "body", dir: "out" },
      { at: 0.45, n: 14, spd: 320, shape: "dot", a: "hsl(30 100% 60%)", b: "hsl(52 100% 80%)", grav: -260, add: true, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 45, until: 0.75, spd: 260, shape: "ember", a: "hsl(20 95% 55%)", b: "hsl(46 100% 64%)", grav: -300, add: true, from: "feet", dir: "up", spread: 30 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const grow = easeOut(seg(u, 0, 0.32));
      const fade = 1 - seg(u, 0.5, 0.9);
      if (grow <= 0 || fade <= 0) return;
      const h = 290 * s * grow;
      const w = 44 * s * (1 + 0.35 * seg(u, 0.38, 0.5)) * (0.4 + 0.6 * fade);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, ground + 2, w * 2.4, 14 * s, hsla(30, 100, 60, 0.7 * fade), hsla(14, 95, 50, 0));
      for (const [k, h0, l] of [[1, 14, 52], [0.55, 44, 70]] as const) {
        const ww = w * k;
        ctx.beginPath();
        ctx.moveTo(x - ww, ground);
        for (let i = 1; i <= 8; i++) {
          const yy = ground - (h * i) / 8;
          ctx.lineTo(x - ww * (1 - (i / 8) * 0.7) + Math.sin(t * 22 + i * 1.7) * 6 * s, yy);
        }
        ctx.lineTo(x + Math.sin(t * 30) * 8 * s, ground - h * 1.08);
        for (let i = 8; i >= 1; i--) {
          const yy = ground - (h * i) / 8;
          ctx.lineTo(x + ww * (1 - (i / 8) * 0.7) + Math.sin(t * 19 + i * 2.3) * 6 * s, yy);
        }
        ctx.lineTo(x + ww, ground);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, ground, 0, ground - h);
        g.addColorStop(0, hsla(h0, 100, l, 0.95 * fade));
        g.addColorStop(0.7, hsla(h0 + 20, 100, l + 8, 0.6 * fade));
        g.addColorStop(1, hsla(h0 + 30, 100, l + 15, 0));
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // Cryo: an ice crystal grows around Cryo, cracks and shatters.
  cryo: {
    hit: 0.55, shake: 6, wave: ["hsl(195 85% 75%)", "hsl(0 0% 100%)"],
    body: (u) => base(u < 0.55 ? "guard" : settle(u, "flex", 0.75), { alpha: seg(u, 0.1, 0.3), solid: "hsl(195 85% 86%)", solidA: u < 0.55 ? 0.65 : 0 }),
    bursts: [
      { at: 0, n: 14, spd: 160, shape: "flake", a: "hsl(195 85% 80%)", b: "hsl(0 0% 100%)", grav: -40, add: false, from: "feet", dir: "up" },
      { at: 0.55, n: 38, spd: 600, shape: "shard", a: "hsl(198 80% 72%)", b: "hsl(190 100% 94%)", grav: 700, add: false, from: "body", dir: "out" },
      { at: 0.55, n: 18, spd: 300, shape: "flake", a: "hsl(195 85% 85%)", b: "hsl(0 0% 100%)", grav: 60, add: false, from: "body", dir: "out" },
    ],
    back: ({ ctx, x, ground, s, u }) => {
      const k = easeOut(seg(u, 0, 0.3)) * (1 - seg(u, 0.7, 1));
      if (k <= 0) return;
      glow(ctx, x, ground + 3, 80 * s * k, 12 * s, hsla(195, 90, 92, 0.75 * k), hsla(200, 80, 80, 0));
    },
    front: ({ ctx, x, ground, s, u, t }) => {
      if (u >= 0.55) return;
      const h = 132 * s * easeOut(seg(u, 0, 0.36));
      if (h <= 1) return;
      const pts: [number, number][] = [[-36, 0], [-42, 0.68], [-14, 1], [18, 0.93], [42, 0.6], [34, 0]];
      ctx.save();
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * s, ground - py * h) : ctx.moveTo(x + px * s, ground - py * h)));
      ctx.closePath();
      const g = ctx.createLinearGradient(x - 40 * s, ground - h, x + 40 * s, ground);
      g.addColorStop(0, hsla(190, 100, 95, 0.55));
      g.addColorStop(1, hsla(205, 80, 70, 0.4));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = hsla(0, 0, 100, 0.9);
      ctx.lineWidth = 2.5 * s;
      ctx.stroke();
      // facets
      ctx.strokeStyle = hsla(190, 100, 96, 0.6);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(x - 14 * s, ground - h); ctx.lineTo(x - 4 * s, ground);
      ctx.moveTo(x + 18 * s, ground - 0.93 * h); ctx.lineTo(x + 12 * s, ground);
      ctx.stroke();
      // side crystals
      for (const [ox, hh, lean] of [[-50, 0.45, -0.3], [48, 0.36, 0.3]] as const) {
        ctx.beginPath();
        ctx.moveTo(x + (ox - 9) * s, ground);
        ctx.lineTo(x + (ox + lean * 40) * s, ground - hh * h);
        ctx.lineTo(x + (ox + 9) * s, ground);
        ctx.closePath();
        ctx.fillStyle = hsla(198, 85, 82, 0.6);
        ctx.fill();
        ctx.stroke();
      }
      // cracks just before it breaks
      const c = seg(u, 0.4, 0.55);
      if (c > 0) {
        ctx.strokeStyle = hsla(0, 0, 100, 0.95);
        ctx.lineWidth = 2 * s;
        for (let i = 0; i < 4; i++) {
          const a = i * 1.6 + 0.4;
          const len = 46 * s * c;
          jag(ctx, x, ground - h * 0.55, x + Math.cos(a) * len, ground - h * 0.55 + Math.sin(a) * len, 4, 5 * s, i);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },

  // Electro: a lightning bolt strikes the spot and Electro is crouched in the flash.
  electro: {
    hit: 0.3, shake: 11, wave: ["hsl(52 100% 58%)", "hsl(0 0% 100%)"],
    body: (u) => base(u < 0.62 ? "land" : settle(u, "flex", 0.8), { alpha: u < 0.3 ? 0 : 1, solid: "hsl(0 0% 100%)", solidA: 1 - seg(u, 0.32, 0.5) }),
    bursts: [
      { at: 0.3, n: 32, spd: 640, shape: "spark", a: "hsl(52 100% 60%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "feet", dir: "out" },
      { at: 0.3, n: 14, spd: 380, shape: "bolt", a: "hsl(50 100% 58%)", b: "hsl(58 100% 88%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    trickle: { rate: 40, until: 0.28, spd: 200, shape: "spark", a: "hsl(52 100% 60%)", b: "hsl(58 100% 90%)", grav: 0, add: true, from: "feet", dir: "up", spread: 26 },
    back: ({ ctx, x, ground, s, u, t }) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      if (u < 0.3) {
        // charge crackling on the floor
        const k = seg(u, 0, 0.3);
        glow(ctx, x, ground, 50 * s * k, 10 * s, hsla(55, 100, 80, 0.6 * k), hsla(50, 100, 60, 0));
        ctx.strokeStyle = hsla(55, 100, 80, 0.8 * k);
        ctx.lineWidth = 2 * s;
        const seed = Math.floor(t * 24);
        for (let i = 0; i < 2; i++) {
          jag(ctx, x - 40 * s, ground - 4, x + 40 * s, ground - 4 - 20 * s * (i + 1) * k, 6, 9 * s, seed + i * 11);
          ctx.stroke();
        }
      }
      const strike = 1 - seg(u, 0.3, 0.52);
      if (u >= 0.27 && strike > 0) {
        const seed = Math.floor(t * 30);
        const top = -20;
        ctx.strokeStyle = hsla(50, 100, 60, 0.8 * strike);
        ctx.lineWidth = 22 * s * strike;
        jag(ctx, x + 40 * s, top, x, ground - 10 * s, 9, 26 * s, seed);
        ctx.stroke();
        ctx.strokeStyle = hsla(0, 0, 100, strike);
        ctx.lineWidth = 7 * s;
        ctx.stroke();
        // a branch
        ctx.lineWidth = 3 * s;
        jag(ctx, x + 30 * s, (ground + top) * 0.4, x - 70 * s, ground * 0.62, 5, 14 * s, seed + 5);
        ctx.stroke();
        glow(ctx, x, ground - 20 * s, 130 * s, 70 * s, hsla(55, 100, 92, 0.7 * strike), hsla(50, 100, 60, 0));
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u, t }) => {
      const k = seg(u, 0.3, 0.35) * (1 - seg(u, 0.6, 0.95));
      if (k <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hsla(55, 100, 82, 0.9 * k);
      ctx.lineWidth = 2.2 * s;
      const seed = Math.floor(t * 18);
      for (let i = 0; i < 3; i++) {
        const a0 = wob(seed + i) * Math.PI, a1 = a0 + 1.4;
        const cy = y - 55 * s;
        jag(ctx, x + Math.cos(a0) * 34 * s, cy + Math.sin(a0) * 46 * s, x + Math.cos(a1) * 34 * s, cy + Math.sin(a1) * 46 * s, 4, 8 * s, seed * 3 + i);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Terra: the floor cracks, rock spikes burst up and Terra climbs out of the ground.
  terra: {
    hit: 0.3, shake: 13,
    body: (u, s) => base(settle(u, "rise", 0.66), { clip: true, alpha: u < 0.3 ? 0 : 1, dy: (1 - easeOut(seg(u, 0.3, 0.56))) * 125 * s }),
    bursts: [
      { at: 0.04, n: 10, spd: 160, shape: "dust", a: "hsl(34 30% 55%)", b: "hsl(40 40% 75%)", grav: -20, add: false, from: "feet", dir: "flat" },
      { at: 0.3, n: 30, spd: 660, shape: "chunk", a: "hsl(28 40% 38%)", b: "hsl(36 40% 62%)", grav: 1400, add: false, from: "feet", dir: "up" },
      { at: 0.3, n: 18, spd: 300, shape: "dust", a: "hsl(34 30% 55%)", b: "hsl(40 45% 78%)", grav: -30, add: false, from: "feet", dir: "flat" },
    ],
    back: ({ ctx, x, ground, s, u }) => {
      const k = easeOut(seg(u, 0, 0.3));
      const fade = 1 - seg(u, 0.75, 1);
      if (k <= 0 || fade <= 0) return;
      ctx.save();
      ctx.strokeStyle = hsla(28, 45, 16, 0.85 * fade);
      ctx.lineWidth = 3 * s;
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const dir = i % 2 ? 1 : -1;
        const len = (60 + (i % 3) * 30) * s * k;
        const yy = ground + 4 + (i % 3) * 14;
        jag(ctx, x, ground + 2, x + dir * len, yy + (i > 2 ? 10 : 0), 5, 5 * s, i * 7);
        ctx.stroke();
      }
      ctx.restore();
    },
    front: ({ ctx, x, ground, s, u }) => {
      const up = easeOut(seg(u, 0.3, 0.42)) * (1 - seg(u, 0.74, 1));
      if (up <= 0) return;
      ctx.save();
      for (const [ox, hh, w] of [[-58, 52, 16], [-30, 76, 18], [34, 70, 17], [60, 46, 14], [-4, 34, 12]] as const) {
        const h = hh * s * up;
        ctx.beginPath();
        ctx.moveTo(x + (ox - w) * s, ground + 4);
        ctx.lineTo(x + (ox + w * 0.2) * s, ground - h);
        ctx.lineTo(x + (ox + w) * s, ground + 4);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, ground - h, 0, ground);
        g.addColorStop(0, "hsl(34 35% 58%)");
        g.addColorStop(1, "hsl(24 40% 30%)");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "hsl(250 32% 14%)";
        ctx.lineWidth = 3 * s;
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Aero: rides a whirlwind down from the sky and lands lightly.
  aero: {
    hit: 0.55, shake: 3,
    body: (u, s) => base(u < 0.55 ? "air" : settle(u, "crouch", 0.7), { alpha: seg(u, 0, 0.15), dy: -(1 - easeOut(seg(u, 0, 0.55))) * 290 * s }),
    bursts: [
      { at: 0.55, n: 26, spd: 420, shape: "dust", a: "hsl(170 40% 80%)", b: "hsl(0 0% 100%)", grav: -20, add: false, from: "feet", dir: "flat" },
      { at: 0.55, n: 12, spd: 300, shape: "leaf", a: "hsl(150 45% 55%)", b: "hsl(90 50% 60%)", grav: 80, add: false, from: "feet", dir: "out" },
    ],
    trickle: { rate: 30, until: 0.55, spd: 220, shape: "leaf", a: "hsl(150 45% 55%)", b: "hsl(170 60% 80%)", grav: -60, add: false, from: "feet", dir: "up", spread: 60 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const fade = seg(u, 0, 0.12) * (1 - seg(u, 0.55, 0.88));
      if (fade <= 0) return;
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < 11; i++) {
        const yy = ground - i * 30 * s;
        const rx = (10 + i * i * 0.75) * s;
        const ox = Math.sin(t * 7 + i * 0.6) * (4 + i) * s;
        const spin = t * 14 + i;
        ctx.strokeStyle = hsla(168, 55, 78 + (i % 2) * 12, 0.55 * fade);
        ctx.lineWidth = (2 + (i % 3)) * s;
        ctx.beginPath();
        ctx.ellipse(x + ox, yy, rx, rx * 0.22 + 3, 0, spin % (Math.PI * 2), (spin % (Math.PI * 2)) + Math.PI * 1.3);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Hydro: a whirlpool opens, a geyser shoots up and Hydro rides it out, splashing down.
  hydro: {
    hit: 0.25, shake: 5,
    body: (u, s) => {
      const dy = u < 0.45 ? lerp(70, -175, easeOut(seg(u, 0.25, 0.45))) : -175 * (1 - easeIn(seg(u, 0.45, 0.7)));
      return base(u < 0.7 ? "air" : settle(u, "crouch", 0.8), { clip: true, alpha: u < 0.25 ? 0 : 1, dy: dy * s });
    },
    bursts: [
      { at: 0.25, n: 30, spd: 720, shape: "drop", a: "hsl(205 90% 58%)", b: "hsl(195 100% 88%)", grav: 1400, add: false, from: "feet", dir: "up" },
      { at: 0.7, n: 26, spd: 440, shape: "drop", a: "hsl(210 90% 55%)", b: "hsl(195 100% 85%)", grav: 1100, add: false, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 26, until: 0.25, spd: 90, shape: "bubble", a: "hsl(205 90% 70%)", b: "hsl(190 100% 92%)", grav: -120, add: false, from: "feet", dir: "up", spread: 40 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const pool = easeOut(seg(u, 0, 0.22)) * (1 - seg(u, 0.75, 1));
      ctx.save();
      if (pool > 0) {
        ctx.fillStyle = hsla(210, 85, 45, 0.7 * pool);
        ctx.beginPath();
        ctx.ellipse(x, ground + 3, 62 * s * pool, 12 * s * pool, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hsla(195, 100, 85, 0.8 * pool);
        ctx.lineWidth = 2 * s;
        for (let i = 0; i < 3; i++) {
          const a = t * 9 + i * 2.1;
          ctx.beginPath();
          ctx.ellipse(x, ground + 3, (20 + i * 14) * s * pool, (4 + i * 2.6) * s * pool, 0, a, a + 2.2);
          ctx.stroke();
        }
      }
      const col = seg(u, 0.24, 0.32) * (1 - seg(u, 0.5, 0.68));
      if (col > 0) {
        const h = 240 * s * easeOut(seg(u, 0.24, 0.42));
        const w = 26 * s * col;
        const g = ctx.createLinearGradient(0, ground, 0, ground - h);
        g.addColorStop(0, hsla(212, 90, 48, 0.9));
        g.addColorStop(0.8, hsla(198, 95, 70, 0.85));
        g.addColorStop(1, hsla(190, 100, 92, 0.2));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w, ground);
        ctx.quadraticCurveTo(x - w * 0.6 + Math.sin(t * 20) * 4 * s, ground - h * 0.5, x - w * 0.8, ground - h);
        ctx.lineTo(x + w * 0.8, ground - h);
        ctx.quadraticCurveTo(x + w * 0.6 + Math.sin(t * 17) * 4 * s, ground - h * 0.5, x + w, ground);
        ctx.closePath();
        ctx.fill();
        // foam crown
        ctx.fillStyle = hsla(195, 100, 94, 0.9 * col);
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(x + i * 11 * s, ground - h - Math.abs(Math.sin(t * 16 + i)) * 10 * s, (9 - Math.abs(i) * 1.5) * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
  },

  // Umbra: a pool of shadow spreads and Umbra rises out of it as a silhouette, then takes colour.
  umbra: {
    hit: 0.58, shake: 2,
    body: (u, s) => base(settle(u, "crouch", 0.62), { clip: true, alpha: u < 0.18 ? 0 : 1, dy: (1 - easeOut(seg(u, 0.18, 0.56))) * 125 * s, solid: "hsl(268 50% 9%)", solidA: 1 - seg(u, 0.58, 0.82) }),
    bursts: [
      { at: 0.58, n: 24, spd: 340, shape: "smoke", a: "hsl(275 55% 20%)", b: "hsl(285 75% 58%)", grav: -60, add: false, from: "body", dir: "out" },
    ],
    trickle: { rate: 40, until: 0.72, spd: 120, shape: "smoke", a: "hsl(270 60% 14%)", b: "hsl(285 70% 45%)", grav: -90, add: false, from: "feet", dir: "up", spread: 50 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const k = easeOut(seg(u, 0, 0.2)) * (1 - seg(u, 0.72, 1));
      if (k <= 0) return;
      ctx.save();
      glow(ctx, x, ground + 3, 80 * s * k, 16 * s * k, hsla(285, 80, 55, 0.5 * k), hsla(275, 60, 30, 0));
      ctx.fillStyle = hsla(268, 55, 7, 0.9 * k);
      ctx.beginPath();
      ctx.ellipse(x, ground + 3, 64 * s * k, 12 * s * k, 0, 0, Math.PI * 2);
      ctx.fill();
      // tendrils curling up out of the pool
      ctx.strokeStyle = hsla(270, 55, 12, 0.85 * k);
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const bx = x + (i - 2) * 24 * s;
        const h = (40 + (i % 2) * 30) * s * k;
        ctx.lineWidth = (6 - Math.abs(i - 2)) * s;
        ctx.beginPath();
        ctx.moveTo(bx, ground);
        ctx.quadraticCurveTo(bx + Math.sin(t * 6 + i) * 18 * s, ground - h * 0.6, bx + Math.sin(t * 4 + i * 2) * 12 * s, ground - h);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Lux: a beam of light comes down and Lux forms inside it, glowing, then lands.
  lux: {
    hit: 0.18, shake: 2,
    body: (u, s) => base(settle(u, "rise", 0.62), { alpha: seg(u, 0.15, 0.4), dy: -(1 - easeOut(seg(u, 0.15, 0.6))) * 95 * s, solid: "hsl(52 100% 96%)", solidA: 1 - seg(u, 0.5, 0.78) }),
    bursts: [
      { at: 0.55, n: 28, spd: 440, shape: "star", a: "hsl(48 100% 70%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    trickle: { rate: 34, until: 0.55, spd: 60, shape: "star", a: "hsl(50 100% 75%)", b: "hsl(0 0% 100%)", grav: 260, add: true, from: "sky", dir: "out", spread: 34, life: 1.2 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const w = 74 * s * easeOut(seg(u, 0, 0.18)) * (1 - seg(u, 0.55, 0.92));
      if (w <= 0.5) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, hsla(50, 100, 70, 0));
      g.addColorStop(0.35, hsla(50, 100, 78, 0.4));
      g.addColorStop(0.5, hsla(55, 100, 96, 0.85));
      g.addColorStop(0.65, hsla(50, 100, 78, 0.4));
      g.addColorStop(1, hsla(50, 100, 70, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w, -20, w * 2, ground + 20);
      ctx.strokeStyle = hsla(0, 0, 100, 0.5);
      ctx.lineWidth = 1.5 * s;
      for (let i = 0; i < 4; i++) {
        const ox = Math.sin(t * 3 + i * 1.9) * w * 0.7;
        ctx.beginPath();
        ctx.moveTo(x + ox, -20);
        ctx.lineTo(x + ox, ground);
        ctx.stroke();
      }
      glow(ctx, x, ground + 2, w * 1.8, 14 * s, hsla(52, 100, 90, 0.8), hsla(50, 100, 70, 0));
      ctx.restore();
    },
  },

  // Gravi: drops from far above like a meteor and lands in a crater.
  gravi: {
    hit: 0.35, shake: 15, wave: ["hsl(250 80% 62%)", "hsl(250 90% 85%)"],
    body: (u, s) => {
      const fall = seg(u, 0, 0.35);
      const squash = u >= 0.35 && u < 0.45 ? 1 - Math.sin(seg(u, 0.35, 0.45) * Math.PI) * 0.18 : 1;
      return base(u < 0.35 ? "air" : settle(u, "land", 0.72), {
        alpha: u < 0.01 ? 0 : 1, dy: -(1 - easeIn(fall)) * 640 * s,
        sx: u < 0.35 ? 0.88 : 2 - squash, sy: u < 0.35 ? 1.18 : squash,
      });
    },
    bursts: [
      { at: 0.35, n: 30, spd: 620, shape: "chunk", a: "hsl(250 20% 30%)", b: "hsl(250 30% 55%)", grav: 1300, add: false, from: "feet", dir: "up" },
      { at: 0.35, n: 16, spd: 360, shape: "ring", a: "hsl(245 80% 65%)", b: "hsl(250 90% 85%)", grav: 0, add: true, from: "feet", dir: "flat" },
    ],
    back: ({ ctx, x, y, ground, s, u, body }) => {
      ctx.save();
      if (u < 0.35 && u > 0.01) {
        // a falling streak and warped rings around the body
        const by = y + body.dy;
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createLinearGradient(0, by - 260 * s, 0, by - 60 * s);
        g.addColorStop(0, hsla(250, 90, 70, 0));
        g.addColorStop(1, hsla(250, 90, 75, 0.7));
        ctx.fillStyle = g;
        ctx.fillRect(x - 16 * s, by - 260 * s, 32 * s, 200 * s);
        ctx.strokeStyle = hsla(250, 90, 80, 0.6);
        ctx.lineWidth = 2.5 * s;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(x, by - (20 + i * 34) * s, (30 + i * 8) * s, 7 * s, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const crater = seg(u, 0.35, 0.4) * (1 - seg(u, 0.8, 1));
      if (crater > 0) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = hsla(250, 40, 10, 0.75 * crater);
        ctx.beginPath();
        ctx.ellipse(x, ground + 4, 80 * s, 14 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hsla(250, 80, 70, 0.7 * crater);
        ctx.lineWidth = 2.5 * s;
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Tele: a portal opens and Tele flickers through it, glitching into place.
  tele: {
    hit: 0.3, shake: 4,
    body: (u, s) => {
      const glitch = u >= 0.3 && u < 0.55;
      return base(u < 0.55 ? "guard" : settle(u, "flex", 0.75), {
        alpha: u < 0.3 ? 0 : glitch ? (Math.sin(u * 190) > -0.2 ? 1 : 0.15) : 1,
        dx: glitch ? Math.sin(u * 97) * 10 * s : 0,
        solid: "hsl(300 100% 88%)", solidA: 1 - seg(u, 0.45, 0.7),
      });
    },
    bursts: [
      { at: 0.02, n: 22, spd: 0, shape: "pixel", a: "hsl(312 80% 62%)", b: "hsl(300 100% 88%)", grav: 0, add: true, from: "body", dir: "in", spread: 140, life: 0.4 },
      { at: 0.55, n: 24, spd: 400, shape: "pixel", a: "hsl(312 80% 62%)", b: "hsl(280 90% 80%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    back: ({ ctx, x, y, s, u, t }) => {
      const open = easeOut(seg(u, 0, 0.25)) * (1 - seg(u, 0.55, 0.75));
      if (open <= 0) return;
      const cy = y - 55 * s;
      ctx.save();
      glow(ctx, x, cy, 34 * s * open, 78 * s * open, hsla(285, 60, 12, 0.85), hsla(300, 80, 40, 0.1));
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 4 * s;
      for (let i = 0; i < 3; i++) {
        const a = t * (6 + i * 3) * (i % 2 ? -1 : 1);
        ctx.strokeStyle = hsla(305 - i * 15, 100, 70 + i * 8, 0.8 * open);
        ctx.beginPath();
        ctx.ellipse(x, cy, (36 + i * 6) * s * open, (80 + i * 8) * s * open, 0, a, a + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u, t }) => {
      if (u < 0.3 || u >= 0.55) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = hsla(300, 100, 80, 0.5);
      const seed = Math.floor(t * 25);
      for (let i = 0; i < 4; i++) {
        const yy = y - (10 + ((wob(seed + i) + 1) / 2) * 100) * s;
        ctx.fillRect(x - 30 * s + wob(seed * 2 + i) * 12 * s, yy, 60 * s, 3 * s);
      }
      ctx.restore();
    },
  },

  // Vita: a sprout grows into a closed bud that blooms open around Vita.
  vita: {
    hit: 0.5, shake: 1,
    body: (u) => base(settle(u, "rise", 0.7), { alpha: seg(u, 0.4, 0.5) }),
    bursts: [
      { at: 0.5, n: 26, spd: 400, shape: "petal", a: "hsl(330 80% 75%)", b: "hsl(345 90% 88%)", grav: 120, add: false, from: "body", dir: "out" },
      { at: 0.5, n: 14, spd: 320, shape: "leaf", a: "hsl(140 58% 44%)", b: "hsl(110 70% 65%)", grav: 160, add: false, from: "body", dir: "out" },
      { at: 0.55, n: 10, spd: 160, shape: "plus", a: "hsl(140 70% 60%)", b: "hsl(110 80% 80%)", grav: -140, add: false, from: "feet", dir: "up" },
    ],
    back: ({ ctx, x, ground, s, u, t }) => {
      const grow = easeOut(seg(u, 0, 0.3));
      const fade = 1 - seg(u, 0.55, 0.85);
      if (grow <= 0 || fade <= 0) return;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = "hsl(130 50% 34%)";
      ctx.lineCap = "round";
      ctx.lineWidth = 5 * s;
      const h = 70 * s * grow;
      ctx.beginPath();
      ctx.moveTo(x, ground);
      ctx.bezierCurveTo(x - 20 * s, ground - h * 0.3, x + 20 * s + Math.sin(t * 3) * 3 * s, ground - h * 0.7, x, ground - h);
      ctx.stroke();
      ctx.fillStyle = "hsl(125 55% 45%)";
      for (const [ox, oy, a] of [[-14, 0.35, -0.9], [14, 0.62, 0.9]] as const) {
        ctx.save();
        ctx.translate(x + ox * s * grow, ground - h * oy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -10 * s * grow, 6 * s, 13 * s * grow, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
    front: ({ ctx, x, ground, s, u }) => {
      const grow = easeOut(seg(u, 0.18, 0.42));
      const open = easeOut(seg(u, 0.45, 0.68));
      const fade = 1 - seg(u, 0.6, 0.9);
      if (grow <= 0 || fade <= 0) return;
      ctx.save();
      ctx.globalAlpha = fade;
      for (let i = 0; i < 6; i++) {
        const off = i - 2.5;
        const a = off * (0.1 + 0.6 * open);
        const len = 64 * s * grow;
        ctx.save();
        ctx.translate(x + off * 6 * s, ground + 2);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -len * 0.55, 15 * s, len * 0.6, 0, 0, Math.PI * 2);
        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, "hsl(135 50% 40%)");
        g.addColorStop(0.45, "hsl(330 75% 70%)");
        g.addColorStop(1, "hsl(345 90% 88%)");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "hsl(250 32% 14% / 0.5)";
        ctx.lineWidth = 2 * s;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
  },

  // Toxi: a bubbling puddle belches a green cloud and Toxi steps out as it clears.
  toxi: {
    hit: 0.5, shake: 2,
    body: (u) => base(settle(u, "crouch", 0.68), { alpha: seg(u, 0.3, 0.55) }),
    bursts: [
      { at: 0.5, n: 26, spd: 320, shape: "bubble", a: "hsl(86 78% 46%)", b: "hsl(80 100% 72%)", grav: -100, add: false, from: "body", dir: "out" },
      { at: 0.5, n: 12, spd: 260, shape: "ring", a: "hsl(95 70% 40%)", b: "hsl(80 100% 65%)", grav: -60, add: false, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 34, until: 0.5, spd: 110, shape: "bubble", a: "hsl(86 78% 46%)", b: "hsl(80 100% 72%)", grav: -160, add: false, from: "feet", dir: "up", spread: 46 },
    back: ({ ctx, x, ground, s, u }) => {
      const k = easeOut(seg(u, 0, 0.18)) * (1 - seg(u, 0.75, 1));
      if (k <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(95, 70, 28, 0.8 * k);
      ctx.beginPath();
      ctx.ellipse(x, ground + 3, 60 * s * k, 11 * s * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hsla(80, 100, 60, 0.5 * k);
      ctx.beginPath();
      ctx.ellipse(x - 10 * s, ground + 1, 30 * s * k, 4 * s * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    front: ({ ctx, x, ground, s, u, t }) => {
      const grow = easeOut(seg(u, 0.1, 0.36));
      const clear = seg(u, 0.48, 0.9);
      const a = 0.82 * (1 - clear);
      if (grow <= 0 || a <= 0) return;
      ctx.save();
      for (let i = 0; i < 10; i++) {
        const ang = i * 0.63 + 0.3;
        const dist = (18 + (i % 3) * 14) * s * (1 + clear * 1.6);
        const r = (24 + (i % 3) * 8) * s * grow * (1 + clear * 0.5);
        const cx = x + Math.cos(ang) * dist + Math.sin(t * 2 + i) * 4 * s;
        const cy = ground - 55 * s + Math.sin(ang) * dist * 0.8 - clear * 30 * s;
        ctx.fillStyle = i % 3 === 0 ? hsla(100, 60, 26, a) : hsla(86, 70, 42 + (i % 2) * 10, a * 0.9);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // Chrono: a clock face spins backwards while echoes of Chrono close in to one body.
  chrono: {
    hit: 0.5, shake: 3, wave: ["hsl(38 94% 55%)", "hsl(45 100% 82%)"],
    body: (u, s) => base(settle(u, "rise", 0.66), {
      alpha: seg(u, 0.12, 0.5),
      echo: { spread: 70 * s * (1 - easeOut(seg(u, 0.08, 0.5))), alpha: 0.4 * seg(u, 0, 0.12) * (1 - seg(u, 0.42, 0.52)) },
    }),
    bursts: [
      { at: 0.5, n: 22, spd: 380, shape: "glyph", a: "hsl(38 94% 55%)", b: "hsl(45 100% 80%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    trickle: { rate: 20, until: 0.5, spd: 70, shape: "glyph", a: "hsl(38 94% 55%)", b: "hsl(45 100% 80%)", grav: -80, add: true, from: "feet", dir: "up", spread: 50 },
    back: ({ ctx, x, y, s, u, t }) => {
      const open = easeOut(seg(u, 0, 0.2)) * (1 - seg(u, 0.7, 0.95));
      if (open <= 0) return;
      const cx = x, cy = y - 62 * s, r = 88 * s * open;
      ctx.save();
      ctx.fillStyle = hsla(40, 80, 50, 0.12 * open);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hsla(42, 100, 65, 0.85 * open);
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = r * (i % 3 === 0 ? 0.8 : 0.88);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96);
        ctx.stroke();
      }
      // hands race backwards, then stop at twelve when Chrono arrives
      const run = 1 - seg(u, 0.38, 0.5);
      const m = -Math.PI / 2 - t * 22 * run - (1 - run) * Math.PI * 2;
      const h = -Math.PI / 2 - t * 4 * run;
      ctx.lineCap = "round";
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(m) * r * 0.75, cy + Math.sin(m) * r * 0.75);
      ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(h) * r * 0.5, cy + Math.sin(h) * r * 0.5);
      ctx.stroke();
      ctx.restore();
    },
  },

  // Magneto: shards of metal fly in from every side and lock together into Magneto.
  magneto: {
    hit: 0.45, shake: 5,
    body: (u) => base(u < 0.45 ? "guard" : settle(u, "flex", 0.72), { alpha: seg(u, 0.15, 0.45), solid: "hsl(210 14% 72%)", solidA: 1 - seg(u, 0.45, 0.7) }),
    bursts: [
      { at: 0, n: 26, spd: 0, shape: "shard", a: "hsl(210 15% 70%)", b: "hsl(0 70% 55%)", grav: 0, add: false, from: "body", dir: "in", spread: 230, life: 0.4 },
      { at: 0.15, n: 22, spd: 0, shape: "shard", a: "hsl(210 20% 82%)", b: "hsl(0 70% 50%)", grav: 0, add: false, from: "body", dir: "in", spread: 170, life: 0.35 },
      { at: 0.45, n: 22, spd: 460, shape: "spark", a: "hsl(0 70% 55%)", b: "hsl(210 20% 90%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    back: ({ ctx, x, y, s, u, t }) => {
      const k = seg(u, 0, 0.15) * (1 - seg(u, 0.6, 0.9));
      if (k <= 0) return;
      const cy = y - 55 * s;
      ctx.save();
      ctx.lineWidth = 2.5 * s;
      ctx.setLineDash([10 * s, 8 * s]);
      ctx.lineDashOffset = -t * 120;
      for (let i = 1; i <= 3; i++) {
        ctx.strokeStyle = i % 2 ? hsla(0, 70, 55, 0.7 * k) : hsla(210, 20, 85, 0.7 * k);
        ctx.beginPath();
        ctx.ellipse(x, cy, (40 + i * 22) * s, (18 + i * 18) * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Psy: floats down cross-legged with stones orbiting, then plants both feet.
  psy: {
    hit: 0.62, shake: 2, wave: ["hsl(330 84% 66%)", "hsl(320 100% 88%)"],
    body: (u, s) => base(u < 0.62 ? "float" : settle(u, "flex", 0.75), {
      alpha: seg(u, 0, 0.25),
      dy: (-(1 - easeInOut(seg(u, 0, 0.62))) * 130 - (u < 0.62 ? 14 : 0) * (1 - seg(u, 0.5, 0.62)) - Math.sin(u * 14) * 4 * (1 - seg(u, 0.5, 0.62))) * s,
    }),
    bursts: [
      { at: 0.62, n: 22, spd: 380, shape: "ring", a: "hsl(330 84% 66%)", b: "hsl(320 100% 88%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    trickle: { rate: 14, until: 0.6, spd: 60, shape: "star", a: "hsl(330 84% 70%)", b: "hsl(320 100% 90%)", grav: -40, add: true, from: "body", dir: "out" },
    back: ({ ctx, x, y, s, u, t, body }) => {
      const k = seg(u, 0, 0.2) * (1 - seg(u, 0.62, 0.9));
      if (k <= 0) return;
      const by = y + body.dy;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const p = (t * 1.6 + i / 3) % 1;
        ctx.strokeStyle = hsla(325, 100, 75, 0.7 * k * (1 - p));
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.ellipse(x, by, (20 + p * 60) * s, (5 + p * 14) * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      // stones circling, dropping when Psy lands
      const drop = easeIn(seg(u, 0.62, 0.85));
      for (let i = 0; i < 4; i++) {
        const a = t * 2.6 + (i * Math.PI) / 2;
        const sx = x + Math.cos(a) * 54 * s;
        const sy = by - 60 * s + Math.sin(a) * 14 * s + drop * 80 * s;
        ctx.fillStyle = hsla(28, 30, 40 + (i % 2) * 12, k + drop * 0.2);
        ctx.strokeStyle = "hsl(250 32% 14%)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(sx - 7 * s, sy);
        ctx.lineTo(sx - 2 * s, sy - 7 * s);
        ctx.lineTo(sx + 7 * s, sy - 3 * s);
        ctx.lineTo(sx + 5 * s, sy + 6 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Shift: a puddle of colour stretches and wobbles up, cycling through forms, and snaps into Shift.
  shift: {
    hit: 0.5, shake: 3,
    body: (u) => {
      const k = easeOut(seg(u, 0, 0.48));
      const morph = u < 0.5;
      return base(morph ? "guard" : settle(u, "flex", 0.72), {
        alpha: seg(u, 0, 0.1),
        sx: morph ? lerp(1.9, 1, k) + Math.sin(u * 42) * 0.14 * (1 - k) : 1,
        sy: morph ? lerp(0.12, 1, k) + Math.cos(u * 42) * 0.14 * (1 - k) : 1,
        solid: `hsl(${Math.round((u * 1100) % 360)} 85% 60%)`,
        solidA: 1 - seg(u, 0.48, 0.58),
      });
    },
    bursts: [
      { at: 0.5, n: 30, spd: 460, shape: "dot", a: "hsl(186 84% 50%)", b: "hsl(300 90% 70%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.5, n: 12, spd: 300, shape: "star", a: "hsl(46 100% 66%)", b: "hsl(180 100% 82%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    back: ({ ctx, x, ground, s, u }) => {
      const k = seg(u, 0, 0.08) * (1 - seg(u, 0.45, 0.65));
      if (k <= 0) return;
      ctx.save();
      ctx.fillStyle = `hsl(${Math.round((u * 1100) % 360)} 80% 50% / ${0.6 * k})`;
      ctx.beginPath();
      ctx.ellipse(x, ground + 3, 56 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  // Nova: a small pink-and-blue galaxy spins up on the spot, its arms wind tighter and tighter, and it collapses
  // into her with a flash of stardust.
  nova: {
    hit: 0.56, shake: 6, wave: ["hsl(324 80% 74%)", "hsl(232 70% 64%)"],
    body: (u) => base(u < 0.56 ? "float" : settle(u, "flex", 0.72), {
      alpha: seg(u, 0.38, 0.56),
      sx: 0.4 + 0.6 * easeOut(seg(u, 0.38, 0.62)),
      solid: "hsl(324 90% 88%)", solidA: 1 - seg(u, 0.56, 0.84),
    }),
    bursts: [
      { at: 0.56, n: 30, spd: 420, shape: "star", a: "hsl(324 85% 76%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.56, n: 16, spd: 260, shape: "dot", a: "hsl(232 80% 66%)", b: "hsl(200 100% 86%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    trickle: { rate: 40, until: 0.56, spd: 0, shape: "star", a: "hsl(324 80% 78%)", b: "hsl(232 90% 80%)", grav: 0, add: true, from: "body", dir: "in", spread: 120, life: 0.6 },
    back: ({ ctx, x, y, s, u, t }) => {
      const k = easeOut(seg(u, 0, 0.3)) * (1 - easeIn(seg(u, 0.46, 0.58)));
      if (k <= 0) return;
      const cx = x, cy = y - 55 * s;
      const r = 90 * s * (1 - 0.65 * seg(u, 0.3, 0.56));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, cx, cy, r * 1.1, r * 0.5, hsla(258, 70, 40, 0.5 * k), hsla(258, 70, 30, 0));
      // two spiral arms of stars, one pink and one blue
      for (let arm = 0; arm < 2; arm++) {
        for (let i = 0; i < 26; i++) {
          const d = i / 25;
          const a = t * (5 + 6 * seg(u, 0.2, 0.56)) + arm * Math.PI + d * 5.2;
          const px = cx + Math.cos(a) * r * d, py = cy + Math.sin(a) * r * d * 0.42;
          ctx.fillStyle = arm ? hsla(232, 90, 76, (1 - d * 0.6) * k) : hsla(324, 90, 80, (1 - d * 0.6) * k);
          const sz = (2.6 - d * 1.4) * s;
          ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
        }
      }
      glow(ctx, cx, cy, 16 * s, 12 * s, hsla(48, 100, 90, 0.9 * k), hsla(324, 100, 80, 0));
      ctx.restore();
    },
  },
  // ----- quest fighters -----
  // Parallax: a thin cut opens in the air, peels wide into a pane of open space, he steps out unfolding,
  // and the pane folds shut behind him into a spinning cube that snaps away.
  spatio: {
    len: 1.9, hit: 0.5, shake: 9, wave: ["hsl(188 100% 70%)", "hsl(250 70% 50%)"],
    body: (u, s) => base(u < 0.5 ? "guard" : settle(u, "flex", 0.7), {
      alpha: seg(u, 0.3, 0.46),
      sx: 0.1 + 0.9 * easeOut(seg(u, 0.32, 0.55)),
      dy: -(1 - easeOut(seg(u, 0.3, 0.55))) * 30 * s,
      solid: "hsl(188 100% 82%)", solidA: 1 - seg(u, 0.5, 0.8),
    }),
    bursts: [
      { at: 0.08, n: 14, spd: 180, shape: "shard", a: "hsl(188 100% 70%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.5, n: 36, spd: 520, shape: "shard", a: "hsl(250 70% 60%)", b: "hsl(188 100% 80%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.5, n: 14, spd: 300, shape: "ring", a: "hsl(188 100% 70%)", b: "hsl(270 90% 74%)", grav: 0, add: true, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 40, until: 0.45, spd: 0, shape: "spark", a: "hsl(188 100% 76%)", b: "hsl(260 90% 76%)", grav: 0, add: true, from: "body", dir: "in", spread: 120, life: 0.6 },
    back: ({ ctx, x, y, s, u, t }) => {
      const cy = y - 55 * s;
      // the cut, then the pane peeling open
      const cut = easeOut(seg(u, 0, 0.18));
      const open = easeOut(seg(u, 0.16, 0.42)) * (1 - easeInOut(seg(u, 0.6, 0.82)));
      if (cut <= 0) return;
      const h = 150 * s * cut;
      const w = 4 * s + 70 * s * open;
      ctx.save();
      ctx.fillStyle = "hsl(245 60% 5% / 0.92)";
      ctx.beginPath();
      ctx.moveTo(x, cy - h * 0.6);
      ctx.lineTo(x + w, cy - h * 0.3);
      ctx.lineTo(x + w * 0.8, cy + h * 0.5);
      ctx.lineTo(x, cy + h * 0.6);
      ctx.lineTo(x - w, cy + h * 0.3);
      ctx.lineTo(x - w * 0.8, cy - h * 0.5);
      ctx.closePath();
      ctx.fill();
      // stars seen through the opening
      for (let i = 0; i < 18; i++) {
        const sx = x + wob(i * 1.3) * w * 0.8, sy = cy + wob(i * 2.9 + 4) * h * 0.45;
        ctx.fillStyle = hsla(i % 3 ? 188 : 280, 100, 85, open * (0.5 + 0.5 * Math.abs(Math.sin(t * 4 + i))));
        ctx.fillRect(sx, sy, 2 * s, 2 * s);
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hsla(188, 100, 72, 0.9 * (open + 0.3 * cut));
      ctx.lineWidth = 2.5 * s;
      ctx.stroke();
      // the pane folding shut into a cube that spins off upward
      const fold = seg(u, 0.78, 1);
      if (fold > 0 && fold < 1) {
        const cs = 16 * s * (1 - fold), cx2 = x, cyy = cy - 60 * s * easeIn(fold);
        ctx.strokeStyle = hsla(188, 100, 75, 1 - fold);
        ctx.lineWidth = 2 * s;
        ctx.strokeRect(cx2 - cs, cyy - cs, cs * 2, cs * 2);
        ctx.strokeRect(cx2 - cs * 0.5 + cs * 0.4 * Math.sin(t * 9), cyy - cs * 1.4, cs * 2, cs * 2);
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u }) => {
      // a flash of a second cut across the first, the moment space gives way
      const k = seg(u, 0.44, 0.58);
      if (k <= 0 || k >= 1) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hsla(0, 0, 100, 1 - k);
      ctx.lineWidth = 3 * s * (1 - k);
      ctx.beginPath();
      ctx.moveTo(x - 120 * s * k - 20 * s, y - 120 * s);
      ctx.lineTo(x + 120 * s * k + 20 * s, y + 4 * s);
      ctx.stroke();
      ctx.restore();
    },
  },

  // Hexizon: the screen glitches green, a skull blaster opens its jaw in the sky and fires straight down,
  // and he drops out of the beam in a burst of pixels, staff first, his flare eye lighting last.
  hexizon: {
    len: 1.9, hit: 0.56, shake: 11, wave: ["hsl(128 100% 55%)", "hsl(150 30% 6%)"],
    body: (u, s) => base(u < 0.5 ? "air" : settle(u, "land", 0.7), {
      alpha: u < 0.36 ? 0 : Math.floor(u * 60) % 3 === 0 && u < 0.56 ? 0.3 : 1,
      dy: u < 0.56 ? -(1 - easeIn(seg(u, 0.36, 0.56))) * 230 * s : 0,
      solid: "hsl(128 100% 60%)", solidA: 1 - seg(u, 0.56, 0.86),
    }),
    bursts: [
      { at: 0.1, n: 18, spd: 260, shape: "pixel", a: "hsl(128 100% 55%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "sky", dir: "out" },
      { at: 0.56, n: 40, spd: 560, shape: "pixel", a: "hsl(128 100% 55%)", b: "hsl(150 30% 8%)", grav: 400, add: false, from: "feet", dir: "up" },
      { at: 0.56, n: 16, spd: 360, shape: "dust", a: "hsl(45 25% 85%)", b: "hsl(128 100% 60%)", grav: -20, add: false, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 50, until: 0.56, spd: 160, shape: "pixel", a: "hsl(128 100% 55%)", b: "hsl(0 0% 100%)", grav: 600, add: true, from: "sky", dir: "out", spread: 40 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const top = ground - 330 * s;
      const skull = easeOut(seg(u, 0.08, 0.3)) * (1 - seg(u, 0.62, 0.8));
      const beam = seg(u, 0.3, 0.36) * (1 - seg(u, 0.56, 0.7));
      ctx.save();
      // glitch bars across the arena
      if (u < 0.6) {
        for (let i = 0; i < 5; i++) {
          if (Math.floor(t * 20 + i * 3) % 4) continue;
          ctx.fillStyle = hsla(128, 100, 50, 0.18);
          ctx.fillRect(x - 300 * s, top + wob(i + Math.floor(t * 20)) * 160 * s + 160 * s, 600 * s, 6 * s);
        }
      }
      // the beam
      if (beam > 0) {
        ctx.globalCompositeOperation = "lighter";
        const bw = 34 * s * beam * (1 + 0.1 * Math.sin(t * 50));
        const g = ctx.createLinearGradient(x - bw, 0, x + bw, 0);
        g.addColorStop(0, hsla(190, 100, 70, 0));
        g.addColorStop(0.3, hsla(190, 100, 80, 0.8));
        g.addColorStop(0.5, hsla(0, 0, 100, 1));
        g.addColorStop(0.7, hsla(190, 100, 80, 0.8));
        g.addColorStop(1, hsla(190, 100, 70, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - bw, top + 20 * s, bw * 2, ground - top - 20 * s);
        ctx.globalCompositeOperation = "source-over";
      }
      // the skull blaster: long horse-like skull, jaw dropping open before it fires
      if (skull > 0.01) {
        const jaw = easeOut(seg(u, 0.22, 0.32)) * 14 * s;
        ctx.globalAlpha = skull;
        ctx.translate(x, top);
        ctx.scale(skull * s, skull * s);
        ctx.fillStyle = "hsl(45 25% 92%)";
        ctx.strokeStyle = "hsl(150 30% 6%)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-26, -30); ctx.quadraticCurveTo(0, -46, 26, -30); ctx.lineTo(18, 6); ctx.lineTo(-18, 6); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-16, 6 + jaw / s); ctx.lineTo(16, 6 + jaw / s); ctx.lineTo(10, 22 + jaw / s); ctx.lineTo(-10, 22 + jaw / s); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // eye sockets, one lit green
        ctx.fillStyle = "hsl(150 30% 6%)";
        ctx.beginPath(); ctx.ellipse(-11, -16, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(11, -16, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "hsl(128 100% 60%)";
        ctx.beginPath(); ctx.arc(11, -16, 3 + Math.sin(t * 20), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u, t }) => {
      // the flare eye igniting once he has landed
      const k = seg(u, 0.72, 0.9);
      if (k <= 0 || k >= 1) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, y - 115 * s, 40 * s * k, 40 * s * k, hsla(128, 100, 60, 0.8 * (1 - k)), hsla(128, 100, 50, 0));
      ctx.strokeStyle = hsla(128, 100, 70, 1 - k);
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * Math.PI * 2 + t;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * 10 * s, y - 115 * s + Math.sin(an) * 10 * s);
        ctx.lineTo(x + Math.cos(an) * (10 + 40 * k) * s, y - 115 * s + Math.sin(an) * (10 + 40 * k) * s);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Halflife: a warning glow builds under the floor, the ground cracks green, and he bursts up out of it in a
  // mushroom of radioactive light, smoking, his core the last thing to steady.
  gamma: {
    len: 1.9, hit: 0.5, shake: 13, wave: ["hsl(78 100% 56%)", "hsl(100 60% 20%)"],
    body: (u, s) => base(u < 0.5 ? "crouch" : settle(u, "flex", 0.72), {
      clip: u < 0.56,
      alpha: u < 0.38 ? 0 : 1,
      dy: u < 0.5 ? (1 - easeOut(seg(u, 0.38, 0.5))) * 110 * s : -Math.sin(seg(u, 0.5, 0.66) * Math.PI) * 26 * s,
      sx: u < 0.5 ? 1 : 1 + 0.12 * (1 - seg(u, 0.5, 0.7)), sy: u < 0.5 ? 1 : 1 - 0.1 * (1 - seg(u, 0.5, 0.7)),
      solid: "hsl(72 100% 70%)", solidA: 1 - seg(u, 0.5, 0.86),
    }),
    bursts: [
      { at: 0.5, n: 40, spd: 540, shape: "spark", a: "hsl(78 100% 56%)", b: "hsl(60 100% 80%)", grav: -60, add: true, from: "feet", dir: "up", spread: 0.9 },
      { at: 0.5, n: 22, spd: 300, shape: "chunk", a: "hsl(100 20% 22%)", b: "hsl(90 30% 40%)", grav: 1000, add: false, from: "feet", dir: "up" },
      { at: 0.56, n: 18, spd: 120, shape: "smoke", a: "hsl(100 40% 18%)", b: "hsl(80 60% 34%)", grav: -90, add: false, from: "body", dir: "out" },
    ],
    trickle: { rate: 36, until: 0.5, spd: 140, shape: "spark", a: "hsl(78 100% 56%)", b: "hsl(60 100% 78%)", grav: -200, add: true, from: "feet", dir: "up", spread: 0.5, life: 0.7 },
    back: ({ ctx, x, ground, s, u, t }) => {
      ctx.save();
      // the glow building under the floor
      const warn = seg(u, 0, 0.45) * (1 - seg(u, 0.7, 0.95));
      if (warn > 0) {
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, x, ground, (60 + 40 * warn) * s, (14 + 6 * warn) * s, hsla(78, 100, 56, 0.7 * warn * (0.75 + 0.25 * Math.sin(t * 18))), hsla(78, 100, 50, 0));
      }
      // cracks running out along the floor
      const cr = easeOut(seg(u, 0.15, 0.5)) * (1 - seg(u, 0.8, 1));
      if (cr > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = hsla(72, 100, 66, 0.9 * cr);
        ctx.lineWidth = 2.4 * s;
        for (let i = 0; i < 6; i++) {
          const side = i % 2 ? 1 : -1, len = (50 + 30 * wob(i + 2)) * s * cr;
          jag(ctx, x, ground + 1, x + side * len, ground + 1 + wob(i * 5) * 4 * s, 4, 3 * s, i * 7);
          ctx.stroke();
        }
      }
      // the mushroom of light once he bursts out
      const m = seg(u, 0.48, 0.9);
      if (m > 0 && m < 1) {
        ctx.globalCompositeOperation = "lighter";
        const a = 1 - m;
        const stemH = 180 * s * easeOut(m);
        const g = ctx.createLinearGradient(0, ground, 0, ground - stemH);
        g.addColorStop(0, hsla(72, 100, 70, 0.7 * a));
        g.addColorStop(1, hsla(78, 100, 56, 0.1 * a));
        ctx.fillStyle = g;
        ctx.fillRect(x - 22 * s * (1 + m), ground - stemH, 44 * s * (1 + m), stemH);
        glow(ctx, x, ground - stemH, (50 + 70 * m) * s, (26 + 30 * m) * s, hsla(66, 100, 74, 0.75 * a), hsla(84, 100, 40, 0));
        ctx.strokeStyle = hsla(70, 100, 80, 0.8 * a);
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.ellipse(x, ground - 4 * s, (40 + 160 * m) * s, (6 + 14 * m) * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u, t }) => {
      // the core igniting: three blades flick round once and settle
      const k = seg(u, 0.7, 0.95);
      if (k <= 0 || k >= 1) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const cy = y - 70 * s;
      glow(ctx, x, cy, 46 * s * (1 - k * 0.5), 46 * s * (1 - k * 0.5), hsla(70, 100, 70, 0.7 * (1 - k)), hsla(78, 100, 50, 0));
      ctx.fillStyle = hsla(66, 100, 78, 1 - k);
      for (let i = 0; i < 3; i++) {
        const a0 = t * 8 + (i * Math.PI * 2) / 3, r = 30 * s * (1 - k * 0.6);
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.arc(x, cy, r, a0, a0 + 0.8); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
  },

  // Redline: a red-gold streak laps the arena twice, carving a ring of fire into the floor, then stops dead on his
  // mark so hard the air cracks into a sonic boom, and his afterimages catch up with him one by one.
  velo: {
    len: 1.7, hit: 0.52, shake: 10, wave: ["hsl(44 100% 66%)", "hsl(356 80% 46%)"],
    body: (u, s) => base(u < 0.52 ? "air" : settle(u, "land", 0.7), {
      alpha: u < 0.46 ? 0 : 1,
      dx: u < 0.52 ? -(1 - easeOut(seg(u, 0.46, 0.52))) * 160 * s : 0,
      sx: u < 0.56 ? 1.25 - 0.25 * seg(u, 0.5, 0.56) : 1, sy: u < 0.56 ? 0.88 : 1,
      echo: u > 0.5 && u < 0.85 ? { spread: (1 - seg(u, 0.5, 0.85)) * 70 * s, alpha: 0.5 * (1 - seg(u, 0.5, 0.85)) } : undefined,
      solid: "hsl(44 100% 70%)", solidA: 1 - seg(u, 0.52, 0.78),
    }),
    bursts: [
      { at: 0.52, n: 30, spd: 620, shape: "spark", a: "hsl(44 100% 66%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.52, n: 24, spd: 520, shape: "dust", a: "hsl(30 30% 60%)", b: "hsl(40 40% 80%)", grav: -20, add: false, from: "feet", dir: "flat" },
      { at: 0.54, n: 12, spd: 360, shape: "ember", a: "hsl(14 100% 56%)", b: "hsl(48 100% 70%)", grav: -200, add: true, from: "feet", dir: "up" },
    ],
    back: ({ ctx, x, y, ground, s, u, t }) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // the streak running laps: a bright head on an ellipse round the spot, with a fading tail
      const run = seg(u, 0, 0.5);
      if (run > 0 && run < 1) {
        const R = 170 * s, Ry = 34 * s, cy = ground - 26 * s;
        const head = easeIn(run) * Math.PI * 4;
        for (let i = 0; i < 18; i++) {
          const a = head - i * 0.12;
          if (a < 0) break;
          const px = x + Math.cos(a) * R * (1 - run * 0.6), py = cy + Math.sin(a) * Ry;
          glow(ctx, px, py - 30 * s, (16 - i * 0.7) * s, (40 - i * 1.5) * s, hsla(i < 3 ? 44 : 356, 100, i < 3 ? 70 : 54, 0.6 * (1 - i / 18)), hsla(356, 100, 50, 0));
        }
      }
      // the ring of fire left on the floor
      const ring = seg(u, 0.1, 0.5) * (1 - seg(u, 0.75, 1));
      if (ring > 0) {
        ctx.strokeStyle = hsla(24, 100, 58, 0.7 * ring);
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.ellipse(x, ground, 170 * s * (1 - seg(u, 0, 0.5) * 0.6), 18 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2, R = 170 * s * (1 - seg(u, 0, 0.5) * 0.6);
          ctx.fillStyle = hsla(40, 100, 64, ring * (0.4 + 0.6 * Math.abs(Math.sin(t * 14 + i))));
          ctx.fillRect(x + Math.cos(a) * R - 1.5 * s, ground + Math.sin(a) * 18 * s - 6 * s, 3 * s, 6 * s);
        }
      }
      // the sonic boom: a cone of rings bursting from where he stopped
      const boom = seg(u, 0.5, 0.8);
      if (boom > 0 && boom < 1) {
        for (let i = 0; i < 3; i++) {
          const k = Math.min(1, boom * (1 + i * 0.4));
          ctx.strokeStyle = hsla(0, 0, 100, (1 - k) * 0.8);
          ctx.lineWidth = 3 * s * (1 - k);
          ctx.beginPath();
          ctx.ellipse(x, y - 55 * s, (20 + 140 * k) * s, (50 + 70 * k) * s, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },

  // Liminal: two small doors open on either side, bits of matter pour out of both and stream to the middle, where
  // they click together into its body; a great ring door swings open behind it and shuts.
  portal: {
    len: 1.9, hit: 0.58, shake: 9, wave: ["hsl(318 100% 66%)", "hsl(176 100% 60%)"],
    body: (u, s) => base(u < 0.58 ? "float" : settle(u, "flex", 0.74), {
      alpha: seg(u, 0.3, 0.58),
      sx: 0.6 + 0.4 * easeOut(seg(u, 0.3, 0.6)), sy: 0.6 + 0.4 * easeOut(seg(u, 0.3, 0.6)),
      dy: -(1 - easeOut(seg(u, 0.3, 0.62))) * 20 * s,
      solid: "hsl(318 100% 80%)", solidA: 1 - seg(u, 0.55, 0.85),
    }),
    bursts: [
      { at: 0.58, n: 30, spd: 420, shape: "ring", a: "hsl(318 100% 66%)", b: "hsl(176 100% 70%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.58, n: 20, spd: 320, shape: "chunk", a: "hsl(285 40% 36%)", b: "hsl(176 100% 70%)", grav: 700, add: false, from: "body", dir: "out" },
    ],
    trickle: { rate: 60, until: 0.56, spd: 0, shape: "chunk", a: "hsl(318 100% 66%)", b: "hsl(176 100% 70%)", grav: 0, add: false, from: "body", dir: "in", spread: 150, life: 0.5 },
    back: ({ ctx, x, y, s, u, t }) => {
      ctx.save();
      const cy = y - 55 * s;
      // the two side doors
      const side = easeOut(seg(u, 0, 0.18)) * (1 - easeIn(seg(u, 0.5, 0.66)));
      if (side > 0.01) {
        for (const sd of [-1, 1]) {
          const dx = x + sd * 130 * s, rx = 14 * s * side, ry = 46 * s * side;
          ctx.fillStyle = "hsl(270 50% 4% / 0.9)";
          ctx.beginPath(); ctx.ellipse(dx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = hsla(sd < 0 ? 318 : 176, 100, 66, side);
          ctx.lineWidth = 4 * s;
          ctx.beginPath(); ctx.ellipse(dx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
          // matter streaming out toward the middle
          for (let i = 0; i < 8; i++) {
            const k = (t * 1.6 + i / 8) % 1;
            const mx = lerp(dx, x, k), my = cy + Math.sin(i * 2.7 + k * 5) * 30 * s * (1 - k);
            const z = 3.5 * s * (1 - k * 0.4);
            ctx.fillStyle = hsla(i % 2 ? 318 : 176, 100, 70, side * 0.9);
            ctx.fillRect(mx - z, my - z, z * 2, z * 2);
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }
      // the great door behind, swinging open as it forms and shutting after
      const big = easeOut(seg(u, 0.36, 0.6)) * (1 - easeInOut(seg(u, 0.7, 0.95)));
      if (big > 0.01) {
        const rx = 50 * s * big, ry = 80 * s;
        ctx.fillStyle = "hsl(270 50% 4% / 0.85)";
        ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = hsla(i % 2 ? 318 : 176, 100, 80, big * (0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))));
          ctx.fillRect(x + wob(i * 1.7) * rx * 0.7, cy + wob(i * 3.1 + 2) * ry * 0.7, 2 * s, 2 * s);
        }
        ctx.strokeStyle = hsla(318, 100, 66, big);
        ctx.lineWidth = 5 * s;
        ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = hsla(176, 100, 66, big * 0.8);
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath(); ctx.ellipse(x, cy, rx * 0.8, ry * 0.86, 0, t * 4, t * 4 + 4.4); ctx.stroke();
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u }) => {
      // the click: a bright keyhole flash where its face will be
      const k = seg(u, 0.56, 0.74);
      if (k <= 0 || k >= 1) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const hy = y - 112 * s;
      glow(ctx, x, hy, 44 * s * k + 6 * s, 44 * s * k + 6 * s, hsla(0, 0, 100, 0.9 * (1 - k)), hsla(318, 100, 66, 0));
      ctx.restore();
    },
  },

  // Overtone: four slow beats thump through the arena, each one a ring of sound closing on the spot and a row of
  // equalizer bars jumping higher, then the drop: a huge shockwave and he lands on the beat.
  sono: {
    len: 1.8, hit: 0.56, shake: 11, wave: ["hsl(36 100% 58%)", "hsl(48 100% 86%)"],
    body: (u, s) => base(u < 0.56 ? "air" : settle(u, "land", 0.72), {
      alpha: u < 0.5 ? 0 : 1,
      dy: u < 0.56 ? -(1 - easeIn(seg(u, 0.5, 0.56))) * 120 * s : 0,
      sx: u < 0.62 && u >= 0.56 ? 1.15 : 1, sy: u < 0.62 && u >= 0.56 ? 0.85 : 1,
      solid: "hsl(40 100% 70%)", solidA: 1 - seg(u, 0.56, 0.8),
    }),
    bursts: [
      { at: 0.56, n: 28, spd: 520, shape: "ring", a: "hsl(36 100% 58%)", b: "hsl(48 100% 86%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.56, n: 20, spd: 480, shape: "dust", a: "hsl(30 20% 50%)", b: "hsl(40 30% 76%)", grav: -20, add: false, from: "feet", dir: "flat" },
    ],
    back: ({ ctx, x, y, ground, s, u }) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const cy = y - 55 * s;
      // the build: one ring of sound closing in on each beat
      for (let i = 0; i < 4; i++) {
        const k = seg(u, i * 0.13, i * 0.13 + 0.13);
        if (k <= 0 || k >= 1) continue;
        const R = (220 - 170 * easeIn(k)) * s;
        ctx.strokeStyle = hsla(i % 2 ? 48 : 36, 100, i % 2 ? 86 : 58, 0.8 * (0.3 + 0.7 * k));
        ctx.lineWidth = (3 + i) * s;
        ctx.beginPath(); ctx.ellipse(x, cy, R, R * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // the drop: one huge ring blowing outward
      const drop = seg(u, 0.56, 0.9);
      if (drop > 0 && drop < 1) {
        ctx.strokeStyle = hsla(0, 0, 100, 0.9 * (1 - drop));
        ctx.lineWidth = 8 * s * (1 - drop);
        ctx.beginPath(); ctx.ellipse(x, cy, (30 + 260 * easeOut(drop)) * s, (24 + 120 * easeOut(drop)) * s, 0, 0, Math.PI * 2); ctx.stroke();
        glow(ctx, x, ground, 180 * s * easeOut(drop), 16 * s, hsla(36, 100, 60, 0.6 * (1 - drop)), hsla(36, 100, 60, 0));
      }
      ctx.restore();
    },
    front: ({ ctx, x, ground, s, u, t }) => {
      // equalizer bars on either side of the spot, jumping higher on every beat and dropping away after he lands
      const on = seg(u, 0, 0.08) * (1 - seg(u, 0.7, 0.95));
      if (on <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const beat = Math.pow(Math.max(0, Math.sin(Math.min(u, 0.56) / 0.13 * Math.PI)), 2);
      const build = Math.min(1, u / 0.56);
      for (const sd of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const bx = x + sd * (70 + i * 14) * s;
          const bh = (10 + 70 * build * (0.4 + 0.6 * beat) * (1 - i * 0.12) + 6 * Math.sin(t * 20 + i)) * s * on;
          ctx.fillStyle = hsla(i === 0 ? 48 : 36, 100, i === 0 ? 86 : 58, 0.75 * on);
          ctx.fillRect(bx - 4 * s, ground - bh, 8 * s, bh);
        }
      }
      ctx.restore();
    },
  },

  // Vellum: a single sheet of paper drifts down out of the sky, folds itself smaller and smaller into a crane that
  // circles the spot once, then unfolds all at once into Vellum in a burst of paper scraps.
  paper: {
    len: 1.9, hit: 0.62, shake: 6, wave: ["hsl(42 40% 92%)", "hsl(352 85% 56%)"],
    body: (u, s) => base(u < 0.62 ? "float" : settle(u, "flex", 0.76), {
      alpha: seg(u, 0.56, 0.64),
      sx: 0.5 + 0.5 * easeOut(seg(u, 0.56, 0.7)), sy: 0.5 + 0.5 * easeOut(seg(u, 0.56, 0.7)),
      solid: "hsl(42 50% 96%)", solidA: 1 - seg(u, 0.62, 0.86),
    }),
    bursts: [
      { at: 0.62, n: 34, spd: 380, shape: "leaf", a: "hsl(42 40% 92%)", b: "hsl(42 50% 98%)", grav: 160, add: false, from: "body", dir: "out" },
      { at: 0.62, n: 10, spd: 300, shape: "leaf", a: "hsl(352 85% 56%)", b: "hsl(352 85% 66%)", grav: 160, add: false, from: "body", dir: "out" },
    ],
    back: ({ ctx, x, y, s, u, t }) => {
      ctx.save();
      const cy = y - 60 * s;
      // the sheet drifting down, rocking side to side like falling paper
      const fall = seg(u, 0, 0.3);
      if (fall < 1) {
        const px = x + Math.sin(fall * Math.PI * 3) * 40 * s, py = cy - (1 - easeOut(fall)) * 220 * s;
        const sz = 34 * s;
        ctx.translate(px, py);
        ctx.rotate(Math.sin(fall * Math.PI * 3) * 0.5);
        ctx.scale(1, 0.45 + 0.25 * Math.cos(fall * 12));
        ctx.fillStyle = "hsl(42 45% 93%)";
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.strokeStyle = "hsl(352 85% 56%)";
        ctx.lineWidth = 2 * s;
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        ctx.restore();
        return;
      }
      // folding: the square halves, then halves again, into a diamond
      const fold = seg(u, 0.3, 0.42);
      if (fold < 1) {
        const sz = 34 * s * (1 - 0.6 * easeInOut(fold));
        ctx.translate(x, cy);
        ctx.rotate(fold * Math.PI / 4);
        ctx.fillStyle = "hsl(42 45% 93%)";
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.strokeStyle = "hsl(30 20% 60%)";
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.moveTo(-sz, -sz); ctx.lineTo(sz, sz); ctx.moveTo(sz, -sz); ctx.lineTo(-sz, sz); ctx.stroke();
        ctx.strokeStyle = "hsl(352 85% 56%)";
        ctx.lineWidth = 2 * s;
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        ctx.restore();
        return;
      }
      // the crane: one loop round the spot, then a dive into the middle
      const fly = seg(u, 0.42, 0.62);
      if (fly < 1) {
        const a = fly * Math.PI * 2;
        const R = 70 * s * (1 - easeIn(fly));
        const cx = x + Math.cos(a) * R, cyy = cy + Math.sin(a) * R * 0.4;
        drawCrane(ctx, cx, cyy, 14 * s, a + Math.PI / 2, Math.sin(t * 16), "hsl(42 45% 95%)", "hsl(352 85% 56%)");
      }
      ctx.restore();
    },
  },

  // Facet: crystals punch up out of the floor in a tight cluster, grow taller and close over the spot, then the whole
  // cluster shatters outward and Facet is standing in the middle, still glassy for a moment.
  crys: {
    len: 1.8, hit: 0.6, shake: 9, wave: ["hsl(286 45% 66%)", "hsl(172 100% 76%)"],
    body: (u, s) => base(u < 0.6 ? "crouch" : settle(u, "guard", 0.78), {
      alpha: seg(u, 0.56, 0.62),
      solid: "hsl(286 60% 84%)", solidA: 1 - seg(u, 0.6, 0.88),
    }),
    bursts: [
      { at: 0.6, n: 36, spd: 460, shape: "shard", a: "hsl(286 50% 70%)", b: "hsl(172 100% 82%)", grav: 700, add: true, from: "body", dir: "out" },
      { at: 0.6, n: 14, spd: 300, shape: "shard", a: "hsl(0 0% 100%)", b: "hsl(172 100% 88%)", grav: 500, add: true, from: "feet", dir: "up" },
    ],
    back: ({ ctx, x, ground, s, u, t }) => {
      if (u >= 0.6) return;
      ctx.save();
      const grow = easeOut(seg(u, 0.05, 0.52));
      // seven crystals of different heights leaning in over the spot
      for (let i = 0; i < 7; i++) {
        const k = (i - 3) / 3;
        const delay = Math.abs(k) * 0.18;
        const g = clamp((grow - delay) / (1 - delay), 0, 1);
        if (g <= 0) continue;
        const h = (110 - Math.abs(k) * 55) * s * g;
        const w = (13 - Math.abs(k) * 3) * s;
        const bx = x + k * 30 * s;
        ctx.save();
        ctx.translate(bx, ground);
        ctx.rotate(-k * 0.28);
        ctx.fillStyle = i % 2 ? "hsl(286 40% 58% / 0.92)" : "hsl(280 45% 46% / 0.92)";
        ctx.strokeStyle = "hsl(172 100% 80%)";
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(-w, 0); ctx.lineTo(-w, -h + w); ctx.lineTo(0, -h); ctx.lineTo(w, -h + w); ctx.lineTo(w, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // a bright facet line down one face
        ctx.strokeStyle = hsla(0, 0, 100, 0.55 + 0.3 * Math.sin(t * 6 + i));
        ctx.beginPath(); ctx.moveTo(-w * 0.35, -4 * s); ctx.lineTo(-w * 0.35, -h + w * 1.2); ctx.stroke();
        ctx.restore();
      }
      // light building inside the cluster just before it breaks
      const charge = seg(u, 0.4, 0.6);
      if (charge > 0) {
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, x, ground - 50 * s, 70 * s * charge, 90 * s * charge, hsla(172, 100, 80, 0.7 * charge), hsla(286, 60, 60, 0));
      }
      ctx.restore();
    },
  },

  // Sirocco: a dust devil drifts in across the floor, spins tighter and taller on the spot, and when it stops the sand
  // pours off and Sirocco is left standing in it.
  sand: {
    len: 1.8, hit: 0.64, shake: 6, wave: ["hsl(36 55% 60%)", "hsl(20 100% 60%)"],
    body: (u, s) => base(u < 0.64 ? "float" : settle(u, "flex", 0.8), {
      alpha: seg(u, 0.5, 0.66),
      sx: 0.7 + 0.3 * easeOut(seg(u, 0.5, 0.7)),
      solid: "hsl(36 55% 62%)", solidA: 1 - seg(u, 0.64, 0.9),
    }),
    bursts: [
      { at: 0.64, n: 40, spd: 360, shape: "dust", a: "hsl(36 50% 60%)", b: "hsl(40 60% 74%)", grav: 500, add: false, from: "body", dir: "out" },
      { at: 0.64, n: 22, spd: 300, shape: "dust", a: "hsl(34 45% 52%)", b: "hsl(26 100% 64%)", grav: 200, add: false, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 40, until: 0.64, spd: 160, shape: "dust", a: "hsl(36 50% 62%)", b: "hsl(40 55% 76%)", grav: 120, add: false, from: "feet", dir: "up", life: 0.6 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const fade = 1 - seg(u, 0.6, 0.78);
      if (fade <= 0) return;
      ctx.save();
      // it comes in from the side, then holds still on the spot
      const cx = x + (1 - easeOut(seg(u, 0, 0.35))) * -260 * s;
      const tall = (60 + 90 * easeOut(seg(u, 0.2, 0.6))) * s;
      // the funnel: stacked rings of sand, narrow at the floor, wide at the top, each spinning
      for (let i = 0; i < 14; i++) {
        const k = i / 13;
        const ry = ground - k * tall;
        const rx = (8 + k * k * 46) * s;
        const sway = Math.sin(t * 5 + k * 4) * 6 * s * k;
        ctx.strokeStyle = hsla(36, 50, 62 - k * 10, (0.35 + 0.45 * (1 - k)) * fade);
        ctx.lineWidth = (3.2 - k * 1.6) * s;
        ctx.beginPath();
        const a0 = t * 14 + i;
        ctx.ellipse(cx + sway, ry, rx, rx * 0.22, 0, a0, a0 + Math.PI * 1.4);
        ctx.stroke();
      }
      // the low sun-coloured haze it drags with it
      glow(ctx, cx, ground - tall * 0.4, 70 * s, tall * 0.6, hsla(26, 100, 60, 0.22 * fade), hsla(26, 100, 60, 0));
      ctx.restore();
    },
  },

  // Past Riftmaker: a warm rift splits open down the air, edged in gold, he steps through it with his scarf
  // streaming after him, and it zips shut behind him in a scatter of stars.
  pastrift: {
    len: 1.8, hit: 0.5, shake: 8, wave: ["hsl(40 100% 62%)", "hsl(298 80% 66%)"],
    body: (u) => base(u < 0.5 ? "guard" : settle(u, "flex", 0.7), {
      alpha: seg(u, 0.32, 0.5),
      sx: 0.2 + 0.8 * easeOut(seg(u, 0.32, 0.58)),
      solid: "hsl(44 100% 80%)", solidA: 1 - seg(u, 0.5, 0.8),
    }),
    bursts: [
      { at: 0.5, n: 26, spd: 420, shape: "star", a: "hsl(40 100% 64%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.72, n: 18, spd: 360, shape: "shard", a: "hsl(298 80% 72%)", b: "hsl(44 100% 84%)", grav: 400, add: false, from: "body", dir: "out" },
    ],
    trickle: { rate: 30, until: 0.5, spd: 0, shape: "star", a: "hsl(40 100% 66%)", b: "hsl(298 80% 78%)", grav: 0, add: true, from: "body", dir: "in", spread: 120, life: 0.6 },
    back: ({ ctx, x, y, s, u, t }) => {
      const w = 40 * s * easeOut(seg(u, 0.04, 0.32)) * (1 - easeIn(seg(u, 0.58, 0.74)));
      if (w < 0.5) return;
      const top = y - 180 * s, bot = y + 2;
      ctx.save();
      // the rift: a lens of a bright dawn sky, still warm, before anything went wrong
      ctx.beginPath();
      ctx.moveTo(x, top);
      for (let i = 1; i < 12; i++) {
        const k = i / 12;
        ctx.lineTo(x - w * Math.sin(k * Math.PI) + wob(i * 1.7) * 5 * s, top + (bot - top) * k);
      }
      ctx.lineTo(x, bot);
      for (let i = 11; i >= 1; i--) {
        const k = i / 12;
        ctx.lineTo(x + w * Math.sin(k * Math.PI) + wob(i * 2.9) * 5 * s, top + (bot - top) * k);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, "hsl(280 60% 30%)");
      g.addColorStop(0.55, "hsl(320 70% 52%)");
      g.addColorStop(1, "hsl(38 100% 60%)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = "hsl(40 100% 60%)";
      ctx.shadowBlur = 16 * s;
      ctx.strokeStyle = "hsl(44 100% 78%)";
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "hsl(0 0% 100% / 0.85)";
      for (let i = 0; i < 12; i++) {
        const k = (i * 0.41 + t * 0.2) % 1;
        ctx.fillRect(x + wob(i * 4.3) * w * 0.5, top + (bot - top) * k, 2 * s, 2 * s);
      }
      ctx.restore();
    },
  },

  // Volta: a small star streaks down out of the sky, slams into the spot in a flash of plasma, and Volta is crouched
  // in the scorch mark, still white-hot, before springing up grinning.
  plasma: {
    len: 1.7, hit: 0.48, shake: 10, wave: ["hsl(322 90% 64%)", "hsl(190 100% 70%)"],
    body: (u, s) => base(u < 0.48 ? "air" : settle(u, "land", 0.7), {
      alpha: seg(u, 0.46, 0.5),
      sy: u < 0.62 ? 0.85 + 0.15 * easeOut(seg(u, 0.48, 0.62)) : 1,
      solid: "hsl(0 0% 100%)", solidA: 1 - seg(u, 0.5, 0.82),
    }),
    bursts: [
      { at: 0.48, n: 40, spd: 520, shape: "spark", a: "hsl(322 90% 66%)", b: "hsl(190 100% 80%)", grav: 200, add: true, from: "feet", dir: "out" },
      { at: 0.48, n: 20, spd: 380, shape: "bolt", a: "hsl(190 100% 70%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "feet", dir: "flat" },
    ],
    back: ({ ctx, x, ground, s, u, t }) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      if (u < 0.48) {
        // the falling star and its tail
        const k = easeIn(seg(u, 0, 0.48));
        const sx = lerp(x - 240 * s, x, k), sy = lerp(ground - 380 * s, ground - 14 * s, k);
        for (let i = 6; i >= 0; i--) {
          const b = Math.max(0, k - i * 0.04);
          const tx = lerp(x - 240 * s, x, b), ty = lerp(ground - 380 * s, ground - 14 * s, b);
          glow(ctx, tx, ty, (14 - i * 1.6) * s, (14 - i * 1.6) * s, hsla(322, 90, 66, 0.55 - i * 0.07), hsla(322, 90, 66, 0));
        }
        glow(ctx, sx, sy, 20 * s, 20 * s, hsla(0, 0, 100, 0.95), hsla(190, 100, 70, 0));
      } else {
        // the scorch: a flash, then arcs of plasma crawling over the floor
        const f = 1 - seg(u, 0.48, 0.85);
        glow(ctx, x, ground - 20 * s, 120 * s * (1.2 - f * 0.2), 70 * s, hsla(322, 90, 70, 0.6 * f), hsla(190, 100, 70, 0));
        ctx.strokeStyle = hsla(190, 100, 76, 0.85 * f);
        ctx.lineWidth = 2 * s;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI + wob(i + Math.floor(t * 14)) * 0.3;
          jag(ctx, x, ground - 4 * s, x + Math.cos(a) * 80 * s, ground - Math.sin(a) * 30 * s, 5, 8 * s, i + Math.floor(t * 20));
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },

  // Turbo: a blue streak tears in along the floor, Turbo skids to a stop on the spot in a spray of sparks and a ring of
  // chaos energy, and stands up with the scarf still flying.
  chaos: {
    len: 1.6, hit: 0.44, shake: 8, wave: ["hsl(218 90% 60%)", "hsl(28 100% 62%)"],
    body: (u, s) => base(u < 0.44 ? "air" : settle(u, "land", 0.66), {
      alpha: u < 0.3 ? 0 : 1,
      dx: u < 0.44 ? -(1 - easeOut(seg(u, 0.3, 0.44))) * 280 * s : 0,
      dy: u < 0.44 ? -10 * s * (1 - seg(u, 0.3, 0.44)) : 0,
      sx: u < 0.52 ? 1.3 - 0.3 * seg(u, 0.44, 0.52) : 1, sy: u < 0.52 ? 0.86 : 1,
      echo: u > 0.3 && u < 0.7 ? { spread: (1 - seg(u, 0.3, 0.7)) * 60 * s, alpha: 0.45 * (1 - seg(u, 0.3, 0.7)) } : undefined,
      solid: "hsl(215 100% 70%)", solidA: 1 - seg(u, 0.44, 0.7),
    }),
    bursts: [
      { at: 0.44, n: 30, spd: 560, shape: "spark", a: "hsl(28 100% 62%)", b: "hsl(48 100% 80%)", grav: 260, add: true, from: "feet", dir: "flat" },
      { at: 0.44, n: 18, spd: 380, shape: "star", a: "hsl(218 100% 70%)", b: "hsl(0 0% 100%)", grav: -40, add: true, from: "body", dir: "out" },
      { at: 0.46, n: 16, spd: 300, shape: "dust", a: "hsl(30 20% 60%)", b: "hsl(40 25% 80%)", grav: -20, add: false, from: "feet", dir: "flat" },
    ],
    back: ({ ctx, x, ground, s, u, t }) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // the streak: a bright head racing in along the floor with a long blue tail
      const run = seg(u, 0.04, 0.44);
      if (run > 0 && u < 0.5) {
        const hx = lerp(x - 700 * s, x, easeOut(run));
        const tail = 240 * s * (1 - seg(u, 0.44, 0.5));
        for (let i = 0; i < 10; i++) {
          const k = i / 10;
          glow(ctx, hx - k * tail, ground - 36 * s, (26 - i * 1.6) * s, (34 - i * 2.4) * s, hsla(i < 2 ? 0 : 218, i < 2 ? 0 : 100, i < 2 ? 100 : 62, 0.55 * (1 - k)), hsla(218, 100, 55, 0));
        }
        // a thin orange line where the scarf streams behind
        ctx.strokeStyle = hsla(28, 100, 62, 0.8);
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(hx - 6 * s, ground - 54 * s);
        for (let i = 1; i <= 8; i++) ctx.lineTo(hx - (i / 8) * tail * 0.8, ground - 54 * s + Math.sin(t * 20 + i) * 5 * s);
        ctx.stroke();
      }
      // the skid marks and the ring of chaos energy left where he stopped
      const mark = seg(u, 0.42, 0.5) * (1 - seg(u, 0.75, 1));
      if (mark > 0) {
        ctx.strokeStyle = hsla(28, 100, 62, 0.7 * mark);
        ctx.lineWidth = 2 * s;
        for (const dy of [-1, 2]) {
          ctx.beginPath();
          ctx.moveTo(x - 140 * s, ground + dy * s);
          ctx.lineTo(x, ground + dy * s);
          ctx.stroke();
        }
        const ring = seg(u, 0.44, 0.8);
        ctx.strokeStyle = hsla(218, 100, 74, 0.8 * mark);
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.ellipse(x, ground - 2 * s, (30 + ring * 120) * s, (6 + ring * 18) * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Briar: a seed drops and lands on the spot, vines spiral up out of it into a tall closed bud, and the bud opens
  // petal by petal with Briar standing in the middle.
  flora: {
    len: 1.8, hit: 0.62, shake: 6, wave: ["hsl(118 50% 50%)", "hsl(330 100% 74%)"],
    body: (u, s) => base(u < 0.62 ? "crouch" : settle(u, "rise", 0.78), {
      alpha: seg(u, 0.58, 0.66),
      solid: "hsl(118 50% 60%)", solidA: 1 - seg(u, 0.62, 0.86),
    }),
    bursts: [
      { at: 0.62, n: 30, spd: 320, shape: "petal", a: "hsl(330 100% 74%)", b: "hsl(345 100% 86%)", grav: 120, add: false, from: "body", dir: "out" },
      { at: 0.62, n: 20, spd: 260, shape: "leaf", a: "hsl(118 50% 46%)", b: "hsl(90 70% 62%)", grav: 160, add: false, from: "feet", dir: "up" },
    ],
    back: ({ ctx, x, ground, s, u, t }) => {
      ctx.save();
      // the seed falling onto the spot
      if (u < 0.14) {
        const k = easeIn(seg(u, 0, 0.14));
        ctx.fillStyle = "hsl(30 45% 36%)";
        ctx.beginPath();
        ctx.ellipse(x, lerp(ground - 200 * s, ground - 3 * s, k), 3.5 * s, 5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const grow = easeOut(seg(u, 0.12, 0.56));
      const open = easeOut(seg(u, 0.58, 0.8));
      const fade = 1 - seg(u, 0.78, 0.98);
      if (grow > 0 && fade > 0) {
        const tall = 120 * s * grow;
        // two vines winding round each other up to the bud
        for (let v = 0; v < 2; v++) {
          ctx.strokeStyle = hsla(118, 46, v ? 34 : 42, 0.95 * fade);
          ctx.lineWidth = (5 - v) * s;
          ctx.beginPath();
          for (let i = 0; i <= 20; i++) {
            const k = i / 20;
            const px = x + Math.sin(k * 9 + v * Math.PI + t * 1.5) * 22 * s * (1 - k * 0.4) * (1 - open);
            const py = ground - k * tall;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
        // the bud: five petals closed into a point, falling open outward
        const by = ground - tall * 0.55;
        for (let i = 0; i < 5; i++) {
          const side = (i - 2) / 2;
          const ang = -Math.PI / 2 + side * (0.25 + open * 1.1);
          const len = 70 * s * grow;
          ctx.save();
          ctx.translate(x + side * 10 * s, ground - 8 * s);
          ctx.rotate(ang + Math.PI / 2);
          ctx.fillStyle = hsla(330, 90, i % 2 ? 66 : 72, 0.92 * fade);
          ctx.strokeStyle = hsla(345, 100, 86, 0.8 * fade);
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-18 * s, -len * 0.5, 0, -len);
          ctx.quadraticCurveTo(18 * s, -len * 0.5, 0, 0);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        // a warm glow inside the bud just before it opens
        const charge = seg(u, 0.42, 0.62) * fade;
        if (charge > 0) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, x, by, 50 * s * charge, 70 * s * charge, hsla(52, 100, 74, 0.6 * charge), hsla(330, 100, 70, 0));
        }
      }
      ctx.restore();
    },
  },

};

// ---------- the 8 Story bosses ----------
// A boss never borrows an element's entrance: each has its own, longer one.
const BOSS_LEN = 2.2;
/** A colour string "hsl(h s% l%)" with an alpha added. */
const withA = (hsl: string, a: number) => hsl.replace(")", ` / ${clamp(a, 0, 1)})`);

export const BOSS_INTROS: Record<BossDesign, IntroSpec> = {
  // Nullshade: a point of antimatter opens in the air, swallows the light around it, and turns inside out into the boss.
  antimatter: {
    len: BOSS_LEN, hit: 0.42, shake: 10, wave: ["hsl(186 100% 70%)", "hsl(268 60% 30%)"],
    body: (u, s) => base(u < 0.42 ? "float" : settle(u, "guard", 0.66), {
      alpha: u < 0.4 ? 0 : 1,
      sx: 0.08 + 0.92 * easeOut(seg(u, 0.4, 0.6)),
      dy: -(1 - easeOut(seg(u, 0.4, 0.72))) * 40 * s,
      solid: "hsl(186 100% 88%)", solidA: 1 - seg(u, 0.52, 0.84),
    }),
    bursts: [
      { at: 0.42, n: 34, spd: 560, shape: "spark", a: "hsl(186 100% 72%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.44, n: 18, spd: 260, shape: "smoke", a: "hsl(268 45% 12%)", b: "hsl(270 60% 28%)", grav: -40, add: false, from: "body", dir: "out" },
    ],
    trickle: { rate: 55, until: 0.4, spd: 0, shape: "dot", a: "hsl(186 100% 76%)", b: "hsl(275 80% 70%)", grav: 0, add: true, from: "body", dir: "in", spread: 150, life: 0.7 },
    back: ({ ctx, x, y, s, u, t }) => {
      const cy = y - 55 * s;
      const open = easeOut(seg(u, 0.02, 0.32)) * (1 - easeIn(seg(u, 0.32, 0.44)));
      ctx.save();
      if (open > 0.01) {
        const r = 38 * s * open;
        glow(ctx, x, cy, r * 4, r * 4, hsla(268, 50, 6, 0.55 * open), hsla(268, 50, 6, 0));
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = i % 2 ? hsla(275, 90, 70, 0.6 * open) : hsla(186, 100, 75, 0.8 * open);
          ctx.lineWidth = (3 - i) * s;
          ctx.beginPath();
          ctx.ellipse(x, cy, r * (1.9 + i * 0.35), r * (0.5 + i * 0.1), -0.25 + Math.sin(t * 2 + i) * 0.05, t * (4 + i), t * (4 + i) + Math.PI * 1.6);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "hsl(268 60% 3%)";
        ctx.beginPath();
        ctx.arc(x, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hsla(186, 100, 85, open);
        ctx.lineWidth = 2 * s;
        ctx.stroke();
      }
      // the inversion: a cyan shell flung outward when it turns inside out
      const k = seg(u, 0.42, 0.72);
      if (k > 0 && k < 1) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = hsla(186, 100, 75, 1 - k);
        ctx.lineWidth = 6 * s * (1 - k);
        ctx.beginPath();
        ctx.arc(x, cy, 30 * s + 200 * s * easeOut(k), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Maelstrom: a whirlpool spins open in the floor, a waterspout lifts the boss high, then it crashes down in a wave.
  maelstrom: {
    len: BOSS_LEN, hit: 0.62, shake: 13, wave: ["hsl(200 90% 55%)", "hsl(186 100% 85%)"],
    body: (u, s) => base(u < 0.55 ? "float" : u < 0.72 ? "land" : u < 0.86 ? "flex" : "stance", {
      alpha: seg(u, 0.32, 0.45),
      dy: u < 0.55 ? -(170 + Math.sin(u * 30) * 6) * s * seg(u, 0.2, 0.4) : -170 * s * (1 - easeIn(seg(u, 0.55, 0.62))),
      solid: "hsl(192 90% 82%)", solidA: 1 - seg(u, 0.5, 0.8),
    }),
    bursts: [
      { at: 0.25, n: 20, spd: 420, shape: "drop", a: "hsl(200 85% 55%)", b: "hsl(188 100% 82%)", grav: 900, add: false, from: "feet", dir: "up" },
      { at: 0.62, n: 40, spd: 620, shape: "drop", a: "hsl(205 85% 50%)", b: "hsl(186 100% 85%)", grav: 1000, add: false, from: "feet", dir: "up" },
      { at: 0.62, n: 18, spd: 380, shape: "bubble", a: "hsl(195 90% 70%)", b: "hsl(0 0% 100%)", grav: -60, add: false, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 60, until: 0.72, spd: 40, shape: "drop", a: "hsl(205 70% 70%)", b: "hsl(190 80% 88%)", grav: 1100, add: false, from: "sky", dir: "out", spread: 220, life: 1 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const k = easeOut(seg(u, 0, 0.22)) * (1 - seg(u, 0.7, 1));
      if (k <= 0) return;
      ctx.save();
      // storm-dark sky
      ctx.fillStyle = hsla(215, 50, 10, 0.32 * k);
      ctx.fillRect(-400, -400, 2000, 1200);
      // the whirlpool, rings turning faster toward the middle
      glow(ctx, x, ground + 4, 120 * s * k, 22 * s * k, hsla(200, 80, 40, 0.7 * k), hsla(205, 80, 30, 0));
      for (let i = 0; i < 5; i++) {
        const r = (110 - i * 20) * s * k;
        ctx.strokeStyle = i % 2 ? hsla(188, 100, 85, 0.75 * k) : hsla(205, 85, 55, 0.8 * k);
        ctx.lineWidth = 3 * s;
        const a0 = t * (3 + i * 2.2);
        ctx.beginPath();
        ctx.ellipse(x, ground + 4, r, r * 0.18, 0, a0, a0 + Math.PI * 1.3);
        ctx.stroke();
      }
      // the waterspout
      const h = 250 * s * easeOut(seg(u, 0.18, 0.4)) * (1 - easeIn(seg(u, 0.55, 0.66)));
      if (h > 2) {
        const w0 = 26 * s, w1 = 60 * s;
        ctx.beginPath();
        ctx.moveTo(x - w0, ground);
        for (let i = 1; i <= 10; i++) ctx.lineTo(x - w0 - (w1 - w0) * (i / 10) + Math.sin(t * 14 + i) * 7 * s, ground - (h * i) / 10);
        for (let i = 10; i >= 1; i--) ctx.lineTo(x + w0 + (w1 - w0) * (i / 10) + Math.sin(t * 12 + i * 1.7) * 7 * s, ground - (h * i) / 10);
        ctx.lineTo(x + w0, ground);
        ctx.closePath();
        const g = ctx.createLinearGradient(x - w1, 0, x + w1, 0);
        g.addColorStop(0, hsla(205, 85, 45, 0.25));
        g.addColorStop(0.5, hsla(190, 100, 80, 0.85));
        g.addColorStop(1, hsla(205, 85, 45, 0.25));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = hsla(0, 0, 100, 0.55);
        ctx.lineWidth = 2 * s;
        for (let i = 0; i < 5; i++) {
          const yy = ground - ((t * 260 + i * 60 * s) % h);
          const ww = w0 + (w1 - w0) * ((ground - yy) / h);
          ctx.beginPath();
          ctx.ellipse(x, yy, ww * 0.9, 5 * s, 0, 0, Math.PI);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },

  // Magmaw: glowing cracks race across the floor, the ground bursts and the volcano climbs out of the lava.
  magmaw: {
    len: BOSS_LEN, hit: 0.42, shake: 20, wave: ["hsl(18 100% 50%)", "hsl(42 100% 62%)"],
    body: (u, s) => base(settle(u, "rise", 0.68), {
      clip: true, alpha: u < 0.42 ? 0 : 1,
      dy: (1 - easeOut(seg(u, 0.42, 0.6))) * 175 * s,
      solid: "hsl(26 100% 56%)", solidA: 1 - seg(u, 0.55, 0.85),
    }),
    bursts: [
      { at: 0.08, n: 14, spd: 180, shape: "dust", a: "hsl(20 20% 30%)", b: "hsl(30 30% 50%)", grav: -20, add: false, from: "feet", dir: "flat" },
      { at: 0.42, n: 36, spd: 760, shape: "chunk", a: "hsl(14 30% 18%)", b: "hsl(24 90% 48%)", grav: 1400, add: false, from: "feet", dir: "up" },
      { at: 0.42, n: 30, spd: 620, shape: "ember", a: "hsl(16 100% 52%)", b: "hsl(46 100% 64%)", grav: -120, add: true, from: "feet", dir: "up" },
      { at: 0.46, n: 16, spd: 220, shape: "smoke", a: "hsl(15 15% 18%)", b: "hsl(20 15% 30%)", grav: -90, add: false, from: "feet", dir: "up", spread: 40 },
    ],
    trickle: { rate: 45, until: 0.42, spd: 200, shape: "ember", a: "hsl(18 100% 52%)", b: "hsl(44 100% 64%)", grav: -200, add: true, from: "feet", dir: "up", spread: 80 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const k = easeOut(seg(u, 0, 0.4));
      const fade = 1 - seg(u, 0.72, 1);
      if (k <= 0 || fade <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, ground + 4, 140 * s * k, 20 * s * k, hsla(28, 100, 55, 0.75 * fade), hsla(10, 100, 40, 0));
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const dir = i % 2 ? 1 : -1;
        const len = (90 + (i % 4) * 35) * s * k;
        const yy = ground + 3 + (i % 4) * 10;
        ctx.strokeStyle = hsla(30 + (i % 3) * 8, 100, 58, 0.9 * fade);
        ctx.lineWidth = (4 - (i % 3)) * s;
        jag(ctx, x, ground + 2, x + dir * len, yy, 6, 6 * s, i * 11);
        ctx.stroke();
      }
      // the lava fountain once it breaks through
      const f2 = seg(u, 0.4, 0.46) * (1 - seg(u, 0.55, 0.85));
      if (f2 > 0) {
        const h = 230 * s * f2;
        const g = ctx.createLinearGradient(0, ground, 0, ground - h);
        g.addColorStop(0, hsla(18, 100, 52, 0.95));
        g.addColorStop(0.6, hsla(38, 100, 60, 0.6));
        g.addColorStop(1, hsla(48, 100, 70, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 50 * s, ground);
        ctx.quadraticCurveTo(x - 20 * s + Math.sin(t * 20) * 6 * s, ground - h * 0.6, x, ground - h);
        ctx.quadraticCurveTo(x + 20 * s + Math.sin(t * 17) * 6 * s, ground - h * 0.6, x + 50 * s, ground);
        ctx.fill();
      }
      ctx.restore();
    },
    front: ({ ctx, x, ground, s, u }) => {
      const up = easeOut(seg(u, 0.42, 0.52)) * (1 - seg(u, 0.78, 1));
      if (up <= 0) return;
      ctx.save();
      for (const [ox, hh, w] of [[-70, 58, 18], [-38, 84, 20], [40, 78, 19], [72, 52, 16], [-6, 40, 14]] as const) {
        const h = hh * s * up;
        ctx.beginPath();
        ctx.moveTo(x + (ox - w) * s, ground + 4);
        ctx.lineTo(x + (ox + w * 0.2) * s, ground - h);
        ctx.lineTo(x + (ox + w) * s, ground + 4);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, ground - h, 0, ground);
        g.addColorStop(0, "hsl(14 25% 16%)");
        g.addColorStop(0.7, "hsl(16 50% 22%)");
        g.addColorStop(1, "hsl(24 100% 48%)");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "hsl(28 100% 55%)";
        ctx.lineWidth = 2 * s;
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // Everwinter: a blizzard sweeps in, a great clock face of ice runs backwards and stops, and the frozen boss cracks free.
  everwinter: {
    len: BOSS_LEN, hit: 0.62, shake: 9, wave: ["hsl(195 90% 75%)", "hsl(44 90% 72%)"],
    body: (u) => base(u < 0.62 ? "guard" : settle(u, "flex", 0.66), {
      alpha: seg(u, 0.1, 0.35),
      solid: "hsl(196 85% 90%)", solidA: u < 0.62 ? 0.85 : 1 - seg(u, 0.62, 0.74),
    }),
    bursts: [
      { at: 0.62, n: 38, spd: 560, shape: "shard", a: "hsl(196 90% 78%)", b: "hsl(0 0% 100%)", grav: 700, add: false, from: "body", dir: "out" },
      { at: 0.62, n: 20, spd: 300, shape: "flake", a: "hsl(190 100% 92%)", b: "hsl(44 90% 78%)", grav: 40, add: false, from: "body", dir: "out" },
    ],
    trickle: { rate: 70, until: 0.7, spd: 120, shape: "flake", a: "hsl(200 60% 92%)", b: "hsl(0 0% 100%)", grav: 160, add: false, from: "sky", dir: "out", spread: 260, life: 1.4 },
    back: ({ ctx, x, y, s, u, t }) => {
      const k = easeOut(seg(u, 0, 0.22)) * (1 - seg(u, 0.72, 1));
      if (k <= 0) return;
      const cx = x, cy = y - 78 * s, r = 96 * s * k;
      ctx.save();
      glow(ctx, cx, cy, r * 1.5, r * 1.5, hsla(196, 90, 85, 0.35 * k), hsla(196, 90, 85, 0));
      ctx.strokeStyle = hsla(44, 90, 72, 0.9 * k);
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = hsla(196, 80, 90, 0.8 * k);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = r * (i % 3 === 0 ? 0.7 : 0.78);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
        ctx.stroke();
      }
      // the hands run backwards, slowing, and stop dead when the ice breaks
      const run = 1 - easeOut(seg(u, 0.1, 0.62));
      const spin = -(t * 9 * run + (1 - run) * 6.2);
      ctx.strokeStyle = hsla(44, 90, 75, k);
      ctx.lineCap = "round";
      for (const [len, w, m] of [[0.75, 3, 1], [0.5, 5, 1 / 12]] as const) {
        const a = spin * m - Math.PI / 2;
        ctx.lineWidth = w * s;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r * len, cy + Math.sin(a) * r * len);
        ctx.stroke();
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u }) => {
      const k = seg(u, 0.15, 0.35);
      if (k <= 0 || u > 0.66) return;
      const crack = seg(u, 0.5, 0.62);
      ctx.save();
      const cy = y - 55 * s;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        ctx.lineTo(x + Math.cos(a) * 52 * s, cy + Math.sin(a) * 78 * s);
      }
      ctx.closePath();
      ctx.fillStyle = hsla(196, 90, 85, 0.22 * k);
      ctx.fill();
      ctx.strokeStyle = hsla(0, 0, 100, 0.8 * k);
      ctx.lineWidth = 2 * s;
      ctx.stroke();
      if (crack > 0) {
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3;
          jag(ctx, x, cy, x + Math.cos(a) * 60 * s * crack, cy + Math.sin(a) * 80 * s * crack, 4, 6 * s, i * 5);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },

  // The Riftmaker: reality tears open down the middle and the boss squeezes out through the slit; mirror shards orbit it.
  riftmaker: {
    len: BOSS_LEN, hit: 0.36, shake: 11, wave: ["hsl(318 100% 70%)", "hsl(186 100% 80%)"],
    body: (u) => base(u < 0.5 ? "guard" : settle(u, "flex", 0.66), {
      alpha: seg(u, 0.34, 0.5),
      sx: 0.15 + 0.85 * easeOut(seg(u, 0.34, 0.6)),
      solid: "hsl(318 100% 82%)", solidA: 1 - seg(u, 0.5, 0.8),
    }),
    bursts: [
      { at: 0.36, n: 26, spd: 420, shape: "glyph", a: "hsl(318 100% 72%)", b: "hsl(186 100% 80%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.7, n: 24, spd: 520, shape: "shard", a: "hsl(300 80% 85%)", b: "hsl(0 0% 100%)", grav: 500, add: false, from: "body", dir: "out" },
    ],
    trickle: { rate: 36, until: 0.36, spd: 0, shape: "glyph", a: "hsl(318 100% 72%)", b: "hsl(260 90% 75%)", grav: 0, add: true, from: "body", dir: "in", spread: 140, life: 0.6 },
    back: ({ ctx, x, y, s, u, t }) => {
      const w = 46 * s * easeOut(seg(u, 0.04, 0.34)) * (1 - easeIn(seg(u, 0.6, 0.76)));
      if (w < 0.5) return;
      const top = y - 190 * s, bot = y + 2;
      ctx.save();
      // the tear: a jagged lens of another sky, starry and violet
      ctx.beginPath();
      ctx.moveTo(x, top);
      for (let i = 1; i < 12; i++) {
        const k = i / 12;
        ctx.lineTo(x - w * Math.sin(k * Math.PI) + wob(i * 2.1) * 6 * s, top + (bot - top) * k);
      }
      ctx.lineTo(x, bot);
      for (let i = 11; i >= 1; i--) {
        const k = i / 12;
        ctx.lineTo(x + w * Math.sin(k * Math.PI) + wob(i * 3.3) * 6 * s, top + (bot - top) * k);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, "hsl(262 70% 10%)");
      g.addColorStop(0.5, "hsl(300 70% 22%)");
      g.addColorStop(1, "hsl(240 70% 12%)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowColor = "hsl(318 100% 70%)";
      ctx.shadowBlur = 18 * s;
      ctx.strokeStyle = "hsl(318 100% 82%)";
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "hsl(0 0% 100% / 0.85)";
      for (let i = 0; i < 14; i++) {
        const k = (i * 0.37 + t * 0.15) % 1;
        ctx.fillRect(x + wob(i * 5.7) * w * 0.5, top + (bot - top) * k, 2 * s, 2 * s);
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u, t }) => {
      const k = seg(u, 0.36, 0.5) * (1 - seg(u, 0.66, 0.72));
      if (k <= 0) return;
      ctx.save();
      const cy = y - 55 * s;
      for (let i = 0; i < 8; i++) {
        const a = t * 2.4 + (i / 8) * Math.PI * 2;
        const px = x + Math.cos(a) * 80 * s, py = cy + Math.sin(a) * 34 * s;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a * 1.5);
        ctx.beginPath();
        ctx.moveTo(0, -10 * s); ctx.lineTo(7 * s, 6 * s); ctx.lineTo(-6 * s, 8 * s);
        ctx.closePath();
        ctx.fillStyle = hsla(i % 2 ? 318 : 186, 90, 85, 0.75 * k);
        ctx.fill();
        ctx.strokeStyle = hsla(0, 0, 100, k);
        ctx.lineWidth = 1.2 * s;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
  },

  // The Hollow King: graves rise in a green fog, a ring of runes burns on the floor and the king rises slowly with souls circling.
  hollow: {
    len: BOSS_LEN, hit: 0.72, shake: 8, wave: ["hsl(140 80% 50%)", "hsl(150 60% 80%)"],
    body: (u, s) => base(settle(u, "rise", 0.74), {
      clip: true, alpha: u < 0.28 ? 0 : 1,
      dy: (1 - easeInOut(seg(u, 0.28, 0.72))) * 150 * s,
      solid: "hsl(140 70% 45%)", solidA: 0.7 * (1 - seg(u, 0.62, 0.88)),
    }),
    bursts: [
      { at: 0.28, n: 18, spd: 220, shape: "smoke", a: "hsl(150 40% 18%)", b: "hsl(140 60% 35%)", grav: -60, add: false, from: "feet", dir: "up", spread: 50 },
      { at: 0.72, n: 30, spd: 420, shape: "smoke", a: "hsl(140 80% 55%)", b: "hsl(150 60% 85%)", grav: -40, add: true, from: "body", dir: "out" },
    ],
    trickle: { rate: 45, until: 0.72, spd: 140, shape: "smoke", a: "hsl(150 30% 16%)", b: "hsl(140 70% 40%)", grav: -80, add: false, from: "feet", dir: "up", spread: 90 },
    back: ({ ctx, x, ground, s, u, t }) => {
      const k = easeOut(seg(u, 0, 0.25)) * (1 - seg(u, 0.78, 1));
      if (k <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(160, 40, 6, 0.3 * k);
      ctx.fillRect(-400, -400, 2000, 1200);
      glow(ctx, x, ground, 150 * s, 40 * s, hsla(140, 80, 40, 0.45 * k), hsla(140, 80, 30, 0));
      // headstones rise out of the ground on both sides
      for (const [ox, hh, w] of [[-120, 46, 20], [-80, 34, 16], [96, 50, 22], [136, 30, 14]] as const) {
        const h = hh * s * easeOut(seg(u, 0.02, 0.22)) * (1 - easeIn(seg(u, 0.8, 1)));
        if (h <= 0) continue;
        const bx = x + ox * s;
        ctx.fillStyle = "hsl(160 10% 22%)";
        ctx.beginPath();
        ctx.moveTo(bx - w * s * 0.5, ground);
        ctx.lineTo(bx - w * s * 0.5, ground - h + w * s * 0.5);
        ctx.arc(bx, ground - h + w * s * 0.5, w * s * 0.5, Math.PI, 0);
        ctx.lineTo(bx + w * s * 0.5, ground);
        ctx.fill();
        ctx.strokeStyle = hsla(140, 70, 50, 0.6 * k);
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
      }
      // the rune ring burning on the floor
      ctx.globalCompositeOperation = "lighter";
      const rr = 90 * s * easeOut(seg(u, 0.08, 0.3));
      ctx.strokeStyle = hsla(140, 90, 55, 0.85 * k);
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.ellipse(x, ground + 3, rr, rr * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + t * 0.8;
        const px = x + Math.cos(a) * rr * 0.85, py = ground + 3 + Math.sin(a) * rr * 0.17;
        ctx.fillStyle = hsla(140, 90, 65, 0.8 * k);
        ctx.fillRect(px - 2 * s, py - 4 * s, 4 * s, 8 * s);
      }
      ctx.restore();
    },
    front: ({ ctx, x, y, s, u, t }) => {
      const k = seg(u, 0.3, 0.45) * (1 - seg(u, 0.75, 0.9));
      if (k <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const a = t * 3 + (i / 5) * Math.PI * 2;
        const climb = ((t * 0.6 + i * 0.2) % 1);
        const px = x + Math.cos(a) * 58 * s, py = y - (10 + climb * 120) * s;
        const front = Math.sin(a) > 0;
        const r = (front ? 9 : 6) * s;
        glow(ctx, px, py, r * 2.2, r * 2.2, hsla(140, 90, 70, 0.55 * k), hsla(140, 90, 50, 0));
        ctx.fillStyle = hsla(150, 70, 88, 0.85 * k);
        ctx.beginPath();
        ctx.arc(px, py, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hsla(160, 50, 10, 0.9 * k);
        ctx.fillRect(px - r * 0.35, py - r * 0.15, r * 0.2, r * 0.25);
        ctx.fillRect(px + r * 0.15, py - r * 0.15, r * 0.2, r * 0.25);
      }
      ctx.restore();
    },
  },

  // The Black Sun: the sky goes dark, a black sun with a gold corona sinks, and the boss descends in front of it.
  blacksun: {
    len: BOSS_LEN, hit: 0.7, shake: 15, wave: ["hsl(44 100% 60%)", "hsl(30 30% 8%)"],
    body: (u, s) => base(u < 0.7 ? "float" : u < 0.78 ? "land" : u < 0.88 ? "flex" : "stance", {
      alpha: seg(u, 0.18, 0.38),
      dy: -(1 - easeOut(seg(u, 0.18, 0.7))) * 270 * s,
      solid: "hsl(44 100% 72%)", solidA: 1 - seg(u, 0.55, 0.82),
    }),
    bursts: [
      { at: 0.7, n: 32, spd: 520, shape: "star", a: "hsl(44 100% 62%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.7, n: 18, spd: 360, shape: "dust", a: "hsl(30 20% 25%)", b: "hsl(40 30% 45%)", grav: -20, add: false, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 30, until: 0.7, spd: 160, shape: "spark", a: "hsl(44 100% 65%)", b: "hsl(36 100% 55%)", grav: 0, add: true, from: "body", dir: "out", life: 0.5 },
    back: ({ ctx, x, y, s, u, t }) => {
      const dark = easeOut(seg(u, 0, 0.2)) * (1 - seg(u, 0.75, 1));
      if (dark <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(30, 30, 4, 0.5 * dark);
      ctx.fillRect(-400, -400, 2000, 1200);
      const cy = y - 85 * s - (1 - easeOut(seg(u, 0.1, 0.7))) * 220 * s;
      const r = 70 * s;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, cy, r * 2.4, r * 2.4, hsla(44, 100, 60, 0.55 * dark), hsla(36, 100, 50, 0));
      ctx.strokeStyle = hsla(44, 100, 68, 0.7 * dark);
      ctx.lineCap = "round";
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 0.6;
        const len = (i % 2 ? 40 : 70) * s;
        ctx.lineWidth = (i % 2 ? 2 : 3.5) * s;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05);
        ctx.lineTo(x + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "hsl(30 30% 3%)";
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hsla(48, 100, 80, dark);
      ctx.lineWidth = 2.5 * s;
      ctx.stroke();
      ctx.restore();
    },
  },
  // The Axiom: the arena goes to open space, a spiral galaxy turns in the sky and falls toward the spot, collapses
  // into one bright point, and the boss unfolds out of it.
  axiom: {
    len: BOSS_LEN, hit: 0.66, shake: 16, wave: ["hsl(272 100% 80%)", "hsl(236 55% 12%)"],
    body: (u, s) => base(u < 0.66 ? "float" : settle(u, "guard", 0.82), {
      alpha: seg(u, 0.62, 0.7),
      sx: 0.1 + 0.9 * easeOut(seg(u, 0.62, 0.8)), sy: 0.1 + 0.9 * easeOut(seg(u, 0.62, 0.8)),
      dy: -(1 - easeOut(seg(u, 0.62, 0.8))) * 60 * s,
      solid: "hsl(48 100% 92%)", solidA: 1 - seg(u, 0.7, 0.92),
    }),
    bursts: [
      { at: 0.66, n: 44, spd: 560, shape: "star", a: "hsl(272 100% 80%)", b: "hsl(48 100% 86%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.66, n: 20, spd: 300, shape: "star", a: "hsl(200 100% 84%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out", life: 1.1 },
    ],
    trickle: { rate: 26, until: 0.66, spd: 200, shape: "star", a: "hsl(272 100% 82%)", b: "hsl(48 100% 86%)", grav: 0, add: true, from: "body", dir: "in", life: 0.5 },
    back: ({ ctx, x, y, s, u, t }) => {
      const dark = easeOut(seg(u, 0, 0.18)) * (1 - seg(u, 0.78, 1));
      if (dark <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(240, 60, 4, 0.62 * dark);
      ctx.fillRect(-400, -400, 2000, 1200);
      // a scatter of fixed stars across the dark
      ctx.fillStyle = hsla(0, 0, 100, 0.8 * dark);
      for (let i = 0; i < 40; i++) {
        const sx = x + wob(i * 3.1) * 520, sy = y - 200 * s + wob(i * 7.7) * 260;
        const tw = 0.5 + 0.5 * Math.sin(t * 4 + i);
        ctx.globalAlpha = dark * tw;
        ctx.fillRect(sx, sy, 2 * s, 2 * s);
      }
      ctx.globalAlpha = 1;
      // the galaxy: falls from the sky toward the spot, shrinking and spinning faster as it collapses
      const fall = easeIn(seg(u, 0.12, 0.62));
      const gx = x, gy = lerp(y - 230 * s, y - 50 * s, fall);
      const R = lerp(150, 6, fall) * s;
      if (u < 0.66) {
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, gx, gy, R * 1.2, R * 0.55, hsla(272, 100, 70, 0.45 * dark), hsla(272, 100, 60, 0));
        const spin = t * (1.5 + fall * 10);
        for (let arm = 0; arm < 2; arm++) {
          for (let i = 0; i < 46; i++) {
            const k = i / 45;
            const an = spin + arm * Math.PI + k * 4.2;
            const r = k * R;
            const px = gx + Math.cos(an) * r, py = gy + Math.sin(an) * r * 0.42;
            ctx.fillStyle = i % 5 === 0 ? hsla(48, 100, 86, 0.9 * dark) : hsla(272 - k * 70, 100, 80, (0.9 - k * 0.5) * dark);
            ctx.beginPath();
            ctx.arc(px, py, (2.6 - k * 1.4) * s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        glow(ctx, gx, gy, 16 * s, 16 * s, hsla(0, 0, 100, dark), hsla(48, 100, 80, 0));
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    },
  },
  // The Lanternmaw: the arena sinks into deep dark water, one small light drifts down out of the black and hangs
  // at head height, swaying, and the boss looms up out of the dark behind its own lure.
  lanternmaw: {
    len: BOSS_LEN, hit: 0.64, shake: 12, wave: ["hsl(66 100% 64%)", "hsl(196 48% 11%)"],
    body: (u, s) => base(u < 0.64 ? "float" : settle(u, "guard", 0.8), {
      alpha: seg(u, 0.4, 0.66),
      dy: (1 - easeOut(seg(u, 0.4, 0.7))) * 50 * s,
      solid: "hsl(196 60% 6%)", solidA: 1 - seg(u, 0.6, 0.88),
    }),
    bursts: [
      { at: 0.64, n: 30, spd: 420, shape: "dot", a: "hsl(66 100% 70%)", b: "hsl(180 80% 76%)", grav: -60, add: true, from: "body", dir: "out" },
      { at: 0.64, n: 16, spd: 220, shape: "smoke", a: "hsl(196 50% 8%)", b: "hsl(190 40% 18%)", grav: -30, add: false, from: "body", dir: "out" },
    ],
    trickle: { rate: 22, until: 0.64, spd: 60, shape: "dot", a: "hsl(180 70% 76%)", b: "hsl(190 60% 60%)", grav: -120, add: true, from: "feet", dir: "out", life: 0.9 },
    back: ({ ctx, x, y, s, u, t }) => {
      const dark = easeOut(seg(u, 0, 0.2)) * (1 - seg(u, 0.78, 1));
      if (dark <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(200, 60, 4, 0.66 * dark);
      ctx.fillRect(-400, -400, 2000, 1200);
      // shafts of dim light from the surface, far above
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const sx = x + wob(i * 4.3) * 420;
        ctx.fillStyle = hsla(180, 60, 60, 0.05 * dark);
        ctx.beginPath();
        ctx.moveTo(sx - 20 * s, y - 420 * s);
        ctx.lineTo(sx + 20 * s, y - 420 * s);
        ctx.lineTo(sx + 70 * s + Math.sin(t + i) * 10 * s, y + 40 * s);
        ctx.lineTo(sx - 10 * s + Math.sin(t + i) * 10 * s, y + 40 * s);
        ctx.fill();
      }
      // the lure: drifts down from above and hangs, swaying, just in front of where the boss will be
      const fall = easeOut(seg(u, 0.04, 0.42));
      const lx = x + 24 * s + Math.sin(t * 2.2) * 14 * s * (1 - seg(u, 0.5, 0.7));
      const ly = lerp(y - 320 * s, y - 112 * s, fall);
      ctx.strokeStyle = hsla(186, 40, 40, 0.6 * dark);
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(lx, ly - 400 * s * (1 - seg(u, 0.4, 0.64)));
      ctx.lineTo(lx, ly);
      ctx.stroke();
      glow(ctx, lx, ly, 40 * s, 40 * s, hsla(66, 100, 66, 0.75 * dark), hsla(66, 100, 60, 0));
      ctx.fillStyle = hsla(66, 100, 92, dark);
      ctx.beginPath();
      ctx.arc(lx, ly, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // the shape behind the light: a pale eye opening in the dark just before the boss arrives
      const eye = seg(u, 0.3, 0.5) * (1 - seg(u, 0.6, 0.7));
      if (eye > 0) {
        ctx.fillStyle = hsla(60, 30, 85, 0.85 * eye);
        ctx.beginPath();
        ctx.ellipse(x, y - 150 * s, 46 * s, 16 * s * eye, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hsla(64, 100, 50, eye);
        ctx.beginPath();
        ctx.arc(x + 6 * s, y - 150 * s, 13 * s * eye, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hsla(200, 60, 3, eye);
        ctx.beginPath();
        ctx.ellipse(x + 6 * s, y - 150 * s, 3 * s, 12 * s * eye, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },
  // The Sporemother: the floor splits and pale roots crawl out across it, a ring of mushrooms bursts up in a
  // circle, they all open their caps and sing, and the boss grows up out of the middle of the ring.
  sporemother: {
    len: BOSS_LEN, hit: 0.62, shake: 10, wave: ["hsl(170 100% 64%)", "hsl(318 26% 17%)"],
    body: (u, s) => base(u < 0.62 ? "rise" : settle(u, "flex", 0.8), {
      alpha: seg(u, 0.36, 0.6),
      dy: (1 - easeOut(seg(u, 0.36, 0.64))) * 70 * s,
      sy: 0.4 + 0.6 * easeOut(seg(u, 0.36, 0.64)), clip: true,
      solid: "hsl(318 30% 14%)", solidA: 1 - seg(u, 0.58, 0.86),
    }),
    bursts: [
      { at: 0.62, n: 34, spd: 360, shape: "dust", a: "hsl(170 100% 70%)", b: "hsl(320 70% 84%)", grav: -40, add: true, from: "body", dir: "out" },
      { at: 0.62, n: 14, spd: 260, shape: "leaf", a: "hsl(316 30% 30%)", b: "hsl(24 30% 26%)", grav: 300, add: false, from: "feet", dir: "up" },
    ],
    trickle: { rate: 26, until: 0.62, spd: 70, shape: "dust", a: "hsl(170 100% 70%)", b: "hsl(320 60% 80%)", grav: -90, add: true, from: "feet", dir: "out", life: 1 },
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.16) * (1 - seg(u, 0.8, 1));
      if (on <= 0) return;
      ctx.save();
      // roots crawling out across the floor
      ctx.strokeStyle = hsla(40, 20, 74, 0.85 * on);
      ctx.lineCap = "round";
      const grow = easeOut(seg(u, 0.02, 0.34));
      for (let i = 0; i < 8; i++) {
        const dir = i % 2 ? 1 : -1, len = (90 + wob(i * 2.7) * 60 + 60) * s * grow;
        ctx.lineWidth = (4 - (i % 3)) * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 1; k <= 6; k++) ctx.lineTo(x + dir * (len * k) / 6, y + Math.sin(k * 1.7 + i) * 3 * s);
        ctx.stroke();
      }
      // the ring of mushrooms bursting up, then opening and singing
      const pop = easeOut(seg(u, 0.18, 0.4));
      for (let i = 0; i < 7; i++) {
        const mx = x + (i - 3) * 30 * s, h = (14 + (i % 3) * 8) * s * pop;
        if (h <= 0) continue;
        ctx.strokeStyle = hsla(40, 20, 80, on);
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(mx, y);
        ctx.lineTo(mx, y - h);
        ctx.stroke();
        ctx.fillStyle = hsla(320, 30, 38, on);
        ctx.beginPath();
        ctx.ellipse(mx, y - h, 9 * s * pop, 6 * s * pop, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        const sing = seg(u, 0.32, 0.5);
        if (sing > 0) glow(ctx, mx, y - h - 6 * s, 14 * s, 14 * s * (1 + Math.sin(t * 8 + i) * 0.2), hsla(170, 100, 66, 0.6 * sing * on), hsla(170, 100, 60, 0));
      }
      ctx.restore();
    },
  },
  // The Mnemovore: the arena drains of colour like an old photograph, a doorway that was never there is drawn
  // in thin pale lines, it opens onto white, and the boss steps out of it while the doorway is forgotten again.
  mnemovore: {
    len: BOSS_LEN, hit: 0.6, shake: 8, wave: ["hsl(300 100% 82%)", "hsl(262 18% 20%)"],
    body: (u, s) => base(u < 0.6 ? "float" : settle(u, "guard", 0.8), {
      alpha: seg(u, 0.4, 0.6),
      dx: (1 - easeOut(seg(u, 0.4, 0.62))) * -18 * s,
      solid: "hsl(40 30% 92%)", solidA: 1 - seg(u, 0.56, 0.84),
    }),
    bursts: [
      { at: 0.6, n: 28, spd: 320, shape: "pixel", a: "hsl(300 100% 84%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.6, n: 12, spd: 180, shape: "glyph", a: "hsl(40 30% 88%)", b: "hsl(270 20% 60%)", grav: 60, add: false, from: "body", dir: "out" },
    ],
    back: ({ ctx, x, y, s, u }) => {
      const on = easeOut(seg(u, 0, 0.18)) * (1 - seg(u, 0.78, 1));
      if (on <= 0) return;
      ctx.save();
      // everything fades like an old photograph
      ctx.fillStyle = hsla(36, 20, 80, 0.32 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      // a doorway that was never there, drawn in pale lines, then opening onto white
      const draw = easeOut(seg(u, 0.08, 0.34));
      const dw = 40 * s, dh = 120 * s;
      ctx.strokeStyle = hsla(300, 60, 70, 0.9 * on);
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(x - dw, y);
      ctx.lineTo(x - dw, y - dh * Math.min(1, draw * 2));
      if (draw > 0.5) ctx.lineTo(x - dw + 2 * dw * Math.min(1, (draw - 0.5) * 4), y - dh);
      if (draw > 0.75) ctx.lineTo(x + dw, y - dh + dh * Math.min(1, (draw - 0.75) * 4));
      ctx.stroke();
      const open = seg(u, 0.34, 0.5) * (1 - seg(u, 0.64, 0.78));
      if (open > 0) {
        ctx.fillStyle = hsla(40, 30, 96, open * on);
        ctx.fillRect(x - dw, y - dh, 2 * dw, dh);
        glow(ctx, x, y - dh / 2, 90 * s, 90 * s, hsla(300, 100, 90, 0.5 * open), hsla(300, 100, 80, 0));
      }
      ctx.restore();
    },
  },
  // The Dustmoth: the moon's light gutters, a cloud of dust and small moths spirals down out of the dark, the
  // dust gathers into a huge pair of folded wings, and they open on the boss with a wingbeat that shakes the arena.
  dustmoth: {
    len: BOSS_LEN, hit: 0.66, shake: 14, wave: ["hsl(208 100% 84%)", "hsl(32 12% 22%)"],
    body: (u, s) => base(u < 0.66 ? "air" : settle(u, "land", 0.8), {
      alpha: seg(u, 0.44, 0.66),
      dy: -(1 - easeOut(seg(u, 0.3, 0.66))) * 120 * s,
      solid: "hsl(34 16% 30%)", solidA: 1 - seg(u, 0.6, 0.88),
    }),
    bursts: [
      { at: 0.66, n: 40, spd: 520, shape: "dust", a: "hsl(40 40% 80%)", b: "hsl(208 100% 86%)", grav: 80, add: false, from: "body", dir: "out" },
      { at: 0.66, n: 18, spd: 300, shape: "star", a: "hsl(208 100% 88%)", b: "hsl(0 0% 100%)", grav: -20, add: true, from: "body", dir: "out" },
    ],
    trickle: { rate: 30, until: 0.62, spd: 120, shape: "leaf", a: "hsl(36 20% 60%)", b: "hsl(40 30% 80%)", grav: 120, add: false, from: "body", dir: "out", life: 0.9 },
    back: ({ ctx, x, y, s, u, t }) => {
      const dark = easeOut(seg(u, 0, 0.2)) * (1 - seg(u, 0.8, 1));
      if (dark <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(230, 40, 6, 0.55 * dark);
      ctx.fillRect(-400, -400, 2000, 1200);
      // dust spiralling down out of the dark
      const fall = seg(u, 0.05, 0.6);
      ctx.fillStyle = hsla(40, 30, 80, 0.8 * dark);
      for (let i = 0; i < 40; i++) {
        const k = (i / 40 + fall) % 1;
        const r = (140 - k * 120) * s, a = t * 2 + i * 0.7;
        ctx.fillRect(x + Math.cos(a) * r, y - 90 * s - 200 * s * (1 - k) + Math.sin(a) * r * 0.3, 2 * s, 2 * s);
      }
      // the dust gathers into folded wings, which open as it lands
      const form = easeOut(seg(u, 0.36, 0.6));
      const spread = easeOut(seg(u, 0.6, 0.74));
      if (form > 0) {
        for (const dir of [1, -1]) {
          ctx.fillStyle = hsla(34, 20, 40, 0.9 * form * dark);
          ctx.beginPath();
          ctx.moveTo(x, y - 80 * s);
          ctx.quadraticCurveTo(x + dir * (20 + spread * 110) * s, y - (150 + spread * 40) * s, x + dir * (14 + spread * 120) * s, y - (20 + spread * 40) * s);
          ctx.quadraticCurveTo(x + dir * 10 * s, y - 30 * s, x, y - 80 * s);
          ctx.fill();
          if (spread > 0) {
            glow(ctx, x + dir * 70 * s * spread, y - 100 * s, 16 * s, 16 * s, hsla(40, 90, 60, spread * dark), hsla(40, 90, 50, 0));
          }
        }
      }
      ctx.restore();
    },
  },
  // The Somnarch: the light goes soft and gold, closed eyes open one by one in the dark all round the arena, a
  // slow spiral of dream dust turns on the floor, and the boss rises out of it as if waking from the ground.
  somnarch: {
    len: BOSS_LEN, hit: 0.64, shake: 10, wave: ["hsl(46 100% 74%)", "hsl(250 34% 18%)"],
    body: (u, s) => base(u < 0.64 ? "rise" : settle(u, "flex", 0.8), {
      alpha: seg(u, 0.4, 0.64),
      dy: (1 - easeOut(seg(u, 0.4, 0.66))) * 60 * s,
      sy: 0.5 + 0.5 * easeOut(seg(u, 0.4, 0.66)), clip: true,
      solid: "hsl(250 34% 20%)", solidA: 1 - seg(u, 0.6, 0.88),
    }),
    bursts: [
      { at: 0.64, n: 34, spd: 380, shape: "star", a: "hsl(46 100% 76%)", b: "hsl(260 80% 88%)", grav: -30, add: true, from: "body", dir: "out" },
      { at: 0.64, n: 16, spd: 220, shape: "bubble", a: "hsl(256 60% 80%)", b: "hsl(46 100% 84%)", grav: -80, add: true, from: "feet", dir: "up" },
    ],
    trickle: { rate: 24, until: 0.64, spd: 60, shape: "star", a: "hsl(46 100% 80%)", b: "hsl(256 80% 86%)", grav: -70, add: true, from: "feet", dir: "out", life: 1 },
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.18) * (1 - seg(u, 0.82, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(250, 40, 8, 0.45 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      // eyes opening in the dark, one after another
      for (let i = 0; i < 10; i++) {
        const open = easeOut(seg(u, 0.06 + i * 0.04, 0.16 + i * 0.04));
        if (open <= 0) continue;
        const ex = x + wob(i * 3.1) * 320 * s, ey = y - (90 + Math.abs(wob(i * 1.7)) * 180) * s;
        ctx.fillStyle = hsla(46, 100, 74, 0.85 * on);
        ctx.beginPath();
        ctx.ellipse(ex, ey, 9 * s, 5 * s * open, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hsla(250, 50, 8, on);
        ctx.beginPath();
        ctx.arc(ex, ey, 2.2 * s * open, 0, Math.PI * 2);
        ctx.fill();
      }
      // a slow spiral of dream dust turning on the floor
      const turn = easeOut(seg(u, 0.1, 0.6));
      ctx.strokeStyle = hsla(46, 100, 76, 0.7 * on);
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const a = i * 0.22 + t * 1.5, r = i * 1.6 * s * turn;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.22;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    },
  },
  // The Hush: every sound in the arena stops, red rings spread across the floor without a sound, a great
  // cracked bell drops out of the dark on a black rope, and the boss is standing where it lands.
  hush: {
    len: BOSS_LEN, hit: 0.62, shake: 16, wave: ["hsl(354 100% 66%)", "hsl(350 14% 10%)"],
    body: (u, s) => base(u < 0.62 ? "air" : settle(u, "land", 0.8), {
      alpha: seg(u, 0.5, 0.62),
      dy: -(1 - easeIn(seg(u, 0.36, 0.62))) * 240 * s,
      solid: "hsl(350 14% 10%)", solidA: 1 - seg(u, 0.6, 0.86),
    }),
    bursts: [
      { at: 0.62, n: 30, spd: 520, shape: "ring", a: "hsl(354 100% 70%)", b: "hsl(36 70% 70%)", grav: 0, add: true, from: "feet", dir: "out" },
      { at: 0.62, n: 18, spd: 300, shape: "dust", a: "hsl(350 10% 30%)", b: "hsl(30 20% 50%)", grav: 400, add: false, from: "feet", dir: "up" },
    ],
    back: ({ ctx, x, y, s, u }) => {
      const on = seg(u, 0, 0.14) * (1 - seg(u, 0.84, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(350, 30, 4, 0.5 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      // red rings, spreading in total silence
      for (let i = 0; i < 4; i++) {
        const k = seg(u, 0.04 + i * 0.1, 0.4 + i * 0.1);
        if (k <= 0 || k >= 1) continue;
        ctx.strokeStyle = hsla(354, 100, 66, (1 - k) * 0.8 * on);
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.ellipse(x, y, k * 340 * s, k * 60 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // the bell dropping out of the dark on its rope
      const drop = easeIn(seg(u, 0.3, 0.62));
      const by = y - 420 * s + drop * 320 * s;
      if (u < 0.7) {
        ctx.strokeStyle = hsla(350, 10, 6, on);
        ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.moveTo(x, -400);
        ctx.lineTo(x, by - 40 * s);
        ctx.stroke();
        ctx.fillStyle = hsla(32, 40, 34, on * (1 - seg(u, 0.6, 0.7)));
        ctx.beginPath();
        ctx.moveTo(x - 14 * s, by - 40 * s);
        ctx.quadraticCurveTo(x - 22 * s, by, x - 40 * s, by + 20 * s);
        ctx.lineTo(x + 40 * s, by + 20 * s);
        ctx.quadraticCurveTo(x + 22 * s, by, x + 14 * s, by - 40 * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  },
  // The Elder Dark: the stars go out one by one, the floor turns to night sky, arms of the dark reach up out of
  // it from every side, and an eye the size of the arena opens behind them as the boss climbs up through the floor.
  elderdark: {
    len: BOSS_LEN, hit: 0.7, shake: 20, wave: ["hsl(268 100% 78%)", "hsl(150 100% 60%)"],
    body: (u, s) => base(u < 0.7 ? "rise" : settle(u, "flex", 0.86), {
      alpha: seg(u, 0.46, 0.7),
      dy: (1 - easeOut(seg(u, 0.46, 0.72))) * 90 * s,
      sy: 0.3 + 0.7 * easeOut(seg(u, 0.46, 0.72)), clip: true,
      solid: "hsl(262 50% 6%)", solidA: 1 - seg(u, 0.66, 0.9),
    }),
    bursts: [
      { at: 0.7, n: 44, spd: 560, shape: "star", a: "hsl(268 100% 82%)", b: "hsl(0 0% 100%)", grav: -20, add: true, from: "body", dir: "out" },
      { at: 0.7, n: 24, spd: 340, shape: "dust", a: "hsl(150 100% 60%)", b: "hsl(262 60% 20%)", grav: 160, add: true, from: "feet", dir: "up" },
    ],
    trickle: { rate: 30, until: 0.7, spd: 90, shape: "star", a: "hsl(268 100% 84%)", b: "hsl(150 100% 70%)", grav: -100, add: true, from: "feet", dir: "out", life: 1.1 },
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.2) * (1 - seg(u, 0.86, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(262, 60, 3, 0.7 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      // the eye behind everything, opening slowly
      const open = easeInOut(seg(u, 0.3, 0.72));
      if (open > 0) {
        const ey = y - 200 * s;
        glow(ctx, x, ey, 260 * s, 160 * s * open, hsla(150, 100, 50, 0.3 * on), hsla(150, 100, 50, 0));
        ctx.fillStyle = hsla(262, 60, 2, on);
        ctx.strokeStyle = hsla(268, 100, 80, on);
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.ellipse(x, ey, 230 * s, 110 * s * open, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = hsla(150, 100, 56, on * open);
        ctx.beginPath();
        ctx.arc(x, ey, 70 * s * open, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hsla(262, 60, 2, on);
        ctx.beginPath();
        ctx.ellipse(x, ey, 12 * s, 62 * s * open, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // arms of the dark reaching up from the floor on every side
      const reach = easeOut(seg(u, 0.12, 0.6));
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1, bx = x + side * (80 + (i >> 1) * 70) * s;
        const h = (180 + Math.abs(wob(i * 2.3)) * 120) * s * reach, sw = Math.sin(t * 2 + i) * 20 * s;
        ctx.strokeStyle = hsla(262, 50, 6, on);
        ctx.lineWidth = (14 - (i >> 1) * 2) * s;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx, y + 10 * s);
        ctx.quadraticCurveTo(bx - side * 40 * s + sw, y - h * 0.6, bx + side * 10 * s + sw, y - h);
        ctx.stroke();
        ctx.strokeStyle = hsla(268, 100, 74, 0.5 * on);
        ctx.lineWidth = 1.4 * s;
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  // Perihelion: the sky darkens, a comet streaks down out of the corner of it trailing cold fire, and hits the floor
  // in a flash of white; ice spikes up round the crater, and the boss stands up out of the light.
  perihelion: {
    len: BOSS_LEN, hit: 0.55, shake: 18, wave: ["hsl(190 100% 80%)", "hsl(44 100% 76%)"],
    body: (u) => base(u < 0.55 ? "crouch" : settle(u, "land", 0.74), {
      alpha: u < 0.55 ? 0 : 1,
      solid: "hsl(190 100% 92%)", solidA: 1 - seg(u, 0.55, 0.86),
    }),
    bursts: [
      { at: 0.55, n: 40, spd: 600, shape: "flake", a: "hsl(196 100% 82%)", b: "hsl(0 0% 100%)", grav: 300, add: true, from: "feet", dir: "up" },
      { at: 0.55, n: 24, spd: 420, shape: "ember", a: "hsl(190 100% 70%)", b: "hsl(44 100% 76%)", grav: -60, add: true, from: "body", dir: "out" },
      { at: 0.57, n: 16, spd: 300, shape: "dust", a: "hsl(210 20% 60%)", b: "hsl(210 20% 80%)", grav: -20, add: false, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 26, until: 0.55, spd: 40, shape: "flake", a: "hsl(196 100% 86%)", b: "hsl(0 0% 100%)", grav: 120, add: true, from: "sky", dir: "out", spread: 300, life: 1.2 },
    back: ({ ctx, x, y, s, u, face }) => {
      const on = seg(u, 0, 0.15) * (1 - seg(u, 0.86, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(214, 50, 6, 0.55 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      if (u < 0.58) {
        // the comet falling, its tail stretched back along the way it came
        const k = easeIn(seg(u, 0.04, 0.55));
        const sx = x - face * 620 * s, sy = y - 540 * s;
        const cx = lerp(sx, x, k), cy = lerp(sy, y - 16 * s, k);
        const tx = cx + (sx - x) * 0.4, ty = cy + (sy - y) * 0.4;
        ctx.globalCompositeOperation = "lighter";
        for (const [w, col] of [[30, [205, 100, 60]], [14, [190, 100, 80]], [5, [0, 0, 100]]] as const) {
          const g = ctx.createLinearGradient(cx, cy, tx, ty);
          g.addColorStop(0, hsla(col[0], col[1], col[2], 0.8 * on));
          g.addColorStop(1, hsla(col[0], col[1], col[2], 0));
          ctx.strokeStyle = g;
          ctx.lineWidth = w * s;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
        glow(ctx, cx, cy, 46 * s, 46 * s, hsla(190, 100, 80, 0.9 * on), hsla(190, 100, 70, 0));
        ctx.fillStyle = hsla(0, 0, 100, on);
        ctx.beginPath();
        ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else {
        // the crater: a glow on the floor and spikes of comet ice round it
        const k = seg(u, 0.55, 0.7), fade = 1 - seg(u, 0.74, 0.96);
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, x, y, 150 * s, 40 * s, hsla(190, 100, 76, 0.6 * fade), hsla(190, 100, 70, 0));
        ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < 8; i++) {
          const side = i % 2 ? 1 : -1, bx = x + side * (40 + (i >> 1) * 26) * s;
          const h = easeOut(k) * (30 + Math.abs(wob(i * 3.1)) * 40) * s;
          ctx.fillStyle = hsla(196, 70, 82, 0.95 * fade);
          ctx.strokeStyle = hsla(250, 32, 14, fade);
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.moveTo(bx - 7 * s, y);
          ctx.lineTo(bx + side * 6 * s, y - h);
          ctx.lineTo(bx + 7 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },
  // Asterion: the arena goes dark and the Hunter's constellation lights up over it one star at a time, the lines
  // join, and then the whole figure in the sky draws down into one body and lands, spear first.
  asterion: {
    len: BOSS_LEN, hit: 0.66, shake: 12, wave: ["hsl(44 100% 76%)", "hsl(220 90% 80%)"],
    body: (u) => base(u < 0.66 ? "float" : settle(u, "guard", 0.8), {
      alpha: seg(u, 0.6, 0.68),
      solid: "hsl(48 100% 90%)", solidA: 1 - seg(u, 0.66, 0.9),
    }),
    bursts: [
      { at: 0.66, n: 40, spd: 520, shape: "star", a: "hsl(44 100% 80%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.66, n: 16, spd: 260, shape: "spark", a: "hsl(220 90% 80%)", b: "hsl(44 100% 86%)", grav: 0, add: true, from: "feet", dir: "flat" },
    ],
    back: ({ ctx, x, y, s, u, t, face }) => {
      const on = seg(u, 0, 0.15) * (1 - seg(u, 0.86, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(232, 60, 5, 0.65 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      // the Hunter in the sky: head, shoulders, spear arm raised, belt, knees and feet
      const pts: [number, number][] = [[0, -62], [-14, -46], [14, -46], [30, -34], [42, -58], [-28, -30], [-36, -12], [-6, -10], [0, -8], [6, -6], [-12, 16], [12, 16], [-16, 40], [16, 40]];
      const lines: [number, number][] = [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [1, 7], [2, 9], [7, 8], [8, 9], [7, 10], [9, 11], [10, 12], [11, 13]];
      const pull = easeIn(seg(u, 0.5, 0.66));
      const sc = lerp(2.6, 1, pull) * s, cy = lerp(y - 200 * s, y - 50 * s, pull);
      const at = (i: number) => ({ x: x + pts[i][0] * face * sc, y: cy + pts[i][1] * sc });
      const fade = u < 0.66 ? 1 : 1 - seg(u, 0.66, 0.74);
      const joined = seg(u, 0.36, 0.5);
      if (joined > 0) {
        ctx.strokeStyle = hsla(44, 100, 80, 0.6 * on * fade);
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        lines.slice(0, Math.ceil(lines.length * joined)).forEach(([a, b]) => {
          const A = at(a), B = at(b);
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(B.x, B.y);
        });
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "lighter";
      pts.forEach((_, i) => {
        const lit = seg(u, 0.04 + i * 0.022, 0.08 + i * 0.022);
        if (lit <= 0) return;
        const q = at(i), r = (i === 0 ? 7 : 5) * s * (0.8 + 0.2 * Math.sin(t * 6 + i));
        glow(ctx, q.x, q.y, r * 3, r * 3, hsla(44, 100, 80, 0.8 * lit * on * fade), hsla(44, 100, 70, 0));
        ctx.fillStyle = hsla(48, 100, 94, lit * on * fade);
        ctx.fillRect(q.x - r * 0.4, q.y - r * 0.4, r * 0.8, r * 0.8);
      });
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    },
  },
  // Carina: the arena dims and a cloud of rose and green gas rolls in across the sky, stars blinking on inside it.
  // The cloud draws together into one bright knot, a new star flares, and the Star Mother steps out of its light.
  carina: {
    len: BOSS_LEN, hit: 0.62, shake: 10, wave: ["hsl(326 100% 76%)", "hsl(172 100% 74%)"],
    body: (u) => base(u < 0.62 ? "float" : settle(u, "guard", 0.78), {
      alpha: seg(u, 0.56, 0.66),
      solid: "hsl(326 100% 88%)", solidA: 1 - seg(u, 0.62, 0.9),
    }),
    bursts: [
      { at: 0.62, n: 44, spd: 480, shape: "star", a: "hsl(326 100% 80%)", b: "hsl(48 100% 94%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.62, n: 26, spd: 220, shape: "smoke", a: "hsl(300 40% 30%)", b: "hsl(172 60% 50%)", grav: -40, add: false, from: "body", dir: "out" },
      { at: 0.64, n: 18, spd: 260, shape: "dust", a: "hsl(172 100% 76%)", b: "hsl(326 100% 84%)", grav: 0, add: true, from: "feet", dir: "flat" },
    ],
    trickle: { rate: 18, until: 0.6, spd: 30, shape: "star", a: "hsl(48 100% 94%)", b: "hsl(326 100% 84%)", grav: 0, add: true, from: "sky", dir: "out", spread: 340, life: 1 },
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.15) * (1 - seg(u, 0.86, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(300, 50, 5, 0.55 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      // the cloud: wide puffs that roll in and then pull together into one knot over the fighter
      const gather = easeIn(seg(u, 0.3, 0.62)), fade = u < 0.62 ? 1 : 1 - seg(u, 0.62, 0.8);
      const cy = y - 90 * s;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + t * 0.4;
        const r = lerp(260, 20, gather) * s * (0.7 + (i % 3) * 0.2);
        const px = x + Math.cos(a) * r * 1.4, py = cy + Math.sin(a) * r * 0.6;
        const sz = lerp(110, 40, gather) * s;
        glow(ctx, px, py, sz, sz * 0.7, i % 2 ? hsla(172, 90, 56, 0.3 * on * fade) : hsla(326, 100, 64, 0.34 * on * fade), hsla(310, 80, 50, 0));
      }
      // stars switching on in the cloud, one after another
      for (let i = 0; i < 16; i++) {
        const lit = seg(u, 0.08 + i * 0.02, 0.12 + i * 0.02);
        if (lit <= 0) continue;
        const a = i * 2.3 + t * 0.4, r = lerp(220, 10, gather) * s * (0.4 + ((i * 7) % 10) / 14);
        const px = x + Math.cos(a) * r * 1.3, py = cy + Math.sin(a) * r * 0.6;
        ctx.fillStyle = hsla(48, 100, 94, lit * on * fade);
        ctx.fillRect(px - 1.8 * s, py - 1.8 * s, 3.6 * s, 3.6 * s);
      }
      // the knot flares into a new star the moment she arrives
      const flare = seg(u, 0.5, 0.62) * (1 - seg(u, 0.62, 0.8));
      if (flare > 0) glow(ctx, x, lerp(cy, y - 50 * s, seg(u, 0.55, 0.62)), 120 * s * flare, 120 * s * flare, hsla(48, 100, 96, 0.9 * flare), hsla(326, 100, 70, 0));
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    },
  },
  // Orogen: the floor shudders, a jade crack runs across it, and a peak of grey stone pushes up out of the ground,
  // taller and taller, shedding rock. At the top it splits open and the Titan steps out of its own mountain.
  orogen: {
    len: BOSS_LEN, hit: 0.64, shake: 16, wave: ["hsl(150 90% 66%)", "hsl(28 10% 30%)"],
    body: (u, s) => base(u < 0.64 ? "crouch" : settle(u, "guard", 0.8), {
      alpha: seg(u, 0.5, 0.64), clip: u < 0.64,
      dy: (1 - easeOut(seg(u, 0.5, 0.64))) * 60 * s,
      solid: "hsl(28 10% 48%)", solidA: 1 - seg(u, 0.62, 0.88),
    }),
    bursts: [
      { at: 0.64, n: 34, spd: 520, shape: "chunk", a: "hsl(28 10% 46%)", b: "hsl(28 10% 70%)", grav: 1100, add: false, from: "body", dir: "out" },
      { at: 0.64, n: 22, spd: 300, shape: "dust", a: "hsl(28 10% 60%)", b: "hsl(150 60% 70%)", grav: 0, add: false, from: "feet", dir: "flat" },
      { at: 0.66, n: 18, spd: 260, shape: "spark", a: "hsl(150 100% 70%)", b: "hsl(150 100% 90%)", grav: -100, add: true, from: "feet", dir: "up" },
    ],
    trickle: { rate: 16, until: 0.6, spd: 120, shape: "chunk", a: "hsl(28 10% 44%)", b: "hsl(28 10% 64%)", grav: 900, add: false, from: "feet", dir: "up", spread: 60, life: 0.8 },
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.12) * (1 - seg(u, 0.84, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(28, 20, 8, 0.4 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      // a jade crack running out along the floor from where it will stand
      const run = easeOut(seg(u, 0.02, 0.3));
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hsla(150, 100, 66, 0.9 * on);
      ctx.lineWidth = 3 * s;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 1; i <= 8; i++) ctx.lineTo(x + dir * i * 40 * s * run, y + Math.sin(i * 2.1 + dir) * 4 * s);
        ctx.stroke();
      }
      glow(ctx, x, y, 160 * s * run, 20 * s * run, hsla(150, 100, 66, 0.5 * on), hsla(150, 100, 50, 0));
      ctx.globalCompositeOperation = "source-over";
      // the peak rising out of the ground, then splitting open at the top as the Titan steps out
      const rise = easeOut(seg(u, 0.12, 0.5)), split = seg(u, 0.56, 0.7), fade = 1 - seg(u, 0.64, 0.84);
      if (rise > 0 && fade > 0) {
        const h = 190 * s * rise, w = 90 * s, shake = Math.sin(t * 60) * 2 * s * (1 - split);
        for (const side of [-1, 1]) {
          const off = side * split * 40 * s;
          ctx.fillStyle = hsla(28, 10, side < 0 ? 34 : 28, fade);
          ctx.strokeStyle = hsla(250, 32, 14, fade);
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x + shake + off, y);
          ctx.lineTo(x + side * w + shake + off, y);
          ctx.lineTo(x + side * 12 * s + shake + off, y - h);
          ctx.lineTo(x + shake + off, y - h - 10 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // snow on the cap
          ctx.fillStyle = hsla(0, 0, 96, 0.9 * fade);
          ctx.beginPath();
          ctx.moveTo(x + shake + off, y - h - 10 * s);
          ctx.lineTo(x + side * 12 * s + shake + off, y - h);
          ctx.lineTo(x + side * 22 * s + shake + off, y - h + 26 * s * rise);
          ctx.lineTo(x + shake + off, y - h + 18 * s * rise);
          ctx.closePath();
          ctx.fill();
        }
        if (split > 0) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, x, y - h * 0.5, 50 * s * split, h * 0.6, hsla(150, 100, 70, 0.8 * fade), hsla(150, 100, 50, 0));
          ctx.globalCompositeOperation = "source-over";
        }
      }
      ctx.restore();
    },
  },
  // Gnarlroot: roots break up through the floor all round the spot, writhing, and wind together into a trunk that
  // grows and grows. Leaves burst from the top in a green flash, and the trunk unwinds into the Titan.
  gnarlroot: {
    len: BOSS_LEN, hit: 0.62, shake: 10, wave: ["hsl(92 90% 64%)", "hsl(24 30% 22%)"],
    body: (u) => base(u < 0.62 ? "rise" : settle(u, "guard", 0.8), {
      alpha: seg(u, 0.52, 0.62),
      solid: "hsl(28 34% 30%)", solidA: 1 - seg(u, 0.6, 0.88),
    }),
    bursts: [
      { at: 0.62, n: 40, spd: 420, shape: "leaf", a: "hsl(96 70% 46%)", b: "hsl(80 100% 72%)", grav: 160, add: false, from: "body", dir: "out" },
      { at: 0.62, n: 18, spd: 260, shape: "chunk", a: "hsl(24 30% 26%)", b: "hsl(30 30% 40%)", grav: 900, add: false, from: "feet", dir: "up" },
      { at: 0.64, n: 20, spd: 200, shape: "spark", a: "hsl(80 100% 70%)", b: "hsl(60 100% 86%)", grav: -40, add: true, from: "body", dir: "out" },
    ],
    trickle: { rate: 14, until: 0.6, spd: 40, shape: "leaf", a: "hsl(96 60% 44%)", b: "hsl(80 100% 70%)", grav: 80, add: false, from: "sky", dir: "out", spread: 360, life: 1.2 },
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.12) * (1 - seg(u, 0.84, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(100, 40, 6, 0.45 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      // roots breaking out of the floor and leaning in toward the middle, winding tighter as they grow
      const grow = easeOut(seg(u, 0.06, 0.5)), wind = seg(u, 0.3, 0.6), fade = 1 - seg(u, 0.62, 0.82);
      if (grow > 0 && fade > 0) {
        ctx.lineCap = "round";
        for (let i = 0; i < 7; i++) {
          const fromX = x + (i - 3) * 46 * s * (1 - wind * 0.85);
          const topY = y - (90 + (i % 3) * 40) * s * grow;
          const sway = Math.sin(t * 3 + i) * 8 * s * (1 - wind);
          ctx.strokeStyle = hsla(24, 30, 18 + (i % 3) * 5, fade);
          ctx.lineWidth = (10 - Math.abs(i - 3) * 1.6) * s;
          ctx.beginPath();
          ctx.moveTo(fromX, y + 4 * s);
          ctx.quadraticCurveTo(fromX + sway, (y + topY) / 2, x + (fromX - x) * 0.2 + sway, topY);
          ctx.stroke();
        }
        // a green glow in the knot at the top, about to leaf
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, x, y - 130 * s * grow, 60 * s * wind, 60 * s * wind, hsla(92, 100, 64, 0.6 * fade), hsla(92, 100, 50, 0));
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    },
  },
  // Ambrel: gold light seeps across the floor and the air goes thick and honey-coloured. A great bead of amber drips
  // down out of the dark, slow as resin, and sets on the ground; something moves inside it, and it cracks open.
  ambrel: {
    len: BOSS_LEN, hit: 0.66, shake: 9, wave: ["hsl(46 100% 72%)", "hsl(30 80% 30%)"],
    body: (u) => base(u < 0.66 ? "crouch" : settle(u, "guard", 0.82), {
      alpha: seg(u, 0.58, 0.66),
      solid: "hsl(40 100% 60%)", solidA: 1 - seg(u, 0.64, 0.9),
    }),
    bursts: [
      { at: 0.66, n: 36, spd: 460, shape: "shard", a: "hsl(40 100% 54%)", b: "hsl(50 100% 86%)", grav: 700, add: false, from: "body", dir: "out" },
      { at: 0.66, n: 20, spd: 240, shape: "drop", a: "hsl(36 90% 46%)", b: "hsl(48 100% 80%)", grav: 600, add: false, from: "body", dir: "out" },
      { at: 0.68, n: 16, spd: 200, shape: "spark", a: "hsl(46 100% 76%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "body", dir: "out" },
    ],
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.14) * (1 - seg(u, 0.86, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(34, 80, 12, 0.45 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, y, 240 * s, 30 * s, hsla(44, 100, 60, 0.45 * on), hsla(40, 100, 50, 0));
      ctx.globalCompositeOperation = "source-over";
      // the bead: a long slow drip that stretches down from above, then gathers on the floor into a drop as tall as a person
      const drip = easeInOut(seg(u, 0.06, 0.42)), gather = easeOut(seg(u, 0.36, 0.56)), crack = seg(u, 0.58, 0.66), fade = 1 - seg(u, 0.64, 0.8);
      if (fade <= 0) { ctx.restore(); return; }
      const top = y - 420 * s, tipY = lerp(top, y - 20 * s, drip);
      ctx.fillStyle = hsla(38, 100, 48, 0.85 * fade);
      ctx.beginPath();
      ctx.moveTo(x - 5 * s * (1 - gather), top);
      ctx.lineTo(x - 3 * s, tipY);
      ctx.lineTo(x + 3 * s, tipY);
      ctx.lineTo(x + 5 * s * (1 - gather), top);
      ctx.fill();
      if (gather > 0) {
        const r = 46 * s * gather;
        const cy = y - r * 1.4;
        const g = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.4, r * 0.1, x, cy, r * 1.4);
        g.addColorStop(0, hsla(50, 100, 80, 0.95 * fade));
        g.addColorStop(1, hsla(30, 90, 34, 0.95 * fade));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, cy - r * 1.8);
        ctx.quadraticCurveTo(x + r * 1.1, cy - r * 0.2, x + r, cy + r * 0.4);
        ctx.arc(x, cy + r * 0.4, r, 0, Math.PI);
        ctx.quadraticCurveTo(x - r * 1.1, cy - r * 0.2, x, cy - r * 1.8);
        ctx.fill();
        // the shape of something curled up inside, stirring
        ctx.fillStyle = hsla(28, 70, 18, 0.5 * fade * gather);
        ctx.beginPath();
        ctx.ellipse(x + Math.sin(t * 4) * 2 * s, cy + r * 0.3, r * 0.35, r * 0.55, 0.3, 0, Math.PI * 2);
        ctx.fill();
        if (crack > 0) {
          ctx.strokeStyle = hsla(50, 100, 92, fade);
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(x, cy - r * 1.2);
          ctx.lineTo(x + 8 * s, cy - r * 0.4);
          ctx.lineTo(x - 6 * s, cy + r * 0.2 * crack);
          ctx.lineTo(x + 10 * s, cy + r * crack);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },
  // Vela: everything goes dark, and far off a point of light starts to spin, two beams sweeping the arena like a
  // lighthouse, faster and faster. The beams fold in, the pulsar drops, and the floor rings with one huge beat.
  vela: {
    len: BOSS_LEN, hit: 0.6, shake: 16, wave: ["hsl(32 100% 70%)", "hsl(276 100% 74%)"],
    body: (u, s) => base(u < 0.6 ? "air" : settle(u, "land", 0.74), {
      alpha: seg(u, 0.5, 0.6),
      dy: -(1 - easeIn(seg(u, 0.5, 0.6))) * 260 * s,
      solid: "hsl(40 100% 86%)", solidA: 1 - seg(u, 0.6, 0.88),
    }),
    bursts: [
      { at: 0.6, n: 36, spd: 640, shape: "shard", a: "hsl(40 70% 78%)", b: "hsl(48 100% 94%)", grav: 900, add: false, from: "feet", dir: "up" },
      { at: 0.6, n: 28, spd: 520, shape: "spark", a: "hsl(32 100% 66%)", b: "hsl(276 100% 80%)", grav: 0, add: true, from: "feet", dir: "flat" },
      { at: 0.62, n: 14, spd: 240, shape: "dust", a: "hsl(36 40% 60%)", b: "hsl(40 40% 80%)", grav: -20, add: false, from: "feet", dir: "flat" },
    ],
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.12) * (1 - seg(u, 0.86, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(250, 40, 4, 0.65 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      if (u < 0.62) {
        // the pulsar far above, spinning faster and faster, its two beams sweeping the whole arena
        const fall = easeIn(seg(u, 0.48, 0.6));
        const px = x, py = lerp(y - 330 * s, y - 40 * s, fall);
        const spin = t * lerp(2, 14, seg(u, 0.05, 0.5));
        const len = lerp(900, 60, fall) * s, w = lerp(36, 6, fall) * s;
        ctx.globalCompositeOperation = "lighter";
        for (const a of [spin, spin + Math.PI]) {
          const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len;
          const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
          const g = ctx.createLinearGradient(px, py, ex, ey);
          g.addColorStop(0, hsla(40, 100, 86, 0.7 * on));
          g.addColorStop(1, hsla(32, 100, 60, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ex + nx, ey + ny);
          ctx.lineTo(ex - nx, ey - ny);
          ctx.closePath();
          ctx.fill();
        }
        glow(ctx, px, py, 34 * s, 34 * s, hsla(36, 100, 80, 0.9 * on), hsla(32, 100, 60, 0));
        ctx.fillStyle = hsla(48, 100, 96, on);
        ctx.beginPath();
        ctx.arc(px, py, 7 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else {
        // the beat: rings of amber and violet racing out along the floor
        const k = seg(u, 0.6, 0.86);
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 3; i++) {
          const r = easeOut(clamp(k * 1.4 - i * 0.2, 0, 1)) * 320 * s;
          if (r <= 0) continue;
          ctx.strokeStyle = i % 2 ? hsla(276, 100, 74, 0.6 * (1 - k)) : hsla(36, 100, 74, 0.7 * (1 - k));
          ctx.lineWidth = 4 * s;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.18, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    },
  },
  // Aeon: the arena goes black, and every star in the sky slowly turns to look down. They draw together overhead into
  // one shape, a great eye, which opens. Its gaze comes down as a column of white light, and Aeon is standing in it.
  aeon: {
    len: BOSS_LEN, hit: 0.64, shake: 14, wave: ["hsl(46 100% 74%)", "hsl(222 100% 76%)"],
    body: (u) => base(u < 0.64 ? "float" : settle(u, "guard", 0.8), {
      alpha: seg(u, 0.56, 0.66),
      solid: "hsl(48 100% 96%)", solidA: 1 - seg(u, 0.64, 0.92),
    }),
    bursts: [
      { at: 0.64, n: 48, spd: 560, shape: "star", a: "hsl(46 100% 76%)", b: "hsl(48 100% 96%)", grav: 0, add: true, from: "body", dir: "out" },
      { at: 0.64, n: 24, spd: 300, shape: "spark", a: "hsl(222 100% 76%)", b: "hsl(0 0% 100%)", grav: 0, add: true, from: "feet", dir: "flat" },
      { at: 0.66, n: 16, spd: 200, shape: "dust", a: "hsl(44 40% 80%)", b: "hsl(46 100% 86%)", grav: -30, add: false, from: "feet", dir: "flat" },
    ],
    back: ({ ctx, x, y, s, u, t }) => {
      const on = seg(u, 0, 0.12) * (1 - seg(u, 0.86, 1));
      if (on <= 0) return;
      ctx.save();
      ctx.fillStyle = hsla(230, 60, 3, 0.7 * on);
      ctx.fillRect(-400, -400, 2000, 1200);
      const ex = x, ey = y - 250 * s;
      const gather = easeIn(seg(u, 0.1, 0.42));
      const open = easeOut(seg(u, 0.42, 0.56));
      const fade = 1 - seg(u, 0.7, 0.86);
      ctx.globalCompositeOperation = "lighter";
      // the stars: scattered across the sky, then drawing together into the outline of an eye
      for (let i = 0; i < 40; i++) {
        const sx = x + (((i * 97) % 100) / 100 - 0.5) * 900 * s, sy = y - 60 * s - ((i * 53) % 100) / 100 * 360 * s;
        const a = (i / 40) * Math.PI * 2;
        const tx = ex + Math.cos(a) * 120 * s, ty = ey + Math.sin(a) * 120 * s * (0.12 + 0.38 * open);
        const px = lerp(sx, tx, gather), py = lerp(sy, ty, gather);
        const tw = 0.5 + 0.5 * Math.abs(Math.sin(t * 3 + i));
        ctx.fillStyle = hsla(48, 100, 94, on * fade * tw);
        ctx.fillRect(px - 1.8 * s, py - 1.8 * s, 3.6 * s, 3.6 * s);
      }
      // the eye opens: a sapphire iris and a gold pupil inside the ring of stars
      if (open > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, 118 * s, 118 * s * (0.12 + 0.38 * open), 0, 0, Math.PI * 2);
        ctx.clip();
        glow(ctx, ex, ey, 120 * s, 60 * s, hsla(48, 100, 92, 0.25 * on * fade), hsla(48, 100, 80, 0));
        glow(ctx, ex, ey, 44 * s, 44 * s, hsla(228, 90, 50, 0.9 * on * fade), hsla(228, 90, 40, 0));
        glow(ctx, ex, ey, 18 * s, 18 * s, hsla(46, 100, 80, on * fade), hsla(46, 100, 60, 0));
        ctx.restore();
      }
      // its gaze comes down: a column of white light onto the spot where Aeon will stand
      const beam = seg(u, 0.5, 0.62) * (1 - seg(u, 0.66, 0.84));
      if (beam > 0) {
        const w = 40 * s * beam;
        const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
        g.addColorStop(0, hsla(48, 100, 90, 0));
        g.addColorStop(0.5, hsla(48, 100, 96, 0.85 * beam));
        g.addColorStop(1, hsla(48, 100, 90, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - w, ey, w * 2, y - ey + 10 * s);
      }
      // the moment it lands, a ring of light runs out along the floor
      const k = seg(u, 0.64, 0.86);
      if (k > 0 && k < 1) {
        ctx.strokeStyle = hsla(46, 100, 80, 0.7 * (1 - k));
        ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.ellipse(x, y, easeOut(k) * 300 * s, easeOut(k) * 54 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    },
  },
};

// ---------- hybrids ----------
/**
 * A hybrid's own entrance: both parents' entrances play side by side, drawn in from either side, while two orbs of
 * their colours circle in and meet; at the moment they touch the hybrid bursts into being in both colours.
 * `ca` and `cb` are each parent's [colour, glow].
 */
export function fusionIntro(a: Power, b: Power, ca: [string, string], cb: [string, string]): IntroSpec {
  const A = INTROS[a], B = INTROS[b];
  const FUSE = 0.5;
  const sub = (u: number) => clamp(u / FUSE, 0, 1) * 0.78;
  const off = (u: number, s: number) => 120 * s * (1 - easeInOut(seg(u, 0.1, FUSE)));
  const parents = (which: "back" | "front", d: IntroDraw) => {
    const fade = 1 - seg(d.u, FUSE - 0.06, FUSE + 0.06);
    const su = sub(d.u);
    if (fade <= 0 || su <= 0) return;
    for (const [spec, side] of [[A, -1], [B, 1]] as const) {
      const fn = spec[which];
      if (!fn) continue;
      d.ctx.save();
      d.ctx.globalAlpha = fade;
      fn({ ...d, x: d.x + side * off(d.u, d.s), u: su, t: su * INTRO_LEN, body: spec.body(su, d.s) });
      d.ctx.restore();
    }
  };
  return {
    len: 1.8, hit: FUSE, shake: 11, wave: [ca[1], cb[1]],
    body: (u, s) => u < FUSE
      ? base("guard", { alpha: 0, echo: { spread: off(u, s), alpha: 0.8 * seg(u, 0.08, 0.28) }, solid: "hsl(0 0% 100%)", solidA: 0.85 })
      : base(settle(u, "land", 0.64), { solid: "hsl(0 0% 100%)", solidA: 1 - seg(u, FUSE, FUSE + 0.22) }),
    bursts: [
      { at: FUSE, n: 26, spd: 560, shape: "spark", a: ca[0], b: ca[1], grav: 0, add: true, from: "body", dir: "out" },
      { at: FUSE, n: 26, spd: 480, shape: "star", a: cb[0], b: cb[1], grav: 0, add: true, from: "body", dir: "out" },
      { at: FUSE, n: 12, spd: 300, shape: "dust", a: "hsl(250 15% 60%)", b: "hsl(250 15% 80%)", grav: -20, add: false, from: "feet", dir: "flat" },
    ],
    back: (d) => parents("back", d),
    front: (d) => {
      parents("front", d);
      const { ctx, x, y, s, u, t } = d;
      const cy = y - 55 * s;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      if (u < FUSE) {
        const k = seg(u, 0.04, 0.2);
        const o = off(u, s);
        const orbs = [[-1, ca], [1, cb]] as const;
        for (const [side, c] of orbs) {
          const a = t * 9 + (side > 0 ? Math.PI : 0);
          const px = x + side * o + Math.cos(a) * 16 * s * (o / (120 * s) + 0.2);
          const py = cy + Math.sin(a) * 12 * s;
          glow(ctx, px, py, 26 * s, 26 * s, withA(c[1], 0.9 * k), withA(c[0], 0));
          ctx.fillStyle = withA("hsl(0 0% 100%)", k);
          ctx.beginPath();
          ctx.arc(px, py, 5 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        // the two powers reach for each other as they close in
        if (u > 0.3) {
          const reach = seg(u, 0.3, FUSE);
          ctx.lineWidth = 2.5 * s;
          for (let i = 0; i < 2; i++) {
            ctx.strokeStyle = withA(i ? cb[1] : ca[1], 0.8 * reach);
            jag(ctx, x - o, cy, x + o, cy, 7, 10 * s, Math.floor(t * 24) + i * 9);
            ctx.stroke();
          }
        }
      } else {
        const k = seg(u, FUSE, FUSE + 0.32);
        if (k < 1) {
          for (const [c, d0] of [[ca, 0], [cb, 0.06]] as const) {
            const kk = clamp(k - d0, 0, 1);
            ctx.strokeStyle = withA(c[1], 1 - kk);
            ctx.lineWidth = 7 * s * (1 - kk);
            ctx.beginPath();
            ctx.arc(x, cy, 20 * s + 190 * s * easeOut(kk), 0, Math.PI * 2);
            ctx.stroke();
          }
          glow(ctx, x, cy, 90 * s * (1 - k * 0.5), 90 * s * (1 - k * 0.5), withA("hsl(0 0% 100%)", 0.7 * (1 - k)), withA("hsl(0 0% 100%)", 0));
        }
      }
      ctx.restore();
    },
  };
}
