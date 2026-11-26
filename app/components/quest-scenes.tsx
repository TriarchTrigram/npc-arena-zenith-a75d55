// Canvas pieces for the Quests page: a live portrait of a fighter breathing in its own stance,
// and the unlock cutscene that plays its real entrance when a quest is claimed.
import { useEffect, useRef, useState } from "react";
import { Text } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { W, H, GROUND, buildBackdrop, drawScene, newDemo, newGame, step } from "~/lib/arena-engine";
import { arenaSound } from "~/lib/arena-sound";
import type { FighterDef } from "~/lib/fighters";

/** A transparent stand-in for the arena backdrop, so a portrait sits on its card. */
function blankBackdrop() {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 2;
  return c;
}

/** One fighter in its own idle stance, zoomed in. `locked` shows it as a dark silhouette with a glowing edge. */
export function FighterPortrait({ def, locked, className }: { def: FighterDef; locked: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const g = newGame([def], true);
    const back = blankBackdrop();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) step(g, dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // frame the fighter: zoom on where it stands
      const z = 1.3;
      ctx.setTransform(z, 0, 0, z, canvas.width / 2 - W / 2 * z, canvas.height * 0.9 - GROUND * z);
      drawScene(ctx, g, back);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [def]);
  return (
    <canvas
      ref={ref}
      width={360}
      height={300}
      aria-hidden="true"
      className={cn("block h-auto w-full", className)}
      style={locked ? { filter: `brightness(0) drop-shadow(0 0 6px ${def.glow})` } : undefined}
    />
  );
}

/** Full-screen unlock: the fighter's own entrance plays in the arena, then its name and the roster line come in. */
export function UnlockCutscene({ def, onClose, eyebrow = "quests.cutscene.eyebrow", joined = "quests.cutscene.joined" }: { def: FighterDef; onClose: () => void; eyebrow?: StringKey; joined?: StringKey }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    arenaSound.unlock();
    const backdrop = buildBackdrop();
    let g = newDemo([def]);
    let idle = false;
    let raf = 0, last = performance.now(), roared = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(g, dt);
      if (!roared && g.t > 0.4) {
        roared = true;
        arenaSound.play([{ k: "rage", power: def.id }, { k: "intro", power: def.id }]);
      }
      if (!idle && !g.intro) {
        // entrance done: hold it in its own stance
        idle = true;
        g = newGame([def], true);
        setLanded(true);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const z = idle ? 1.6 : 1.35;
      ctx.setTransform(z, 0, 0, z, W / 2 - (W / 2) * z, H * 0.9 - GROUND * z);
      drawScene(ctx, g, backdrop);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key);
    };
  }, [def, onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="unlock-name" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" data-unlock-cutscene>
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border-4 border-border bg-black">
        <canvas ref={ref} width={W} height={H} aria-hidden="true" className="block h-auto w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-6 pt-6 pb-16 text-center">
          <Text id={eyebrow} className="text-xs font-extrabold uppercase tracking-[0.15em] text-white/80 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300" />
          {landed && (
            <h2 id="unlock-name" className="font-display text-5xl tracking-[-0.02em] text-white motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in motion-safe:duration-300" style={{ textShadow: `0 0 18px ${def.glow}, 0 3px 0 #000` }}>
              {def.name}
            </h2>
          )}
          {landed && <p className="text-lg text-white/90 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">{def.power}</p>}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-black/85 to-transparent px-6 pt-12 pb-6">
          {landed && <Text id={joined} vars={{ name: def.name }} as="p" className="w-full text-center text-base text-white motion-safe:animate-in motion-safe:fade-in" />}
          <Button onClick={onClose} variant={landed ? "default" : "secondary"}>
            <Text id={landed ? "quests.cutscene.close" : "quests.cutscene.skip"} />
          </Button>
        </div>
      </div>
    </div>
  );
}
