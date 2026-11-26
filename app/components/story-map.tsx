// The map you see on entering a Story chapter: its land in the chapter's colours, the road winding
// through all ten stages to the boss's lair, and every stage you can tap to pick it.
import type { IconType } from "react-icons";
import {
  PiAnchorFill, PiBellFill, PiBoneFill, PiBuildingsFill, PiCactusFill, PiCastleTurretFill, PiCheckBold, PiClockFill, PiCloudLightningFill,
  PiEyeFill, PiFireFill, PiGhostFill, PiHourglassFill, PiLighthouseFill, PiLightningFill, PiLockSimpleFill, PiMoonStarsFill,
  PiMountainsFill, PiPlanetFill, PiShootingStarFill, PiSkullFill, PiSnowflakeFill, PiSpiralFill, PiStarFill, PiSunFill,
  PiSunHorizonFill, PiTreeFill, PiWavesFill, PiBookOpenFill, PiBugFill, PiButterflyFill, PiHouseFill, PiMaskHappyFill, PiMoonFill,
  PiPlantFill, PiScrollFill, PiTreeEvergreenFill, PiCompassFill, PiTargetFill, PiCloudFill, PiSparkleFill, PiMagnetFill, PiEyeClosedFill,
} from "react-icons/pi";
import { Text, useString } from "~stencil/ui/strings";
import { cn } from "~/lib/utils";
import { CHAPTERS } from "~/lib/story";
import { stageNameKey } from "~/components/story-scene";

/** Where the ten stages sit on the map, in percent of its width and height. Every other chapter runs the other way. */
const ROAD: [number, number][] = [[8, 80], [22, 64], [16, 38], [31, 22], [45, 40], [55, 70], [69, 58], [65, 30], [79, 17], [91, 44]];
/** Book 2's chapters have nine stages, so their road is one stop shorter. */
const ROAD9: [number, number][] = [[8, 80], [22, 60], [18, 32], [35, 22], [48, 46], [60, 72], [73, 54], [77, 22], [91, 44]];
/** Book 3's chapters have eight stages. */
const ROAD8: [number, number][] = [[8, 78], [22, 56], [22, 26], [41, 24], [52, 56], [67, 72], [79, 36], [92, 50]];
const SPOTS: [number, number, number][] = [[5, 18, 2.6], [39, 84, 2.2], [44, 11, 2], [86, 82, 2.8], [57, 14, 2.2], [73, 86, 2.4], [29, 50, 2], [96, 70, 2]];

type Theme = { top: string; bottom: string; blob: string; deco: string; road: string; icons: IconType[] };
const THEMES: Theme[] = [
  { top: "hsl(256 34% 30%)", bottom: "hsl(30 40% 62%)", blob: "hsl(250 30% 50% / 0.35)", deco: "hsl(186 90% 82% / 0.6)", road: "hsl(186 100% 70%)", icons: [PiBuildingsFill, PiLightningFill, PiEyeFill] },
  { top: "hsl(204 50% 26%)", bottom: "hsl(196 40% 50%)", blob: "hsl(186 60% 70% / 0.22)", deco: "hsl(186 90% 88% / 0.6)", road: "hsl(176 90% 62%)", icons: [PiWavesFill, PiLighthouseFill, PiAnchorFill, PiCloudLightningFill] },
  { top: "hsl(10 50% 18%)", bottom: "hsl(28 60% 46%)", blob: "hsl(28 100% 60% / 0.22)", deco: "hsl(36 100% 72% / 0.6)", road: "hsl(34 100% 58%)", icons: [PiFireFill, PiCactusFill, PiBoneFill, PiMountainsFill] },
  { top: "hsl(214 40% 36%)", bottom: "hsl(200 36% 72%)", blob: "hsl(0 0% 100% / 0.25)", deco: "hsl(0 0% 100% / 0.7)", road: "hsl(44 90% 64%)", icons: [PiSnowflakeFill, PiClockFill, PiMountainsFill, PiHourglassFill] },
  { top: "hsl(256 44% 12%)", bottom: "hsl(300 40% 32%)", blob: "hsl(318 100% 70% / 0.18)", deco: "hsl(318 100% 84% / 0.55)", road: "hsl(318 100% 72%)", icons: [PiSpiralFill, PiPlanetFill, PiStarFill] },
  { top: "hsl(190 24% 10%)", bottom: "hsl(160 16% 28%)", blob: "hsl(152 80% 60% / 0.14)", deco: "hsl(152 92% 72% / 0.5)", road: "hsl(152 92% 60%)", icons: [PiCastleTurretFill, PiGhostFill, PiSkullFill, PiTreeFill] },
  { top: "hsl(20 40% 8%)", bottom: "hsl(30 70% 40%)", blob: "hsl(40 100% 60% / 0.18)", deco: "hsl(44 100% 74% / 0.55)", road: "hsl(40 100% 62%)", icons: [PiSunHorizonFill, PiSunFill, PiFireFill] },
  { top: "hsl(240 60% 6%)", bottom: "hsl(266 50% 22%)", blob: "hsl(272 100% 80% / 0.14)", deco: "hsl(272 100% 88% / 0.55)", road: "hsl(272 100% 80%)", icons: [PiPlanetFill, PiShootingStarFill, PiStarFill, PiMoonStarsFill] },
  // Book 2. Lights Under the Sea: a drowned harbour at night, lure lights glowing under the water
  { top: "hsl(204 56% 8%)", bottom: "hsl(184 42% 24%)", blob: "hsl(66 100% 60% / 0.12)", deco: "hsl(66 100% 74% / 0.55)", road: "hsl(66 100% 62%)", icons: [PiWavesFill, PiEyeFill, PiAnchorFill, PiBellFill] },
  // Book 2. The Singing Rot: a drowned forest overgrown with glowing fungus
  { top: "hsl(300 26% 10%)", bottom: "hsl(316 20% 24%)", blob: "hsl(170 100% 60% / 0.12)", deco: "hsl(170 100% 72% / 0.5)", road: "hsl(170 100% 62%)", icons: [PiTreeEvergreenFill, PiPlantFill, PiBugFill, PiTreeFill] },
  // Book 2. The City That Forgets: a foggy old town, its edges fading to blank paper
  { top: "hsl(270 18% 16%)", bottom: "hsl(290 14% 40%)", blob: "hsl(40 30% 92% / 0.14)", deco: "hsl(300 100% 86% / 0.5)", road: "hsl(300 100% 80%)", icons: [PiHouseFill, PiBuildingsFill, PiMaskHappyFill, PiScrollFill, PiBookOpenFill] },
  // Book 2. The Moth Moon: a mountain observatory under a huge low moon
  { top: "hsl(232 50% 7%)", bottom: "hsl(220 34% 26%)", blob: "hsl(208 100% 84% / 0.12)", deco: "hsl(208 100% 88% / 0.55)", road: "hsl(208 100% 80%)", icons: [PiMoonFill, PiButterflyFill, PiMountainsFill, PiStarFill] },
  // Book 2. The Sleeping Valley: violet dusk over windmills, gold dream light in the air
  { top: "hsl(256 40% 14%)", bottom: "hsl(270 30% 34%)", blob: "hsl(46 100% 70% / 0.12)", deco: "hsl(46 100% 80% / 0.55)", road: "hsl(46 100% 72%)", icons: [PiMoonStarsFill, PiHouseFill, PiSpiralFill, PiStarFill] },
  // Book 2. The Silent Bells: bell towers on red sea cliffs
  { top: "hsl(350 34% 10%)", bottom: "hsl(4 36% 28%)", blob: "hsl(354 100% 66% / 0.12)", deco: "hsl(354 100% 80% / 0.5)", road: "hsl(354 100% 70%)", icons: [PiBellFill, PiCastleTurretFill, PiBuildingsFill, PiWavesFill] },
  // Book 2. The Elder Dark: broken ground floating up into a starless sky
  { top: "hsl(262 60% 4%)", bottom: "hsl(264 40% 16%)", blob: "hsl(150 100% 56% / 0.1)", deco: "hsl(268 100% 84% / 0.55)", road: "hsl(268 100% 78%)", icons: [PiEyeFill, PiPlanetFill, PiShootingStarFill, PiSpiralFill] },
  // Book 3. The Falling Star: snowfields at night under a comet that grows every stage
  { top: "hsl(214 54% 9%)", bottom: "hsl(204 30% 38%)", blob: "hsl(190 100% 80% / 0.14)", deco: "hsl(190 100% 88% / 0.6)", road: "hsl(190 100% 76%)", icons: [PiSnowflakeFill, PiShootingStarFill, PiMountainsFill, PiFireFill] },
  // Book 3. The Hunter in the Stars: a plateau of standing stones under a sky drawn with constellations
  { top: "hsl(232 64% 6%)", bottom: "hsl(240 34% 22%)", blob: "hsl(44 100% 70% / 0.12)", deco: "hsl(44 100% 80% / 0.55)", road: "hsl(44 100% 72%)", icons: [PiStarFill, PiCompassFill, PiTargetFill, PiMoonStarsFill] },
  // Book 3. Where Stars Are Born: white salt flats under a rose and green nebula full of new stars
  { top: "hsl(296 50% 10%)", bottom: "hsl(320 30% 40%)", blob: "hsl(326 100% 70% / 0.14)", deco: "hsl(172 100% 80% / 0.55)", road: "hsl(326 100% 78%)", icons: [PiCloudFill, PiSparkleFill, PiStarFill, PiShootingStarFill] },
  // Book 3. The Spinning Heart: a desert swept into glass by a pulsar's beams
  { top: "hsl(250 44% 8%)", bottom: "hsl(30 40% 34%)", blob: "hsl(32 100% 64% / 0.14)", deco: "hsl(36 100% 80% / 0.55)", road: "hsl(32 100% 70%)", icons: [PiLighthouseFill, PiClockFill, PiMagnetFill, PiSunFill] },
  // Book 3. The Eye of the Sky: the summit of Zenith above a sea of cloud, under the great eye of the oldest star
  { top: "hsl(230 60% 6%)", bottom: "hsl(220 30% 44%)", blob: "hsl(46 100% 70% / 0.14)", deco: "hsl(210 100% 90% / 0.6)", road: "hsl(46 100% 76%)", icons: [PiEyeFill, PiCloudFill, PiEyeClosedFill, PiSunHorizonFill] },
];

/** A smooth road through the points, in the SVG's 1000 by 520 space. */
function roadPath(pts: [number, number][]) {
  const p = pts.map(([x, y]) => [x * 10, y * 5.2] as const);
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    d += ` Q ${p[i][0]} ${p[i][1]} ${mx} ${my}`;
  }
  if (p.length > 1) d += ` L ${p[p.length - 1][0]} ${p[p.length - 1][1]}`;
  return d;
}

export function StoryMap({ chapter, done, stage, onStage, locked }: { chapter: number; done: number; stage: number; onStage: (i: number) => void; locked: boolean }) {
  const aria = useString("story.map.aria");
  const theme = THEMES[chapter] ?? THEMES[0];
  const flip = chapter % 2 === 1;
  const stages = CHAPTERS[chapter].stages;
  const road = (stages.length === 8 ? ROAD8 : stages.length === 9 ? ROAD9 : ROAD).map(([x, y]) => [flip ? 100 - x : x, y] as [number, number]);
  const spots = SPOTS.map(([x, y, s]) => [flip ? 100 - x : x, y, s] as const);
  const gid = `map-sky-${chapter}`;

  return (
    <div className="-mx-1 overflow-x-auto px-1 pt-1 pb-3" data-story-map>
      <div className="relative min-w-[44rem] overflow-hidden rounded-xl border-4 border-border" style={{ aspectRatio: "1000 / 520" }}>
        <svg viewBox="0 0 1000 520" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={theme.top} />
              <stop offset="1" stopColor={theme.bottom} />
            </linearGradient>
          </defs>
          <rect width="1000" height="520" fill={`url(#${gid})`} />
          {[[180, 120, 220, 90], [620, 420, 260, 110], [820, 160, 200, 80], [340, 380, 180, 70], [500, 230, 140, 60]].map(([cx, cy, rx, ry], i) => (
            <ellipse key={i} cx={flip ? 1000 - cx : cx} cy={cy} rx={rx} ry={ry} fill={theme.blob} />
          ))}
          <path d={roadPath(road)} fill="none" stroke="hsl(250 32% 14% / 0.55)" strokeWidth="18" strokeLinecap="round" />
          <path d={roadPath(road)} fill="none" stroke="hsl(0 0% 100% / 0.6)" strokeWidth="5" strokeDasharray="2 14" strokeLinecap="round" />
          {done > 0 && <path d={roadPath(road.slice(0, Math.min(done, road.length - 1) + 1))} fill="none" stroke={theme.road} strokeWidth="8" strokeLinecap="round" />}
        </svg>
        {spots.map(([x, y, s], i) => {
          const Icon = theme.icons[i % theme.icons.length];
          return <Icon key={i} aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%`, width: `${s}rem`, height: `${s}rem`, color: theme.deco }} />;
        })}
        <ol aria-label={aria} className="absolute inset-0">
          {stages.map((s, i) => {
            const [x, y] = road[i];
            const open = i <= done;
            const beaten = i < done;
            const on = i === stage;
            const next = i === done && !s.boss;
            const Icon = beaten ? PiCheckBold : !open ? PiLockSimpleFill : s.boss ? PiSkullFill : null;
            const align = x > 86 ? "right-0" : x < 14 ? "left-0" : "left-1/2 -translate-x-1/2";
            return (
              <li key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
                <button
                  type="button"
                  disabled={!open || locked}
                  onClick={() => onStage(i)}
                  aria-pressed={on}
                  className={cn(
                    "absolute top-0 left-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] font-display tabular-nums transition-[box-shadow,background-color] duration-150 hover:bg-surface-hover active:bg-surface-active disabled:cursor-not-allowed",
                    s.boss ? "size-14 text-xl" : "size-11 text-lg",
                    beaten ? "border-foreground bg-card text-success" : open ? "border-foreground bg-card text-foreground" : "border-border bg-background-secondary text-muted-foreground",
                    s.boss && open && !beaten && "border-error text-error",
                    on && "ring-4 ring-foreground ring-offset-2 ring-offset-background",
                    next && !on && "motion-safe:animate-pulse",
                  )}
                >
                  {Icon ? <Icon className={s.boss ? "size-7" : "size-5"} aria-hidden /> : i + 1}
                  <Text id="story.stageNumber" vars={{ n: i + 1 }} className="sr-only" />
                </button>
                <Text
                  id={stageNameKey(chapter, i)}
                  className={cn(
                    "pointer-events-none absolute whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold",
                    s.boss ? "top-9" : "top-7",
                    align,
                    open ? "bg-card text-foreground" : "bg-card/80 text-muted-foreground",
                  )}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
