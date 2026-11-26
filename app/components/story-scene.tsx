// Story mode's cutscenes: a chapter's opening, the words traded before each stage, the boss's last words after
// it falls, and a book's ending. Each one opens on a title card over black, then the stage plays behind the words
// on its own backdrop: letterboxed, the camera cutting to whoever is talking and slowly pushing in. Bosses get a
// reveal of their own (their entrance, a flash, their name slammed across the screen), and a beaten boss breaks
// apart on its last line. With reduced motion the scene skips the cards and reveals and simply shows the words.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { Button } from "~/components/ui/button";
import { FighterPortrait } from "~/components/quest-scenes";
import { cn } from "~/lib/utils";
import { W, H, GROUND, arrive, drawScene, holdBack, newGame, outlinedText, settle, step, vanish } from "~/lib/arena-engine";
import { drawBars, drawBossTitle, drawVignette } from "~/lib/arena-cinema";
import { arenaSound } from "~/lib/arena-sound";
import { BOSSES } from "~/lib/bosses";
import type { FighterDef } from "~/lib/fighters";
import { BOOKS, CHAPTERS, bookOf, enemySide, lairOf, playerSide, stageLineup, type Pair } from "~/lib/story";
import { storyBackdrop } from "~/lib/story-backdrops";
import { sceneLines, type Scene } from "~/lib/story-script";

export const CHAPTER_TITLES: StringKey[] = ["story.chapterTitle", "story.ch2.title", "story.ch3.title", "story.ch4.title", "story.ch5.title", "story.ch6.title", "story.ch7.title", "story.ch8.title", "story.ch9.title", "story.ch10.title", "story.ch11.title", "story.ch12.title", "story.ch13.title", "story.ch14.title", "story.ch15.title", "story.ch16.title", "story.ch17.title", "story.ch18.title", "story.ch19.title", "story.ch20.title", "story.ch21.title", "story.ch22.title", "story.ch23.title"];
const STAGE_PREFIX = ["story.stages", "story.ch2.stages", "story.ch3.stages", "story.ch4.stages", "story.ch5.stages", "story.ch6.stages", "story.ch7.stages", "story.ch8.stages", "story.ch9.stages", "story.ch10.stages", "story.ch11.stages", "story.ch12.stages", "story.ch13.stages", "story.ch14.stages", "story.ch15.stages", "story.ch16.stages", "story.ch17.stages", "story.ch18.stages", "story.ch19.stages", "story.ch20.stages", "story.ch21.stages", "story.ch22.stages", "story.ch23.stages"];
export const stageNameKey = (ch: number, i: number) => `${STAGE_PREFIX[ch]}.s${i + 1}` as StringKey;

/** The title card over black, the boss arriving, or the words. */
type Beat = "title" | "reveal" | "talk";
/** How long the boss's name stays across the screen once it has landed, in seconds. */
const PLATE = 2.3;
/** How long the picture takes to come up out of black. */
const FADE_MS = 800;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (k: number) => 1 - Math.pow(1 - k, 3);
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function StoryScene({ scene, pair, onDone }: { scene: Scene; pair: Pair; onDone: () => void }) {
  const lines = useMemo(() => sceneLines(scene), [scene]);
  const reduce = useMemo(reducedMotion, []);
  const LAIR = lairOf(scene.ch);
  const boss = BOSSES[CHAPTERS[scene.ch].stages[LAIR].boss!];
  const stage = scene.kind === "stage" ? scene.stage : LAIR;
  const lair = scene.kind === "stage" && stage === LAIR;
  const book = bookOf(scene.ch);
  const firstOfBook = scene.kind === "intro" && scene.ch === BOOKS[book].first;
  const mine = playerSide(pair);
  const foe: FighterDef = scene.kind === "stage" ? enemySide(scene.ch, CHAPTERS[scene.ch].stages[stage])[0] : boss;

  // who stands in the scene: the boss alone for a chapter's opening, the player's pair alone for an ending,
  // otherwise the stage's own lineup (the player on team 0)
  const cast = useMemo(() => {
    if (scene.kind === "intro") return { defs: [boss] as FighterDef[], teams: [1] };
    if (scene.kind === "ending") return { defs: mine, teams: mine.map(() => 0) };
    return stageLineup(pair, scene.ch, CHAPTERS[scene.ch].stages[stage]);
    // the scene is fixed for the life of this overlay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const foeKeys = useMemo(() => cast.teams.flatMap((t, i) => (t !== 0 ? [i] : [])), [cast]);

  // the shape of this scene: how long its title card holds, and before which line the boss arrives
  const titleLen = reduce ? 0 : scene.kind === "intro" ? (firstOfBook ? 4.8 : 3.6) : scene.kind === "ending" ? 3.6 : lair ? 2.8 : scene.kind === "stage" ? 2.1 : 0;
  const revealAt = reduce ? -1 : scene.kind === "intro" ? lines.length - 1 : lair ? 0 : -1;
  // who is kept out of sight at first: the boss of an opening or a lair, the stage's enemies before a fight
  const hidden = reduce || scene.kind === "outro" || scene.kind === "ending" ? [] : foeKeys;

  const [beat, setBeat] = useState<Beat>(titleLen > 0 ? "title" : revealAt === 0 ? "reveal" : "talk");
  const [cardOn, setCardOn] = useState(titleLen > 0);
  const [at, setAt] = useState(0);
  const line = lines[Math.min(at, lines.length - 1)];
  const last = at >= lines.length - 1;
  const text = useString(line.key);
  const aria = useString("story.scene.aria");
  const bossWord = useString("story.boss");
  const talking = beat === "talk";

  const speaker = line.who === "you" ? mine[0] : line.who === "foe" ? foe : line.who === "boss" ? boss : null;
  const speakerName = line.who === "you" ? mine.map((f) => f.name).join(" & ") : speaker?.name ?? "";

  // the line types itself out once the words are up; a tap shows the rest at once, the next tap moves on
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!talking) {
      setShown(0);
      return;
    }
    if (reduce) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const id = window.setInterval(() => setShown((n) => (n >= text.length ? n : n + 1)), 22);
    return () => window.clearInterval(id);
  }, [text, talking, reduce]);
  const typing = talking && shown < text.length;

  // everything the canvas loop reads lives in refs, so the loop never restarts
  const gameRef = useRef<ReturnType<typeof newGame> | null>(null);
  const beatRef = useRef(beat);
  beatRef.current = beat;
  const mountRef = useRef(0);
  const upRef = useRef(0); // when the picture started coming up out of black
  const cuesRef = useRef<{ at: number; run: () => void }[]>([]);
  const revealRef = useRef<{ keys: number[]; end: number } | null>(null);
  const plateRef = useRef<{ start: number } | null>(null);
  const flashRef = useRef(-1e9);
  const timerRef = useRef(0);

  /** Brings fighters in with their own entrances; each landing gets its voice, and a boss's a flash, focus lines and its name. */
  const bringIn = (keys: number[], gap: number, title: boolean) => {
    const g = gameRef.current;
    if (!g || !keys.length) return 0;
    const now = performance.now();
    const { lands, done } = arrive(g, keys, gap);
    lands.forEach((s, i) => {
      const f = g.fighters.find((x) => x.key === keys[i]);
      if (!f) return;
      cuesRef.current.push({
        at: now + s * 1000,
        run: () => {
          if (i < 3) arenaSound.play([{ k: "intro", power: f.def.id }]);
          if (!f.def.boss) return;
          flashRef.current = performance.now();
          g.focus.push({ x: f.x, y: f.y - 55 * f.scale, t: 0, max: 0.6, seed: Math.random() * 100, color: f.def.glow });
          if (title) plateRef.current = { start: performance.now() };
        },
      });
    });
    return Math.max(done, (lands[lands.length - 1] ?? 0) + (title ? PLATE * 0.9 : 0));
  };

  const endTitle = () => {
    if (beatRef.current !== "title") return;
    window.clearTimeout(timerRef.current);
    upRef.current = performance.now();
    // the card fades, then leaves
    window.setTimeout(() => setCardOn(false), FADE_MS);
    // an ordinary stage's enemies arrive as the words begin
    if (scene.kind === "stage" && !lair) bringIn(foeKeys, Math.min(0.35, 1.4 / Math.max(1, foeKeys.length)), false);
    const next: Beat = revealAt === 0 ? "reveal" : "talk";
    beatRef.current = next;
    setBeat(next);
  };

  const endReveal = () => {
    if (beatRef.current !== "reveal") return;
    const g = gameRef.current;
    if (g) settle(g);
    cuesRef.current = [];
    revealRef.current = null;
    plateRef.current = null;
    beatRef.current = "talk";
    setBeat("talk");
  };

  const advance = () => {
    if (beat === "title") endTitle();
    else if (beat === "reveal") endReveal();
    else if (typing) setShown(text.length);
    else if (last) onDone();
    else {
      setAt(at + 1);
      if (at + 1 === revealAt) setBeat("reveal");
    }
  };
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // the title card holds, then the picture comes up
  useEffect(() => {
    if (beat !== "title") return;
    timerRef.current = window.setTimeout(() => endTitle(), titleLen * 1000);
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat]);

  // the boss's reveal: its entrance, then its name, then the words carry on
  useEffect(() => {
    if (beat !== "reveal" || !gameRef.current) return;
    const keys = scene.kind === "intro" ? [0] : foeKeys;
    const len = bringIn(keys, 0.4, true);
    revealRef.current = { keys, end: performance.now() + len * 1000 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat]);

  // a beaten boss breaks apart on the scene's last line
  const goneRef = useRef(false);
  useEffect(() => {
    const g = gameRef.current;
    if (scene.kind !== "outro" || !talking || !last || goneRef.current || !g) return;
    goneRef.current = true;
    const key = foeKeys[0];
    if (key === undefined) return;
    vanish(g, key);
    flashRef.current = performance.now();
    arenaSound.play([{ k: "ko" }]);
  }, [scene.kind, talking, last, foeKeys]);

  // the shot the camera wants for what is on screen now; a new side is a cut, the same side keeps drifting
  type Side = "left" | "right" | "mid" | "pan" | "reveal";
  const side: Side =
    beat === "title" ? "mid"
    : beat === "reveal" ? "reveal"
    : line.who === "you" ? "left"
    : line.who === "narrator" ? (scene.kind === "intro" ? (at >= revealAt ? "right" : "pan") : "mid")
    : "right";
  const shotRef = useRef<{ key: string; side: Side; since: number }>({ key: "", side, since: 0 });
  const wantRef = useRef({ key: `${beat}-${at}`, side });
  wantRef.current = { key: `${beat}-${at}`, side };

  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    arenaSound.unlock();
    // an ending goes back to where its book began (Book 2's harbour, Book 3's snowfields), with only the player's pair left standing
    const backdrop = scene.kind === "ending" ? storyBackdrop(BOOKS[book].first, 0) : storyBackdrop(scene.ch, stage);
    const g = newGame(cast.defs, true, cast.teams);
    gameRef.current = g;
    if (hidden.length) holdBack(g, hidden);
    // without the reveal, a boss's scene still opens on its voice
    if (reduce && (scene.kind === "intro" || lair)) arenaSound.play([{ k: "intro", power: boss.id }]);
    const start = performance.now();
    mountRef.current = start;
    if (titleLen === 0) upRef.current = start;
    const cam = { x: W / 2, z: 1 };
    let raf = 0, prev = start;

    const aim = (s: Side, p: number) => {
      const group =
        s === "reveal" ? g.fighters.filter((f) => revealRef.current?.keys.includes(f.key))
        : s === "left" ? g.fighters.filter((f) => f.team === 0)
        : s === "right" ? g.fighters.filter((f) => f.team !== 0)
        : [];
      const mid = group.length ? group.reduce((n, f) => n + f.x, 0) / group.length : W / 2;
      if (s === "pan") return { x: W * 0.36 + W * 0.28 * p, z: 1.14 + 0.05 * p };
      if (s === "mid") return { x: W / 2, z: (beatRef.current === "title" ? 1.0 : 1.04) + 0.07 * p };
      if (s === "reveal") return { x: mid, z: 1.3 + 0.3 * p };
      return { x: mid, z: 1.42 + 0.12 * p };
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!reduce) step(g, dt);
      // cues: voices, flashes and the boss's name, each at its moment
      if (cuesRef.current.length) {
        const due = cuesRef.current.filter((c) => c.at <= now);
        cuesRef.current = cuesRef.current.filter((c) => c.at > now);
        for (const c of due) c.run();
      }
      if (revealRef.current && now >= revealRef.current.end) endRevealRef.current();

      // the camera: cut on a new side, then a slow push in for as long as the shot holds
      const want = wantRef.current;
      const shot = shotRef.current;
      if (want.key !== shot.key) {
        const cut = want.side !== shot.side || shot.key === "";
        shotRef.current = { key: want.key, side: want.side, since: cut ? now : shot.since };
        if (cut || reduce) {
          const a = aim(want.side, 0);
          cam.x = a.x;
          cam.z = a.z;
        }
      }
      const p = reduce ? 0 : ease(clamp((now - shotRef.current.since) / 7000, 0, 1));
      const a = aim(shotRef.current.side, p);
      const k = reduce ? 1 : Math.min(1, dt * 3);
      cam.x += (a.x - cam.x) * k;
      cam.z += (a.z - cam.z) * k;
      const x = Math.max(W / (2 * cam.z), Math.min(W - W / (2 * cam.z), cam.x));
      ctx.setTransform(cam.z, 0, 0, cam.z, W / 2 - x * cam.z, H * 0.92 - GROUND * cam.z);
      drawScene(ctx, g, backdrop);

      // screen space: the lens, the flash, the boss's name, the letterbox, and black over it all until the picture comes up
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawVignette(ctx, 1);
      const fl = 1 - (now - flashRef.current) / 320;
      if (fl > 0 && !reduce) {
        ctx.fillStyle = `hsl(0 0% 100% / ${0.75 * fl})`;
        ctx.fillRect(0, 0, W, H);
      }
      const plate = plateRef.current;
      if (plate) {
        const t = (now - plate.start) / 1000;
        if (t >= PLATE) plateRef.current = null;
        else {
          const def = g.fighters.find((f) => f.def.boss)?.def ?? boss;
          drawBossTitle(ctx, { eyebrow: bossWord, name: def.name, power: def.power, a: def.color, b: def.glow, t, max: PLATE }, outlinedText);
        }
      }
      drawBars(ctx, reduce ? 1 : clamp((now - start) / 900, 0, 1));
      const black = beatRef.current === "title" ? 1 : reduce ? 0 : 1 - clamp((now - upRef.current) / FADE_MS, 0, 1);
      if (black > 0.001) {
        ctx.fillStyle = `hsl(250 40% 3% / ${black})`;
        ctx.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") doneRef.current();
      else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        advanceRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key);
      gameRef.current = null;
    };
    // the scene is fixed for the life of this overlay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const endRevealRef = useRef(endReveal);
  endRevealRef.current = endReveal;

  // the title card's parts come in one after another
  const enter = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms`, animationFillMode: "both" });
  const accent: CSSProperties = { background: `linear-gradient(90deg, transparent, ${boss.glow}, ${boss.color}, transparent)` };
  const cardIn = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700";

  return (
    <div role="dialog" aria-modal="true" aria-label={aria} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-4" data-story-scene>
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-4 border-border bg-black motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <div className="relative">
          <canvas ref={ref} width={W} height={H} aria-hidden="true" className="block h-auto w-full" onClick={advance} />

          {/* the caption along the top, once the title card has gone */}
          <div className={cn("pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 bg-gradient-to-b from-black/85 to-transparent px-6 pt-4 pb-10 text-center transition-opacity duration-500 sm:pt-6", beat === "title" ? "opacity-0" : "opacity-100")}>
            {scene.kind === "stage" ? (
              <>
                <Text id="story.stageNumber" vars={{ n: scene.stage + 1 }} className="text-xs font-extrabold uppercase tracking-[0.15em] text-white/80" />
                <Text id={stageNameKey(scene.ch, scene.stage)} as="h2" className="font-display text-xl text-white text-balance sm:text-3xl" />
              </>
            ) : scene.kind === "ending" ? (
              <Text id={book === 2 ? "story.ending3.title" : "story.ending.title"} as="h2" className="font-display text-xl text-white text-balance sm:text-3xl" />
            ) : (
              <Text id={CHAPTER_TITLES[scene.ch]} as="h2" className="font-display text-xl text-white text-balance sm:text-3xl" />
            )}
          </div>

          {/* the title card over black */}
          {titleLen > 0 && (
            <div
              className={cn("absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center transition-opacity duration-700 sm:gap-4", beat === "title" ? "opacity-100" : "pointer-events-none opacity-0")}
              onClick={advance}
              aria-hidden={beat !== "title"}
              data-story-title-card
            >
              {cardOn || beat === "title" ? (
                <>
                  {scene.kind === "stage" ? (
                    <span className={cn("flex items-center gap-3", cardIn)} style={enter(150)}>
                      <Text id="story.stageNumber" vars={{ n: scene.stage + 1 }} className="text-xs font-extrabold uppercase tracking-[0.15em] text-white/75 sm:text-sm" />
                      {lair && <Text id="story.boss" className="text-xs font-extrabold uppercase tracking-[0.15em] text-error sm:text-sm" />}
                    </span>
                  ) : (
                    <Text
                      id={`story.books.b${book + 1}` as StringKey}
                      className={cn(firstOfBook ? "font-display text-xl text-white/90 sm:text-3xl" : "text-xs font-extrabold uppercase tracking-[0.15em] text-white/75 sm:text-sm", cardIn)}
                      style={enter(150)}
                    />
                  )}
                  <span className="h-0.5 w-40 rounded-full motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-0 motion-safe:duration-700 sm:w-64" style={{ ...accent, ...enter(firstOfBook ? 1300 : 500) }} aria-hidden />
                  <Text
                    id={scene.kind === "stage" ? stageNameKey(scene.ch, scene.stage) : scene.kind === "ending" ? (book === 2 ? "story.ending3.title" : "story.ending.title") : CHAPTER_TITLES[scene.ch]}
                    as="h2"
                    className={cn("max-w-2xl font-display text-3xl text-white text-balance sm:text-5xl", cardIn, "motion-safe:duration-1000")}
                    style={enter(firstOfBook ? 1700 : scene.kind === "stage" ? 350 : 750)}
                  />
                </>
              ) : null}
            </div>
          )}

          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
            <Button size="sm" variant="secondary" onClick={onDone}><Text id="story.scene.skip" /></Button>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t-4 border-border bg-card px-4 py-4 sm:gap-4 sm:px-6" aria-live="polite">
          {speaker && (
            <div className={cn("w-16 shrink-0 overflow-hidden rounded-xl border-2 border-border bg-background-secondary sm:w-24", !talking && "invisible")} key={speaker.name}>
              <FighterPortrait def={speaker} locked={false} />
            </div>
          )}
          <div className={cn("flex min-w-0 flex-1 flex-col gap-1", !talking && "invisible")}>
            {speaker ? (
              <p className="flex items-center gap-2 font-display text-lg text-foreground">
                <span className="size-3 shrink-0 rounded-full border-2 border-foreground" style={{ background: speaker.minion?.mark ?? speaker.glow }} aria-hidden />
                {speakerName}
              </p>
            ) : null}
            <p className="min-h-[3em] max-w-prose text-base text-foreground-secondary">
              {talking ? text.slice(0, shown) : ""}
              <span className="invisible">{talking ? text.slice(shown) : text}</span>
            </p>
          </div>
          <Button className="shrink-0 self-end" onClick={advance}>
            <Text id={!talking || !last || typing ? "story.scene.next" : scene.kind === "stage" ? "story.scene.fight" : "story.scene.continue"} />
          </Button>
        </div>
      </div>
    </div>
  );
}
