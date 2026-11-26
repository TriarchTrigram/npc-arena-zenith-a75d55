import { useEffect, useRef, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import { PiBookOpenTextBold, PiCrownSimpleBold, PiMapTrifoldBold, PiShieldChevronBold, PiSwordBold, PiTreeStructureBold, PiTrophyBold, PiUsersThreeBold } from "react-icons/pi";
import { Text } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { cn } from "~/lib/utils";
import { DEF_BY_ID, FIGHTERS, type FighterDef } from "~/lib/fighters";
import { BOSSES } from "~/lib/bosses";
import { W, H, newDemo, newGame, step, drawScene, buildBackdrop, type Game } from "~/lib/arena-engine";

/** The arena's modes, plus Free World, which opens its own screen. */
export type TitleMode = "story" | "duel" | "ffa" | "teams" | "tournament" | "teamTournament" | "juggernaut" | "free";
type Mode = TitleMode;

const MODE_ORDER: Mode[] = ["story", "duel", "ffa", "teams", "tournament", "teamTournament", "juggernaut", "free"];
const MODE_NAME_KEYS: Record<Mode, StringKey> = {
  story: "arena.mode.story",
  duel: "arena.mode.duel",
  ffa: "arena.mode.ffa",
  teams: "arena.mode.teams",
  tournament: "arena.mode.tournament",
  teamTournament: "arena.mode.teamTournament",
  juggernaut: "arena.mode.juggernaut",
  free: "free.modeName",
};
const MODE_DESC_KEYS: Record<Mode, StringKey> = {
  story: "title.modes.story",
  duel: "title.modes.duel",
  ffa: "title.modes.ffa",
  teams: "title.modes.teams",
  tournament: "title.modes.tournament",
  teamTournament: "title.modes.teamTournament",
  juggernaut: "title.modes.juggernaut",
  free: "title.modes.free",
};
const MODE_ICONS: Record<Mode, IconType> = {
  story: PiBookOpenTextBold,
  duel: PiSwordBold,
  ffa: PiShieldChevronBold,
  teams: PiUsersThreeBold,
  tournament: PiTreeStructureBold,
  teamTournament: PiTrophyBold,
  juggernaut: PiCrownSimpleBold,
  free: PiMapTrifoldBold,
};
/** Each mode card's accent, taken from a fighter whose power suits it. */
const MODE_TINT: Record<Mode, FighterDef["id"]> = {
  story: "psy",
  duel: "pyro",
  ffa: "electro",
  teams: "hydro",
  tournament: "lux",
  teamTournament: "terra",
  juggernaut: "umbra",
  free: "flora",
};

/** Who fights behind the title next: Pyro against Hydro first, then random match-ups, now and then a Story boss. */
function nextPair(round: number): FighterDef[] {
  if (round === 0) return [DEF_BY_ID.pyro, DEF_BY_ID.hydro];
  const a = FIGHTERS[Math.floor(Math.random() * FIGHTERS.length)];
  if (round % 3 === 2) {
    const bosses = Object.values(BOSSES);
    return [a, bosses[Math.floor(Math.random() * bosses.length)]];
  }
  let b = a;
  while (b === a) b = FIGHTERS[Math.floor(Math.random() * FIGHTERS.length)];
  return [a, b];
}

/** A real, silent fight running behind the title: entrances, combat and the K.O., then the next match-up. */
function AttractFight({ onPair }: { onPair: (pair: FighterDef[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pairRef = useRef(onPair);
  pairRef.current = onPair;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const backdrop = buildBackdrop();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let round = 0;
    const start = (): Game => {
      const pair = nextPair(round++);
      pairRef.current(pair);
      return still ? newGame(pair, true) : newDemo(pair);
    };
    let g = start();
    if (still) {
      drawScene(ctx, g, backdrop);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let doneAt = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        step(g, dt);
        g.sfx.length = 0;
        if (g.over) {
          doneAt += dt;
          if (doneAt > 1.2) { g = start(); doneAt = 0; }
        }
        drawScene(ctx, g, backdrop);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={W} height={H} aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-bottom" />;
}

/** Classic yin-yang swirl, recoloured to the two elements instead of black and white. */
function ElementYinYang({ redColor, blueColor, className }: { redColor: string; blueColor: string; className?: string }) {
  return (
    <svg viewBox="-52 -52 104 104" className={className} role="img" aria-label="Pyro and Hydro's powers in balance">
      <circle r="50" fill={blueColor} />
      <path d="M0,-50 A50,50 0 0 1 0,50 A25,25 0 0 1 0,0 A25,25 0 0 0 0,-50 Z" fill={redColor} />
      <circle cx="0" cy="-25" r="8" fill={blueColor} />
      <circle cx="0" cy="25" r="8" fill={redColor} />
      <circle r="50" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  );
}

export function TitleScreen({ onPick, music }: { onPick: (mode: Mode) => void; music?: ReactNode }) {
  const pyro = DEF_BY_ID.pyro;
  const hydro = DEF_BY_ID.hydro;
  const [pair, setPair] = useState<FighterDef[]>([pyro, hydro]);
  return (
    <div className="relative overflow-hidden rounded-2xl border-4 border-border bg-[hsl(250_32%_10%)] text-white" data-title-screen>
      {/* the live fight, dimmed toward the bottom so the menu reads */}
      <div className="relative flex min-h-[30rem] w-full flex-col justify-end sm:aspect-[16/8] sm:min-h-0">
        <AttractFight onPair={setPair} />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[hsl(250_32%_10%/0.1)] from-40% via-[hsl(250_32%_10%/0.45)] via-75% to-[hsl(250_32%_10%)]" />
        {music && <div className="absolute right-3 top-3 z-10 rounded-full bg-card/90 px-2 py-1 text-foreground shadow-sm">{music}</div>}
        <div className="relative flex flex-col items-center gap-3 px-6 pb-6 pt-16 text-center sm:pb-10">
          <ElementYinYang redColor={pyro.color} blueColor={hydro.color} className="h-14 w-14 drop-shadow-lg motion-safe:animate-[spin_18s_linear_infinite] sm:h-20 sm:w-20" />
          <Text id="title.eyebrow" as="p" className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80" />
          <h1
            className="text-balance bg-clip-text font-display text-5xl leading-[1.1] tracking-[-0.03em] text-transparent drop-shadow-[0_4px_0_hsl(250_32%_8%)] sm:text-7xl"
            style={{ backgroundImage: `linear-gradient(90deg, ${pyro.glow}, ${pyro.color} 35%, ${hydro.color} 65%, ${hydro.glow})` }}
          >
            <Text id="common.appName" />
          </h1>
          <Text id="title.tagline" as="p" className="max-w-prose text-base text-white/85" />
        </div>
        <p className="absolute left-3 top-16 z-10 flex sm:top-3 items-center gap-2 rounded-full bg-[hsl(250_32%_8%/0.7)] px-3 py-1.5 text-sm text-white/90">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(0_85%_60%)] motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(0_85%_60%)]" />
          </span>
          <Text id="title.nowFighting" as="span" className="font-semibold uppercase tracking-[0.1em]" />
          <span style={{ color: pair[0]?.glow }}>{pair[0]?.name}</span>
          <Text id="title.versus" as="span" className="text-white/60" />
          <span style={{ color: pair[1]?.glow }}>{pair[1]?.name}</span>
        </p>
      </div>

      <div className="relative flex flex-col items-center gap-6 px-4 pb-8 pt-2 sm:px-8 sm:pb-10">
        <Text id="title.cta" as="p" className="text-sm font-semibold uppercase tracking-[0.12em] text-white/70" />
        <div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODE_ORDER.map((m) => {
            const Icon = MODE_ICONS[m];
            const tint = DEF_BY_ID[MODE_TINT[m]];
            return (
              <button
                key={m}
                type="button"
                onClick={() => onPick(m)}
                style={{ ["--tint" as string]: tint.color, ["--tint-glow" as string]: tint.glow }}
                className={cn(
                  "group relative flex items-start gap-3 overflow-hidden rounded-xl border-2 border-white/10 bg-white/[0.06] px-4 py-3.5 text-left",
                  "transition-[background-color,border-color,transform] duration-150 hover:border-[var(--tint)] hover:bg-white/[0.11] active:translate-y-px active:bg-white/[0.14]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tint-glow)]",
                )}
              >
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--tint)]" />
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--tint)] text-white shadow-[0_0_18px_var(--tint)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <Text id={MODE_NAME_KEYS[m]} as="span" className="font-display text-lg text-white" />
                  <Text id={MODE_DESC_KEYS[m]} as="span" className="text-sm text-white/70" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
