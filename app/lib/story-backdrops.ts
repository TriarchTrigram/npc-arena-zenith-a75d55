// Story mode's arenas: every chapter has its own landscape, and every stage in it its own painting.
// The sky darkens as a chapter goes on (dawn, day, dusk, then the boss's lair), the set pieces move,
// and each chapter's threat grows stage by stage: the rift widens, the storm thickens, the sun goes out.
// Painted once per stage onto an offscreen canvas, then drawn behind the fight like the home arena.
import { W, H, setAir, type Air } from "./arena-engine";
import { lairOf } from "./story";

const INK = "hsl(250 32% 14%)";
const FLOOR = 440;

type Rnd = () => number;
type Ctx = CanvasRenderingContext2D;

type Look = {
  /** Sky top, middle, horizon for each part of the chapter: stages 1-4, 5-7, 8-9, then the boss's lair. */
  sky: [string, string, string][];
  far: string;
  near: string;
  floor: [string, string];
  line: string;
  /** Stars in the sky from this part of the chapter on (0 = always). */
  starsFrom: number;
  /** Leave the rolling hills out (the coast looks out over open sea). */
  flat?: boolean;
  scene: (ctx: Ctx, stage: number, phase: number, rnd: Rnd) => void;
  /** Painted on top of the hills, in front of the scene. */
  front?: (ctx: Ctx, stage: number, phase: number, rnd: Rnd) => void;
};

/** Which part of its chapter a stage is in: 0 dawn, 1 day, 2 dusk, 3 the boss's lair (the last stage). */
const phaseOf = (stage: number, lair: number) => (stage >= lair ? 3 : stage >= lair - 2 ? 2 : stage >= 4 ? 1 : 0);

function hills(ctx: Ctx, y: number, amp: number, col: string, seed: number, step = 20) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR);
  for (let x = 0; x <= W; x += step) ctx.lineTo(x, y - Math.abs(Math.sin(x * 0.006 + seed)) * amp - Math.sin(x * 0.021 + seed * 2) * amp * 0.25);
  ctx.lineTo(W, FLOOR);
  ctx.fill();
}

function glow(ctx: Ctx, x: number, y: number, r: number, col: string, a = 0.8) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col.replace(")", ` / ${a})`));
  g.addColorStop(1, col.replace(")", " / 0)"));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function stars(ctx: Ctx, rnd: Rnd, n: number, bottom = FLOOR - 80) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `hsl(${rnd() < 0.3 ? 210 : 48} 70% 92% / ${0.3 + rnd() * 0.7})`;
    const r = rnd() < 0.08 ? 2 : 1;
    ctx.fillRect(rnd() * W, rnd() * bottom, r, r);
  }
}

/** A jagged crack of light across the sky. */
function crack(ctx: Ctx, x: number, y: number, len: number, rnd: Rnd, core: string, edge: string, width: number) {
  const pts: [number, number][] = [];
  for (let k = 0; k <= 9; k++) pts.push([x + (rnd() - 0.5) * width * 1.6, y - len / 2 + (len * k) / 9]);
  for (const [w, col] of [[width * 2.4, edge], [width, core]] as const) {
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

const LOOKS: Look[] = [
  // 1. The Rift Opens: a town under a crack in the sky that widens every stage
  {
    sky: [["hsl(216 64% 62%)", "hsl(250 50% 78%)", "hsl(30 90% 84%)"], ["hsl(236 46% 46%)", "hsl(270 40% 64%)", "hsl(20 80% 72%)"], ["hsl(256 40% 24%)", "hsl(276 40% 40%)", "hsl(330 50% 54%)"], ["hsl(262 50% 8%)", "hsl(270 50% 18%)", "hsl(186 60% 30%)"]],
    far: "hsl(255 26% 52%)", near: "hsl(252 24% 40%)", floor: ["hsl(36 40% 62%)", "hsl(30 34% 48%)"], line: "hsl(30 30% 40% / 0.5)", starsFrom: 2,
    scene(ctx, stage, phase, rnd) {
      const x = 200 + ((stage * 173) % 560);
      glow(ctx, x, 150, 140 + stage * 18, "hsl(186 100% 70%)", 0.35 + phase * 0.12);
      crack(ctx, x, 160, 90 + stage * 26, rnd, "hsl(186 100% 92%)", "hsl(276 90% 60% / 0.7)", 4 + stage * 1.2);
    },
    front(ctx, stage, phase, rnd) {
      // rooftops, a clock tower in the second stage
      for (let x = -20; x < W; x += 50 + rnd() * 40) {
        const w = 40 + rnd() * 50, h = 50 + rnd() * 70 + (stage === 1 && Math.abs(x - 480) < 60 ? 120 : 0);
        ctx.fillStyle = phase >= 2 ? "hsl(258 30% 18%)" : "hsl(250 22% 34%)";
        ctx.fillRect(x, FLOOR - h, w, h);
        ctx.fillStyle = phase >= 2 ? "hsl(48 90% 66% / 0.8)" : "hsl(48 60% 80% / 0.5)";
        for (let wy = FLOOR - h + 10; wy < FLOOR - 14; wy += 18) for (let wx = x + 6; wx < x + w - 10; wx += 14) if (rnd() < 0.4) ctx.fillRect(wx, wy, 6, 8);
      }
    },
  },
  // 2. The Storm Coast: open sea and a lighthouse, the storm worse every stage
  {
    sky: [["hsl(200 50% 62%)", "hsl(196 40% 76%)", "hsl(190 30% 86%)"], ["hsl(210 30% 44%)", "hsl(206 24% 58%)", "hsl(200 20% 70%)"], ["hsl(222 30% 24%)", "hsl(214 26% 36%)", "hsl(200 24% 48%)"], ["hsl(226 40% 10%)", "hsl(206 40% 20%)", "hsl(186 60% 30%)"]],
    far: "hsl(206 20% 40%)", near: "hsl(200 22% 30%)", floor: ["hsl(42 46% 70%)", "hsl(36 36% 54%)"], line: "hsl(36 30% 44% / 0.5)", starsFrom: 3, flat: true,
    scene(ctx, stage, phase, rnd) {
      // storm clouds
      ctx.fillStyle = `hsl(220 16% ${46 - phase * 10}% / ${0.3 + stage * 0.06})`;
      for (let i = 0; i < 4 + stage; i++) {
        const cx = rnd() * W, cy = 40 + rnd() * 120, r = 50 + rnd() * 60;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 1.6, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (stage >= 5) crack(ctx, 160 + rnd() * 640, 180, 220, rnd, "hsl(54 100% 92%)", "hsl(200 100% 70% / 0.6)", 3);
      // the sea, swirling at the boss's whirlpool
      const sea = ctx.createLinearGradient(0, 320, 0, FLOOR);
      sea.addColorStop(0, `hsl(200 ${50 - phase * 6}% ${44 - phase * 8}%)`);
      sea.addColorStop(1, `hsl(206 50% ${30 - phase * 6}%)`);
      ctx.fillStyle = sea;
      ctx.fillRect(0, 320, W, FLOOR - 320);
      ctx.strokeStyle = "hsl(186 80% 86% / 0.5)";
      ctx.lineWidth = 2;
      for (let y = 334; y < FLOOR; y += 16) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.04 + y + stage) * (2 + phase));
        ctx.stroke();
      }
      if (phase === 3) {
        for (let k = 1; k < 7; k++) {
          ctx.beginPath();
          ctx.ellipse(W / 2, 372, k * 50, k * 9, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `hsl(186 100% 76% / ${0.5 - k * 0.06})`;
          ctx.stroke();
        }
      }
    },
    front(ctx, stage, phase) {
      // the lighthouse, dark until the storm is beaten
      const x = 120 + ((stage * 211) % 700);
      ctx.fillStyle = "hsl(0 0% 92%)";
      ctx.beginPath();
      ctx.moveTo(x - 16, FLOOR - 6);
      ctx.lineTo(x - 9, FLOOR - 140);
      ctx.lineTo(x + 9, FLOOR - 140);
      ctx.lineTo(x + 16, FLOOR - 6);
      ctx.fill();
      ctx.fillStyle = "hsl(2 70% 50%)";
      for (const y of [FLOOR - 40, FLOOR - 90]) ctx.fillRect(x - 15, y, 30, 14);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 12, FLOOR - 160, 24, 20);
      if (phase === 0) glow(ctx, x, FLOOR - 150, 70, "hsl(48 100% 70%)", 0.7);
      // rain
      ctx.strokeStyle = `hsl(200 60% 88% / ${0.2 + phase * 0.1})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < stage * 24; i++) {
        const rx = (i * 97.3) % W, ry = (i * 53.7) % FLOOR;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + 18);
        ctx.stroke();
      }
    },
  },
  // 3. The Ember Wastes: glass dunes and a volcano that burns brighter every stage
  {
    sky: [["hsl(32 70% 66%)", "hsl(24 80% 76%)", "hsl(40 90% 84%)"], ["hsl(18 60% 50%)", "hsl(20 70% 64%)", "hsl(34 90% 72%)"], ["hsl(8 50% 26%)", "hsl(12 60% 40%)", "hsl(26 90% 54%)"], ["hsl(4 50% 8%)", "hsl(8 60% 18%)", "hsl(20 100% 40%)"]],
    far: "hsl(18 30% 38%)", near: "hsl(24 46% 52%)", floor: ["hsl(30 50% 54%)", "hsl(16 36% 34%)"], line: "hsl(14 40% 26% / 0.5)", starsFrom: 3,
    scene(ctx, stage, phase, rnd) {
      const x = 220 + ((stage * 149) % 520);
      // the volcano
      ctx.fillStyle = "hsl(12 22% 20%)";
      ctx.beginPath();
      ctx.moveTo(x - 260, FLOOR);
      ctx.lineTo(x - 50, 150);
      ctx.lineTo(x + 50, 150);
      ctx.lineTo(x + 260, FLOOR);
      ctx.fill();
      glow(ctx, x, 150, 80 + stage * 14, "hsl(28 100% 58%)", 0.5 + phase * 0.12);
      ctx.strokeStyle = "hsl(28 100% 56%)";
      ctx.lineWidth = 5;
      for (let k = 0; k < 1 + Math.floor(stage / 3); k++) {
        ctx.beginPath();
        ctx.moveTo(x - 20 + k * 18, 154);
        ctx.quadraticCurveTo(x - 60 + k * 50 + rnd() * 30, 280, x - 120 + k * 90, FLOOR);
        ctx.stroke();
      }
      // smoke
      ctx.fillStyle = `hsl(14 10% ${30 - phase * 6}% / 0.55)`;
      for (let k = 0; k < 3 + stage; k++) {
        ctx.beginPath();
        ctx.arc(x - 10 + Math.sin(k) * 30 + k * 12, 130 - k * 22, 26 + k * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    front(ctx, stage, phase, rnd) {
      // embers in the air
      for (let i = 0; i < 20 + stage * 8; i++) {
        ctx.fillStyle = `hsl(${30 + rnd() * 20} 100% ${60 + rnd() * 20}% / ${0.4 + rnd() * 0.5})`;
        ctx.fillRect(rnd() * W, rnd() * FLOOR, 2, 2);
      }
      if (phase >= 2) glow(ctx, W / 2, FLOOR, 420, "hsl(20 100% 50%)", 0.25);
    },
  },
  // 4. The Frozen Clock: snowy peaks under a giant stopped clock, snow hanging still in the air
  {
    sky: [["hsl(200 50% 78%)", "hsl(206 40% 88%)", "hsl(210 30% 94%)"], ["hsl(214 40% 62%)", "hsl(220 34% 76%)", "hsl(240 30% 86%)"], ["hsl(236 40% 28%)", "hsl(250 30% 44%)", "hsl(170 50% 60%)"], ["hsl(230 50% 10%)", "hsl(220 40% 22%)", "hsl(44 60% 50%)"]],
    far: "hsl(210 26% 74%)", near: "hsl(212 24% 62%)", floor: ["hsl(200 40% 90%)", "hsl(206 30% 72%)"], line: "hsl(210 30% 60% / 0.5)", starsFrom: 2,
    scene(ctx, stage, phase) {
      // the clock in the sky, its hands stopping closer to midnight every stage
      const cx = 160 + ((stage * 191) % 640), cy = 150, r = 90;
      glow(ctx, cx, cy, r * 1.8, "hsl(44 90% 72%)", 0.25 + phase * 0.1);
      ctx.fillStyle = "hsl(44 40% 92% / 0.85)";
      ctx.strokeStyle = "hsl(44 50% 40%)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
        ctx.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94);
        ctx.stroke();
      }
      const left = (10 - stage) / 10;
      for (const [a, len, w] of [[-Math.PI / 2 - left * Math.PI * 0.9, 0.55, 6], [-Math.PI / 2 - left * Math.PI * 2 * 3, 0.8, 3]] as const) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r * len, cy + Math.sin(a) * r * len);
        ctx.strokeStyle = INK;
        ctx.lineWidth = w;
        ctx.stroke();
      }
      // an aurora frozen in place later in the chapter
      if (phase >= 2) {
        ctx.strokeStyle = "hsl(160 80% 64% / 0.35)";
        ctx.lineWidth = 26;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 70 + Math.sin(x * 0.01) * 30);
        ctx.stroke();
      }
    },
    front(ctx, stage, _phase, rnd) {
      // snow caps on the peaks
      for (let k = 0; k < 5; k++) {
        const px = 80 + k * 200 + rnd() * 60, ph = 140 + rnd() * 80;
        ctx.fillStyle = "hsl(210 20% 52%)";
        ctx.beginPath();
        ctx.moveTo(px - 110, FLOOR);
        ctx.lineTo(px, FLOOR - ph);
        ctx.lineTo(px + 110, FLOOR);
        ctx.fill();
        ctx.fillStyle = "hsl(200 40% 96%)";
        ctx.beginPath();
        ctx.moveTo(px - 34, FLOOR - ph + 44);
        ctx.lineTo(px, FLOOR - ph);
        ctx.lineTo(px + 34, FLOOR - ph + 44);
        ctx.lineTo(px + 12, FLOOR - ph + 34);
        ctx.lineTo(px - 8, FLOOR - ph + 46);
        ctx.fill();
      }
      // snowflakes stopped in the air
      ctx.fillStyle = "hsl(0 0% 100% / 0.8)";
      for (let i = 0; i < 40 + stage * 10; i++) {
        ctx.beginPath();
        ctx.arc(rnd() * W, rnd() * FLOOR, 1 + rnd() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  // 5. The Heart of the Rift: floating islands in a violet void
  {
    sky: [["hsl(270 40% 30%)", "hsl(290 40% 44%)", "hsl(318 60% 62%)"], ["hsl(262 40% 22%)", "hsl(282 40% 34%)", "hsl(318 60% 50%)"], ["hsl(256 44% 14%)", "hsl(276 44% 24%)", "hsl(318 70% 40%)"], ["hsl(252 50% 6%)", "hsl(270 50% 14%)", "hsl(318 80% 34%)"]],
    far: "hsl(276 24% 30%)", near: "hsl(266 24% 22%)", floor: ["hsl(280 24% 40%)", "hsl(262 30% 22%)"], line: "hsl(318 70% 70% / 0.35)", starsFrom: 0,
    scene(ctx, stage, phase, rnd) {
      // a swirl at the heart of the rift
      ctx.save();
      ctx.translate(200 + ((stage * 137) % 560), 160);
      for (let k = 0; k < 4 + phase; k++) {
        ctx.rotate(0.6);
        ctx.beginPath();
        ctx.ellipse(0, 0, 60 + k * 24, 16 + k * 6, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `hsl(318 100% 76% / ${0.5 - k * 0.06})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
      // floating islands
      for (let k = 0; k < 3 + Math.floor(stage / 2); k++) {
        const ix = rnd() * W, iy = 90 + rnd() * 200, iw = 40 + rnd() * 60;
        ctx.fillStyle = "hsl(266 20% 26%)";
        ctx.beginPath();
        ctx.moveTo(ix - iw, iy);
        ctx.lineTo(ix + iw, iy);
        ctx.lineTo(ix + iw * 0.2, iy + iw * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "hsl(150 30% 40%)";
        ctx.fillRect(ix - iw, iy - 6, iw * 2, 8);
      }
    },
  },
  // 6. The Hollow Kingdom: a dead castle, bare trees and ghost lanterns in the fog
  {
    sky: [["hsl(180 10% 50%)", "hsl(170 10% 62%)", "hsl(150 10% 70%)"], ["hsl(190 14% 34%)", "hsl(176 12% 46%)", "hsl(150 14% 56%)"], ["hsl(200 20% 18%)", "hsl(186 16% 28%)", "hsl(152 30% 36%)"], ["hsl(200 30% 6%)", "hsl(180 30% 12%)", "hsl(152 60% 24%)"]],
    far: "hsl(186 8% 30%)", near: "hsl(180 8% 22%)", floor: ["hsl(40 8% 40%)", "hsl(30 8% 24%)"], line: "hsl(30 8% 16% / 0.5)", starsFrom: 2,
    scene(ctx, stage, phase) {
      // the moon and the castle
      glow(ctx, 760 - stage * 30, 110, 110, "hsl(152 60% 80%)", 0.4);
      ctx.fillStyle = "hsl(150 30% 90%)";
      ctx.beginPath();
      ctx.arc(760 - stage * 30, 110, 40, 0, Math.PI * 2);
      ctx.fill();
      const cx = 300 + ((stage * 97) % 360), size = 1 + phase * 0.2;
      ctx.fillStyle = "hsl(190 16% 12%)";
      ctx.fillRect(cx - 120 * size, FLOOR - 160 * size, 240 * size, 160 * size);
      for (const [dx, th] of [[-130, 230], [-60, 270], [20, 310], [100, 250]] as const) {
        const tx = cx + dx * size, top = FLOOR - th * size;
        ctx.fillRect(tx, top, 34 * size, th * size);
        ctx.beginPath();
        ctx.moveTo(tx - 6, top);
        ctx.lineTo(tx + 17 * size, top - 50 * size);
        ctx.lineTo(tx + 34 * size + 6, top);
        ctx.fill();
        ctx.fillStyle = "hsl(152 92% 60% / 0.8)";
        ctx.fillRect(tx + 12 * size, top + 30 * size, 8, 12);
        ctx.fillStyle = "hsl(190 16% 12%)";
      }
    },
    front(ctx, stage, phase, rnd) {
      // bare trees
      ctx.strokeStyle = "hsl(190 16% 10%)";
      for (let k = 0; k < 3; k++) {
        const tx = rnd() * W;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(tx, FLOOR);
        ctx.lineTo(tx + 6, FLOOR - 120);
        ctx.stroke();
        ctx.lineWidth = 3;
        for (let b = 0; b < 5; b++) {
          const by = FLOOR - 60 - b * 14, dir = b % 2 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(tx + 4, by);
          ctx.lineTo(tx + dir * (30 + rnd() * 20), by - 20 - rnd() * 20);
          ctx.stroke();
        }
      }
      // ghost lanterns and fog
      for (let i = 0; i < 6 + stage * 2; i++) glow(ctx, rnd() * W, 220 + rnd() * 200, 14, "hsl(152 92% 66%)", 0.9);
      const fog = ctx.createLinearGradient(0, FLOOR - 90, 0, FLOOR);
      fog.addColorStop(0, "hsl(160 20% 80% / 0)");
      fog.addColorStop(1, `hsl(160 20% 80% / ${0.25 + phase * 0.08})`);
      ctx.fillStyle = fog;
      ctx.fillRect(0, FLOOR - 90, W, 90);
    },
  },
  // 7. The Dying Sun: a huge sun going black a little more every stage
  {
    sky: [["hsl(36 80% 62%)", "hsl(30 90% 72%)", "hsl(44 100% 82%)"], ["hsl(24 60% 42%)", "hsl(20 70% 54%)", "hsl(36 90% 66%)"], ["hsl(14 40% 18%)", "hsl(16 50% 30%)", "hsl(30 80% 46%)"], ["hsl(20 30% 4%)", "hsl(24 40% 10%)", "hsl(36 90% 30%)"]],
    far: "hsl(20 30% 30%)", near: "hsl(24 30% 22%)", floor: ["hsl(38 40% 54%)", "hsl(26 30% 32%)"], line: "hsl(26 30% 22% / 0.5)", starsFrom: 3,
    scene(ctx, stage) {
      const sx = 480, sy = 230, r = 130;
      glow(ctx, sx, sy, r * 2.4, "hsl(40 100% 64%)", 0.6 - stage * 0.03);
      ctx.fillStyle = "hsl(44 100% 70%)";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      // the shadow slides across the sun, stage by stage
      const cover = (stage + 1) / 10;
      ctx.fillStyle = "hsl(30 30% 8%)";
      ctx.beginPath();
      ctx.arc(sx + (1 - cover) * r * 2, sy, r * 0.98, 0, Math.PI * 2);
      ctx.fill();
    },
    front(ctx, stage, _phase, rnd) {
      // ruined pillars and a sundial
      for (let k = 0; k < 6; k++) {
        const px = 40 + k * 170 + rnd() * 40, ph = 60 + rnd() * 110;
        ctx.fillStyle = "hsl(34 24% 40%)";
        ctx.fillRect(px, FLOOR - ph, 28, ph);
        ctx.fillStyle = "hsl(34 24% 30%)";
        ctx.fillRect(px - 6, FLOOR - ph - 10, 40, 10);
      }
      if (stage === 1) {
        ctx.fillStyle = "hsl(34 20% 60%)";
        ctx.beginPath();
        ctx.ellipse(480, FLOOR - 10, 90, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  // 8. The Edge of Everything: open space with planets and a black hole that grows every stage
  {
    sky: [["hsl(240 50% 10%)", "hsl(250 50% 18%)", "hsl(260 50% 28%)"], ["hsl(240 50% 8%)", "hsl(256 50% 16%)", "hsl(272 50% 26%)"], ["hsl(236 55% 6%)", "hsl(250 55% 12%)", "hsl(272 60% 22%)"], ["hsl(236 60% 3%)", "hsl(250 60% 8%)", "hsl(272 80% 20%)"]],
    far: "hsl(250 30% 16%)", near: "hsl(246 30% 12%)", floor: ["hsl(250 30% 22%)", "hsl(240 40% 8%)"], line: "hsl(272 100% 80% / 0.35)", starsFrom: 0,
    scene(ctx, stage, _phase, rnd) {
      // a planet with rings
      const px = 140 + rnd() * 200, py = 110 + rnd() * 60, pr = 30 + rnd() * 30;
      ctx.fillStyle = `hsl(${200 + stage * 18} 50% 56%)`;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "hsl(40 60% 80% / 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.8, pr * 0.4, -0.3, 0, Math.PI * 2);
      ctx.stroke();
      // the black hole
      const bx = 700 - ((stage * 41) % 160), by = 170, br = 20 + stage * 6;
      for (let k = 4; k > 0; k--) {
        ctx.beginPath();
        ctx.ellipse(bx, by, br * (1.4 + k * 0.4), br * (0.3 + k * 0.08), 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = `hsl(${272 - k * 30} 100% 72% / ${0.2 + k * 0.1})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  // Book 2, 1. Lights Under the Sea: a drowned harbour at night. Lure lights glow under the black water, more
  // every stage, tentacles rise out of the sea, and at the lair a huge eye looks up from below.
  {
    sky: [["hsl(214 40% 18%)", "hsl(204 34% 28%)", "hsl(190 30% 40%)"], ["hsl(216 44% 12%)", "hsl(206 36% 20%)", "hsl(190 34% 30%)"], ["hsl(220 50% 8%)", "hsl(206 44% 14%)", "hsl(180 40% 22%)"], ["hsl(210 60% 4%)", "hsl(196 56% 8%)", "hsl(170 50% 16%)"]],
    far: "hsl(200 30% 14%)", near: "hsl(200 30% 10%)", floor: ["hsl(196 20% 26%)", "hsl(200 24% 16%)"], line: "hsl(66 60% 60% / 0.25)", starsFrom: 0, flat: true,
    scene(ctx, stage, phase, rnd) {
      // a sick moon behind thin cloud
      glow(ctx, 760, 90, 90, "hsl(66 60% 70%)", 0.35);
      ctx.fillStyle = "hsl(66 30% 82%)";
      ctx.beginPath();
      ctx.arc(760, 90, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsl(206 30% 20% / ${0.4 + phase * 0.12})`;
      for (let i = 0; i < 3 + stage; i++) {
        const cx = rnd() * W, cy = 50 + rnd() * 110, r = 40 + rnd() * 50;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 1.8, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // the old crack the Reign 8 left behind, glowing green from the lair on
      if (phase >= 2) crack(ctx, 200 + rnd() * 400, 150, 160 + phase * 40, rnd, "hsl(66 100% 86%)", "hsl(170 100% 50% / 0.4)", 2.5);
      // the sea
      const sea = ctx.createLinearGradient(0, 300, 0, FLOOR);
      sea.addColorStop(0, `hsl(196 40% ${22 - phase * 4}%)`);
      sea.addColorStop(1, `hsl(206 50% ${10 - phase * 2}%)`);
      ctx.fillStyle = sea;
      ctx.fillRect(0, 300, W, FLOOR - 300);
      // the lair: a vast eye looking up from under the water
      if (phase === 3) {
        ctx.fillStyle = "hsl(60 30% 70% / 0.35)";
        ctx.beginPath();
        ctx.ellipse(W / 2, 380, 220, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsl(64 100% 50% / 0.55)";
        ctx.beginPath();
        ctx.arc(W / 2 + 20, 380, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsl(200 60% 4% / 0.8)";
        ctx.beginPath();
        ctx.ellipse(W / 2 + 20, 380, 7, 30, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // lure lights under the water, more of them every stage
      for (let i = 0; i < 3 + stage * 3; i++) {
        const lx = rnd() * W, ly = 320 + rnd() * (FLOOR - 330);
        glow(ctx, lx, ly, 10 + rnd() * 14, "hsl(66 100% 64%)", 0.55);
        ctx.fillStyle = "hsl(66 100% 88%)";
        ctx.fillRect(lx - 1, ly - 1, 2, 2);
      }
      ctx.strokeStyle = "hsl(180 40% 70% / 0.25)";
      ctx.lineWidth = 2;
      for (let y = 312; y < FLOOR; y += 18) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.03 + y) * 2);
        ctx.stroke();
      }
      // tentacles rising out of the sea from stage 3 on
      for (let i = 0; i < Math.max(0, stage - 1); i++) {
        const tx = 60 + ((i * 263 + stage * 71) % (W - 120)), base = 312 + rnd() * 30, h = 70 + rnd() * 60 + phase * 20;
        ctx.strokeStyle = "hsl(190 40% 8%)";
        ctx.lineCap = "round";
        let px = tx, py = base;
        for (let k = 1; k <= 10; k++) {
          const u = k / 10;
          const nx = tx + Math.sin(u * 3.2 + i) * 18 * u, ny = base - h * u;
          ctx.lineWidth = 12 * (1 - u * 0.85);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          px = nx;
          py = ny;
        }
      }
    },
    front(ctx, stage, phase) {
      // the pier and its lamp posts; one more lamp has gone out every stage
      ctx.fillStyle = "hsl(30 20% 12%)";
      ctx.fillRect(0, FLOOR - 34, W, 10);
      for (let x = 20; x < W; x += 90) ctx.fillRect(x, FLOOR - 26, 8, 26);
      for (let i = 0; i < 5; i++) {
        const x = 90 + i * 200;
        ctx.fillStyle = INK;
        ctx.fillRect(x - 2, FLOOR - 120, 4, 88);
        ctx.fillRect(x - 8, FLOOR - 128, 16, 10);
        if (i >= Math.floor(stage / 2) && phase < 3) glow(ctx, x, FLOOR - 123, 40, "hsl(44 100% 70%)", 0.6);
      }
    },
  },
  // Book 2, 2. The Singing Rot: a drowned forest swallowed by fungus. Giant glowing mushrooms grow taller every
  // stage, spores hang in the air, and at the lair the whole canopy is one huge, singing cap.
  {
    sky: [["hsl(300 20% 22%)", "hsl(320 18% 32%)", "hsl(170 24% 38%)"], ["hsl(300 24% 16%)", "hsl(316 20% 24%)", "hsl(170 30% 28%)"], ["hsl(296 30% 10%)", "hsl(310 24% 16%)", "hsl(170 40% 20%)"], ["hsl(300 40% 5%)", "hsl(310 30% 9%)", "hsl(170 60% 16%)"]],
    far: "hsl(300 16% 16%)", near: "hsl(300 18% 11%)", floor: ["hsl(310 16% 22%)", "hsl(300 20% 12%)"], line: "hsl(170 80% 60% / 0.22)", starsFrom: 3,
    scene(ctx, stage, phase, rnd) {
      // dead trees in the distance, the fungus climbing them
      for (let i = 0; i < 9; i++) {
        const tx = 30 + i * 115 + rnd() * 40, th = 160 + rnd() * 120;
        ctx.fillStyle = "hsl(300 14% 14%)";
        ctx.fillRect(tx - 6, 340 - th, 12, th + 40);
        ctx.strokeStyle = "hsl(300 14% 14%)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(tx, 340 - th * 0.6);
        ctx.lineTo(tx + (rnd() - 0.5) * 80, 300 - th);
        ctx.stroke();
        for (let k = 0; k < 1 + phase; k++) {
          const fy = 340 - th * (0.2 + rnd() * 0.6);
          ctx.fillStyle = "hsl(320 26% 34%)";
          ctx.beginPath();
          ctx.ellipse(tx + 8, fy, 12, 4, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          glow(ctx, tx + 8, fy + 2, 12, "hsl(170 100% 60%)", 0.4);
        }
      }
      // giant mushrooms, more and taller every stage
      for (let i = 0; i < 2 + Math.floor(stage / 2); i++) {
        const mx = 80 + ((i * 337 + stage * 53) % (W - 160)), h = 90 + rnd() * 60 + stage * 10, r = 40 + rnd() * 30 + phase * 8;
        ctx.fillStyle = "hsl(40 20% 72%)";
        ctx.fillRect(mx - 7, FLOOR - h, 14, h);
        glow(ctx, mx, FLOOR - h + 6, r * 1.4, "hsl(170 100% 60%)", 0.35);
        ctx.fillStyle = "hsl(322 30% 36%)";
        ctx.beginPath();
        ctx.ellipse(mx, FLOOR - h, r, r * 0.6, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsl(330 40% 82%)";
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(mx + (rnd() - 0.5) * r * 1.2, FLOOR - h - rnd() * r * 0.4 - 4, 3 + rnd() * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // the lair: the canopy above is one enormous cap, its gills glowing down on the fight
      if (phase === 3) {
        ctx.fillStyle = "hsl(318 30% 20%)";
        ctx.beginPath();
        ctx.ellipse(W / 2, -60, W * 0.75, 200, 0, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = "hsl(170 100% 64% / 0.6)";
        ctx.lineWidth = 2;
        for (let i = -16; i <= 16; i++) {
          ctx.beginPath();
          ctx.moveTo(W / 2 + i * 10, 120);
          ctx.lineTo(W / 2 + i * 46, 60);
          ctx.stroke();
        }
      }
      // spores hanging in the air
      for (let i = 0; i < 20 + stage * 6; i++) {
        const sx = rnd() * W, sy = 40 + rnd() * (FLOOR - 60);
        glow(ctx, sx, sy, 4 + rnd() * 5, "hsl(170 100% 70%)", 0.5);
      }
    },
    front(ctx, stage, phase, rnd) {
      // roots across the ground, and small caps growing out of them
      ctx.strokeStyle = "hsl(40 16% 50%)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4 + phase * 2; i++) {
        const y0 = FLOOR - 4 - rnd() * 10;
        ctx.beginPath();
        ctx.moveTo(rnd() * W, y0);
        for (let k = 0; k < 6; k++) ctx.lineTo(rnd() * W, FLOOR - 2 - rnd() * 12);
        ctx.stroke();
      }
      for (let i = 0; i < 6 + stage; i++) {
        const x = rnd() * W;
        ctx.fillStyle = "hsl(316 30% 40%)";
        ctx.beginPath();
        ctx.ellipse(x, FLOOR - 8, 7, 5, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsl(40 20% 76%)";
        ctx.fillRect(x - 1.5, FLOOR - 8, 3, 8);
      }
    },
  },
  // Book 2, 3. The City That Forgets: an old city in fog where buildings fade from the edges as it is forgotten.
  // Each stage more of it is missing, and at the lair only blank white pages are left of the streets.
  {
    sky: [["hsl(36 20% 64%)", "hsl(30 16% 72%)", "hsl(300 20% 80%)"], ["hsl(270 14% 50%)", "hsl(290 14% 62%)", "hsl(310 24% 74%)"], ["hsl(266 20% 28%)", "hsl(280 18% 40%)", "hsl(300 26% 56%)"], ["hsl(270 24% 12%)", "hsl(280 20% 22%)", "hsl(40 20% 86%)"]],
    far: "hsl(270 10% 40%)", near: "hsl(270 12% 30%)", floor: ["hsl(30 10% 46%)", "hsl(270 12% 24%)"], line: "hsl(300 60% 80% / 0.22)", starsFrom: 3, flat: true,
    scene(ctx, stage, phase, rnd) {
      // two rows of rooftops and towers, the far row paler
      for (const [row, col, top] of [[0, `hsl(270 10% ${58 - phase * 8}%)`, 200], [1, `hsl(270 12% ${40 - phase * 6}%)`, 250]] as const) {
        let x = -20;
        while (x < W) {
          const bw = 50 + rnd() * 70, bh = FLOOR - top - rnd() * 110 + row * 30;
          // forgotten buildings fade away from the top, more every stage
          const gone = rnd() < stage * 0.07;
          ctx.fillStyle = col;
          ctx.globalAlpha = gone ? 0.25 : 1;
          ctx.fillRect(x, FLOOR - bh, bw, bh);
          if (rnd() < 0.4) {
            ctx.beginPath();
            ctx.moveTo(x, FLOOR - bh);
            ctx.lineTo(x + bw / 2, FLOOR - bh - 30 - rnd() * 30);
            ctx.lineTo(x + bw, FLOOR - bh);
            ctx.fill();
          }
          ctx.fillStyle = "hsl(44 80% 80% / 0.7)";
          for (let k = 0; k < 4; k++) if (rnd() < 0.5 - phase * 0.12) ctx.fillRect(x + 8 + rnd() * (bw - 20), FLOOR - bh + 14 + rnd() * (bh - 40), 6, 9);
          ctx.globalAlpha = 1;
          x += bw + 6;
        }
      }
      // the erasure: a white wash eating the skyline from both edges inward
      const reach = 40 + stage * 50;
      for (const side of [0, 1]) {
        const g = ctx.createLinearGradient(side ? W : 0, 0, side ? W - reach : reach, 0);
        g.addColorStop(0, "hsl(40 30% 94%)");
        g.addColorStop(1, "hsl(40 30% 94% / 0)");
        ctx.fillStyle = g;
        ctx.fillRect(side ? W - reach : 0, 0, reach, FLOOR);
      }
      // the lair: the middle of the city is a blank page, faint ruled lines where streets were
      if (phase === 3) {
        ctx.fillStyle = "hsl(40 30% 92% / 0.9)";
        ctx.fillRect(W * 0.25, 120, W * 0.5, FLOOR - 120);
        ctx.strokeStyle = "hsl(210 40% 70% / 0.5)";
        ctx.lineWidth = 1.5;
        for (let y = 150; y < FLOOR; y += 22) {
          ctx.beginPath();
          ctx.moveTo(W * 0.25, y);
          ctx.lineTo(W * 0.75, y);
          ctx.stroke();
        }
        ctx.strokeStyle = "hsl(0 70% 60% / 0.5)";
        ctx.beginPath();
        ctx.moveTo(W * 0.31, 120);
        ctx.lineTo(W * 0.31, FLOOR);
        ctx.stroke();
      }
      // fog, thicker as the chapter goes on
      for (let i = 0; i < 4 + phase * 2; i++) {
        ctx.fillStyle = `hsl(300 20% 90% / ${0.08 + phase * 0.03})`;
        ctx.beginPath();
        ctx.ellipse(rnd() * W, 300 + rnd() * 120, 200 + rnd() * 160, 30 + rnd() * 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    front(ctx, stage, phase, rnd) {
      // cobbles and street lamps; lamps that were forgotten are only outlines
      ctx.fillStyle = INK;
      for (let i = 0; i < 4; i++) {
        const x = 120 + i * 260 + rnd() * 30;
        const lost = i < Math.floor(stage / 2);
        if (lost) {
          ctx.strokeStyle = "hsl(300 40% 80% / 0.5)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - 2, FLOOR - 110, 4, 110);
          ctx.strokeRect(x - 8, FLOOR - 124, 16, 14);
        } else {
          ctx.fillRect(x - 2, FLOOR - 110, 4, 110);
          ctx.fillRect(x - 8, FLOOR - 124, 16, 14);
          if (phase < 3) glow(ctx, x, FLOOR - 117, 36, "hsl(44 100% 74%)", 0.55);
        }
      }
    },
  },
  // Book 2, 4. The Moth Moon: a mountain observatory under a huge low moon. Moths crowd the moon a little more every
  // stage until, at the lair, the Dustmoth's wings cover it and only its rim still shines.
  {
    sky: [["hsl(226 40% 18%)", "hsl(220 34% 28%)", "hsl(210 30% 44%)"], ["hsl(230 44% 12%)", "hsl(224 36% 20%)", "hsl(212 34% 34%)"], ["hsl(234 50% 8%)", "hsl(228 40% 14%)", "hsl(216 40% 24%)"], ["hsl(236 60% 4%)", "hsl(232 46% 8%)", "hsl(220 40% 14%)"]],
    far: "hsl(226 22% 18%)", near: "hsl(226 20% 12%)", floor: ["hsl(30 8% 30%)", "hsl(226 16% 14%)"], line: "hsl(208 100% 84% / 0.22)", starsFrom: 0,
    scene(ctx, stage, phase, rnd) {
      // the moon, huge and low
      const mx = W * 0.62, my = 170, mr = 120;
      glow(ctx, mx, my, mr * 2, "hsl(208 100% 84%)", phase === 3 ? 0.2 : 0.4);
      ctx.fillStyle = phase === 3 ? "hsl(230 40% 8%)" : "hsl(210 40% 88%)";
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      if (phase < 3) {
        ctx.fillStyle = "hsl(210 20% 74% / 0.6)";
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.arc(mx + (rnd() - 0.5) * mr * 1.3, my + (rnd() - 0.5) * mr * 1.3, 8 + rnd() * 18, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // the lair: great wings across the moon, only its rim still lit
        ctx.strokeStyle = "hsl(208 100% 86%)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "hsl(32 14% 18%)";
        for (const dir of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(mx, my + 10);
          ctx.bezierCurveTo(mx + dir * 120, my - 200, mx + dir * 320, my - 120, mx + dir * 280, my + 40);
          ctx.quadraticCurveTo(mx + dir * 160, my + 120, mx, my + 10);
          ctx.fill();
          ctx.fillStyle = "hsl(40 80% 56%)";
          ctx.beginPath();
          ctx.arc(mx + dir * 180, my - 30, 30, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "hsl(230 30% 8%)";
          ctx.beginPath();
          ctx.arc(mx + dir * 180, my - 30, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "hsl(32 14% 18%)";
        }
      }
      // moths crowding round the moon, more every stage
      ctx.fillStyle = "hsl(30 14% 22%)";
      for (let i = 0; i < 6 + stage * 5; i++) {
        const a = rnd() * Math.PI * 2, r = mr * (0.6 + rnd() * 0.9);
        const x = mx + Math.cos(a) * r, y = my + Math.sin(a) * r, w = 4 + rnd() * 5;
        ctx.beginPath();
        ctx.ellipse(x - w * 0.6, y, w, w * 0.6, -0.5, 0, Math.PI * 2);
        ctx.ellipse(x + w * 0.6, y, w, w * 0.6, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // the observatory dome on the far ridge
      ctx.fillStyle = "hsl(226 20% 20%)";
      ctx.fillRect(140, 250, 90, 60);
      ctx.beginPath();
      ctx.arc(185, 250, 45, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase < 2 ? "hsl(44 90% 70%)" : "hsl(226 20% 12%)";
      ctx.fillRect(176, 214, 18, 30);
    },
    front(ctx, stage, phase, rnd) {
      // dust drifting down over everything, heavier every stage
      for (let i = 0; i < 30 + stage * 12; i++) {
        ctx.fillStyle = `hsl(40 30% 80% / ${0.2 + rnd() * 0.4})`;
        ctx.fillRect(rnd() * W, rnd() * FLOOR, 2, 2);
      }
      // broken telescopes and rails along the terrace
      ctx.fillStyle = INK;
      ctx.fillRect(0, FLOOR - 30, W, 6);
      for (let x = 30; x < W; x += 110) ctx.fillRect(x, FLOOR - 26, 6, 26);
      for (let i = 0; i < 2; i++) {
        const x = 260 + i * 460;
        ctx.save();
        ctx.translate(x, FLOOR - 40);
        ctx.rotate(-0.6 - (phase >= 2 ? 0.5 : 0) * (i ? 1 : -1));
        ctx.fillRect(-6, -40, 12, 50);
        ctx.restore();
        ctx.fillRect(x - 3, FLOOR - 40, 6, 40);
      }
    },
  },
  // Book 2, 5. The Sleeping Valley: windmills and cottages under a violet sky with ribbons of gold dream light.
  // Every stage more dream bubbles float up out of the chimneys, and at the lair a huge eye in the sky opens.
  {
    sky: [["hsl(262 34% 30%)", "hsl(280 30% 44%)", "hsl(36 70% 70%)"], ["hsl(256 36% 22%)", "hsl(270 30% 34%)", "hsl(30 50% 54%)"], ["hsl(250 40% 14%)", "hsl(262 34% 22%)", "hsl(280 30% 34%)"], ["hsl(248 50% 6%)", "hsl(254 40% 12%)", "hsl(262 36% 20%)"]],
    far: "hsl(256 24% 24%)", near: "hsl(252 24% 16%)", floor: ["hsl(256 18% 30%)", "hsl(252 24% 14%)"], line: "hsl(46 100% 74% / 0.22)", starsFrom: 1,
    scene(ctx, stage, phase, rnd) {
      // ribbons of dream light drifting across the sky
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `hsl(46 100% 74% / ${0.14 + phase * 0.05})`;
        ctx.lineWidth = 14 - i * 3;
        ctx.beginPath();
        const y0 = 90 + i * 50 + rnd() * 20;
        ctx.moveTo(-20, y0);
        for (let x = 0; x <= W + 20; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 0.008 + i * 2) * 26);
        ctx.stroke();
      }
      if (phase === 3) {
        // the lair: the sky itself opens one huge gold eye
        const ex = W * 0.5, ey = 150;
        glow(ctx, ex, ey, 260, "hsl(46 100% 70%)", 0.35);
        ctx.fillStyle = "hsl(250 50% 6%)";
        ctx.strokeStyle = "hsl(46 100% 74%)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ex - 230, ey);
        ctx.quadraticCurveTo(ex, ey - 130, ex + 230, ey);
        ctx.quadraticCurveTo(ex, ey + 130, ex - 230, ey);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "hsl(46 100% 66%)";
        ctx.beginPath();
        ctx.arc(ex, ey, 56, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsl(250 50% 6%)";
        ctx.beginPath();
        ctx.ellipse(ex, ey, 10, 48, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // a sleepy crescent moon, lower every part of the chapter
        const my = 90 + phase * 40;
        glow(ctx, 160, my, 80, "hsl(46 100% 80%)", 0.4);
        ctx.fillStyle = "hsl(46 90% 84%)";
        ctx.beginPath();
        ctx.arc(160, my, 30, 0, Math.PI * 2);
        ctx.arc(172, my - 8, 26, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
      }
      // windmills on the far hills, sails turning slower each stage until they stop
      for (let i = 0; i < 3; i++) {
        const x = 260 + i * 260 + rnd() * 60, y = 300 - rnd() * 30;
        ctx.fillStyle = "hsl(256 24% 20%)";
        ctx.beginPath();
        ctx.moveTo(x - 14, y + 70);
        ctx.lineTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.lineTo(x + 14, y + 70);
        ctx.fill();
        ctx.strokeStyle = "hsl(256 24% 20%)";
        ctx.lineWidth = 5;
        const turn = rnd() * Math.PI;
        for (let k = 0; k < 4; k++) {
          const a = turn + (k * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
          ctx.stroke();
        }
      }
    },
    front(ctx, stage, phase, rnd) {
      // cottages, their windows going dark as the valley falls asleep
      for (let i = 0; i < 5; i++) {
        const x = 40 + i * 210 + rnd() * 60, w = 70 + rnd() * 30, h = 50 + rnd() * 20;
        ctx.fillStyle = INK;
        ctx.fillRect(x, FLOOR - 40 - h, w, h + 40);
        ctx.beginPath();
        ctx.moveTo(x - 8, FLOOR - 40 - h);
        ctx.lineTo(x + w / 2, FLOOR - 80 - h);
        ctx.lineTo(x + w + 8, FLOOR - 40 - h);
        ctx.fill();
        const lit = i >= stage * 0.6 && phase < 3;
        ctx.fillStyle = lit ? "hsl(42 100% 66%)" : "hsl(250 30% 22%)";
        ctx.fillRect(x + 14, FLOOR - 30 - h, 14, 14);
        ctx.fillRect(x + w - 28, FLOOR - 30 - h, 14, 14);
      }
      // dream bubbles floating up, more every stage
      for (let i = 0; i < 4 + stage * 3; i++) {
        const x = rnd() * W, y = 60 + rnd() * (FLOOR - 160), r = 5 + rnd() * 12;
        ctx.strokeStyle = `hsl(${rnd() > 0.5 ? 46 : 270} 100% 82% / 0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "hsl(0 0% 100% / 0.4)";
        ctx.fillRect(x - r * 0.4, y - r * 0.5, 2, 2);
      }
    },
  },
  // Book 2, 6. The Silent Bells: a city of bell towers on sea cliffs under a red dusk. Every stage another bell
  // has fallen silent and its tower gone dark, and at the lair the great bell hangs cracked in a black sky.
  {
    sky: [["hsl(10 40% 34%)", "hsl(20 50% 50%)", "hsl(36 70% 70%)"], ["hsl(356 36% 24%)", "hsl(8 44% 38%)", "hsl(24 60% 56%)"], ["hsl(350 40% 14%)", "hsl(356 40% 22%)", "hsl(4 44% 36%)"], ["hsl(350 40% 5%)", "hsl(352 36% 9%)", "hsl(354 50% 18%)"]],
    far: "hsl(350 16% 18%)", near: "hsl(350 16% 11%)", floor: ["hsl(30 12% 28%)", "hsl(350 14% 12%)"], line: "hsl(354 90% 66% / 0.22)", starsFrom: 2,
    scene(ctx, stage, phase, rnd) {
      // the sea far below the cliffs
      ctx.fillStyle = phase === 3 ? "hsl(350 30% 8%)" : "hsl(356 30% 24%)";
      ctx.fillRect(0, 300, W, 40);
      if (phase === 3) {
        // the lair: the great bell hanging cracked in the sky, red light spilling from its mouth
        const bx = W * 0.5, by = 150;
        glow(ctx, bx, by + 80, 200, "hsl(354 100% 60%)", 0.4);
        ctx.strokeStyle = "hsl(350 10% 6%)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, by - 70);
        ctx.stroke();
        ctx.fillStyle = "hsl(30 30% 22%)";
        ctx.beginPath();
        ctx.moveTo(bx - 40, by - 70);
        ctx.quadraticCurveTo(bx - 60, by, bx - 110, by + 70);
        ctx.lineTo(bx + 110, by + 70);
        ctx.quadraticCurveTo(bx + 60, by, bx + 40, by - 70);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "hsl(350 40% 4%)";
        ctx.beginPath();
        ctx.ellipse(bx, by + 70, 110, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "hsl(354 100% 66%)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + 10, by - 66);
        ctx.lineTo(bx + 24, by - 10);
        ctx.lineTo(bx + 8, by + 20);
        ctx.lineTo(bx + 30, by + 66);
        ctx.stroke();
      } else {
        // a low red sun sinking into the sea
        glow(ctx, W * 0.72, 290, 160, "hsl(14 100% 66%)", 0.5);
        ctx.fillStyle = "hsl(16 90% 66%)";
        ctx.beginPath();
        ctx.arc(W * 0.72, 300 + phase * 10, 50, Math.PI, Math.PI * 2);
        ctx.fill();
      }
      // bell towers along the cliffs, a little light in each one still ringing
      for (let i = 0; i < 7; i++) {
        const x = 40 + i * 150 + rnd() * 40, h = 120 + rnd() * 90, w = 34 + rnd() * 14;
        ctx.fillStyle = "hsl(350 16% 16%)";
        ctx.fillRect(x - w / 2, 340 - h, w, h);
        ctx.beginPath();
        ctx.moveTo(x - w / 2 - 4, 340 - h);
        ctx.lineTo(x, 340 - h - 40);
        ctx.lineTo(x + w / 2 + 4, 340 - h);
        ctx.fill();
        const ringing = i >= stage;
        ctx.fillStyle = ringing && phase < 3 ? "hsl(40 90% 64%)" : "hsl(350 20% 8%)";
        ctx.beginPath();
        ctx.arc(x, 340 - h + 20, 8, Math.PI, Math.PI * 2);
        ctx.lineTo(x + 10, 340 - h + 28);
        ctx.lineTo(x - 10, 340 - h + 28);
        ctx.fill();
      }
    },
    front(ctx, stage, phase, rnd) {
      // the square's wall, and fallen bells lying in the street, more every stage
      ctx.fillStyle = INK;
      ctx.fillRect(0, FLOOR - 26, W, 6);
      for (let x = 20; x < W; x += 90) ctx.fillRect(x, FLOOR - 26, 8, 26);
      for (let i = 0; i < 1 + Math.floor(stage / 2); i++) {
        const x = 60 + rnd() * (W - 120), r = 18 + rnd() * 16;
        ctx.save();
        ctx.translate(x, FLOOR - r * 0.6);
        ctx.rotate(rnd() > 0.5 ? 1.4 : -1.4);
        ctx.fillStyle = "hsl(30 30% 24%)";
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r);
        ctx.quadraticCurveTo(-r * 0.6, 0, -r, r * 0.6);
        ctx.lineTo(r, r * 0.6);
        ctx.quadraticCurveTo(r * 0.6, 0, r * 0.4, -r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // red threads of stolen voices hanging in the air near the end
      if (phase >= 2) {
        ctx.strokeStyle = "hsl(354 100% 70% / 0.35)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 8 + stage; i++) {
          const x = rnd() * W;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.quadraticCurveTo(x + (rnd() - 0.5) * 80, 160, x + (rnd() - 0.5) * 40, 260 + rnd() * 80);
          ctx.stroke();
        }
      }
    },
  },
  // Book 2, 7. The Elder Dark: broken ground floating up into a sky with no stars left in it. Every stage the crack
  // in the sky is wider and more arms of the dark reach out of it, and at the lair one enormous eye fills the crack.
  {
    sky: [["hsl(258 40% 16%)", "hsl(268 34% 26%)", "hsl(160 30% 30%)"], ["hsl(260 44% 11%)", "hsl(266 36% 18%)", "hsl(160 36% 22%)"], ["hsl(262 50% 7%)", "hsl(264 40% 12%)", "hsl(156 40% 16%)"], ["hsl(262 60% 3%)", "hsl(262 50% 6%)", "hsl(150 50% 10%)"]],
    far: "hsl(260 24% 12%)", near: "hsl(260 26% 8%)", floor: ["hsl(262 16% 20%)", "hsl(262 30% 7%)"], line: "hsl(268 100% 78% / 0.24)", starsFrom: 0,
    scene(ctx, stage, phase, rnd) {
      // the crack in the sky, wider every stage
      const open = 0.25 + stage * 0.09;
      const cx = W * 0.55, cy = 140;
      glow(ctx, cx, cy, 160 + stage * 20, "hsl(150 100% 50%)", 0.3);
      ctx.fillStyle = "hsl(262 60% 2%)";
      ctx.strokeStyle = "hsl(268 100% 78%)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const pts = 12;
      for (let i = 0; i <= pts; i++) {
        const x = cx - 300 + (600 / pts) * i;
        ctx.lineTo(x, cy - (i % 2 ? 18 : 40) * open - Math.sin((i / pts) * Math.PI) * 70 * open);
      }
      for (let i = pts; i >= 0; i--) {
        const x = cx - 300 + (600 / pts) * i;
        ctx.lineTo(x, cy + (i % 2 ? 22 : 36) * open + Math.sin((i / pts) * Math.PI) * 70 * open);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (phase === 3) {
        // the lair: one enormous eye fills the crack
        ctx.fillStyle = "hsl(150 100% 52%)";
        ctx.beginPath();
        ctx.arc(cx, cy, 74, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsl(262 60% 2%)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 13, 66, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "hsl(0 0% 100% / 0.8)";
        ctx.beginPath();
        ctx.arc(cx - 26, cy - 26, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // dead stars caught in the crack
        ctx.fillStyle = "hsl(268 100% 86%)";
        for (let i = 0; i < 10; i++) ctx.fillRect(cx - 200 + rnd() * 400, cy - 20 + rnd() * 40, 2, 2);
      }
      // arms of the dark reaching out of the crack, more every stage
      ctx.lineCap = "round";
      for (let i = 0; i < 1 + stage; i++) {
        const sx = cx - 240 + rnd() * 480, sy = cy + (rnd() - 0.5) * 40;
        const ex = sx + (rnd() - 0.5) * 400, ey = sy + 60 + rnd() * 160;
        ctx.strokeStyle = "hsl(262 50% 5%)";
        ctx.lineWidth = 10 + rnd() * 8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + ex) / 2 + (rnd() - 0.5) * 160, (sy + ey) / 2, ex, ey);
        ctx.stroke();
        ctx.strokeStyle = "hsl(268 100% 74% / 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // chunks of the world floating up toward it
      for (let i = 0; i < 6; i++) {
        const x = rnd() * W, y = 220 + rnd() * 100, w = 30 + rnd() * 60;
        ctx.fillStyle = "hsl(262 20% 14%)";
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x + w / 2, y);
        ctx.lineTo(x + w * 0.2, y + w * 0.6);
        ctx.lineTo(x - w * 0.1, y + w * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    },
    front(ctx, stage, phase, rnd) {
      // broken pillars of an old temple, the last thing standing between the world and the dark
      ctx.fillStyle = INK;
      for (let i = 0; i < 5; i++) {
        const x = 60 + i * 220 + rnd() * 40, h = 60 + rnd() * 120;
        ctx.fillRect(x - 12, FLOOR - h, 24, h);
        ctx.fillRect(x - 18, FLOOR - h - 8, 36, 10);
      }
      // starlight specks drifting up into the crack
      for (let i = 0; i < 20 + stage * 6; i++) {
        ctx.fillStyle = `hsl(${rnd() > 0.7 ? 150 : 268} 100% 82% / ${0.3 + rnd() * 0.5})`;
        ctx.fillRect(rnd() * W, rnd() * FLOOR, 2, 2);
      }
    },
  },
  // Book 3, 1. The Falling Star: snowfields in the far north under a comet that comes closer every stage, until at
  // the lair its head fills the sky and pieces of it lie burning blue in the snow.
  {
    sky: [["hsl(208 60% 70%)", "hsl(200 50% 84%)", "hsl(340 60% 88%)"], ["hsl(206 64% 52%)", "hsl(200 54% 70%)", "hsl(196 40% 86%)"], ["hsl(222 50% 22%)", "hsl(214 44% 36%)", "hsl(24 70% 62%)"], ["hsl(218 60% 5%)", "hsl(206 60% 16%)", "hsl(190 80% 40%)"]],
    far: "hsl(214 24% 62%)", near: "hsl(210 30% 78%)", floor: ["hsl(206 40% 90%)", "hsl(210 30% 72%)"], line: "hsl(210 30% 56% / 0.45)", starsFrom: 2,
    scene(ctx, stage, phase, rnd) {
      // far peaks under snow
      for (let i = 0; i < 6; i++) {
        const x = i * 190 - 40 + rnd() * 60, h = 120 + rnd() * 80;
        ctx.fillStyle = "hsl(216 20% 52%)";
        ctx.beginPath();
        ctx.moveTo(x - 130, 330);
        ctx.lineTo(x, 330 - h);
        ctx.lineTo(x + 130, 330);
        ctx.fill();
        ctx.fillStyle = "hsl(206 40% 92%)";
        ctx.beginPath();
        ctx.moveTo(x - 38, 330 - h + 34);
        ctx.lineTo(x, 330 - h);
        ctx.lineTo(x + 38, 330 - h + 34);
        ctx.lineTo(x + 12, 330 - h + 26);
        ctx.lineTo(x - 10, 330 - h + 36);
        ctx.fill();
      }
      // meteors breaking off ahead of it, more every stage
      for (let i = 0; i < stage * 2; i++) {
        const mx = rnd() * W, my = 30 + rnd() * 200, len = 40 + rnd() * 60;
        ctx.strokeStyle = "hsl(196 100% 86% / 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + len * 0.8, my - len * 0.5);
        ctx.stroke();
      }
      // the comet: closer, bigger and brighter with every stage
      const k = stage / 7;
      const cx = 700 - k * 220, cy = 120 + k * 30, r = 6 + k * 34;
      const len = 180 + k * 520;
      for (const [w, col] of [[r * 2.6, "hsl(205 100% 66%)"], [r * 1.4, "hsl(190 100% 82%)"], [r * 0.5, "hsl(0 0% 100%)"]] as const) {
        const g = ctx.createLinearGradient(cx, cy, cx + len, cy - len * 0.42);
        g.addColorStop(0, col.replace(")", " / 0.85)"));
        g.addColorStop(1, col.replace(")", " / 0)"));
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + len * 0.5, cy - len * 0.16, cx + len, cy - len * 0.42);
        ctx.stroke();
      }
      glow(ctx, cx, cy, r * 4, "hsl(190 100% 80%)", 0.7 + phase * 0.08);
      ctx.fillStyle = "hsl(0 0% 100%)";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // at the lair the whole sky is lit by it
      if (phase === 3) glow(ctx, cx, cy, 520, "hsl(190 100% 70%)", 0.25);
    },
    front(ctx, stage, phase, rnd) {
      // snowy pines along both edges
      for (let i = 0; i < 14; i++) {
        const left = i < 7, x = left ? rnd() * 230 : W - rnd() * 230, h = 60 + rnd() * 90, w = h * 0.38;
        ctx.fillStyle = phase >= 2 ? "hsl(214 30% 16%)" : "hsl(190 26% 26%)";
        ctx.beginPath();
        ctx.moveTo(x - w, FLOOR);
        ctx.lineTo(x, FLOOR - h);
        ctx.lineTo(x + w, FLOOR);
        ctx.fill();
        ctx.fillStyle = "hsl(206 40% 94% / 0.9)";
        ctx.beginPath();
        ctx.moveTo(x - w * 0.36, FLOOR - h * 0.64);
        ctx.lineTo(x, FLOOR - h);
        ctx.lineTo(x + w * 0.36, FLOOR - h * 0.64);
        ctx.fill();
      }
      // pieces of the comet stuck in the snow, still burning blue
      for (let i = 0; i < Math.max(0, stage - 1) * 2; i++) {
        const x = 220 + rnd() * 520, h = 16 + rnd() * 30;
        glow(ctx, x, FLOOR - h * 0.4, h * 1.6, "hsl(190 100% 72%)", 0.6);
        ctx.fillStyle = "hsl(196 70% 84%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - h * 0.3, FLOOR);
        ctx.lineTo(x - h * 0.1, FLOOR - h);
        ctx.lineTo(x + h * 0.35, FLOOR - h * 0.6);
        ctx.lineTo(x + h * 0.3, FLOOR);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },
  },
  // Book 3, 2. The Hunter in the Stars: a high plateau ringed with standing stones. Each stage another line of the
  // Hunter's constellation is drawn across the sky, until at the lair the whole figure burns gold over the stones.
  {
    sky: [["hsl(256 44% 26%)", "hsl(290 30% 40%)", "hsl(20 60% 62%)"], ["hsl(232 56% 14%)", "hsl(240 40% 24%)", "hsl(260 30% 38%)"], ["hsl(234 64% 8%)", "hsl(238 50% 16%)", "hsl(250 40% 26%)"], ["hsl(236 70% 4%)", "hsl(232 60% 10%)", "hsl(40 60% 30%)"]],
    far: "hsl(236 24% 22%)", near: "hsl(234 22% 14%)", floor: ["hsl(232 14% 34%)", "hsl(232 16% 22%)"], line: "hsl(44 60% 70% / 0.25)", starsFrom: 0,
    scene(ctx, stage, phase, rnd) {
      // the Milky Way: a soft band of light across the sky
      for (let i = 0; i < 9; i++) glow(ctx, 80 + i * 110, 300 - i * 30 + (rnd() - 0.5) * 30, 120, "hsl(230 60% 80%)", 0.12);
      for (let i = 0; i < 160; i++) {
        const u = rnd();
        ctx.fillStyle = `hsl(${rnd() < 0.5 ? 44 : 220} 80% 90% / ${0.3 + rnd() * 0.6})`;
        ctx.fillRect(80 + u * 880 + (rnd() - 0.5) * 120, 300 - u * 240 + (rnd() - 0.5) * 80, 1.5, 1.5);
      }
      // the Hunter's constellation, one more pair of lines every stage
      const pts: [number, number][] = [[480, 60], [440, 100], [520, 100], [570, 70], [600, 30], [400, 140], [380, 190], [460, 190], [480, 194], [500, 198], [450, 260], [520, 260], [430, 320], [540, 320]];
      const lines: [number, number][] = [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [1, 7], [2, 9], [7, 8], [8, 9], [7, 10], [9, 11], [10, 12], [11, 13]];
      const shown = phase === 3 ? lines.length : Math.min(lines.length, 2 + stage * 2);
      if (phase === 3) glow(ctx, 480, 190, 260, "hsl(44 100% 70%)", 0.3);
      ctx.strokeStyle = phase === 3 ? "hsl(44 100% 80% / 0.8)" : "hsl(44 100% 80% / 0.45)";
      ctx.lineWidth = phase === 3 ? 2.5 : 1.5;
      ctx.beginPath();
      for (const [a, b] of lines.slice(0, shown)) {
        ctx.moveTo(pts[a][0], pts[a][1]);
        ctx.lineTo(pts[b][0], pts[b][1]);
      }
      ctx.stroke();
      for (const [x, y] of pts) {
        glow(ctx, x, y, 14, "hsl(44 100% 80%)", 0.7);
        ctx.fillStyle = "hsl(48 100% 94%)";
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
      // the other beasts of the sky waking up behind it
      if (stage >= 4) {
        const bull: [number, number][] = [[140, 80], [190, 110], [240, 100], [280, 140], [210, 150], [170, 130]];
        ctx.strokeStyle = "hsl(220 90% 84% / 0.4)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        bull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        for (const [x, y] of bull) {
          ctx.fillStyle = "hsl(220 90% 92%)";
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
    },
    front(ctx, stage, phase, rnd) {
      // a ring of standing stones, the far ones small, star marks carved into them glowing as night falls
      for (let i = 0; i < 9; i++) {
        const x = 40 + i * 112 + (rnd() - 0.5) * 30;
        const near = i === 0 || i === 8 || i === 1 || i === 7;
        const h = near ? 120 + rnd() * 50 : 60 + rnd() * 30, w = near ? 34 : 20;
        ctx.fillStyle = near ? "hsl(232 12% 26%)" : "hsl(234 14% 30%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, FLOOR);
        ctx.lineTo(x - w / 2 + 3, FLOOR - h);
        ctx.lineTo(x + w / 2 - 2, FLOOR - h - 4);
        ctx.lineTo(x + w / 2, FLOOR);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (phase >= 1) {
          glow(ctx, x, FLOOR - h * 0.6, w, "hsl(44 100% 70%)", 0.25 + phase * 0.12);
          ctx.fillStyle = `hsl(44 100% 80% / ${0.4 + phase * 0.15})`;
          ctx.fillRect(x - 2, FLOOR - h * 0.6 - 2, 4, 4);
          ctx.fillRect(x - 6, FLOOR - h * 0.6 + 6, 3, 3);
          ctx.fillRect(x + 4, FLOOR - h * 0.6 + 9, 3, 3);
        }
      }
    },
  },
  // Book 3, 3. Where Stars Are Born: the white salt of the Mirror Flats, far in the south. A nebula of rose and green
  // gas sinks lower over it every stage, new stars switching on inside, until at the lair the whole sky is her cloud.
  {
    sky: [["hsl(280 40% 46%)", "hsl(320 50% 72%)", "hsl(30 80% 82%)"], ["hsl(250 40% 34%)", "hsl(300 40% 52%)", "hsl(340 60% 76%)"], ["hsl(270 50% 16%)", "hsl(300 44% 30%)", "hsl(326 50% 50%)"], ["hsl(296 60% 6%)", "hsl(310 50% 16%)", "hsl(172 50% 30%)"]],
    far: "hsl(300 16% 54%)", near: "hsl(320 20% 80%)", floor: ["hsl(320 30% 90%)", "hsl(300 18% 68%)"], line: "hsl(300 30% 50% / 0.3)", starsFrom: 1, flat: true,
    scene(ctx, stage, phase, rnd) {
      // the nebula, lower, wider and brighter every stage
      const k = stage / 7;
      const cy = 150 - k * 30 + (phase === 3 ? -20 : 0);
      for (let i = 0; i < 10 + stage * 2; i++) {
        const x = 480 + (rnd() - 0.5) * (360 + k * 640), y = cy + (rnd() - 0.5) * (120 + k * 140);
        glow(ctx, x, y, 70 + rnd() * 90 + k * 50, rnd() < 0.5 ? "hsl(326 100% 66%)" : "hsl(172 90% 56%)", 0.14 + k * 0.12);
      }
      // dark threads of dust through the gas
      ctx.strokeStyle = `hsl(300 40% 10% / ${0.25 + k * 0.2})`;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const x = 300 + rnd() * 360, y = cy - 40 + rnd() * 80;
        ctx.beginPath();
        ctx.moveTo(x - 160, y + 20);
        ctx.quadraticCurveTo(x, y - 40 + rnd() * 80, x + 170, y + 10);
        ctx.stroke();
      }
      // new stars being born in it, more every stage
      for (let i = 0; i < 6 + stage * 4; i++) {
        const x = 480 + (rnd() - 0.5) * (300 + k * 600), y = cy + (rnd() - 0.5) * (100 + k * 120);
        glow(ctx, x, y, 8 + rnd() * 8, "hsl(48 100% 94%)", 0.8);
        ctx.fillStyle = "hsl(48 100% 97%)";
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      // at the lair, the Star Mother's heart burns in the middle of the cloud
      if (phase === 3) {
        glow(ctx, 480, cy, 260, "hsl(326 100% 70%)", 0.4);
        glow(ctx, 480, cy, 60, "hsl(48 100% 96%)", 0.9);
      }
      // low far mesas on the horizon, flat-topped and violet
      ctx.fillStyle = phase >= 2 ? "hsl(290 20% 22%)" : "hsl(300 16% 54%)";
      for (let i = 0; i < 5; i++) {
        const x = rnd() * W, w = 80 + rnd() * 120, h = 20 + rnd() * 30;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.6, FLOOR - 40);
        ctx.lineTo(x - w * 0.4, FLOOR - 40 - h);
        ctx.lineTo(x + w * 0.4, FLOOR - 40 - h);
        ctx.lineTo(x + w * 0.6, FLOOR - 40);
        ctx.fill();
      }
    },
    front(ctx, stage, phase, rnd) {
      // the salt itself: a flat white plain that holds the sky like a mirror
      const salt = ctx.createLinearGradient(0, FLOOR - 40, 0, FLOOR);
      salt.addColorStop(0, phase >= 2 ? "hsl(300 30% 34%)" : "hsl(320 30% 84%)");
      salt.addColorStop(1, phase >= 2 ? "hsl(310 30% 46%)" : "hsl(320 30% 90%)");
      ctx.fillStyle = salt;
      ctx.fillRect(0, FLOOR - 40, W, 40);
      // the nebula's reflection lying in the salt
      glow(ctx, 480, FLOOR - 16, 200 + stage * 30, "hsl(326 100% 70%)", 0.18 + stage * 0.04);
      glow(ctx, 420, FLOOR - 10, 120 + stage * 20, "hsl(172 90% 60%)", 0.12 + stage * 0.03);
      // the cracked hexagon crust of the flats
      ctx.strokeStyle = phase >= 2 ? "hsl(300 30% 60% / 0.4)" : "hsl(300 20% 70% / 0.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const x = rnd() * W, y = FLOOR - 34 + rnd() * 30, r = 10 + rnd() * 10;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.3);
          else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.3);
        }
        ctx.closePath();
        ctx.stroke();
      }
      // salt mounds along the edges, and little fallen newborn stars glowing on the salt from the third stage on
      for (let i = 0; i < 8; i++) {
        const left = i < 4, x = left ? rnd() * 200 : W - rnd() * 200, h = 24 + rnd() * 40, w = h * 1.1;
        ctx.fillStyle = phase >= 2 ? "hsl(300 18% 40%)" : "hsl(320 24% 92%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - w, FLOOR);
        ctx.quadraticCurveTo(x, FLOOR - h * 1.6, x + w, FLOOR);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      for (let i = 0; i < Math.max(0, stage - 2) * 2; i++) {
        const x = 200 + rnd() * 560, y = FLOOR - 4 - rnd() * 26;
        glow(ctx, x, y, 18, rnd() < 0.5 ? "hsl(326 100% 76%)" : "hsl(172 100% 70%)", 0.7);
        ctx.fillStyle = "hsl(48 100% 96%)";
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    },
  },
  // Book 3, 4. The Spinning Heart: the Glasslands, a desert in the east where the pulsar's beams have swept the dunes
  // into glass. Its point of light climbs higher every stage, the beams sweep wider, and more of the sand turns to glass.
  {
    sky: [["hsl(30 70% 64%)", "hsl(36 80% 76%)", "hsl(44 90% 86%)"], ["hsl(206 50% 56%)", "hsl(36 60% 76%)", "hsl(40 80% 84%)"], ["hsl(256 40% 22%)", "hsl(300 30% 36%)", "hsl(24 80% 58%)"], ["hsl(250 50% 5%)", "hsl(256 40% 12%)", "hsl(276 50% 26%)"]],
    far: "hsl(32 40% 62%)", near: "hsl(36 50% 72%)", floor: ["hsl(38 50% 74%)", "hsl(30 36% 54%)"], line: "hsl(30 40% 40% / 0.35)", starsFrom: 2,
    scene(ctx, stage, phase, rnd) {
      const k = stage / 7;
      // the pulsar: a hard point of light, higher and brighter every stage
      const px = 640 - k * 160, py = 220 - k * 120;
      // its beams, sweeping a little further round every stage
      const a0 = -0.4 - k * 1.6;
      for (const a of [a0, a0 + Math.PI]) {
        const len = 700, w = 18 + k * 22;
        const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len;
        const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
        const g = ctx.createLinearGradient(px, py, ex, ey);
        g.addColorStop(0, `hsl(40 100% 86% / ${0.35 + phase * 0.12})`);
        g.addColorStop(1, "hsl(32 100% 60% / 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ex + nx, ey + ny);
        ctx.lineTo(ex - nx, ey - ny);
        ctx.closePath();
        ctx.fill();
      }
      glow(ctx, px, py, 30 + k * 40, "hsl(36 100% 76%)", 0.6 + phase * 0.1);
      ctx.fillStyle = "hsl(48 100% 97%)";
      ctx.beginPath();
      ctx.arc(px, py, 3 + k * 4, 0, Math.PI * 2);
      ctx.fill();
      // its field at the lair: violet arcs out of the poles across the sky
      if (phase === 3) {
        ctx.strokeStyle = "hsl(276 100% 74% / 0.35)";
        ctx.lineWidth = 2;
        for (let i = 1; i <= 4; i++) {
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(px, py - 6);
            ctx.bezierCurveTo(px + side * i * 60, py - i * 80, px + side * i * 60, py + i * 80, px, py + 6);
            ctx.stroke();
          }
        }
        glow(ctx, px, py, 240, "hsl(32 100% 66%)", 0.22);
      }
      // the dunes far off, glinting where the beam has crossed them
      ctx.fillStyle = phase >= 2 ? "hsl(270 20% 30%)" : "hsl(34 44% 66%)";
      ctx.beginPath();
      ctx.moveTo(0, 330);
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x, 300 - Math.sin(x * 0.008 + stage) * 26 - Math.sin(x * 0.02) * 10);
      ctx.lineTo(W, 330);
      ctx.fill();
      for (let i = 0; i < 4 + stage * 2; i++) {
        const x = rnd() * W, y = 296 + rnd() * 30;
        glow(ctx, x, y, 10, "hsl(44 100% 90%)", 0.6);
      }
    },
    front(ctx, stage, phase, rnd) {
      // streaks of glass the beam left across the sand, more each stage
      for (let i = 0; i < 2 + stage; i++) {
        const y = 392 + rnd() * 40, x = rnd() * W, len = 120 + rnd() * 220;
        const g = ctx.createLinearGradient(x, y, x + len, y);
        g.addColorStop(0, "hsl(36 70% 84% / 0)");
        g.addColorStop(0.5, phase >= 2 ? "hsl(276 60% 70% / 0.55)" : "hsl(40 80% 90% / 0.7)");
        g.addColorStop(1, "hsl(36 70% 84% / 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, len, 4);
      }
      // spires of glass standing up out of the sand along both edges, lit amber from inside as night falls
      for (let i = 0; i < 10; i++) {
        const left = i < 5, x = left ? 20 + rnd() * 220 : W - 20 - rnd() * 220, h = 40 + rnd() * 110, w = 8 + rnd() * 14;
        const lean = (rnd() - 0.5) * 20;
        ctx.fillStyle = phase >= 2 ? "hsl(256 30% 26% / 0.92)" : "hsl(40 50% 80% / 0.85)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - w, FLOOR);
        ctx.lineTo(x + lean - 2, FLOOR - h);
        ctx.lineTo(x + lean + 3, FLOOR - h + 6);
        ctx.lineTo(x + w, FLOOR);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = phase >= 2 ? `hsl(32 100% 70% / ${0.3 + phase * 0.15})` : "hsl(0 0% 100% / 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.4, FLOOR - 6);
        ctx.lineTo(x + lean - 1, FLOOR - h + 6);
        ctx.stroke();
      }
    },
  },
  // Book 3, 5. The Eye of the Sky: the summit of Zenith, the highest mountain in the world, where the clouds lie below
  // like a sea. Every stage climbs higher, the stars crowd closer, and the great eye in the sky opens a little wider.
  // At the lair it is wide open, ringed in gold, and every star in the sky has gathered round it.
  {
    sky: [["hsl(214 60% 58%)", "hsl(200 50% 76%)", "hsl(40 80% 86%)"], ["hsl(232 50% 36%)", "hsl(260 30% 54%)", "hsl(30 70% 74%)"], ["hsl(232 60% 14%)", "hsl(236 46% 26%)", "hsl(222 40% 44%)"], ["hsl(230 70% 4%)", "hsl(232 60% 10%)", "hsl(226 50% 22%)"]],
    far: "hsl(222 24% 64%)", near: "hsl(220 16% 46%)", floor: ["hsl(220 14% 58%)", "hsl(224 18% 36%)"], line: "hsl(224 30% 20% / 0.35)", starsFrom: 1, flat: true,
    scene(ctx, stage, phase, rnd) {
      const k = stage / 7;
      // the eye in the sky: a ring of stars that opens a little wider every stage
      const ex = 480, ey = 140 - k * 20, rx = 150 + k * 90, open = 0.05 + k * 0.4;
      const ry = rx * open;
      glow(ctx, ex, ey, rx * 1.3, "hsl(46 100% 76%)", 0.08 + k * 0.16);
      for (let i = 0; i < 26 + stage * 6; i++) {
        const a = rnd() * Math.PI * 2;
        const x = ex + Math.cos(a) * rx * (0.98 + rnd() * 0.06), y = ey + Math.sin(a) * ry * (0.98 + rnd() * 0.06);
        glow(ctx, x, y, 6 + rnd() * 6, "hsl(48 100% 92%)", 0.7);
        ctx.fillStyle = "hsl(48 100% 97%)";
        ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      }
      if (stage >= 2) {
        // inside it, once it has opened enough: a sapphire iris with a gold star for a pupil
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();
        glow(ctx, ex, ey, rx, "hsl(48 80% 90%)", 0.18 + k * 0.1);
        glow(ctx, ex, ey, ry * 0.95, "hsl(228 90% 46%)", 0.55 + k * 0.3);
        glow(ctx, ex, ey, ry * 0.35, "hsl(46 100% 76%)", 0.9);
        ctx.restore();
      }
      if (phase === 3) {
        // at the lair the eye is wide open, its rays reaching over the whole sky
        ctx.strokeStyle = "hsl(46 100% 76% / 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          ctx.moveTo(ex + Math.cos(a) * (rx + 20), ey + Math.sin(a) * (ry + 20));
          ctx.lineTo(ex + Math.cos(a) * (rx + 120 + (i % 2) * 80), ey + Math.sin(a) * (ry + 80 + (i % 2) * 60));
        }
        ctx.stroke();
        glow(ctx, ex, ey, 280, "hsl(46 100% 70%)", 0.18);
      }
      // the other peaks poking up out of the cloud, far off, smaller the higher we climb
      ctx.fillStyle = phase >= 2 ? "hsl(232 30% 16%)" : "hsl(222 24% 64%)";
      for (let i = 0; i < 4; i++) {
        const x = 60 + rnd() * 840, h = (70 - k * 40) + rnd() * 40, w = 50 + rnd() * 40;
        ctx.beginPath();
        ctx.moveTo(x - w, 316);
        ctx.lineTo(x - 6, 316 - h);
        ctx.lineTo(x + 6, 316 - h + 4);
        ctx.lineTo(x + w, 316);
        ctx.fill();
        ctx.fillStyle = phase >= 2 ? "hsl(222 30% 40%)" : "hsl(0 0% 98%)";
        ctx.beginPath();
        ctx.moveTo(x - 14, 316 - h + 18);
        ctx.lineTo(x - 6, 316 - h);
        ctx.lineTo(x + 6, 316 - h + 4);
        ctx.lineTo(x + 16, 316 - h + 20);
        ctx.fill();
        ctx.fillStyle = phase >= 2 ? "hsl(232 30% 16%)" : "hsl(222 24% 64%)";
      }
      // the sea of clouds far below, lit from above, darker as night comes on
      for (let row = 0; row < 3; row++) {
        const y = 300 + row * 26;
        ctx.fillStyle = phase >= 2 ? `hsl(228 30% ${22 + row * 6}%)` : `hsl(220 30% ${80 - row * 6}%)`;
        ctx.beginPath();
        ctx.moveTo(0, FLOOR);
        for (let x = 0; x <= W; x += 30) ctx.lineTo(x, y - Math.abs(Math.sin(x * 0.012 + row * 1.7 + stage)) * 22);
        ctx.lineTo(W, FLOOR);
        ctx.fill();
      }
    },
    front(ctx, stage, phase, rnd) {
      // the summit: bare grey rock with steps cut into it by whoever climbed here first
      const rock = ctx.createLinearGradient(0, FLOOR - 40, 0, FLOOR);
      rock.addColorStop(0, phase >= 2 ? "hsl(228 20% 26%)" : "hsl(220 12% 62%)");
      rock.addColorStop(1, phase >= 2 ? "hsl(228 22% 18%)" : "hsl(222 14% 46%)");
      ctx.fillStyle = rock;
      ctx.fillRect(0, FLOOR - 40, W, 40);
      ctx.strokeStyle = phase >= 2 ? "hsl(228 30% 40% / 0.5)" : "hsl(220 10% 36% / 0.5)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const y = FLOOR - 36 + i * 9;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // frost and snow lying in the cracks
      ctx.fillStyle = phase >= 2 ? "hsl(222 40% 70% / 0.5)" : "hsl(0 0% 100% / 0.75)";
      for (let i = 0; i < 18; i++) {
        const x = rnd() * W, y = FLOOR - 38 + rnd() * 34;
        ctx.beginPath();
        ctx.ellipse(x, y, 10 + rnd() * 18, 2 + rnd() * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // tall standing lanterns of old stone along the edges, lit gold, more of them every stage
      for (let i = 0; i < Math.min(8, 2 + stage); i++) {
        const left = i % 2 === 0, x = left ? 40 + (i >> 1) * 56 : W - 40 - (i >> 1) * 56, h = 70 + rnd() * 30;
        ctx.fillStyle = phase >= 2 ? "hsl(228 20% 22%)" : "hsl(220 10% 52%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(x - 6, FLOOR - h, 12, h);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x - 11, FLOOR - h - 16, 22, 16);
        ctx.fill();
        ctx.stroke();
        glow(ctx, x, FLOOR - h - 8, 26, "hsl(46 100% 70%)", 0.4 + phase * 0.12);
        ctx.fillStyle = "hsl(48 100% 90%)";
        ctx.fillRect(x - 4, FLOOR - h - 12, 8, 8);
      }
      // from the fourth stage on, fallen stars glow on the rock where they landed
      for (let i = 0; i < Math.max(0, stage - 3) * 2; i++) {
        const x = 200 + rnd() * 560, y = FLOOR - 4 - rnd() * 28;
        glow(ctx, x, y, 16, rnd() < 0.5 ? "hsl(46 100% 74%)" : "hsl(222 100% 76%)", 0.7);
        ctx.fillStyle = "hsl(48 100% 96%)";
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    },
  },
  // ---------- Book 4: The Titans ----------
  {
    // Book 4, 1. The Waking Mountain: green highlands under a range of grey peaks that are starting to move
    sky: [
      ["hsl(204 60% 70%)", "hsl(190 50% 84%)", "hsl(150 30% 88%)"],
      ["hsl(206 64% 60%)", "hsl(196 50% 78%)", "hsl(160 30% 84%)"],
      ["hsl(250 30% 34%)", "hsl(20 50% 60%)", "hsl(36 70% 72%)"],
      ["hsl(220 30% 10%)", "hsl(170 30% 18%)", "hsl(150 40% 30%)"],
    ],
    far: "hsl(130 20% 40%)",
    near: "hsl(110 26% 30%)",
    floor: ["hsl(100 20% 32%)", "hsl(90 16% 18%)"],
    line: "hsl(150 60% 60% / 0.25)",
    starsFrom: 3,
    scene(ctx, stage, phase, rnd) {
      // the range: grey peaks capped with snow, standing a little taller every stage as the mountain wakes
      const lift = stage * 10;
      for (let i = 0; i < 6; i++) {
        const x = 40 + i * 175 + rnd() * 40, h = 150 + rnd() * 70 + lift, w = 120 + rnd() * 50;
        ctx.fillStyle = phase >= 3 ? "hsl(200 14% 16%)" : phase === 2 ? "hsl(260 12% 40%)" : "hsl(210 10% 58%)";
        ctx.beginPath();
        ctx.moveTo(x - w, 340);
        ctx.lineTo(x, 340 - h);
        ctx.lineTo(x + w, 340);
        ctx.fill();
        ctx.fillStyle = phase >= 3 ? "hsl(200 20% 40%)" : "hsl(0 0% 97%)";
        ctx.beginPath();
        ctx.moveTo(x - w * 0.24, 340 - h * 0.76);
        ctx.lineTo(x, 340 - h);
        ctx.lineTo(x + w * 0.26, 340 - h * 0.74);
        ctx.lineTo(x + w * 0.08, 340 - h * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      // from the middle of the chapter, jade light running along the cracks in the far slopes
      if (phase >= 1) {
        ctx.strokeStyle = `hsl(150 100% 66% / ${0.3 + phase * 0.18})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 2 + phase * 2; i++) {
          let x = 80 + rnd() * 800, y = 330 - rnd() * 80;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += 10 + rnd() * 16;
            y += (rnd() - 0.3) * 18;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    },
    front(ctx, stage, phase, rnd) {
      // standing stones in the grass, and boulders that have rolled down off the waking peaks
      for (let i = 0; i < 3 + stage; i++) {
        const x = rnd() * W, h = 20 + rnd() * 30, w = 14 + rnd() * 20;
        ctx.fillStyle = phase >= 3 ? "hsl(200 10% 22%)" : "hsl(28 8% 50%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - w, FLOOR);
        ctx.lineTo(x - w * 0.7, FLOOR - h);
        ctx.lineTo(x + w * 0.6, FLOOR - h * 0.9);
        ctx.lineTo(x + w, FLOOR);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (phase === 3) glow(ctx, W / 2, FLOOR - 10, 220, "hsl(150 100% 60%)", 0.35);
    },
  },
  {
    // Book 4, 2. The Root Below: a forest of trunks too wide to see round, roots as tall as walls, fireflies in the dark
    sky: [
      ["hsl(110 30% 30%)", "hsl(96 30% 46%)", "hsl(80 40% 60%)"],
      ["hsl(120 30% 24%)", "hsl(100 30% 38%)", "hsl(80 36% 50%)"],
      ["hsl(140 30% 14%)", "hsl(110 24% 24%)", "hsl(60 40% 34%)"],
      ["hsl(150 40% 6%)", "hsl(120 30% 12%)", "hsl(92 50% 22%)"],
    ],
    far: "hsl(110 24% 18%)",
    near: "hsl(24 30% 16%)",
    floor: ["hsl(30 30% 20%)", "hsl(24 30% 10%)"],
    line: "hsl(92 70% 60% / 0.2)",
    starsFrom: 9,
    scene(ctx, stage, phase, rnd) {
      // light coming down in shafts through the leaves high above
      for (let i = 0; i < 4; i++) {
        const x = 100 + rnd() * 760;
        const g = ctx.createLinearGradient(x, 0, x + 60, FLOOR);
        g.addColorStop(0, `hsl(70 100% 80% / ${0.24 - phase * 0.05})`);
        g.addColorStop(1, "hsl(70 100% 80% / 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 30, 0);
        ctx.lineTo(x + 120, FLOOR);
        ctx.lineTo(x + 50, FLOOR);
        ctx.fill();
      }
      // the giant trunks, nearer and wider the deeper the stage
      for (let i = 0; i < 5; i++) {
        const x = 60 + i * 210 + rnd() * 60, w = 50 + rnd() * 40 + stage * 4;
        ctx.fillStyle = `hsl(24 ${24 + i * 2}% ${phase >= 3 ? 8 : 14 + (i % 2) * 4}%)`;
        ctx.fillRect(x - w / 2, 0, w, 360);
        ctx.strokeStyle = "hsl(24 30% 8% / 0.6)";
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const lx = x - w / 2 + (k + 1) * (w / 4);
          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.quadraticCurveTo(lx + (rnd() - 0.5) * 20, 180, lx, 360);
          ctx.stroke();
        }
      }
    },
    front(ctx, stage, phase, rnd) {
      // great roots arching out of the ground
      ctx.lineCap = "round";
      for (let i = 0; i < 2 + Math.min(4, stage); i++) {
        const x = rnd() * W, span = 120 + rnd() * 160, h = 40 + rnd() * 50;
        ctx.strokeStyle = phase >= 3 ? "hsl(24 30% 10%)" : "hsl(24 30% 18%)";
        ctx.lineWidth = 14 + rnd() * 8;
        ctx.beginPath();
        ctx.moveTo(x - span / 2, FLOOR + 6);
        ctx.quadraticCurveTo(x, FLOOR - h * 2, x + span / 2, FLOOR + 6);
        ctx.stroke();
      }
      // fireflies, more of them as it gets dark
      for (let i = 0; i < 6 + phase * 8; i++) glow(ctx, rnd() * W, 120 + rnd() * 300, 6, "hsl(80 100% 70%)", 0.7);
      if (phase === 3) glow(ctx, W / 2, FLOOR - 20, 240, "hsl(92 100% 56%)", 0.3);
    },
  },
  {
    // Book 4, 3. The Amber Hollow: a cavern of living amber under the forest, walls of honeycomb, things sealed in gold
    sky: [
      ["hsl(30 60% 20%)", "hsl(36 80% 40%)", "hsl(44 100% 60%)"],
      ["hsl(28 60% 16%)", "hsl(34 80% 34%)", "hsl(42 100% 54%)"],
      ["hsl(24 60% 12%)", "hsl(30 80% 26%)", "hsl(38 100% 46%)"],
      ["hsl(20 60% 6%)", "hsl(28 80% 16%)", "hsl(40 100% 40%)"],
    ],
    far: "hsl(32 70% 26%)",
    near: "hsl(30 70% 18%)",
    floor: ["hsl(36 80% 34%)", "hsl(28 70% 14%)"],
    line: "hsl(46 100% 70% / 0.25)",
    starsFrom: 9,
    flat: true,
    scene(ctx, stage, phase, rnd) {
      // honeycomb across the cavern wall, every cell lit from within
      const r = 26;
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 24; col++) {
          const x = col * r * 1.75 + (row % 2) * r * 0.87, y = row * r * 1.5 + 10;
          if (y > 360) continue;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
            if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fillStyle = `hsl(${36 + rnd() * 8} 90% ${(phase >= 3 ? 16 : 26) + rnd() * 14}% / 0.8)`;
          ctx.fill();
          ctx.strokeStyle = "hsl(28 70% 12% / 0.7)";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      // things the amber has kept: a leaf, a feather, a beetle, a fish, hanging in the gold
      for (let i = 0; i < 3 + stage; i++) {
        const x = 60 + rnd() * 840, y = 60 + rnd() * 240;
        glow(ctx, x, y, 34, "hsl(46 100% 66%)", 0.45);
        ctx.fillStyle = "hsl(24 50% 14% / 0.8)";
        ctx.beginPath();
        ctx.ellipse(x, y, 6 + rnd() * 8, 3 + rnd() * 4, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    front(ctx, stage, phase, rnd) {
      // long drips of resin hanging from above, and pools of it set hard on the floor
      for (let i = 0; i < 6 + stage; i++) {
        const x = rnd() * W, len = 30 + rnd() * 90;
        ctx.fillStyle = "hsl(40 100% 50% / 0.85)";
        ctx.beginPath();
        ctx.moveTo(x - 6, 0);
        ctx.quadraticCurveTo(x - 3, len * 0.7, x, len);
        ctx.quadraticCurveTo(x + 3, len * 0.7, x + 6, 0);
        ctx.fill();
      }
      for (let i = 0; i < 4; i++) {
        const x = rnd() * W;
        ctx.fillStyle = "hsl(42 100% 54% / 0.6)";
        ctx.beginPath();
        ctx.ellipse(x, FLOOR - 4, 40 + rnd() * 50, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (phase === 3) glow(ctx, W / 2, FLOOR - 30, 240, "hsl(44 100% 60%)", 0.4);
    },
  },
];

/** What moves over each chapter's painting, by part of the chapter (0 dawn to 3 the lair). Indexed by global chapter. */
const AIRS: ((phase: number) => Air)[] = [
  // 1. The Rift Opens: clouds by day, sparks drifting up out of the crack as it widens
  (p) => ({ clouds: p < 2 ? "hsl(0 0% 100%)" : undefined, motes: p >= 1 ? "sparks" : undefined, hue: 280, twinkle: p >= 2, amount: 0.5 + p * 0.3 }),
  // 2. The Storm Coast: storm clouds racing and rain, heavier every stage
  (p) => ({ clouds: "hsl(210 14% 72%)", motes: "rain", amount: 0.4 + p * 0.35 }),
  // 3. The Ember Wastes: embers rising and heat over the dunes
  (p) => ({ motes: "embers", hue: 14, heat: true, amount: 0.6 + p * 0.25 }),
  // 4. The Frozen Clock: snow barely drifting
  (p) => ({ clouds: p < 2 ? "hsl(210 30% 96%)" : undefined, motes: "snow", twinkle: p >= 2, amount: 0.7 + p * 0.15 }),
  // 5. The Heart of the Rift: violet motes floating in the void
  (p) => ({ motes: "spores", hue: 318, twinkle: true, amount: 0.7 + p * 0.2 }),
  // 6. The Hollow Kingdom: fog rolling through, lantern light drifting
  (p) => ({ mist: "hsl(180 10% 72%)", motes: "dust", hue: 60, twinkle: p >= 2, amount: 0.7 + p * 0.2 }),
  // 7. The Dying Sun: ash falling and heat haze
  (p) => ({ motes: "ash", hue: 20, heat: p < 3, amount: 0.5 + p * 0.3 }),
  // 8. The Edge of Everything: stars blinking, dust drifting toward the black hole
  (p) => ({ motes: "dust", hue: 272, twinkle: true, amount: 0.7 + p * 0.2 }),
  // Book 2, 1. Lights Under the Sea: bubbles rising and mist on the water
  (p) => ({ mist: "hsl(196 30% 46%)", motes: "bubbles", hue: 170, twinkle: true, amount: 0.7 + p * 0.2 }),
  // Book 2, 2. The Singing Rot: glowing spores hanging in the air
  (p) => ({ mist: "hsl(170 30% 40%)", motes: "spores", hue: 170, amount: 0.6 + p * 0.3 }),
  // Book 2, 3. The City That Forgets: fog and flakes of forgotten paper
  (p) => ({ mist: "hsl(300 10% 88%)", motes: "ash", hue: 40, amount: 0.5 + p * 0.3 }),
  // Book 2, 4. The Moth Moon: moth dust glinting under the moon
  (p) => ({ motes: "dust", hue: 46, twinkle: true, amount: 0.8 + p * 0.25 }),
  // Book 2, 5. The Sleeping Valley: dream bubbles floating up
  (p) => ({ clouds: p < 1 ? "hsl(320 60% 94%)" : undefined, motes: "bubbles", hue: 46, twinkle: p >= 1, amount: 0.6 + p * 0.3 }),
  // Book 2, 6. The Silent Bells: red dusk clouds and falling ash
  (p) => ({ clouds: p < 3 ? "hsl(10 40% 64%)" : undefined, motes: "ash", hue: 354, twinkle: p >= 2, amount: 0.5 + p * 0.25 }),
  // Book 2, 7. The Elder Dark: no stars, only dark dust pulled up into the crack
  (p) => ({ mist: "hsl(268 40% 30%)", motes: "dust", hue: 268, amount: 0.7 + p * 0.25 }),
  // Book 3, 1. The Falling Star: snow over the snowfields
  (p) => ({ clouds: p < 2 ? "hsl(210 30% 96%)" : undefined, motes: "snow", twinkle: p >= 2, amount: 0.6 + p * 0.25 }),
  // Book 3, 2. The Hunter in the Stars: the sky full of blinking stars
  (p) => ({ motes: "dust", hue: 44, twinkle: true, amount: 0.7 + p * 0.25 }),
  // Book 3, 3. Where Stars Are Born: new stars switching on, rose and green motes over the salt
  (p) => ({ mist: "hsl(320 30% 92%)", motes: "spores", hue: 150, twinkle: true, amount: 0.7 + p * 0.25 }),
  // Book 3, 4. The Spinning Heart: heat over the glass, sand blowing
  (p) => ({ motes: "dust", hue: 40, heat: true, twinkle: p >= 2, amount: 0.7 + p * 0.2 }),
  // Book 3, 5. The Eye of the Sky: the sea of clouds rolling below, stars crowding closer
  (p) => ({ mist: "hsl(220 20% 92%)", twinkle: p >= 1, amount: 0.8 + p * 0.25 }),
  // Book 4, 1. The Waking Mountain: clouds over the highlands by day, grit shaken loose off the peaks as they wake
  (p) => ({ clouds: p < 2 ? "hsl(0 0% 100%)" : undefined, motes: "dust", hue: 150, twinkle: p >= 3, amount: 0.5 + p * 0.25 }),
  // Book 4, 2. The Root Below: green spores drifting down through the shafts of light
  (p) => ({ mist: "hsl(100 30% 30%)", motes: "spores", hue: 90, twinkle: p >= 2, amount: 0.6 + p * 0.25 }),
  // Book 4, 3. The Amber Hollow: gold motes hanging in the thick warm air
  (p) => ({ motes: "dust", hue: 42, heat: true, twinkle: true, amount: 0.7 + p * 0.2 }),
];

function paint(ch: number, stage: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const look = LOOKS[ch] ?? LOOKS[0];
  const phase = phaseOf(stage, lairOf(ch));
  let seed = 101 + ch * 37 + stage * 11;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  // sky
  const [top, mid, low] = look.sky[phase];
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, top);
  sky.addColorStop(0.55, mid);
  sky.addColorStop(1, low);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FLOOR);
  if (phase >= look.starsFrom) stars(ctx, rnd, 60 + phase * 40);
  look.scene(ctx, stage, phase, rnd);
  if (!look.flat) {
    hills(ctx, 330, 90, look.far, ch + stage * 0.7);
    hills(ctx, 380, 50, look.near, ch * 2 + stage * 1.3);
  }
  look.front?.(ctx, stage, phase, rnd);
  // floor
  const floor = ctx.createLinearGradient(0, FLOOR, 0, H);
  floor.addColorStop(0, look.floor[0]);
  floor.addColorStop(1, look.floor[1]);
  ctx.fillStyle = floor;
  ctx.fillRect(0, FLOOR, W, H - FLOOR);
  ctx.fillStyle = INK;
  ctx.fillRect(0, FLOOR - 2, W, 4);
  ctx.strokeStyle = look.line;
  ctx.lineWidth = 2;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 60, FLOOR + 2);
    ctx.lineTo(W / 2 + i * 150, H);
    ctx.stroke();
  }
  for (const y of [462, 492, 530, 575]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // the boss's lair glows with its colour on the floor
  ctx.strokeStyle = phase === 3 ? "hsl(0 0% 100% / 0.6)" : "hsl(0 0% 100% / 0.35)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(W / 2, 540, 300, 40, 0, 0, Math.PI * 2);
  ctx.stroke();
  // vignette, heavier as the chapter goes on
  const v = ctx.createRadialGradient(W / 2, H / 2, 240, W / 2, H / 2, 640);
  v.addColorStop(0, "hsl(0 0% 0% / 0)");
  v.addColorStop(1, `hsl(250 40% 6% / ${0.3 + phase * 0.12})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return setAir(c, (AIRS[ch] ?? AIRS[0])(phase));
}

const cache = new Map<string, HTMLCanvasElement>();

/** The painting behind a Story stage, painted once per chapter and stage. Browser only. */
export function storyBackdrop(ch: number, stage: number): HTMLCanvasElement {
  const key = `${ch}:${stage}`;
  let c = cache.get(key);
  if (!c) {
    c = paint(ch, stage);
    cache.set(key, c);
  }
  return c;
}
