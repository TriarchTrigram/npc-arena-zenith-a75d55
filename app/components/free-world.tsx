import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  PiArrowLeftBold, PiBuildingsBold, PiCaretLeftBold, PiCaretRightBold, PiDoorOpenBold, PiGameControllerBold, PiHandFistBold,
  PiHandHeartBold, PiHouseLineBold, PiMoonStarsBold, PiPencilSimpleBold, PiSparkleBold, PiSwordBold, PiTreeBold, PiUserPlusBold, PiUsersThreeBold,
} from "react-icons/pi";
import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { Button } from "~/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { PageHeader, Panel, PanelBody, SectionHeading, StatusBadge } from "~/components/design";
import { FighterDot } from "~/components/fighter-dot";
import { cn } from "~/lib/utils";
import { FIGHTERS, bossRosterId, defOf, isCustomKey, isNewGen, type FighterDef, type RosterId } from "~/lib/fighters";
import { useMyFighter } from "~/lib/my-fighter";
import { CharacterCreator } from "~/components/character-creator";
import { BOSSES, type BossId } from "~/lib/bosses";
import { useUnlocked } from "~/lib/quests";
import { useDevMode } from "~/lib/dev-mode";
import { useDevUnlocks } from "~/lib/dev-unlocks";
import { useHybrids } from "~/lib/hybrids";
import { allCleared, bossesBeaten, loadProgress } from "~/lib/story";
import { W, H, GROUND, newGame, step, drawScene, setAir, strollPose, drawStroller, type Game, type Fighter } from "~/lib/arena-engine";
import { arenaSound } from "~/lib/arena-sound";
import { arenaMusic } from "~/lib/arena-music";
import {
  PLACES, PLACE_ORDER, buildPlace, loadFree, rehabilitate, saveFree, useRehab,
  type FxKind, type PlaceId, type Spot,
} from "~/lib/free-world";

const PLACE_ICONS: Record<PlaceId, IconType> = {
  house: PiHouseLineBold,
  city: PiBuildingsBold,
  dojo: PiHandFistBold,
  arcade: PiGameControllerBold,
  park: PiTreeBold,
  rooftop: PiMoonStarsBold,
};
const MAX_MATES = 3;
const MAX_FOES = 6;
const WALK = 250;
const ORIGINALS: RosterId[] = FIGHTERS.map((f) => f.id);

type Fx = { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: FxKind | "dark"; text?: string; col: string };
type Walker = { f: Fighter; target: number; pause: number; speed: number; crowd: boolean };
type World = { place: PlaceId; canvas: HTMLCanvasElement; g: Game; you: Walker; mates: Walker[]; crowd: Walker[]; cam: number; fx: Fx[] };
type Outcome = "won" | "lost" | "draw";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** newGame shrinks fighters in a crowd; Free World keeps everyone at a duel's size, a touch smaller. */
const crowdScale = (n: number) => (n <= 2 ? 1.25 : n <= 4 ? 1.1 : n <= 8 ? 0.95 : 0.82);

function nearSpot(place: PlaceId, x: number): Spot | null {
  let best: Spot | null = null;
  for (const s of PLACES[place].spots) if (Math.abs(s.x - x) < 90 && (!best || Math.abs(s.x - x) < Math.abs(best.x - x))) best = s;
  return best;
}

function burst(w: World, kind: FxKind | "dark", x: number, y: number, col: string, n: number, text?: string) {
  for (let i = 0; i < n; i++) {
    const life = kind === "ripple" || kind === "calm" ? 1.2 + i * 0.25 : rand(0.9, 1.6);
    w.fx.push({
      x: x + (kind === "ripple" || kind === "calm" ? 0 : rand(-30, 30)),
      y: y + (kind === "ripple" || kind === "calm" ? 0 : rand(-10, 10)),
      vx: kind === "hit" || kind === "dark" ? rand(-260, 260) : rand(-20, 20),
      vy: kind === "hit" || kind === "dark" ? rand(-260, 60) : kind === "ripple" || kind === "calm" ? 0 : rand(-90, -50),
      life: life + (kind === "ripple" || kind === "calm" ? 0 : i * 0.12), max: life + (kind === "ripple" || kind === "calm" ? 0 : i * 0.12),
      kind, text, col,
    });
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function drawFx(ctx: CanvasRenderingContext2D, p: Fx) {
  const k = p.life / p.max;
  ctx.globalAlpha = clamp(k * 2, 0, 1);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "hsl(250 30% 12%)";
  ctx.fillStyle = p.col;
  if (p.kind === "zzz" || p.kind === "note" || p.kind === "score") {
    ctx.font = `800 ${p.kind === "score" ? 30 : 26}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    const t = p.text ?? (p.kind === "zzz" ? "Z" : "♪");
    ctx.strokeText(t, p.x, p.y);
    ctx.fillText(t, p.x, p.y);
  } else if (p.kind === "heart") {
    const s = 9;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + s);
    ctx.bezierCurveTo(p.x - s * 2, p.y - s * 0.5, p.x - s, p.y - s * 1.8, p.x, p.y - s * 0.7);
    ctx.bezierCurveTo(p.x + s, p.y - s * 1.8, p.x + s * 2, p.y - s * 0.5, p.x, p.y + s);
    ctx.fill(); ctx.stroke();
  } else if (p.kind === "spark" || p.kind === "star") {
    drawStar(ctx, p.x, p.y, p.kind === "star" ? 12 : 8);
    ctx.fill(); ctx.stroke();
  } else if (p.kind === "ripple" || p.kind === "calm") {
    const r = (1 - k) * (p.kind === "calm" ? 140 : 90) + 10;
    ctx.strokeStyle = p.col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, p.kind === "calm" ? r * 0.55 : r * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // hit sparks and the dark energy that leaves a rehabilitated boss
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.kind === "dark" ? 7 * k + 2 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Pick a group of fighter chips: one (you) or several (companions, opponents). */
function ChipGrid({ ids, picked, onToggle, disabledIds }: { ids: RosterId[]; picked: RosterId[]; onToggle: (id: RosterId) => void; disabledIds?: RosterId[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ids.map((id) => {
        const def = defOf(id);
        const on = picked.includes(id);
        const off = disabledIds?.includes(id) ?? false;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            disabled={off}
            onClick={() => onToggle(id)}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-hover active:bg-surface-active disabled:opacity-50",
              on ? "border-foreground bg-card font-semibold text-foreground" : "border-border bg-background text-muted-foreground",
            )}
          >
            <FighterDot def={def} className="size-5" />
            <span className="truncate">{def.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function Group({ title, children }: { title: StringKey; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Text id={title} as="h3" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
      {children}
    </div>
  );
}

export function FreeWorld({ music, onExit }: { music?: ReactNode; onExit?: () => void }) {
  const quests = useUnlocked();
  const dev = useDevMode().on;
  const devUnlocks = useDevUnlocks();
  const questers = quests.filter((p) => !isNewGen(p));
  const young = quests.filter(isNewGen);
  const rehab = useRehab();
  const hybrids = useHybrids();
  const [beaten, setBeaten] = useState<BossId[]>([]);
  useEffect(
    () => setBeaten(bossesBeaten(dev ? allCleared() : loadProgress().cleared, dev ? [] : devUnlocks.bosses)),
    [dev, devUnlocks.bosses],
  );
  const reformed = beaten.filter((b) => rehab.includes(b));
  const reformedIds = reformed.map(bossRosterId);
  const me = useMyFighter();
  const mine = me.id ? [me.id] : [];
  /** Everyone who can walk with you: your own character, the fighters, quest fighters, new gens and rehabilitated bosses. */
  const roster = useMemo(() => [...mine, ...ORIGINALS, ...questers, ...young, ...reformedIds], [me.id, questers.join(), young.join(), reformedIds.join()]);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const [place, setPlace] = useState<PlaceId>("house");
  const [you, setYou] = useState<RosterId>("pyro");
  const [mates, setMates] = useState<RosterId[]>(["hydro"]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const s = loadFree();
    if (s) {
      setYou(s.you);
      setMates(s.mates);
      setPlace(s.place);
    }
    setLoaded(true);
  }, []);
  // your character is saved by its whole sheet, so an edited one replaces the old pick
  const current = (id: RosterId) => (isCustomKey(id) && me.id ? me.id : id);
  // a saved pick that is no longer unlocked (cleared progress) quietly drops out
  const okYou = roster.includes(current(you)) ? current(you) : "pyro";
  const okMates = mates.map(current).filter((m) => roster.includes(m) && m !== okYou).slice(0, MAX_MATES);
  useEffect(() => {
    if (loaded) saveFree({ you: okYou, mates: okMates, place });
  }, [loaded, okYou, okMates.join(), place]);

  const [phase, setPhase] = useState<"explore" | "fight">("explore");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [note, setNote] = useState<{ key: StringKey; vars: Record<string, string | number> } | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [fightOpen, setFightOpen] = useState(false);
  const [foes, setFoes] = useState<RosterId[]>([]);
  const youTag = useString("free.youTag");
  const canvasAria = useString("free.canvasAria");
  const leftAria = useString("free.controls.left");
  const rightAria = useString("free.controls.right");
  const travelAria = useString("free.travel");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const fightRef = useRef<{ g: Game; backdrop: HTMLCanvasElement; done: boolean } | null>(null);
  const held = useRef({ left: false, right: false });
  const spotRef = useRef<Spot | null>(null);
  const tagRef = useRef(youTag);
  tagRef.current = youTag;
  const sheetOpen = useRef(false);
  sheetOpen.current = partyOpen || fightOpen || creatorOpen;

  // The world: the place painted once, your party, and anyone strolling by. Rebuilt when the place or party changes.
  useEffect(() => {
    if (!loaded) return;
    const prev = worldRef.current;
    const keepX = prev && prev.place === place ? prev.you.f.x : 220;
    const p = PLACES[place];
    const party = [okYou, ...okMates];
    const passers = [...ORIGINALS].filter((id) => !party.includes(id)).sort(() => Math.random() - 0.5).slice(0, p.crowd);
    const ids = [...party, ...passers];
    const g = newGame(ids.map(defOf), true);
    const base = crowdScale(ids.length);
    const walkers: Walker[] = g.fighters.map((f, i) => {
      f.scale = (f.scale / base) * 0.95;
      const crowd = i >= party.length;
      f.x = crowd ? rand(120, p.width - 120) : clamp(keepX - i * 70, 40, p.width - 40);
      f.y = GROUND;
      f.facing = crowd ? (Math.random() < 0.5 ? 1 : -1) : 1;
      return { f, target: f.x, pause: crowd ? rand(0, 3) : 0, speed: crowd ? rand(60, 110) : WALK, crowd };
    });
    worldRef.current = {
      place,
      canvas: prev && prev.place === place ? prev.canvas : buildPlace(place),
      g,
      you: walkers[0],
      mates: walkers.slice(1, party.length),
      crowd: walkers.slice(party.length),
      cam: prev && prev.place === place ? prev.cam : clamp(keepX - W / 2, 0, p.width - W),
      fx: prev && prev.place === place ? prev.fx : [],
    };
  }, [loaded, place, okYou, okMates.join()]);

  // Music: the calm theme while exploring, the battle theme in a fight.
  useEffect(() => {
    arenaMusic.play(phase === "fight" ? "battle" : "title");
  }, [phase]);

  const doSpot = useCallback(() => {
    const w = worldRef.current;
    const s = spotRef.current;
    if (!w || !s || fightRef.current) return;
    const name = w.you.f.def.name;
    const col = s.fx === "heart" ? "hsl(345 85% 66%)" : s.fx === "ripple" ? "hsl(195 90% 85%)" : s.fx === "calm" ? w.you.f.def.glow : s.fx === "zzz" || s.fx === "note" ? "hsl(0 0% 100%)" : "hsl(46 100% 62%)";
    const y = GROUND - s.lift;
    const score = s.fx === "score" ? Math.floor(rand(12, 99)) * 100 : 0;
    w.you.f.facing = s.x >= w.you.f.x ? 1 : -1;
    if (s.fx === "score") burst(w, "score", s.x, y, "hsl(50 100% 62%)", 1, String(score));
    else burst(w, s.fx, s.x, y, col, s.fx === "ripple" || s.fx === "calm" ? 3 : 6);
    if (s.fx === "hit") w.g.shake = 4;
    setNote({ key: `free.spots.${s.id}.done` as StringKey, vars: { name, score } });
  }, []);

  // Keyboard: arrows or A/D to walk, E (or W / up) to use the spot you're standing at.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || sheetOpen.current) return;
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") { held.current.left = true; e.preventDefault(); }
      else if (k === "arrowright" || k === "d") { held.current.right = true; e.preventDefault(); }
      else if ((k === "e" || k === "w" || k === "arrowup") && !e.repeat) { e.preventDefault(); doSpot(); }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") held.current.left = false;
      if (k === "arrowright" || k === "d") held.current.right = false;
    };
    const blur = () => { held.current.left = false; held.current.right = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [doSpot]);

  // One loop for both: strolling around the place, or the fight started there.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const fight = fightRef.current;
      if (fight) {
        if (!document.hidden && !fight.done) {
          const g = fight.g;
          step(g, dt);
          arenaSound.play(g.sfx);
          g.sfx.length = 0;
          if (g.over) {
            fight.done = true;
            setOutcome(g.winnerTeam === 0 ? "won" : g.winnerTeam == null ? "draw" : "lost");
          }
        }
        drawScene(ctx, fight.g, fight.backdrop);
        raf = requestAnimationFrame(loop);
        return;
      }
      const w = worldRef.current;
      if (w && !document.hidden) tickWorld(w, dt);
      if (w) drawWorld(ctx, w);
      raf = requestAnimationFrame(loop);
    };
    const tickWorld = (w: World, dt: number) => {
      const width = PLACES[w.place].width;
      w.g.t += dt;
      w.g.shake = Math.max(0, w.g.shake - dt * 30);
      // you
      const dir = (held.current.right ? 1 : 0) - (held.current.left ? 1 : 0);
      const me = w.you.f;
      const x0 = me.x;
      me.x = clamp(me.x + dir * WALK * dt, 30, width - 30);
      strollPose(w.g, me, me.x !== x0 ? dir : 0, me.x - x0, dt);
      // companions fall in behind you, spaced out
      w.mates.forEach((m, i) => {
        const goal = clamp(me.x - me.facing * 70 * (i + 1), 30, width - 30);
        const d = goal - m.f.x;
        const mx = m.f.x;
        if (Math.abs(d) > 14) m.f.x += Math.sign(d) * Math.min(Math.abs(d), (WALK + 30) * dt);
        const moved = m.f.x - mx;
        strollPose(w.g, m.f, moved ? Math.sign(moved) : 0, moved, dt);
        if (!moved) m.f.facing = me.facing;
      });
      // passers-by wander, stopping now and then
      for (const c of w.crowd) {
        if (c.pause > 0) {
          c.pause -= dt;
          strollPose(w.g, c.f, 0, 0, dt);
          continue;
        }
        if (Math.abs(c.target - c.f.x) < 6) {
          c.pause = rand(0.5, 3.5);
          c.target = rand(80, width - 80);
          continue;
        }
        const s = Math.sign(c.target - c.f.x) * Math.min(Math.abs(c.target - c.f.x), c.speed * dt);
        c.f.x += s;
        strollPose(w.g, c.f, Math.sign(s), s, dt);
      }
      w.cam += (clamp(me.x - W / 2, 0, Math.max(0, width - W)) - w.cam) * (1 - Math.exp(-dt * 6));
      for (const p of w.fx) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "hit" || p.kind === "dark") p.vy += 500 * dt;
      }
      w.fx = w.fx.filter((p) => p.life > 0);
      const s = nearSpot(w.place, me.x);
      if (s !== spotRef.current) {
        spotRef.current = s;
        setSpot(s);
      }
    };
    const drawWorld = (c: CanvasRenderingContext2D, w: World) => {
      const cam = Math.round(w.cam);
      c.save();
      if (w.g.shake > 0) c.translate(rand(-w.g.shake, w.g.shake), 0);
      c.drawImage(w.canvas, cam, 0, W, H, 0, 0, W, H);
      c.translate(-cam, 0);
      // a soft marker over each spot; brighter when you're at it
      for (const s of PLACES[w.place].spots) {
        const at = spotRef.current === s;
        const bob = Math.sin(w.g.t * 3 + s.x) * 5;
        c.globalAlpha = at ? 1 : 0.55;
        c.fillStyle = at ? "hsl(46 100% 62%)" : "hsl(0 0% 100%)";
        c.strokeStyle = "hsl(250 30% 12%)";
        c.lineWidth = 3;
        drawStar(c, s.x, GROUND - s.lift - 46 + bob, at ? 13 : 9);
        c.fill();
        c.stroke();
      }
      c.globalAlpha = 1;
      for (const cw of w.crowd) drawStroller(c, w.g, cw.f);
      for (const m of [...w.mates].reverse()) drawStroller(c, w.g, m.f);
      drawStroller(c, w.g, w.you.f);
      // "YOU" over your own head
      const me = w.you.f;
      c.font = "800 15px system-ui, sans-serif";
      c.textAlign = "center";
      c.lineWidth = 4;
      c.strokeStyle = "hsl(250 30% 12%)";
      c.fillStyle = me.def.glow;
      const ty = me.y - 128 * me.scale;
      c.strokeText(tagRef.current, me.x, ty);
      c.fillText(tagRef.current, me.x, ty);
      for (const p of w.fx) drawFx(c, p);
      c.restore();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const travel = (p: PlaceId) => {
    if (phase === "fight" || p === place) return;
    setNote(null);
    spotRef.current = null;
    setSpot(null);
    worldRef.current = null;
    setPlace(p);
  };

  const partyIds = [okYou, ...okMates];
  /** Opponents can be anyone you've met: every fighter, hybrids, and every boss you've beaten. */
  const foePool = [...ORIGINALS, ...questers, ...young, ...hybrids, ...beaten.map(bossRosterId)];
  const okFoes = foes.filter((f) => foePool.includes(f)).slice(0, MAX_FOES);
  const surprise = () => {
    const pool = foePool.filter((id) => !partyIds.includes(id)).sort(() => Math.random() - 0.5);
    setFoes(pool.slice(0, Math.max(1, Math.min(MAX_FOES, partyIds.length + (Math.random() < 0.5 ? 0 : 1)))));
  };
  const openFight = () => {
    if (okFoes.length === 0) surprise();
    setFightOpen(true);
  };

  const startFight = () => {
    const w = worldRef.current;
    if (!w || okFoes.length === 0) return;
    // the arena is the stretch of the place you're standing in
    const backdrop = document.createElement("canvas");
    backdrop.width = W;
    backdrop.height = H;
    backdrop.getContext("2d")!.drawImage(w.canvas, Math.round(w.cam), 0, W, H, 0, 0, W, H);
    setAir(backdrop, { motes: "dust", hue: 46, amount: 0.8 });
    const ids = [...partyIds, ...okFoes];
    const g = newGame(ids.map(defOf), false, ids.map((_, i) => (i < partyIds.length ? 0 : 1)));
    fightRef.current = { g, backdrop, done: false };
    held.current.left = false;
    held.current.right = false;
    setOutcome(null);
    setFightOpen(false);
    setPhase("fight");
  };
  const leaveFight = () => {
    fightRef.current = null;
    setOutcome(null);
    setPhase("explore");
  };

  const toggleMate = (id: RosterId) =>
    setMates((cur) => {
      const list = cur.filter((m) => roster.includes(m) && m !== okYou);
      if (list.includes(id)) return list.filter((m) => m !== id);
      return list.length >= MAX_MATES ? list : [...list, id];
    });
  const toggleFoe = (id: RosterId) =>
    setFoes((cur) => (cur.includes(id) ? cur.filter((f) => f !== id) : cur.length >= MAX_FOES ? cur : [...cur, id]));

  const doRehab = (id: BossId) => {
    rehabilitate(id);
    const rid = bossRosterId(id);
    if (okMates.length < MAX_MATES) setMates([...okMates, rid]);
    const w = worldRef.current;
    if (w) {
      const x = w.you.f.x - w.you.f.facing * 70 * (okMates.length + 1);
      burst(w, "dark", x, GROUND - 70, "hsl(275 60% 22%)", 18);
      burst(w, "calm", x, GROUND - 10, "hsl(46 100% 70%)", 3);
      burst(w, "star", x, GROUND - 150, "hsl(46 100% 70%)", 5);
    }
    setNote({ key: "free.bosses.done", vars: { name: BOSSES[id].name } });
  };

  const pickGroups: { title: StringKey; ids: RosterId[] }[] = [
    { title: "free.groups.mine", ids: mine },
    { title: "free.groups.originals", ids: ORIGINALS },
    { title: "free.groups.quest", ids: questers },
    { title: "free.groups.newgen", ids: young },
    { title: "free.groups.bosses", ids: reformedIds },
  ];
  const fighting = phase === "fight";

  return (
    <div data-free-world>
      <PageHeader
        eyebrow={<Text id="free.eyebrow" />}
        title={<Text id={`free.places.${place}.name` as StringKey} />}
        subtitle={<Text id={`free.places.${place}.blurb` as StringKey} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {onExit && (
              <Button size="sm" variant="outline" onClick={onExit} data-free-exit>
                <PiArrowLeftBold className="size-5" aria-hidden />
                <Text id="free.exit" />
              </Button>
            )}
            {music}
            <StatusBadge tone={fighting ? "warning" : "success"}><Text id={fighting ? "free.status.fight" : "free.status.explore"} /></StatusBadge>
          </div>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelBody className="flex flex-col gap-4">
              <div className="flex gap-2 overflow-x-auto py-1.5" role="group" aria-label={travelAria} data-free-places>
                {PLACE_ORDER.map((p) => {
                  const Icon = PLACE_ICONS[p];
                  return (
                    <Button key={p} size="sm" variant={place === p ? "default" : "outline"} aria-pressed={place === p} disabled={fighting} onClick={() => travel(p)} className="shrink-0">
                      <Icon className="size-5" aria-hidden />
                      <Text id={`free.places.${p}.name` as StringKey} />
                    </Button>
                  );
                })}
              </div>

              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  role="img"
                  aria-label={canvasAria}
                  className="block h-auto w-full rounded-xl border-4 border-border bg-background-secondary"
                />
                {!fighting && spot && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
                    <Button size="sm" onClick={doSpot} className="pointer-events-auto shadow-lg" data-free-spot>
                      <PiSparkleBold className="size-5" aria-hidden />
                      <Text id={`free.spots.${spot.id}.label` as StringKey} />
                    </Button>
                  </div>
                )}
                {fighting && outcome && (
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <div className="rounded-2xl border-4 border-foreground bg-card px-8 py-6 text-center">
                      <Text id={`free.fight.${outcome}` as StringKey} as="p" className="font-display text-3xl text-foreground" />
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button onClick={leaveFight}><Text id="free.fight.back" /></Button>
                        <Button variant="outline" onClick={startFight}><Text id="free.fight.again" /></Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!fighting ? (
                  <>
                    {(["left", "right"] as const).map((side) => (
                      <Button
                        key={side}
                        size="sm"
                        variant="outline"
                        aria-label={side === "left" ? leftAria : rightAria}
                        className="touch-none select-none"
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); held.current[side] = true; }}
                        onPointerUp={() => { held.current[side] = false; }}
                        onPointerCancel={() => { held.current[side] = false; }}
                        onLostPointerCapture={() => { held.current[side] = false; }}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {side === "left" ? <PiCaretLeftBold className="size-5" /> : <PiCaretRightBold className="size-5" />}
                      </Button>
                    ))}
                    <Text id="free.controls.hint" className="text-sm text-muted-foreground" />
                    <Button className="ml-auto" onClick={openFight} data-free-fight>
                      <PiSwordBold className="size-5" aria-hidden />
                      <Text id="free.fight.open" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Text id="free.fight.hint" className="text-sm text-muted-foreground" />
                    <Button variant="outline" className="ml-auto" onClick={leaveFight}>
                      <PiDoorOpenBold className="size-5" aria-hidden />
                      <Text id="free.fight.leave" />
                    </Button>
                  </>
                )}
              </div>
              <div aria-live="polite" className="min-h-6 text-sm text-foreground-secondary">
                {note && !fighting && <Text id={note.key} vars={note.vars} />}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <section data-free-me>
            <SectionHeading
              title={<Text id="free.me.title" />}
              action={me.spec && (
                <Button size="sm" variant="ghost" disabled={fighting} onClick={() => setCreatorOpen(true)}>
                  <PiPencilSimpleBold className="size-5" aria-hidden />
                  <Text id="free.me.edit" />
                </Button>
              )}
            />
            <Panel className="mt-3">
              <PanelBody className="flex flex-col gap-3">
                {me.id ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <FighterDot def={defOf(me.id)} className="size-5" />
                      <span className="min-w-0 truncate font-semibold text-foreground">{defOf(me.id).name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{defOf(me.id).power}</p>
                    {okYou !== me.id && (
                      <Button size="sm" variant="outline" disabled={fighting} onClick={() => { setYou(me.id!); setMates((cur) => cur.filter((m) => !isCustomKey(m))); }}>
                        <Text id="free.me.play" vars={{ name: defOf(me.id).name }} />
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Text id="free.me.empty" as="p" className="text-sm text-muted-foreground" />
                    <Button size="sm" disabled={fighting} onClick={() => setCreatorOpen(true)} data-free-make>
                      <PiUserPlusBold className="size-5" aria-hidden />
                      <Text id="free.me.make" />
                    </Button>
                  </>
                )}
              </PanelBody>
            </Panel>
          </section>

          <section>
            <SectionHeading
              title={<Text id="free.party.title" />}
              action={
                <Button size="sm" variant="ghost" disabled={fighting} onClick={() => setPartyOpen(true)}>
                  <PiUsersThreeBold className="size-5" aria-hidden />
                  <Text id="free.party.change" />
                </Button>
              }
            />
            <Panel className="mt-3">
              <PanelBody>
                <ul className="flex flex-col gap-3" data-free-party>
                  {partyIds.map((id, i) => (
                    <li key={id} className="flex items-center gap-2 text-sm">
                      <FighterDot def={defOf(id)} className="size-4" />
                      <span className="font-semibold text-foreground">{defOf(id).name}</span>
                      {i === 0 && <Text id="free.party.you" className="ml-auto rounded-full border-2 border-foreground px-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-foreground" />}
                    </li>
                  ))}
                </ul>
                {okMates.length === 0 && <Text id="free.party.empty" as="p" className="mt-3 text-sm text-muted-foreground" />}
              </PanelBody>
            </Panel>
          </section>

          <section data-free-bosses>
            <SectionHeading title={<Text id="free.bosses.title" />} />
            <Panel className="mt-3">
              <PanelBody className="flex flex-col gap-3">
                {beaten.length === 0 ? (
                  <Text id="free.bosses.empty" as="p" className="text-sm text-muted-foreground" />
                ) : (
                  <>
                    <Text id="free.bosses.hint" as="p" className="text-sm text-muted-foreground" />
                    <ul className="flex flex-col gap-3">
                      {beaten.map((b) => {
                        const def: FighterDef = BOSSES[b];
                        const done = rehab.includes(b);
                        return (
                          <li key={b} className="flex items-center gap-2 text-sm">
                            <FighterDot def={def} className="size-4" />
                            <span className="min-w-0 truncate font-semibold text-foreground">{def.name}</span>
                            {done ? (
                              <span className="ml-auto shrink-0"><StatusBadge tone="success"><Text id="free.bosses.rehabbed" /></StatusBadge></span>
                            ) : (
                              <Button size="sm" variant="outline" className="ml-auto shrink-0" disabled={fighting} onClick={() => doRehab(b)}>
                                <PiHandHeartBold className="size-5" aria-hidden />
                                <Text id="free.bosses.rehab" />
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </PanelBody>
            </Panel>
          </section>
        </aside>
      </div>

      <CharacterCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        saved={me.spec}
        powers={[...FIGHTERS.map((f) => f.id), ...quests]}
        onSaved={(id) => {
          setYou(id);
          setMates((cur) => cur.filter((m) => !isCustomKey(m)));
        }}
      />

      <Sheet open={partyOpen} onOpenChange={setPartyOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display text-xl"><Text id="free.party.title" /></SheetTitle>
            <SheetDescription><Text id="free.party.intro" /></SheetDescription>
          </SheetHeader>
          <SheetBody className="gap-6">
            <section className="flex flex-col gap-3">
              <Text id="free.party.youTitle" as="h2" className="font-display text-lg text-foreground" />
              {pickGroups.map((grp) => grp.ids.length > 0 && (
                <Group key={grp.title} title={grp.title}>
                  <ChipGrid ids={grp.ids} picked={[okYou]} onToggle={(id) => { setYou(id); setMates((cur) => cur.filter((m) => m !== id)); }} />
                </Group>
              ))}
            </section>
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <Text id="free.party.matesTitle" as="h2" className="font-display text-lg text-foreground" />
                <Text id="free.party.count" vars={{ count: okMates.length, max: MAX_MATES }} className="ml-auto text-sm text-muted-foreground tabular-nums" />
              </div>
              {pickGroups.map((grp) => grp.ids.length > 0 && (
                <Group key={grp.title} title={grp.title}>
                  <ChipGrid
                    ids={grp.ids}
                    picked={okMates}
                    onToggle={toggleMate}
                    disabledIds={[okYou, ...(okMates.length >= MAX_MATES ? grp.ids.filter((id) => !okMates.includes(id)) : [])]}
                  />
                </Group>
              ))}
              {reformedIds.length === 0 && <Text id="free.party.bossNote" as="p" className="text-sm text-muted-foreground" />}
            </section>
            <Button onClick={() => setPartyOpen(false)}><Text id="free.party.done" /></Button>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet open={fightOpen} onOpenChange={setFightOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg" data-free-fight-sheet>
          <SheetHeader>
            <SheetTitle className="font-display text-xl"><Text id="free.fight.title" /></SheetTitle>
            <SheetDescription><Text id="free.fight.intro" /></SheetDescription>
          </SheetHeader>
          <SheetBody className="gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <Text id="free.fight.count" vars={{ count: okFoes.length, max: MAX_FOES }} className="text-sm text-muted-foreground tabular-nums" />
              <Button size="sm" variant="ghost" className="ml-auto" onClick={surprise}><Text id="free.fight.surprise" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setFoes([])}><Text id="free.fight.clear" /></Button>
            </div>
            {[
              { title: "free.groups.originals" as StringKey, ids: ORIGINALS },
              { title: "free.groups.quest" as StringKey, ids: questers },
              { title: "free.groups.newgen" as StringKey, ids: young },
              { title: "free.groups.hybrids" as StringKey, ids: hybrids },
              { title: "free.groups.beaten" as StringKey, ids: beaten.map(bossRosterId) },
            ].map((grp) => grp.ids.length > 0 && (
              <Group key={grp.title} title={grp.title}>
                <ChipGrid
                  ids={grp.ids}
                  picked={okFoes}
                  onToggle={toggleFoe}
                  disabledIds={[...partyIds, ...(okFoes.length >= MAX_FOES ? grp.ids.filter((id) => !okFoes.includes(id)) : [])]}
                />
              </Group>
            ))}
            <Button onClick={startFight} disabled={okFoes.length === 0}>
              <PiSwordBold className="size-5" aria-hidden />
              <Text id="free.fight.go" />
            </Button>
            {okFoes.length === 0 && <Text id="free.fight.need" as="p" className="text-sm text-error" />}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
