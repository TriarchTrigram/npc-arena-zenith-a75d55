// Story mode's cutscenes: a chapter's opening, the words traded before each stage, and the boss's last
// words after it falls. The stage itself plays behind them on its own backdrop, the camera leaning in on
// whoever is talking, with the line typed out in a box underneath.
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { Button } from "~/components/ui/button";
import { FighterPortrait } from "~/components/quest-scenes";
import { W, H, GROUND, drawScene, newGame, step } from "~/lib/arena-engine";
import { arenaSound } from "~/lib/arena-sound";
import { BOSSES } from "~/lib/bosses";
import type { FighterDef } from "~/lib/fighters";
import { BOOKS, CHAPTERS, bookOf, enemySide, lairOf, playerSide, stageLineup, type Pair } from "~/lib/story";
import { storyBackdrop } from "~/lib/story-backdrops";
import { sceneLines, type Scene } from "~/lib/story-script";

export const CHAPTER_TITLES: StringKey[] = ["story.chapterTitle", "story.ch2.title", "story.ch3.title", "story.ch4.title", "story.ch5.title", "story.ch6.title", "story.ch7.title", "story.ch8.title", "story.ch9.title", "story.ch10.title", "story.ch11.title", "story.ch12.title", "story.ch13.title", "story.ch14.title", "story.ch15.title", "story.ch16.title", "story.ch17.title", "story.ch18.title", "story.ch19.title", "story.ch20.title"];
const STAGE_PREFIX = ["story.stages", "story.ch2.stages", "story.ch3.stages", "story.ch4.stages", "story.ch5.stages", "story.ch6.stages", "story.ch7.stages", "story.ch8.stages", "story.ch9.stages", "story.ch10.stages", "story.ch11.stages", "story.ch12.stages", "story.ch13.stages", "story.ch14.stages", "story.ch15.stages", "story.ch16.stages", "story.ch17.stages", "story.ch18.stages", "story.ch19.stages", "story.ch20.stages"];
export const stageNameKey = (ch: number, i: number) => `${STAGE_PREFIX[ch]}.s${i + 1}` as StringKey;

export function StoryScene({ scene, pair, onDone }: { scene: Scene; pair: Pair; onDone: () => void }) {
  const lines = useMemo(() => sceneLines(scene), [scene]);
  const [at, setAt] = useState(0);
  const line = lines[Math.min(at, lines.length - 1)];
  const last = at >= lines.length - 1;
  const text = useString(line.key);
  const aria = useString("story.scene.aria");

  const LAIR = lairOf(scene.ch);
  const boss = BOSSES[CHAPTERS[scene.ch].stages[LAIR].boss!];
  const stage = scene.kind === "stage" ? scene.stage : LAIR;
  const mine = playerSide(pair);
  const foe: FighterDef = scene.kind === "stage" ? enemySide(scene.ch, CHAPTERS[scene.ch].stages[stage])[0] : boss;
  const speaker = line.who === "you" ? mine[0] : line.who === "foe" ? foe : line.who === "boss" ? boss : null;
  const speakerName = line.who === "you" ? mine.map((f) => f.name).join(" & ") : speaker?.name ?? "";

  // the line types itself out; a tap shows the rest at once, the next tap moves on
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const id = window.setInterval(() => setShown((n) => (n >= text.length ? n : n + 1)), 22);
    return () => window.clearInterval(id);
  }, [text]);
  const typing = shown < text.length;
  const advance = () => {
    if (typing) setShown(text.length);
    else if (last) onDone();
    else setAt((n) => n + 1);
  };
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // who the camera leans toward: the player's side on the left, the enemies on the right
  const focusRef = useRef<"left" | "right" | "mid">("mid");
  focusRef.current = line.who === "you" ? "left" : line.who === "narrator" ? "mid" : "right";

  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    arenaSound.unlock();
    // an ending goes back to where its book began (Book 2's harbour, Book 3's snowfields), with only the player's pair left standing
    const backdrop = scene.kind === "ending" ? storyBackdrop(BOOKS[bookOf(scene.ch)].first, 0) : storyBackdrop(scene.ch, stage);
    const g = scene.kind === "intro"
      ? newGame([boss], true, [1])
      : scene.kind === "ending"
      ? newGame(mine, true, mine.map(() => 0))
      : (() => {
          const { defs, teams } = stageLineup(pair, scene.ch, CHAPTERS[scene.ch].stages[stage]);
          return newGame(defs, true, teams);
        })();
    if (scene.kind !== "outro" && scene.kind !== "ending" && (scene.kind === "intro" || stage === LAIR)) arenaSound.play([{ k: "intro", power: boss.id }]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cam = { x: W / 2, z: 1 };
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) step(g, dt);
      const side = focusRef.current;
      const group = g.fighters.filter((f) => (side === "left" ? f.team === 0 : side === "right" ? f.team !== 0 : true));
      const tx = side === "mid" || !group.length ? W / 2 : group.reduce((s, f) => s + f.x, 0) / group.length;
      const tz = side === "mid" ? (scene.kind === "intro" ? 1.35 : 1.05) : 1.45;
      const ease = reduce ? 1 : Math.min(1, dt * 4);
      cam.x += (tx - cam.x) * ease;
      cam.z += (tz - cam.z) * ease;
      const x = Math.max(W / (2 * cam.z), Math.min(W - W / (2 * cam.z), cam.x));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.setTransform(cam.z, 0, 0, cam.z, W / 2 - x * cam.z, H * 0.92 - GROUND * cam.z);
      drawScene(ctx, g, backdrop);
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
    };
    // the scene is fixed for the life of this overlay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={aria} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-4" data-story-scene>
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-4 border-border bg-black motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <div className="relative">
          <canvas ref={ref} width={W} height={H} aria-hidden="true" className="block h-auto w-full" onClick={advance} />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 bg-gradient-to-b from-black/85 to-transparent px-6 pt-4 pb-10 text-center sm:pt-6">
            {scene.kind === "stage" ? (
              <>
                <Text id="story.stageNumber" vars={{ n: scene.stage + 1 }} className="text-xs font-extrabold uppercase tracking-[0.15em] text-white/80" />
                <Text id={stageNameKey(scene.ch, scene.stage)} as="h2" className="font-display text-xl text-white text-balance sm:text-3xl" />
              </>
            ) : scene.kind === "ending" ? (
              <Text id={bookOf(scene.ch) === 2 ? "story.ending3.title" : "story.ending.title"} as="h2" className="font-display text-xl text-white text-balance sm:text-3xl" />
            ) : (
              <Text id={CHAPTER_TITLES[scene.ch]} as="h2" className="font-display text-xl text-white text-balance sm:text-3xl" />
            )}
          </div>
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
            <Button size="sm" variant="secondary" onClick={onDone}><Text id="story.scene.skip" /></Button>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t-4 border-border bg-card px-4 py-4 sm:gap-4 sm:px-6" aria-live="polite">
          {speaker && (
            <div className="w-16 shrink-0 overflow-hidden rounded-xl border-2 border-border bg-background-secondary sm:w-24" key={speaker.name}>
              <FighterPortrait def={speaker} locked={false} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {speaker ? (
              <p className="flex items-center gap-2 font-display text-lg text-foreground">
                <span className="size-3 shrink-0 rounded-full border-2 border-foreground" style={{ background: speaker.minion?.mark ?? speaker.glow }} aria-hidden />
                {speakerName}
              </p>
            ) : null}
            <p className="min-h-[3em] max-w-prose text-base text-foreground-secondary">
              {text.slice(0, shown)}
              <span className="invisible">{text.slice(shown)}</span>
            </p>
          </div>
          <Button className="shrink-0 self-end" onClick={advance}>
            <Text id={!last || typing ? "story.scene.next" : scene.kind === "stage" ? "story.scene.fight" : "story.scene.continue"} />
          </Button>
        </div>
      </div>
    </div>
  );
}
