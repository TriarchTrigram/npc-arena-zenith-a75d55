// The arena's cinematic layer: the mark each element leaves on the floor, the super-move cut-in, the fighters'
// name cards during the entrances, the letterbox bars and the focus lines on a finishing blow.
// The engine (`arena-engine.ts`) decides when each one starts and how long it lasts; this file only draws them.
import type { Power } from "./fighters";

/** A scar on the floor where a power landed. `w` is its half-width. */
export type Mark = { x: number; w: number; power: Power; a: string; b: string; life: number; max: number; seed: number };
/** A super move's cut-in: a band slashes across the screen with the fighter's portrait and the move's name. */
export type CutIn = { key: number; name: string; move: string; a: string; b: string; t: number; max: number; side: 1 | -1 };
/** Anime focus lines closing in on a spot. */
export type Focus = { x: number; y: number; t: number; max: number; seed: number; color: string };
export type NameCard = { name: string; power: string; a: string; b: string; cx: number; w: number; k: number };

type TextFn = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align?: CanvasTextAlign) => void;

const W = 960, H = 600;
export const MARK_LIFE = 6;
export const CUTIN_LEN = 1.05;
/** How tall each letterbox bar gets. */
const BAR = 46;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const seg = (u: number, a: number, b: number) => clamp((u - a) / (b - a), 0, 1);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeIn = (k: number) => k * k;
const withA = (c: string, a: number) => (c.startsWith("hsl(") && !c.includes("/") ? c.replace(")", ` / ${clamp(a, 0, 1)})`) : c);
/** A small repeatable random sequence, so a mark looks the same every frame. */
function rng(seed: number) {
  let s = Math.floor(seed * 9973) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- floor marks ----------
type MarkDraw = (ctx: CanvasRenderingContext2D, m: Mark, k: number, r: () => number, t: number) => void;

/** Draw in floor space: a circle of radius `m.w` laid flat on the ground. */
function flat(ctx: CanvasRenderingContext2D, fn: () => void) {
  ctx.save();
  ctx.scale(1, 0.22);
  fn();
  ctx.restore();
}

function pool(ctx: CanvasRenderingContext2D, rx: number, inner: string, outer: string) {
  flat(ctx, () => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Jagged lines running out from the middle, with a fork on each. */
function cracks(ctx: CanvasRenderingContext2D, r: () => number, n: number, len: number, col: string, lw: number) {
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6;
    let x = 0, y = 0;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const parts = 3 + Math.floor(r() * 2);
    for (let j = 1; j <= parts; j++) {
      const d = (len * (0.55 + r() * 0.45) * j) / parts;
      const aa = a + (r() - 0.5) * 0.7;
      x = Math.cos(aa) * d;
      y = Math.sin(aa) * d * 0.22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    // a fork near the end
    ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    ctx.moveTo(x * 0.7, y * 0.7);
    ctx.lineTo(x * 0.7 + Math.cos(a + 0.8) * len * 0.25, y * 0.7 + Math.sin(a + 0.8) * len * 0.06);
    ctx.stroke();
    ctx.lineWidth = lw;
  }
}

const MARKS: Partial<Record<Power, MarkDraw>> = {
  pyro: (ctx, m, k, r, t) => {
    pool(ctx, m.w, `hsl(15 40% 6% / ${0.75 * k})`, "hsl(15 40% 6% / 0)");
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 9; i++) {
      const x = (r() * 2 - 1) * m.w * 0.75, y = (r() * 2 - 1) * m.w * 0.12;
      const fl = 0.45 + 0.55 * Math.sin(t * (6 + r() * 6) + i * 2);
      const ember = k * fl * clamp(m.life / (m.max * 0.6), 0, 1);
      ctx.fillStyle = withA(i % 3 ? m.b : "hsl(45 100% 70%)", ember);
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + r() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  cryo: (ctx, m, k, r) => {
    pool(ctx, m.w, `hsl(195 85% 88% / ${0.55 * k})`, "hsl(195 85% 88% / 0)");
    cracks(ctx, r, 7, m.w * 0.9, `hsl(190 100% 97% / ${0.8 * k})`, 1.6);
    flat(ctx, () => {
      ctx.strokeStyle = `hsl(0 0% 100% / ${0.5 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, m.w * 0.85, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    });
  },
  electro: (ctx, m, k, r) => {
    pool(ctx, m.w * 0.6, `hsl(250 30% 8% / ${0.6 * k})`, "hsl(250 30% 8% / 0)");
    ctx.globalCompositeOperation = "lighter";
    // the charge still crackles through the scorch, on and off
    if (Math.random() < 0.8) cracks(ctx, rng(m.seed + Math.floor(m.life * 14)), 5, m.w, withA(m.b, 0.9 * k), 1.8);
  },
  terra: (ctx, m, k, r) => {
    pool(ctx, m.w * 0.7, `hsl(25 35% 12% / ${0.55 * k})`, "hsl(25 35% 12% / 0)");
    cracks(ctx, r, 6, m.w, `hsl(25 40% 8% / ${0.9 * k})`, 3.2);
    for (let i = 0; i < 6; i++) {
      const x = (r() * 2 - 1) * m.w * 0.9, s = 3 + r() * 4;
      ctx.fillStyle = `hsl(28 ${25 + r() * 15}% ${30 + r() * 15}% / ${k})`;
      ctx.beginPath();
      ctx.moveTo(x - s, 0); ctx.lineTo(x - s * 0.4, -s * 1.1); ctx.lineTo(x + s * 0.8, -s * 0.7); ctx.lineTo(x + s, 0);
      ctx.closePath();
      ctx.fill();
    }
  },
  aero: (ctx, m, k, r, t) => {
    flat(ctx, () => {
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const rr = m.w * (0.4 + i * 0.25);
        const a0 = t * (2.5 - i * 0.5) + i * 2;
        ctx.strokeStyle = `hsl(165 70% 88% / ${0.55 * k})`;
        ctx.lineWidth = 6 - i;
        ctx.beginPath();
        ctx.arc(0, 0, rr, a0, a0 + Math.PI * 0.9);
        ctx.stroke();
      }
    });
  },
  hydro: (ctx, m, k, r, t) => {
    pool(ctx, m.w, withA(m.a, 0.45 * k), withA(m.a, 0.1 * k));
    flat(ctx, () => {
      for (let i = 0; i < 2; i++) {
        const u = ((t * 0.6 + i * 0.5) % 1);
        ctx.strokeStyle = `hsl(195 100% 90% / ${0.6 * k * (1 - u)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, m.w * (0.2 + 0.8 * u), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = `hsl(0 0% 100% / ${0.45 * k})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-m.w * 0.2, -m.w * 0.15, m.w * 0.4, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();
    });
  },
  umbra: (ctx, m, k, r, t) => {
    pool(ctx, m.w, `hsl(270 60% 4% / ${0.85 * k})`, "hsl(270 60% 10% / 0)");
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const x = (r() * 2 - 1) * m.w * 0.7, h = 14 + r() * 18;
      const sway = Math.sin(t * 2 + i) * 6;
      ctx.strokeStyle = withA(m.b, 0.45 * k);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + sway, -h * 0.5, x - sway * 0.5, -h);
      ctx.stroke();
    }
  },
  lux: (ctx, m, k, r, t) => {
    ctx.globalCompositeOperation = "lighter";
    pool(ctx, m.w, withA(m.b, 0.35 * k), withA(m.b, 0));
    flat(ctx, () => {
      ctx.strokeStyle = `hsl(48 100% 80% / ${0.8 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, m.w * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, m.w * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * m.w * 0.55, Math.sin(a) * m.w * 0.55);
        ctx.lineTo(Math.cos(a) * m.w * 0.85, Math.sin(a) * m.w * 0.85);
        ctx.stroke();
      }
    });
  },
  gravi: (ctx, m, k) => {
    pool(ctx, m.w * 0.8, `hsl(260 40% 4% / ${0.8 * k})`, `hsl(260 40% 10% / ${0.2 * k})`);
    flat(ctx, () => {
      ctx.strokeStyle = withA(m.b, 0.6 * k);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, m.w * 0.85, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.strokeStyle = `hsl(250 20% 60% / ${0.5 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, m.w, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    });
  },
  tele: (ctx, m, k, r, t) => {
    ctx.globalCompositeOperation = "lighter";
    flat(ctx, () => {
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -t * 60;
      ctx.strokeStyle = withA(m.b, 0.85 * k);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, m.w * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    pool(ctx, m.w * 0.5, withA(m.a, 0.4 * k), withA(m.a, 0));
  },
  vita: (ctx, m, k, r) => {
    pool(ctx, m.w, `hsl(110 45% 25% / ${0.4 * k})`, "hsl(110 45% 25% / 0)");
    const grow = clamp((m.max - m.life) / 0.6, 0, 1);
    ctx.lineCap = "round";
    for (let i = 0; i < 10; i++) {
      const x = (r() * 2 - 1) * m.w * 0.85, h = (6 + r() * 12) * grow, lean = (r() - 0.5) * 8;
      ctx.strokeStyle = `hsl(${105 + r() * 30} 60% ${38 + r() * 15}% / ${k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x, -h * 0.6, x + lean, -h);
      ctx.stroke();
      if (i % 3 === 0 && grow > 0.8) {
        ctx.fillStyle = withA(m.b, k);
        ctx.beginPath();
        ctx.arc(x + lean, -h, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  toxi: (ctx, m, k, r, t) => {
    pool(ctx, m.w, withA(m.a, 0.55 * k), withA(m.a, 0.12 * k));
    for (let i = 0; i < 6; i++) {
      const x = (r() * 2 - 1) * m.w * 0.7, ph = (t * (0.8 + r()) + r()) % 1;
      const rad = 1.5 + ph * 4;
      ctx.strokeStyle = withA(m.b, k * (1 - ph));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, -rad * 0.6, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  chrono: (ctx, m, k, r, t) => {
    ctx.globalCompositeOperation = "lighter";
    flat(ctx, () => {
      ctx.strokeStyle = withA(m.b, 0.75 * k);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, m.w * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * m.w * 0.66, Math.sin(a) * m.w * 0.66);
        ctx.lineTo(Math.cos(a) * m.w * 0.8, Math.sin(a) * m.w * 0.8);
        ctx.stroke();
      }
      // the hand runs backwards
      const a = -t * 3;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * m.w * 0.6, Math.sin(a) * m.w * 0.6);
      ctx.stroke();
    });
  },
  magneto: (ctx, m, k, r) => {
    pool(ctx, m.w * 0.5, `hsl(220 10% 20% / ${0.5 * k})`, "hsl(220 10% 20% / 0)");
    ctx.lineCap = "round";
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, d = m.w * (0.25 + r() * 0.75);
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.22;
      ctx.strokeStyle = `hsl(215 12% ${55 + r() * 30}% / ${0.9 * k})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 1.6);
      ctx.stroke();
    }
  },
  psy: (ctx, m, k, r, t) => {
    ctx.globalCompositeOperation = "lighter";
    flat(ctx, () => {
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.8 + i / 3) % 1;
        ctx.strokeStyle = withA(m.b, 0.7 * k * (1 - u));
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, m.w * (0.15 + 0.85 * u), 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  },
  shift: (ctx, m, k, r) => {
    flat(ctx, () => {
      ctx.fillStyle = withA(m.a, 0.6 * k);
      for (let i = 0; i < 6; i++) {
        const x = (r() * 2 - 1) * m.w * 0.55, rr = m.w * (0.25 + r() * 0.3);
        ctx.beginPath();
        ctx.arc(x, (r() * 2 - 1) * m.w * 0.3, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `hsl(0 0% 100% / ${0.35 * k})`;
      ctx.beginPath();
      ctx.arc(-m.w * 0.15, -m.w * 0.2, m.w * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  spatio: (ctx, m, k, r, t) => {
    ctx.globalCompositeOperation = "lighter";
    flat(ctx, () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, m.w, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = withA(m.b, 0.6 * k);
      ctx.lineWidth = 2;
      const step = m.w / 3;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(i * step, -m.w); ctx.lineTo(i * step, m.w); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-m.w, i * step); ctx.lineTo(m.w, i * step); ctx.stroke();
      }
      ctx.restore();
    });
    // a few panes of space knocked loose, hovering
    for (let i = 0; i < 4; i++) {
      const x = (r() * 2 - 1) * m.w * 0.7, s = 5 + r() * 6;
      const y = -6 - r() * 10 - Math.sin(t * 2 + i) * 3;
      ctx.strokeStyle = withA(m.b, 0.8 * k);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    }
  },
  hexizon: (ctx, m, k, r) => {
    // blocky pixels that glitch to new spots every few frames
    const jitter = rng(m.seed + Math.floor(m.life * 8));
    for (let i = 0; i < 14; i++) {
      const x = Math.round(((jitter() * 2 - 1) * m.w * 0.9) / 4) * 4;
      const y = -Math.round((jitter() * 10) / 4) * 4;
      const s = 4 + Math.floor(jitter() * 2) * 4;
      ctx.fillStyle = withA(i % 3 === 0 ? "hsl(0 0% 100%)" : i % 3 === 1 ? m.a : m.b, 0.85 * k);
      ctx.fillRect(x, y - s, s, s);
    }
    pool(ctx, m.w * 0.7, `hsl(0 0% 0% / ${0.45 * k})`, "hsl(0 0% 0% / 0)");
  },
  gamma: (ctx, m, k, r, t) => {
    // a scorched patch glowing green at the middle, with motes of radiation rising off it
    pool(ctx, m.w, `hsl(95 40% 6% / ${0.6 * k})`, "hsl(95 40% 6% / 0)");
    ctx.globalCompositeOperation = "lighter";
    pool(ctx, m.w * 0.45, withA(m.a, 0.45 * k * (0.75 + 0.25 * Math.sin(t * 9))), withA(m.a, 0));
    for (let i = 0; i < 6; i++) {
      const x = (r() * 2 - 1) * m.w * 0.6, rise = (t * 0.8 + r()) % 1;
      ctx.fillStyle = withA(i % 2 ? m.b : m.a, 0.8 * k * (1 - rise));
      ctx.beginPath();
      ctx.arc(x, -rise * 24, 1.6 + r() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  velo: (ctx, m, k, r) => {
    // skid marks: dark streaks smeared along the floor with a few embers caught in them
    for (let i = 0; i < 4; i++) {
      const y = (r() * 2 - 1) * m.w * 0.12, x0 = -m.w * (0.5 + r() * 0.4), x1 = m.w * (0.5 + r() * 0.4);
      ctx.strokeStyle = `hsl(0 0% 6% / ${0.55 * k})`;
      ctx.lineWidth = 2 + r() * 2;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = withA(i % 2 ? m.b : m.a, 0.7 * k);
      ctx.fillRect((r() * 2 - 1) * m.w * 0.7, -(r() * 4), 3, 2);
    }
  },
  portal: (ctx, m, k, r, t) => {
    // a ring door lying open in the floor, with chips of matter scattered round it
    flat(ctx, () => {
      ctx.fillStyle = `hsl(270 50% 4% / ${0.7 * k})`;
      ctx.beginPath(); ctx.arc(0, 0, m.w * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = withA(m.a, 0.8 * k);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, m.w * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = withA(m.b, 0.6 * k);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, m.w * 0.45, t * 3, t * 3 + 4.2); ctx.stroke();
    });
    for (let i = 0; i < 6; i++) {
      const x = (r() * 2 - 1) * m.w, z = 2 + r() * 3;
      ctx.fillStyle = withA(i % 2 ? m.a : m.b, 0.8 * k);
      ctx.fillRect(x - z / 2, -z - r() * 3, z, z);
    }
  },
  sono: (ctx, m, k, r, t) => {
    // sound rings rippling out across the floor in time, and a row of equalizer bars bouncing at the middle
    flat(ctx, () => {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const q = (t * 1.6 + i / 3) % 1;
        ctx.strokeStyle = withA(i % 2 ? m.b : m.a, 0.7 * k * (1 - q));
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, m.w * (0.2 + 0.8 * q), 0, Math.PI * 2); ctx.stroke();
      }
    });
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const h = (3 + 9 * Math.abs(Math.sin(t * (5 + r() * 4) + i * 1.3))) * k;
      ctx.fillStyle = withA(i % 3 === 1 ? m.b : m.a, 0.8 * k);
      ctx.fillRect((i - 3) * 5 - 1.5, -h, 3, h);
    }
  },
  paper: (ctx, m, k, r) => {
    // a red ink seal pressed into the floor, with torn scraps of paper scattered round it
    flat(ctx, () => {
      ctx.strokeStyle = withA(m.b, 0.75 * k);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, m.w * 0.32, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-m.w * 0.14, -m.w * 0.12); ctx.lineTo(m.w * 0.14, m.w * 0.12); ctx.moveTo(m.w * 0.12, -m.w * 0.14); ctx.lineTo(-m.w * 0.04, m.w * 0.02); ctx.stroke();
    });
    for (let i = 0; i < 8; i++) {
      const x = (r() * 2 - 1) * m.w * 0.85, y = -(r() * 4), w = 4 + r() * 5, h = 2 + r() * 3;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((r() - 0.5) * 1.4);
      ctx.fillStyle = withA(i % 4 === 0 ? m.b : m.a, 0.85 * k);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  },
  crys: (ctx, m, k, r) => {
    // a cluster of small crystals left standing in the floor
    pool(ctx, m.w, withA(m.b, 0.25 * k), withA(m.b, 0));
    for (let i = 0; i < 6; i++) {
      const x = (r() * 2 - 1) * m.w * 0.6, h = (6 + r() * 12) * k, w = 2.5 + r() * 2.5, lean = (r() - 0.5) * 0.8;
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(lean);
      ctx.fillStyle = withA(i % 2 ? m.a : m.b, 0.85 * k);
      ctx.beginPath();
      ctx.moveTo(-w, 0); ctx.lineTo(-w, -h + w); ctx.lineTo(0, -h); ctx.lineTo(w, -h + w); ctx.lineTo(w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },
  sand: (ctx, m, k, r) => {
    // a low drift of sand with a few grains scattered round it
    flat(ctx, () => {
      ctx.fillStyle = withA(m.a, 0.7 * k);
      ctx.beginPath();
      ctx.ellipse(0, 0, m.w * 0.6, m.w * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = withA(i % 4 === 0 ? m.b : m.a, 0.8 * k);
      ctx.fillRect((r() * 2 - 1) * m.w * 0.9, -r() * 3, 2, 2);
    }
  },
  plasma: (ctx, m, k, r) => {
    // a scorch with a few arcs of plasma still crackling across it
    pool(ctx, m.w, withA(m.a, 0.3 * k), withA(m.a, 0));
    ctx.strokeStyle = withA(m.b, 0.8 * k);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      let x = (r() * 2 - 1) * m.w * 0.6, y = -r() * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (r() * 2 - 1) * 9;
        y = -r() * 6 * k;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  chaos: (ctx, m, k, r) => {
    // a skid of scorched streaks with a few glints of chaos energy still twinkling on it
    pool(ctx, m.w, withA(m.a, 0.25 * k), withA(m.a, 0));
    ctx.strokeStyle = withA(m.a, 0.6 * k);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const y = -1 - i * 1.5, x0 = (r() * 2 - 1) * m.w * 0.5;
      ctx.beginPath();
      ctx.moveTo(x0 - m.w * 0.4, y);
      ctx.lineTo(x0 + m.w * 0.4, y);
      ctx.stroke();
    }
    ctx.fillStyle = withA(m.b, 0.9 * k);
    for (let i = 0; i < 4; i++) {
      const x = (r() * 2 - 1) * m.w * 0.6, y = -2 - r() * 6 * k, rr = 1.6 + r() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y - rr * 2);
      ctx.lineTo(x + rr * 0.5, y);
      ctx.lineTo(x, y + rr * 2);
      ctx.lineTo(x - rr * 0.5, y);
      ctx.closePath();
      ctx.fill();
    }
  },
  flora: (ctx, m, k, r) => {
    // a tuft of grass and a couple of flowers left growing where it hit
    for (let i = 0; i < 9; i++) {
      const x = (r() * 2 - 1) * m.w * 0.7, h = (4 + r() * 9) * k, lean = (r() - 0.5) * 5;
      ctx.strokeStyle = withA(m.a, 0.85 * k);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x, -h * 0.6, x + lean, -h);
      ctx.stroke();
      if (i % 4 === 0) {
        ctx.fillStyle = withA(m.b, 0.9 * k);
        ctx.beginPath();
        ctx.arc(x + lean, -h, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};

const ringMark: MarkDraw = (ctx, m, k) => {
  pool(ctx, m.w, withA(m.a, 0.4 * k), withA(m.a, 0));
  flat(ctx, () => {
    ctx.strokeStyle = withA(m.b, 0.7 * k);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, m.w * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  });
};

/** Every mark on the floor, each in its element's own style. Drawn under the fighters. */
export function drawMarks(ctx: CanvasRenderingContext2D, marks: Mark[], ground: number, t: number) {
  for (const m of marks) {
    const k = clamp(m.life / 1.2, 0, 1) * clamp((m.max - m.life) / 0.1, 0, 1);
    if (k <= 0.01) continue;
    ctx.save();
    ctx.translate(m.x, ground + 3);
    (MARKS[m.power] ?? ringMark)(ctx, m, k, rng(m.seed), t);
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// ---------- focus lines ----------
/** Anime focus lines: thin wedges from far outside the screen closing on the spot. Drawn in world space. */
export function drawFocus(ctx: CanvasRenderingContext2D, f: Focus) {
  const u = f.t / f.max;
  if (u >= 1) return;
  const r = rng(f.seed + Math.floor(f.t * 20));
  const a = (1 - easeIn(u)) * 0.7;
  ctx.save();
  ctx.fillStyle = withA(f.color, a);
  const n = 54;
  for (let i = 0; i < n; i++) {
    const an = (i / n) * Math.PI * 2 + r() * 0.08;
    const inner = 130 + r() * 150 + u * 60;
    const wdt = 0.006 + r() * 0.014;
    ctx.beginPath();
    ctx.moveTo(f.x + Math.cos(an) * inner, f.y + Math.sin(an) * inner);
    ctx.lineTo(f.x + Math.cos(an - wdt) * 1500, f.y + Math.sin(an - wdt) * 1500);
    ctx.lineTo(f.x + Math.cos(an + wdt) * 1500, f.y + Math.sin(an + wdt) * 1500);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- letterbox ----------
export function drawBars(ctx: CanvasRenderingContext2D, k: number) {
  if (k <= 0.01) return;
  const h = BAR * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  ctx.fillStyle = "hsl(250 35% 4%)";
  ctx.fillRect(0, 0, W, h);
  ctx.fillRect(0, H - h, W, h);
}

// ---------- name cards ----------
/** Each fighter's name and power, sliding in under it as its entrance lands. Screen space. */
export function drawNameCards(ctx: CanvasRenderingContext2D, cards: NameCard[], text: TextFn) {
  for (const c of cards) {
    if (c.k <= 0.01) continue;
    const k = easeOut(clamp(c.k, 0, 1));
    const h = 66, slant = 16;
    const top = H - BAR - h - 14 + (1 - k) * 40;
    const x0 = c.cx - c.w / 2;
    ctx.save();
    ctx.globalAlpha = clamp(c.k * 1.6, 0, 1);
    ctx.beginPath();
    ctx.moveTo(x0 + slant, top);
    ctx.lineTo(x0 + c.w, top);
    ctx.lineTo(x0 + c.w - slant, top + h);
    ctx.lineTo(x0, top + h);
    ctx.closePath();
    ctx.fillStyle = "hsl(250 32% 10% / 0.88)";
    ctx.fill();
    ctx.save();
    ctx.clip();
    // the fighter's colours wipe across the plate, then settle into a stripe on its leading edge
    const g = ctx.createLinearGradient(x0, 0, x0 + c.w, 0);
    g.addColorStop(0, c.a);
    g.addColorStop(1, c.b);
    ctx.fillStyle = g;
    const wipe = 1 - seg(c.k, 0.2, 0.7);
    ctx.fillRect(x0, top, 14 + (c.w - 14) * wipe, h);
    ctx.fillRect(x0, top + h - 4, c.w, 4);
    ctx.restore();
    text(ctx, c.name.toUpperCase(), x0 + 30, top + 26, 28, "white", "left");
    text(ctx, c.power, x0 + 30, top + 50, 16, c.b, "left");
    ctx.restore();
  }
}

// ---------- super-move cut-in ----------
/**
 * A band slashes across the screen from the fighter's side with its colours racing through, the fighter's portrait
 * cropped inside it and the move's name. Screen space. `portrait(x, y, size)` draws the fighter's body centred there.
 */
export function drawCutIn(ctx: CanvasRenderingContext2D, c: CutIn, portrait: (x: number, y: number, size: number) => void, text: TextFn) {
  const u = c.t / c.max;
  if (u >= 1) return;
  const inK = easeOut(seg(u, 0, 0.14));
  const outK = easeIn(seg(u, 0.8, 1));
  const cy = H * 0.44;
  const h = 136 * (1 - outK);
  if (h < 1) return;
  const off = c.side * -(1 - inK) * W * 1.15;
  ctx.save();
  // the arena dims behind the band
  ctx.fillStyle = `hsl(250 40% 5% / ${0.4 * inK * (1 - outK)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.translate(off, 0);
  const tilt = 20;
  const band = () => {
    ctx.beginPath();
    ctx.moveTo(-80, cy - h / 2 + tilt);
    ctx.lineTo(W + 80, cy - h / 2 - tilt);
    ctx.lineTo(W + 80, cy + h / 2 - tilt);
    ctx.lineTo(-80, cy + h / 2 + tilt);
    ctx.closePath();
  };
  band();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  const [near, far] = c.side > 0 ? [c.a, c.b] : [c.b, c.a];
  g.addColorStop(0, near);
  g.addColorStop(0.55, "hsl(250 35% 10%)");
  g.addColorStop(1, far);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // speed streaks racing the way the band came in
  const r = rng(7.1);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 16; i++) {
    const y = cy - h / 2 + r() * h;
    const len = 120 + r() * 260;
    const x = ((r() * W + c.t * (1400 + r() * 900) * c.side) % (W + 400) + W + 400) % (W + 400) - 200;
    ctx.fillStyle = `hsl(0 0% 100% / ${0.1 + r() * 0.2})`;
    ctx.fillRect(x, y, len, 1.5 + r() * 2.5);
  }
  ctx.globalCompositeOperation = "source-over";
  const px = c.side > 0 ? W * 0.22 : W * 0.78;
  portrait(px + c.side * u * 24, cy + 46, 2.5);
  ctx.restore();
  // white edges
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-80, cy - h / 2 + tilt); ctx.lineTo(W + 80, cy - h / 2 - tilt);
  ctx.moveTo(-80, cy + h / 2 + tilt); ctx.lineTo(W + 80, cy + h / 2 - tilt);
  ctx.stroke();
  if (h > 60) {
    const tx = c.side > 0 ? W * 0.62 : W * 0.38;
    const pop = 1 + 0.25 * (1 - seg(u, 0.08, 0.22));
    text(ctx, c.name.toUpperCase(), tx, cy - 30, 20, c.b);
    text(ctx, c.move.toUpperCase(), tx, cy + 12, Math.round(48 * pop), "white");
  }
  ctx.restore();
}

// ---------- Story cutscenes ----------
/** A boss's title as it arrives in a Story cutscene: `t` seconds since it landed, gone after `max`. */
export type BossTitle = { eyebrow: string; name: string; power: string; a: string; b: string; t: number; max: number };

/**
 * A tilted band slashes in from the right in the boss's colours, its name slammed across it, then the band
 * thins away. Screen space, drawn over the arena and under the letterbox.
 */
export function drawBossTitle(ctx: CanvasRenderingContext2D, p: BossTitle, text: TextFn) {
  const u = p.t / p.max;
  if (u <= 0 || u >= 1) return;
  const inK = easeOut(seg(u, 0, 0.12));
  const outK = easeIn(seg(u, 0.82, 1));
  const cy = H * 0.66;
  const h = 118 * (1 - outK);
  if (h < 1) return;
  const tilt = 14;
  const off = (1 - inK) * W * 1.2;
  ctx.save();
  // the arena sinks back behind the name
  ctx.fillStyle = `hsl(250 40% 5% / ${0.35 * inK * (1 - outK)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.translate(off, 0);
  const band = () => {
    ctx.beginPath();
    ctx.moveTo(-80, cy - h / 2 + tilt);
    ctx.lineTo(W + 80, cy - h / 2 - tilt);
    ctx.lineTo(W + 80, cy + h / 2 - tilt);
    ctx.lineTo(-80, cy + h / 2 + tilt);
    ctx.closePath();
  };
  band();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "hsl(250 35% 8%)");
  g.addColorStop(0.45, withA(p.a, 0.95));
  g.addColorStop(1, p.b);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // light streaks racing left across the band
  const r = rng(3.3);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 14; i++) {
    const y = cy - h / 2 + r() * h;
    const len = 100 + r() * 240;
    const x = ((r() * W - p.t * (900 + r() * 700)) % (W + 400) + W + 400) % (W + 400) - 200;
    ctx.fillStyle = `hsl(0 0% 100% / ${0.08 + r() * 0.16})`;
    ctx.fillRect(x, y, len, 1.5 + r() * 2);
  }
  ctx.restore();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-80, cy - h / 2 + tilt); ctx.lineTo(W + 80, cy - h / 2 - tilt);
  ctx.moveTo(-80, cy + h / 2 + tilt); ctx.lineTo(W + 80, cy + h / 2 - tilt);
  ctx.stroke();
  if (h > 70) {
    // the name lands big and settles
    const pop = 1 + 0.35 * (1 - easeOut(seg(u, 0.06, 0.2)));
    const tx = W * 0.56;
    text(ctx, p.eyebrow.toUpperCase(), tx, cy - 38, 18, "hsl(0 85% 66%)");
    text(ctx, p.name.toUpperCase(), tx, cy + 2, Math.round(58 * pop), "white");
    text(ctx, p.power, tx, cy + 40, 20, p.b);
  }
  ctx.restore();
}

/** The edges of the picture darkened, like a lens. Screen space. */
export function drawVignette(ctx: CanvasRenderingContext2D, k: number) {
  if (k <= 0.01) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.68);
  g.addColorStop(0, "hsl(250 40% 4% / 0)");
  g.addColorStop(1, `hsl(250 40% 4% / ${0.6 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
