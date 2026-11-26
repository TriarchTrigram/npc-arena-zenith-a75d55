// How each Story boss looks on top of the stickman body: halos, horns, crowns, capes, hoods and weapons.
// The engine calls this twice per boss per frame: once behind the limbs ("back") and once in front ("front").
import type { BossDesign } from "./fighters";

type Pt = { x: number; y: number };
export type BossRig = { hip: Pt; neck: Pt; shoulder: Pt; head: Pt; kF: Pt; fF: Pt; kB: Pt; fB: Pt; eF: Pt; hF: Pt; eB: Pt; hB: Pt };

const TAU = Math.PI * 2;
const HEAD = 11;
const INK = "hsl(250 32% 14%)";

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function jagLine(ctx: CanvasRenderingContext2D, pts: Pt[], amp: number, seed: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    for (let k = 1; k <= 3; k++) {
      const u = k / 3;
      const off = k < 3 ? Math.sin(seed * 13.7 + i * 5.1 + k * 2.3) * amp : 0;
      ctx.lineTo(a.x + (b.x - a.x) * u - (b.y - a.y) * 0.05 * off, a.y + (b.y - a.y) * u + (b.x - a.x) * 0.05 * off);
    }
  }
  ctx.stroke();
}

/** What the boss is doing this frame, so its weapon and body can follow the move. */
/** A tapering, swaying tentacle from (x, y) heading at angle `ang`: thick at the root, thin at the tip. */
function tentacle(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, t: number, seed: number, col: string, tip?: string) {
  const n = 9;
  let px = x, py = y;
  ctx.strokeStyle = col;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const a = ang + Math.sin(t * 2.2 + seed + k * 4) * 0.55 * k;
    const nx = px + Math.cos(a) * (len / n), ny = py + Math.sin(a) * (len / n);
    ctx.lineWidth = Math.max(0.8, w * (1 - k * 0.85));
    if (tip && i === n) ctx.strokeStyle = tip;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    px = nx;
    py = ny;
  }
  return { x: px, y: py };
}

/** An angler's lure: a stalk from (x, y) arching up and over to a glowing bulb. Returns where the bulb hangs. */
function lure(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, rise: number, s: number, t: number, seed: number, alive: boolean, col: string, light: string) {
  const bx = x + dx, by = y - rise * 0.35 + Math.sin(t * 2.4 + seed) * 3 * s;
  const cx = x + dx * 0.35, cy = y - rise;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(cx, cy, bx, by);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.2 * s;
  ctx.stroke();
  if (alive) {
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, bx, by, (16 + Math.sin(t * 5 + seed) * 2.5) * s, light.replace(")", " / 0.8)"), light.replace(")", " / 0)"));
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.fillStyle = alive ? "hsl(66 100% 92%)" : "hsl(196 10% 40%)";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.arc(bx, by, 4.2 * s, 0, TAU);
  ctx.fill();
  ctx.stroke();
  return { x: bx, y: by };
}

/** One eye that never blinks: a pale white, a glowing iris and a slit pupil turned toward `face`. */
function deepEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, face: number, t: number, seed: number) {
  ctx.fillStyle = "hsl(60 40% 90%)";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.35, r, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const ix = x + face * r * 0.3 + Math.sin(t * 0.9 + seed) * r * 0.15;
  ctx.fillStyle = "hsl(64 100% 52%)";
  ctx.beginPath();
  ctx.arc(ix, y, r * 0.72, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "hsl(200 60% 4%)";
  ctx.beginPath();
  ctx.ellipse(ix, y, r * 0.16, r * 0.62, 0, 0, TAU);
  ctx.fill();
}

export type BossAct = { kind: string; id: string; phase: "wind" | "strike" | "after"; u: number };

const ease = (u: number) => 1 - Math.pow(1 - u, 3);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** A small licking flame, pointing up. */
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.6, x, y - h);
  ctx.quadraticCurveTo(x + w * 0.6, y - h * 0.6, x + w, y);
  ctx.quadraticCurveTo(x, y + w * 0.6, x - w, y);
  ctx.fill();
}

/** A robe or skirt from the waist down past the knees, its hem torn and swaying. */
function robe(ctx: CanvasRenderingContext2D, hip: Pt, fF: Pt, fB: Pt, s: number, t: number, fill: string, trim: string) {
  const hemY = Math.min(fF.y, fB.y) - 10 * s;
  const l = Math.min(fF.x, fB.x, hip.x - 10 * s) - 6 * s, r = Math.max(fF.x, fB.x, hip.x + 10 * s) + 6 * s;
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(hip.x - 8 * s, hip.y - 6 * s);
  ctx.lineTo(hip.x + 8 * s, hip.y - 6 * s);
  ctx.lineTo(r, hemY);
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const x = r + ((l - r) * i) / n;
    ctx.lineTo(x, hemY - (i % 2 ? 7 : 0) * s + Math.sin(t * 4 + i * 1.3) * 2 * s);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(hip.x - 8 * s, hip.y - 4 * s);
  ctx.lineTo(hip.x + 8 * s, hip.y - 4 * s);
  ctx.stroke();
}

/** Motes drifting through a box above (x, y): embers, snow, souls or stars. Stateless: placed by time. */
function motes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, n: number, col: string, size: number, rise = 1) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const k = (t * 0.35 * (0.7 + (i % 3) * 0.2) + i / n) % 1;
    const px = x + (Math.sin(i * 12.9898) * 0.5) * w + Math.sin(t * 2 + i) * 4;
    const py = y - (rise > 0 ? k : 1 - k) * h;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.beginPath();
    ctx.arc(px, py, size * (0.6 + (i % 2) * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A rounded shoulder plate. */
function pauldron(ctx: CanvasRenderingContext2D, sh: Pt, face: number, s: number, fill: string, edge: string, spikes = 0) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.ellipse(sh.x - face * 2 * s, sh.y + 1 * s, 10 * s, 6.5 * s, -face * 0.25, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.ellipse(sh.x - face * 2 * s, sh.y + 1 * s, 7 * s, 4 * s, -face * 0.25, Math.PI * 1.1, TAU * 0.95);
  ctx.stroke();
  for (let i = 0; i < spikes; i++) {
    const bx = sh.x - face * (6 - i * 6) * s, by = sh.y - 4 * s;
    ctx.fillStyle = fill;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(bx - 2.5 * s, by + 1 * s);
    ctx.lineTo(bx - face * 2 * s, by - 9 * s);
    ctx.lineTo(bx + 2.5 * s, by + 1 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * The Hollow King's scythe through each move. Angles are in the facing-right frame: -PI/2 is straight up,
 * 0 points forward, PI/2 straight down. `from` is where this swing's smear starts.
 */
function scytheSwing(act: BossAct | undefined, p: BossRig, s: number, t: number) {
  const lean = Math.max(-1, Math.min(1, (p.hF.x - p.eF.x) / (14 * s)));
  const rest = -Math.PI / 2 - 0.15 + lean * 0.12;
  const pivot = p.hF;
  let a = rest, from = rest, smear = 0, charge = 0;
  if (act) {
    const u = act.u;
    const swing = (back: number, end: number, k = 1) => {
      if (act.phase === "wind") { a = lerp(rest, back, ease(u)); charge = u * 0.6; }
      else if (act.phase === "strike") {
        const e = ease(Math.min(1, u * 1.6));
        a = lerp(back, end, e);
        from = Math.max(back, a - 2.2);
        smear = (1 - u) * k;
        charge = 1 - u;
      } else a = lerp(end, rest, ease(u));
    };
    switch (act.kind) {
      case "melee": swing(-Math.PI - 0.35, 1.0); break; // Reaper's Scythe: over the shoulder and down through the target
      case "pull": swing(-Math.PI / 2 - 0.9, -0.15, 0.6); break; // Soul Chains: hooked out in front
      case "eruption": swing(-Math.PI / 2 - 1.1, 1.35, 0.8); break; // Grave Hands: slammed point-first into the ground
      case "projectile": swing(-Math.PI + 0.1, 0.35, 0.9); break; // Wailing Souls: a flat sweep that throws the souls
      case "zone": // Graveyard: twirled like a baton, then raised high
        if (act.phase === "wind") { a = rest + ease(u) * TAU * 2; charge = u; }
        else if (act.phase === "strike") { a = -Math.PI / 2 - 0.05; charge = 1 - u * 0.5; }
        else a = lerp(-Math.PI / 2, rest, ease(u));
        break;
      case "burst": // Soul Harvest: spun overhead, then one huge reap
        if (act.phase === "wind") { a = rest - ease(u) * (TAU * 2 + rest + Math.PI + 0.6); charge = u; }
        else swing(-Math.PI - 0.6, 1.2, 1.3);
        break;
      default: swing(-Math.PI / 2 - 0.6, 0.2, 0.6);
    }
  }
  return { pivot, a, from, smear, charge: Math.min(1, charge + (act ? 0 : 0.15 + 0.1 * Math.sin(t * 3))) };
}

/** A green crescent behind the blade's path, fading toward where the swing began. */
function drawSmear(ctx: CanvasRenderingContext2D, pv: Pt, a0: number, a1: number, face: number, s: number, k: number) {
  if (a1 - a0 < 0.05) return;
  const w = (x: number) => (face > 0 ? x : Math.PI - x);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const s0 = a0 + ((a1 - a0) * i) / steps, s1 = a0 + ((a1 - a0) * (i + 1)) / steps;
    const al = Math.min(1, k) * ((i + 1) / steps);
    ctx.fillStyle = `hsl(152 92% ${60 + i * 2}% / ${0.55 * al})`;
    ctx.beginPath();
    ctx.arc(pv.x, pv.y, 60 * s, w(s0), w(s1), face < 0);
    ctx.arc(pv.x, pv.y, (34 + 18 * (1 - i / steps)) * s, w(s1), w(s0), face > 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = `hsl(150 100% 92% / ${0.9 * Math.min(1, k)})`;
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.arc(pv.x, pv.y, 59 * s, w(Math.max(a0, a1 - 1.2)), w(a1), face < 0);
  ctx.stroke();
  ctx.restore();
}

/** The scythe itself: a bone-ringed shaft through the hand, a long curved blade with a soul-green edge. */
function drawScythe(ctx: CanvasRenderingContext2D, pv: Pt, a: number, face: number, s: number, alive: boolean, charge: number, t: number) {
  const ux = Math.cos(a) * face, uy = Math.sin(a);
  const nx = face * -uy, ny = face * ux;
  const P = (along: number, side: number) => ({ x: pv.x + ux * along * s + nx * side * s, y: pv.y + uy * along * s + ny * side * s });
  const top = P(48, 0), butt = P(-38, 0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.5 * s;
  ctx.beginPath();
  ctx.moveTo(butt.x, butt.y); ctx.lineTo(top.x, top.y);
  ctx.stroke();
  ctx.strokeStyle = "hsl(30 18% 30%)";
  ctx.lineWidth = 3 * s;
  ctx.stroke();
  // bone rings on the shaft and a skull-knob at the butt
  ctx.strokeStyle = "hsl(44 30% 80%)";
  ctx.lineWidth = 2 * s;
  for (const k of [-24, 22, 40]) {
    const d = P(k, 3.5), e = P(k, -3.5);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y); ctx.lineTo(e.x, e.y);
    ctx.stroke();
  }
  ctx.fillStyle = "hsl(44 30% 82%)";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  ctx.arc(butt.x, butt.y, 4 * s, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // blade
  const b0 = P(50, -1), c1 = P(66, 32), tip = P(36, 50), c2 = P(54, 26), b1 = P(43, 0);
  ctx.fillStyle = "hsl(180 10% 80%)";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.7 * s;
  ctx.beginPath();
  ctx.moveTo(b0.x, b0.y);
  ctx.quadraticCurveTo(c1.x, c1.y, tip.x, tip.y);
  ctx.quadraticCurveTo(c2.x, c2.y, b1.x, b1.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // a darker spine along the back of the blade
  ctx.strokeStyle = "hsl(180 8% 48%)";
  ctx.lineWidth = 1.6 * s;
  const sp1 = P(60, 22), sp2 = P(44, 42);
  ctx.beginPath();
  ctx.moveTo(b0.x, b0.y);
  ctx.quadraticCurveTo(sp1.x, sp1.y, sp2.x, sp2.y);
  ctx.stroke();
  if (alive) {
    ctx.globalCompositeOperation = "lighter";
    const e1 = P(46, 3), ec = P(55, 26), e2 = P(37, 47);
    ctx.strokeStyle = `hsl(152 92% ${66 + charge * 20}% / ${0.6 + charge * 0.4})`;
    ctx.lineWidth = (1.6 + charge * 2.4) * s;
    ctx.beginPath();
    ctx.moveTo(e1.x, e1.y);
    ctx.quadraticCurveTo(ec.x, ec.y, e2.x, e2.y);
    ctx.stroke();
    if (charge > 0.3) glow(ctx, tip.x, tip.y, (8 + 10 * charge + Math.sin(t * 20) * 2) * s, `hsl(152 100% 80% / ${charge})`, "hsl(152 92% 60% / 0)");
    ctx.globalCompositeOperation = "source-over";
  }
}

export function drawBossDesign(
  ctx: CanvasRenderingContext2D, design: BossDesign, layer: "back" | "front", p: BossRig,
  s: number, face: number, t: number, alive: boolean, vx: number, act?: BossAct, phase = 1,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const { head, neck, hip, shoulder } = p;
  const mid = { x: (hip.x + head.x) / 2, y: (hip.y + head.y) / 2 };
  if (layer === "back" && phase > 1 && alive) drawBossPhase(ctx, design, layer, p, s, face, t, phase);
  if (layer === "back") drawBossExtras(ctx, design, layer, p, s, face, t, alive, vx, act);
  switch (design) {
    // ----- Nullshade: matter and antimatter -----
    case "antimatter": {
      if (layer === "back") {
        if (alive) {
          ctx.globalCompositeOperation = "source-over";
          glow(ctx, mid.x, mid.y, 78 * s, "hsl(268 60% 8% / 0.55)", "hsl(268 60% 8% / 0)");
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "hsl(186 100% 72% / 0.35)";
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.arc(mid.x, mid.y, (58 + Math.sin(t * 3) * 3) * s, 0, TAU);
          ctx.stroke();
        }
        // a cracked white halo behind the head
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "hsl(0 0% 96%)";
        ctx.lineWidth = 3 * s;
        const hx = head.x - face * 4 * s, hy = head.y - 2 * s;
        for (const [a0, a1] of [[0.2, 1.9], [2.15, 3.6], [3.85, 5.95]]) {
          ctx.beginPath();
          ctx.ellipse(hx, hy, 21 * s, 21 * s, 0, a0 + t * 0.4, a1 + t * 0.4);
          ctx.stroke();
        }
      } else {
        // cyan veins down the body
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "hsl(186 100% 70% / 0.85)";
        ctx.lineWidth = 1.6 * s;
        jagLine(ctx, [neck, mid, hip], 30, 1);
        jagLine(ctx, [shoulder, p.eF, p.hF], 24, 2);
        // matter and antimatter orbiting the head, passing in front and behind
        if (alive) {
          for (let i = 0; i < 2; i++) {
            const an = t * 3.2 + i * Math.PI;
            const ox = head.x + Math.cos(an) * 30 * s, oy = head.y - 6 * s + Math.sin(an) * 9 * s;
            ctx.globalCompositeOperation = i === 0 ? "lighter" : "source-over";
            if (i === 0) {
              glow(ctx, ox, oy, 11 * s, "hsl(0 0% 100%)", "hsl(186 100% 80% / 0)");
            } else {
              ctx.fillStyle = "hsl(268 70% 6%)";
              ctx.beginPath();
              ctx.arc(ox, oy, 5.5 * s, 0, TAU);
              ctx.fill();
              ctx.strokeStyle = "hsl(186 100% 72%)";
              ctx.lineWidth = 2 * s;
              ctx.stroke();
            }
          }
        }
        // eye: a white ring with a black core, the inverse of everyone else
        ctx.globalCompositeOperation = "source-over";
        const ex = head.x + face * 5 * s, ey = head.y - 1.5 * s;
        if (alive) {
          ctx.fillStyle = "hsl(186 100% 82%)";
          ctx.beginPath();
          ctx.arc(ex, ey, 4.4 * s, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "hsl(268 70% 6%)";
          ctx.beginPath();
          ctx.arc(ex + face * 1.2 * s, ey, 2.2 * s, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    // ----- Maelstrom: a waterspout body, lightning crown, trident -----
    case "maelstrom": {
      if (layer === "back") {
        // waterspout spinning around the legs
        for (let i = 0; i < 6; i++) {
          const u = i / 5;
          const y = hip.y + (p.fF.y - hip.y + 6 * s) * u;
          const rx = (14 + u * 22) * s;
          ctx.strokeStyle = i % 2 ? "hsl(190 100% 78% / 0.8)" : "hsl(210 80% 45% / 0.85)";
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.ellipse(hip.x, y, rx, rx * 0.28, 0, t * 9 + i, t * 9 + i + 4);
          ctx.stroke();
        }
        // storm-cloud mantle off the shoulders
        const back = -face;
        ctx.fillStyle = "hsl(215 28% 26% / 0.92)";
        for (let i = 0; i < 4; i++) {
          const bx = shoulder.x + back * (8 + i * 9) * s + Math.sin(t * 4 + i) * 2 * s;
          const by = shoulder.y + i * 9 * s;
          ctx.beginPath();
          ctx.arc(bx, by, (11 - i) * s, 0, TAU);
          ctx.fill();
        }
      } else {
        // trident in the front hand, pointing the way the forearm does
        const dx = p.hF.x - p.eF.x, dy = p.hF.y - p.eF.y;
        const L = Math.hypot(dx, dy) || 1;
        const ux = dx / L, uy = dy / L;
        const tip = { x: p.hF.x + ux * 36 * s, y: p.hF.y + uy * 36 * s };
        const butt = { x: p.hF.x - ux * 30 * s, y: p.hF.y - uy * 30 * s };
        ctx.strokeStyle = INK;
        ctx.lineWidth = 5 * s;
        ctx.beginPath();
        ctx.moveTo(butt.x, butt.y); ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.strokeStyle = "hsl(44 70% 62%)";
        ctx.lineWidth = 2.6 * s;
        ctx.stroke();
        ctx.strokeStyle = "hsl(186 90% 80%)";
        ctx.lineWidth = 2.6 * s;
        ctx.beginPath();
        const nx = -uy, ny = ux;
        for (const k of [-1, 0, 1]) {
          ctx.moveTo(tip.x + nx * k * 7 * s, tip.y + ny * k * 7 * s);
          ctx.lineTo(tip.x + nx * k * 7 * s + ux * 12 * s, tip.y + ny * k * 7 * s + uy * 12 * s);
        }
        ctx.moveTo(tip.x - nx * 7 * s, tip.y - ny * 7 * s);
        ctx.lineTo(tip.x + nx * 7 * s, tip.y + ny * 7 * s);
        ctx.stroke();
        // crown of three lightning bolts
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "hsl(54 100% 70%)";
        ctx.lineWidth = 2.4 * s;
        for (const k of [-1, 0, 1]) {
          const bx = head.x + k * 7 * s, by = head.y - (HEAD - 1) * s;
          const flick = Math.sin(t * 20 + k) * 2 * s;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + k * 3 * s + flick, by - 7 * s);
          ctx.lineTo(bx + k * 1 * s - flick, by - 10 * s);
          ctx.lineTo(bx + k * 5 * s, by - (k === 0 ? 20 : 15) * s);
          ctx.stroke();
        }
      }
      break;
    }
    // ----- Magmaw: horns, molten cracks, a jaw of magma -----
    case "magmaw": {
      if (layer === "back") {
        if (alive) {
          // smoke rising off the shoulders
          for (let i = 0; i < 4; i++) {
            const k = ((t * 0.5 + i / 4) % 1);
            ctx.fillStyle = `hsl(20 8% 22% / ${0.5 * (1 - k)})`;
            ctx.beginPath();
            ctx.arc(shoulder.x - face * 6 * s + Math.sin(i * 2 + t) * 6 * s, shoulder.y - 10 * s - k * 60 * s, (6 + k * 12) * s, 0, TAU);
            ctx.fill();
          }
          glow(ctx, mid.x, mid.y, 60 * s, "hsl(24 100% 50% / 0.25)", "hsl(24 100% 50% / 0)");
        }
      } else {
        // molten cracks
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = alive ? `hsl(${28 + Math.sin(t * 6) * 6} 100% 58%)` : "hsl(20 60% 30%)";
        ctx.lineWidth = 2.2 * s;
        jagLine(ctx, [neck, mid, hip], 40, 3);
        jagLine(ctx, [hip, p.kF, p.fF], 30, 4);
        jagLine(ctx, [shoulder, p.eF, p.hF], 30, 5);
        ctx.globalCompositeOperation = "source-over";
        // two obsidian horns sweeping back
        for (const side of [1, -1]) {
          const bx = head.x + face * side * 4 * s, by = head.y - 7 * s;
          const tipx = bx - face * (14 + side * 4) * s, tipy = by - (18 + side * 4) * s;
          ctx.fillStyle = "hsl(260 12% 12%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(bx - 4 * s, by + 2 * s);
          ctx.quadraticCurveTo(bx + face * 6 * s, by - 16 * s, tipx, tipy);
          ctx.quadraticCurveTo(bx - face * 2 * s, by - 6 * s, bx + 4 * s, by + 2 * s);
          ctx.fill();
          ctx.stroke();
          glow(ctx, tipx, tipy, 4 * s, "hsl(36 100% 70%)", "hsl(20 100% 50% / 0)");
        }
        // the maw: a glowing jaw full of teeth
        const mx = head.x + face * 5 * s, my = head.y + 4 * s;
        ctx.fillStyle = alive ? "hsl(30 100% 58%)" : "hsl(20 40% 28%)";
        ctx.beginPath();
        ctx.ellipse(mx, my, 6.5 * s, 3.6 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "hsl(40 30% 92%)";
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(mx + i * 2.4 * s - 1 * s, my - 3 * s);
          ctx.lineTo(mx + i * 2.4 * s + 1 * s, my - 3 * s);
          ctx.lineTo(mx + i * 2.4 * s, my - 0.5 * s);
          ctx.fill();
        }
        // eyes burn orange
        if (alive) glow(ctx, head.x + face * 5 * s, head.y - 2 * s, 5 * s, "hsl(48 100% 75%)", "hsl(20 100% 50% / 0)");
      }
      break;
    }
    // ----- Everwinter: frost cape, clock halo, icicle crown -----
    case "everwinter": {
      if (layer === "back") {
        // clock-face halo, its hands turning backwards
        const cx = head.x - face * 6 * s, cy = head.y - 4 * s, r = 24 * s;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, cx, cy, r * 1.3, "hsl(44 90% 72% / 0.3)", "hsl(44 90% 72% / 0)");
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "hsl(44 85% 66%)";
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * TAU;
          ctx.moveTo(cx + Math.cos(an) * r * 0.8, cy + Math.sin(an) * r * 0.8);
          ctx.lineTo(cx + Math.cos(an) * r * 0.95, cy + Math.sin(an) * r * 0.95);
        }
        const h1 = -t * 0.8, h2 = -t * 3;
        ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(h1) * r * 0.75, cy + Math.sin(h1) * r * 0.75);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(h2) * r * 0.55, cy + Math.sin(h2) * r * 0.55);
        ctx.stroke();
        // frost cape flowing behind, hem jagged like ice
        const back = -face;
        const sway = Math.sin(t * 3) * 4 * s + Math.min(18, Math.abs(vx) * 0.04) * s;
        const hemY = hip.y + 34 * s;
        const gr = ctx.createLinearGradient(0, shoulder.y, 0, hemY);
        gr.addColorStop(0, "hsl(205 70% 80% / 0.95)");
        gr.addColorStop(1, "hsl(200 90% 94% / 0.75)");
        ctx.fillStyle = gr;
        ctx.strokeStyle = "hsl(205 60% 52%)";
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(shoulder.x, shoulder.y);
        ctx.quadraticCurveTo(shoulder.x + back * 20 * s, mid.y, hip.x + back * (30 * s + sway), hemY);
        for (let i = 1; i <= 5; i++) {
          const x = hip.x + back * (30 * s + sway) - back * i * 7 * s;
          ctx.lineTo(x + back * 3 * s, hemY - (i % 2 ? 0 : 9) * s);
        }
        ctx.lineTo(hip.x, hip.y + 4 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // crown of icicles
        ctx.fillStyle = "hsl(195 90% 92%)";
        ctx.strokeStyle = "hsl(205 60% 50%)";
        ctx.lineWidth = 1.4 * s;
        for (let i = -2; i <= 2; i++) {
          const an = -Math.PI / 2 + i * 0.36;
          const bx = head.x + Math.cos(an) * HEAD * s, by = head.y + Math.sin(an) * HEAD * s;
          const len = (i === 0 ? 17 : Math.abs(i) === 1 ? 12 : 8) * s;
          ctx.beginPath();
          ctx.moveTo(bx - Math.sin(an) * 3 * s, by + Math.cos(an) * 3 * s);
          ctx.lineTo(bx + Math.cos(an) * len, by + Math.sin(an) * len);
          ctx.lineTo(bx + Math.sin(an) * 3 * s, by - Math.cos(an) * 3 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      break;
    }
    // ----- The Riftmaker: reality splitting around it -----
    case "riftmaker": {
      if (layer === "back") {
        // the body seen twice, shifted in magenta and cyan, as if reality cannot hold it in one place
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          const j = (2.5 + Math.sin(t * 7) * 1.5) * s;
          for (const [dx, col] of [[-j, "hsl(318 100% 62% / 0.55)"], [j, "hsl(186 100% 60% / 0.55)"]] as const) {
            ctx.strokeStyle = col;
            ctx.lineWidth = 6 * s;
            ctx.beginPath();
            for (const seg of [[hip, neck], [hip, p.kF, p.fF], [hip, p.kB, p.fB], [shoulder, p.eF, p.hF], [shoulder, p.eB, p.hB]]) {
              ctx.moveTo(seg[0].x + dx, seg[0].y);
              for (const q of seg.slice(1)) ctx.lineTo(q.x + dx, q.y);
            }
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(head.x + dx, head.y, HEAD * s, 0, TAU);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
        }
        // a halo of broken mirror shards turning behind the head
        for (let i = 0; i < 7; i++) {
          const an = t * 0.9 + (i / 7) * TAU;
          const r = (30 + Math.sin(t * 2 + i) * 3) * s;
          const x = head.x + Math.cos(an) * r, y = head.y - 4 * s + Math.sin(an) * r * 0.8;
          ctx.fillStyle = i % 2 ? "hsl(318 90% 70% / 0.9)" : "hsl(186 90% 72% / 0.9)";
          ctx.strokeStyle = "hsl(0 0% 100% / 0.9)";
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(an * 3) * 6 * s, y + Math.sin(an * 3) * 6 * s);
          ctx.lineTo(x + Math.cos(an * 3 + 2.3) * 4 * s, y + Math.sin(an * 3 + 2.3) * 4 * s);
          ctx.lineTo(x + Math.cos(an * 3 + 4.1) * 5 * s, y + Math.sin(an * 3 + 4.1) * 5 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else {
        // a third eye: a split diamond on the forehead
        const ex = head.x + face * 1 * s, ey = head.y - 7 * s;
        if (alive) glow(ctx, ex, ey, 9 * s, "hsl(318 100% 80% / 0.9)", "hsl(318 100% 60% / 0)");
        ctx.fillStyle = "hsl(0 0% 100%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(ex, ey - 4 * s); ctx.lineTo(ex + 3 * s, ey); ctx.lineTo(ex, ey + 4 * s); ctx.lineTo(ex - 3 * s, ey);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "hsl(318 100% 50%)";
        ctx.beginPath();
        ctx.arc(ex, ey, 1.4 * s, 0, TAU);
        ctx.fill();
      }
      break;
    }
    // ----- The Hollow King: a tattered cloak, a hood with no face, a bone crown and a scythe -----
    case "hollow": {
      // where the scythe points this frame, and whether its swing leaves a smear
      const sw = scytheSwing(act, p, s, t);
      if (layer === "back") {
        // ragged cloak streaming behind
        const back = -face;
        const sway = Math.sin(t * 2.6) * 5 * s + Math.min(20, Math.abs(vx) * 0.05) * s;
        const hemY = hip.y + 44 * s;
        const gr = ctx.createLinearGradient(0, shoulder.y, 0, hemY);
        gr.addColorStop(0, "hsl(170 18% 12% / 0.96)");
        gr.addColorStop(1, "hsl(165 20% 18% / 0.7)");
        ctx.fillStyle = gr;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(neck.x, neck.y - 4 * s);
        ctx.quadraticCurveTo(shoulder.x + back * 26 * s, mid.y, hip.x + back * (36 * s + sway), hemY);
        for (let i = 1; i <= 8; i++) {
          const x = hip.x + back * (36 * s + sway) - back * i * 7 * s;
          const tear = (i % 2 ? 15 : 2) + Math.sin(t * 5 + i * 1.7) * 3;
          ctx.lineTo(x, hemY - tear * s);
        }
        ctx.lineTo(hip.x - back * 6 * s, hip.y + 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // a torn robe hanging from the waist to the shins
        robe(ctx, hip, p.fF, p.fB, s, t, "hsl(170 18% 11% / 0.95)", "hsl(152 70% 40% / 0.7)");
        // souls circling the reaper; while he reaps, they stream toward the blade
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          const n = act?.kind === "burst" || act?.kind === "zone" ? 6 : 3;
          for (let i = 0; i < n; i++) {
            const an = t * (act ? 4 : 1.8) + (i / n) * TAU;
            const rr = (act?.phase === "wind" ? 40 - 20 * act.u : 40) * s;
            const ox = mid.x + Math.cos(an) * rr, oy = mid.y + Math.sin(an) * rr * 0.4 - 10 * s;
            glow(ctx, ox, oy, 10 * s, "hsl(152 92% 70% / 0.9)", "hsl(152 92% 60% / 0)");
            for (let j = 1; j < 4; j++) {
              const aj = an - j * 0.16;
              glow(ctx, mid.x + Math.cos(aj) * rr, mid.y + Math.sin(aj) * rr * 0.4 - 10 * s, (6 - j) * s, "hsl(152 92% 60% / 0.5)", "hsl(152 92% 60% / 0)");
            }
          }
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // ribs showing through the dark body, and a sash of soul light
        ctx.strokeStyle = "hsl(44 30% 82%)";
        ctx.lineWidth = 1.5 * s;
        for (let i = 0; i < 3; i++) {
          const k = 0.2 + i * 0.16;
          const rx = neck.x + (hip.x - neck.x) * k, ry = neck.y + (hip.y - neck.y) * k;
          ctx.beginPath();
          ctx.moveTo(rx - 6 * s, ry + 2 * s);
          ctx.quadraticCurveTo(rx, ry - 2 * s, rx + 6 * s, ry + 2 * s);
          ctx.stroke();
        }
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "hsl(152 92% 60% / 0.8)";
          ctx.lineWidth = 2.4 * s;
          ctx.beginPath();
          ctx.moveTo(hip.x - 9 * s, hip.y - 4 * s);
          ctx.lineTo(hip.x + 9 * s, hip.y - 7 * s);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
        // the scythe, swung through its arc; a green crescent follows the blade
        if (sw.smear) drawSmear(ctx, sw.pivot, sw.from, sw.a, face, s, sw.smear);
        drawScythe(ctx, sw.pivot, sw.a, face, s, alive, sw.charge, t);
        // the hood, and nothing inside it but two eyes
        const hx = head.x - face * 2.5 * s, hy = head.y - 1.5 * s;
        ctx.fillStyle = "hsl(170 18% 12%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath();
        ctx.moveTo(hx - face * 15 * s, hy + 14 * s);
        ctx.quadraticCurveTo(hx - face * 18 * s, hy - 16 * s, hx + face * 2 * s, hy - 16 * s);
        ctx.quadraticCurveTo(hx + face * 16 * s, hy - 12 * s, hx + face * 15 * s, hy + 9 * s);
        ctx.lineTo(hx + face * 6 * s, hy + 14 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "hsl(170 40% 3%)";
        ctx.beginPath();
        ctx.ellipse(head.x + face * 3.5 * s, head.y + 1 * s, 7 * s, 8.5 * s, 0, 0, TAU);
        ctx.fill();
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          const flare = act ? 1.4 : 1;
          for (const k of [0, 1]) glow(ctx, head.x + face * (1.5 + k * 5) * s, head.y - 0.5 * s, 3.4 * s * flare, "hsl(152 100% 80%)", "hsl(152 92% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        // a crown of bone points on the hood, each tipped with a soul flame
        ctx.fillStyle = "hsl(44 30% 82%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3 * s;
        for (let i = -2; i <= 2; i++) {
          const cx = hx + face * 1 * s + i * 4.6 * s, cy = hy - 14 * s + Math.abs(i) * 1.2 * s;
          const tall = (i === 0 ? 12 : Math.abs(i) === 1 ? 9 : 6) * s;
          ctx.beginPath();
          ctx.moveTo(cx - 2.6 * s, cy + 2 * s);
          ctx.lineTo(cx + i * 0.6 * s, cy - tall);
          ctx.lineTo(cx + 2.6 * s, cy + 2 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (alive) {
            ctx.globalCompositeOperation = "lighter";
            flame(ctx, cx + i * 0.6 * s, cy - tall, 3 * s, (5 + Math.sin(t * 9 + i) * 1.5) * s, "hsl(152 100% 70% / 0.85)");
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "hsl(44 30% 82%)";
          }
        }
      }
      break;
    }
    // ----- The Black Sun: a dead sun behind its head, a mantle of dark fire, a golden mask -----
    case "blacksun": {
      const cx = head.x - face * 7 * s, cy = head.y - 6 * s;
      if (layer === "back") {
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, cx, cy, 64 * s, "hsl(40 100% 62% / 0.55)", "hsl(24 100% 50% / 0)");
          // corona flares licking out around the disc
          ctx.fillStyle = "hsl(36 100% 58% / 0.85)";
          for (let i = 0; i < 14; i++) {
            const an = (i / 14) * TAU + t * 0.5;
            const len = (34 + 9 * Math.sin(t * 5 + i * 2.1) + (i % 2 ? 0 : 8)) * s;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(an - 0.13) * 22 * s, cy + Math.sin(an - 0.13) * 22 * s);
            ctx.quadraticCurveTo(cx + Math.cos(an + 0.12) * len * 0.8, cy + Math.sin(an + 0.12) * len * 0.8, cx + Math.cos(an) * len, cy + Math.sin(an) * len);
            ctx.lineTo(cx + Math.cos(an + 0.13) * 22 * s, cy + Math.sin(an + 0.13) * 22 * s);
            ctx.fill();
          }
          ctx.globalCompositeOperation = "source-over";
        }
        // the dead sun itself
        ctx.fillStyle = "hsl(250 40% 5%)";
        ctx.strokeStyle = alive ? "hsl(44 100% 74%)" : "hsl(30 30% 40%)";
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, 23 * s, 0, TAU);
        ctx.fill();
        ctx.stroke();
        // a mantle of dark fire off the shoulders
        const back = -face;
        for (let i = 0; i < 3; i++) {
          const bx = shoulder.x + back * (4 + i * 7) * s, by = shoulder.y + (2 + i * 10) * s;
          const len = (30 - i * 5 + Math.sin(t * 9 + i) * 5) * s;
          const ang = Math.atan2(-0.5, back) + Math.sin(t * 6 + i) * 0.12;
          const tip = { x: bx + Math.cos(ang) * len, y: by + Math.sin(ang) * len };
          ctx.fillStyle = i % 2 ? "hsl(14 70% 22% / 0.92)" : "hsl(24 90% 40% / 0.9)";
          ctx.beginPath();
          ctx.moveTo(bx, by - 7 * s);
          ctx.quadraticCurveTo(bx + back * len * 0.4, by - 12 * s, tip.x, tip.y);
          ctx.quadraticCurveTo(bx + back * len * 0.5, by + 6 * s, bx, by + 7 * s);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // golden mask: a crescent across the face
        const mx = head.x + face * 3 * s, my = head.y;
        ctx.fillStyle = "hsl(42 90% 58%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3 * s;
        ctx.beginPath();
        ctx.arc(mx, my, 9 * s, -Math.PI / 2, Math.PI / 2, face < 0);
        ctx.quadraticCurveTo(mx + face * 3 * s, my, mx, my - 9 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, head.x + face * 6 * s, head.y - 2 * s, 5 * s, "hsl(48 100% 85%)", "hsl(30 100% 55% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.fillStyle = "hsl(250 40% 6%)";
        ctx.beginPath();
        ctx.ellipse(head.x + face * 6 * s, head.y - 2 * s, 1.8 * s, 1.2 * s, 0, 0, TAU);
        ctx.fill();
        // a circlet of short gold rays
        ctx.strokeStyle = "hsl(44 100% 66%)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        for (let i = -3; i <= 3; i++) {
          const an = -Math.PI / 2 + i * 0.32;
          ctx.moveTo(head.x + Math.cos(an) * (HEAD + 1) * s, head.y + Math.sin(an) * (HEAD + 1) * s);
          ctx.lineTo(head.x + Math.cos(an) * (HEAD + (i % 2 ? 5 : 9)) * s, head.y + Math.sin(an) * (HEAD + (i % 2 ? 5 : 9)) * s);
        }
        ctx.stroke();
      }
      break;
    }
    // ----- The Axiom: a spiral galaxy turning behind it, a ringed void for a head, constellations on its limbs -----
    case "axiom": {
      if (layer === "back") {
        if (alive) {
          // the galaxy: two arms of stars turning slowly behind the body
          const gx = mid.x - face * 6 * s, gy = mid.y - 18 * s;
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, gx, gy, 70 * s, "hsl(272 100% 70% / 0.4)", "hsl(236 80% 40% / 0)");
          for (let arm = 0; arm < 2; arm++) {
            for (let i = 0; i < 34; i++) {
              const k = i / 33;
              const an = t * 0.5 + arm * Math.PI + k * 4;
              const rr = (8 + k * 62) * s;
              ctx.fillStyle = i % 6 === 0 ? "hsl(48 100% 86% / 0.95)" : `hsl(${272 - k * 80} 100% 78% / ${0.85 - k * 0.5})`;
              ctx.beginPath();
              ctx.arc(gx + Math.cos(an) * rr, gy + Math.sin(an) * rr * 0.45, (2.2 - k * 1.1) * s, 0, TAU);
              ctx.fill();
            }
          }
          glow(ctx, gx, gy, 12 * s, "hsl(0 0% 100% / 0.9)", "hsl(272 100% 80% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        // a planet's ring behind the head (its near half is drawn on the front pass)
        ctx.strokeStyle = alive ? "hsl(48 100% 78% / 0.85)" : "hsl(240 20% 40%)";
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.ellipse(head.x, head.y, 22 * s, 6 * s, -0.25 * face, Math.PI, TAU);
        ctx.stroke();
      } else {
        // the head is open sky: a void with a few stars in it
        ctx.fillStyle = "hsl(240 60% 6%)";
        ctx.beginPath();
        ctx.arc(head.x, head.y, (HEAD - 1) * s, 0, TAU);
        ctx.fill();
        if (alive) {
          ctx.fillStyle = "white";
          for (let i = 0; i < 5; i++) {
            const a = i * 2.4 + t * 0.3, rr = (2 + (i % 3) * 2.4) * s;
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
            ctx.fillRect(head.x + Math.cos(a) * rr, head.y + Math.sin(a) * rr, 1.5 * s, 1.5 * s);
          }
          ctx.globalAlpha = 1;
          // three eyes: stars in a row across the brow
          ctx.globalCompositeOperation = "lighter";
          for (let i = 0; i < 3; i++) glow(ctx, head.x + face * (1 + i * 3.4) * s, head.y - (1.5 + (i === 1 ? 1.5 : 0)) * s, 3.4 * s, "hsl(0 0% 100%)", "hsl(272 100% 80% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.strokeStyle = alive ? "hsl(48 100% 78% / 0.9)" : "hsl(240 20% 40%)";
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.ellipse(head.x, head.y, 22 * s, 6 * s, -0.25 * face, 0, Math.PI);
        ctx.stroke();
        // constellations traced along the limbs: a star at every joint, joined by fine lines
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "hsl(272 100% 84% / 0.55)";
          ctx.lineWidth = 0.9 * s;
          for (const chain of [[shoulder, p.eF, p.hF], [shoulder, p.eB, p.hB], [hip, p.kF, p.fF], [hip, p.kB, p.fB], [neck, mid, hip]]) {
            ctx.beginPath();
            chain.forEach((q, i) => (i ? ctx.lineTo(q.x + face * 2 * s, q.y - 2 * s) : ctx.moveTo(q.x + face * 2 * s, q.y - 2 * s)));
            ctx.stroke();
            chain.forEach((q, i) => glow(ctx, q.x + face * 2 * s, q.y - 2 * s, (2.6 + Math.sin(t * 5 + i + q.x) * 0.6) * s, "hsl(0 0% 100%)", "hsl(272 100% 80% / 0)"));
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }
      break;
    }
    // ----- The Lanternmaw: a robed deep-sea herald, tentacles under the robe, a lure hanging over its maw -----
    case "lanternmaw": {
      const back = -face;
      if (layer === "back") {
        if (alive) {
          // the dark of the deep sea gathered round it
          glow(ctx, mid.x, mid.y, 84 * s, "hsl(196 70% 6% / 0.5)", "hsl(196 70% 6% / 0)");
        }
        // tentacles spilling out from under the robe behind it
        ctx.lineCap = "round";
        for (let i = 0; i < 5; i++) {
          const a = Math.PI / 2 + back * (0.25 + i * 0.22);
          tentacle(ctx, hip.x + back * (4 + i * 4) * s, hip.y + 6 * s, a, (44 + (i % 2) * 14) * s, 7 * s, alive ? t : 0, i * 1.7, "hsl(188 40% 18%)", alive ? "hsl(66 100% 62%)" : undefined);
        }
      } else {
        // a deep hood over the head
        ctx.fillStyle = "hsl(196 50% 9%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath();
        ctx.moveTo(head.x + back * 14 * s, head.y + 10 * s);
        ctx.quadraticCurveTo(head.x + back * 18 * s, head.y - 16 * s, head.x + back * 4 * s, head.y - 17 * s);
        ctx.quadraticCurveTo(head.x + face * 14 * s, head.y - 14 * s, head.x + face * 15 * s, head.y + 2 * s);
        ctx.lineTo(head.x + face * 10 * s, head.y + 11 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // inside the hood: no face, only a wide maw of needle teeth and two pinprick eyes
        ctx.fillStyle = "hsl(200 60% 3%)";
        ctx.beginPath();
        ctx.ellipse(head.x + face * 4 * s, head.y + 1 * s, 9 * s, 8.5 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "hsl(60 30% 88%)";
        for (let i = 0; i < 5; i++) {
          const tx = head.x + face * (-2 + i * 3) * s;
          ctx.beginPath();
          ctx.moveTo(tx - 1.3 * s, head.y + 4 * s);
          ctx.lineTo(tx + 1.3 * s, head.y + 4 * s);
          ctx.lineTo(tx, head.y + (i % 2 ? 0.5 : 1.5) * s);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(tx - 1.1 * s + face * 1.5 * s, head.y + 7.5 * s);
          ctx.lineTo(tx + 1.1 * s + face * 1.5 * s, head.y + 7.5 * s);
          ctx.lineTo(tx + face * 1.5 * s, head.y + 4.6 * s);
          ctx.closePath();
          ctx.fill();
        }
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          for (const dx of [1, 6]) glow(ctx, head.x + face * dx * s, head.y - 3.5 * s, 2.6 * s, "hsl(66 100% 80%)", "hsl(66 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        // the lure: a stalk off the crown of the hood, its light hanging just in front of the maw
        const charge = !!act && act.phase === "wind" && (act.kind === "pull" || act.kind === "beam") ? 1 : 0;
        lure(ctx, head.x + back * 2 * s, head.y - 15 * s, face * (24 + charge * 8) * s, (26 + charge * 6) * s, s, t, 0, alive, "hsl(186 40% 30%)", charge ? "hsl(66 100% 84%)" : "hsl(66 100% 66%)");
        // pale, glowing veins of light down the robe
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "hsl(66 100% 64% / 0.55)";
          ctx.lineWidth = 1.3 * s;
          jagLine(ctx, [neck, mid, hip], 18, 4);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      break;
    }
    // ----- The Sporemother: a fungal hive, a great mushroom cap for a head and shelf fungus down its back -----
    case "sporemother": {
      const back = -face;
      if (layer === "back") {
        if (alive) glow(ctx, mid.x, mid.y, 86 * s, "hsl(170 80% 40% / 0.22)", "hsl(170 80% 40% / 0)");
        // shelf fungus stacked up its back
        for (let i = 0; i < 4; i++) {
          const fx = neck.x + (mid.x - neck.x) * (i / 3) + (hip.x - neck.x) * (i / 6) + back * 9 * s;
          const fy = neck.y + (hip.y - neck.y) * (i / 3.4);
          const w = (13 - i * 1.5) * s;
          ctx.fillStyle = i % 2 ? "hsl(318 24% 30%)" : "hsl(322 28% 38%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.ellipse(fx + back * w * 0.4, fy, w, 4.5 * s, back * 0.2, Math.PI, TAU);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (alive) {
            ctx.strokeStyle = "hsl(170 100% 64% / 0.7)";
            ctx.lineWidth = 1 * s;
            ctx.beginPath();
            ctx.moveTo(fx - w * 0.5 + back * w * 0.4, fy + 0.5 * s);
            ctx.lineTo(fx + w * 0.9 + back * w * 0.4, fy + 0.5 * s);
            ctx.stroke();
          }
        }
      } else {
        // the face under the cap: dark, with three small round singing mouths
        ctx.fillStyle = "hsl(310 30% 12%)";
        ctx.beginPath();
        ctx.ellipse(head.x + face * 2 * s, head.y + 3 * s, 9 * s, 8 * s, 0, 0, TAU);
        ctx.fill();
        const song = alive ? 0.6 + 0.4 * Math.sin(t * 6) : 0.4;
        for (const [dx, dy, r] of [[-1, 2, 2.6], [5, 5, 2], [1, 8, 1.6]] as const) {
          const mx = head.x + face * dx * s, my = head.y + dy * s;
          if (alive) glow(ctx, mx, my, r * 2.6 * s, "hsl(170 100% 70% / 0.6)", "hsl(170 100% 60% / 0)");
          ctx.fillStyle = alive ? "hsl(170 100% 86%)" : "hsl(300 10% 40%)";
          ctx.beginPath();
          ctx.ellipse(mx, my, r * s, r * s * song, 0, 0, TAU);
          ctx.fill();
        }
        // the cap: a wide dome, pale spots on top and glowing gills beneath
        const cx = head.x, cy = head.y - 5 * s, cw = 21 * s, chh = 15 * s;
        ctx.strokeStyle = alive ? "hsl(170 100% 66% / 0.85)" : "hsl(300 10% 40%)";
        ctx.lineWidth = 1 * s;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * 1.5 * s, cy + 2 * s);
          ctx.lineTo(cx + i * 4.6 * s, cy + 0.5 * s);
          ctx.stroke();
        }
        ctx.fillStyle = "hsl(322 30% 36%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath();
        ctx.moveTo(cx - cw, cy + 1 * s);
        ctx.bezierCurveTo(cx - cw, cy - chh * 1.3, cx + cw, cy - chh * 1.3, cx + cw, cy + 1 * s);
        ctx.quadraticCurveTo(cx, cy - 3 * s, cx - cw, cy + 1 * s);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "hsl(330 40% 84%)";
        for (const [dx, dy, r] of [[-11, -5, 2.6], [-3, -10, 3.2], [7, -8, 2.4], [13, -3, 1.8], [1, -4, 1.6]] as const) {
          ctx.beginPath();
          ctx.arc(cx + face * dx * s, cy + dy * s, r * s, 0, TAU);
          ctx.fill();
        }
        // spores lifting off the cap
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, cx, cy - 6 * s, 40 * s, 60 * s, t, 6, "hsl(170 100% 70%)", 1.5 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      break;
    }
    // ----- The Mnemovore: tall and faceless, a smooth blank mask, long fingers, a halo that keeps forgetting itself -----
    case "mnemovore": {
      const back = -face;
      if (layer === "back") {
        if (alive) {
          glow(ctx, mid.x, mid.y, 84 * s, "hsl(270 40% 10% / 0.45)", "hsl(270 40% 10% / 0)");
          // a thin halo behind the head, flickering out a piece at a time
          ctx.strokeStyle = "hsl(300 100% 84% / 0.75)";
          ctx.lineWidth = 1.6 * s;
          for (let i = 0; i < 8; i++) {
            if (Math.sin(t * 1.7 + i * 2.3) < -0.3) continue;
            const a0 = (i / 8) * TAU + t * 0.3;
            ctx.beginPath();
            ctx.arc(head.x + back * 3 * s, head.y - 6 * s, 21 * s, a0, a0 + 0.55);
            ctx.stroke();
          }
        }
      } else {
        // the mask: taller than a head, smooth and blank, with one seam down the middle
        const mx = head.x + face * 1 * s, my = head.y - 3 * s;
        ctx.fillStyle = "hsl(30 20% 88%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath();
        ctx.ellipse(mx, my, 10 * s, 15 * s, face * 0.08, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "hsl(270 10% 70% / 0.5)";
        ctx.beginPath();
        ctx.ellipse(mx - face * 3 * s, my + 2 * s, 5 * s, 11 * s, face * 0.08, 0, TAU);
        ctx.fill();
        const open = act && act.phase !== "after" ? 1 : 0;
        ctx.strokeStyle = open && alive ? "hsl(300 100% 80%)" : "hsl(270 10% 50%)";
        ctx.lineWidth = (open ? 2.6 : 1) * s;
        ctx.beginPath();
        ctx.moveTo(mx + face * 1 * s, my - 13 * s);
        ctx.lineTo(mx + face * 2 * s, my + 13 * s);
        ctx.stroke();
        if (open && alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, mx + face * 1.5 * s, my, 12 * s, "hsl(300 100% 80% / 0.6)", "hsl(300 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        // long fingers off both hands, three each, far too long
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        for (const [h, e] of [[p.hF, p.eF], [p.hB, p.eB]] as const) {
          const a = Math.atan2(h.y - e.y, h.x - e.x);
          for (let i = -1; i <= 1; i++) {
            const fa = a + i * 0.28;
            ctx.beginPath();
            ctx.moveTo(h.x, h.y);
            ctx.quadraticCurveTo(h.x + Math.cos(fa) * 9 * s, h.y + Math.sin(fa) * 9 * s, h.x + Math.cos(fa + 0.3) * 17 * s, h.y + Math.sin(fa + 0.3) * 17 * s);
            ctx.stroke();
          }
        }
      }
      break;
    }
    // ----- The Dustmoth: a furred moth head with huge dark eyes, feathered antennae, a ruff, folded wings -----
    case "dustmoth": {
      const back = -face;
      if (layer === "back") {
        if (alive) glow(ctx, mid.x, mid.y, 90 * s, "hsl(208 60% 70% / 0.14)", "hsl(208 60% 70% / 0)");
        // folded wings down its back, tips trailing behind
        const flick = alive ? Math.sin(t * 2.6) * 0.06 : 0;
        for (let w = 0; w < 2; w++) {
          const bx = shoulder.x + back * 4 * s, by = shoulder.y + 2 * s;
          const len = (62 - w * 14) * s, an = Math.PI / 2 + back * (0.5 + w * 0.35 + flick);
          const tx = bx + Math.cos(an) * len, ty = by + Math.sin(an) * len;
          ctx.fillStyle = w ? "hsl(30 16% 34%)" : "hsl(34 18% 42%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.6 * s;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx + back * 26 * s, by + len * 0.2, tx, ty);
          ctx.quadraticCurveTo(bx + back * 4 * s, by + len * 0.7, bx, by);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = "hsl(40 30% 70% / 0.6)";
          ctx.lineWidth = 1 * s;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      } else {
        // a ruff of pale fur round the neck
        ctx.fillStyle = "hsl(40 30% 82%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const a = Math.PI * (i / 10);
          const r = (i % 2 ? 9 : 12) * s;
          const x = neck.x + Math.cos(a) * r, y = neck.y + 2 * s + Math.sin(a) * r * 0.6;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // the head: round and furred
        ctx.fillStyle = "hsl(34 16% 36%)";
        ctx.beginPath();
        ctx.arc(head.x, head.y, (HEAD + 2) * s, 0, TAU);
        ctx.fill();
        ctx.stroke();
        // two huge compound eyes, glossy black with a cold moonlit shine
        for (const dx of [-5, 6]) {
          const ex = head.x + face * dx * s, ey = head.y - 1 * s;
          ctx.fillStyle = "hsl(230 30% 8%)";
          ctx.beginPath();
          ctx.ellipse(ex, ey, 6 * s, 7.5 * s, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = alive ? "hsl(208 100% 86%)" : "hsl(208 10% 50%)";
          ctx.beginPath();
          ctx.arc(ex + face * 2 * s, ey - 3 * s, 1.8 * s, 0, TAU);
          ctx.fill();
        }
        // feathered antennae curling up and back
        for (const side of [0, 1]) {
          const ax = head.x + face * (side ? 4 : -2) * s, ay = head.y - 11 * s;
          const sway = alive ? Math.sin(t * 3 + side) * 3 * s : 0;
          const tx = ax + back * (10 + side * 6) * s + sway, ty = ay - 24 * s;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.8 * s;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(ax + face * 8 * s, ay - 16 * s, tx, ty);
          ctx.stroke();
          ctx.strokeStyle = "hsl(40 24% 70%)";
          ctx.lineWidth = 1 * s;
          for (let k = 1; k <= 6; k++) {
            const u = k / 7;
            const px = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * (ax + face * 8 * s) + u * u * tx;
            const py = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * (ay - 16 * s) + u * u * ty;
            ctx.beginPath();
            ctx.moveTo(px - 3 * s, py - 1 * s);
            ctx.lineTo(px + 3 * s, py + 1 * s);
            ctx.stroke();
          }
        }
      }
      break;
    }
    // ----- The Somnarch: a sleeping giant in a drooping dream hood, closed eyes floating round its head -----
    case "somnarch": {
      const back = -face;
      if (layer === "back") {
        if (alive) glow(ctx, mid.x, mid.y, 92 * s, "hsl(46 100% 70% / 0.16)", "hsl(46 100% 70% / 0)");
        // a halo of closed eyes, drifting slowly round behind the head
        const n = 6;
        for (let i = 0; i < n; i++) {
          const an = (i / n) * TAU + t * 0.25;
          const ex = head.x + Math.cos(an) * 30 * s, ey = head.y - 4 * s + Math.sin(an) * 26 * s;
          ctx.fillStyle = "hsl(250 30% 26%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.ellipse(ex, ey, 6 * s, 3.4 * s, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
          // the shut lid, with three lashes
          ctx.strokeStyle = alive ? "hsl(46 100% 74%)" : "hsl(250 10% 50%)";
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.arc(ex, ey - 2 * s, 5 * s, 0.25 * Math.PI, 0.75 * Math.PI);
          ctx.stroke();
          for (const k of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.moveTo(ex + k * 2.6 * s, ey + 2.6 * s);
            ctx.lineTo(ex + k * 3.6 * s, ey + 4.6 * s);
            ctx.stroke();
          }
        }
      } else {
        // the head, sunk low and heavy
        ctx.fillStyle = "hsl(250 30% 22%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.arc(head.x, head.y, (HEAD + 2) * s, 0, TAU);
        ctx.fill();
        ctx.stroke();
        // two sleeping eyes and a big closed eye on the brow
        ctx.strokeStyle = alive ? "hsl(46 100% 76%)" : "hsl(250 10% 50%)";
        ctx.lineWidth = 1.5 * s;
        for (const dx of [-3, 5]) {
          ctx.beginPath();
          ctx.arc(head.x + face * dx * s, head.y + 1 * s, 2.6 * s, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(head.x + face * 1 * s, head.y - 7 * s, 5 * s, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        // the long dream hood, flopping down behind it with a little star at its tip
        const sway = alive ? Math.sin(t * 1.4) * 4 * s : 0;
        const tipX = head.x + back * 34 * s + sway, tipY = head.y + 16 * s;
        ctx.fillStyle = "hsl(252 36% 30%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(head.x - 14 * s, head.y - 2 * s);
        ctx.quadraticCurveTo(head.x - 2 * s, head.y - 24 * s, head.x + back * 22 * s, head.y - 18 * s);
        ctx.quadraticCurveTo(head.x + back * 36 * s, head.y - 10 * s, tipX, tipY);
        ctx.quadraticCurveTo(head.x + back * 22 * s, head.y - 4 * s, head.x + 14 * s, head.y - 2 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "hsl(46 100% 72% / 0.7)";
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(head.x - 14 * s, head.y - 2 * s);
        ctx.lineTo(head.x + 14 * s, head.y - 2 * s);
        ctx.stroke();
        if (alive) glow(ctx, tipX, tipY, 9 * s, "hsl(46 100% 80% / 0.9)", "hsl(46 100% 70% / 0)");
        ctx.fillStyle = alive ? "hsl(46 100% 84%)" : "hsl(46 10% 60%)";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU - Math.PI / 2, r = (i % 2 ? 1.6 : 4) * s;
          const x = tipX + Math.cos(a) * r, y = tipY + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    // ----- The Hush: a long black veil, and a cracked bronze bell where its head should be -----
    case "hush": {
      const back = -face;
      if (layer === "back") {
        if (alive) glow(ctx, mid.x, mid.y, 84 * s, "hsl(354 90% 50% / 0.14)", "hsl(354 90% 50% / 0)");
        // the veil, falling from the crown of the bell to the floor
        const sway = alive ? Math.sin(t * 0.9) * 5 * s : 0;
        ctx.fillStyle = "hsl(350 14% 8% / 0.94)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.moveTo(head.x - 6 * s, head.y - 14 * s);
        ctx.quadraticCurveTo(head.x + back * 30 * s, mid.y, hip.x + back * 30 * s + sway, hip.y + 46 * s);
        ctx.lineTo(hip.x + back * 4 * s + sway * 0.5, hip.y + 50 * s);
        ctx.quadraticCurveTo(head.x + back * 10 * s, mid.y, head.x + 6 * s, head.y - 14 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "hsl(354 90% 64% / 0.55)";
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y - 14 * s);
        ctx.quadraticCurveTo(head.x + back * 22 * s, mid.y, hip.x + back * 18 * s + sway, hip.y + 48 * s);
        ctx.stroke();
      } else {
        // a red ribbon tied tight round the neck
        ctx.strokeStyle = alive ? "hsl(354 90% 58%)" : "hsl(354 10% 40%)";
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(neck.x - 6 * s, neck.y);
        ctx.lineTo(neck.x + 6 * s, neck.y);
        ctx.stroke();
        // the bell: wide at the mouth, narrow at the crown, dark inside
        const bx = head.x, top = head.y - 15 * s, mouth = head.y + 10 * s;
        ctx.fillStyle = "hsl(32 40% 34%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath();
        ctx.moveTo(bx - 6 * s, top);
        ctx.quadraticCurveTo(bx - 9 * s, head.y, bx - 15 * s, mouth);
        ctx.lineTo(bx + 15 * s, mouth);
        ctx.quadraticCurveTo(bx + 9 * s, head.y, bx + 6 * s, top);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // a band of verdigris and the crown loop
        ctx.strokeStyle = "hsl(160 30% 50%)";
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(bx - 11 * s, head.y + 3 * s);
        ctx.lineTo(bx + 11 * s, head.y + 3 * s);
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.beginPath();
        ctx.arc(bx, top - 2 * s, 3 * s, Math.PI, TAU);
        ctx.stroke();
        // the dark mouth of the bell, a red glow deep inside it
        ctx.fillStyle = "hsl(350 30% 4%)";
        ctx.beginPath();
        ctx.ellipse(bx, mouth, 15 * s, 3.4 * s, 0, 0, TAU);
        ctx.fill();
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, bx, mouth, 8 * s, "hsl(354 100% 66% / 0.8)", "hsl(354 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        // the crack down its side
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(bx + face * 3 * s, top + 2 * s);
        ctx.lineTo(bx + face * 6 * s, head.y - 4 * s);
        ctx.lineTo(bx + face * 3 * s, head.y + 1 * s);
        ctx.lineTo(bx + face * 8 * s, mouth - 1 * s);
        ctx.stroke();
      }
      break;
    }
    // ----- The Elder Dark: arms of starless night, a cluster of eyes for a face and a crown of dead stars -----
    case "elderdark": {
      const back = -face;
      if (layer === "back") {
        if (alive) {
          glow(ctx, mid.x, mid.y, 120 * s, "hsl(268 100% 50% / 0.2)", "hsl(268 100% 50% / 0)");
          glow(ctx, mid.x, mid.y, 70 * s, "hsl(262 60% 4% / 0.6)", "hsl(262 60% 4% / 0)");
        }
        // four arms of night rising behind it, specks of starlight caught in them
        for (let i = 0; i < 4; i++) {
          const side = i % 2 ? 1 : -1, reach = (70 + i * 10) * s;
          const sw = alive ? Math.sin(t * 1.3 + i * 1.7) * 14 * s : 0;
          const bx = shoulder.x + back * 4 * s, by = shoulder.y + 4 * s;
          const tx = bx + side * (34 + i * 14) * s + sw, ty = by - reach;
          ctx.strokeStyle = "hsl(262 50% 6%)";
          ctx.lineWidth = (9 - i) * s;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.bezierCurveTo(bx + side * 30 * s, by - reach * 0.3, tx - side * 24 * s - sw, ty + reach * 0.4, tx, ty);
          ctx.stroke();
          ctx.strokeStyle = "hsl(268 100% 74% / 0.5)";
          ctx.lineWidth = 1 * s;
          ctx.stroke();
          ctx.fillStyle = "hsl(0 0% 100%)";
          for (let k = 1; k < 5; k++) {
            ctx.globalAlpha = alive ? 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i + k)) : 0.3;
            const u = k / 5;
            ctx.fillRect(bx + (tx - bx) * u + side * Math.sin(u * 3) * 10 * s, by + (ty - by) * u, 1.6 * s, 1.6 * s);
          }
          ctx.globalAlpha = 1;
        }
      } else {
        // the head: a lump of the dark with no face, only eyes
        ctx.fillStyle = "hsl(262 40% 8%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.ellipse(head.x, head.y, (HEAD + 4) * s, (HEAD + 2) * s, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "hsl(268 100% 74% / 0.6)";
        ctx.stroke();
        const eyes: [number, number, number][] = [[3, -2, 3.4], [-4, 1, 2.4], [8, 3, 2], [0, 6, 1.8], [-2, -7, 1.6]];
        eyes.forEach(([dx, dy, r], i) => {
          const ex = head.x + face * dx * s, ey = head.y + dy * s;
          const blink = alive ? Math.max(0.15, Math.abs(Math.sin(t * 0.7 + i * 1.9))) : 0.2;
          ctx.fillStyle = i % 2 ? "hsl(150 100% 66%)" : "hsl(268 100% 80%)";
          ctx.beginPath();
          ctx.ellipse(ex, ey, r * s, r * s * blink, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "hsl(262 60% 3%)";
          ctx.beginPath();
          ctx.ellipse(ex + face * 0.4 * s, ey, r * 0.3 * s, r * s * blink * 0.8, 0, 0, TAU);
          ctx.fill();
        });
        // a crown of dead stars, only a few of them still faintly burning
        for (let i = 0; i < 7; i++) {
          const a = Math.PI + (i / 6) * Math.PI;
          const cx = head.x + Math.cos(a) * 17 * s, cy = head.y - 4 * s + Math.sin(a) * 16 * s;
          const lit = alive && i % 3 === 1;
          ctx.fillStyle = lit ? "hsl(268 100% 86%)" : "hsl(262 14% 30%)";
          if (lit) glow(ctx, cx, cy, 6 * s, "hsl(268 100% 80% / 0.8)", "hsl(268 100% 80% / 0)");
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const ka = (k / 8) * TAU - Math.PI / 2, r = (k % 2 ? 1.2 : 3.4) * s;
            const x = cx + Math.cos(ka) * r, y = cy + Math.sin(ka) * r;
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
    // ----- Perihelion: a living comet, a white-hot head in a crown of ice, its cold fire tail streaming behind -----
    case "perihelion": {
      const back = -face;
      if (layer === "back") {
        if (alive) glow(ctx, mid.x, mid.y, 96 * s, "hsl(190 100% 70% / 0.18)", "hsl(190 100% 70% / 0)");
        // the tail: streamers of cold fire flowing off the head, longer the faster it moves
        const stretch = 1 + Math.min(0.8, Math.abs(vx) * 0.002);
        for (let i = 0; i < 5; i++) {
          const len = (120 + i * 14) * s * stretch;
          const wave = alive ? Math.sin(t * 4 + i * 1.3) * 8 * s : 0;
          const sx = head.x + back * 4 * s, sy = head.y + (i - 2) * 3 * s;
          const ex = sx + back * len, ey = sy - 30 * s + i * 12 * s + wave;
          if (alive) {
            const g = ctx.createLinearGradient(sx, sy, ex, ey);
            g.addColorStop(0, i % 2 ? "hsl(190 100% 84% / 0.75)" : "hsl(205 100% 66% / 0.6)");
            g.addColorStop(1, "hsl(205 100% 60% / 0)");
            ctx.strokeStyle = g;
          } else ctx.strokeStyle = "hsl(210 10% 40% / 0.25)";
          ctx.lineWidth = (12 - i * 1.8) * s;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + back * len * 0.5, sy - 10 * s + wave, ex, ey);
          ctx.stroke();
        }
      } else {
        // plates of old blue ice over the chest
        ctx.fillStyle = alive ? "hsl(200 50% 72% / 0.9)" : "hsl(210 10% 50% / 0.9)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        for (const [dx, dy, w, h] of [[-5, -8, 8, 12], [4, -4, 7, 10], [-1, 6, 6, 9]] as const) {
          const cx = mid.x + face * dx * s, cy = mid.y + dy * s;
          ctx.beginPath();
          ctx.moveTo(cx, cy - h * 0.5 * s);
          ctx.lineTo(cx + w * 0.5 * s, cy);
          ctx.lineTo(cx, cy + h * 0.5 * s);
          ctx.lineTo(cx - w * 0.5 * s, cy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // a crown of ice shards round the head, pointing out like the rays of a star
        ctx.fillStyle = alive ? "hsl(196 70% 82%)" : "hsl(210 10% 60%)";
        for (let i = 0; i < 6; i++) {
          const a = Math.PI + 0.25 + (i / 5) * (Math.PI - 0.5);
          const r0 = (HEAD + 1) * s, r1 = (HEAD + 9 + (i % 2) * 5) * s;
          const cx = head.x + back * 2 * s, cy = head.y;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a - 0.14) * r0, cy + Math.sin(a - 0.14) * r0);
          ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a + 0.14) * r0, cy + Math.sin(a + 0.14) * r0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // the head: a comet's nucleus, white hot inside a cloud of cold light
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, head.x, head.y, (30 + Math.sin(t * 6) * 2) * s, "hsl(190 100% 80% / 0.85)", "hsl(190 100% 70% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.fillStyle = alive ? "hsl(196 80% 92%)" : "hsl(210 10% 66%)";
        ctx.beginPath();
        ctx.arc(head.x, head.y, (HEAD + 0.5) * s, 0, TAU);
        ctx.fill();
        ctx.stroke();
        // one narrow eye of pure white fire, looking ahead
        ctx.fillStyle = alive ? "hsl(0 0% 100%)" : INK;
        ctx.beginPath();
        ctx.ellipse(head.x + face * 4 * s, head.y - 1 * s, 4 * s, 1.4 * s, 0, 0, TAU);
        ctx.fill();
        if (alive) glow(ctx, head.x + face * 4 * s, head.y - 1 * s, 7 * s, "hsl(190 100% 90% / 0.9)", "hsl(190 100% 80% / 0)");
      }
      break;
    }
    // ----- Asterion: the Hunter drawn in stars, a bright star at every joint and a spear of starlight -----
    case "asterion": {
      const back = -face;
      if (layer === "back") {
        if (alive) glow(ctx, mid.x, mid.y, 90 * s, "hsl(44 100% 70% / 0.14)", "hsl(44 100% 70% / 0)");
        // a turning star-chart ring behind it, marked like an old brass globe
        const cx = mid.x + back * 6 * s, cy = mid.y - 6 * s, r = 62 * s;
        ctx.strokeStyle = alive ? "hsl(44 100% 74% / 0.45)" : "hsl(44 10% 50% / 0.25)";
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.3, 0.3 + (alive ? t * 0.2 : 0), 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU + (alive ? t * 0.15 : 0), k = i % 6 === 0 ? 7 : 3;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.lineTo(cx + Math.cos(a) * (r - k * s), cy + Math.sin(a) * (r - k * s));
          ctx.stroke();
        }
      } else {
        // the spear: a shaft of starlight through the front hand, a star burning at its point
        const dx = p.hF.x - p.eF.x, dy = p.hF.y - p.eF.y, dl = Math.hypot(dx, dy) || 1;
        const ux = dx / dl, uy = dy / dl;
        const tip = { x: p.hF.x + ux * 58 * s, y: p.hF.y + uy * 58 * s };
        const butt = { x: p.hF.x - ux * 34 * s, y: p.hF.y - uy * 34 * s };
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.moveTo(butt.x, butt.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.strokeStyle = alive ? "hsl(44 100% 78%)" : "hsl(44 10% 56%)";
        ctx.lineWidth = 2 * s;
        ctx.stroke();
        const star = (x: number, y: number, r: number, lit: boolean) => {
          if (lit && alive) glow(ctx, x, y, r * 3, "hsl(44 100% 80% / 0.8)", "hsl(44 100% 70% / 0)");
          ctx.fillStyle = lit && alive ? "hsl(48 100% 94%)" : "hsl(44 10% 60%)";
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const ka = (k / 8) * TAU - Math.PI / 2, rr = k % 2 ? r * 0.4 : r;
            if (k === 0) ctx.moveTo(x + Math.cos(ka) * rr, y + Math.sin(ka) * rr);
            else ctx.lineTo(x + Math.cos(ka) * rr, y + Math.sin(ka) * rr);
          }
          ctx.closePath();
          ctx.fill();
        };
        star(tip.x, tip.y, 6 * s, true);
        // the constellation it is drawn from: lines along its limbs and a star at every joint
        const joints: Pt[] = [shoulder, p.eF, p.hF, p.eB, p.hB, hip, p.kF, p.fF, p.kB, p.fB];
        ctx.strokeStyle = alive ? "hsl(44 100% 80% / 0.55)" : "hsl(44 10% 50% / 0.3)";
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        for (const [a, b] of [[shoulder, p.eF], [p.eF, p.hF], [shoulder, p.eB], [p.eB, p.hB], [shoulder, hip], [hip, p.kF], [p.kF, p.fF], [hip, p.kB], [p.kB, p.fB]] as const) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
        joints.forEach((q, i) => star(q.x, q.y, (i === 0 ? 3.6 : 2.6) * s, i % 3 !== 2 || Math.sin(t * 3 + i) > 0));
        // the Hunter's belt: three stars in a row across the hips
        for (let i = -1; i <= 1; i++) star(hip.x + i * 5 * s, hip.y - 4 * s + i * 1.2 * s, 2.6 * s, true);
        // a helm of night with a crest of three stars, and one gold eye
        ctx.fillStyle = "hsl(232 44% 14%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.arc(head.x, head.y, (HEAD + 1) * s, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = alive ? "hsl(44 100% 74% / 0.7)" : "hsl(44 10% 50% / 0.5)";
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + back * (0.25 + i * 0.45);
          star(head.x + Math.cos(a) * (HEAD + 6 + i * 2) * s, head.y + Math.sin(a) * (HEAD + 6 + i * 2) * s, (3.4 - i * 0.6) * s, true);
        }
        star(head.x + face * 4 * s, head.y - 1 * s, 3 * s, true);
      }
      break;
    }
    // ----- Carina: the Star Mother, a nebula with a body: rose and green gas with new stars being born inside it -----
    case "carina": {
      const back = -face;
      /** A small four-pointed star, the shape her newborn stars take. */
      const spark4 = (x: number, y: number, r: number, col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.26, y - r * 0.26);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x + r * 0.26, y + r * 0.26);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.26, y + r * 0.26);
        ctx.lineTo(x - r, y);
        ctx.lineTo(x - r * 0.26, y - r * 0.26);
        ctx.closePath();
        ctx.fill();
      };
      if (layer === "back") {
        if (alive) {
          // the cloud she is made of: soft puffs of rose and green gas, slowly turning round her
          ctx.globalCompositeOperation = "lighter";
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * TAU + t * 0.25;
            const r = (34 + (i % 3) * 14) * s;
            const x = mid.x + back * 10 * s + Math.cos(a) * r * 1.3, y = mid.y - 8 * s + Math.sin(a) * r * 0.8;
            glow(ctx, x, y, (40 + (i % 2) * 16) * s, i % 2 ? "hsl(172 90% 60% / 0.22)" : "hsl(326 100% 66% / 0.26)", "hsl(310 80% 50% / 0)");
          }
          // stars being born in the cloud, twinkling on and off
          for (let i = 0; i < 9; i++) {
            const a = i * 2.4 + t * 0.2, r = (24 + ((i * 13) % 50)) * s;
            const x = mid.x + back * 8 * s + Math.cos(a) * r * 1.4, y = mid.y - 10 * s + Math.sin(a) * r * 0.9;
            spark4(x, y, (2 + (i % 3)) * s, `hsl(48 100% 94% / ${0.35 + 0.65 * Math.abs(Math.sin(t * 2 + i * 1.7))})`);
          }
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // a hood of gas drawn over the head, trailing down the back, its edge lit rose
        ctx.fillStyle = alive ? "hsl(304 36% 22%)" : "hsl(300 8% 30%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(head.x + face * (HEAD + 2) * s, head.y + 4 * s);
        ctx.quadraticCurveTo(head.x + face * (HEAD + 4) * s, head.y - (HEAD + 8) * s, head.x + back * 4 * s, head.y - (HEAD + 10) * s);
        ctx.quadraticCurveTo(head.x + back * (HEAD + 12) * s, head.y - 4 * s, head.x + back * (HEAD + 16) * s, neck.y + 16 * s);
        ctx.lineTo(head.x + back * (HEAD - 2) * s, neck.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = alive ? "hsl(326 100% 76% / 0.85)" : "hsl(300 8% 50% / 0.5)";
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(head.x + face * (HEAD + 2) * s, head.y + 4 * s);
        ctx.quadraticCurveTo(head.x + face * (HEAD + 4) * s, head.y - (HEAD + 8) * s, head.x + back * 4 * s, head.y - (HEAD + 10) * s);
        ctx.stroke();
        // her face, deep in the hood, with two green eyes
        ctx.fillStyle = alive ? "hsl(300 40% 10%)" : "hsl(300 6% 24%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.arc(head.x + face * 1.5 * s, head.y + 1 * s, (HEAD - 2) * s, 0, TAU);
        ctx.fill();
        for (const dx of [2, 7]) {
          const ex = head.x + face * dx * s, ey = head.y - 0.5 * s;
          if (alive) glow(ctx, ex, ey, 5 * s, "hsl(172 100% 76% / 0.9)", "hsl(172 100% 60% / 0)");
          ctx.fillStyle = alive ? "hsl(172 100% 88%)" : INK;
          ctx.beginPath();
          ctx.arc(ex, ey, 1.3 * s, 0, TAU);
          ctx.fill();
        }
        // her heart: a star not yet born, glowing in her chest
        const hx = mid.x + face * 2 * s, hy = shoulder.y + 10 * s;
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, hx, hy, (16 + Math.sin(t * 3) * 3) * s, "hsl(326 100% 76% / 0.85)", "hsl(326 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        spark4(hx, hy, 5 * s, alive ? "hsl(48 100% 96%)" : "hsl(300 6% 56%)");
        // a crown of three newborn stars turning slowly over the hood
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i - 1) * 0.6 + (alive ? Math.sin(t * 0.8) * 0.15 : 0);
          const x = head.x + Math.cos(a) * (HEAD + 15) * s, y = head.y - 2 * s + Math.sin(a) * (HEAD + 15) * s;
          if (alive) glow(ctx, x, y, 8 * s, i === 1 ? "hsl(172 100% 80% / 0.8)" : "hsl(326 100% 80% / 0.8)", "hsl(326 100% 60% / 0)");
          spark4(x, y, (i === 1 ? 4.5 : 3.2) * s, alive ? "hsl(48 100% 96%)" : "hsl(300 6% 56%)");
        }
      }
      break;
    }
    // ----- Orogen: a mountain range with a body, granite slabs and moss, jade light in its seams -----
    case "orogen": {
      const back = -face;
      const stone = alive ? "hsl(28 10% 40%)" : "hsl(28 4% 36%)";
      const dark = alive ? "hsl(28 10% 28%)" : "hsl(28 4% 26%)";
      const jade = alive ? "hsl(150 90% 66%)" : "hsl(150 4% 46%)";
      if (layer === "back") {
        // the peaks of its range rising off its back and shoulders, snow on every top
        for (const [dx, h, w] of [[-26, 70, 26], [-4, 96, 30], [20, 60, 22]] as const) {
          const x = shoulder.x + back * (dx + 12) * s, by = shoulder.y + 14 * s, ty = by - h * s;
          ctx.fillStyle = dx === -4 ? stone : dark;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5 * s;
          ctx.beginPath();
          ctx.moveTo(x - w * s, by);
          ctx.lineTo(x - 4 * s, ty);
          ctx.lineTo(x + 4 * s, ty + 3 * s);
          ctx.lineTo(x + w * s, by);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = alive ? "hsl(0 0% 97%)" : "hsl(0 0% 70%)";
          ctx.beginPath();
          ctx.moveTo(x - 11 * s, ty + 16 * s);
          ctx.lineTo(x - 4 * s, ty);
          ctx.lineTo(x + 4 * s, ty + 3 * s);
          ctx.lineTo(x + 12 * s, ty + 18 * s);
          ctx.lineTo(x + 2 * s, ty + 13 * s);
          ctx.closePath();
          ctx.fill();
        }
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, shoulder.x + back * 10 * s, shoulder.y - 20 * s, 70 * s, "hsl(150 90% 60% / 0.14)", "hsl(150 90% 50% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // its chest: three stacked slabs of granite over the body, a jade seam running between them
        const top = shoulder.y - 2 * s, bot = hip.y + 2 * s;
        for (let i = 0; i < 3; i++) {
          const y0 = lerp(top, bot, i / 3), y1 = lerp(top, bot, (i + 1) / 3);
          const w = (17 - i * 2) * s;
          ctx.fillStyle = i % 2 ? dark : stone;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.moveTo(mid.x - w + face * 2 * s, y0);
          ctx.lineTo(mid.x + w + face * 4 * s, y0 + 2 * s);
          ctx.lineTo(mid.x + w - 2 * s + face * 2 * s, y1);
          ctx.lineTo(mid.x - w + 3 * s, y1 - 1 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.strokeStyle = jade;
        ctx.lineWidth = 2 * s;
        if (alive) ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.moveTo(mid.x + face * 3 * s, top + 4 * s);
        ctx.lineTo(mid.x - face * 2 * s, lerp(top, bot, 0.33));
        ctx.lineTo(mid.x + face * 4 * s, lerp(top, bot, 0.55));
        ctx.lineTo(mid.x - face * 1 * s, lerp(top, bot, 0.8));
        ctx.stroke();
        if (alive) glow(ctx, mid.x, lerp(top, bot, 0.4), (14 + Math.sin(t * 2) * 2) * s, "hsl(150 100% 70% / 0.5)", "hsl(150 100% 50% / 0)");
        ctx.globalCompositeOperation = "source-over";
        // moss on the shoulder
        ctx.fillStyle = alive ? "hsl(110 40% 34%)" : "hsl(100 6% 34%)";
        ctx.beginPath();
        ctx.ellipse(shoulder.x + face * 4 * s, shoulder.y - 1 * s, 12 * s, 4 * s, 0, 0, TAU);
        ctx.fill();
        // its head: a craggy block of stone, a cap of snow, two jade eyes deep in the rock
        const hx = head.x, hy = head.y;
        ctx.fillStyle = stone;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(hx - 12 * s, hy + 10 * s);
        ctx.lineTo(hx - 14 * s, hy - 4 * s);
        ctx.lineTo(hx - 6 * s, hy - 16 * s);
        ctx.lineTo(hx + 4 * s, hy - 13 * s);
        ctx.lineTo(hx + 13 * s, hy - 6 * s);
        ctx.lineTo(hx + 12 * s, hy + 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = alive ? "hsl(0 0% 97%)" : "hsl(0 0% 72%)";
        ctx.beginPath();
        ctx.moveTo(hx - 14 * s, hy - 4 * s);
        ctx.lineTo(hx - 6 * s, hy - 16 * s);
        ctx.lineTo(hx + 4 * s, hy - 13 * s);
        ctx.lineTo(hx + 13 * s, hy - 6 * s);
        ctx.lineTo(hx + 6 * s, hy - 7 * s);
        ctx.lineTo(hx - 2 * s, hy - 9 * s);
        ctx.closePath();
        ctx.fill();
        // a heavy brow, then the eyes under it
        ctx.fillStyle = dark;
        ctx.fillRect(hx - 11 * s, hy - 3 * s, 22 * s, 4 * s);
        for (const dx of [2, 8]) {
          const ex = hx + face * dx * s, ey = hy + 3 * s;
          if (alive) glow(ctx, ex, ey, 5 * s, "hsl(150 100% 72% / 0.9)", "hsl(150 100% 60% / 0)");
          ctx.fillStyle = alive ? "hsl(150 100% 88%)" : INK;
          ctx.fillRect(ex - 1.6 * s, ey - 1 * s, 3.2 * s, 2 * s);
        }
      }
      break;
    }
    // ----- Gnarlroot: the first tree, bark and branching antlers, leaves at every tip, roots at its feet -----
    case "gnarlroot": {
      const back = -face;
      const bark = alive ? "hsl(24 30% 24%)" : "hsl(24 6% 28%)";
      const leaf = alive ? "hsl(96 60% 44%)" : "hsl(34 20% 36%)";
      const lit = alive ? "hsl(92 90% 66%)" : "hsl(34 10% 48%)";
      /** A branch that forks once, leaves at both tips. */
      const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        ctx.strokeStyle = bark;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, ex, ey);
        ctx.stroke();
        if (depth > 0) {
          branch(ex, ey, a - 0.5, len * 0.62, w * 0.6, depth - 1);
          branch(ex, ey, a + 0.45, len * 0.55, w * 0.6, depth - 1);
        } else {
          ctx.fillStyle = leaf;
          ctx.beginPath();
          ctx.ellipse(ex, ey, 5 * s, 3 * s, a, 0, TAU);
          ctx.fill();
          if (alive) {
            ctx.fillStyle = lit;
            ctx.beginPath();
            ctx.arc(ex + Math.cos(a) * 2 * s, ey + Math.sin(a) * 2 * s, 1.4 * s, 0, TAU);
            ctx.fill();
          }
        }
      };
      if (layer === "back") {
        // antlers of living wood spreading out of its head, swaying slowly
        const sway = alive ? Math.sin(t * 0.8) * 0.06 : 0;
        branch(head.x + back * 4 * s, head.y - 8 * s, -Math.PI / 2 - 0.5 * face - 0.2 + sway, 26 * s, 3.6 * s, 2);
        branch(head.x + back * 6 * s, head.y - 6 * s, -Math.PI / 2 + 0.6 * back + sway, 24 * s, 3.4 * s, 2);
        // roots spreading over the floor from its feet
        const gy = Math.max(p.fF.y, p.fB.y) + 2 * s;
        ctx.strokeStyle = bark;
        for (const [fx, dir] of [[p.fF.x, face], [p.fB.x, back]] as const) {
          for (let i = 0; i < 2; i++) {
            ctx.lineWidth = (3 - i) * s;
            ctx.beginPath();
            ctx.moveTo(fx, gy);
            ctx.quadraticCurveTo(fx + dir * (10 + i * 8) * s, gy + 2 * s, fx + dir * (22 + i * 12) * s, gy + (1 + i) * s);
            ctx.stroke();
          }
        }
      } else {
        // bark over the body, split by long grain lines
        ctx.strokeStyle = alive ? "hsl(24 30% 14%)" : "hsl(24 6% 20%)";
        ctx.lineWidth = 1.4 * s;
        for (const dx of [-5, 0, 5]) {
          ctx.beginPath();
          ctx.moveTo(shoulder.x + dx * s, shoulder.y + 4 * s);
          ctx.quadraticCurveTo(mid.x + (dx + Math.sin(dx) * 3) * s, mid.y, hip.x + dx * 0.8 * s, hip.y - 2 * s);
          ctx.stroke();
        }
        // its face: an old knot of bark with two green knotholes for eyes and a crack for a mouth
        ctx.fillStyle = bark;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.ellipse(head.x, head.y, (HEAD + 1) * s, (HEAD + 3) * s, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = alive ? "hsl(24 30% 14%)" : "hsl(24 6% 20%)";
        ctx.lineWidth = 1.1 * s;
        ctx.beginPath();
        ctx.arc(head.x - face * 3 * s, head.y + 2 * s, 7 * s, 0.4, 2.4);
        ctx.stroke();
        for (const dx of [2, 7]) {
          const ex = head.x + face * dx * s, ey = head.y - 2 * s;
          ctx.fillStyle = alive ? "hsl(24 40% 8%)" : INK;
          ctx.beginPath();
          ctx.ellipse(ex, ey, 2.2 * s, 2.8 * s, 0, 0, TAU);
          ctx.fill();
          if (alive) {
            glow(ctx, ex, ey, 5 * s, "hsl(92 100% 66% / 0.9)", "hsl(92 100% 50% / 0)");
            ctx.fillStyle = "hsl(80 100% 84%)";
            ctx.beginPath();
            ctx.arc(ex, ey, 1 * s, 0, TAU);
            ctx.fill();
          }
        }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(head.x + face * 1 * s, head.y + 6 * s);
        ctx.lineTo(head.x + face * 4 * s, head.y + 5 * s);
        ctx.lineTo(head.x + face * 7 * s, head.y + 7 * s);
        ctx.stroke();
        // a ring of leaves round the crown
        for (let i = 0; i < 5; i++) {
          const a = Math.PI + 0.3 + i * 0.6;
          ctx.fillStyle = i % 2 ? leaf : lit;
          ctx.beginPath();
          ctx.ellipse(head.x + Math.cos(a) * (HEAD + 1) * s, head.y + Math.sin(a) * (HEAD + 3) * s, 4 * s, 2.4 * s, a, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    // ----- Ambrel: living amber, a wasp sealed in its heart, a halo of honeycomb -----
    case "ambrel": {
      const back = -face;
      /** One cell of honeycomb. */
      const hex = (x: number, y: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + Math.PI / 6;
          if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
      };
      if (layer === "back") {
        // a halo of honeycomb behind its head, every cell lit gold from inside
        const hx = head.x + back * 6 * s, hy = head.y - 2 * s;
        const cells: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0.5, -0.87], [-0.5, -0.87], [0.5, 0.87], [-0.5, 0.87], [1.5, -0.87], [-1.5, -0.87], [0, -1.73]];
        for (const [i, [cx, cy]] of cells.entries()) {
          const x = hx + cx * 15 * s, y = hy + cy * 15 * s;
          hex(x, y, 8 * s);
          ctx.fillStyle = alive ? `hsl(40 100% ${44 + 10 * Math.abs(Math.sin(t * 1.4 + i))}% / 0.85)` : "hsl(36 10% 40% / 0.8)";
          ctx.fill();
          ctx.strokeStyle = alive ? "hsl(30 80% 22%)" : INK;
          ctx.lineWidth = 1.4 * s;
          ctx.stroke();
        }
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, hx, hy - 8 * s, 50 * s, "hsl(44 100% 66% / 0.3)", "hsl(44 100% 50% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // the amber of its body, clear gold, with the sealed wasp curled in its chest
        const cx = mid.x + face * 1 * s, cy = (shoulder.y + hip.y) / 2;
        const g = ctx.createRadialGradient(cx - face * 4 * s, cy - 8 * s, 2 * s, cx, cy, 22 * s);
        g.addColorStop(0, alive ? "hsl(48 100% 76% / 0.95)" : "hsl(40 10% 60% / 0.9)");
        g.addColorStop(1, alive ? "hsl(30 90% 36% / 0.92)" : "hsl(30 6% 34% / 0.9)");
        ctx.fillStyle = g;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 13 * s, (hip.y - shoulder.y) * 0.56, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        // the wasp: body, striped abdomen, folded wings
        ctx.fillStyle = alive ? "hsl(24 60% 14% / 0.8)" : "hsl(24 6% 20% / 0.8)";
        ctx.beginPath();
        ctx.ellipse(cx, cy - 4 * s, 2.6 * s, 3 * s, 0, 0, TAU);
        ctx.ellipse(cx + face * 1 * s, cy + 4 * s, 3.4 * s, 5.4 * s, face * 0.2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = alive ? "hsl(46 100% 70% / 0.8)" : "hsl(40 10% 56% / 0.6)";
        ctx.lineWidth = 1 * s;
        for (const dy of [3, 6]) {
          ctx.beginPath();
          ctx.moveTo(cx - 2.6 * s, cy + dy * s);
          ctx.lineTo(cx + face * 1 * s + 3 * s, cy + (dy - 0.6) * s);
          ctx.stroke();
        }
        ctx.fillStyle = "hsl(0 0% 100% / 0.35)";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(cx + side * 4 * s, cy - 2 * s, 4 * s, 1.8 * s, side * 0.5, 0, TAU);
          ctx.fill();
        }
        // its head: a cut amber gem with one dark eye in it like a fossil
        ctx.fillStyle = alive ? "hsl(38 100% 52%)" : "hsl(36 8% 44%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y - (HEAD + 3) * s);
        ctx.lineTo(head.x + (HEAD + 1) * s, head.y - 4 * s);
        ctx.lineTo(head.x + HEAD * 0.7 * s, head.y + (HEAD + 1) * s);
        ctx.lineTo(head.x - HEAD * 0.7 * s, head.y + (HEAD + 1) * s);
        ctx.lineTo(head.x - (HEAD + 1) * s, head.y - 4 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = alive ? "hsl(50 100% 84% / 0.7)" : "hsl(0 0% 80% / 0.3)";
        ctx.beginPath();
        ctx.moveTo(head.x, head.y - (HEAD + 3) * s);
        ctx.lineTo(head.x - (HEAD + 1) * s, head.y - 4 * s);
        ctx.lineTo(head.x - 3 * s, head.y - 3 * s);
        ctx.closePath();
        ctx.fill();
        const ex = head.x + face * 4 * s, ey = head.y + 1 * s;
        if (alive) glow(ctx, ex, ey, 7 * s, "hsl(20 100% 50% / 0.5)", "hsl(20 100% 40% / 0)");
        ctx.fillStyle = alive ? "hsl(20 60% 10%)" : INK;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.6 * s, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = alive ? "hsl(48 100% 80%)" : "hsl(0 0% 60%)";
        ctx.lineWidth = 0.9 * s;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.6 * s, -1.2, 0.6);
        ctx.stroke();
        // resin dripping slowly off the front hand
        if (alive) {
          const k = (t * 0.6) % 1;
          ctx.fillStyle = "hsl(40 100% 54% / 0.9)";
          ctx.beginPath();
          ctx.ellipse(p.hF.x, p.hF.y + 3 * s + k * 14 * s, 1.8 * s, 2.4 * s + k * 1.4 * s, 0, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    // ----- Vela: a pulsar, a burnt-out star spinning in its chest, two beams sweeping from it like a lighthouse -----
    case "vela": {
      const spin = alive ? t * 2.2 : 0;
      const core = { x: mid.x, y: shoulder.y + 9 * s };
      if (layer === "back") {
        if (alive) {
          glow(ctx, mid.x, mid.y, 86 * s, "hsl(32 100% 60% / 0.16)", "hsl(32 100% 60% / 0)");
          // its magnetic field: loops out of the top of it and back in at the bottom
          ctx.strokeStyle = "hsl(276 80% 72% / 0.32)";
          ctx.lineWidth = 1.2 * s;
          for (const k of [1, 1.5, 2.1]) {
            for (const side of [-1, 1]) {
              ctx.beginPath();
              ctx.ellipse(core.x + side * 16 * k * s, core.y, 16 * k * s, 34 * k * s, 0, 0, TAU);
              ctx.stroke();
            }
          }
          // two beams out of its poles, sweeping round and round like a lighthouse
          ctx.globalCompositeOperation = "lighter";
          for (const a of [spin, spin + Math.PI]) {
            const len = 170 * s, w = 13 * s;
            const ex = core.x + Math.cos(a) * len, ey = core.y + Math.sin(a) * len;
            const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
            const g = ctx.createLinearGradient(core.x, core.y, ex, ey);
            g.addColorStop(0, "hsl(40 100% 86% / 0.75)");
            g.addColorStop(1, "hsl(32 100% 60% / 0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(core.x, core.y);
            ctx.lineTo(ex + nx, ey + ny);
            ctx.lineTo(ex - nx, ey - ny);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // plates of dark glass over the chest
        ctx.fillStyle = alive ? "hsl(250 22% 22%)" : "hsl(250 6% 34%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        for (const [dx, dy, w, h] of [[-7, -4, 9, 14], [7, -4, 9, 14], [0, 10, 12, 8]] as const) {
          const cx = mid.x + face * dx * s, cy = mid.y + dy * s;
          ctx.beginPath();
          ctx.moveTo(cx - w * 0.5 * s, cy - h * 0.5 * s);
          ctx.lineTo(cx + w * 0.5 * s, cy - h * 0.3 * s);
          ctx.lineTo(cx + w * 0.4 * s, cy + h * 0.5 * s);
          ctx.lineTo(cx - w * 0.5 * s, cy + h * 0.4 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // the heart: a dead star the size of a city, white hot, with a ring spinning round it
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, core.x, core.y, (20 + Math.abs(Math.sin(t * 2.4 * Math.PI)) * 5) * s, "hsl(36 100% 74% / 0.9)", "hsl(32 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.strokeStyle = alive ? "hsl(32 100% 70%)" : "hsl(250 6% 50%)";
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath();
        ctx.ellipse(core.x, core.y, 10 * s, 3.6 * s, spin, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = alive ? "hsl(48 100% 96%)" : "hsl(250 6% 60%)";
        ctx.beginPath();
        ctx.arc(core.x, core.y, 4 * s, 0, TAU);
        ctx.fill();
        // a smooth helm with one amber slit that blinks on the beat
        ctx.fillStyle = alive ? "hsl(250 24% 18%)" : "hsl(250 6% 30%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.arc(head.x, head.y, (HEAD + 1) * s, 0, TAU);
        ctx.fill();
        ctx.stroke();
        const lit = !alive ? 0 : 0.45 + 0.55 * Math.abs(Math.sin(t * 2.4 * Math.PI));
        ctx.fillStyle = alive ? `hsl(36 100% 74% / ${lit})` : INK;
        ctx.fillRect(head.x + (face > 0 ? -1 : -9) * s, head.y - 2 * s, 10 * s, 2.6 * s);
        // a ring of ticks round the helm, like the face of a clock, with one hand going round
        ctx.strokeStyle = alive ? "hsl(32 100% 72% / 0.8)" : "hsl(250 6% 50% / 0.5)";
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU, r0 = (HEAD + 4) * s, r1 = (HEAD + (i % 3 === 0 ? 9 : 6.5)) * s;
          ctx.moveTo(head.x + Math.cos(a) * r0, head.y + Math.sin(a) * r0);
          ctx.lineTo(head.x + Math.cos(a) * r1, head.y + Math.sin(a) * r1);
        }
        ctx.stroke();
        if (alive) {
          const a = t * 1.2 - Math.PI / 2;
          ctx.strokeStyle = "hsl(48 100% 92%)";
          ctx.lineWidth = 1.6 * s;
          ctx.beginPath();
          ctx.moveTo(head.x + Math.cos(a) * (HEAD + 3) * s, head.y + Math.sin(a) * (HEAD + 3) * s);
          ctx.lineTo(head.x + Math.cos(a) * (HEAD + 11) * s, head.y + Math.sin(a) * (HEAD + 11) * s);
          ctx.stroke();
        }
      }
      break;
    }
    // ----- Aeon: the first star, a tall figure of white fire whose head is one great eye, a gold halo behind it -----
    case "aeon": {
      const back = -face;
      // it blinks slowly, about once every seven seconds
      const blink = !alive ? 1 : Math.max(0, 1 - Math.abs(((t % 7) - 6.8) / 0.12));
      if (layer === "back") {
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, head.x, head.y, 96 * s, "hsl(46 100% 70% / 0.22)", "hsl(46 100% 60% / 0)");
          // the halo: a gold ring behind the head with long and short rays standing out of it, turning very slowly
          const hr = (HEAD + 16) * s;
          ctx.strokeStyle = "hsl(46 100% 72% / 0.9)";
          ctx.lineWidth = 2.4 * s;
          ctx.beginPath();
          ctx.arc(head.x + back * 2 * s, head.y, hr, 0, TAU);
          ctx.stroke();
          ctx.lineWidth = 1.6 * s;
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * TAU + t * 0.12, len = (i % 2 ? 7 : 15) * s;
            ctx.moveTo(head.x + back * 2 * s + Math.cos(a) * (hr + 3 * s), head.y + Math.sin(a) * (hr + 3 * s));
            ctx.lineTo(head.x + back * 2 * s + Math.cos(a) * (hr + 3 * s + len), head.y + Math.sin(a) * (hr + 3 * s + len));
          }
          ctx.stroke();
          // two thin rings tilted round the body like an old star map, the far halves behind it
          ctx.strokeStyle = "hsl(222 90% 70% / 0.4)";
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.ellipse(mid.x, mid.y, 44 * s, 12 * s, 0.35 + Math.sin(t * 0.3) * 0.08, Math.PI, TAU);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(mid.x, mid.y, 40 * s, 11 * s, -0.5 + Math.sin(t * 0.25) * 0.08, Math.PI, TAU);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // the near halves of the star-map rings
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "hsl(222 90% 74% / 0.55)";
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.ellipse(mid.x, mid.y, 44 * s, 12 * s, 0.35 + Math.sin(t * 0.3) * 0.08, 0, Math.PI);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(mid.x, mid.y, 40 * s, 11 * s, -0.5 + Math.sin(t * 0.25) * 0.08, 0, Math.PI);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
        // a small sun burning in its chest
        const cx = mid.x + face * 1.5 * s, cy = shoulder.y + 10 * s;
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, cx, cy, (15 + Math.sin(t * 1.6) * 2) * s, "hsl(46 100% 74% / 0.9)", "hsl(46 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.fillStyle = alive ? "hsl(48 100% 96%)" : "hsl(42 6% 60%)";
        ctx.beginPath();
        ctx.arc(cx, cy, 3.6 * s, 0, TAU);
        ctx.fill();
        // the head is one great eye: a white ball ringed in gold, its iris deep sapphire with a gold star for a pupil
        const er = (HEAD + 2) * s;
        ctx.fillStyle = alive ? "hsl(48 60% 96%)" : "hsl(42 6% 66%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.arc(head.x, head.y, er, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = alive ? "hsl(44 100% 60%)" : "hsl(42 6% 46%)";
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.arc(head.x, head.y, er - 1.8 * s, 0, TAU);
        ctx.stroke();
        if (blink < 0.95) {
          const ix = head.x + face * 3 * s, iy = head.y;
          ctx.save();
          ctx.beginPath();
          ctx.arc(head.x, head.y, er - 2.6 * s, 0, TAU);
          ctx.clip();
          ctx.fillStyle = alive ? "hsl(228 76% 34%)" : INK;
          ctx.beginPath();
          ctx.arc(ix, iy, 5.6 * s, 0, TAU);
          ctx.fill();
          if (alive) {
            ctx.globalCompositeOperation = "lighter";
            glow(ctx, ix, iy, 7 * s, "hsl(46 100% 76% / 0.95)", "hsl(46 100% 60% / 0)");
            ctx.globalCompositeOperation = "source-over";
          }
          ctx.fillStyle = alive ? "hsl(48 100% 94%)" : "hsl(42 6% 70%)";
          ctx.beginPath();
          ctx.arc(ix, iy, 1.8 * s, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        // the lid: closes over the eye when it blinks, and stays shut once it falls
        if (blink > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(head.x, head.y, er - 0.8 * s, 0, TAU);
          ctx.clip();
          ctx.fillStyle = alive ? "hsl(42 30% 80%)" : "hsl(42 6% 52%)";
          ctx.fillRect(head.x - er, head.y - er, er * 2, er * 2 * blink);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.moveTo(head.x - er, head.y - er + er * 2 * blink);
          ctx.lineTo(head.x + er, head.y - er + er * 2 * blink);
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }
  }
  ctx.restore();
  if (layer === "front") drawBossExtras(ctx, design, layer, p, s, face, t, alive, vx, act);
  if (layer === "front" && phase > 1 && alive) drawBossPhase(ctx, design, layer, p, s, face, t, phase);
}

/**
 * What a boss grows as it breaks into its 2nd, 3rd and 4th phase (BOSS_PHASES in bosses.ts). Each phase keeps
 * the pieces of the phases before it and adds its own, so a 4th-phase boss wears all three.
 */
function drawBossPhase(
  ctx: CanvasRenderingContext2D, design: BossDesign, layer: "back" | "front", p: BossRig,
  s: number, face: number, t: number, phase: number,
) {
  const { head, hip, shoulder, neck } = p;
  const mid = { x: (hip.x + head.x) / 2, y: (hip.y + head.y) / 2 };
  const back = -face;
  const front = layer === "front";
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  /** Things circling the body: the near half is drawn on the front pass, the far half on the back pass. */
  const orbit = (n: number, rx: number, ry: number, cy: number, speed: number, draw: (x: number, y: number, i: number, depth: number) => void) => {
    for (let i = 0; i < n; i++) {
      const an = t * speed + (i / n) * TAU;
      const depth = Math.sin(an);
      if (depth > 0 !== front) continue;
      draw(mid.x + Math.cos(an) * rx * s, cy + depth * ry * s, i, depth);
    }
  };
  switch (design) {
    // ----- Nullshade -----
    case "antimatter": {
      // 2: a matter orb and an antimatter orb circling each other around the body
      ctx.globalCompositeOperation = "lighter";
      orbit(2, 46, 14, mid.y, 2.2, (x, y, i) => {
        glow(ctx, x, y, 12 * s, i ? "hsl(186 100% 80% / 0.9)" : "hsl(0 0% 100% / 0.95)", "hsl(186 100% 60% / 0)");
        ctx.fillStyle = i ? "hsl(268 70% 10%)" : "hsl(0 0% 100%)";
        ctx.beginPath();
        ctx.arc(x, y, 4.5 * s, 0, TAU);
        ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
      if (phase >= 3) {
        if (!front) {
          // 3: a broken halo turning behind the head
          ctx.strokeStyle = "hsl(186 100% 74% / 0.9)";
          ctx.lineWidth = 2.6 * s;
          for (let i = 0; i < 5; i++) {
            const a0 = t * 1.2 + (i / 5) * TAU;
            ctx.beginPath();
            ctx.arc(head.x, head.y - 4 * s, (22 + (i % 2) * 3) * s, a0, a0 + 0.8);
            ctx.stroke();
          }
        } else {
          // and cracks of pure antimatter across the body
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = `hsl(186 100% 76% / ${0.6 + 0.3 * Math.sin(t * 7)})`;
          ctx.lineWidth = 1.8 * s;
          jagLine(ctx, [{ x: neck.x - 4 * s, y: neck.y + 4 * s }, { x: mid.x + 5 * s, y: mid.y }, { x: hip.x - 3 * s, y: hip.y - 4 * s }], 5, 1);
          jagLine(ctx, [{ x: mid.x + 5 * s, y: mid.y }, { x: mid.x + 14 * s, y: mid.y + 10 * s }], 4, 2);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      if (phase >= 4 && !front) {
        // 4: wings of erased space, shards of black edged in light
        const flap = Math.sin(t * 2.4) * 0.12;
        for (let side = 0; side < 2; side++) {
          const dir = side ? back : -back;
          for (let j = 0; j < 4; j++) {
            const an = -Math.PI / 2 + dir * (0.5 + j * 0.32 + flap);
            const len = (70 - j * 9) * s;
            const bx = shoulder.x + dir * 4 * s, by = shoulder.y + j * 4 * s;
            const tx = bx + Math.cos(an) * len, ty = by + Math.sin(an) * len;
            const nx = Math.cos(an + Math.PI / 2) * 7 * s, ny = Math.sin(an + Math.PI / 2) * 7 * s;
            ctx.fillStyle = "hsl(268 60% 4% / 0.92)";
            ctx.strokeStyle = "hsl(186 100% 72% / 0.85)";
            ctx.lineWidth = 1.4 * s;
            ctx.beginPath();
            ctx.moveTo(bx + nx, by + ny);
            ctx.lineTo(tx, ty);
            ctx.lineTo(bx - nx, by - ny);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      break;
    }
    // ----- Maelstrom -----
    case "maelstrom": {
      // 2: the sea swirling around its waist, throwing off spray
      ctx.strokeStyle = "hsl(186 100% 80% / 0.8)";
      ctx.lineWidth = 3 * s;
      ctx.setLineDash([12 * s, 7 * s]);
      for (let i = 0; i < 2; i++) {
        ctx.lineDashOffset = t * (i ? 70 : -55) * s;
        const a0 = front ? 0.15 : Math.PI + 0.15;
        ctx.beginPath();
        ctx.ellipse(hip.x, hip.y - (4 + i * 10) * s, (30 + i * 6) * s, (7 + i * 2) * s, 0, a0, a0 + Math.PI - 0.3);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      if (front) motes(ctx, hip.x, hip.y, 70 * s, 40 * s, t * 2, 6, "hsl(186 100% 86%)", 1.8 * s);
      if (phase >= 3) {
        const cy = head.y - 30 * s;
        if (!front) {
          // 3: a storm cloud crowning its head
          for (let i = 0; i < 6; i++) {
            const x = head.x + (i - 2.5) * 8 * s + Math.sin(t * 2 + i) * 2 * s;
            ctx.fillStyle = i % 2 ? "hsl(222 25% 22%)" : "hsl(222 22% 30%)";
            ctx.beginPath();
            ctx.arc(x, cy + Math.sin(i * 1.7) * 4 * s, (10 + (i % 3) * 3) * s, 0, TAU);
            ctx.fill();
          }
        } else if (Math.floor(t * 6) % 5 === 0) {
          // and lightning that answers it
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "hsl(54 100% 78%)";
          ctx.lineWidth = 2.2 * s;
          const sx = head.x + Math.sin(Math.floor(t * 6) * 3.1) * 16 * s;
          jagLine(ctx, [{ x: sx, y: cy + 6 * s }, { x: sx + 6 * s, y: cy + 22 * s }, { x: head.x, y: head.y - 10 * s }], 6, Math.floor(t * 6));
          ctx.globalCompositeOperation = "source-over";
        }
      }
      if (phase >= 4 && !front) {
        // 4: a sea serpent from the deep, coiling up behind it
        const segs = 16;
        for (let i = segs; i >= 0; i--) {
          const u = i / segs;
          const x = hip.x + back * (26 - 40 * u) * s + Math.sin(t * 2 + u * 7) * 16 * s;
          const y = hip.y + 18 * s - u * 120 * s;
          const r = (4 + 9 * Math.sin(u * Math.PI * 0.9 + 0.2)) * s;
          ctx.fillStyle = i % 2 ? "hsl(200 70% 16%)" : "hsl(195 60% 22%)";
          ctx.strokeStyle = "hsl(170 100% 62% / 0.5)";
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
          ctx.stroke();
          if (i === segs) {
            ctx.fillStyle = "hsl(200 70% 14%)";
            ctx.beginPath();
            ctx.ellipse(x - back * 8 * s, y - 2 * s, 13 * s, 7 * s, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.globalCompositeOperation = "lighter";
            glow(ctx, x - back * 12 * s, y - 4 * s, 5 * s, "hsl(170 100% 80%)", "hsl(170 100% 60% / 0)");
            ctx.globalCompositeOperation = "source-over";
          }
        }
      }
      break;
    }
    // ----- Magmaw -----
    case "magmaw": {
      if (front) {
        // 2: magma running down its body and dripping off its fists
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `hsl(28 100% 58% / ${0.7 + 0.2 * Math.sin(t * 5)})`;
        ctx.lineWidth = 2.4 * s;
        jagLine(ctx, [{ x: neck.x + 3 * s, y: neck.y + 2 * s }, { x: mid.x - 4 * s, y: mid.y }, { x: hip.x + 4 * s, y: hip.y }], 4, 3);
        for (const h of [p.hF, p.hB]) {
          for (let i = 0; i < 2; i++) {
            const k = (t * 1.4 + i * 0.5) % 1;
            glow(ctx, h.x, h.y + k * 30 * s, (3.5 - k * 2) * s, "hsl(44 100% 70%)", "hsl(20 100% 50% / 0)");
          }
        }
        ctx.globalCompositeOperation = "source-over";
      }
      if (phase >= 3) {
        if (!front) {
          // 3: a column of ash pouring up from its shoulders
          for (let i = 0; i < 8; i++) {
            const k = (t * 0.5 + i / 8) % 1;
            const x = shoulder.x + back * 6 * s + Math.sin(i * 2.1 + t) * 10 * s * (1 + k);
            ctx.fillStyle = `hsl(20 8% ${18 + (i % 3) * 6}% / ${0.75 * (1 - k)})`;
            ctx.beginPath();
            ctx.arc(x, shoulder.y - 10 * s - k * 100 * s, (7 + k * 14) * s, 0, TAU);
            ctx.fill();
          }
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, shoulder.x, shoulder.y - 10 * s, 40 * s, 110 * s, t * 1.4, 7, "hsl(28 100% 62%)", 1.6 * s);
          ctx.globalCompositeOperation = "source-over";
        } else {
          // and vents glowing open on its shoulders
          for (const dx of [-8, 8]) {
            const x = shoulder.x + dx * s, y = shoulder.y - 2 * s;
            ctx.fillStyle = "hsl(20 20% 14%)";
            ctx.beginPath();
            ctx.moveTo(x - 6 * s, y + 3 * s);
            ctx.lineTo(x - 2.5 * s, y - 8 * s);
            ctx.lineTo(x + 2.5 * s, y - 8 * s);
            ctx.lineTo(x + 6 * s, y + 3 * s);
            ctx.closePath();
            ctx.fill();
            flame(ctx, x, y - 7 * s, 3 * s, (8 + Math.sin(t * 12 + dx) * 3) * s, "hsl(32 100% 60%)");
          }
        }
      }
      if (phase >= 4) {
        // 4: a ring of obsidian circling it and a white-hot core in its chest
        orbit(6, 50, 16, mid.y + 6 * s, 1.6, (x, y) => {
          ctx.fillStyle = "hsl(260 18% 12%)";
          ctx.strokeStyle = "hsl(36 100% 62% / 0.9)";
          ctx.lineWidth = 1.3 * s;
          ctx.beginPath();
          ctx.moveTo(x - 6 * s, y);
          ctx.lineTo(x - 1 * s, y - 7 * s);
          ctx.lineTo(x + 6 * s, y - 2 * s);
          ctx.lineTo(x + 3 * s, y + 6 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
        if (front) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, mid.x, mid.y - 6 * s, (14 + Math.sin(t * 8) * 2) * s, "hsl(52 100% 92%)", "hsl(30 100% 55% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
      }
      break;
    }
    // ----- Everwinter -----
    case "everwinter": {
      if (front) {
        // 2: spikes of black ice along its shoulders
        for (let i = 0; i < 4; i++) {
          const x = shoulder.x + back * (i * 5 - 4) * s, y = shoulder.y + i * 3 * s;
          const h = (16 - i * 2.5) * s;
          ctx.fillStyle = "hsl(214 40% 18%)";
          ctx.strokeStyle = "hsl(200 90% 86%)";
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.moveTo(x - 3.5 * s, y);
          ctx.lineTo(x + back * 6 * s, y - h);
          ctx.lineTo(x + 3.5 * s, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      if (phase >= 3 && !front) {
        // 3: a frozen clock face turning behind it
        const r = 60 * s;
        ctx.fillStyle = "hsl(44 60% 70% / 0.14)";
        ctx.strokeStyle = "hsl(44 95% 70% / 0.85)";
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.arc(mid.x, mid.y - 6 * s, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const an = (i / 12) * TAU;
          const r0 = r * (i % 3 ? 0.88 : 0.8);
          ctx.lineWidth = (i % 3 ? 1.4 : 2.4) * s;
          ctx.beginPath();
          ctx.moveTo(mid.x + Math.cos(an) * r0, mid.y - 6 * s + Math.sin(an) * r0);
          ctx.lineTo(mid.x + Math.cos(an) * r * 0.97, mid.y - 6 * s + Math.sin(an) * r * 0.97);
          ctx.stroke();
        }
        for (const [len, sp, w] of [[0.55, 0.3, 3], [0.8, 2.4, 1.8]] as const) {
          const an = t * sp - Math.PI / 2;
          ctx.strokeStyle = "hsl(200 90% 90% / 0.9)";
          ctx.lineWidth = w * s;
          ctx.beginPath();
          ctx.moveTo(mid.x, mid.y - 6 * s);
          ctx.lineTo(mid.x + Math.cos(an) * r * len, mid.y - 6 * s + Math.sin(an) * r * len);
          ctx.stroke();
        }
      }
      if (phase >= 4) {
        if (!front) {
          // 4: a blizzard that never stops
          motes(ctx, mid.x, hip.y + 30 * s, 150 * s, 170 * s, t * 1.6, 16, "hsl(0 0% 100% / 0.9)", 1.8 * s, -1);
        } else {
          // and a crown of icicles
          for (let i = 0; i < 5; i++) {
            const x = head.x + (i - 2) * 5 * s;
            const h = (i === 2 ? 20 : i % 2 ? 14 : 10) * s;
            ctx.fillStyle = "hsl(195 90% 92%)";
            ctx.strokeStyle = "hsl(205 60% 50%)";
            ctx.lineWidth = 1 * s;
            ctx.beginPath();
            ctx.moveTo(x - 2.8 * s, head.y - 9 * s);
            ctx.lineTo(x, head.y - 9 * s - h);
            ctx.lineTo(x + 2.8 * s, head.y - 9 * s);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      break;
    }
    // ----- The Riftmaker -----
    case "riftmaker": {
      if (!front) {
        // 2: two mirror copies of its body swaying out at its sides
        ctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 2; k++) {
          const dx = (k ? 1 : -1) * (24 + Math.sin(t * 1.7 + k * 2) * 6) * s;
          const dy = Math.sin(t * 2.3 + k) * 3 * s;
          ctx.strokeStyle = k ? "hsl(186 100% 70% / 0.32)" : "hsl(318 100% 70% / 0.32)";
          ctx.lineWidth = 5 * s;
          ctx.beginPath();
          for (const seg of [[hip, neck], [hip, p.kF, p.fF], [hip, p.kB, p.fB], [shoulder, p.eF, p.hF], [shoulder, p.eB, p.hB]]) {
            ctx.moveTo(seg[0].x + dx, seg[0].y + dy);
            for (const q of seg.slice(1)) ctx.lineTo(q.x + dx, q.y + dy);
          }
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(head.x + dx, head.y + dy, HEAD * s, 0, TAU);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      if (phase >= 3) {
        if (!front) {
          // 3: the tear opens into a ring of open space full of stars
          const rx = mid.x + back * 6 * s, ry = mid.y - 10 * s, r = 62 * s;
          ctx.fillStyle = "hsl(258 70% 7% / 0.9)";
          ctx.beginPath();
          ctx.arc(rx, ry, r, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "white";
          for (let i = 0; i < 18; i++) {
            const an = i * 2.4 + t * 0.15, d = r * (0.15 + ((i * 0.37) % 0.8));
            ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * 4 + i * 1.3);
            ctx.fillRect(rx + Math.cos(an) * d, ry + Math.sin(an) * d, 1.7 * s, 1.7 * s);
          }
          ctx.globalAlpha = 1;
          ctx.lineWidth = 3 * s;
          ctx.setLineDash([16 * s, 9 * s]);
          for (let i = 0; i < 2; i++) {
            ctx.strokeStyle = i ? "hsl(186 100% 70% / 0.9)" : "hsl(318 100% 70% / 0.9)";
            ctx.lineDashOffset = t * (i ? -60 : 60) * s;
            ctx.beginPath();
            ctx.arc(rx, ry, r - i * 4 * s, 0, TAU);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else {
          // and two more eyes open on its brow beside the third
          for (const dx of [-5, 5]) {
            const ex = head.x + face * 1 * s + dx * s, ey = head.y - 4.5 * s;
            glow(ctx, ex, ey, 5 * s, "hsl(186 100% 80% / 0.9)", "hsl(186 100% 60% / 0)");
            ctx.fillStyle = "hsl(0 0% 100%)";
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1 * s;
            ctx.beginPath();
            ctx.ellipse(ex, ey, 2.4 * s, 1.5 * s, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "hsl(186 100% 40%)";
            ctx.beginPath();
            ctx.arc(ex, ey, 0.9 * s, 0, TAU);
            ctx.fill();
          }
        }
      }
      if (phase >= 4) {
        if (!front) {
          // 4: a turning cube of broken space framing it
          const cx = mid.x, cy = mid.y - 8 * s, e = 52 * s;
          const ay = t * 0.7, ax = 0.5 + Math.sin(t * 0.4) * 0.2;
          const pts = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => {
            const x1 = x * Math.cos(ay) - z * Math.sin(ay), z1 = x * Math.sin(ay) + z * Math.cos(ay);
            const y1 = y * Math.cos(ax) - z1 * Math.sin(ax);
            return { x: cx + x1 * e, y: cy + y1 * e };
          })));
          ctx.lineWidth = 2 * s;
          for (let a = 0; a < 8; a++) {
            for (const bit of [1, 2, 4]) {
              const b = a ^ bit;
              if (b < a) continue;
              ctx.strokeStyle = bit === 2 ? "hsl(318 100% 72% / 0.85)" : "hsl(186 100% 72% / 0.85)";
              ctx.beginPath();
              ctx.moveTo(pts[a].x, pts[a].y);
              ctx.lineTo(pts[b].x, pts[b].y);
              ctx.stroke();
            }
          }
        } else {
          // and its body glitching into slices that slip sideways
          const tick = Math.floor(t * 9);
          ctx.globalCompositeOperation = "lighter";
          for (let i = 0; i < 3; i++) {
            const k = Math.abs(Math.sin(tick * 3.7 + i * 2.9));
            const y = head.y - 12 * s + k * (p.fF.y - head.y + 12 * s);
            const off = Math.sin(tick * 5.3 + i) * 10 * s;
            ctx.fillStyle = i % 2 ? "hsl(186 100% 60% / 0.5)" : "hsl(318 100% 62% / 0.5)";
            ctx.fillRect(mid.x - 22 * s + off, y, 44 * s, (2 + (i % 2) * 2) * s);
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }
      break;
    }
    // ----- The Hollow King -----
    case "hollow": {
      if (front) {
        // 2: green soul fire running along the hem of its cloak
        ctx.globalCompositeOperation = "lighter";
        const hemY = hip.y + 44 * s;
        for (let i = 0; i < 6; i++) {
          const x = hip.x + back * (34 - i * 7) * s;
          flame(ctx, x, hemY - (i % 2 ? 14 : 3) * s, 3.4 * s, (8 + Math.sin(t * 10 + i * 1.9) * 3) * s, "hsl(152 100% 66% / 0.8)");
        }
        ctx.globalCompositeOperation = "source-over";
        // and a chain of small skulls hung from its belt
        for (let i = 0; i < 4; i++) {
          const u = (i + 0.5) / 4;
          const x = hip.x - 10 * s + u * 20 * s, y = hip.y + (2 + Math.sin(u * Math.PI) * 6) * s + Math.sin(t * 3 + i) * 0.8 * s;
          ctx.fillStyle = "hsl(44 30% 84%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1 * s;
          ctx.beginPath();
          ctx.arc(x, y, 2.8 * s, 0, TAU);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "hsl(152 100% 50%)";
          ctx.fillRect(x - 1.5 * s, y - 0.6 * s, 1 * s, 1 * s);
          ctx.fillRect(x + 0.5 * s, y - 0.6 * s, 1 * s, 1 * s);
        }
      }
      if (phase >= 3 && !front) {
        // 3: two ghost knights of its fallen court, hooded wisps with soul eyes
        for (const side of [-1, 1]) {
          const gx = hip.x + side * 52 * s, gy = mid.y - 6 * s + Math.sin(t * 1.8 + side) * 4 * s;
          const gr = ctx.createLinearGradient(0, gy - 30 * s, 0, gy + 44 * s);
          gr.addColorStop(0, "hsl(152 60% 60% / 0.5)");
          gr.addColorStop(1, "hsl(152 60% 40% / 0)");
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.moveTo(gx, gy - 30 * s);
          ctx.quadraticCurveTo(gx + 16 * s, gy - 26 * s, gx + 15 * s, gy);
          for (let i = 0; i <= 4; i++) ctx.lineTo(gx + (15 - i * 7.5) * s, gy + (i % 2 ? 36 : 44) * s + Math.sin(t * 4 + i) * 3 * s);
          ctx.quadraticCurveTo(gx - 16 * s, gy - 26 * s, gx, gy - 30 * s);
          ctx.fill();
          ctx.strokeStyle = "hsl(152 80% 70% / 0.6)";
          ctx.lineWidth = 1.2 * s;
          ctx.stroke();
          // a ghostly blade held upright
          ctx.strokeStyle = "hsl(150 60% 80% / 0.55)";
          ctx.lineWidth = 2.2 * s;
          ctx.beginPath();
          ctx.moveTo(gx - side * 12 * s, gy + 24 * s);
          ctx.lineTo(gx - side * 12 * s, gy - 30 * s);
          ctx.stroke();
          ctx.globalCompositeOperation = "lighter";
          for (const ex of [-3.5, 3.5]) glow(ctx, gx + ex * s, gy - 16 * s, 3 * s, "hsl(152 100% 80%)", "hsl(152 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
      }
      if (phase >= 4) {
        if (!front) {
          // 4: wings of bone and torn shadow
          const flap = Math.sin(t * 2) * 0.1;
          for (const dir of [-1, 1]) {
            const root = { x: shoulder.x + dir * 3 * s, y: shoulder.y + 2 * s };
            const tips = [0, 1, 2, 3].map((j) => {
              const an = -Math.PI / 2 + dir * (0.35 + j * 0.38 + flap);
              const len = (84 - j * 12) * s;
              return { x: root.x + Math.cos(an) * len, y: root.y + Math.sin(an) * len };
            });
            // the torn membrane between the bones
            ctx.fillStyle = "hsl(170 40% 5% / 0.82)";
            ctx.beginPath();
            ctx.moveTo(root.x, root.y);
            tips.forEach((tp, j) => {
              ctx.lineTo(tp.x, tp.y);
              if (j < tips.length - 1) {
                const nx = tips[j + 1];
                ctx.lineTo((tp.x + nx.x) / 2 + (root.x - (tp.x + nx.x) / 2) * 0.3, (tp.y + nx.y) / 2 + (root.y - (tp.y + nx.y) / 2) * 0.3 + Math.sin(t * 5 + j) * 2 * s);
              }
            });
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "hsl(44 30% 82%)";
            ctx.lineWidth = 2.2 * s;
            for (const tp of tips) {
              ctx.beginPath();
              ctx.moveTo(root.x, root.y);
              ctx.lineTo(tp.x, tp.y);
              ctx.stroke();
            }
          }
        } else {
          // and a ring of soul fire burning over its crown
          const cx = head.x - face * 1.5 * s, cy = head.y - 30 * s;
          ctx.strokeStyle = "hsl(152 100% 66% / 0.8)";
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 16 * s, 4 * s, 0, 0, TAU);
          ctx.stroke();
          ctx.globalCompositeOperation = "lighter";
          for (let i = 0; i < 8; i++) {
            const an = t * 1.5 + (i / 8) * TAU;
            flame(ctx, cx + Math.cos(an) * 16 * s, cy + Math.sin(an) * 4 * s, 2.6 * s, (6 + Math.sin(t * 11 + i) * 2) * s, "hsl(152 100% 70% / 0.85)");
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }
      break;
    }
    // ----- The Black Sun -----
    case "blacksun": {
      const cx = head.x - face * 7 * s, cy = head.y - 6 * s;
      // 2: three sunspots broken off the disc, circling the body with a tail of fire
      orbit(3, 48, 14, mid.y, 1.8, (x, y, i) => {
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, x, y, 12 * s, "hsl(36 100% 60% / 0.8)", "hsl(24 100% 50% / 0)");
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "hsl(250 40% 6%)";
        ctx.strokeStyle = "hsl(44 100% 70%)";
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.arc(x, y, (4.5 + (i % 2)) * s, 0, TAU);
        ctx.fill();
        ctx.stroke();
      });
      if (phase >= 3 && !front) {
        // 3: a ring of black flame round the dead sun, a diamond of light running round its edge
        ctx.fillStyle = "hsl(250 40% 5% / 0.92)";
        for (let i = 0; i < 16; i++) {
          const an = (i / 16) * TAU - t * 0.7;
          const len = (40 + 8 * Math.sin(t * 6 + i * 1.7)) * s;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(an - 0.14) * 30 * s, cy + Math.sin(an - 0.14) * 30 * s);
          ctx.quadraticCurveTo(cx + Math.cos(an + 0.1) * len * 0.85, cy + Math.sin(an + 0.1) * len * 0.85, cx + Math.cos(an) * len, cy + Math.sin(an) * len);
          ctx.lineTo(cx + Math.cos(an + 0.14) * 30 * s, cy + Math.sin(an + 0.14) * 30 * s);
          ctx.fill();
        }
        ctx.strokeStyle = "hsl(44 100% 72% / 0.9)";
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, 30 * s, 0, TAU);
        ctx.stroke();
        const dn = t * 1.3;
        const dx = cx + Math.cos(dn) * 30 * s, dy = cy + Math.sin(dn) * 30 * s;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, dx, dy, 14 * s, "hsl(0 0% 100%)", "hsl(44 100% 70% / 0)");
        ctx.strokeStyle = "hsl(0 0% 100% / 0.9)";
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.moveTo(dx - 12 * s, dy); ctx.lineTo(dx + 12 * s, dy);
        ctx.moveTo(dx, dy - 12 * s); ctx.lineTo(dx, dy + 12 * s);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
      if (phase >= 4) {
        if (!front) {
          // 4: a white-hot blaze behind the cracked sun
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, cx, cy, (82 + Math.sin(t * 7) * 5) * s, "hsl(48 100% 92% / 0.75)", "hsl(36 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        } else {
          // and the dead sun cracking open, white fire pouring out along its top edge
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = `hsl(0 0% 100% / ${0.75 + 0.2 * Math.sin(t * 9)})`;
          ctx.lineWidth = 2.6 * s;
          ctx.beginPath();
          ctx.arc(cx, cy, 23.5 * s, Math.PI * 1.05, Math.PI * 1.95);
          ctx.stroke();
          ctx.lineWidth = 1.8 * s;
          for (let i = 0; i < 5; i++) {
            const an = Math.PI * (1.12 + i * 0.19);
            jagLine(ctx, [{ x: cx + Math.cos(an) * 15 * s, y: cy + Math.sin(an) * 15 * s }, { x: cx + Math.cos(an) * 24 * s, y: cy + Math.sin(an) * 24 * s }, { x: cx + Math.cos(an + 0.05) * (34 + Math.sin(t * 8 + i) * 4) * s, y: cy + Math.sin(an + 0.05) * (34 + Math.sin(t * 8 + i) * 4) * s }], 4, i + 1);
          }
          // its fists burning white
          for (const h of [p.hF, p.hB]) flame(ctx, h.x, h.y + 2 * s, 4.5 * s, (13 + Math.sin(t * 12 + h.x) * 3) * s, "hsl(48 100% 90% / 0.9)");
          ctx.globalCompositeOperation = "source-over";
        }
      }
      break;
    }
    // ----- The Axiom -----
    case "axiom": {
      // 2: a nebula blooming in its chest and three small worlds in orbit
      if (!front) {
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, mid.x, mid.y - 8 * s, (44 + Math.sin(t * 2) * 4) * s, "hsl(300 100% 70% / 0.5)", "hsl(200 100% 60% / 0)");
        glow(ctx, mid.x + face * 8 * s, mid.y - 16 * s, 26 * s, "hsl(200 100% 76% / 0.45)", "hsl(200 100% 60% / 0)");
        ctx.globalCompositeOperation = "source-over";
      }
      orbit(3, 52, 16, mid.y - 6 * s, 1.1, (x, y, i) => {
        const cols = ["hsl(200 80% 60%)", "hsl(20 80% 56%)", "hsl(290 60% 62%)"];
        ctx.fillStyle = cols[i];
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.arc(x, y, (5 + i) * s, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (i === 1) {
          ctx.strokeStyle = "hsl(44 80% 76%)";
          ctx.beginPath();
          ctx.ellipse(x, y, 10 * s, 3 * s, -0.3, 0, TAU);
          ctx.stroke();
        }
      });
      if (phase >= 3) {
        if (front) {
          // 3: a crown of stars over its head
          ctx.globalCompositeOperation = "lighter";
          for (let i = 0; i < 7; i++) {
            const an = -Math.PI / 2 + (i - 3) * 0.36;
            const rr = (HEAD + 12 + (i % 2 ? 0 : 5)) * s;
            const x = head.x + Math.cos(an) * rr, y = head.y + Math.sin(an) * rr;
            glow(ctx, x, y, (5 + Math.sin(t * 6 + i) * 1.2) * s, "hsl(0 0% 100%)", "hsl(48 100% 80% / 0)");
          }
          ctx.globalCompositeOperation = "source-over";
        } else {
          // and a second galaxy turning the other way, tilted
          const gx = mid.x + back * 18 * s, gy = mid.y - 30 * s;
          ctx.globalCompositeOperation = "lighter";
          for (let i = 0; i < 40; i++) {
            const k = i / 39;
            const an = -t * 0.7 + (i % 2) * Math.PI + k * 3.6;
            const rr = (6 + k * 80) * s;
            ctx.fillStyle = `hsl(${48 - k * 20} 100% 80% / ${0.7 - k * 0.45})`;
            ctx.beginPath();
            ctx.arc(gx + Math.cos(an) * rr * 0.5, gy + Math.sin(an) * rr, (1.9 - k) * s, 0, TAU);
            ctx.fill();
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }
      if (phase >= 4 && !front) {
        // 4: a black hole behind it, its accretion disc burning white
        const bx = head.x + back * 10 * s, by = mid.y - 34 * s;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, bx, by, (96 + Math.sin(t * 5) * 6) * s, "hsl(272 100% 80% / 0.55)", "hsl(250 80% 40% / 0)");
        ctx.strokeStyle = "hsl(48 100% 88% / 0.9)";
        ctx.lineWidth = 5 * s;
        ctx.beginPath();
        ctx.ellipse(bx, by, 58 * s, 14 * s, 0.15, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = "hsl(0 0% 100% / 0.8)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(bx, by, 32 * s, 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "hsl(0 0% 0%)";
        ctx.beginPath();
        ctx.arc(bx, by, 30 * s, 0, TAU);
        ctx.fill();
        // matter spiralling in
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 12; i++) {
          const k = (t * 0.6 + i / 12) % 1;
          const an = i * 2.1 + k * 6;
          const rr = (90 - k * 58) * s;
          ctx.fillStyle = `hsl(272 100% 84% / ${0.9 * k})`;
          ctx.fillRect(bx + Math.cos(an) * rr, by + Math.sin(an) * rr * 0.4, 2 * s, 2 * s);
        }
        ctx.globalCompositeOperation = "source-over";
      }
      break;
    }
    case "lanternmaw": {
      // 2: two more lures uncurl from its shoulders
      if (front) {
        for (const [k, side] of [[1, face], [2, back]] as const) {
          lure(ctx, shoulder.x + side * 4 * s, shoulder.y - 2 * s, side * 30 * s, 34 * s, s, t, k * 2.3, true, "hsl(186 40% 30%)", "hsl(66 100% 66%)");
        }
      } else {
        // and its robe hem splits into more tentacles
        ctx.lineCap = "round";
        for (let i = 0; i < 4; i++) {
          tentacle(ctx, hip.x + (i - 1.5) * 8 * s, hip.y + 14 * s, Math.PI / 2 + (i - 1.5) * 0.35, 40 * s, 6 * s, t, 3 + i * 1.3, "hsl(184 44% 16%)", "hsl(66 100% 60%)");
        }
      }
      if (phase >= 3 && front) {
        // 3: eyes all down its body, none of them ever closing
        const spots: [number, number, number][] = [
          [mid.x + face * 3 * s, mid.y - 6 * s, 3.4],
          [mid.x - face * 4 * s, mid.y + 8 * s, 2.8],
          [neck.x + face * 2 * s, neck.y + 6 * s, 2.4],
          [(shoulder.x + p.eF.x) / 2, (shoulder.y + p.eF.y) / 2, 2.4],
          [(shoulder.x + p.eB.x) / 2, (shoulder.y + p.eB.y) / 2, 2.2],
          [hip.x + face * 5 * s, hip.y - 4 * s, 2.6],
        ];
        spots.forEach(([x, y, r], i) => deepEye(ctx, x, y, r * s, face, t, i * 1.9));
      }
      if (phase >= 4 && !front) {
        // 4: a vast eye opening in the dark behind it, and a crown of tentacles over its head
        const ex = head.x + back * 12 * s, ey = mid.y - 46 * s;
        glow(ctx, ex, ey, 110 * s, "hsl(200 70% 4% / 0.85)", "hsl(200 70% 4% / 0)");
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, ex, ey, (80 + Math.sin(t * 2) * 5) * s, "hsl(66 100% 60% / 0.35)", "hsl(66 100% 50% / 0)");
        ctx.globalCompositeOperation = "source-over";
        const open = 0.75 + 0.25 * Math.sin(t * 0.7);
        ctx.fillStyle = "hsl(60 30% 82%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 62 * s, 30 * s * open, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, 62 * s, 30 * s * open, 0, 0, TAU);
        ctx.clip();
        const ix = ex + face * 14 * s + Math.sin(t * 0.6) * 6 * s;
        ctx.fillStyle = "hsl(64 100% 50%)";
        ctx.beginPath();
        ctx.arc(ix, ey, 26 * s, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "hsl(40 100% 40% / 0.7)";
        ctx.lineWidth = 1.2 * s;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU;
          ctx.beginPath();
          ctx.moveTo(ix + Math.cos(a) * 9 * s, ey + Math.sin(a) * 9 * s);
          ctx.lineTo(ix + Math.cos(a) * 24 * s, ey + Math.sin(a) * 24 * s);
          ctx.stroke();
        }
        ctx.fillStyle = "hsl(200 60% 3%)";
        ctx.beginPath();
        ctx.ellipse(ix, ey, 5 * s, 22 * s, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.lineCap = "round";
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.32;
          tentacle(ctx, head.x + Math.cos(a) * 12 * s, head.y + Math.sin(a) * 12 * s, a, (34 + (i % 2) * 12) * s, 5 * s, t, 9 + i, "hsl(180 50% 14%)", "hsl(66 100% 66%)");
        }
      }
      break;
    }
    case "sporemother": {
      if (front) {
        // 2: caps bursting open on its shoulders and arms, gills glowing
        const caps: [Pt, number][] = [[shoulder, 7], [p.eF, 5.5], [p.eB, 5], [{ x: hip.x, y: hip.y - 4 * s }, 6]];
        caps.forEach(([q, r], i) => {
          const pulse = 1 + Math.sin(t * 4 + i) * 0.08;
          ctx.fillStyle = "hsl(170 100% 66% / 0.8)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y - 1 * s, r * s * pulse, 1.6 * s, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = i % 2 ? "hsl(322 30% 40%)" : "hsl(316 34% 46%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y - 1.5 * s, r * s * pulse, r * 0.7 * s, 0, Math.PI, TAU);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      } else {
        // and tall caps growing behind it
        for (let i = 0; i < 3; i++) {
          const x = hip.x + back * (14 + i * 10) * s, y = hip.y + 22 * s, h = (34 + i * 10) * s;
          ctx.strokeStyle = "hsl(40 20% 76%)";
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + back * 6 * s, y - h * 0.5, x + Math.sin(t + i) * 3 * s, y - h);
          ctx.stroke();
          ctx.fillStyle = "hsl(318 30% 34%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.ellipse(x + Math.sin(t + i) * 3 * s, y - h, 10 * s, 7 * s, 0, Math.PI, TAU);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          glow(ctx, x + Math.sin(t + i) * 3 * s, y - h + 1 * s, 9 * s, "hsl(170 100% 66% / 0.6)", "hsl(170 100% 60% / 0)");
        }
      }
      if (phase >= 3) {
        // 3: a crown of thin fruiting bodies around its head, each with a glowing tip
        orbit(9, 20, 5, head.y - 16 * s, 0.8, (x, y, i) => {
          ctx.strokeStyle = "hsl(40 24% 80%)";
          ctx.lineWidth = 1.6 * s;
          ctx.beginPath();
          ctx.moveTo(x, y + 6 * s);
          ctx.lineTo(x, y - (6 + (i % 3) * 4) * s);
          ctx.stroke();
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, x, y - (6 + (i % 3) * 4) * s, 5 * s, "hsl(170 100% 76% / 0.9)", "hsl(170 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
        });
      }
      if (phase >= 4 && !front) {
        // 4: a web of glowing mycelium spreading out behind it, through the floor and up the air
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `hsl(170 100% 60% / ${0.35 + 0.15 * Math.sin(t * 3)})`;
        ctx.lineWidth = 1.4 * s;
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI + (i / 9) * Math.PI;
          const len = (80 + (i % 3) * 30) * s;
          jagLine(ctx, [{ x: mid.x, y: mid.y }, { x: mid.x + Math.cos(a) * len * 0.5, y: mid.y + Math.sin(a) * len * 0.5 }, { x: mid.x + Math.cos(a + 0.2) * len, y: mid.y + Math.sin(a + 0.2) * len }], 10, i);
        }
        glow(ctx, hip.x, hip.y + 26 * s, 90 * s, "hsl(170 100% 50% / 0.3)", "hsl(170 100% 50% / 0)");
        ctx.globalCompositeOperation = "source-over";
      }
      break;
    }
    case "mnemovore": {
      if (front) {
        // 2: the blank mask splits open down its seam into a mouth of stolen light
        const mx = head.x + face * 2 * s, my = head.y - 3 * s;
        const gape = 3.5 + Math.sin(t * 3) * 1;
        ctx.fillStyle = "hsl(280 50% 8%)";
        ctx.beginPath();
        ctx.ellipse(mx, my + 1 * s, gape * s, 12 * s, face * 0.08, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, mx, my + 1 * s, 10 * s, "hsl(300 100% 80% / 0.7)", "hsl(300 100% 60% / 0)");
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "hsl(30 20% 92%)";
        for (let i = 0; i < 5; i++) {
          const ty = my - 8 * s + i * 4 * s;
          ctx.beginPath();
          ctx.moveTo(mx - gape * s, ty);
          ctx.lineTo(mx - gape * s + 2.4 * s, ty + 1.2 * s);
          ctx.lineTo(mx - gape * s, ty + 2.4 * s);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(mx + gape * s, ty + 1.2 * s);
          ctx.lineTo(mx + gape * s - 2.4 * s, ty + 2.4 * s);
          ctx.lineTo(mx + gape * s, ty + 3.6 * s);
          ctx.fill();
        }
      }
      if (phase >= 3) {
        // 3: the faces of everyone it has eaten, drifting round it like masks
        orbit(6, 48, 14, mid.y - 6 * s, 0.9, (x, y, i, depth) => {
          ctx.globalAlpha = 0.55 + 0.4 * Math.abs(depth);
          ctx.fillStyle = "hsl(30 18% 86%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2 * s;
          ctx.beginPath();
          ctx.ellipse(x, y + Math.sin(t * 2 + i) * 4 * s, 6 * s, 8 * s, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "hsl(280 50% 10%)";
          for (const dx of [-2.2, 2.2]) {
            ctx.beginPath();
            ctx.ellipse(x + dx * s, y - 2 * s + Math.sin(t * 2 + i) * 4 * s, 1.2 * s, 1.8 * s, 0, 0, TAU);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        });
      }
      if (phase >= 4 && !front) {
        // 4: the world behind it goes blank as a page, and a ring of written names burns round its head
        const px = mid.x + back * 6 * s, py = mid.y - 24 * s;
        ctx.fillStyle = `hsl(40 30% 94% / ${0.55 + 0.1 * Math.sin(t)})`;
        ctx.strokeStyle = "hsl(270 20% 40% / 0.6)";
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.rect(px - 50 * s, py - 70 * s, 100 * s, 130 * s);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "hsl(270 20% 60% / 0.35)";
        for (let i = 0; i < 9; i++) {
          const ly = py - 56 * s + i * 13 * s;
          const fade = (Math.sin(t * 0.8 + i) + 1) / 2;
          ctx.beginPath();
          ctx.moveTo(px - 40 * s, ly);
          ctx.lineTo(px - 40 * s + 80 * s * fade, ly);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "hsl(300 100% 80% / 0.9)";
        ctx.lineWidth = 1.4 * s;
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU + t * 0.5;
          const r = 30 * s;
          const x = head.x + Math.cos(a) * r, y = head.y - 6 * s + Math.sin(a) * r * 0.9;
          ctx.beginPath();
          ctx.moveTo(x - 2 * s, y + 2 * s);
          ctx.lineTo(x, y - 2 * s);
          ctx.lineTo(x + 2 * s, y + 1 * s);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      break;
    }
    case "dustmoth": {
      if (!front) {
        // 2: the wings spread wide, each with a great staring eyespot
        const beat = Math.sin(t * 3) * 0.1;
        for (const dir of [1, -1]) {
          const bx = shoulder.x, by = shoulder.y;
          ctx.fillStyle = "hsl(34 20% 40% / 0.96)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.bezierCurveTo(bx + dir * 40 * s, by - (70 + beat * 60) * s, bx + dir * 96 * s, by - (50 + beat * 40) * s, bx + dir * 88 * s, by + 6 * s);
          ctx.quadraticCurveTo(bx + dir * 60 * s, by + 40 * s, bx, by + 18 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          const ex = bx + dir * 56 * s, ey = by - 18 * s - beat * 30 * s;
          ctx.fillStyle = "hsl(40 80% 56%)";
          ctx.beginPath();
          ctx.arc(ex, ey, 14 * s, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "hsl(230 30% 8%)";
          ctx.beginPath();
          ctx.arc(ex, ey, 9 * s, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "hsl(208 100% 88%)";
          ctx.beginPath();
          ctx.arc(ex + face * 3 * s, ey - 3 * s, 2.6 * s, 0, TAU);
          ctx.fill();
        }
      }
      if (phase >= 3 && front) {
        // 3: a crescent of stolen moonlight held in its jaws, scales shedding off it
        const cx = head.x + face * 12 * s, cy = head.y + 8 * s;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, cx, cy, 16 * s, "hsl(208 100% 86% / 0.7)", "hsl(208 100% 70% / 0)");
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "hsl(208 60% 94%)";
        ctx.beginPath();
        ctx.arc(cx, cy, 8 * s, 0, TAU);
        ctx.arc(cx - face * 4 * s, cy - 2 * s, 7 * s, 0, TAU, true);
        ctx.fill("evenodd");
        ctx.globalCompositeOperation = "lighter";
        motes(ctx, mid.x, hip.y + 20 * s, 90 * s, 120 * s, t, 10, "hsl(40 60% 80%)", 1.6 * s, -1);
        ctx.globalCompositeOperation = "source-over";
      }
      if (phase >= 4 && !front) {
        // 4: the moon behind it goes dark, and a second pair of wings made of night sky opens over the first
        const mx = mid.x + back * 10 * s, my = head.y - 40 * s;
        glow(ctx, mx, my, 70 * s, "hsl(208 100% 86% / 0.5)", "hsl(208 100% 80% / 0)");
        ctx.fillStyle = "hsl(230 40% 6%)";
        ctx.beginPath();
        ctx.arc(mx, my, 44 * s, 0, TAU);
        ctx.fill();
        for (const dir of [1, -1]) {
          const bx = shoulder.x, by = shoulder.y - 6 * s;
          ctx.fillStyle = "hsl(232 50% 8% / 0.95)";
          ctx.strokeStyle = "hsl(208 100% 84% / 0.8)";
          ctx.lineWidth = 1.6 * s;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.bezierCurveTo(bx + dir * 60 * s, by - 120 * s, bx + dir * 140 * s, by - 90 * s, bx + dir * 130 * s, by - 20 * s);
          ctx.quadraticCurveTo(bx + dir * 80 * s, by - 10 * s, bx, by);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "hsl(0 0% 100%)";
          for (let i = 0; i < 9; i++) {
            const u = (i * 0.37) % 1, v = (i * 0.61) % 1;
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i);
            ctx.fillRect(bx + dir * (30 + u * 90) * s, by - (24 + v * 70) * s, 1.8 * s, 1.8 * s);
          }
          ctx.globalAlpha = 1;
        }
      }
      break;
    }
    case "somnarch": {
      if (!front) {
        // 2: pillows of dream cloud drifting up behind it
        ctx.fillStyle = "hsl(256 60% 80% / 0.28)";
        for (let i = 0; i < 5; i++) {
          const k = (t * 0.08 + i / 5) % 1;
          const cx = mid.x + Math.sin(i * 2.3) * 60 * s, cy = hip.y + 20 * s - k * 150 * s, r = (12 + (i % 3) * 5) * s;
          ctx.globalAlpha = Math.sin(k * Math.PI);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, TAU);
          ctx.arc(cx + r * 0.9, cy + r * 0.2, r * 0.7, 0, TAU);
          ctx.arc(cx - r * 0.9, cy + r * 0.25, r * 0.6, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        // 2: small gold eyes, wide awake now, circling it
        orbit(5, 46, 12, mid.y, 0.8, (x, y) => {
          ctx.fillStyle = "hsl(46 100% 80%)";
          ctx.beginPath();
          ctx.ellipse(x, y, 4.4 * s, 2.6 * s, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "hsl(250 40% 10%)";
          ctx.beginPath();
          ctx.arc(x, y, 1.4 * s, 0, TAU);
          ctx.fill();
        });
      }
      if (phase >= 3 && front) {
        // 3: the eye on its brow opens, gold and hungry
        const ex = head.x + face * 1 * s, ey = head.y - 7 * s;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, ex, ey, 12 * s, "hsl(46 100% 70% / 0.8)", "hsl(46 100% 60% / 0)");
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "hsl(46 100% 74%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 6 * s, 3.6 * s, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "hsl(250 50% 8%)";
        ctx.beginPath();
        ctx.ellipse(ex, ey, 1.2 * s, 3.2 * s, 0, 0, TAU);
        ctx.fill();
      }
      if (phase >= 4 && !front) {
        // 4: a black spiral of endless sleep turning behind it
        const cx = mid.x + back * 6 * s, cy = head.y - 10 * s;
        glow(ctx, cx, cy, 90 * s, "hsl(250 60% 4% / 0.7)", "hsl(250 60% 4% / 0)");
        ctx.strokeStyle = "hsl(46 100% 72% / 0.6)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        for (let i = 0; i <= 90; i++) {
          const a = i * 0.2 - t * 1.2, r = i * 0.9 * s;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case "hush": {
      if (!front) {
        // 2: silent rings spreading out from the bell, red and soundless
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.5 + i / 3) % 1;
          ctx.strokeStyle = `hsl(354 100% 70% / ${(1 - k) * 0.6})`;
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.arc(head.x, head.y, (16 + k * 80) * s, 0, TAU);
          ctx.stroke();
        }
      }
      if (phase >= 3) {
        // 3: the voices it has taken, pale threads pulled tight from the bell
        orbit(6, 54, 14, head.y - 30 * s, 0.6, (x, y) => {
          ctx.strokeStyle = "hsl(0 0% 96% / 0.55)";
          ctx.lineWidth = 1 * s;
          ctx.beginPath();
          ctx.moveTo(head.x, head.y - 14 * s);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.fillStyle = "hsl(354 100% 84%)";
          ctx.beginPath();
          ctx.arc(x, y, 2.4 * s, 0, TAU);
          ctx.fill();
        });
      }
      if (phase >= 4 && !front) {
        // 4: the bell splits, and behind it is only the dark between the stars
        const cx = head.x + back * 4 * s, cy = head.y - 6 * s;
        ctx.fillStyle = "hsl(350 40% 3%)";
        ctx.strokeStyle = "hsl(354 100% 66%)";
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU, r = (i % 2 ? 40 : 52) * s;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "hsl(0 0% 100%)";
        for (let i = 0; i < 12; i++) {
          ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
          ctx.fillRect(cx + Math.sin(i * 7.1) * 32 * s, cy + Math.cos(i * 3.7) * 30 * s, 1.6 * s, 1.6 * s);
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "elderdark": {
      if (front) {
        // 2: eyes opening all over its body
        const spots: [Pt, number][] = [[mid, 3], [p.eF, 2.4], [p.eB, 2.2], [{ x: hip.x, y: hip.y - 6 * s }, 2.6], [shoulder, 2.2]];
        spots.forEach(([q, r], i) => {
          const blink = Math.max(0.2, Math.abs(Math.sin(t * 0.9 + i * 2.1)));
          ctx.fillStyle = "hsl(262 50% 6%)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, (r + 1.4) * s, (r + 1) * s, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = i % 2 ? "hsl(268 100% 80%)" : "hsl(150 100% 66%)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, r * s, r * s * blink, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "hsl(262 60% 3%)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, r * 0.3 * s, r * s * blink * 0.8, 0, 0, TAU);
          ctx.fill();
        });
      }
      if (phase >= 3) {
        // 3: the constellations come down and circle it, joined by faint lines
        const pts: Pt[] = [];
        orbit(7, 64, 18, mid.y - 10 * s, 0.35, (x, y) => {
          pts.push({ x, y });
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, x, y, 7 * s, "hsl(268 100% 86% / 0.9)", "hsl(268 100% 70% / 0)");
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "hsl(0 0% 100%)";
          ctx.fillRect(x - 1.5 * s, y - 1.5 * s, 3 * s, 3 * s);
        });
        ctx.strokeStyle = "hsl(268 100% 84% / 0.45)";
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
        ctx.stroke();
      }
      if (phase >= 4 && !front) {
        // 4: the sky behind it tears open on one enormous eye, older than the stars
        const cx = mid.x + back * 8 * s, cy = head.y - 50 * s;
        glow(ctx, cx, cy, 120 * s, "hsl(150 100% 50% / 0.25)", "hsl(150 100% 50% / 0)");
        ctx.fillStyle = "hsl(262 60% 3%)";
        ctx.strokeStyle = "hsl(268 100% 80%)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(cx - 96 * s, cy);
        ctx.quadraticCurveTo(cx, cy - 66 * s, cx + 96 * s, cy);
        ctx.quadraticCurveTo(cx, cy + 66 * s, cx - 96 * s, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const look = Math.sin(t * 0.6) * 14 * s;
        ctx.fillStyle = "hsl(150 100% 56%)";
        ctx.beginPath();
        ctx.arc(cx + look, cy, 26 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "hsl(262 60% 3%)";
        ctx.beginPath();
        ctx.ellipse(cx + look, cy, 5 * s, 22 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "hsl(0 0% 100% / 0.8)";
        ctx.beginPath();
        ctx.arc(cx + look - 9 * s, cy - 9 * s, 3 * s, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "perihelion": {
      if (!front) {
        // 2: two tails: a straight blue one of ions and a curved gold one of dust
        const sx = head.x + back * 4 * s, sy = head.y;
        ctx.globalCompositeOperation = "lighter";
        const ion = ctx.createLinearGradient(sx, sy, sx + back * 220 * s, sy - 60 * s);
        ion.addColorStop(0, "hsl(205 100% 70% / 0.7)");
        ion.addColorStop(1, "hsl(205 100% 60% / 0)");
        ctx.strokeStyle = ion;
        ctx.lineWidth = 5 * s;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + back * 220 * s, sy - 60 * s);
        ctx.stroke();
        const dust = ctx.createLinearGradient(sx, sy, sx + back * 180 * s, sy + 50 * s);
        dust.addColorStop(0, "hsl(44 100% 74% / 0.6)");
        dust.addColorStop(1, "hsl(44 100% 60% / 0)");
        ctx.strokeStyle = dust;
        ctx.lineWidth = 9 * s;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + back * 90 * s, sy - 10 * s + Math.sin(t * 2) * 6 * s, sx + back * 180 * s, sy + 50 * s);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
      if (phase >= 3) {
        // 3: a corona of cold white flame wrapped round it
        orbit(8, 26, 12, mid.y, 1.4, (x, y, i) => {
          ctx.globalCompositeOperation = "lighter";
          flame(ctx, x, y + 6 * s, 4 * s, (12 + (i % 3) * 4 + Math.sin(t * 9 + i) * 3) * s, "hsl(190 100% 84% / 0.75)");
          ctx.globalCompositeOperation = "source-over";
        });
      }
      if (phase >= 4) {
        // 4: the head breaks into a ring of burning fragments, and a tail as wide as the sky opens behind it
        if (!front) {
          const g = ctx.createLinearGradient(head.x, head.y, head.x + back * 420 * s, head.y - 120 * s);
          g.addColorStop(0, "hsl(196 100% 76% / 0.35)");
          g.addColorStop(1, "hsl(196 100% 60% / 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(head.x, head.y - 10 * s);
          ctx.lineTo(head.x + back * 420 * s, head.y - 220 * s);
          ctx.lineTo(head.x + back * 420 * s, head.y + 60 * s);
          ctx.closePath();
          ctx.fill();
        }
        orbit(6, 34, 10, head.y - 4 * s, 1.1, (x, y, i) => {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, x, y, 9 * s, "hsl(190 100% 84% / 0.9)", "hsl(190 100% 70% / 0)");
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "hsl(204 30% 40%)";
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1 * s;
          ctx.beginPath();
          ctx.moveTo(x - 3 * s, y - 2 * s);
          ctx.lineTo(x + 1 * s, y - 4 * s);
          ctx.lineTo(x + 4 * s, y + 1 * s);
          ctx.lineTo(x - (1 + (i % 2)) * s, y + 3 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      }
      break;
    }
    case "asterion": {
      if (!front) {
        // 2: a bow of starlight slung across its back
        const bx = shoulder.x + back * 10 * s, by = shoulder.y + 8 * s;
        ctx.strokeStyle = "hsl(44 100% 76%)";
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.arc(bx, by, 34 * s, -Math.PI / 2 - 1.1, -Math.PI / 2 + 1.1);
        ctx.stroke();
        const a0 = -Math.PI / 2 - 1.1, a1 = -Math.PI / 2 + 1.1;
        ctx.strokeStyle = "hsl(220 90% 86% / 0.7)";
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(a0) * 34 * s, by + Math.sin(a0) * 34 * s);
        ctx.lineTo(bx + Math.cos(a1) * 34 * s, by + Math.sin(a1) * 34 * s);
        ctx.stroke();
      }
      if (phase >= 3) {
        // 3: the beasts of the sky circling it: small constellations, each a few stars and the lines between
        const shapes: [number, number][][] = [
          [[-8, 2], [-3, -3], [3, -2], [8, -6], [6, 4]],
          [[-8, -3], [-4, 2], [0, -1], [4, 3], [8, 0]],
          [[-7, 4], [-6, -4], [0, -5], [6, -4], [7, 4]],
        ];
        orbit(3, 66, 16, mid.y - 18 * s, 0.4, (x, y, i) => {
          const pts = shapes[i % 3];
          ctx.strokeStyle = "hsl(44 100% 80% / 0.6)";
          ctx.lineWidth = 1 * s;
          ctx.beginPath();
          pts.forEach(([px, py], k) => (k ? ctx.lineTo(x + px * 2 * s, y + py * 2 * s) : ctx.moveTo(x + px * 2 * s, y + py * 2 * s)));
          ctx.stroke();
          ctx.fillStyle = "hsl(48 100% 92%)";
          for (const [px, py] of pts) ctx.fillRect(x + px * 2 * s - 1.4 * s, y + py * 2 * s - 1.4 * s, 2.8 * s, 2.8 * s);
        });
      }
      if (phase >= 4 && !front) {
        // 4: the whole sky joins its outline, a Hunter as tall as the night standing behind it
        const k = 3.2, fx = hip.x + back * 30 * s, fy = Math.max(p.fF.y, p.fB.y);
        const big = (q: Pt) => ({ x: fx + (q.x - hip.x) * k, y: fy + (q.y - fy) * k });
        const pairs: [Pt, Pt][] = [[head, neck], [neck, hip], [shoulder, p.eF], [p.eF, p.hF], [shoulder, p.eB], [p.eB, p.hB], [hip, p.kF], [p.kF, p.fF], [hip, p.kB], [p.kB, p.fB]];
        ctx.strokeStyle = "hsl(44 100% 80% / 0.28)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        for (const [a, b] of pairs) {
          const A = big(a), B = big(b);
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(B.x, B.y);
        }
        ctx.stroke();
        ctx.fillStyle = "hsl(48 100% 92%)";
        for (const q of [head, shoulder, p.eF, p.hF, p.eB, p.hB, hip, p.kF, p.fF, p.kB, p.fB]) {
          const Q = big(q);
          ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 1.5 + Q.x));
          ctx.fillRect(Q.x - 2.4 * s, Q.y - 2.4 * s, 4.8 * s, 4.8 * s);
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "carina": {
      // 2: twin newborn suns circling her, one rose, one green
      orbit(2, 42, 12, mid.y - 6 * s, 1.6, (x, y, i) => {
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, x, y, 13 * s, i ? "hsl(172 100% 74% / 0.9)" : "hsl(326 100% 74% / 0.9)", "hsl(326 100% 60% / 0)");
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "hsl(48 100% 96%)";
        ctx.beginPath();
        ctx.arc(x, y, 3.4 * s, 0, TAU);
        ctx.fill();
      });
      if (phase >= 3 && !front) {
        // 3: pillars of dark dust rising behind her, new stars burning at their tips
        const gy = Math.max(p.fF.y, p.fB.y);
        for (const [dx, h, w] of [[-46, 150, 20], [-14, 190, 26], [26, 130, 18]] as const) {
          const x = mid.x + back * (30 + dx) * s, top = gy - h * s;
          ctx.fillStyle = "hsl(300 30% 12% / 0.9)";
          ctx.beginPath();
          ctx.moveTo(x - w * 0.5 * s, gy);
          ctx.quadraticCurveTo(x - w * 0.7 * s, gy - h * 0.5 * s, x - w * 0.2 * s, top);
          ctx.quadraticCurveTo(x, top - 8 * s, x + w * 0.25 * s, top + 4 * s);
          ctx.quadraticCurveTo(x + w * 0.6 * s, gy - h * 0.5 * s, x + w * 0.5 * s, gy);
          ctx.closePath();
          ctx.fill();
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, x, top, (16 + Math.sin(t * 3 + dx) * 3) * s, "hsl(172 100% 76% / 0.85)", "hsl(172 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "hsl(48 100% 96%)";
          ctx.fillRect(x - 2 * s, top - 2 * s, 4 * s, 4 * s);
        }
      }
      if (phase >= 4) {
        // 4: the veil opens across the sky behind her, and a ring of new stars circles inside it
        if (!front) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, head.x + back * 20 * s, head.y, 240 * s, "hsl(326 100% 60% / 0.22)", "hsl(300 80% 40% / 0)");
          glow(ctx, head.x + back * 90 * s, head.y - 40 * s, 160 * s, "hsl(172 100% 56% / 0.16)", "hsl(172 80% 40% / 0)");
          ctx.globalCompositeOperation = "source-over";
        }
        orbit(8, 62, 18, mid.y - 10 * s, 0.6, (x, y, i) => {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, x, y, 8 * s, i % 2 ? "hsl(172 100% 80% / 0.9)" : "hsl(326 100% 82% / 0.9)", "hsl(326 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "hsl(48 100% 96%)";
          ctx.fillRect(x - 1.6 * s, y - 1.6 * s, 3.2 * s, 3.2 * s);
        });
      }
      break;
    }
    case "orogen": {
      // 2: boulders torn loose, circling it slowly
      orbit(4, 48, 12, mid.y - 4 * s, 0.9, (x, y, i) => {
        ctx.fillStyle = i % 2 ? "hsl(28 10% 36%)" : "hsl(28 10% 46%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.3 * s;
        ctx.beginPath();
        ctx.moveTo(x - 6 * s, y + 3 * s);
        ctx.lineTo(x - 4 * s, y - 5 * s);
        ctx.lineTo(x + 5 * s, y - 4 * s);
        ctx.lineTo(x + 6 * s, y + 4 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      if (phase >= 3) {
        // 3: the jade vein broken open, light pouring out of the cracks in its chest
        if (front) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, mid.x, mid.y - 6 * s, (30 + Math.sin(t * 3) * 4) * s, "hsl(150 100% 66% / 0.55)", "hsl(150 100% 50% / 0)");
          ctx.strokeStyle = "hsl(150 100% 76% / 0.9)";
          ctx.lineWidth = 1.6 * s;
          for (const a of [0.4, 1.6, 2.8, 4.1, 5.3]) {
            ctx.beginPath();
            ctx.moveTo(mid.x, mid.y - 6 * s);
            ctx.lineTo(mid.x + Math.cos(a) * 12 * s, mid.y - 6 * s + Math.sin(a) * 12 * s);
            ctx.lineTo(mid.x + Math.cos(a + 0.2) * 20 * s, mid.y - 6 * s + Math.sin(a + 0.2) * 20 * s);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
        }
      }
      if (phase >= 4 && !front) {
        // 4: the whole range standing behind it, peak after peak, jade light along every ridge
        const gy = Math.max(p.fF.y, p.fB.y);
        for (let i = -3; i <= 3; i++) {
          const x = mid.x + back * 20 * s + i * 46 * s, h = (120 + (3 - Math.abs(i)) * 40) * s;
          ctx.fillStyle = `hsl(28 12% ${14 + (i % 2 ? 4 : 0)}% / 0.92)`;
          ctx.beginPath();
          ctx.moveTo(x - 40 * s, gy);
          ctx.lineTo(x, gy - h);
          ctx.lineTo(x + 40 * s, gy);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "hsl(150 100% 66% / 0.6)";
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.moveTo(x - 20 * s, gy - h * 0.5);
          ctx.lineTo(x, gy - h);
          ctx.lineTo(x + 20 * s, gy - h * 0.5);
          ctx.stroke();
        }
      }
      break;
    }
    case "gnarlroot": {
      // 2: leaves torn off in a slow green whirl round it
      orbit(6, 46, 14, mid.y - 6 * s, 1.2, (x, y, i) => {
        ctx.fillStyle = i % 2 ? "hsl(96 60% 44%)" : "hsl(80 90% 60%)";
        ctx.beginPath();
        ctx.ellipse(x, y, 5 * s, 2.6 * s, t * 2 + i, 0, TAU);
        ctx.fill();
      });
      if (phase >= 3 && front) {
        // 3: the heartwood glowing gold-green through the split in its bark
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, mid.x, mid.y - 4 * s, (26 + Math.sin(t * 2.4) * 3) * s, "hsl(60 100% 64% / 0.6)", "hsl(80 100% 50% / 0)");
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "hsl(60 100% 80%)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(shoulder.x, shoulder.y + 4 * s);
        ctx.lineTo(mid.x + face * 2 * s, mid.y - 4 * s);
        ctx.lineTo(hip.x, hip.y - 4 * s);
        ctx.stroke();
      }
      if (phase >= 4 && !front) {
        // 4: the canopy, a crown of green spread across the sky behind it
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, head.x + back * 20 * s, head.y - 40 * s, 220 * s, "hsl(96 100% 50% / 0.2)", "hsl(96 80% 40% / 0)");
        ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          const x = head.x + back * 14 * s + Math.cos(a) * 90 * s, y = head.y - 30 * s + Math.sin(a) * 60 * s;
          ctx.fillStyle = `hsl(${96 + (i % 3) * 10} 50% ${18 + (i % 2) * 6}% / 0.9)`;
          ctx.beginPath();
          ctx.arc(x, y, (28 + (i % 3) * 6) * s, 0, TAU);
          ctx.fill();
        }
      }
      break;
    }
    case "ambrel": {
      /** One cell of honeycomb. */
      const hex = (x: number, y: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + Math.PI / 6;
          if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
      };
      // 2: cells of honeycomb circling it, golden and lit
      orbit(5, 44, 12, mid.y - 6 * s, 1.1, (x, y) => {
        hex(x, y, 6 * s);
        ctx.fillStyle = "hsl(42 100% 54% / 0.9)";
        ctx.fill();
        ctx.strokeStyle = "hsl(30 80% 22%)";
        ctx.lineWidth = 1.2 * s;
        ctx.stroke();
      });
      if (phase >= 3) {
        // 3: the things it has kept for an age drifting up out of it: leaves, a feather, a beetle
        orbit(4, 34, 10, head.y - 6 * s, -0.6, (x, y, i) => {
          ctx.fillStyle = "hsl(40 100% 60% / 0.55)";
          ctx.beginPath();
          ctx.arc(x, y, 7 * s, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "hsl(24 50% 18% / 0.85)";
          ctx.beginPath();
          if (i === 0) ctx.ellipse(x, y, 4 * s, 1.6 * s, 0.6, 0, TAU);
          else if (i === 1) ctx.ellipse(x, y, 1.4 * s, 4.4 * s, -0.4, 0, TAU);
          else ctx.ellipse(x, y, 2.4 * s, 3 * s, 0, 0, TAU);
          ctx.fill();
        });
      }
      if (phase >= 4 && !front) {
        // 4: the air setting to gold all round it
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, mid.x + back * 10 * s, mid.y - 20 * s, 230 * s, "hsl(42 100% 56% / 0.24)", "hsl(36 100% 40% / 0)");
        ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + t * 0.2;
          hex(mid.x + Math.cos(a) * 90 * s, mid.y - 10 * s + Math.sin(a) * 70 * s, 10 * s);
          ctx.strokeStyle = "hsl(44 100% 66% / 0.5)";
          ctx.lineWidth = 1.6 * s;
          ctx.stroke();
        }
      }
      break;
    }
    case "vela": {
      // 2: splinters of glass flung round it by its spin
      orbit(6, 40, 10, mid.y, 3.2, (x, y, i) => {
        ctx.fillStyle = "hsl(40 70% 78% / 0.85)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1 * s;
        const a = t * 6 + i;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s);
        ctx.lineTo(x + Math.cos(a + 2.4) * 3 * s, y + Math.sin(a + 2.4) * 3 * s);
        ctx.lineTo(x + Math.cos(a + 3.6) * 3 * s, y + Math.sin(a + 3.6) * 3 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      if (phase >= 3 && !front) {
        // 3: the magnetar wakes: field lines arc out of it on both sides, pulsing violet
        const cy = shoulder.y + 9 * s;
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 6; i++) {
          const r = (40 + i * 18) * s;
          ctx.strokeStyle = `hsl(276 100% 74% / ${0.16 + 0.24 * Math.abs(Math.sin(t * 3 - i * 0.6))})`;
          ctx.lineWidth = 1.6 * s;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(mid.x, cy - 6 * s);
            ctx.bezierCurveTo(mid.x + side * r, cy - r * 1.2, mid.x + side * r, cy + r * 1.2, mid.x, cy + 6 * s);
            ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = "source-over";
      }
      if (phase >= 4 && !front) {
        // 4: the clock of the sky behind it, twelve marks and a hand going round fast
        const cx = mid.x + back * 6 * s, cy = mid.y - 14 * s, r = 112 * s;
        ctx.strokeStyle = "hsl(32 100% 72% / 0.5)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU, k = i % 3 === 0 ? 18 : 10;
          ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.lineTo(cx + Math.cos(a) * (r - k * s), cy + Math.sin(a) * (r - k * s));
        }
        ctx.stroke();
        const a = t * 2.4 - Math.PI / 2;
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "hsl(40 100% 84% / 0.8)";
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * (r - 14 * s), cy + Math.sin(a) * (r - 14 * s));
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
      break;
    }
    case "aeon": {
      // 2: small eyes opening all round it, circling slowly, every one of them watching
      orbit(6, 50, 14, mid.y - 10 * s, 0.9, (x, y, i) => {
        const look = Math.sin(t * 1.3 + i) * 1.6 * s;
        ctx.fillStyle = "hsl(48 60% 96%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.ellipse(x, y, 6 * s, 3.6 * s, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "hsl(228 76% 34%)";
        ctx.beginPath();
        ctx.arc(x + look, y, 2.2 * s, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, x + look, y, 4 * s, "hsl(46 100% 80% / 0.9)", "hsl(46 100% 60% / 0)");
        ctx.globalCompositeOperation = "source-over";
      });
      if (phase >= 3 && !front) {
        // 3: the first dawn rising behind it, a fan of gold rays out of the ground at its back
        const gy = Math.max(p.fF.y, p.fB.y);
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, mid.x + back * 10 * s, gy, 160 * s, "hsl(36 100% 64% / 0.3)", "hsl(36 100% 60% / 0)");
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI + (i + 0.5) * (Math.PI / 9);
          const len = (170 + Math.sin(t * 2 + i * 1.3) * 18) * s, w = 0.05;
          const g = ctx.createLinearGradient(mid.x, gy, mid.x + Math.cos(a) * len, gy + Math.sin(a) * len);
          g.addColorStop(0, "hsl(40 100% 80% / 0.45)");
          g.addColorStop(1, "hsl(36 100% 60% / 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(mid.x + back * 10 * s, gy);
          ctx.lineTo(mid.x + back * 10 * s + Math.cos(a - w) * len, gy + Math.sin(a - w) * len);
          ctx.lineTo(mid.x + back * 10 * s + Math.cos(a + w) * len, gy + Math.sin(a + w) * len);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      if (phase >= 4) {
        // 4: every star in the sky falling in towards it, a slow spiral of lights narrowing on its heart
        if (!front) {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, mid.x, mid.y - 20 * s, 250 * s, "hsl(46 100% 70% / 0.2)", "hsl(228 80% 40% / 0)");
          for (let i = 0; i < 28; i++) {
            const k = ((t * 0.18 + i / 28) % 1);
            const a = i * 2.4 + k * 5;
            const r = (1 - k) * 220 * s + 20 * s;
            const x = mid.x + Math.cos(a) * r, y = mid.y - 10 * s + Math.sin(a) * r * 0.7;
            ctx.fillStyle = `hsl(48 100% 94% / ${0.3 + 0.7 * k})`;
            ctx.fillRect(x - 1.6 * s, y - 1.6 * s, 3.2 * s, 3.2 * s);
          }
          ctx.globalCompositeOperation = "source-over";
        }
        orbit(3, 64, 20, mid.y - 6 * s, 1.4, (x, y) => {
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, x, y, 12 * s, "hsl(222 100% 76% / 0.9)", "hsl(222 100% 60% / 0)");
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "hsl(0 0% 100%)";
          ctx.beginPath();
          ctx.arc(x, y, 3 * s, 0, TAU);
          ctx.fill();
        });
      }
      break;
    }
  }
  ctx.restore();
}

/**
 * Armour, capes, robes and drifting motes layered onto each boss: behind everything on the "back" pass,
 * over everything on the "front" pass. The signature pieces (halos, horns, crowns, weapons) are in drawBossDesign.
 */
function drawBossExtras(
  ctx: CanvasRenderingContext2D, design: BossDesign, layer: "back" | "front", p: BossRig,
  s: number, face: number, t: number, alive: boolean, vx: number, act?: BossAct,
) {
  const { head, hip, shoulder, neck } = p;
  const mid = { x: (hip.x + head.x) / 2, y: (hip.y + head.y) / 2 };
  const back = -face;
  const casting = !!act && act.phase !== "after";
  /** A cape off the shoulders, its hem cut into points. */
  const cape = (len: number, fill: string, edge: string, points = 5) => {
    const sway = Math.sin(t * 3) * 4 * s + Math.min(18, Math.abs(vx) * 0.04) * s;
    const hemY = hip.y + len * s;
    ctx.fillStyle = fill;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(neck.x, neck.y);
    ctx.quadraticCurveTo(shoulder.x + back * 22 * s, mid.y, hip.x + back * (28 * s + sway), hemY);
    for (let i = 1; i <= points; i++) {
      const x = hip.x + back * (28 * s + sway) - back * i * (30 / points) * s;
      ctx.lineTo(x, hemY - (i % 2 ? 8 : 0) * s);
    }
    ctx.lineTo(hip.x, hip.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(neck.x, neck.y);
    ctx.quadraticCurveTo(shoulder.x + back * 22 * s, mid.y, hip.x + back * (28 * s + sway), hemY);
    ctx.stroke();
  };
  /** Power gathered in both fists while a move charges. */
  const fists = (inner: string, outer: string) => {
    if (!alive) return;
    const r = (casting ? 11 : 6) * s + Math.sin(t * 14) * s;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, p.hF.x, p.hF.y, r, inner, outer);
    glow(ctx, p.hB.x, p.hB.y, r * 0.75, inner, outer);
    ctx.globalCompositeOperation = "source-over";
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (design) {
    case "antimatter":
      if (layer === "back") {
        cape(30, "hsl(268 55% 10% / 0.95)", "hsl(186 100% 70% / 0.8)");
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 20 * s, 60 * s, 110 * s, t, 8, "hsl(186 100% 75%)", 1.8 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // an accretion ring of matter and antimatter round the waist, tilted
        if (alive) {
          for (let i = 0; i < 10; i++) {
            const an = t * 2.4 + (i / 10) * TAU;
            if (Math.sin(an) < 0) continue; // only the near half passes in front
            const x = hip.x + Math.cos(an) * 26 * s, y = hip.y - 10 * s + Math.sin(an) * 6 * s;
            ctx.fillStyle = i % 2 ? "hsl(0 0% 100%)" : "hsl(268 70% 8%)";
            ctx.strokeStyle = "hsl(186 100% 72%)";
            ctx.lineWidth = 1 * s;
            ctx.beginPath();
            ctx.arc(x, y, 2.4 * s, 0, TAU);
            ctx.fill();
            ctx.stroke();
          }
        }
        fists("hsl(186 100% 85%)", "hsl(186 100% 60% / 0)");
      }
      break;
    case "maelstrom":
      if (layer === "back") {
        cape(36, "hsl(205 75% 30% / 0.92)", "hsl(186 100% 88% / 0.95)", 6);
        if (alive) motes(ctx, mid.x, hip.y - 40 * s, 70 * s, 90 * s, t * 2.2, 10, "hsl(195 90% 80% / 0.9)", 1.6 * s, -1);
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(176 45% 34%)", "hsl(186 90% 80%)", 2);
        fists("hsl(190 100% 85%)", "hsl(205 100% 55% / 0)");
        if (alive) glow(ctx, head.x + face * 5 * s, head.y - 1.5 * s, 5 * s, "hsl(190 100% 85% / 0.9)", "hsl(190 100% 60% / 0)");
      }
      break;
    case "magmaw":
      if (layer === "back") {
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y, 60 * s, 130 * s, t * 1.4, 10, "hsl(30 100% 62%)", 1.8 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // a cracked rock breastplate and an obsidian shoulder with spikes
        const cx = neck.x + (hip.x - neck.x) * 0.35, cy = neck.y + (hip.y - neck.y) * 0.35;
        ctx.fillStyle = "hsl(18 14% 18%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(cx - 9 * s, cy - 6 * s);
        ctx.lineTo(cx + 9 * s, cy - 7 * s);
        ctx.lineTo(cx + 7 * s, cy + 9 * s);
        ctx.lineTo(cx, cy + 13 * s);
        ctx.lineTo(cx - 7 * s, cy + 8 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = alive ? "hsl(30 100% 58%)" : "hsl(20 50% 30%)";
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.moveTo(cx - 4 * s, cy - 5 * s); ctx.lineTo(cx + 1 * s, cy + 2 * s); ctx.lineTo(cx - 1 * s, cy + 10 * s);
        ctx.moveTo(cx + 1 * s, cy + 2 * s); ctx.lineTo(cx + 6 * s, cy + 4 * s);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        pauldron(ctx, shoulder, face, s, "hsl(260 12% 14%)", "hsl(28 100% 55%)", 2);
        fists("hsl(44 100% 75%)", "hsl(16 100% 50% / 0)");
      }
      break;
    case "everwinter":
      if (layer === "back") {
        if (alive) motes(ctx, mid.x, hip.y - 50 * s, 90 * s, 100 * s, t * 0.8, 12, "hsl(200 100% 96%)", 1.7 * s, -1);
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(200 70% 86%)", "hsl(205 60% 50%)", 3);
        fists("hsl(195 100% 92%)", "hsl(200 100% 70% / 0)");
        // frost breath
        if (alive) {
          const k = (t * 0.8) % 1;
          ctx.fillStyle = `hsl(200 80% 96% / ${0.5 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(head.x + face * (12 + k * 14) * s, head.y + 4 * s - k * 4 * s, (2 + k * 5) * s, 0, TAU);
          ctx.fill();
        }
      }
      break;
    case "riftmaker":
      if (layer === "back") {
        // a tear in reality hanging behind it, stars showing through
        const rx = mid.x + back * 12 * s, ry = mid.y - 8 * s, rh = 70 * s;
        const wob = Math.sin(t * 3) * 2 * s;
        ctx.fillStyle = "hsl(262 70% 6% / 0.92)";
        ctx.strokeStyle = "hsl(318 100% 70%)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(rx, ry - rh / 2);
        for (let i = 1; i <= 6; i++) ctx.lineTo(rx + (i % 2 ? 9 : 4) * s + wob, ry - rh / 2 + (rh * i) / 6);
        for (let i = 5; i >= 1; i--) ctx.lineTo(rx - (i % 2 ? 9 : 4) * s - wob, ry - rh / 2 + (rh * i) / 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "white";
        for (let i = 0; i < 6; i++) {
          const sx = rx + Math.sin(i * 7.1) * 4 * s, sy = ry - rh / 2 + ((i * 0.17 + t * 0.05) % 1) * rh;
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + i);
          ctx.fillRect(sx, sy, 1.6 * s, 1.6 * s);
        }
        ctx.globalAlpha = 1;
        cape(26, "hsl(262 50% 14% / 0.92)", "hsl(186 100% 70% / 0.85)");
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(262 40% 22%)", "hsl(318 100% 70%)", 0);
        fists("hsl(318 100% 85%)", "hsl(186 100% 60% / 0)");
      }
      break;
    case "hollow":
      break;
    case "blacksun":
      if (layer === "back") {
        robe(ctx, hip, p.fF, p.fB, s, t, "hsl(10 55% 16% / 0.95)", "hsl(44 100% 62%)");
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y, 70 * s, 120 * s, t, 9, "hsl(38 100% 62%)", 1.7 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(42 85% 52%)", "hsl(30 80% 30%)", 3);
        fists("hsl(48 100% 80%)", "hsl(24 100% 50% / 0)");
      }
      break;
    case "axiom":
      if (layer === "back") {
        // a cape of night sky, stars drifting across it
        cape(38, "hsl(240 60% 8% / 0.95)", "hsl(272 100% 80% / 0.85)", 6);
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, hip.x + back * 16 * s, hip.y + 10 * s, 30 * s, 70 * s, t * 0.4, 10, "hsl(0 0% 100%)", 1.4 * s, -1);
          motes(ctx, mid.x, hip.y, 80 * s, 130 * s, t, 8, "hsl(272 100% 82%)", 1.7 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(240 50% 16%)", "hsl(48 100% 76%)", 0);
        fists("hsl(272 100% 88%)", "hsl(240 100% 60% / 0)");
      }
      break;
    case "lanternmaw":
      if (layer === "back") {
        // a ragged robe the colour of deep water, bubbles rising off it
        robe(ctx, hip, p.fF, p.fB, s, t, "hsl(194 46% 12% / 0.95)", "hsl(66 100% 58%)");
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y, 70 * s, 130 * s, t * 0.6, 9, "hsl(180 70% 70%)", 1.6 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(186 30% 20%)", "hsl(66 100% 60%)", 2);
        fists("hsl(66 100% 80%)", "hsl(170 100% 40% / 0)");
      }
      break;
    case "sporemother":
      if (layer === "back") {
        // a heavy skirt of fungus, gills glowing at the hem
        robe(ctx, hip, p.fF, p.fB, s, t, "hsl(316 26% 20% / 0.95)", "hsl(170 100% 62%)");
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 10 * s, 90 * s, 140 * s, t * 0.5, 12, "hsl(170 100% 70%)", 1.5 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(322 28% 34%)", "hsl(170 100% 64%)", 0);
        fists("hsl(170 100% 80%)", "hsl(170 100% 50% / 0)");
      }
      break;
    case "mnemovore":
      if (layer === "back") {
        // a long coat the colour of an old photograph, scraps of torn pages drifting off it
        cape(40, "hsl(266 16% 20% / 0.95)", "hsl(300 100% 82% / 0.7)", 6);
        if (alive) {
          ctx.fillStyle = "hsl(40 30% 86% / 0.8)";
          for (let i = 0; i < 5; i++) {
            const k = (t * 0.12 + i / 5) % 1;
            const x = hip.x + back * (20 + i * 9) * s + Math.sin(t + i) * 6 * s, y = hip.y + 30 * s - k * 140 * s;
            ctx.save();
            ctx.globalAlpha = Math.sin(k * Math.PI);
            ctx.translate(x, y);
            ctx.rotate(t * (i % 2 ? 1 : -1) + i);
            ctx.fillRect(-3 * s, -4 * s, 6 * s, 8 * s);
            ctx.restore();
          }
        }
      } else {
        fists("hsl(300 100% 86%)", "hsl(280 100% 60% / 0)");
      }
      break;
    case "dustmoth":
      if (layer === "back") {
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 20 * s, 100 * s, 150 * s, t * 0.4, 12, "hsl(40 40% 80%)", 1.4 * s, -1);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(40 26% 70%)", "hsl(208 100% 84%)", 0);
        fists("hsl(208 100% 88%)", "hsl(208 100% 60% / 0)");
      }
      break;
    case "somnarch":
      if (layer === "back") {
        // a heavy quilted sleeping gown, gold stitching at the hem, dream dust rising off it
        robe(ctx, hip, p.fF, p.fB, s, t, "hsl(250 32% 22% / 0.96)", "hsl(46 100% 70%)");
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 10 * s, 90 * s, 140 * s, t * 0.3, 10, "hsl(46 100% 76%)", 1.5 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        fists("hsl(46 100% 80%)", "hsl(46 100% 60% / 0)");
      }
      break;
    case "hush":
      if (layer === "back") {
        cape(46, "hsl(350 14% 7% / 0.96)", "hsl(354 90% 62% / 0.8)", 4);
      } else {
        fists("hsl(354 100% 76%)", "hsl(354 100% 50% / 0)");
      }
      break;
    case "elderdark":
      if (layer === "back") {
        // a robe of the night sky itself, starlight drifting off it
        robe(ctx, hip, p.fF, p.fB, s, t, "hsl(262 46% 6% / 0.97)", "hsl(268 100% 76%)");
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 20 * s, 110 * s, 160 * s, t * 0.4, 14, "hsl(268 100% 86%)", 1.4 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(262 40% 10%)", "hsl(268 100% 76%)", 3);
        fists("hsl(150 100% 72%)", "hsl(150 100% 50% / 0)");
      }
      break;
    case "perihelion":
      if (layer === "back") {
        if (alive) {
          // flakes of comet ice falling off it
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 30 * s, 90 * s, 150 * s, t * 0.5, 12, "hsl(196 100% 86%)", 1.5 * s, -1);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(200 46% 66%)", "hsl(190 100% 84%)", 2);
        fists("hsl(190 100% 86%)", "hsl(190 100% 60% / 0)");
      }
      break;
    case "asterion":
      if (layer === "back") {
        // a short cloak of night sky, starlight caught in it
        cape(34, "hsl(232 50% 10% / 0.95)", "hsl(44 100% 72% / 0.8)", 4);
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 20 * s, 90 * s, 140 * s, t * 0.3, 10, "hsl(44 100% 84%)", 1.3 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        fists("hsl(44 100% 82%)", "hsl(44 100% 60% / 0)");
      }
      break;
    case "carina":
      if (layer === "back") {
        // a long train of gas off her shoulders, lit rose at the edge
        cape(44, "hsl(304 40% 16% / 0.85)", "hsl(326 100% 76% / 0.8)", 6);
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 24 * s, 90 * s, 150 * s, t * 0.3, 12, "hsl(326 100% 84%)", 1.4 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        fists("hsl(326 100% 80%)", "hsl(326 100% 60% / 0)");
      }
      break;
    case "orogen":
      if (layer === "front") {
        pauldron(ctx, shoulder, face, s, alive ? "hsl(28 10% 36%)" : "hsl(28 4% 32%)", alive ? "hsl(150 80% 60%)" : "hsl(0 0% 50%)", 3);
        fists("hsl(150 100% 72%)", "hsl(150 100% 50% / 0)");
      } else if (alive) {
        // dust and grit sliding off it as it moves
        motes(ctx, mid.x, hip.y + 30 * s, 70 * s, 120 * s, t * 0.5, 8, "hsl(28 10% 60%)", 1.4 * s, -1);
      }
      break;
    case "gnarlroot":
      if (layer === "back") {
        if (alive) motes(ctx, mid.x, hip.y + 20 * s, 100 * s, 160 * s, t * 0.4, 10, "hsl(90 70% 54%)", 1.8 * s, -1);
      } else {
        fists("hsl(92 100% 70%)", "hsl(92 100% 50% / 0)");
      }
      break;
    case "ambrel":
      if (layer === "back") {
        // a mantle of resin down its back, its hem dripping
        cape(40, alive ? "hsl(34 90% 40% / 0.82)" : "hsl(34 8% 36% / 0.8)", alive ? "hsl(46 100% 70% / 0.9)" : "hsl(0 0% 56% / 0.6)", 6);
      } else {
        fists("hsl(46 100% 76%)", "hsl(44 100% 56% / 0)");
      }
      break;
    case "vela":
      if (layer === "back") {
        if (alive) {
          // grains of hot glass falling off it
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 30 * s, 80 * s, 140 * s, t * 0.6, 10, "hsl(36 100% 76%)", 1.4 * s, -1);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        pauldron(ctx, shoulder, face, s, "hsl(250 20% 24%)", "hsl(32 100% 70%)", 2);
        fists("hsl(36 100% 80%)", "hsl(32 100% 60% / 0)");
      }
      break;
    case "aeon":
      if (layer === "back") {
        // a long mantle of pale light off its shoulders, hemmed in gold, shedding sparks as it moves
        cape(50, "hsl(44 40% 86% / 0.8)", "hsl(46 100% 64% / 0.9)", 7);
        if (alive) {
          ctx.globalCompositeOperation = "lighter";
          motes(ctx, mid.x, hip.y + 26 * s, 90 * s, 160 * s, t * 0.3, 12, "hsl(48 100% 88%)", 1.4 * s);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        fists("hsl(48 100% 86%)", "hsl(46 100% 60% / 0)");
      }
      break;
  }
  ctx.restore();
}
