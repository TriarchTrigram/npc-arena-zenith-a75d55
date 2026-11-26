// Free World: six places to walk around in with your party, no fight timer anywhere.
// Each place is a wide side-scrolling picture painted once onto a canvas (the floor line is the
// arena's GROUND, so a fight started anywhere uses the spot you stood on as its arena).
import { useEffect, useState } from "react";
import { H, GROUND } from "./arena-engine";
import type { BossId } from "./bosses";

export type PlaceId = "house" | "city" | "dojo" | "arcade" | "park" | "rooftop";
export type FxKind = "zzz" | "heart" | "note" | "spark" | "ripple" | "star" | "score" | "hit" | "calm";
export type SpotId =
  | "couch" | "tv" | "kitchen"
  | "foodcart" | "fountain"
  | "dummy" | "mat"
  | "cabinet" | "claw"
  | "bench" | "lake"
  | "ledge" | "stargaze";

export type Spot = { id: SpotId; x: number; fx: FxKind; /** where the effect rises from, above the floor */ lift: number };
export type Place = { id: PlaceId; width: number; spots: Spot[]; /** fighters strolling past on their own */ crowd: number; paint: (ctx: CanvasRenderingContext2D, w: number) => void };

export const PLACE_ORDER: PlaceId[] = ["house", "city", "dojo", "arcade", "park", "rooftop"];

// ---------- painting helpers ----------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string, lw = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
const INK = "hsl(250 30% 12%)";
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, "hsl(0 0% 100% / 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function cloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 70 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx - 30 * s, cy - 10 * s, 36 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 26 * s, cy - 14 * s, 30 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}
/** A row of buildings with lit windows; `lit` is the share of windows on. */
function skyline(ctx: CanvasRenderingContext2D, w: number, base: number, minH: number, maxH: number, col: string, win: string, lit: number, seed: number, bw = [60, 130]) {
  const r = rng(seed);
  let x = -20;
  while (x < w + 20) {
    const bwid = bw[0] + r() * (bw[1] - bw[0]);
    const bh = minH + r() * (maxH - minH);
    ctx.fillStyle = col;
    ctx.fillRect(x, base - bh, bwid, bh + 2);
    if (r() < 0.3) ctx.fillRect(x + bwid * 0.4, base - bh - 18, 4, 18);
    for (let wy = base - bh + 12; wy < base - 14; wy += 18) {
      for (let wx = x + 9; wx < x + bwid - 12; wx += 15) {
        if (r() < lit) {
          ctx.fillStyle = win;
          ctx.fillRect(wx, wy, 7, 9);
        }
      }
    }
    x += bwid + 4 + r() * 10;
  }
}
function tree(ctx: CanvasRenderingContext2D, x: number, base: number, s: number, leaf: string, leafDark: string) {
  ctx.fillStyle = "hsl(25 40% 28%)";
  ctx.fillRect(x - 7 * s, base - 90 * s, 14 * s, 90 * s);
  ctx.fillStyle = leafDark;
  ctx.beginPath();
  ctx.arc(x, base - 120 * s, 52 * s, 0, Math.PI * 2);
  ctx.arc(x - 38 * s, base - 95 * s, 36 * s, 0, Math.PI * 2);
  ctx.arc(x + 38 * s, base - 95 * s, 36 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.arc(x - 8 * s, base - 128 * s, 40 * s, 0, Math.PI * 2);
  ctx.arc(x - 34 * s, base - 102 * s, 26 * s, 0, Math.PI * 2);
  ctx.fill();
}
function floorBoards(ctx: CanvasRenderingContext2D, w: number, a: string, b: string, line: string) {
  ctx.fillStyle = vgrad(ctx, GROUND, H, [[0, a], [1, b]]);
  ctx.fillRect(0, GROUND, w, H - GROUND);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (let y = GROUND + 18; y < H; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let x = 0, row = 0; x < w; x += 90, row++) {
    for (let y = GROUND; y < H; y += 20) {
      const off = ((y - GROUND) / 20) % 2 ? 45 : 0;
      ctx.beginPath(); ctx.moveTo(x + off, y); ctx.lineTo(x + off, y + 20); ctx.stroke();
    }
  }
  ctx.fillStyle = "hsl(0 0% 0% / 0.18)";
  ctx.fillRect(0, GROUND, w, 5);
}

// ---------- the six places ----------
function paintHouse(ctx: CanvasRenderingContext2D, w: number) {
  // warm wall with a stripe of wallpaper and a skirting board
  ctx.fillStyle = vgrad(ctx, 0, GROUND, [[0, "hsl(30 55% 80%)"], [1, "hsl(24 50% 72%)"]]);
  ctx.fillRect(0, 0, w, GROUND);
  ctx.fillStyle = "hsl(28 45% 76% / 0.6)";
  for (let x = 0; x < w; x += 48) ctx.fillRect(x, 0, 20, GROUND - 120);
  ctx.fillStyle = "hsl(20 40% 58%)";
  ctx.fillRect(0, GROUND - 124, w, 10);
  ctx.fillStyle = "hsl(28 35% 64%)";
  ctx.fillRect(0, GROUND - 114, w, 114);
  ctx.fillStyle = "hsl(20 38% 42%)";
  ctx.fillRect(0, GROUND - 22, w, 22);
  // window with an evening sky
  for (const wx of [170, 980]) {
    rr(ctx, wx, 110, 220, 190, 10, vgrad(ctx, 110, 300, [[0, "hsl(222 70% 62%)"], [0.6, "hsl(280 55% 72%)"], [1, "hsl(28 95% 80%)"]]), "hsl(20 40% 36%)", 10);
    ctx.fillStyle = "hsl(20 40% 36%)";
    ctx.fillRect(wx + 106, 110, 8, 190);
    ctx.fillRect(wx, 200, 220, 8);
    cloud(ctx, wx + 70, 150, 0.45, "hsl(0 0% 100% / 0.7)");
    ctx.fillStyle = "hsl(350 55% 62%)";
    ctx.fillRect(wx - 26, 96, 30, 220);
    ctx.fillRect(wx + 216, 96, 30, 220);
  }
  // picture frames
  for (const [fx, fy, fw, fh, col] of [[560, 150, 90, 70, "hsl(200 60% 62%)"], [680, 130, 70, 95, "hsl(140 45% 55%)"], [1330, 140, 110, 80, "hsl(14 75% 64%)"]] as const) {
    rr(ctx, fx, fy, fw, fh, 4, col, "hsl(30 50% 30%)", 6);
    ctx.fillStyle = "hsl(0 0% 100% / 0.35)";
    ctx.beginPath(); ctx.arc(fx + fw * 0.35, fy + fh * 0.45, Math.min(fw, fh) * 0.2, 0, Math.PI * 2); ctx.fill();
  }
  // rug
  ctx.fillStyle = "hsl(350 55% 55%)";
  ctx.beginPath(); ctx.ellipse(520, GROUND + 22, 220, 22, 0, 0, Math.PI * 2); ctx.fill();
  // couch (spot)
  rr(ctx, 300, GROUND - 120, 260, 60, 22, "hsl(205 45% 46%)", INK);
  rr(ctx, 288, GROUND - 80, 284, 62, 18, "hsl(205 45% 52%)", INK);
  rr(ctx, 276, GROUND - 100, 40, 84, 16, "hsl(205 45% 42%)", INK);
  rr(ctx, 544, GROUND - 100, 40, 84, 16, "hsl(205 45% 42%)", INK);
  rr(ctx, 340, GROUND - 108, 60, 40, 14, "hsl(46 90% 66%)", INK, 3);
  ctx.fillStyle = INK;
  ctx.fillRect(300, GROUND - 18, 10, 18); ctx.fillRect(550, GROUND - 18, 10, 18);
  // lamp
  ctx.fillStyle = INK;
  ctx.fillRect(228, GROUND - 190, 6, 190);
  ctx.beginPath(); ctx.moveTo(200, GROUND - 190); ctx.lineTo(262, GROUND - 190); ctx.lineTo(248, GROUND - 236); ctx.lineTo(214, GROUND - 236); ctx.closePath();
  ctx.fillStyle = "hsl(46 90% 72%)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  glow(ctx, 231, GROUND - 200, 110, "hsl(46 100% 80% / 0.45)");
  // TV on a stand (spot)
  rr(ctx, 700, GROUND - 70, 200, 70, 8, "hsl(25 35% 34%)", INK);
  rr(ctx, 712, GROUND - 236, 176, 120, 8, "hsl(250 30% 14%)", INK);
  ctx.fillStyle = vgrad(ctx, GROUND - 226, GROUND - 126, [[0, "hsl(195 80% 60%)"], [1, "hsl(265 70% 55%)"]]);
  ctx.fillRect(722, GROUND - 226, 156, 100);
  ctx.fillStyle = INK;
  ctx.fillRect(790, GROUND - 116, 20, 46);
  // plant and bookshelf
  rr(ctx, 1080, GROUND - 60, 50, 60, 6, "hsl(14 60% 50%)", INK, 3);
  ctx.fillStyle = "hsl(140 45% 38%)";
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(1105 + Math.cos(i) * 24, GROUND - 90 - i * 8, 12, 30, i - 2.5, 0, Math.PI * 2); ctx.fill(); }
  rr(ctx, 1160, GROUND - 260, 120, 260, 6, "hsl(25 40% 36%)", INK);
  const r = rng(4);
  for (let s = 0; s < 4; s++) {
    const y = GROUND - 250 + s * 64;
    ctx.fillStyle = "hsl(25 40% 26%)"; ctx.fillRect(1166, y + 54, 108, 6);
    for (let bx = 1170; bx < 1266; bx += 14) { ctx.fillStyle = `hsl(${Math.floor(r() * 360)} 50% ${45 + r() * 20}%)`; ctx.fillRect(bx, y + 14 + r() * 10, 11, 40); }
  }
  // kitchen (spot): counter, stove, fridge
  rr(ctx, 1320, GROUND - 100, 200, 100, 6, "hsl(30 30% 86%)", INK);
  ctx.fillStyle = "hsl(200 15% 40%)"; ctx.fillRect(1320, GROUND - 100, 200, 10);
  rr(ctx, 1400, GROUND - 150, 60, 50, 6, "hsl(14 70% 58%)", INK, 3);
  rr(ctx, 1520, GROUND - 230, 72, 230, 10, "hsl(190 25% 92%)", INK);
  ctx.fillStyle = INK; ctx.fillRect(1520, GROUND - 150, 72, 4); ctx.fillRect(1530, GROUND - 200, 6, 34);
  floorBoards(ctx, w, "hsl(28 50% 48%)", "hsl(22 45% 34%)", "hsl(22 40% 30% / 0.6)");
}

function paintCity(ctx: CanvasRenderingContext2D, w: number) {
  ctx.fillStyle = vgrad(ctx, 0, GROUND, [[0, "hsl(210 75% 64%)"], [0.7, "hsl(200 70% 82%)"], [1, "hsl(40 80% 88%)"]]);
  ctx.fillRect(0, 0, w, GROUND);
  for (const [cx, cy, s] of [[200, 80, 1], [700, 60, 0.7], [1300, 100, 0.9], [1900, 70, 0.6], [2500, 90, 1]] as const) cloud(ctx, cx, cy, s, "hsl(0 0% 100% / 0.8)");
  skyline(ctx, w, GROUND - 60, 160, 330, "hsl(215 30% 62%)", "hsl(205 40% 80%)", 0.4, 11, [70, 140]);
  skyline(ctx, w, GROUND - 30, 120, 250, "hsl(222 28% 42%)", "hsl(46 90% 72%)", 0.35, 23, [80, 160]);
  // street-level shops with awnings
  const r = rng(7);
  const hues = [8, 46, 160, 200, 280, 330];
  for (let x = 20, i = 0; x < w; x += 240, i++) {
    const hue = hues[i % hues.length];
    rr(ctx, x, GROUND - 170, 220, 170, 4, `hsl(${hue} 30% 70%)`, INK);
    rr(ctx, x + 20, GROUND - 120, 110, 120, 4, "hsl(200 50% 82%)", INK, 3);
    rr(ctx, x + 150, GROUND - 120, 50, 120, 4, `hsl(${hue} 40% 40%)`, INK, 3);
    for (let s = 0; s < 6; s++) {
      ctx.fillStyle = s % 2 ? "hsl(0 0% 98%)" : `hsl(${hue} 70% 58%)`;
      ctx.beginPath(); ctx.moveTo(x + 10 + s * 33.3, GROUND - 160); ctx.lineTo(x + 43 + s * 33.3, GROUND - 160); ctx.lineTo(x + 43 + s * 33.3, GROUND - 136); ctx.lineTo(x + 10 + s * 33.3, GROUND - 136); ctx.fill();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x + 10, GROUND - 160, 200, 24);
    if (r() < 0.6) { ctx.fillStyle = "hsl(140 45% 40%)"; ctx.beginPath(); ctx.arc(x + 52, GROUND - 22, 14, 0, Math.PI * 2); ctx.fill(); }
  }
  // street lights
  for (let x = 140; x < w; x += 480) {
    ctx.fillStyle = INK; ctx.fillRect(x, GROUND - 230, 8, 230); ctx.fillRect(x, GROUND - 230, 40, 8);
    rr(ctx, x + 30, GROUND - 226, 24, 14, 4, "hsl(46 100% 76%)", INK, 3);
  }
  // food cart (spot)
  rr(ctx, 840, GROUND - 110, 140, 80, 8, "hsl(14 80% 58%)", INK);
  rr(ctx, 830, GROUND - 190, 160, 18, 6, "hsl(46 95% 62%)", INK, 3);
  ctx.fillStyle = INK; ctx.fillRect(850, GROUND - 172, 6, 62); ctx.fillRect(964, GROUND - 172, 6, 62);
  for (const wx of [870, 950]) { ctx.beginPath(); ctx.arc(wx, GROUND - 20, 18, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); ctx.beginPath(); ctx.arc(wx, GROUND - 20, 7, 0, Math.PI * 2); ctx.fillStyle = "hsl(0 0% 75%)"; ctx.fill(); }
  // fountain (spot)
  ctx.fillStyle = "hsl(210 15% 70%)";
  ctx.beginPath(); ctx.ellipse(1800, GROUND - 24, 150, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = "hsl(195 80% 62%)";
  ctx.beginPath(); ctx.ellipse(1800, GROUND - 30, 128, 18, 0, 0, Math.PI * 2); ctx.fill();
  rr(ctx, 1788, GROUND - 130, 24, 100, 6, "hsl(210 15% 70%)", INK, 3);
  rr(ctx, 1740, GROUND - 140, 120, 18, 9, "hsl(210 15% 76%)", INK, 3);
  ctx.strokeStyle = "hsl(195 90% 80%)"; ctx.lineWidth = 4;
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(1800, GROUND - 150); ctx.quadraticCurveTo(1800 + d * 70, GROUND - 210, 1800 + d * 110, GROUND - 40); ctx.stroke(); }
  // bus stop sign
  ctx.fillStyle = INK; ctx.fillRect(2500, GROUND - 200, 6, 200);
  rr(ctx, 2480, GROUND - 230, 46, 46, 23, "hsl(212 80% 55%)", INK, 3);
  // sidewalk and curb
  ctx.fillStyle = vgrad(ctx, GROUND, H, [[0, "hsl(30 10% 74%)"], [1, "hsl(30 8% 60%)"]]);
  ctx.fillRect(0, GROUND, w, H - GROUND);
  ctx.strokeStyle = "hsl(30 8% 55%)"; ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 70) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x - 20, H); ctx.stroke(); }
  ctx.fillStyle = "hsl(220 10% 30%)"; ctx.fillRect(0, H - 14, w, 14);
  ctx.fillStyle = "hsl(46 95% 60%)";
  for (let x = 20; x < w; x += 120) ctx.fillRect(x, H - 8, 60, 4);
}

function paintDojo(ctx: CanvasRenderingContext2D, w: number) {
  ctx.fillStyle = vgrad(ctx, 0, GROUND, [[0, "hsl(30 30% 30%)"], [1, "hsl(30 35% 44%)"]]);
  ctx.fillRect(0, 0, w, GROUND);
  // beams
  ctx.fillStyle = "hsl(20 45% 22%)";
  ctx.fillRect(0, 60, w, 22);
  for (let x = 0; x < w; x += 260) ctx.fillRect(x, 60, 24, GROUND - 60);
  // paper sliding panels with a soft light behind
  for (let x = 24; x < w; x += 260) {
    ctx.fillStyle = "hsl(42 55% 88%)";
    ctx.fillRect(x, 82, 236, GROUND - 82 - 90);
    ctx.strokeStyle = "hsl(20 45% 26%)"; ctx.lineWidth = 3;
    for (let gx = x + 59; gx < x + 236; gx += 59) { ctx.beginPath(); ctx.moveTo(gx, 82); ctx.lineTo(gx, GROUND - 90); ctx.stroke(); }
    for (let gy = 82 + 70; gy < GROUND - 90; gy += 70) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 236, gy); ctx.stroke(); }
  }
  ctx.fillStyle = "hsl(20 45% 24%)"; ctx.fillRect(0, GROUND - 90, w, 90);
  // hanging scroll with brush strokes and a red seal
  rr(ctx, 690, 110, 110, 250, 4, "hsl(42 60% 92%)", "hsl(20 45% 22%)", 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(720, 150); ctx.quadraticCurveTo(760, 170, 740, 220); ctx.moveTo(760, 240); ctx.lineTo(730, 300); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "hsl(0 70% 50%)"; ctx.fillRect(764, 320, 18, 18);
  // weapon rack
  rr(ctx, 1360, GROUND - 230, 160, 14, 4, "hsl(20 45% 30%)", INK, 3);
  rr(ctx, 1360, GROUND - 150, 160, 14, 4, "hsl(20 45% 30%)", INK, 3);
  ctx.strokeStyle = "hsl(30 50% 60%)"; ctx.lineWidth = 6;
  for (let x = 1380; x < 1510; x += 30) { ctx.beginPath(); ctx.moveTo(x, GROUND - 270); ctx.lineTo(x, GROUND - 100); ctx.stroke(); }
  // training dummy (spot)
  ctx.fillStyle = "hsl(28 45% 40%)"; ctx.fillRect(492, GROUND - 210, 16, 210);
  rr(ctx, 470, GROUND - 210, 60, 110, 18, "hsl(32 50% 54%)", INK);
  ctx.fillStyle = "hsl(28 45% 36%)"; ctx.fillRect(430, GROUND - 180, 140, 14); ctx.fillRect(450, GROUND - 130, 100, 12);
  ctx.beginPath(); ctx.arc(500, GROUND - 236, 26, 0, Math.PI * 2); ctx.fillStyle = "hsl(32 50% 58%)"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  // meditation mat with candles (spot)
  ctx.fillStyle = "hsl(140 25% 52%)";
  ctx.beginPath(); ctx.ellipse(1150, GROUND + 10, 110, 16, 0, 0, Math.PI * 2); ctx.fill();
  for (const cx of [1030, 1270]) {
    rr(ctx, cx - 8, GROUND - 40, 16, 40, 3, "hsl(42 60% 90%)", INK, 2);
    ctx.fillStyle = "hsl(40 100% 62%)"; ctx.beginPath(); ctx.ellipse(cx, GROUND - 50, 5, 10, 0, 0, Math.PI * 2); ctx.fill();
    glow(ctx, cx, GROUND - 50, 60, "hsl(40 100% 70% / 0.5)");
  }
  // tatami floor
  ctx.fillStyle = vgrad(ctx, GROUND, H, [[0, "hsl(70 35% 62%)"], [1, "hsl(65 30% 48%)"]]);
  ctx.fillRect(0, GROUND, w, H - GROUND);
  ctx.strokeStyle = "hsl(20 40% 22%)"; ctx.lineWidth = 4;
  for (let x = 0; x < w; x += 200) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, GROUND + 2); ctx.lineTo(w, GROUND + 2); ctx.stroke();
}

function paintArcade(ctx: CanvasRenderingContext2D, w: number) {
  ctx.fillStyle = vgrad(ctx, 0, GROUND, [[0, "hsl(262 45% 10%)"], [1, "hsl(280 40% 18%)"]]);
  ctx.fillRect(0, 0, w, GROUND);
  // neon tubes along the ceiling
  const neon = (y: number, col: string) => {
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.shadowColor = col; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.shadowBlur = 0;
  };
  neon(40, "hsl(320 100% 64%)");
  neon(62, "hsl(190 100% 60%)");
  // starry wall pattern
  const r = rng(31);
  for (let i = 0; i < 90; i++) { ctx.fillStyle = `hsl(${r() < 0.5 ? 190 : 320} 100% 70% / ${0.15 + r() * 0.3})`; ctx.fillRect(r() * w, 90 + r() * 280, 3, 3); }
  // a big neon star sign
  ctx.save(); ctx.translate(1000, 190); ctx.strokeStyle = "hsl(50 100% 62%)"; ctx.lineWidth = 6; ctx.shadowColor = "hsl(50 100% 62%)"; ctx.shadowBlur = 24;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rad = i % 2 ? 26 : 62; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
  ctx.closePath(); ctx.stroke(); ctx.restore();
  // rows of cabinets; the one at 600 is the spot
  const hues = [190, 320, 50, 140, 260, 20];
  for (let x = 120, i = 0; x < w - 100; x += 170, i++) {
    if (x > 1180 && x < 1420) continue;
    const hue = hues[i % hues.length];
    rr(ctx, x, GROUND - 250, 110, 250, 10, `hsl(${hue} 45% 28%)`, INK);
    rr(ctx, x + 14, GROUND - 230, 82, 70, 6, `hsl(${hue} 90% 60%)`, INK, 3);
    glow(ctx, x + 55, GROUND - 195, 90, `hsl(${hue} 100% 65% / 0.35)`);
    rr(ctx, x + 8, GROUND - 140, 94, 24, 4, `hsl(${hue} 30% 20%)`, INK, 3);
    ctx.fillStyle = "hsl(0 85% 60%)"; ctx.beginPath(); ctx.arc(x + 70, GROUND - 128, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.fillRect(x + 32, GROUND - 140, 4, -14);
    ctx.fillStyle = `hsl(${hue} 100% 70%)`; ctx.fillRect(x + 10, GROUND - 246, 90, 10);
  }
  // claw machine (spot)
  rr(ctx, 1240, GROUND - 300, 150, 300, 10, "hsl(330 70% 58%)", INK);
  rr(ctx, 1254, GROUND - 280, 122, 150, 6, "hsl(200 60% 85% / 0.55)", INK, 3);
  ctx.strokeStyle = "hsl(0 0% 85%)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(1315, GROUND - 280); ctx.lineTo(1315, GROUND - 230); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1302, GROUND - 216); ctx.lineTo(1315, GROUND - 230); ctx.lineTo(1328, GROUND - 216); ctx.stroke();
  for (const [px, col] of [[1275, "hsl(46 95% 62%)"], [1300, "hsl(190 80% 60%)"], [1330, "hsl(140 60% 55%)"], [1355, "hsl(14 85% 62%)"]] as const) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, GROUND - 144, 13, 0, Math.PI * 2); ctx.fill(); }
  // checkered floor
  for (let x = 0; x < w; x += 40) for (let y = GROUND; y < H; y += 20) {
    ctx.fillStyle = ((x / 40 + (y - GROUND) / 20) % 2) ? "hsl(260 30% 16%)" : "hsl(260 25% 26%)";
    ctx.fillRect(x, y, 40, 20);
  }
  ctx.fillStyle = "hsl(190 100% 60% / 0.5)"; ctx.fillRect(0, GROUND, w, 3);
}

function paintPark(ctx: CanvasRenderingContext2D, w: number) {
  ctx.fillStyle = vgrad(ctx, 0, GROUND, [[0, "hsl(205 75% 66%)"], [0.75, "hsl(190 60% 84%)"], [1, "hsl(60 60% 86%)"]]);
  ctx.fillRect(0, 0, w, GROUND);
  glow(ctx, 1600, 120, 160, "hsl(48 100% 88% / 0.95)");
  for (const [cx, cy, s] of [[300, 90, 1], [900, 70, 0.8], [1500, 110, 0.6], [2100, 80, 0.9]] as const) cloud(ctx, cx, cy, s, "hsl(0 0% 100% / 0.85)");
  // rolling hills
  const hills = (y: number, amp: number, col: string, seed: number) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y - Math.abs(Math.sin(x * 0.004 + seed)) * amp);
    ctx.lineTo(w, GROUND); ctx.closePath(); ctx.fill();
  };
  hills(360, 90, "hsl(140 30% 62%)", 1);
  hills(410, 60, "hsl(130 40% 50%)", 3);
  // the lake behind the path
  ctx.fillStyle = vgrad(ctx, 430, GROUND, [[0, "hsl(200 70% 62%)"], [1, "hsl(205 70% 46%)"]]);
  ctx.beginPath(); ctx.ellipse(1300, 480, 520, 64, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "hsl(0 0% 100% / 0.6)"; ctx.lineWidth = 3;
  for (const [lx, ly, lw] of [[1100, 460, 80], [1400, 490, 120], [1250, 505, 60], [1550, 470, 70]] as const) { ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lw, ly); ctx.stroke(); }
  // ducks
  for (const dx of [1180, 1220, 1480]) {
    ctx.fillStyle = "hsl(0 0% 98%)"; ctx.beginPath(); ctx.ellipse(dx, 478, 14, 8, 0, 0, Math.PI * 2); ctx.arc(dx + 10, 468, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "hsl(36 100% 55%)"; ctx.fillRect(dx + 15, 467, 7, 3);
  }
  // trees
  for (const [tx, s] of [[120, 1.2], [340, 0.9], [760, 1.1], [1880, 1.2], [2100, 0.9], [2300, 1.05]] as const) tree(ctx, tx, GROUND - 4, s, "hsl(120 45% 46%)", "hsl(130 45% 34%)");
  // bench (spot)
  rr(ctx, 440, GROUND - 92, 150, 14, 4, "hsl(25 50% 42%)", INK, 3);
  rr(ctx, 440, GROUND - 64, 150, 14, 4, "hsl(25 50% 46%)", INK, 3);
  ctx.fillStyle = INK; ctx.fillRect(452, GROUND - 50, 8, 50); ctx.fillRect(570, GROUND - 50, 8, 50);
  // flowers
  const r = rng(5);
  for (let i = 0; i < 60; i++) {
    const fx = r() * w;
    if (fx > 780 && fx < 1820) continue;
    ctx.fillStyle = `hsl(${[0, 46, 300, 200][Math.floor(r() * 4)]} 85% 66%)`;
    ctx.beginPath(); ctx.arc(fx, GROUND - 6 - r() * 10, 4, 0, Math.PI * 2); ctx.fill();
  }
  // grass and a dirt path
  ctx.fillStyle = vgrad(ctx, GROUND, H, [[0, "hsl(110 45% 44%)"], [1, "hsl(115 45% 32%)"]]);
  ctx.fillRect(0, GROUND, w, H - GROUND);
  ctx.fillStyle = "hsl(35 40% 62%)";
  ctx.fillRect(0, GROUND + 8, w, 26);
  ctx.fillStyle = "hsl(110 50% 38%)";
  for (let x = 0; x < w; x += 9) { ctx.beginPath(); ctx.moveTo(x, GROUND + 2); ctx.lineTo(x + 3, GROUND - 8 - (x % 5)); ctx.lineTo(x + 6, GROUND + 2); ctx.fill(); }
}

function paintRooftop(ctx: CanvasRenderingContext2D, w: number) {
  ctx.fillStyle = vgrad(ctx, 0, GROUND, [[0, "hsl(240 50% 14%)"], [0.55, "hsl(275 45% 30%)"], [1, "hsl(20 85% 62%)"]]);
  ctx.fillRect(0, 0, w, GROUND);
  const r = rng(77);
  for (let i = 0; i < 140; i++) { ctx.fillStyle = `hsl(0 0% 100% / ${0.3 + r() * 0.6})`; const s = r() < 0.1 ? 3 : 2; ctx.fillRect(r() * w, r() * 260, s, s); }
  // moon
  glow(ctx, 1450, 110, 120, "hsl(50 80% 90% / 0.5)");
  ctx.fillStyle = "hsl(50 60% 92%)"; ctx.beginPath(); ctx.arc(1450, 110, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "hsl(240 50% 14%)"; ctx.beginPath(); ctx.arc(1470, 98, 38, 0, Math.PI * 2); ctx.fill();
  // the city below the roof
  skyline(ctx, w, GROUND - 40, 120, 300, "hsl(250 30% 22%)", "hsl(46 95% 70%)", 0.5, 91, [60, 120]);
  skyline(ctx, w, GROUND - 20, 60, 180, "hsl(250 30% 14%)", "hsl(30 95% 66%)", 0.45, 93, [70, 140]);
  // string lights
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 300) {
    ctx.beginPath(); ctx.moveTo(x, 300); ctx.quadraticCurveTo(x + 150, 360, x + 300, 300); ctx.stroke();
    for (let k = 1; k < 8; k++) {
      const t = k / 8, bx = x + 300 * t, by = (1 - t) * (1 - t) * 300 + 2 * (1 - t) * t * 360 + t * t * 300;
      ctx.fillStyle = `hsl(${[46, 330, 190][k % 3]} 100% 70%)`; ctx.beginPath(); ctx.arc(bx, by + 6, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // water tower
  ctx.fillStyle = "hsl(20 30% 20%)";
  for (const lx of [330, 450]) ctx.fillRect(lx, GROUND - 150, 10, 150);
  rr(ctx, 310, GROUND - 300, 160, 160, 12, "hsl(18 45% 40%)", INK);
  ctx.beginPath(); ctx.moveTo(300, GROUND - 300); ctx.lineTo(390, GROUND - 350); ctx.lineTo(480, GROUND - 300); ctx.closePath(); ctx.fillStyle = "hsl(18 35% 30%)"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  // AC units and an antenna
  rr(ctx, 680, GROUND - 70, 110, 70, 6, "hsl(210 10% 66%)", INK);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(735, GROUND - 35, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(1250, GROUND - 280, 6, 280); ctx.fillRect(1230, GROUND - 260, 46, 4);
  ctx.fillStyle = "hsl(0 90% 60%)"; ctx.beginPath(); ctx.arc(1253, GROUND - 284, 6, 0, Math.PI * 2); ctx.fill();
  // lawn chairs (spot: stargaze)
  for (const cx of [1460, 1560]) {
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx, GROUND); ctx.lineTo(cx + 30, GROUND - 40); ctx.lineTo(cx + 70, GROUND - 40); ctx.moveTo(cx + 30, GROUND - 40); ctx.lineTo(cx + 10, GROUND - 90); ctx.stroke();
    ctx.fillStyle = "hsl(190 70% 55%)"; ctx.fillRect(cx + 28, GROUND - 46, 44, 8);
  }
  // parapet (spot: ledge) and gravel roof
  ctx.fillStyle = "hsl(20 15% 36%)"; ctx.fillRect(0, GROUND - 46, w, 46);
  ctx.fillStyle = "hsl(20 15% 46%)"; ctx.fillRect(0, GROUND - 52, w, 10);
  ctx.fillStyle = "hsl(0 0% 0% / 0.2)";
  for (let x = 0; x < w; x += 60) ctx.fillRect(x, GROUND - 42, 2, 42);
  ctx.fillStyle = vgrad(ctx, GROUND, H, [[0, "hsl(25 8% 42%)"], [1, "hsl(25 8% 30%)"]]);
  ctx.fillRect(0, GROUND, w, H - GROUND);
  const g = rng(8);
  for (let i = 0; i < 400; i++) { ctx.fillStyle = `hsl(25 6% ${30 + g() * 30}%)`; ctx.fillRect(g() * w, GROUND + g() * (H - GROUND), 3, 2); }
}

export const PLACES: Record<PlaceId, Place> = {
  house: { id: "house", width: 1700, crowd: 0, paint: paintHouse, spots: [
    { id: "couch", x: 430, fx: "zzz", lift: 150 },
    { id: "tv", x: 800, fx: "note", lift: 250 },
    { id: "kitchen", x: 1430, fx: "spark", lift: 170 },
  ] },
  city: { id: "city", width: 2880, crowd: 7, paint: paintCity, spots: [
    { id: "foodcart", x: 910, fx: "spark", lift: 200 },
    { id: "fountain", x: 1800, fx: "ripple", lift: 40 },
  ] },
  dojo: { id: "dojo", width: 1700, crowd: 0, paint: paintDojo, spots: [
    { id: "dummy", x: 560, fx: "hit", lift: 190 },
    { id: "mat", x: 1150, fx: "calm", lift: 80 },
  ] },
  arcade: { id: "arcade", width: 1900, crowd: 2, paint: paintArcade, spots: [
    { id: "cabinet", x: 630, fx: "score", lift: 250 },
    { id: "claw", x: 1315, fx: "star", lift: 260 },
  ] },
  park: { id: "park", width: 2400, crowd: 3, paint: paintPark, spots: [
    { id: "bench", x: 515, fx: "heart", lift: 130 },
    { id: "lake", x: 1300, fx: "ripple", lift: 62 },
  ] },
  rooftop: { id: "rooftop", width: 1900, crowd: 0, paint: paintRooftop, spots: [
    { id: "ledge", x: 980, fx: "star", lift: 200 },
    { id: "stargaze", x: 1510, fx: "star", lift: 260 },
  ] },
};

/** Paint a place once; the screen scrolls across it. */
export function buildPlace(id: PlaceId): HTMLCanvasElement {
  const p = PLACES[id];
  const c = document.createElement("canvas");
  c.width = p.width;
  c.height = H;
  p.paint(c.getContext("2d")!, p.width);
  return c;
}

// ---------- rehabilitated bosses, kept in this browser ----------
const REHAB_KEY = "npc-arena-rehab";
const REHAB_CHANGED = "npc-arena-rehab-changed";

export function loadRehab(): BossId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(REHAB_KEY) ?? "[]");
    return Array.isArray(raw) ? [...new Set(raw.filter((k): k is BossId => typeof k === "string"))] : [];
  } catch {
    return [];
  }
}

export function rehabilitate(id: BossId) {
  try {
    const list = loadRehab();
    if (!list.includes(id)) localStorage.setItem(REHAB_KEY, JSON.stringify([...list, id]));
    window.dispatchEvent(new Event(REHAB_CHANGED));
  } catch {
    // not kept if storage is blocked
  }
}

/** Rehabilitated bosses, read after the first render so the server and browser agree. */
export function useRehab(): BossId[] {
  const [list, setList] = useState<BossId[]>([]);
  useEffect(() => {
    const read = () => setList(loadRehab());
    read();
    window.addEventListener(REHAB_CHANGED, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(REHAB_CHANGED, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return list;
}

// ---------- the party and place you left off with ----------
const SAVE_KEY = "npc-arena-free";
export type FreeSave = { you: string; mates: string[]; place: PlaceId };
export function loadFree(): FreeSave | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<FreeSave> | null;
    if (!raw || typeof raw.you !== "string") return null;
    return {
      you: raw.you,
      mates: Array.isArray(raw.mates) ? raw.mates.filter((m): m is string => typeof m === "string").slice(0, 3) : [],
      place: PLACE_ORDER.includes(raw.place as PlaceId) ? (raw.place as PlaceId) : "house",
    };
  } catch {
    return null;
  }
}
export function saveFree(s: FreeSave) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // not kept if storage is blocked
  }
}
