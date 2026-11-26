// Side-view stickman fight engine for the arena canvas. Runs entirely in the browser.
import { DEF_BY_ID, customElements, isNewGen, isQuester, juggernautOf, rosterIdOf, type Anim, type BossDesign, type FighterDef, type Move, type Power, type StatusEffect } from "./fighters";
import type { Sfx } from "./arena-sound";
import { drawMarks, drawFocus, drawBars, drawNameCards, drawCutIn, MARK_LIFE, CUTIN_LEN, type Mark, type CutIn, type Focus, type NameCard } from "./arena-cinema";
import { INTROS, BOSS_INTROS, fusionIntro, INTRO_LEN, INTRO_ARRIVED, type IntroBurst, type IntroPose, type IntroSpec } from "./spawn-intros";
import { LOOKS, setLookTint, drawFx, drawSpark, drawShotLook, drawBeamLook, drawEruptionLook, drawZoneLook, drawRushLook, drawAnnihilation, eruptionColors, type Fx, type PShape } from "./move-looks";
import { drawBossDesign, type BossAct } from "./boss-designs";
import { drawNovaLook, drawQuestDesign, type QuestAct } from "./quest-designs";
import { FORMS, formShout, formsOf, type Form, type FormKind } from "./forms";
import { BOSS_PHASES } from "./bosses";
import { preFightFor, type PreFight, type PrePose } from "./pre-fight";

export const W = 960;
export const H = 600;
export const GROUND = 538;
const GRAV = 1900;
const INK = "hsl(250 32% 14%)";

// ---------- small helpers ----------
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

function shade(hsl: string, dl: number, alpha = 1) {
  const m = hsl.match(/hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/);
  if (!m) return hsl;
  const l = clamp(Number(m[3]) + dl, 0, 100);
  return alpha < 1 ? `hsl(${m[1]} ${m[2]}% ${l}% / ${alpha})` : `hsl(${m[1]} ${m[2]}% ${l}%)`;
}

// ---------- poses ----------
// Angles in radians. Limbs: 0 = straight down, +PI/2 = forward, PI = straight up, negative = backward.
// Torso: 0 = upright, positive leans forward.
type Pose = { t: number; aF1: number; aF2: number; aB1: number; aB2: number; lF1: number; lF2: number; lB1: number; lB2: number };
const POSE_KEYS = ["t", "aF1", "aF2", "aB1", "aB2", "lF1", "lF2", "lB1", "lB2"] as const;

const STANCE: Pose = { t: 0.12, aF1: 0.75, aF2: 2.35, aB1: 0.35, aB2: 1.95, lF1: 0.4, lF2: 0.02, lB1: -0.32, lB2: -0.14 };
const AIR: Pose = { t: 0.2, aF1: 2.1, aF2: 2.6, aB1: -0.7, aB2: -0.2, lF1: 1.3, lF2: 0.15, lB1: 0.45, lB2: -0.65 };
const HURT: Pose = { t: -0.45, aF1: -0.35, aF2: 0.5, aB1: -0.9, aB2: -0.4, lF1: 0.35, lF2: 0.1, lB1: -0.25, lB2: -0.1 };
const DAZED: Pose = { t: 0.45, aF1: 0.15, aF2: 0.05, aB1: -0.1, aB2: -0.15, lF1: 0.3, lF2: -0.2, lB1: -0.2, lB2: -0.45 };
/** A crushing blow: bent far back, arms flung. The hurt pose blends toward it the harder the hit. */
const HURT_HEAVY: Pose = { t: -0.95, aF1: -1.0, aF2: -0.35, aB1: -1.45, aB2: -1.0, lF1: 0.7, lF2: 0.35, lB1: -0.55, lB2: -0.2 };
const KO: Pose = { t: -1.52, aF1: -1.35, aF2: -1.75, aB1: -1.75, aB2: -1.45, lF1: 1.55, lF2: 1.6, lB1: 1.4, lB2: 1.62 };
// forward dash: leaning in, arms streaming back
const DASH: Pose = { t: 0.62, aF1: -0.95, aF2: -0.6, aB1: -1.15, aB2: -0.85, lF1: 0.95, lF2: 0.3, lB1: -0.75, lB2: -0.95 };
// back dash: guard up, leaning away
const BACKDASH: Pose = { t: -0.28, aF1: 0.95, aF2: 2.0, aB1: 0.55, aB2: 1.7, lF1: 0.65, lF2: 0.2, lB1: -0.4, lB2: -0.2 };
// thrown back by a clash, arms crossed in guard
const CLASHED: Pose = { t: -0.38, aF1: 1.25, aF2: 2.65, aB1: 1.0, aB2: 2.45, lF1: 0.75, lF2: 0.0, lB1: -0.2, lB2: -0.55 };
// down on one knee, catching breath
/** Hovering on wings: legs trailing, guard up. */
const FLY: Pose = { t: 0.24, aF1: 0.75, aF2: 2.3, aB1: 0.4, aB2: 1.9, lF1: 0.2, lF2: -0.25, lB1: -0.2, lB2: -0.6 };
const KNEEL: Pose = { t: 0.38, aF1: 0.95, aF2: 0.3, aB1: 0.15, aB2: 0.05, lF1: 1.4, lF2: 0.02, lB1: 0.1, lB2: -1.5 };

// entrance poses (see spawn-intros.ts)
const RISE: Pose = { t: -0.12, aF1: 2.65, aF2: 2.95, aB1: 3.55, aB2: 3.3, lF1: 0.3, lF2: 0.05, lB1: -0.3, lB2: -0.1 };
const FLEX: Pose = { t: 0.18, aF1: 1.35, aF2: 2.75, aB1: 0.5, aB2: 2.3, lF1: 0.55, lF2: 0.05, lB1: -0.45, lB2: -0.2 };
const CROUCH: Pose = { t: 0.5, aF1: 0.9, aF2: 2.2, aB1: 0.3, aB2: 1.7, lF1: 1.2, lF2: -0.2, lB1: -0.3, lB2: -1.0 };
const LAND: Pose = { t: 0.6, aF1: 0.15, aF2: 0.0, aB1: -1.7, aB2: -1.4, lF1: 1.45, lF2: 0.1, lB1: 0.2, lB2: -1.45 };
const GUARD: Pose = { t: 0.1, aF1: 1.4, aF2: 3.3, aB1: 1.2, aB2: 3.0, lF1: 0.5, lF2: 0.1, lB1: -0.5, lB2: -0.15 };
const FLOAT: Pose = { t: 0.0, aF1: 0.9, aF2: 0.25, aB1: 0.6, aB2: 0.1, lF1: 1.55, lF2: -1.4, lB1: 1.35, lB2: -1.6 };
const INTRO_POSES: Record<IntroPose, Pose> = { stance: STANCE, air: AIR, crouch: CROUCH, rise: RISE, flex: FLEX, land: LAND, guard: GUARD, float: FLOAT };

// ---------- own stances ----------
// A boss and a hybrid each stand their own way instead of the roster's fighting stance, and breathe their own way at rest.
const BOSS_STANCE: Record<BossDesign, Pose> = {
  // Nullshade: tall and still, arms held low and open, palms out
  antimatter: { t: -0.06, aF1: 0.55, aF2: 1.05, aB1: -0.5, aB2: -0.95, lF1: 0.14, lF2: 0.0, lB1: -0.12, lB2: -0.04 },
  // Maelstrom: a wide, low lunge with the trident levelled
  maelstrom: { t: 0.3, aF1: 1.25, aF2: 1.6, aB1: -0.35, aB2: 0.45, lF1: 0.75, lF2: 0.1, lB1: -0.6, lB2: -0.5 },
  // Magmaw: hunched forward, heavy arms hanging, knees bent
  magmaw: { t: 0.45, aF1: 0.5, aF2: 0.3, aB1: 0.28, aB2: 0.1, lF1: 0.55, lF2: -0.15, lB1: -0.45, lB2: -0.35 },
  // Everwinter: upright and regal, one palm raised as if holding the hour
  everwinter: { t: -0.05, aF1: 1.3, aF2: 2.45, aB1: -0.12, aB2: 0.1, lF1: 0.16, lF2: 0.02, lB1: -0.12, lB2: -0.05 },
  // The Riftmaker: one hand forward, one hand high, framing the world it is about to rewrite
  riftmaker: { t: 0.02, aF1: 1.6, aF2: 2.2, aB1: 2.3, aB2: 2.85, lF1: 0.3, lF2: 0.0, lB1: -0.25, lB2: -0.1 },
  // The Hollow King: slouched over the scythe, both hands on the shaft
  hollow: { t: 0.28, aF1: 1.0, aF2: 1.45, aB1: 0.8, aB2: 1.35, lF1: 0.42, lF2: -0.05, lB1: -0.35, lB2: -0.2 },
  // The Black Sun: arms folded across the chest, chin up
  blacksun: { t: -0.08, aF1: 1.15, aF2: 2.7, aB1: 1.0, aB2: 2.6, lF1: 0.22, lF2: 0.0, lB1: -0.22, lB2: -0.05 },
  // The Axiom: floating upright, both arms spread wide and low, palms open, as if holding the sky up
  axiom: { t: -0.04, aF1: 0.95, aF2: 1.25, aB1: -0.95, aB2: -1.25, lF1: 0.12, lF2: -0.08, lB1: -0.1, lB2: -0.2 },
  // The Lanternmaw: stooped forward under its lure, one claw reaching out, the other hanging low
  lanternmaw: { t: 0.32, aF1: 1.35, aF2: 1.7, aB1: 0.35, aB2: 0.2, lF1: 0.4, lF2: -0.1, lB1: -0.3, lB2: -0.25 },
  // The Sporemother: swollen and slow, leaning back, both arms raised a little as if conducting its choir
  sporemother: { t: -0.12, aF1: 0.7, aF2: 1.6, aB1: -0.6, aB2: -1.4, lF1: 0.18, lF2: 0.05, lB1: -0.2, lB2: -0.05 },
  // The Mnemovore: very tall and very still, long arms hanging straight down, head tilted as if listening
  mnemovore: { t: 0.06, aF1: 0.2, aF2: 0.1, aB1: -0.15, aB2: -0.1, lF1: 0.1, lF2: 0.0, lB1: -0.1, lB2: 0.0 },
  // The Dustmoth: hunched forward, both clawed arms tucked up under the chin like a praying insect
  dustmoth: { t: 0.2, aF1: 1.9, aF2: 2.6, aB1: 1.6, aB2: 2.5, lF1: 0.3, lF2: 0.1, lB1: -0.25, lB2: -0.1 },
  // The Somnarch: heavy and drowsy, head sunk forward, arms hanging loose like someone asleep on their feet
  somnarch: { t: 0.24, aF1: 0.45, aF2: 0.3, aB1: 0.25, aB2: 0.2, lF1: 0.14, lF2: 0.04, lB1: -0.12, lB2: -0.04 },
  // The Hush: bolt upright, one finger raised to where its lips would be, the other arm held still behind it
  hush: { t: -0.04, aF1: 2.3, aF2: 2.9, aB1: -0.3, aB2: -0.5, lF1: 0.08, lF2: 0.0, lB1: -0.08, lB2: 0.0 },
  // The Elder Dark: huge and looming, leaning over you with both arms spread wide as if to swallow the world
  elderdark: { t: 0.18, aF1: 1.2, aF2: 0.7, aB1: -1.3, aB2: -0.8, lF1: 0.32, lF2: -0.06, lB1: -0.32, lB2: -0.12 },
  // Perihelion: leaning hard into its fall, arms swept back like a tail behind it
  perihelion: { t: 0.34, aF1: -0.5, aF2: -0.3, aB1: -1.1, aB2: -0.9, lF1: 0.45, lF2: -0.2, lB1: -0.45, lB2: -0.35 },
  // Asterion: a hunter's crouch, spear arm drawn back high, the other reaching out to aim
  asterion: { t: 0.14, aF1: 1.45, aF2: 1.55, aB1: -2.2, aB2: -2.6, lF1: 0.5, lF2: -0.3, lB1: -0.4, lB2: -0.3 },
  // Carina: floating upright, arms opened wide and low like someone holding a cloud
  carina: { t: -0.06, aF1: 0.9, aF2: 0.5, aB1: -0.9, aB2: -0.5, lF1: 0.12, lF2: 0.06, lB1: -0.12, lB2: 0.06 },
  // Vela: square and steady, both fists held out at the poles of its body, keeping time
  vela: { t: 0.04, aF1: 1.6, aF2: 0.2, aB1: -1.6, aB2: -0.2, lF1: 0.36, lF2: -0.1, lB1: -0.36, lB2: -0.1 },
  // Aeon: tall and unhurried, one open hand raised to the sky, the other held low and calm, as if it has all the time there is
  aeon: { t: -0.04, aF1: 2.5, aF2: 2.9, aB1: -0.35, aB2: -0.15, lF1: 0.2, lF2: -0.05, lB1: -0.2, lB2: -0.05 },
};
/** How each boss breathes at rest: speed, torso sway, arm sway (front, back) and knee bob. */
const BOSS_IDLE: Record<BossDesign, { hz: number; t: number; aF: number; aB: number; l: number }> = {
  antimatter: { hz: 1.6, t: 0.02, aF: 0.12, aB: -0.12, l: 0 },
  maelstrom: { hz: 3.2, t: 0.05, aF: 0.08, aB: 0.1, l: 0.06 },
  magmaw: { hz: 2.0, t: 0.07, aF: 0.1, aB: 0.1, l: 0.05 },
  everwinter: { hz: 1.2, t: 0.015, aF: 0.05, aB: 0.02, l: 0 },
  riftmaker: { hz: 4.5, t: 0.03, aF: 0.14, aB: -0.12, l: 0.02 },
  hollow: { hz: 1.8, t: 0.05, aF: 0.05, aB: 0.05, l: 0.03 },
  blacksun: { hz: 1.4, t: 0.02, aF: 0.03, aB: 0.03, l: 0 },
  axiom: { hz: 1.1, t: 0.02, aF: 0.1, aB: -0.1, l: 0.03 },
  lanternmaw: { hz: 1.3, t: 0.06, aF: 0.12, aB: 0.06, l: 0.03 },
  sporemother: { hz: 1.0, t: 0.05, aF: 0.14, aB: 0.12, l: 0.02 },
  mnemovore: { hz: 0.6, t: 0.02, aF: 0.03, aB: 0.03, l: 0.01 },
  dustmoth: { hz: 2.6, t: 0.03, aF: 0.05, aB: 0.05, l: 0.04 },
  somnarch: { hz: 0.5, t: 0.05, aF: 0.08, aB: 0.08, l: 0.02 },
  hush: { hz: 0.4, t: 0.01, aF: 0.01, aB: 0.01, l: 0 },
  elderdark: { hz: 0.8, t: 0.05, aF: 0.14, aB: 0.14, l: 0.03 },
  perihelion: { hz: 1.8, t: 0.04, aF: 0.08, aB: 0.12, l: 0.03 },
  asterion: { hz: 1.2, t: 0.03, aF: 0.04, aB: 0.08, l: 0.04 },
  carina: { hz: 0.45, t: 0.05, aF: 0.16, aB: 0.16, l: 0.02 },
  vela: { hz: 2.4, t: 0.01, aF: 0.03, aB: 0.03, l: 0.01 },
  aeon: { hz: 0.35, t: 0.03, aF: 0.06, aB: 0.1, l: 0.02 },
};
/** Hybrids pick one of these by their pair, so the same pair always stands the same way: two powers held ready at once. */
const HYBRID_STANCES: Pose[] = [
  // both palms charging, one high, one low
  { t: 0.16, aF1: 1.45, aF2: 1.95, aB1: 0.9, aB2: 1.35, lF1: 0.55, lF2: 0.05, lB1: -0.45, lB2: -0.25 },
  // wide and low, arms spread to either side
  { t: 0.22, aF1: 1.2, aF2: 1.9, aB1: -1.05, aB2: -0.6, lF1: 0.7, lF2: 0.05, lB1: -0.62, lB2: -0.35 },
  // coiled, fists stacked at the hip, ready to throw
  { t: 0.28, aF1: 0.95, aF2: 2.55, aB1: 0.2, aB2: 2.3, lF1: 0.62, lF2: -0.1, lB1: -0.5, lB2: -0.4 },
  // upright, one hand raised over the head, the other forward
  { t: 0.04, aF1: 1.55, aF2: 1.6, aB1: 2.55, aB2: 2.9, lF1: 0.35, lF2: 0.02, lB1: -0.3, lB2: -0.12 },
];
/** Quest fighters stand their own way too. */
const QUEST_STANCE: Partial<Record<Power, Pose>> = {
  // Parallax: side-on, one palm pushed out flat as if pressing on a pane of space, the other hand cocked back
  spatio: { t: 0.06, aF1: 1.5, aF2: 1.62, aB1: -0.6, aB2: 0.9, lF1: 0.45, lF2: 0.05, lB1: -0.4, lB2: -0.18 },
  // Hexizon: low monk's stance, the bone staff held across the body in both hands
  hexizon: { t: 0.22, aF1: 0.95, aF2: 1.9, aB1: 0.55, aB2: 1.45, lF1: 0.68, lF2: -0.05, lB1: -0.58, lB2: -0.42 },
  // Halflife: square and heavy, fists low and wide like a wrestler, glowing core pushed out
  gamma: { t: 0.1, aF1: 0.7, aF2: 1.3, aB1: -0.85, aB2: -1.4, lF1: 0.55, lF2: 0.08, lB1: -0.55, lB2: -0.2 },
  // Redline: a sprinter on the blocks, leaning hard forward, one arm thrown back
  velo: { t: 0.42, aF1: 1.05, aF2: 2.2, aB1: -1.5, aB2: -1.2, lF1: 0.85, lF2: -0.2, lB1: -0.7, lB2: -0.55 },
  // Liminal: upright and open, both hands raised either side as if holding two doors ajar
  portal: { t: 0.02, aF1: 1.9, aF2: 2.6, aB1: -1.9, aB2: -2.6, lF1: 0.32, lF2: 0.02, lB1: -0.32, lB2: -0.04 },
  // Overtone: front fist out on the beat, back hand pressed to his headphones
  sono: { t: 0.1, aF1: 1.25, aF2: 1.95, aB1: 1.95, aB2: 3.55, lF1: 0.5, lF2: 0.05, lB1: -0.42, lB2: -0.18 },
  // Vellum: light as paper, a fan held out in front, the other arm swept back, back toe pointed
  paper: { t: 0.04, aF1: 1.7, aF2: 2.2, aB1: -1.3, aB2: -0.6, lF1: 0.38, lF2: 0.0, lB1: -0.2, lB2: -0.35 },
  // Facet: planted like a wall, both forearms raised in a high guard with the crystal fists in front of the face
  crys: { t: 0.12, aF1: 1.05, aF2: 2.75, aB1: 0.75, aB2: 2.6, lF1: 0.6, lF2: 0.1, lB1: -0.55, lB2: -0.22 },
  // Sirocco: low and side-on, front hand trailing a stream of sand, back hand raised to the sky
  sand: { t: 0.26, aF1: 1.35, aF2: 1.1, aB1: 2.4, aB2: 2.9, lF1: 0.75, lF2: -0.05, lB1: -0.62, lB2: -0.45 },
  // Past Riftmaker: light on his feet and leaning in, front hand open as if holding a rift, back hand loose behind him
  pastrift: { t: 0.2, aF1: 1.5, aF2: 1.75, aB1: -0.6, aB2: -0.2, lF1: 0.55, lF2: -0.1, lB1: -0.5, lB2: -0.3 },
  // Volta: young and cocky, bouncing forward on the front foot, both fists up and crackling
  plasma: { t: 0.18, aF1: 1.2, aF2: 2.5, aB1: 0.9, aB2: 2.3, lF1: 0.55, lF2: -0.02, lB1: -0.5, lB2: -0.35 },
  // Briar: low and rooted, front palm open to the floor as if feeling the roots, back hand up with a seed ready
  flora: { t: 0.2, aF1: 1.0, aF2: 0.7, aB1: 2.2, aB2: 3.1, lF1: 0.7, lF2: 0.0, lB1: -0.58, lB2: -0.3 },
  // Turbo: leaning into a sprint start, weight on the front foot, front hand out loose, back arm swung behind
  chaos: { t: 0.3, aF1: 1.3, aF2: 1.9, aB1: -0.9, aB2: -0.3, lF1: 0.65, lF2: -0.1, lB1: -0.55, lB2: -0.4 },
};
/** The fighter you made stands by its main power's role: how that kind of fighter would square up. */
const CUSTOM_STANCE: Record<FighterDef["role"], Pose> = {
  // attacker: leaning in, fists up and ready to throw
  attacker: { t: 0.24, aF1: 1.15, aF2: 2.45, aB1: 0.75, aB2: 2.25, lF1: 0.6, lF2: -0.05, lB1: -0.52, lB2: -0.38 },
  // control: upright, front palm held out flat, back hand drawn in to the chest
  control: { t: 0.06, aF1: 1.55, aF2: 1.65, aB1: 0.55, aB2: 2.2, lF1: 0.38, lF2: 0.02, lB1: -0.32, lB2: -0.12 },
  // tank: wide and planted, arms low and heavy at the sides
  tank: { t: 0.14, aF1: 0.6, aF2: 1.1, aB1: -0.6, aB2: -1.05, lF1: 0.62, lF2: 0.08, lB1: -0.6, lB2: -0.2 },
  // support: light on the feet, both palms open in front, one a little higher
  support: { t: 0.04, aF1: 1.3, aF2: 1.75, aB1: 1.0, aB2: 1.5, lF1: 0.32, lF2: 0.0, lB1: -0.28, lB2: -0.1 },
  // trickster: side-on and loose, front hand dangling, back arm flung behind
  trickster: { t: 0.18, aF1: 0.95, aF2: 0.5, aB1: -1.2, aB2: -0.7, lF1: 0.5, lF2: -0.12, lB1: -0.45, lB2: -0.45 },
};
/** How fast each kind of made fighter breathes at rest. */
const CUSTOM_IDLE_HZ: Record<FighterDef["role"], number> = { attacker: 6, control: 2.4, tank: 2, support: 3, trickster: 7.5 };
/** Small, regular or tall. */
const CUSTOM_SCALE = { small: 0.92, regular: 1, tall: 1.1 } as const;
/** A Story minion's size: the grunts and casters a little smaller than a fighter, the brutes and lieutenants bigger. */
const MINION_SCALE = { grunt: 0.88, caster: 0.94, brute: 1.14, elite: 1.08 } as const;
const pairHash = (a: Power, b: Power) => [a, b].sort().join("+").split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** The rest stance this fighter stands in. */
function stanceOf(def: FighterDef): Pose {
  if (def.boss) return BOSS_STANCE[def.boss];
  if (def.custom) return CUSTOM_STANCE[def.role];
  const qs = QUEST_STANCE[def.id];
  if (qs && !def.parents) return qs;
  if (def.parents) return HYBRID_STANCES[pairHash(def.parents[0], def.parents[1]) % HYBRID_STANCES.length];
  return STANCE;
}
/** The rest stance with this fighter's own breathing on top. */
function idlePose(f: Fighter, gt: number): Pose {
  const st = stanceOf(f.def);
  if (f.def.boss) {
    const m = BOSS_IDLE[f.def.boss];
    const b = Math.sin(gt * m.hz + f.key);
    return { ...st, t: st.t + b * m.t, aF2: st.aF2 + b * m.aF, aB2: st.aB2 + b * m.aB, lF1: st.lF1 + b * m.l, lB1: st.lB1 - b * m.l };
  }
  if (f.def.custom) {
    const hz = CUSTOM_IDLE_HZ[f.def.role];
    const b = Math.sin(gt * hz + f.key), c = Math.cos(gt * hz + f.key);
    return { ...st, t: st.t + b * 0.03, aF2: st.aF2 + b * 0.08, aB2: st.aB2 + (customElements(f.def.custom).length > 1 ? c : b) * 0.08, lF1: st.lF1 + b * 0.03, lB1: st.lB1 - b * 0.03 };
  }
  if (f.def.parents) {
    // two powers pulsing in turn: one hand, then the other
    const b = Math.sin(gt * 5 + f.key), c = Math.cos(gt * 5 + f.key);
    return { ...st, t: st.t + b * 0.025, aF2: st.aF2 + b * 0.12, aB2: st.aB2 + c * 0.12 };
  }
  if (QUEST_STANCE[f.def.id]) {
    // Parallax drifts slowly, Hexizon bobs on the balls of his feet, Halflife heaves, Redline can't stand still, Liminal sways,
    // Overtone nods to a beat, Vellum drifts like a sheet on the air, Facet barely moves, Sirocco sways like heat haze,
    // Volta can't keep still, Briar sways like a plant in the wind, Turbo taps his foot waiting for the fight to start
    const hz = ({ hexizon: 5.5, gamma: 2.6, velo: 9, portal: 1.4, sono: 7.5, paper: 1.2, crys: 1, sand: 3.4, pastrift: 4.6, plasma: 8, flora: 1.6, chaos: 7 } as Partial<Record<Power, number>>)[f.def.id] ?? 1.8;
    const b = Math.sin(gt * hz + f.key);
    return { ...st, t: st.t + b * 0.03, aF2: st.aF2 + b * 0.06, aB2: st.aB2 + b * 0.06, lF1: st.lF1 + b * 0.04, lB1: st.lB1 - b * 0.04 };
  }
  const b = Math.sin(gt * 4 + f.key);
  return { ...STANCE, t: STANCE.t + b * 0.03, aF2: STANCE.aF2 + b * 0.08, aB2: STANCE.aB2 - b * 0.06 };
}
/** A pose an entrance names; "stance" means the fighter's own. */
const introPose = (def: FighterDef, p: IntroPose): Pose => (p === "stance" ? stanceOf(def) : INTRO_POSES[p]);

// ---------- own entrances ----------
const fusionCache = new Map<string, IntroSpec>();
/** The entrance this fighter plays: a boss its own, a hybrid the fusion of both parents, anyone else its element's. */
function introOf(def: FighterDef): IntroSpec {
  if (def.boss) return BOSS_INTROS[def.boss];
  // the fighter you made: with two powers or more, the first two arrive fused like a hybrid's
  const two = def.parents ?? (def.custom && customElements(def.custom).length > 1 ? [customElements(def.custom)[0], customElements(def.custom)[1]] as const : null);
  if (two) {
    const [a, b] = two;
    const key = a + "+" + b;
    let sp = fusionCache.get(key);
    if (!sp) {
      const da = DEF_BY_ID[a], db = DEF_BY_ID[b];
      sp = fusionIntro(a, b, [da.color, da.glow], [db.color, db.glow]);
      fusionCache.set(key, sp);
    }
    return sp;
  }
  return INTROS[def.id];
}
const introLen = (f: Fighter) => introOf(f.def).len ?? INTRO_LEN;

const DASH_TIME = 0.17;
/** Juggernaut cruising height (feet above the floor) and swooping height for close fighting. */
const HOVER_HIGH = 120;
const HOVER_LOW = 26;
/** One fighter against five: the juggernaut hits harder and recharges faster. */
const JUGG_DMG = 3;
const JUGG_CD = 0.4;
const DASH_DIST = 150;
const DASH_CD = 0.85;
const IFRAMES = 0.13;
const KNEEL_TIME = 1.0;
/** Personality: how readily each kind of fighter presses in, counters and dashes. */
const AGGRO: Record<FighterDef["role"], number> = { attacker: 0.85, trickster: 0.75, tank: 0.6, support: 0.4, control: 0.35 };

const ANIMS: Record<Anim, { wind: Partial<Pose>; strike: Partial<Pose> }> = {
  jab: {
    wind: { t: 0, aF1: 0.3, aF2: 1.9, aB1: 0.5, aB2: 2.1 },
    strike: { t: 0.32, aF1: 1.57, aF2: 1.57, aB1: 0.2, aB2: 1.7, lF1: 0.62, lB1: -0.5 },
  },
  kick: {
    wind: { t: -0.05, lF1: 1.45, lF2: 0.25, aF1: 0.9, aB1: -0.4 },
    strike: { t: -0.38, lF1: 1.68, lF2: 1.62, lB1: -0.08, lB2: -0.05, aF1: 0.95, aF2: 1.9, aB1: -0.7, aB2: -0.3 },
  },
  cast: {
    wind: { t: -0.12, aF1: -0.5, aF2: 0.4, aB1: -0.65, aB2: 0.3 },
    strike: { t: 0.25, aF1: 1.6, aF2: 1.6, aB1: 1.45, aB2: 1.55, lF1: 0.58, lB1: -0.48 },
  },
  thrust: {
    wind: { t: -0.05, aF1: -0.2, aF2: 1.2 },
    strike: { t: 0.3, aF1: 1.62, aF2: 1.75, aB1: -0.4, aB2: 0.6, lF1: 0.62, lB1: -0.5 },
  },
  raise: {
    wind: { t: 0.15, aF1: 1.9, aF2: 2.4, aB1: 1.8, aB2: 2.4 },
    strike: { t: -0.12, aF1: 2.85, aF2: 3.05, aB1: 2.7, aB2: 2.95, lF1: 0.3, lB1: -0.3 },
  },
  slam: {
    wind: { t: -0.2, aF1: 2.9, aF2: 3.0, aB1: 2.75, aB2: 3.0, lF1: 0.25, lB1: -0.2 },
    strike: { t: 0.75, aF1: 0.9, aF2: 0.45, aB1: 0.8, aB2: 0.35, lF1: 1.0, lF2: -0.35, lB1: -0.55, lB2: -1.25 },
  },
  uppercut: {
    wind: { t: 0.35, aF1: 0.2, aF2: 0.8, lF1: 0.85, lF2: -0.25, lB1: -0.45, lB2: -1.05 },
    strike: { t: -0.12, aF1: 2.9, aF2: 3.0, lF1: 0.2, lB1: -0.2 },
  },
  spin: {
    wind: { t: 0.1, aF1: 1.3, aF2: 1.4, aB1: -1.3, aB2: -1.4 },
    strike: { t: 0, aF1: 1.57, aF2: 1.6, aB1: -1.57, aB2: -1.6, lF1: 0.3, lF2: 0.2, lB1: -0.3, lB2: -0.2 },
  },
  lunge: {
    wind: { t: -0.1, aF1: -0.45, aF2: 0.6 },
    strike: { t: 0.65, aF1: 1.72, aF2: 1.65, aB1: -0.75, aB2: -0.5, lF1: 1.05, lF2: 0.3, lB1: -0.85, lB2: -0.6 },
  },
};

// ---------- element looks ----------
const FX: Record<Power, { shape: PShape; add: boolean; grav: number }> = {
  pyro: { shape: "dot", add: true, grav: -260 },
  cryo: { shape: "shard", add: false, grav: 320 },
  electro: { shape: "spark", add: true, grav: 0 },
  terra: { shape: "chunk", add: false, grav: 1000 },
  aero: { shape: "spark", add: false, grav: -40 },
  hydro: { shape: "dot", add: false, grav: 800 },
  umbra: { shape: "smoke", add: false, grav: -50 },
  lux: { shape: "spark", add: true, grav: 0 },
  gravi: { shape: "ring", add: true, grav: 0 },
  tele: { shape: "ring", add: true, grav: 0 },
  vita: { shape: "plus", add: false, grav: -140 },
  toxi: { shape: "ring", add: false, grav: -110 },
  chrono: { shape: "ring", add: true, grav: 0 },
  magneto: { shape: "shard", add: false, grav: 700 },
  psy: { shape: "ring", add: true, grav: -20 },
  shift: { shape: "dot", add: true, grav: 0 },
  nova: { shape: "star", add: true, grav: -30 },
  spatio: { shape: "shard", add: true, grav: 0 },
  hexizon: { shape: "pixel", add: true, grav: -60 },
  gamma: { shape: "spark", add: true, grav: -120 },
  velo: { shape: "spark", add: true, grav: 0 },
  portal: { shape: "ring", add: true, grav: 0 },
  sono: { shape: "ring", add: true, grav: 0 },
  paper: { shape: "leaf", add: false, grav: 120 },
  crys: { shape: "shard", add: true, grav: 300 },
  sand: { shape: "dust", add: false, grav: 420 },
  pastrift: { shape: "star", add: true, grav: 0 },
  plasma: { shape: "spark", add: true, grav: -60 },
  flora: { shape: "leaf", add: false, grav: 140 },
  chaos: { shape: "star", add: true, grav: -40 },
};

// ---------- Forms ----------
/** Pushed low, every original fighter breaks into its form once per fight (app/lib/forms.ts): Rage, Awakened, Mastery or Mystic.
 * A cutscene pauses the match, then they fight on recoloured, stronger and with 2 new moves. Pyro can go on into Perfected Flame. */
type Rage = Form;

const CUT_TIME = 2.7;
const RAGE_POSE: Pose = { t: -0.22, aF1: 0.5, aF2: 0.2, aB1: -0.5, aB2: -0.2, lF1: 0.5, lF2: 0.22, lB1: -0.5, lB2: -0.22 };
const ROAR_POSE: Pose = { ...RAGE_POSE, t: -0.3, ...ANIMS.raise.strike };
const rageOf = (f?: Fighter | null) => f?.form ?? null;
/** Forms that can't be stunned or frozen: Nightmare Mode, Surge Mode and Hyper Form. */
const UNSTOPPABLE: FormKind[] = ["nightmare", "surge", "hyper"];
/** Nightmare Mode, Surge Mode and Hyper Form can't be stunned or frozen: those effects never take hold while they are on. */
const shrugsOff = (f: Fighter, st?: StatusEffect) => (st === "stun" || st === "freeze") && UNSTOPPABLE.includes(rageOf(f)?.kind as FormKind);
/** Nightmare Mode and Surge Mode share their dark look: smoke, a jagged halo and the world going black in the cutscene. */
const isDarkForm = (k?: FormKind) => k === "nightmare" || k === "surge";
/** The form a fighter breaks into now, if any. Forms only belong to the pure fighters, not to a hybrid or a boss carrying their power.
 * A Story boss has its own phases instead (BOSS_PHASES in bosses.ts), taken one at a time as its health runs down. */
function nextForm(f: Fighter): Form | null {
  if (f.def.parents || f.def.custom || f.def.minion) return null;
  const share = f.hp / f.maxHp;
  if (f.def.boss) {
    const phases = BOSS_PHASES[f.def.boss];
    if (!phases) return null;
    const next = phases[f.form ? phases.indexOf(f.form) + 1 : 0];
    return next && share <= next.at ? next : null;
  }
  if (!f.form) { const fm = FORMS[f.def.id]; return fm && share <= fm.at ? fm : null; }
  // a fighter with a second step (Pyro's Perfected Flame, Turbo's Hyper Form) takes it once pushed further
  const chain = formsOf(f.def.id);
  const i = chain.indexOf(f.form);
  const nx = i >= 0 ? chain[i + 1] : undefined;
  return nx && share <= nx.at ? nx : null;
}
/** The particle a form's power gathers in as, when it is not the element's own. */
const FORM_SPARK: Partial<Record<FormKind, PShape>> = { perfected: "ember", awakened: "star", mystic: "glyph", super: "star", hyper: "star" };
/** Super and Hyper Form: arms crossed while the emeralds circle, then flung wide as they crash in. */
const EMERALD_POSES: [Pose, Pose] = [
  { ...STANCE, t: 0.32, aF1: 1.35, aF2: 2.95, aB1: 1.2, aB2: 2.85, lF1: 0.5, lF2: -0.12, lB1: -0.5, lB2: -0.32 },
  { ...STANCE, t: -0.32, aF1: 1.95, aF2: 2.1, aB1: -1.95, aB2: -2.1, lF1: 0.32, lF2: 0.05, lB1: -0.32, lB2: -0.1 },
];
/** The two poses a form's cutscene moves through: power gathering, then breaking loose. */
const CUT_POSES: Record<FormKind, [Pose, Pose]> = {
  rage: [RAGE_POSE, ROAR_POSE],
  perfected: [RAGE_POSE, { ...ROAR_POSE, ...ANIMS.raise.strike, t: -0.36 }],
  awakened: [{ ...RAGE_POSE, t: 0.35, aF1: 0.2, aB1: -0.2 }, { ...STANCE, t: -0.25, aF1: 2.4, aF2: 2.6, aB1: -2.4, aB2: -2.6, lF1: 0.3, lB1: -0.3 }],
  mastery: [{ ...STANCE, t: 0.05, aF1: 1.1, aF2: 2.2, aB1: 1.0, aB2: 2.3, lF1: 0.35, lF2: 0.1, lB1: -0.35, lB2: -0.1 }, { ...STANCE, t: 0.1, ...ANIMS.thrust.strike, lF1: 0.6, lF2: 0.1, lB1: -0.6, lB2: -0.3 }],
  nightmare: [{ ...RAGE_POSE, t: 0.7, aF1: 0.3, aF2: 0.1, aB1: 0.2, aB2: 0.05, lF1: 0.9, lF2: -0.3, lB1: -0.4, lB2: -0.9 }, { ...ROAR_POSE, t: -0.45, aF1: 2.2, aF2: 1.9, aB1: -2.2, aB2: -1.9 }],
  surge: [{ ...RAGE_POSE, t: 0.7, aF1: 0.3, aF2: 0.1, aB1: 0.2, aB2: 0.05, lF1: 0.9, lF2: -0.3, lB1: -0.4, lB2: -0.9 }, { ...ROAR_POSE, t: -0.45, aF1: 2.2, aF2: 1.9, aB1: -2.2, aB2: -1.9 }],
  super: EMERALD_POSES,
  hyper: [EMERALD_POSES[0], { ...EMERALD_POSES[1], t: -0.42, aF1: 2.3, aB1: -2.3 }],
  phase: [{ ...RAGE_POSE, t: 0.5, aF1: 0.6, aF2: 0.3, aB1: -0.6, aB2: -0.3, lF1: 0.7, lF2: -0.2, lB1: -0.6, lB2: -0.5 }, { ...ROAR_POSE, t: -0.4, aF1: 2.5, aF2: 2.2, aB1: -2.5, aB2: -2.2, lF1: 0.55, lB1: -0.55 }],
  mystic: [{ ...STANCE, t: 0, aF1: 0.9, aF2: 1.7, aB1: -0.9, aB2: -1.7, lF1: 0.9, lF2: -1.2, lB1: -0.9, lB2: 1.2 }, { ...STANCE, t: -0.15, aF1: 1.9, aF2: 2.2, aB1: -1.9, aB2: -2.2, lF1: 0.15, lF2: 0.1, lB1: -0.15, lB2: -0.1 }],
};
/** Whose rage colours new particles and effects take while a fighter acts. */
let paint: Rage | null = null;

// ---------- game state ----------
type Action = { id: number; move: Move; power: Power; t: number; fired: boolean; target: number; hits: number[]; label: string; landed: boolean };
type Ghost = { x: number; y: number; pose: Pose; face: number; life: number };

export type Fighter = {
  key: number;
  def: FighterDef;
  x: number; y: number; vx: number; vy: number;
  facing: 1 | -1;
  onGround: boolean;
  scale: number;
  hp: number; maxHp: number; hpTrail: number;
  alive: boolean; kills: number; koT: number;
  cds: Record<string, number>;
  act: Action | null;
  think: number; prefRange: number; prefT: number;
  walk: number; walkDir: number;
  hurtT: number; flash: number;
  status: Record<StatusEffect, number>;
  lastHitBy: Power | null; lastAttacker: number | null;
  pose: Pose;
  // dashing
  dashT: number; dashDir: number; dashCd: number; iframeT: number; airDashed: boolean;
  ghosts: Ghost[]; ghostT: number;
  // clashes
  clashAir: boolean; kneelT: number;
  // brain
  aggro: number; targetKey: number | null; reacted: number; comboT: number;
  // team fights: -1 means everyone is an opponent
  team: number;
  // juggernaut: always flying on wings, holding at hoverY
  jugg: boolean; hoverY: number;
  // Form (Rage, Awakened, Mastery, Mystic, Perfected Flame): on for the rest of the fight once it fires; rageT times Aero's gusts
  form: Form | null; rageT: number;
  /** Seconds into the entrance phase when this fighter's own entrance starts. */
  spawnAt: number;
  /** Cinematic hit reactions: body roll (radians) and its speed while tumbling, how hard the last hit landed, and the shudder while the hit freezes. */
  spin: number; spinV: number; recoil: number; jolt: number;
  /** The striking hand or foot's recent path, drawn as a smear. */
  trail: { x: number; y: number; life: number }[];
};

type Projectile = {
  x: number; y: number; vx: number; vy: number; r: number; grav: number; rot: number;
  owner: number; power: Power; move: Move; life: number; hits: number[]; shape: NonNullable<Move["shape"]>;
};
type Beam = { owner: number; power: Power; x: number; y: number; ang: number; len: number; width: number; life: number; max: number; jag: boolean; clash?: boolean; look?: string };
type Eruption = { owner: number; power: Power; move: Move; x: number; t: number; fired: boolean };
type Zone = { owner: number; power: Power; move: Move; x: number; life: number; max: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; shape: PShape; grav: number; add: boolean; rot: number };
type Pop = { x: number; y: number; text: string; color: string; life: number; max: number; size: number };
type Wave = { x: number; y: number; r: number; life: number; max: number; a: string; b: string };
/** A big hit's impact frame: a spiked starburst and speed streaks in the hit's direction. */
type Impact = { x: number; y: number; dir: number; size: number; life: number; max: number; a: string; b: string; seed: number; heavy: boolean };

export type FeedItem = { id: number; killer: string | null; victim: string };

// ---------- realms (The Riftmaker's Reality Warp) ----------
export type Realm = "moon" | "desert" | "galaxy" | "universe" | "nebula";
const REALMS: Realm[] = ["moon", "desert", "galaxy", "universe", "nebula"];
const REALM_TIME = 11;
const REALM_FADE = 0.45;
/** How strongly things fall in each realm. */
const REALM_GRAV: Record<Realm, number> = { moon: 0.36, desert: 1, galaxy: 0.6, universe: 0.2, nebula: 0.75 };
const REALM_NAME: Record<Realm, string> = { moon: "THE MOON", desert: "THE DESERT", galaxy: "THE GALAXY", universe: "THE UNIVERSE", nebula: "THE NEBULA" };
/** In the Galaxy, shooting stars fall on the warper's enemies. */
const STARFALL: Move = { id: "starfall", name: "Starfall", kind: "projectile", anim: "raise", range: 2000, cd: 0, dmg: 4, kb: 160, lift: -180, size: 9, shape: "shard", wind: 0, act: 0, rec: 0 };
/** Gravity now, set each frame from the realm the fight is in. */
let gravK = 1;
/** Matter and antimatter closing in on a spot before they cancel out. */
type Anni = { owner: number; power: Power; move: Move; x: number; y: number; t: number; done: boolean };
const ANNI_TIME = 0.6;
const ECLIPSE_TIME = 6;

export type Game = {
  t: number;
  fighters: Fighter[];
  projectiles: Projectile[];
  beams: Beam[];
  eruptions: Eruption[];
  zones: Zone[];
  particles: Particle[];
  pops: Pop[];
  waves: Wave[];
  /** Each move's own cast and impact effects. */
  fx: Fx[];
  feed: FeedItem[];
  /** Sounds queued this frame; the arena screen plays and clears them. */
  sfx: Sfx[];
  shake: number;
  hitstop: number;
  ending: number;
  over: boolean;
  winner: string | null;
  preview: boolean;
  duel: boolean;
  teamMode: boolean;
  /** The winner's roster id: a power id, or a hybrid's pair key. */
  winnerId: string | null;
  winnerTeam: number | null;
  /** A rage cutscene in progress: the match holds still until it ends. */
  cut: { key: number; t: number; max: number } | null;
  /** Entrances before READY / FIGHT: the match holds until every fighter has arrived. */
  intro: { t: number; max: number } | null;
  /** A moment two fighters who know each other play after the entrances, before READY (see pre-fight.ts). */
  pre: PreRun | null;
  /** Where reality has been moved to, for how long, and who moved it. */
  realm: { id: Realm; t: number; left: number; by: number; heat: number } | null;
  /** A realm just ended: the old one fades out over the arena. */
  realmOut: { id: Realm; t: number } | null;
  annis: Anni[];
  /** Everwinter's Time Stop: the arena stays grey and still until this time. */
  stopUntil: number;
  /** The Black Sun's Total Eclipse: the sky stays dark until this time. */
  eclipseUntil: number;
  /** White flash over everything, in seconds left. */
  flash: number;
  /** The fight camera: where it looks and how far it is pushed in. */
  cam: { x: number; y: number; z: number };
  /** A quick push-in on a big hit. */
  punch: { x: number; y: number; t: number; max: number; z: number } | null;
  /** A directional jolt of the whole view that springs back. */
  kick: { x: number; y: number };
  /** Slow motion left, in real seconds (the final K.O.). */
  slow: number;
  impacts: Impact[];
  /** Scars each element leaves on the floor. */
  marks: Mark[];
  /** A super move's cut-in across the screen, if one is playing. */
  cutin: CutIn | null;
  /** Fight time of the last cut-in, so they stay special. */
  lastCutIn: number;
  /** Letterbox bars, 0 (gone) to 1 (fully in). */
  bars: number;
  /** The anime impact frame: the whole picture inverts for an instant, in real seconds left. */
  inv: number;
  focus: Focus[];
  /** A silent attract-mode fight behind the title: no lifebars or callouts. */
  demo: boolean;
};

let feedId = 0;

/** A pre-fight moment in progress: its fighters (by index, first of its pair first), where they stood, and when it starts. */
type PreRun = { spec: PreFight; keys: [number, number]; homes: [number, number]; start: number; base: number };

/** Team colours, in team order. Names live in the screen's copy. */
export const TEAM_COLORS = ["hsl(0 82% 60%)", "hsl(212 90% 62%)", "hsl(46 100% 58%)", "hsl(138 62% 50%)", "hsl(276 70% 64%)", "hsl(24 95% 56%)", "hsl(178 72% 42%)", "hsl(326 80% 64%)"] as const;

/** Opponents: everyone in free for all, only the other teams in a team fight. */
const foe = (a: Fighter | undefined, b: Fighter | undefined) => !!a && !!b && a !== b && (a.team < 0 || a.team !== b.team);

/** `teams` (same length as `ids`) puts fighters on sides; each side spawns together. `jugg` is the index of the juggernaut, if any. */
export function newGame(ids: (Power | FighterDef)[], preview = false, teams?: number[], jugg = -1): Game {
  const n = ids.length;
  const scale = n <= 2 ? 1.25 : n <= 4 ? 1.1 : n <= 8 ? 0.95 : 0.82;
  const teamMode = !!teams && teams.length === n;
  // slot order: grouped by team so teammates line up side by side
  const order = ids.map((_, i) => i);
  if (teamMode) order.sort((a, b) => teams![a] - teams![b] || a - b);
  const slotOf = new Map(order.map((idx, slot) => [idx, slot]));
  // entrances run left to right, overlapping; a juggernaut arrives last, on its own
  // a duel gives each fighter its own moment in the spotlight
  const gap = n <= 2 ? 0.95 : n <= 4 ? 0.6 : Math.min(0.16, 1.3 / (n - 1));
  const lastSlot = Math.max(0, n - 1);
  const fighters: Fighter[] = ids.map((id, i) => {
    const isJugg = i === jugg;
    const base = typeof id === "string" ? DEF_BY_ID[id] : id;
    const def = isJugg ? juggernautOf(base) : base;
    const slot = slotOf.get(i) ?? i;
    const x = n === 2 ? (slot === 0 ? 270 : W - 270) : 70 + ((W - 140) * (slot + 0.5)) / n;
    // a hybrid stands a little taller than a pure-blooded fighter; the young new-generation fighters a little shorter
    const sc = isJugg ? scale * 1.25 : def.custom ? scale * CUSTOM_SCALE[def.custom.build] : def.boss ? scale * 1.22 : def.minion ? scale * MINION_SCALE[def.minion.kind] : def.parents ? scale * 1.12 : isNewGen(def.id) ? scale * 0.94 : isQuester(def.id) ? scale * 1.1 : scale;
    const hoverY = GROUND - HOVER_HIGH * sc;
    return {
      key: i, def,
      x, y: isJugg ? hoverY : GROUND, vx: 0, vy: 0,
      facing: x < W / 2 ? 1 : -1,
      onGround: !isJugg,
      scale: sc,
      hp: def.hp, maxHp: def.hp, hpTrail: def.hp,
      alive: true, kills: 0, koT: 0,
      cds: Object.fromEntries(def.moves.map((m) => [m.id, rand(0.2, m.cd * 0.6)])),
      act: null,
      think: rand(0.2, 0.6), prefRange: 160, prefT: 0,
      walk: rand(0, 6), walkDir: 0,
      hurtT: 0, flash: 0,
      status: { burn: 0, slow: 0, stun: 0, poison: 0, blind: 0, freeze: 0 },
      lastHitBy: null, lastAttacker: null,
      pose: { ...(preview ? stanceOf(def) : introPose(def, introOf(def).body(0, sc).pose)) },
      dashT: 0, dashDir: 0, dashCd: rand(0, 0.6), iframeT: 0, airDashed: false,
      ghosts: [], ghostT: 0,
      clashAir: false, kneelT: 0,
      aggro: clamp(AGGRO[def.role] + rand(-0.08, 0.08), 0.2, 0.95), targetKey: null, reacted: -1, comboT: 0,
      team: teamMode ? teams![i] : -1,
      jugg: isJugg, hoverY,
      form: null, rageT: 0,
      spawnAt: isJugg ? lastSlot * gap + 0.35 : slot * gap,
      spin: 0, spinV: 0, recoil: 0, jolt: 0, trail: [],
    };
  });
  const introEnd = Math.max(0, ...fighters.map((f) => f.spawnAt + introLen(f))) + 0.2;
  // two fighters who know each other share a moment before READY
  const pf = !preview && n === 2 && !teamMode && jugg < 0 ? preFightFor(fighters[0].def, fighters[1].def) : null;
  const keys: [number, number] = pf?.first === 1 ? [1, 0] : [0, 1];
  const pre: PreRun | null = pf ? { spec: pf.spec, keys, homes: [fighters[keys[0]].x, fighters[keys[1]].x], start: introEnd + 0.05, base: introEnd } : null;
  gravK = 1;
  return {
    t: 0, fighters, projectiles: [], beams: [], eruptions: [], zones: [], particles: [], pops: [], waves: [], fx: [], feed: [], sfx: [],
    shake: 0, hitstop: 0, ending: 0, over: false, winner: null, preview, duel: n === 2 && !teamMode,
    teamMode, winnerId: null, winnerTeam: null, cut: null,
    intro: preview || n === 0 ? null : { t: 0, max: pre ? pre.start + pre.spec.len + 0.3 : introEnd }, pre,
    realm: null, realmOut: null, annis: [], stopUntil: 0, eclipseUntil: 0, flash: 0,
    cam: { x: W / 2, y: H / 2, z: 1 }, punch: null, kick: { x: 0, y: 0 }, slow: 0, impacts: [], demo: false,
    marks: [], cutin: null, lastCutIn: -99, bars: 0, inv: 0, focus: [],
  };
}

/** A silent fight for the title screen: real entrances and AI, no HUD, no sound. */
export function newDemo(ids: (Power | FighterDef)[]): Game {
  const g = newGame(ids);
  g.demo = true;
  if (g.pre && g.intro) g.intro.max = g.pre.base;
  g.pre = null;
  return g;
}

// body points
const bodyH = (f: Fighter) => 100 * f.scale;
const center = (f: Fighter) => ({ x: f.x, y: f.y - 55 * f.scale });
const hand = (f: Fighter) => ({ x: f.x + f.facing * 34 * f.scale, y: f.y - 66 * f.scale });

function emit(g: Game, power: Power, x: number, y: number, n: number, spd: number, opts: Partial<Particle> = {}) {
  const def = DEF_BY_ID[power];
  const fx = FX[power];
  const rg = paint && paint.power === power ? paint : null;
  for (let i = 0; i < n && g.particles.length < 900; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(spd * 0.3, spd);
    const life = rand(0.3, 0.7);
    g.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life,
      size: rand(3, 7), color: rg ? rageColor(rg) : Math.random() < 0.5 ? def.color : def.glow,
      shape: fx.shape, grav: fx.grav, add: fx.add, rot: rand(0, 6), ...opts,
    });
  }
}

/** Particles in a move's own look, or the element's when the move has none. */
function emitMove(g: Game, m: Move, power: Power, x: number, y: number, n: number, spd: number, opts: Partial<Particle> = {}) {
  const lk = LOOKS[m.id];
  if (!lk) return emit(g, power, x, y, n, spd, opts);
  for (let i = 0; i < n && g.particles.length < 900; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(spd * 0.3, spd);
    const life = rand(0.3, 0.7);
    g.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life,
      size: rand(3, 7), color: paint ? rageColor(paint) : Math.random() < 0.5 ? lk.a : lk.b,
      shape: lk.p, grav: lk.grav, add: lk.add && !(paint?.dark), rot: rand(0, 6), ...opts,
    });
  }
}

/** One of a raging fighter's colours; Electro's mix in black. */
function rageColor(r: Rage) {
  const k = Math.random();
  if (r.kind === "perfected") return k < 0.45 ? r.a : k < 0.9 ? r.b : "hsl(0 0% 100%)";
  if (r.kind === "super") return k < 0.5 ? r.a : k < 0.85 ? r.b : "hsl(0 0% 100%)";
  // Hyper Form shimmers through every colour
  if (r.kind === "hyper") return k < 0.6 ? `hsl(${Math.floor(Math.random() * 360)} 100% 76%)` : "hsl(0 0% 100%)";
  return r.dark && k < 0.3 ? r.dark : k < 0.65 ? r.a : r.b;
}

/** A move's signature effect, at the hand when it fires or on whoever it hit. */
function moveFx(g: Game, id: string, hitFx: boolean, x: number, y: number, dir: number, size: number, life: number, reach = 0) {
  if (!LOOKS[id] || g.fx.length > 80) return;
  g.fx.push({ id, hit: hitFx, x, y, dir, size, life, max: life, seed: Math.random() * 100, reach, tint: paint ? { a: paint.a, b: paint.b } : undefined });
}

/** Fires a move's signature effect from where its look says. */
function castFx(g: Game, f: Fighter, m: Move) {
  const lk = LOOKS[m.id];
  if (!lk?.cast || lk.cast === "sky") return;
  const s = f.scale;
  const at = lk.cast === "hand" ? hand(f) : lk.cast === "body" ? center(f) : { x: f.x, y: f.y };
  const reach = m.kind === "burst" ? (m.radius ?? 120) * s : m.range * s;
  moveFx(g, m.id, false, at.x, at.y, f.facing, s, lk.castLife ?? 0.3, reach);
}

/** A scar on the floor in the element's own style; the oldest fade first when the floor gets crowded. */
function mark(g: Game, power: Power, x: number, w: number) {
  if (g.preview) return;
  const d = DEF_BY_ID[power];
  if (!d) return;
  g.marks.push({ x, w: clamp(w, 16, 170), power, a: d.color, b: d.glow, life: MARK_LIFE, max: MARK_LIFE, seed: Math.random() * 100 });
  if (g.marks.length > 26) g.marks.shift();
}

/** Queue a sound for the screen to play. A preview arena stays silent. */
function sfx(g: Game, e: Sfx) {
  if (!g.preview && g.sfx.length < 48) g.sfx.push(e);
}

function pop(g: Game, x: number, y: number, text: string, color: string, size = 18, life = 0.8) {
  g.pops.push({ x, y, text, color, life, max: life, size });
}

// ---------- cinematic camera ----------
/** Push the camera in on a spot for a moment. */
function punchIn(g: Game, x: number, y: number, z: number, max = 0.4) {
  if (g.preview) return;
  if (g.punch && g.punch.z > z && g.punch.t < g.punch.max * 0.5) return;
  g.punch = { x, y, t: 0, max, z };
}

/** Jolt the whole view in a direction; it springs back on its own. */
function kickCam(g: Game, dx: number, dy: number) {
  g.kick.x = clamp(g.kick.x + dx, -12, 12);
  g.kick.y = clamp(g.kick.y + dy, -8, 8);
}

/** Spiked impact frame and speed streaks where a hit lands. */
function impact(g: Game, x: number, y: number, dir: number, size: number, a: string, b: string, heavy: boolean) {
  const life = heavy ? 0.24 : 0.13;
  g.impacts.push({ x, y, dir, size, life, max: life, a, b, seed: Math.random() * 100, heavy });
  const n = heavy ? 16 : 7;
  for (let i = 0; i < n; i++) {
    const ang = (dir > 0 ? 0 : Math.PI) + rand(-0.7, 0.7);
    const sp = rand(420, 980) * (heavy ? 1.2 : 1);
    g.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80, life: 0.24, max: 0.24, size: rand(3, 6), color: i % 3 ? b : "white", shape: "spark", grav: 700, add: true, rot: 0 });
  }
}

/** The camera follows the fight: it pushes in when only a few fighters are left close together, and punches in on big hits. Runs on real time, even through hit freezes. */
function stepCam(g: Game, dt: number) {
  const spring = Math.pow(0.0015, dt);
  g.kick.x *= spring;
  g.kick.y *= spring;
  let tx = W / 2, ty = H / 2, tz = 1;
  const live = g.fighters.filter((f) => f.alive);
  if (!g.preview && !g.intro && live.length >= 1 && live.length <= 3) {
    let x0 = Infinity, x1 = -Infinity, top = Infinity;
    for (const f of live) {
      x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x);
      top = Math.min(top, f.y - bodyH(f) - 40 * f.scale);
    }
    tz = clamp(W / (x1 - x0 + 380), 1, 1.16);
    tx = (x0 + x1) / 2;
    // keep the floor near the bottom, but follow anyone launched high
    ty = Math.min(GROUND + 34 - H / (2 * tz), top + H / (2 * tz) - 20);
  }
  // during the entrances the camera goes to whoever is arriving, then pulls back for READY
  let follow = false;
  if (g.intro && !g.preview && g.fighters.length <= 4) {
    let star: Fighter | null = null;
    for (const f of g.fighters) {
      const u = introU(g, f);
      if (u >= 0 && u < 0.92 && (!star || f.spawnAt > star.spawnAt)) star = f;
    }
    const p = g.pre;
    if (p && g.intro.t >= p.start - 0.15) {
      const a = g.fighters[p.keys[0]], b = g.fighters[p.keys[1]];
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
      follow = true;
      tz = clamp(W / (x1 - x0 + 460), 1, 1.32);
      tx = (x0 + x1) / 2;
      ty = Math.min(GROUND + 34 - H / (2 * tz), Math.min(a.y - bodyH(a), b.y - bodyH(b)) - 70 + H / (2 * tz));
    } else if (star) {
      follow = true;
      tz = g.duel ? 1.3 : 1.2;
      tx = star.x;
      ty = star.y - 70 * star.scale;
    }
  }
  // the letterbox comes in for every cinematic beat and leaves for the fight
  const cine = (!!g.intro && !g.preview && !g.demo) || g.slow > 0 || !!g.cutin || !!g.cut;
  g.bars = clamp(g.bars + (cine ? dt * 3 : -dt * 2.2), 0, 1);
  if (g.cutin) {
    g.cutin.t += dt;
    if (g.cutin.t >= g.cutin.max) g.cutin = null;
  }
  g.inv = Math.max(0, g.inv - dt);
  for (const x of g.focus) x.t += dt;
  g.focus = g.focus.filter((x) => x.t < x.max);
  const pu = g.punch;
  if (pu) {
    pu.t += dt;
    const u = pu.t / pu.max;
    if (u >= 1) g.punch = null;
    else {
      const e = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
      const ee = e * e * (3 - 2 * e);
      tz += pu.z * ee;
      tx += (pu.x - tx) * 0.55 * ee;
      ty += (pu.y - ty) * 0.55 * ee;
    }
  }
  const a = 1 - Math.exp(-dt * (pu ? 16 : follow ? 4.5 : 3.2));
  g.cam.x += (tx - g.cam.x) * a;
  g.cam.y += (ty - g.cam.y) * a;
  g.cam.z += (tz - g.cam.z) * a;
}

// ---------- clashes and dashes ----------
let actId = 0;

/** Two powers met: blast ring, flash, and everyone nearby is shoved away. */
function shockwave(g: Game, x: number, y: number, pa: Power, pb: Power, r = 170) {
  const A = DEF_BY_ID[pa], B = DEF_BY_ID[pb];
  g.waves.push({ x, y, r, life: 0.6, max: 0.6, a: A.glow, b: B.glow });
  emit(g, pa, x, y, 22, 520);
  emit(g, pb, x, y, 22, 520);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.particles.push({ x, y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.22, max: 0.22, size: 6, color: "white", shape: "spark", grav: 0, add: true, rot: 0 });
  }
  for (const f of g.fighters) {
    if (!f.alive) continue;
    const c = center(f);
    const d = Math.hypot(c.x - x, (c.y - y) * 0.8);
    if (d > r) continue;
    const k = 1 - d / r;
    const dir = Math.sign(f.x - x) || (f.key % 2 ? 1 : -1);
    f.vx = dir * (260 + 520 * k);
    if (f.onGround) { f.vy = -180 - 220 * k; f.onGround = false; }
    f.hurtT = Math.max(f.hurtT, 0.18 + 0.2 * k);
    f.act = null;
    f.kneelT = 0;
  }
  pop(g, x, y - 46, "CLASH!", "hsl(46 100% 62%)", 30, 0.9);
  sfx(g, { k: "clash" });
  g.shake = Math.max(g.shake, 13);
  g.hitstop = Math.max(g.hitstop, 0.09);
}

/** Two close-range strikes met head on: both fly back and drop to one knee. */
function m1Clash(g: Game, a: Fighter, b: Fighter) {
  const ha = hand(a), hb = hand(b);
  const x = (ha.x + hb.x) / 2, y = (ha.y + hb.y) / 2;
  g.particles.push({ x, y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 46, color: "white", shape: "ring", grav: 0, add: true, rot: 1 });
  g.particles.push({ x, y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 30, color: "hsl(46 100% 70%)", shape: "ring", grav: 0, add: true, rot: 1 });
  for (let i = 0; i < 14; i++) {
    const ang = rand(-0.9, 0.9) + (i % 2 ? Math.PI : 0);
    const sp = rand(380, 760);
    g.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, life: 0.3, max: 0.3, size: 5, color: i % 2 ? a.def.glow : b.def.glow, shape: "spark", grav: 900, add: true, rot: 0 });
  }
  for (const f of [a, b]) {
    const other = f === a ? b : a;
    const dir = Math.sign(f.x - other.x) || (f === a ? -1 : 1);
    f.act = null;
    f.dashT = 0;
    f.vx = dir * 600;
    f.vy = -430;
    f.onGround = false;
    f.clashAir = true;
    f.kneelT = 0;
    f.facing = dir > 0 ? -1 : 1;
    for (const m of f.def.moves) if (m.kind === "melee") f.cds[m.id] = Math.max(f.cds[m.id], 0.5);
  }
  pop(g, x, y - 40, "CLASH!", "white", 28, 0.9);
  sfx(g, { k: "m1clash" });
  g.shake = Math.max(g.shake, 10);
  g.hitstop = Math.max(g.hitstop, 0.13);
}

function startDash(g: Game, f: Fighter, dir: number) {
  if (f.dashCd > 0 || f.dashT > 0 || f.kneelT > 0 || f.clashAir) return false;
  if (!f.onGround && !f.jugg) {
    if (f.airDashed) return false;
    f.airDashed = true;
  }
  f.dashT = DASH_TIME;
  f.dashDir = dir;
  sfx(g, { k: "dash", air: !f.onGround });
  f.dashCd = DASH_CD * (1.15 - f.aggro * 0.3);
  f.iframeT = IFRAMES;
  f.vx = 0;
  f.ghostT = 0;
  const s = f.scale;
  if (f.onGround) {
    for (let i = 0; i < 8; i++) {
      g.particles.push({ x: f.x - dir * rand(0, 14), y: GROUND - 2, vx: -dir * rand(80, 260), vy: -rand(20, 120), life: 0.35, max: 0.35, size: rand(4, 8) * s, color: "hsl(34 40% 82%)", shape: "dot", grav: 300, add: false, rot: 0 });
    }
  }
  emit(g, f.def.id, f.x, f.y - 50 * s, 6, 160);
  return true;
}

const invuln = (f: Fighter) => f.iframeT > 0;
const steady = (f: Fighter) => f.onGround || (f.jugg && f.alive);

// ---------- combat ----------
function knockOut(g: Game, f: Fighter, by: Fighter | null) {
  f.alive = false;
  f.hp = 0;
  f.koT = 0;
  f.act = null;
  f.onGround = false;
  f.vy = -460;
  f.vx = (by ? Math.sign(f.x - by.x) || 1 : -f.facing) * 260;
  if (by && by !== f) by.kills += 1;
  g.feed.unshift({ id: ++feedId, killer: by && by !== f ? by.def.name : null, victim: f.def.name });
  const c = center(f);
  emit(g, f.def.id, c.x, c.y, 34, 420);
  sfx(g, { k: "ko" });
  g.shake = Math.max(g.shake, 14);
  g.hitstop = Math.max(g.hitstop, 0.12);
  f.spinV = (f.vx > 0 ? 1 : -1) * 9;
  impact(g, c.x, c.y, Math.sign(f.vx) || 1, 70 * f.scale, f.def.color, f.def.glow, true);
  g.waves.push({ x: c.x, y: c.y, r: 150 * f.scale, life: 0.55, max: 0.55, a: f.def.glow, b: "white" });
  // the last one standing: slow motion and a hard push-in on the finishing blow
  const left = g.fighters.filter((o) => o.alive);
  const sides = g.teamMode ? new Set(left.map((o) => o.team)).size : left.length;
  const few = g.fighters.length <= 4 && !g.preview && !g.demo;
  if (sides <= 1 && !g.preview) {
    g.slow = 1.1;
    g.flash = Math.max(g.flash, 0.16);
    punchIn(g, c.x, c.y, 0.32, 1.5);
    sfx(g, { k: "final" });
    if (!g.demo) {
      g.inv = 0.11;
      g.focus.push({ x: c.x, y: c.y, t: 0, max: 1.3, seed: Math.random() * 100, color: "hsl(0 0% 100%)" });
    }
  } else {
    punchIn(g, c.x, c.y, 0.14, 0.5);
    if (few) {
      g.inv = 0.06;
      g.focus.push({ x: c.x, y: c.y, t: 0, max: 0.5, seed: Math.random() * 100, color: "hsl(0 0% 100%)" });
    }
  }
}

function hurt(g: Game, f: Fighter, amount: number, by: Fighter | null) {
  if (!f.alive || (by && by !== f && !foe(by, f))) return;
  f.hp -= amount;
  if (by && by !== f) f.lastAttacker = by.key;
  if (f.hp <= 0) knockOut(g, f, by ?? (f.lastAttacker != null ? g.fighters[f.lastAttacker] : null));
}

function hit(g: Game, a: Fighter, o: Fighter, move: Move, power: Power, dir: number, mult = 1) {
  const prev = paint;
  paint = rageOf(a);
  try {
    return landHit(g, a, o, move, power, dir, mult);
  } finally {
    paint = prev;
  }
}

function landHit(g: Game, a: Fighter, o: Fighter, move: Move, power: Power, dir: number, mult = 1) {
  if (!o.alive || !foe(a, o)) return false;
  const rg = rageOf(a);
  const c = center(o);
  if (invuln(o)) {
    if (Math.random() < 0.5) pop(g, c.x, c.y - 50 * o.scale, "dodge", o.def.glow, 15, 0.5);
    return false;
  }
  if (o.def.id === "tele" && Math.random() < 0.25) {
    pop(g, c.x, c.y - 50 * o.scale, "dodge", o.def.glow, 16);
    emit(g, "tele", c.x, c.y, 8, 160);
    return false;
  }
  if (a.status.blind > g.t && Math.random() < 0.5) {
    pop(g, c.x, c.y - 50 * o.scale, "miss", DEF_BY_ID.lux.color, 16);
    return false;
  }
  const og = rageOf(o);
  if (og?.dodge && Math.random() < og.dodge) {
    // Mastery Mode slips the hit with an afterimage
    pop(g, c.x, c.y - 50 * o.scale, "dodge", og.b, 16, 0.5);
    o.ghosts.push({ x: o.x, y: o.y, pose: { ...o.pose }, face: o.facing, life: 0.3 });
    o.x += (Math.sign(o.x - a.x) || 1) * 26 * o.scale;
    return false;
  }
  let dmg = move.dmg * mult * (a.jugg ? JUGG_DMG : 1) * (rg?.dmg ?? 1) * (og?.guard ?? 1);
  const crit = move.crit != null && Math.random() < move.crit;
  if (crit) dmg *= 1.8;
  dmg = Math.round(dmg * 10) / 10;
  sfx(g, { k: "hit", power, move: move.id, kind: move.kind, anim: move.anim, dmg, crit });
  o.flash = 0.1;
  if (power !== "shift") o.lastHitBy = power;
  const weight = o.jugg ? 0.5 : 1;
  if (move.kb) o.vx = dir * move.kb * weight * (rg?.kb ?? 1);
  if (move.lift) { o.vy = move.lift * weight; o.onGround = false; }
  if (rg && a.def.id === "pyro") o.status.burn = Math.max(o.status.burn, g.t + (rg.kind === "perfected" ? 2 : 1.2) * (o.jugg ? 0.33 : 1));
  // Mystic Mode drains a share of every hit back as health, drawn as motes flying home
  if (rg?.drain && a.alive) {
    a.hp = Math.min(a.maxHp, a.hp + dmg * rg.drain);
    const ac = center(a);
    for (let i = 0; i < 4; i++) {
      const life = rand(0.35, 0.55);
      g.particles.push({ x: c.x, y: c.y, vx: (ac.x - c.x) / life, vy: (ac.y - c.y) / life - rand(30, 90), life, max: life, size: rand(4, 7), color: i % 2 ? rg.a : rg.b, shape: "glyph" as PShape, grav: 0, add: true, rot: 0 });
    }
  }
  // raging Electro juggles: an air strike pops them up and he follows for the next one
  if (rg && a.def.id === "electro" && move.kind === "melee" && !a.onGround && !o.jugg) {
    o.vy = Math.min(o.vy, -430);
    o.onGround = false;
    a.vy = -360;
    a.airDashed = false;
    a.comboT = 0.8;
    a.think = 0;
  }
  // a juggernaut shakes off effects in a third of the time
  // Nightmare Mode is immune to stuns and freezes: the effect never lands and never breaks its attack
  const immune = shrugsOff(o, move.status);
  if (immune) pop(g, c.x, c.y - 64 * o.scale, "immune", og?.b ?? o.def.glow, 15, 0.5);
  else if (move.status) o.status[move.status] = Math.max(o.status[move.status], g.t + (move.statusDur ?? 1) * (o.jugg ? 0.33 : 1));
  const locks = !immune && (move.status === "stun" || move.status === "freeze");
  const heavy = dmg >= 9 || move.lift != null || locks;
  // a juggernaut shrugs off flinches: only a stun or freeze breaks its attack
  const breaks = o.jugg ? locks : heavy;
  if (breaks && o.act) o.act = null;
  o.kneelT = 0;
  if (breaks) o.dashT = 0;
  o.hurtT = Math.max(o.hurtT, o.jugg ? 0.06 : heavy ? 0.32 : 0.16);
  emitMove(g, move, power, c.x - dir * 8, c.y, crit ? 18 : 10, crit ? 380 : 260);
  if (LOOKS[move.id]?.hit) moveFx(g, move.id, true, c.x - dir * 6, c.y, dir, o.scale, 0.4);
  // white impact star
  g.particles.push({ x: c.x - dir * 6, y: c.y, vx: 0, vy: 0, life: 0.14, max: 0.14, size: 18 + dmg, color: "white", shape: "ring", grav: 0, add: true, rot: 0 });
  pop(g, c.x + rand(-10, 10), c.y - 56 * o.scale, crit ? `${Math.ceil(dmg)}!` : `${Math.ceil(dmg)}`, crit ? DEF_BY_ID.umbra.glow : "white", crit ? 24 : 18, 0.7);
  // cinematic impact: starburst, a jolt of the view, a hit freeze scaled to the blow, and a push-in on the big ones
  const lk = LOOKS[move.id];
  const ca = rg?.a ?? lk?.a ?? DEF_BY_ID[power].color;
  const cb = rg?.b ?? lk?.b ?? DEF_BY_ID[power].glow;
  const big = crit || dmg >= 12 || (heavy && dmg >= 8);
  const few = g.fighters.length <= 4;
  impact(g, c.x - dir * 6, c.y, dir, (big ? 50 : 24 + dmg) * o.scale, ca, cb, big);
  o.recoil = clamp(dmg / 14, 0.25, 1);
  o.jolt = big ? 0.18 : 0.09;
  if (move.lift && !o.jugg) o.spinV = dir * (big ? 15 : 10);
  kickCam(g, dir * Math.min(10, 2 + dmg * 0.5), big ? 4 : 1.5);
  g.shake = Math.max(g.shake, Math.min(12, dmg * 0.55));
  g.hitstop = Math.max(g.hitstop, few ? (big ? 0.11 : dmg >= 6 ? 0.045 : 0.018) : big ? 0.05 : 0);
  if (big && few) punchIn(g, c.x, c.y, crit ? 0.18 : 0.11, 0.42);
  if (crit) g.flash = Math.max(g.flash, 0.07);
  if (crit && few && !g.preview && !g.demo && g.focus.length < 2) g.focus.push({ x: c.x, y: c.y, t: 0, max: 0.35, seed: Math.random() * 100, color: cb });
  if (move.heal) a.hp = Math.min(a.maxHp, a.hp + move.heal);
  hurt(g, o, dmg, a);
  return true;
}

/** Where two beams cross, if they do. */
function segHit(a: Beam, b: Beam) {
  const ax = Math.cos(a.ang) * a.len, ay = Math.sin(a.ang) * a.len;
  const bx = Math.cos(b.ang) * b.len, by = Math.sin(b.ang) * b.len;
  const den = ax * by - ay * bx;
  if (Math.abs(den) < 1e-3) {
    // nearly parallel: clash if they point at each other along the same line
    const off = Math.abs((b.x - a.x) * Math.sin(a.ang) - (b.y - a.y) * Math.cos(a.ang));
    const facing = Math.cos(a.ang) * Math.cos(b.ang) < 0;
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    if (facing && off < 40 && gap < a.len + b.len) {
      const t = a.len / (a.len + b.len);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    return null;
  }
  const t = ((b.x - a.x) * by - (b.y - a.y) * bx) / den;
  const u = ((b.x - a.x) * ay - (b.y - a.y) * ax) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + ax * t, y: a.y + ay * t };
}

function segDist(px: number, py: number, b: Beam) {
  const cx = Math.cos(b.ang), cy = Math.sin(b.ang);
  const along = clamp((px - b.x) * cx + (py - b.y) * cy, 0, b.len);
  return Math.hypot(px - (b.x + cx * along), py - (b.y + cy * along));
}

function inBox(o: Fighter, x0: number, x1: number, yTop: number, yBot: number) {
  const top = o.y - bodyH(o);
  return o.x + 12 * o.scale > Math.min(x0, x1) && o.x - 12 * o.scale < Math.max(x0, x1) && o.y > yTop && top < yBot;
}

function fire(g: Game, f: Fighter, act: Action) {
  const m = act.move;
  const power = act.power;
  const def = DEF_BY_ID[power];
  const target = g.fighters[act.target];
  const h = hand(f);
  const s = f.scale;
  const enemies = g.fighters.filter((o) => o.alive && foe(f, o));
  if (m.kind !== "blink") castFx(g, f, m);
  sfx(g, { k: "cast", power, move: m.id, kind: m.kind, anim: m.anim });
  // a big ability breaks loose with a ring of force; the biggest ones flash and pull the camera in
  if (m.kind !== "melee" && (m.cd >= 5 || m.kind === "beam")) {
    const lk = LOOKS[m.id];
    const rgc = rageOf(f);
    const ca = rgc?.a ?? lk?.a ?? def.color, cb = rgc?.b ?? lk?.b ?? def.glow;
    const at = m.kind === "beam" ? h : center(f);
    g.waves.push({ x: at.x, y: at.y, r: (m.kind === "beam" ? 60 : 110) * s, life: 0.45, max: 0.45, a: ca, b: cb });
    g.shake = Math.max(g.shake, m.kind === "beam" ? 5 : 7);
    kickCam(g, -f.facing * 3, 2);
    if (m.cd >= 9 && !g.preview) {
      g.flash = Math.max(g.flash, 0.06);
      punchIn(g, at.x, at.y, 0.1, 0.45);
    }
    // a super move: when only a few are fighting, it gets its own cut-in (one every few seconds, so each one lands)
    if (m.cd >= 6 && !g.preview && !g.demo && !g.cutin && g.fighters.length <= 4 && g.t - g.lastCutIn > 7 && g.ending === 0) {
      g.lastCutIn = g.t;
      g.cutin = { key: f.key, name: f.def.name, move: m.name, a: ca, b: cb, t: 0, max: CUTIN_LEN, side: f.x < W / 2 ? 1 : -1 };
      sfx(g, { k: "cutin", power });
    }
  }
  switch (m.kind) {
    case "melee": {
      const x1 = f.x + f.facing * (m.range + 14) * s;
      for (const o of enemies) {
        const oa = o.act;
        if (!oa || oa.move.kind !== "melee" || o.facing !== -f.facing) continue;
        const reach = Math.max(m.range * s, oa.move.range * o.scale) + 24;
        if (Math.abs(o.x - f.x) > reach || Math.abs(o.y - f.y) > 50 * s) continue;
        const sinceStrike = oa.t - oa.move.wind;
        if ((oa.fired && sinceStrike < 0.15) || (!oa.fired && -sinceStrike < 0.11)) {
          m1Clash(g, f, o);
          return;
        }
      }
      for (const o of enemies) if (inBox(o, f.x, x1, f.y - 110 * s, f.y) && hit(g, f, o, m, power, f.facing)) act.landed = true;
      emitMove(g, m, power, h.x + f.facing * 14, h.y, 10, 240);
      if (m.range > 100 && !LOOKS[m.id]) {
        g.beams.push({ owner: f.key, power, x: h.x, y: h.y, ang: f.facing > 0 ? 0 : Math.PI, len: m.range * s, width: 10, life: 0.16, max: 0.16, jag: false });
      }
      break;
    }
    case "projectile": {
      const n = m.count ?? 1;
      const tc = target ? center(target) : { x: f.x + f.facing * 300, y: h.y };
      for (let i = 0; i < n; i++) {
        const spread = n > 1 ? ((i / (n - 1)) - 0.5) * (m.spread ?? 0) * 2 : 0;
        let vx: number, vy: number, grav = 0;
        const sp = m.speed ?? 500;
        if (m.arc) {
          grav = 1100;
          const dx = tc.x - h.x;
          const T = clamp(Math.abs(dx) / (sp * 0.8), 0.35, 1.4);
          vx = dx / T;
          vy = (tc.y - h.y - 0.5 * grav * T * T) / T + spread * 300;
        } else {
          const raw = Math.atan2(tc.y - h.y, tc.x - h.x);
          const base = f.facing > 0 ? 0 : Math.PI;
          let d = raw - base;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const lim = f.jugg || target?.jugg ? 0.85 : 0.45;
          const ang = base + clamp(d, -lim, lim) + spread;
          vx = Math.cos(ang) * sp; vy = Math.sin(ang) * sp;
        }
        if (m.ground) {
          // a wall of water rolls along the floor from the feet
          const r = (m.size ?? 10) * s;
          g.projectiles.push({ x: f.x + f.facing * 30 * s, y: GROUND - r, vx: f.facing * sp, vy: 0, r, grav: 0, rot: 0, owner: f.key, power, move: m, life: 4, hits: [], shape: m.shape ?? "wave" });
          continue;
        }
        g.projectiles.push({ x: h.x, y: h.y, vx, vy, r: (m.size ?? 10) * s, grav, rot: 0, owner: f.key, power, move: m, life: 3, hits: [], shape: m.shape ?? "orb" });
      }
      emitMove(g, m, power, h.x, h.y, 10, 200);
      break;
    }
    case "beam": {
      const tc = target ? center(target) : { x: h.x + f.facing * 100, y: h.y };
      const base = f.facing > 0 ? 0 : Math.PI;
      let d = Math.atan2(tc.y - h.y, tc.x - h.x) - base;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const lim = f.jugg || target?.jugg ? 0.8 : 0.35;
      const ang = base + clamp(d, -lim, lim);
      const len = m.range * 1.1;
      const nb: Beam = { owner: f.key, power, x: h.x, y: h.y, ang, len, width: power === "magneto" ? 14 : 22, life: Math.max(m.act, 0.2) + 0.15, max: Math.max(m.act, 0.2) + 0.15, jag: power === "electro", clash: true, look: m.id };
      for (const ob of g.beams) {
        if (!ob.clash || !foe(f, g.fighters[ob.owner]) || ob.life < 0.05) continue;
        const pt = segHit(nb, ob);
        if (!pt) continue;
        nb.len = Math.hypot(pt.x - nb.x, pt.y - nb.y);
        ob.len = Math.hypot(pt.x - ob.x, pt.y - ob.y);
        ob.life = Math.min(ob.life, 0.25);
        nb.life = nb.max = 0.3;
        g.beams.push(nb);
        shockwave(g, pt.x, pt.y, power, ob.power, 200);
        return;
      }
      g.beams.push(nb);
      const cx = Math.cos(ang), cy = Math.sin(ang);
      for (const o of enemies) {
        const c = center(o);
        const px = c.x - h.x, py = c.y - h.y;
        const along = px * cx + py * cy;
        const perp = Math.abs(-px * cy + py * cx);
        if (along > 0 && along < len && perp < 40 * o.scale) hit(g, f, o, m, power, f.facing);
      }
      g.shake = Math.max(g.shake, 5);
      break;
    }
    case "burst": {
      const c = center(f);
      const r = (m.radius ?? 120) * s;
      const everyone = m.world || m.harvest || m.eclipse;
      for (const o of enemies) {
        const oc = center(o);
        if (!everyone && Math.hypot(oc.x - c.x, (oc.y - c.y) * 0.8) >= r) continue;
        if (!hit(g, f, o, m, power, Math.sign(o.x - f.x) || f.facing) || !m.harvest) continue;
        // a soul is torn out of each enemy hit and streams back to the reaper
        for (let i = 0; i < 9; i++) {
          const life = rand(0.45, 0.7);
          const sx = oc.x + rand(-10, 10), sy = oc.y + rand(-16, 10);
          g.particles.push({ x: sx, y: sy, vx: (c.x - sx) / life, vy: (c.y - sy) / life - rand(40, 120), life, max: life, size: rand(5, 9), color: i % 3 ? f.def.glow : "white", shape: "dot", grav: 0, add: true, rot: 0 });
        }
        moveFx(g, m.id, true, oc.x, oc.y, f.facing, o.scale, 0.6);
      }
      if (m.harvest && m.heal) pop(g, c.x, c.y - 70 * s, "SOUL HARVEST", f.def.glow, 20, 1);
      if (m.eclipse) {
        g.eclipseUntil = g.t + ECLIPSE_TIME;
        g.flash = Math.max(g.flash, 0.2);
        pop(g, W / 2, 150, m.name.toUpperCase(), LOOKS[m.id]?.b ?? def.glow, 44, 1.6);
        sfx(g, { k: "rage", power });
      }
      if (m.world) {
        // every enemy on the field is caught at once; the arena goes still
        g.stopUntil = g.t + (m.statusDur ?? 1.5);
        g.flash = Math.max(g.flash, 0.25);
        pop(g, W / 2, 150, m.name.toUpperCase(), LOOKS[m.id]?.b ?? def.glow, 44, 1.6);
        sfx(g, { k: "rage", power });
      }
      if (m.heal && !m.harvest) { f.hp = Math.min(f.maxHp, f.hp + m.heal); pop(g, c.x, c.y - 70 * s, `+${m.heal}`, DEF_BY_ID.vita.glow, 18); }
      if (!LOOKS[m.id]) {
        g.particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: r, color: def.glow, shape: "ring", grav: 0, add: true, rot: 1 });
        g.particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: r * 0.7, color: def.color, shape: "ring", grav: 0, add: true, rot: 1 });
      }
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        emitMove(g, m, power, c.x + Math.cos(a) * 20, c.y + Math.sin(a) * 20, 1, 1, { vx: Math.cos(a) * r * 2.6, vy: Math.sin(a) * r * 2.2, grav: 0 });
      }
      g.shake = Math.max(g.shake, 9);
      if (f.y > GROUND - 80 * s) mark(g, power, f.x, Math.min(r * 0.8, 150));
      break;
    }
    case "dash":
      break; // handled while active
    case "eruption": {
      const tx = target ? clamp(target.x + target.vx * 0.15, 30, W - 30) : f.x + f.facing * 200;
      const n = m.count ?? 1;
      if (n > 1) {
        // a fault line: the ground splits from the caster's feet to past the target, one pillar after another
        const dir = Math.sign(tx - f.x) || f.facing;
        const step = Math.max(70, (Math.abs(tx - f.x) + 60) / n);
        for (let i = 0; i < n; i++) {
          const x = f.x + dir * (60 * s + step * i);
          if (x < 20 || x > W - 20) break;
          g.eruptions.push({ owner: f.key, power, move: m, x, t: -i * 0.13, fired: false });
        }
        break;
      }
      g.eruptions.push({ owner: f.key, power, move: m, x: tx, t: 0, fired: false });
      break;
    }
    case "rain": {
      const tx = target ? target.x : f.x + f.facing * 200;
      const n = m.count ?? 3;
      for (let i = 0; i < n; i++) {
        const x = clamp(tx + rand(-(m.radius ?? 80), m.radius ?? 80) * s, 20, W - 20);
        g.projectiles.push({
          x: x - 60, y: -30 - i * 70, vx: 60 + rand(-20, 20), vy: 520, r: (m.size ?? 9) * s, grav: 600, rot: 0,
          owner: f.key, power, move: m, life: 3, hits: [], shape: m.shape ?? (power === "lux" ? "shard" : "orb"),
        });
      }
      emitMove(g, m, power, h.x, h.y - 30 * s, 12, 200);
      if (LOOKS[m.id]?.cast === "sky") moveFx(g, m.id, false, clamp(tx, 120, W - 120), 70, f.facing, s, LOOKS[m.id].castLife ?? 1);
      break;
    }
    case "blink": {
      if (!target) break;
      const c0 = center(f);
      emitMove(g, m, power, c0.x, c0.y, 20, 260);
      castFx(g, f, m);
      const side = Math.sign(target.x - f.x) || 1;
      f.x = clamp(target.x + side * 52 * s, 24, W - 24);
      f.y = target.y;
      f.onGround = target.onGround;
      f.vy = 0;
      f.facing = side > 0 ? -1 : 1;
      const c1 = center(f);
      emitMove(g, m, power, c1.x, c1.y, 20, 260);
      castFx(g, f, m);
      for (const o of enemies) if (inBox(o, f.x, f.x + f.facing * 90 * s, f.y - 110 * s, f.y + 10)) hit(g, f, o, m, power, f.facing);
      break;
    }
    case "heal": {
      const c = center(f);
      const amt = m.heal ?? 10;
      f.hp = Math.min(f.maxHp, f.hp + amt);
      pop(g, c.x, c.y - 70 * s, `+${amt}`, def.glow, 22);
      for (let i = 0; i < 24; i++) emitMove(g, m, power, c.x + rand(-30, 30) * s, f.y - rand(0, 100) * s, 1, 40, { vy: -rand(60, 160), grav: 0 });
      if (!LOOKS[m.id]) g.particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 70 * s, color: def.glow, shape: "ring", grav: 0, add: true, rot: 1 });
      break;
    }
    case "zone": {
      const zx = m.range <= 200 || !target ? f.x : target.x;
      const dur = m.dur ?? 3;
      g.zones.push({ owner: f.key, power, move: m, x: zx, life: dur, max: dur });
      break;
    }
    case "pull": {
      if (!target) break;
      const tc = center(target);
      const ang = Math.atan2(tc.y - h.y, tc.x - h.x);
      g.beams.push({ owner: f.key, power, x: h.x, y: h.y, ang, len: Math.hypot(tc.x - h.x, tc.y - h.y), width: 8, life: 0.3, max: 0.3, jag: power === "magneto", look: m.id });
      if (hit(g, f, target, m, power, Math.sign(target.x - f.x) || 1)) {
        const dx = f.x - target.x;
        target.vx = Math.sign(dx) * Math.min(1000, Math.abs(dx) * 2.4);
        target.vy = -260;
        target.onGround = false;
      }
      break;
    }
    case "mimic":
      break;
    case "warp":
      warpReality(g, f, m);
      break;
    case "annihilate": {
      if (!target) break;
      const tc = center(target);
      g.annis.push({ owner: f.key, power, move: m, x: target.x + target.vx * 0.2, y: tc.y, t: 0, done: false });
      break;
    }
  }
}

/** The Riftmaker tears reality: a white flash, everyone lands somewhere new, and the fight goes on in another realm. */
function warpReality(g: Game, f: Fighter, m: Move) {
  const opts = REALMS.filter((r) => r !== g.realm?.id);
  const id = pick(opts);
  if (g.realm) g.realmOut = { id: g.realm.id, t: 0 };
  g.realm = { id, t: 0, left: REALM_TIME, by: f.key, heat: 0 };
  g.flash = 0.55;
  g.shake = Math.max(g.shake, 16);
  g.hitstop = Math.max(g.hitstop, 0.12);
  // everyone is thrown to a new spot in the new place
  const alive = g.fighters.filter((o) => o.alive);
  const spots = alive.map((_, i) => 90 + ((W - 180) * (i + 0.5)) / alive.length).sort(() => Math.random() - 0.5);
  alive.forEach((o, i) => {
    const c0 = center(o);
    emitMove(g, m, m.power ?? f.def.id, c0.x, c0.y, 14, 300);
    o.x = spots[i];
    o.vx = 0;
    if (!o.jugg) { o.y = GROUND - 140; o.vy = -120; o.onGround = false; }
    o.act = o === f ? o.act : null;
    o.dashT = 0;
    o.facing = o.x < W / 2 ? 1 : -1;
    const c1 = center(o);
    emitMove(g, m, m.power ?? f.def.id, c1.x, c1.y, 14, 300);
  });
  pop(g, W / 2, 130, "REALITY WARP", LOOKS[m.id]?.b ?? f.def.glow, 40, 1.6);
  pop(g, W / 2, 180, REALM_NAME[id], "white", 30, 1.8);
  sfx(g, { k: "rage", power: m.power ?? f.def.id });
}

/**
 * Realm upkeep, each one against whoever is not the one who brought everyone there: the desert's sun burns them,
 * the Galaxy drops shooting stars on them, the Nebula's gas slows and blinds them; the Moon and the Universe only
 * change how things fall. The realm wears off after a while.
 */
function stepRealm(g: Game, dt: number) {
  if (g.realmOut) {
    g.realmOut.t += dt;
    if (g.realmOut.t > REALM_FADE) g.realmOut = null;
  }
  const rl = g.realm;
  gravK = rl ? REALM_GRAV[rl.id] : 1;
  if (!rl) return;
  rl.t += dt;
  rl.left -= dt;
  const owner = g.fighters[rl.by];
  if (rl.left <= 0 || !owner?.alive) {
    g.realmOut = { id: rl.id, t: 0 };
    g.realm = null;
    gravK = 1;
    g.flash = Math.max(g.flash, 0.35);
    pop(g, W / 2, 150, "REALITY RESTORED", "white", 30, 1.4);
    return;
  }
  if (rl.id === "galaxy") {
    // shooting stars streak down on the warper's enemies
    rl.heat += dt;
    if (rl.heat >= 1.3) {
      rl.heat = 0;
      const foes = g.fighters.filter((o) => o.alive && foe(owner, o));
      if (foes.length) {
        const o = pick(foes);
        // aimed to land where they stand, slanting in from the far side of the arena
        const dir = o.x > W / 2 ? 1 : -1;
        const fall = (o.y - 50 + 40) / 700;
        g.projectiles.push({
          x: o.x + rand(-24, 24) - dir * 420 * fall, y: -40, vx: dir * 420, vy: 700, r: 9, grav: 0, rot: 0,
          owner: owner.key, power: "lux", move: STARFALL, life: 2.5, hits: [], shape: "shard",
        });
      }
    }
    if (Math.random() < dt * 10 && g.particles.length < 900) {
      g.particles.push({ x: rand(0, W), y: rand(0, GROUND - 60), vx: rand(-6, 6), vy: rand(-6, 6), life: 1.6, max: 1.6, size: rand(2, 4), color: Math.random() < 0.5 ? "hsl(270 90% 85%)" : "hsl(200 100% 88%)", shape: "star", grav: 0, add: true, rot: 0 });
    }
  } else if (rl.id === "universe") {
    // dust from distant worlds drifts up in the near-weightless dark
    if (Math.random() < dt * 8 && g.particles.length < 900) {
      g.particles.push({ x: rand(0, W), y: GROUND - rand(0, 20), vx: rand(-14, 14), vy: -rand(14, 40), life: 3, max: 3, size: rand(2, 3.5), color: Math.random() < 0.5 ? "hsl(220 60% 85%)" : "hsl(40 80% 80%)", shape: "dot", grav: -3, add: true, rot: 0 });
    }
  } else if (rl.id === "nebula") {
    // the nebula's gas clings to the warper's enemies: it slows them and clouds their sight
    rl.heat += dt;
    if (rl.heat >= 1.5) {
      rl.heat = 0;
      for (const o of g.fighters) if (o.alive && foe(owner, o)) {
        const k = o.jugg ? 0.33 : 1;
        o.status.slow = Math.max(o.status.slow, g.t + 0.9 * k);
        o.status.blind = Math.max(o.status.blind, g.t + 0.5 * k);
      }
    }
    if (Math.random() < dt * 9 && g.particles.length < 900) {
      g.particles.push({ x: -20, y: rand(GROUND - 300, GROUND - 10), vx: rand(30, 80), vy: rand(-8, 8), life: 3.2, max: 3.2, size: rand(10, 20), color: Math.random() < 0.5 ? "hsl(320 80% 65% / 0.5)" : "hsl(180 80% 60% / 0.5)", shape: "smoke", grav: 0, add: true, rot: 0 });
    }
  } else if (rl.id === "desert") {
    rl.heat += dt;
    if (rl.heat >= 1.6) {
      rl.heat = 0;
      for (const o of g.fighters) if (o.alive && foe(owner, o)) o.status.burn = Math.max(o.status.burn, g.t + 0.6 * (o.jugg ? 0.33 : 1));
    }
    if (Math.random() < dt * 30 && g.particles.length < 900) {
      const y = rand(GROUND - 260, GROUND - 4);
      g.particles.push({ x: -10, y, vx: rand(260, 520), vy: rand(-20, 20), life: 2.2, max: 2.2, size: rand(2, 4), color: Math.random() < 0.5 ? "hsl(36 70% 72%)" : "hsl(28 60% 60%)", shape: "dust", grav: 0, add: false, rot: 0 });
    }
  } else if (Math.random() < dt * 6 && g.particles.length < 900) {
    // moon dust drifts up off the surface
    g.particles.push({ x: rand(0, W), y: GROUND - 2, vx: rand(-10, 10), vy: -rand(10, 30), life: 2.5, max: 2.5, size: rand(2, 4), color: "hsl(220 10% 82%)", shape: "dot", grav: -2, add: false, rot: 0 });
  }
}

/** Matter and antimatter orbs close in on a spot from both sides, then cancel out in a blast. */
function stepAnnis(g: Game, dt: number) {
  for (const a of g.annis) {
    a.t += dt;
    if (a.done || a.t < ANNI_TIME) continue;
    a.done = true;
    const owner = g.fighters[a.owner];
    const r = (a.move.radius ?? 70) * (owner?.scale ?? 1);
    const prev = paint;
    paint = null;
    for (const o of g.fighters) {
      if (!o.alive || !owner || !foe(owner, o)) continue;
      const c = center(o);
      if (Math.hypot(c.x - a.x, (c.y - a.y) * 0.8) < r + 14 * o.scale) hit(g, owner, o, a.move, a.power, Math.sign(o.x - a.x) || 1);
    }
    for (let i = 0; i < 24; i++) {
      const an = (i / 24) * Math.PI * 2;
      g.particles.push({ x: a.x, y: a.y, vx: Math.cos(an) * 700, vy: Math.sin(an) * 700, life: 0.35, max: 0.35, size: 5, color: i % 2 ? "white" : "hsl(268 60% 30%)", shape: "spark", grav: 0, add: i % 2 === 1, rot: 0 });
    }
    paint = prev;
    pop(g, a.x, a.y - 70, "ANNIHILATED", "white", 22, 0.9);
    sfx(g, { k: "erupt", power: a.power, move: a.move.id });
    g.shake = Math.max(g.shake, 14);
    g.hitstop = Math.max(g.hitstop, 0.08);
  }
  g.annis = g.annis.filter((a) => a.t < ANNI_TIME + 0.35);
}

/** Picks who to fight: close, hurt, open to a punish, or whoever hit last. Sticks with a target unless a better one shows up. */
function chooseTarget(g: Game, f: Fighter) {
  let best: Fighter | null = null;
  let bs = Infinity;
  for (const o of g.fighters) {
    if (!o.alive || !foe(f, o)) continue;
    let sc = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 0.5;
    sc -= (1 - o.hp / o.maxHp) * 160 * f.aggro;
    if (f.lastAttacker === o.key) sc -= 110;
    if (f.targetKey === o.key) sc -= 90;
    if (isOpen(g, o)) sc -= 140;
    if (sc < bs) { bs = sc; best = o; }
  }
  f.targetKey = best?.key ?? null;
  return best;
}

/** Can't defend right now: catching breath, stunned, frozen, reeling or stuck in recovery. */
function isOpen(g: Game, o: Fighter) {
  if (o.kneelT > 0 || o.clashAir || o.status.stun > g.t || o.status.freeze > g.t || o.hurtT > 0.1) return true;
  const a = o.act;
  return !!a && a.fired && a.t > a.move.wind + a.move.act;
}

const reachOf = (m: Move, s: number) => m.range * (m.range < 200 ? s : 1);

function usableMoves(g: Game, f: Fighter, target: Fighter) {
  const adx = Math.abs(target.x - f.x);
  const s = f.scale;
  return f.def.moves.filter((m) =>
    f.cds[m.id] <= 0 &&
    adx <= reachOf(m, s) + 10 &&
    adx >= (m.minRange ?? 0) &&
    Math.abs(target.y - f.y) < (m.kind === "melee" ? 70 * s : 400) &&
    (m.kind !== "heal" || f.hp / f.maxHp < (m.below ?? 0.6)) &&
    (m.kind !== "warp" || !g.realm || g.realm.left < 3),
  );
}

/** How good a move is right now, instead of a coin flip. */
function scoreMove(g: Game, f: Fighter, m: Move, target: Fighter) {
  const s = f.scale;
  let sc = m.dmg * (m.count ?? 1) * (m.kind === "zone" ? (m.dur ?? 3) * 0.6 : 1);
  if (m.status && target.status[m.status] <= g.t && !shrugsOff(target, m.status)) sc += 6;
  if (m.kind === "burst") {
    let n = 0;
    const c = center(f);
    for (const o of g.fighters) if (o.alive && foe(f, o) && Math.hypot(center(o).x - c.x, center(o).y - c.y) < (m.radius ?? 120) * s) n++;
    sc += n === 0 ? -20 : 6 * (n - 1);
  }
  if (target.hp <= m.dmg * 1.2) sc += 18;
  if (isOpen(g, target) && (m.kind === "melee" || m.kind === "blink" || m.kind === "dash")) sc += 10;
  if (!target.onGround && (m.kind === "eruption" || m.kind === "zone")) sc -= target.jugg ? 14 : 8;
  if (m.kind === "heal") sc = 34 * (1 - f.hp / f.maxHp);
  if (m.kind === "mimic") sc = f.lastHitBy ? 12 : 5;
  if (m.kind === "warp") sc = 40;
  if (m.world) sc = g.fighters.some((o) => o.alive && foe(f, o) && o.status.freeze > g.t) ? -10 : 32;
  if (m.harvest) sc = 14 + 9 * g.fighters.filter((o) => o.alive && foe(f, o)).length + 20 * (1 - f.hp / f.maxHp);
  if (m.eclipse) sc = g.eclipseUntil > g.t ? -10 : 30;
  if (m.kind === "annihilate") sc += 8;
  if (f.comboT > 0 && m.kind === "melee") sc += 14;
  return sc + rand(0, 5);
}

function bestMove(g: Game, f: Fighter, target: Fighter, only?: (m: Move) => boolean) {
  let best: Move | null = null;
  let bs = -Infinity;
  for (const m of usableMoves(g, f, target)) {
    if (only && !only(m)) continue;
    const sc = scoreMove(g, f, m, target);
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}

function startMove(g: Game, f: Fighter, move: Move, target: Fighter) {
  let m = move;
  let power: Power = move.power ?? f.def.id;
  let label = move.name;
  if (move.kind === "mimic") {
    const src = f.lastHitBy ?? "psy";
    const opts = DEF_BY_ID[src].moves.filter((x) => x.kind !== "heal" && x.kind !== "mimic");
    m = pick(opts);
    power = src;
    label = `${move.name}: ${m.name}`;
    const c = center(f);
    moveFx(g, move.id, false, c.x, c.y, f.facing, f.scale, LOOKS[move.id]?.castLife ?? 0.6);
  }
  f.cds[move.id] = move.cd * (f.jugg ? JUGG_CD : 1) * (rageOf(f)?.cd ?? 1);
  f.act = { id: ++actId, move: m, power, t: 0, fired: false, target: target.key, hits: [], label, landed: false };
  f.facing = target.x >= f.x ? 1 : -1;
  const showCall = g.duel || move.cd >= 3;
  if (showCall) pop(g, f.x, f.y - bodyH(f) - 34, label, DEF_BY_ID[power].glow, g.duel ? 20 : 16, 1.1);
}

/** Split-second defence: counter a strike, shoot down a shot, dash through or out, or jump. Returns true when it acted. */
function react(g: Game, f: Fighter, target: Fighter, dt: number) {
  const s = f.scale;
  const dashReady = f.dashCd <= 0;

  // an enemy is winding up a close strike at me
  for (const o of g.fighters) {
    const oa = o.act;
    if (!o.alive || !foe(f, o) || !oa || oa.fired || oa.move.kind !== "melee" || oa.id === f.reacted) continue;
    if (o.facing !== Math.sign(f.x - o.x) || Math.abs(o.x - f.x) > reachOf(oa.move, o.scale) + 40 * s || Math.abs(o.y - f.y) > 60 * s) continue;
    f.reacted = oa.id;
    const r = Math.random();
    const counter = bestMove(g, f, o, (m) => m.kind === "melee");
    if (counter && steady(f) && r < 0.3 + 0.45 * f.aggro) {
      startMove(g, f, counter, o); // meet it head on: a clash if the timing lines up
      return true;
    }
    if (dashReady && r < 0.85) {
      const away = Math.sign(f.x - o.x) || -f.facing;
      const cornered = (away < 0 && f.x < 90) || (away > 0 && f.x > W - 90);
      return startDash(g, f, cornered ? -away : away); // cornered: dash through them instead
    }
    if (f.onGround && r < 0.95) { jump(f, 0); return true; }
  }

  // incoming shots
  for (const p of g.projectiles) {
    if (!foe(f, g.fighters[p.owner]) || p.move.kind === "rain") continue;
    const toward = Math.sign(f.x - p.x) === Math.sign(p.vx);
    if (!toward) continue;
    const d = Math.abs(p.x - f.x);
    const inBand = p.y > f.y - bodyH(f) - 20 && p.y < f.y + 10;
    // shoot it down from range for a power clash
    if (d > 170 && d < 480 && steady(f) && Math.random() < dt * 3.2 * f.aggro) {
      const owner = g.fighters[p.owner];
      const tgt = owner?.alive ? owner : target;
      const shot = bestMove(g, f, tgt, (m) => m.kind === "projectile" || m.kind === "beam");
      if (shot) { startMove(g, f, shot, tgt); return true; }
    }
    if (d < 150 && inBand && Math.random() < dt * 10) {
      if (dashReady && Math.random() < 0.55) return startDash(g, f, Math.sign(p.x - f.x) || f.facing); // through it
      if (f.onGround) { jump(f, f.walkDir); return true; }
    }
  }

  // the ground is about to erupt under me
  for (const e of g.eruptions) {
    if (e.fired || !foe(f, g.fighters[e.owner]) || Math.abs(e.x - f.x) > (e.move.radius ?? 44) + 24) continue;
    if (Math.random() < dt * 12) {
      const away = Math.sign(f.x - e.x) || -f.facing;
      if (dashReady) return startDash(g, f, away);
      f.walkDir = away;
    }
  }
  return false;
}

/** Embers, sparks or wind coming off a raging fighter, and Aero's gusts. */
function rageAura(g: Game, f: Fighter, rg: Rage, dt: number) {
  const s = f.scale;
  if (Math.random() < dt * 26) emit(g, f.def.id, f.x + rand(-16, 16) * s, f.y - rand(10, 100) * s, 1, 50);
  if (f.def.id === "electro" && Math.random() < dt * 10) {
    g.particles.push({ x: f.x + rand(-26, 26) * s, y: f.y - rand(10, 100) * s, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.18, max: 0.18, size: rand(5, 9) * s, color: rg.dark ?? INK, shape: "spark", grav: 0, add: false, rot: rand(0, 6) });
  }
  if (f.def.id !== "aero") return;
  f.rageT -= dt;
  if (f.rageT > 0 || g.t < 1 || g.ending > 0) return;
  f.rageT = rand(1.1, 1.6);
  // a gust: shoves every nearby enemy away and nicks them
  const c = center(f);
  const r = 250 * s;
  g.waves.push({ x: c.x, y: c.y, r, life: 0.45, max: 0.45, a: rg.b, b: rg.a });
  for (let i = 0; i < 18; i++) {
    const an = (i / 18) * Math.PI * 2;
    g.particles.push({ x: c.x, y: c.y, vx: Math.cos(an) * 700, vy: Math.sin(an) * 420, life: 0.3, max: 0.3, size: rand(4, 7), color: i % 2 ? rg.a : rg.b, shape: "spark", grav: 0, add: false, rot: an });
  }
  sfx(g, { k: "dash", air: true });
  for (const o of g.fighters) {
    if (!o.alive || !foe(f, o) || invuln(o)) continue;
    const oc = center(o);
    const d = Math.hypot(oc.x - c.x, (oc.y - c.y) * 0.8);
    if (d > r) continue;
    const k = 1 - d / r;
    const dir = Math.sign(o.x - f.x) || f.facing;
    const w = o.jugg ? 0.4 : 1;
    o.vx = dir * (300 + 420 * k) * w;
    if (o.onGround && !o.jugg) { o.vy = -160 - 160 * k; o.onGround = false; }
    hurt(g, o, 2 + 3 * k, f);
  }
}

/** Pushed to the limit: the match pauses for the transformation, and the form's new moves join the fighter's own. */
function startForm(g: Game, f: Fighter, fm: Form) {
  f.form = fm;
  f.rageT = 0.6;
  const known = new Set(f.def.moves.map((m) => m.id));
  const fresh = fm.moves.filter((m) => !known.has(m.id));
  if (fresh.length) f.def = { ...f.def, moves: [...f.def.moves, ...fresh] };
  for (const m of fresh) f.cds[m.id] = 0.4;
  f.act = null;
  f.dashT = 0;
  f.kneelT = 0;
  f.clashAir = false;
  f.hurtT = 0;
  f.vx = 0;
  // breaking into Nightmare Mode or a boss's next phase throws off any stun or freeze already on the fighter
  if (UNSTOPPABLE.includes(fm.kind) || fm.kind === "phase") { f.status.stun = 0; f.status.freeze = 0; }
  // a crowded free for all gets a shorter cutscene so the fight keeps moving
  const crowd = g.fighters.filter((o) => o.alive).length > 4;
  // Super and Hyper Form get the longest cutscene, so the emeralds have time to circle and crash in
  g.cut = { key: f.key, t: 0, max: crowd ? 1.6 : fm.kind === "super" || fm.kind === "hyper" ? CUT_TIME + 1 : fm.kind === "perfected" || isDarkForm(fm.kind) || fm.kind === "phase" ? CUT_TIME + 0.6 : CUT_TIME };
  g.hitstop = 0;
  sfx(g, { k: "rage", power: f.def.id, step: fm.step });
}

/** The name over a fighter's health: a boss past its first phase says which one it is in. */
const hudName = (f: Fighter) => (f.form?.kind === "phase" && f.alive ? `${f.def.name}  PHASE ${f.form.step}` : f.def.name);

/** The cutscene plays: only the raging fighter and the effects move. */
function stepCut(g: Game, dt: number) {
  const cut = g.cut!;
  cut.t += dt;
  const f = g.fighters[cut.key];
  const rg = rageOf(f);
  const k = cut.t / cut.max;
  if (rg) {
    paint = rg;
    const c = center(f);
    const s = f.scale;
    // power gathers in, then bursts off the body
    const n = k < 0.75 ? 3 : 1;
    for (let i = 0; i < n && Math.random() < dt * 60; i++) {
      const an = rand(0, Math.PI * 2), d = rand(120, 220) * s;
      g.particles.push({ x: c.x + Math.cos(an) * d, y: c.y + Math.sin(an) * d * 0.8, vx: -Math.cos(an) * d * 3, vy: -Math.sin(an) * d * 2.4, life: 0.32, max: 0.32, size: rand(3, 7), color: rageColor(rg), shape: FORM_SPARK[rg.kind] ?? (f.def.id === "aero" ? "spark" : FX[f.def.id].shape), grav: 0, add: !rg.dark, rot: an });
    }
    if (Math.random() < dt * 30) emit(g, f.def.id, f.x + rand(-20, 20) * s, f.y - rand(0, 110) * s, 1, 90);
    if (k > 0.72 && !f.ghosts.length) f.ghosts.push({ x: f.x, y: f.y, pose: { ...f.pose }, face: f.facing, life: 0.4 });
    const [gather, loose] = CUT_POSES[rg.kind];
    const quiver = rg.kind === "rage" || rg.kind === "perfected" || isDarkForm(rg.kind) || rg.kind === "phase" ? 0.03 : 0.012;
    smoothPose(f, k < 0.62 ? { ...gather, t: gather.t + Math.sin(cut.t * 30) * quiver } : loose, dt, k < 0.62 ? 10 : 26);
    paint = null;
  }
  g.shake = Math.max(g.shake, k > 0.62 ? 6 : 2);
  for (const gh of f.ghosts) gh.life -= dt;
  f.ghosts = f.ghosts.filter((gh) => gh.life > 0);
  tickBits(g, dt);
  if (cut.t >= cut.max) {
    g.cut = null;
    if (rg) rageBurst(g, f, rg);
  }
}

/** The cutscene ends in a blast that throws nearby enemies back. */
function rageBurst(g: Game, f: Fighter, rg: Rage) {
  const c = center(f);
  const r = 220 * f.scale;
  paint = rg;
  g.waves.push({ x: c.x, y: c.y, r: r * 1.3, life: 0.6, max: 0.6, a: rg.b, b: rg.a });
  emit(g, f.def.id, c.x, c.y, 40, 560);
  paint = null;
  for (const o of g.fighters) {
    if (!o.alive || !foe(f, o)) continue;
    const d = Math.hypot(center(o).x - c.x, (center(o).y - c.y) * 0.8);
    if (d > r) continue;
    const dir = Math.sign(o.x - f.x) || f.facing;
    o.vx = dir * (o.jugg ? 220 : 480);
    if (!o.jugg) { o.vy = -260; o.onGround = false; }
    o.hurtT = Math.max(o.hurtT, 0.3);
    o.act = null;
  }
  f.iframeT = 0.5;
  sfx(g, { k: "clash" });
  g.shake = Math.max(g.shake, 16);
}

// ---------- entrances ----------
/** Progress 0..1 of a fighter's entrance (below 0: not started; 1 once the entrance phase is over). */
const introU = (g: Game, f: Fighter) => (g.intro ? (g.intro.t - f.spawnAt) / introLen(f) : 1);
/** Still on the way in: no health bar or team ring yet. */
const arriving = (g: Game, f: Fighter) => !!g.intro && introU(g, f) < INTRO_ARRIVED;

function introBurst(g: Game, f: Fighter, b: IntroBurst, n: number) {
  const s = f.scale;
  const ox = f.x, oy = b.from === "feet" ? f.y : b.from === "body" ? f.y - 55 * s : rand(-10, 40);
  const spread = (b.spread ?? 0) * s;
  for (let i = 0; i < n && g.particles.length < 900; i++) {
    const life = b.life ?? rand(0.4, 0.8);
    let x = ox + (spread && b.dir !== "in" ? rand(-spread, spread) : 0), y = oy, vx: number, vy: number;
    if (b.dir === "in") {
      // start on a ring and close on the body, arriving as the particle fades (drag is 0.15 per second)
      const a = rand(0, Math.PI * 2);
      const r = spread * rand(0.8, 1.1);
      x = ox + Math.cos(a) * r; y = oy + Math.sin(a) * r * 0.8;
      const v = (r * Math.log(1 / 0.15)) / (1 - Math.pow(0.15, life));
      vx = -Math.cos(a) * v; vy = -Math.sin(a) * v * 0.8;
    } else {
      // flat: along the floor either way, tipped slightly upwards
      const a = b.dir === "up" ? -Math.PI / 2 + rand(-0.55, 0.55) : b.dir === "flat" ? (Math.random() < 0.5 ? Math.PI + rand(0, 0.3) : -rand(0, 0.3)) : rand(0, Math.PI * 2);
      const sp = rand(b.spd * 0.35, b.spd);
      vx = Math.cos(a) * sp; vy = Math.sin(a) * sp;
    }
    const [lo, hi] = b.size ?? [3, 7];
    g.particles.push({ x, y, vx, vy, life, max: life, size: rand(lo, hi) * Math.max(0.8, s), color: Math.random() < 0.5 ? b.a : b.b, shape: b.shape, grav: b.grav, add: b.add, rot: rand(0, 6) });
  }
}

/** Every fighter plays its own entrance; nothing else moves until the last one has arrived. */
function stepIntro(g: Game, dt: number) {
  const it = g.intro!;
  const prev = it.t;
  it.t += dt;
  const pre = g.pre && it.t >= g.pre.start ? g.pre : null;
  for (const f of g.fighters) {
    const sp = introOf(f.def);
    const len = sp.len ?? INTRO_LEN;
    const u0 = (prev - f.spawnAt) / len, u1 = (it.t - f.spawnAt) / len;
    if (u1 < 0) continue;
    if (u0 >= 1) { if (!pre) smoothPose(f, idlePose(f, it.t), dt, 8); continue; }
    const crossed = (at: number) => u0 <= at && u1 > at;
    smoothPose(f, introPose(f.def, sp.body(clamp(u1, 0, 1), f.scale).pose), dt, 14);
    for (const b of sp.bursts) if (crossed(b.at)) introBurst(g, f, b, b.n);
    const tr = sp.trickle;
    if (tr && u1 < tr.until && Math.random() < dt * tr.rate) introBurst(g, f, { ...tr, at: 0, n: 1 }, 1);
    if (crossed(sp.hit)) {
      sfx(g, { k: "intro", power: f.def.id });
      // a hybrid arrives with both of its parents' voices
      if (f.def.parents && f.def.parents[1] !== f.def.id) sfx(g, { k: "intro", power: f.def.parents[1] });
      // the fighter you made arrives with its second power's voice too
      const second = f.def.custom ? customElements(f.def.custom)[1] : undefined;
      if (second) sfx(g, { k: "intro", power: second });
      g.shake = Math.max(g.shake, sp.shake * (g.duel ? 1 : 0.6));
      if (!g.preview && !g.demo && g.fighters.length <= 4) g.focus.push({ x: f.x, y: f.y - 55 * f.scale, t: 0, max: 0.45, seed: Math.random() * 100, color: f.def.glow });
      // every arrival leaves its element's mark; a hybrid leaves both parents'
      mark(g, f.def.parents?.[0] ?? f.def.id, f.x, 52 * f.scale);
      if (f.def.parents && f.def.parents[1] !== f.def.parents[0]) mark(g, f.def.parents[1], f.x + 14 * f.scale, 40 * f.scale);
      if (second) mark(g, second, f.x + 14 * f.scale, 40 * f.scale);
      if (sp.wave) g.waves.push({ x: f.x, y: f.y - 30 * f.scale, r: 120 * f.scale, life: 0.5, max: 0.5, a: sp.wave[0], b: sp.wave[1] });
    }
  }
  if (pre) stepPre(g, pre, prev - pre.start, it.t - pre.start, dt);
  tickBits(g, dt);
  if (it.t >= it.max) {
    g.intro = null;
    endPre(g);
    for (const f of g.fighters) f.pose = { ...stanceOf(f.def) };
  }
}

// ---------- the moment before READY ----------
let preWord: (key: string) => string = () => "";
/** Where the speech bubbles get their words: the screen passes a lookup into its strings (`arena.prefight.<key>`). */
export function setPreFightWords(fn: (key: string) => string) {
  preWord = fn;
}

/** The pose a fighter holds during a pre-fight moment, `t` seconds in. */
function prePose(f: Fighter, pose: PrePose, t: number, gt: number): Pose {
  const st = stanceOf(f.def);
  switch (pose) {
    case "wave": return { ...st, t: 0.02, aF1: 2.75, aF2: 3.35 + Math.sin(t * 14) * 0.45 };
    case "highfive": return { ...st, t: 0.12, aF1: 2.3, aF2: 2.55 };
    case "reach": return { ...st, t: 0.2, aF1: 1.4, aF2: 1.62, aB1: 0.15, aB2: 0.35 };
    case "offer": return { ...st, t: 0.04, aF1: 1.15, aF2: 2.35 };
    case "point": return { ...st, t: 0.08, aF1: 1.62, aF2: 1.6, aB1: -0.45, aB2: 0.5 };
    case "flick": return { ...st, t: -0.1, aF1: 0.55, aF2: 0.35, aB1: 2.6, aB2: 3.9 };
    case "flex": return FLEX;
    case "crouch": return CROUCH;
    // arms crossed over the chest, leaning back a touch
    case "fold": return { ...st, t: -0.06, aF1: 0.7, aF2: 2.45, aB1: 0.85, aB2: 2.3 };
    // front hand held out palm up, fingers curling: come on, then
    case "beckon": return { ...st, t: 0.06, aF1: 1.35, aF2: 2.1 + Math.sin(t * 9) * 0.4, aB1: -0.3, aB2: 0.1 };
    // both arms up, power rising
    case "raise": return { ...st, t: -0.1, aF1: 2.7 + Math.sin(t * 6) * 0.08, aF2: 3.0, aB1: 3.5 - Math.sin(t * 6) * 0.08, aB2: 3.25 };
    // a slow bow, arms low
    case "bow": return { ...st, t: 0.72, aF1: 0.35, aF2: 0.15, aB1: -0.25, aB2: -0.1 };
    // palms up, both arms out to the sides
    case "shrug": return { ...st, t: -0.08, aF1: 0.95, aF2: 2.15, aB1: -0.95, aB2: -2.15 };
    // head thrown back, hands on hips, shaking with it
    case "laugh": return { ...st, t: -0.28 + Math.sin(t * 18) * 0.05, aF1: 0.55, aF2: -0.55, aB1: -0.55, aB2: 0.55 };
    default: return idlePose(f, gt);
  }
}

/** Walks the pair to where the moment puts them, holds their poses and throws its bursts. */
function stepPre(g: Game, p: PreRun, t0: number, t: number, dt: number) {
  const fs = [g.fighters[p.keys[0]], g.fighters[p.keys[1]]];
  const reach = Math.max(0, (Math.abs(p.homes[0] - p.homes[1]) - 66 * Math.max(fs[0].scale, fs[1].scale)) / 2);
  for (const who of [0, 1] as const) {
    const f = fs[who];
    const dir = p.homes[1 - who] > p.homes[who] ? 1 : -1;
    let pose: PrePose = "idle", to = 0;
    for (const a of p.spec.acts) {
      if (a.who !== who || a.at > t) continue;
      pose = a.pose;
      if (a.to !== undefined) to = a.to;
    }
    const target = p.homes[who] + dir * to * reach;
    const d = target - f.x;
    const sp = (p.spec.walk ?? 240) * dt;
    f.facing = dir;
    if (Math.abs(d) > 1.5) {
      const mv = clamp(d, -sp, sp);
      f.x += mv;
      f.walkDir = Math.sign(mv);
      f.walk += Math.abs(mv) / 14;
      smoothPose(f, walkPose(f), dt, 26);
    } else {
      f.x = target;
      f.walkDir = 0;
      smoothPose(f, prePose(f, pose, t, g.intro?.t ?? 0), dt, 12);
    }
  }
  for (const b of p.spec.bursts) {
    if (!(t0 < b.at && t >= b.at)) continue;
    const f = b.who === "mid" ? null : fs[b.who];
    let x: number, y: number;
    if (!f) {
      x = (fs[0].x + fs[1].x) / 2;
      y = Math.min(rig(fs[0].x, fs[0].y, fs[0].pose, fs[0].scale, fs[0].facing).hF.y, rig(fs[1].x, fs[1].y, fs[1].pose, fs[1].scale, fs[1].facing).hF.y);
    } else {
      const r = rig(f.x, f.y, f.pose, f.scale, f.facing);
      const at = b.where === "head" ? r.head : r.hF;
      x = at.x; y = at.y;
    }
    const s = f?.scale ?? fs[0].scale;
    for (let i = 0; i < b.n && g.particles.length < 900; i++) {
      const life = rand(0.45, 0.9);
      const a = rand(0, Math.PI * 2), v = rand(b.spd * 0.3, b.spd);
      g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: rand(3, 7) * Math.max(0.8, s), color: Math.random() < 0.5 ? b.a : b.b, shape: b.shape, grav: b.grav, add: true, rot: rand(0, 6) });
    }
    if (b.ring) g.waves.push({ x, y, r: 80 * s, life: 0.45, max: 0.45, a: b.a, b: b.b });
    if (f) sfx(g, { k: "intro", power: f.def.id });
    else {
      sfx(g, { k: "clash" });
      g.shake = Math.max(g.shake, 5);
    }
  }
}

/** The moment is over: everyone back where they stood. */
function endPre(g: Game) {
  const p = g.pre;
  if (!p) return;
  p.keys.forEach((k, i) => {
    const f = g.fighters[k];
    if (!f) return;
    f.x = p.homes[i];
    f.walkDir = 0;
    f.facing = p.homes[1 - i] > p.homes[i] ? 1 : -1;
  });
  g.pre = null;
}

/** Speech bubbles over the speakers' heads, typed out a letter at a time, and any star held up on a hand. */
function drawPre(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.pre, it = g.intro;
  if (!p || !it || it.t < p.start) return;
  const t = it.t - p.start;
  const fs = [g.fighters[p.keys[0]], g.fighters[p.keys[1]]];
  for (const st of p.spec.stars ?? []) {
    if (t < st.at || t > st.until) continue;
    const f = fs[st.who];
    const r = rig(f.x, f.y, f.pose, f.scale, f.facing);
    const k = clamp((t - st.at) / 0.3, 0, 1) * clamp((st.until - t) / 0.15, 0, 1);
    const tw = 0.75 + 0.25 * Math.sin(it.t * 12);
    const x = r.hF.x, y = r.hF.y - 12 * f.scale;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grd = ctx.createRadialGradient(x, y, 0, x, y, 22 * f.scale);
    grd.addColorStop(0, `hsl(48 100% 90% / ${0.8 * k})`);
    grd.addColorStop(1, "hsl(324 100% 80% / 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, 22 * f.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = st.color;
    ctx.beginPath();
    const R = 9 * f.scale * k * tw;
    for (let i = 0; i < 8; i++) {
      const a = it.t * 1.5 + (i * Math.PI) / 4, d = i % 2 ? R * 0.36 : R;
      if (i) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const ln of p.spec.lines) {
    if (t < ln.at || t > ln.until) continue;
    const text = preWord(ln.key);
    if (!text) continue;
    const f = fs[ln.who];
    const k = clamp((t - ln.at) / 0.15, 0, 1) * clamp((ln.until - t) / 0.2, 0, 1);
    const shown = text.slice(0, Math.max(1, Math.floor((t - ln.at) * 38)));
    speechBubble(ctx, text, shown, f.x, f.y - 128 * f.scale, k);
  }
}

/** A white speech bubble with an ink outline and a tail pointing down at the speaker; sized for the whole line so it does not grow as it types. */
function speechBubble(ctx: CanvasRenderingContext2D, full: string, shown: string, x: number, bottom: number, k: number) {
  const size = 17, lh = 22, maxW = 230, padX = 14, padY = 10;
  ctx.save();
  ctx.font = `600 ${size}px Fredoka, sans-serif`;
  const wrap = (str: string) => {
    const out: string[] = [];
    let line = "";
    for (const w of str.split(" ")) {
      const next = line ? line + " " + w : w;
      if (line && ctx.measureText(next).width > maxW) { out.push(line); line = w; }
      else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  const all = wrap(full);
  const w = Math.max(...all.map((l) => ctx.measureText(l).width)) + padX * 2;
  const h = all.length * lh + padY * 2;
  const cx = clamp(x, w / 2 + 8, W - w / 2 - 8);
  const top = bottom - h - 12;
  ctx.globalAlpha = k;
  ctx.translate(x, bottom);
  ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  ctx.translate(-x, -bottom);
  ctx.fillStyle = "hsl(0 0% 100%)";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, top, w, h, 14);
  ctx.fill();
  ctx.stroke();
  // the tail, drawn over the outline so it joins the bubble
  ctx.beginPath();
  ctx.moveTo(x - 9, bottom - 13.5);
  ctx.lineTo(x, bottom);
  ctx.lineTo(x + 9, bottom - 13.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(x - 7.5, bottom - 15, 15, 3);
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  // type the line out inside the layout of the whole line
  let left = shown.length;
  all.forEach((l, i) => {
    if (left <= 0) return;
    const part = l.slice(0, left);
    left -= l.length + 1;
    ctx.fillText(part, cx - w / 2 + padX, top + padY + lh * (i + 0.5));
  });
  ctx.restore();
}

// ---------- Story cutscenes ----------
/** A Story cutscene keeps these fighters out of sight until `arrive` brings them in; everyone else is already standing. */
export function holdBack(g: Game, keys: number[]) {
  g.intro = { t: 0, max: Infinity };
  g.pre = null;
  for (const f of g.fighters) f.spawnAt = keys.includes(f.key) ? Infinity : -1000;
}

/**
 * Plays the held-back fighters' own entrances, one after another, `gap` seconds apart.
 * Returns the seconds until each one lands, in the order given, and until the last has arrived.
 */
export function arrive(g: Game, keys: number[], gap: number): { lands: number[]; done: number } {
  const it = g.intro ?? (g.intro = { t: 0, max: Infinity });
  let done = 0;
  const lands = keys.map((k, i) => {
    const f = g.fighters.find((x) => x.key === k);
    if (!f) return 0;
    const sp = introOf(f.def);
    const len = sp.len ?? INTRO_LEN;
    f.spawnAt = it.t + i * gap;
    done = Math.max(done, i * gap + len);
    return i * gap + sp.hit * len;
  });
  it.max = it.t + done + 0.2;
  return { lands, done: done + 0.2 };
}

/** Ends every entrance at once: everyone stands in their own stance. */
export function settle(g: Game) {
  if (!g.intro) return;
  g.intro = null;
  endPre(g);
  for (const f of g.fighters) f.pose = { ...stanceOf(f.def) };
}

/** A beaten fighter breaks apart into its own colours, drifting up, and is gone. */
export function vanish(g: Game, key: number) {
  const f = g.fighters.find((x) => x.key === key);
  if (!f) return;
  const s = f.scale;
  for (let i = 0; i < 160; i++) {
    const life = rand(1.2, 2.4);
    g.particles.push({
      x: f.x + rand(-26, 26) * s, y: f.y - rand(0, 110) * s,
      vx: rand(-90, 90), vy: rand(-260, -40),
      life, max: life, size: rand(3, 8) * s,
      color: Math.random() < 0.5 ? f.def.color : f.def.glow,
      shape: Math.random() < 0.6 ? "dust" : "spark", grav: -40, add: Math.random() < 0.5, rot: rand(0, 6),
    });
  }
  g.waves.push({ x: f.x, y: f.y - 50 * s, r: 160 * s, life: 0.7, max: 0.7, a: f.def.glow, b: f.def.color });
  g.flash = 0.45;
  g.fighters = g.fighters.filter((x) => x !== f);
}

function jump(f: Fighter, dir: number) {
  f.vy = f.jugg ? -420 : -760;
  f.vx += dir * 120;
  f.onGround = false;
}

function updateFighter(g: Game, f: Fighter, dt: number) {
  paint = rageOf(f);
  try {
    tickFighter(g, f, dt);
  } finally {
    paint = null;
  }
}

function tickFighter(g: Game, f: Fighter, dt: number) {
  const s = f.scale;
  const rg = rageOf(f);
  f.flash = Math.max(0, f.flash - dt);
  f.hpTrail += (f.hp - f.hpTrail) * Math.min(1, dt * 2.2);
  for (const gh of f.ghosts) gh.life -= dt;
  if (f.ghosts.length) f.ghosts = f.ghosts.filter((gh) => gh.life > 0);

  if (!f.alive) {
    f.koT += dt;
    f.dashT = 0; f.kneelT = 0; f.clashAir = false;
    physics(f, dt);
    rollBody(f, dt);
    smoothPose(f, KO, dt, 9);
    return;
  }

  // status damage
  if (f.status.burn > g.t) {
    hurt(g, f, 5 * dt, null);
    if (Math.random() < dt * 18) emit(g, "pyro", f.x + rand(-12, 12) * s, f.y - rand(10, 90) * s, 1, 30);
  }
  if (f.status.poison > g.t) {
    hurt(g, f, 4.5 * dt, null);
    if (Math.random() < dt * 8) emit(g, "toxi", f.x + rand(-12, 12) * s, f.y - rand(20, 90) * s, 1, 20);
  }
  if (f.def.id === "vita") f.hp = Math.min(f.maxHp, f.hp + 1.8 * dt);
  if (!f.alive) return;

  const frozen = f.status.freeze > g.t;
  const stunned = f.status.stun > g.t;
  const slowed = f.status.slow > g.t;
  if (slowed && Math.random() < dt * 6) emit(g, "cryo", f.x + rand(-12, 12) * s, f.y - rand(10, 90) * s, 1, 20);

  for (const k in f.cds) f.cds[k] -= dt;
  f.hurtT = Math.max(0, f.hurtT - dt);
  f.dashCd -= dt;
  f.iframeT -= dt;
  f.comboT -= dt;

  if (frozen) {
    f.act = null;
    f.dashT = 0;
    physics(f, dt);
    return; // pose holds
  }

  // catching breath on one knee after a clash
  if (f.kneelT > 0) {
    f.kneelT -= dt;
    if (Math.random() < dt * 3) {
      const hx = f.x + f.facing * 14 * s, hy = f.y - 62 * s;
      g.particles.push({ x: hx, y: hy, vx: f.facing * rand(30, 60), vy: -rand(20, 50), life: 0.6, max: 0.6, size: rand(3, 5) * s, color: "hsl(0 0% 100% / 0.85)", shape: "dot", grav: -40, add: false, rot: 0 });
    }
  }

  const target = chooseTarget(g, f);
  const intro = g.preview || g.t < 1 || g.ending > 0;
  const locked = f.clashAir || f.kneelT > 0 || stunned || f.hurtT > 0 || intro;
  f.walkDir = 0;

  if (f.dashT > 0) {
    // dashing: a quick burst of ground (or air) with a moment of invulnerability
    f.dashT -= dt;
    f.x += f.dashDir * ((DASH_DIST * s * (0.8 + f.def.speed / 450) * (rg ? Math.sqrt(rg.speed) : 1)) / DASH_TIME) * dt;
    if (!f.onGround) f.vy = 0;
    if (f.dashDir === f.facing && Math.random() < dt * 40) emit(g, f.def.id, f.x - f.facing * 14 * s, f.y - rand(20, 80) * s, 1, 40);
  } else if (f.act) {
    const a = f.act;
    const m = a.move;
    a.t += dt * (slowed ? 0.7 : 1) * (rg?.act ?? 1);
    if (!a.fired && a.t >= m.wind) {
      a.fired = true;
      fire(g, f, a);
    }
    if (f.act === a) {
      // charging glow at the hand
      if (!a.fired && Math.random() < dt * 40) {
        const h = hand(f);
        emitMove(g, m, a.power, h.x, h.y, 1, 60);
      }
      if (m.kind === "dash" && a.fired && a.t < m.wind + m.act) {
        const sp = ((m.dist ?? 240) * s) / m.act;
        f.x += f.facing * sp * dt;
        if (Math.random() < dt * 60) emitMove(g, m, a.power, f.x - f.facing * 10, f.y - rand(10, 90) * s, 1, 60);
        for (const o of g.fighters) {
          if (!o.alive || !foe(f, o) || a.hits.includes(o.key)) continue;
          if (Math.abs(o.x - f.x) < 34 * s && Math.abs(o.y - f.y) < 90 * s) {
            a.hits.push(o.key);
            hit(g, f, o, m, a.power, f.facing);
          }
        }
      }
      // a strike landed and knocked them back: dash-cancel the recovery to chase the combo
      if (m.kind === "melee" && a.landed && a.t >= m.wind + m.act && target && !intro) {
        a.landed = false;
        const gap = Math.abs(target.x - f.x);
        if (gap > 70 * s && gap < 300 && Math.random() < f.aggro * 0.75 && f.dashCd <= 0) {
          f.act = null;
          f.facing = target.x >= f.x ? 1 : -1;
          startDash(g, f, f.facing);
          f.comboT = 0.7;
          f.think = 0;
        }
      }
      if (f.act === a && a.t >= m.wind + m.act + m.rec) f.act = null;
    }
  } else if (!locked && target) {
    const dx = target.x - f.x;
    const adx = Math.abs(dx);
    f.facing = dx >= 0 ? 1 : -1;
    f.think -= dt;
    f.prefT -= dt;

    if (!react(g, f, target, dt)) {
      // choose a fighting distance: aggressive fighters like it close
      if (f.prefT <= 0 || (isOpen(g, target) && f.prefRange > 120)) {
        f.prefT = rand(1.2, 3);
        const close = isOpen(g, target) || Math.random() < f.aggro;
        const pool = f.def.moves.filter((m) => m.kind !== "heal" && m.kind !== "mimic" && (close ? reachOf(m, s) < 200 : reachOf(m, s) >= 200));
        const m = pool.length ? pick(pool) : pick(f.def.moves);
        f.prefRange = clamp(reachOf(m, s) * rand(0.55, 0.85), 50, 420);
      }
      if (f.think <= 0) {
        f.think = rand(0.08, 0.26) * (1.25 - f.aggro * 0.45);
        const m = bestMove(g, f, target);
        if (m && (steady(f) || Math.random() < 0.4 || (rg && f.def.id === "electro"))) startMove(g, f, m, target);
      }
      if (!f.act && f.dashT <= 0) {
        const low = f.hp / f.maxHp < 0.3;
        // dash in from far away, back off when crowded, flee when low
        if (steady(f) && f.dashCd <= 0 && adx > f.prefRange + 160 && Math.random() < dt * 2.2 * f.aggro) {
          startDash(g, f, f.facing);
        } else if (steady(f) && f.dashCd <= 0 && adx < 90 * s && (low || f.prefRange > 200) && Math.random() < dt * 2.5) {
          const cornered = (f.facing > 0 && f.x < 90) || (f.facing < 0 && f.x > W - 90);
          startDash(g, f, cornered ? f.facing : -f.facing);
        } else if (!f.onGround && !f.airDashed && adx > 180 && Math.random() < dt * 2 * f.aggro) {
          startDash(g, f, f.facing);
        }
      }
      if (!f.act && f.dashT <= 0) {
        if (f.walkDir === 0) {
          if (adx > f.prefRange + 20) f.walkDir = f.facing;
          else if (adx < Math.max(40 * s, f.prefRange - 90)) f.walkDir = -f.facing;
          else {
            // footsies: shuffle in and out at the edge of range
            const sh = Math.sin(g.t * 2.1 + f.key * 1.7);
            f.walkDir = sh > 0.55 ? f.facing : sh < -0.55 ? -f.facing : 0;
          }
        }
        // step out of an enemy field
        for (const z of g.zones) {
          if (foe(f, g.fighters[z.owner]) && Math.abs(z.x - f.x) < (z.move.radius ?? 100)) { f.walkDir = Math.sign(f.x - z.x) || -f.facing; break; }
        }
        const sp = f.def.speed * 1.5 * (slowed ? 0.55 : 1) * (f.walkDir === -f.facing ? 0.7 : 1) * (rg?.speed ?? 1);
        f.x += f.walkDir * sp * dt;
        if (f.walkDir) f.walk += dt * (sp / 14);
        if (f.onGround && Math.random() < dt * 0.15) jump(f, f.walkDir);
        // raging Electro takes the fight into the air
        if (rg && f.def.id === "electro" && f.onGround && adx < 230 && Math.random() < dt * 2.4) jump(f, f.facing);
      }
    }
  }

  if (rg) {
    rageAura(g, f, rg, dt);
    if (rg.regen && g.ending === 0 && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + rg.regen * dt);
  }

  // afterimages while dashing or rushing
  const rushing = f.dashT > 0 || (f.act?.move.kind === "dash" && f.act.fired && f.act.t < f.act.move.wind + f.act.move.act);
  if (rushing) {
    f.ghostT -= dt;
    if (f.ghostT <= 0) {
      f.ghostT = 0.028;
      f.ghosts.push({ x: f.x, y: f.y, pose: { ...f.pose }, face: f.facing, life: 0.22 });
    }
  }

  if (f.jugg) {
    const k = f.act?.move.kind;
    const close = !!target && Math.abs(target.x - f.x) < 150 * s;
    const meleeReady = f.def.moves.some((m) => m.kind === "melee" && f.cds[m.id] <= 0);
    const low = k === "melee" || k === "dash" || k === "blink" || (close && !f.act && meleeReady);
    f.hoverY = GROUND - (low ? HOVER_LOW : HOVER_HIGH) * s + Math.sin(g.t * 3 + f.key) * 7 * s;
    // knocked into the air by an M1 clash: no floor to land on, so catch breath on the wing
    if (f.clashAir && f.vy > -40) {
      f.clashAir = false;
      f.kneelT = KNEEL_TIME * 0.6;
      f.vx *= 0.3;
    }
    if (Math.random() < dt * 14) emit(g, f.def.id, f.x - f.facing * rand(20, 60) * s, f.y - rand(70, 120) * s, 1, 40);
  }

  const wasAir = !f.onGround;
  physics(f, dt);
  if (wasAir && f.onGround && Math.abs(f.spinV) > 0.1) {
    // a launched fighter crashes down: dust, a thud, and one small bounce off a hard tumble
    for (let i = 0; i < 12; i++) {
      g.particles.push({ x: f.x + rand(-20, 20) * s, y: GROUND - 2, vx: rand(-220, 220), vy: -rand(40, 180), life: 0.5, max: 0.5, size: rand(4, 9) * s, color: "hsl(34 40% 82%)", shape: "dot", grav: 300, add: false, rot: 0 });
    }
    g.shake = Math.max(g.shake, 5);
    if (Math.abs(f.spinV) > 6) { f.vy = -210; f.onGround = false; f.spinV *= 0.35; }
    else f.spinV = 0;
  }
  rollBody(f, dt);
  f.recoil = Math.max(0, f.recoil - dt * 2.2);
  // skidding back from a hit kicks up dust
  if (f.onGround && f.hurtT > 0 && Math.abs(f.vx) > 200 && Math.random() < dt * 45) {
    g.particles.push({ x: f.x - Math.sign(f.vx) * 6 * s, y: GROUND - 2, vx: -f.vx * 0.25 + rand(-40, 40), vy: -rand(30, 110), life: 0.4, max: 0.4, size: rand(3, 7) * s, color: "hsl(34 40% 82%)", shape: "dot", grav: 260, add: false, rot: 0 });
  }
  // charging a big move: power gathers into the hand
  const ca = f.act;
  if (ca && !ca.fired && ca.move.kind !== "melee" && ca.move.kind !== "dash" && ca.move.wind >= 0.2) {
    const lk = LOOKS[ca.move.id];
    const col = rg?.b ?? lk?.b ?? DEF_BY_ID[ca.power].glow;
    const hp = hand(f);
    const big = ca.move.cd >= 5;
    if (Math.random() < dt * (big ? 70 : 35)) {
      const ang = rand(0, Math.PI * 2), r = rand(36, big ? 96 : 66) * s, life = 0.24;
      g.particles.push({ x: hp.x + Math.cos(ang) * r, y: hp.y + Math.sin(ang) * r, vx: -Math.cos(ang) * r / life * 1.6, vy: -Math.sin(ang) * r / life * 1.6, life, max: life, size: rand(2.5, 5) * s, color: col, shape: "dot", grav: 0, add: true, rot: 0 });
    }
    if (big && f.onGround && Math.random() < dt * 30) {
      g.particles.push({ x: f.x + rand(-30, 30) * s, y: GROUND - 2, vx: 0, vy: -rand(120, 260), life: 0.5, max: 0.5, size: rand(2, 4) * s, color: col, shape: "spark", grav: 0, add: true, rot: 0 });
    }
  }
  if (wasAir && f.onGround) {
    f.airDashed = false;
    if (f.clashAir) {
      // land from the clash and drop to one knee
      f.clashAir = false;
      f.kneelT = KNEEL_TIME;
      f.vx *= 0.2;
      for (let i = 0; i < 10; i++) {
        g.particles.push({ x: f.x + rand(-16, 16) * s, y: GROUND - 2, vx: rand(-160, 160), vy: -rand(30, 140), life: 0.45, max: 0.45, size: rand(4, 8) * s, color: "hsl(34 40% 82%)", shape: "dot", grav: 300, add: false, rot: 0 });
      }
    }
  }

  // pose
  let target_: Pose;
  let k = 18;
  if (f.clashAir) {
    target_ = CLASHED; k = 26;
  } else if (f.kneelT > 0) {
    const br = Math.sin(g.t * 6 + f.key);
    target_ = { ...KNEEL, t: KNEEL.t + br * 0.06, aF2: KNEEL.aF2 + br * 0.05 };
    k = 22;
  } else if (stunned) {
    target_ = { ...DAZED, t: DAZED.t + Math.sin(g.t * 6) * 0.08 };
  } else if (f.hurtT > 0) {
    const r = f.recoil;
    target_ = { ...HURT };
    for (const key of POSE_KEYS) target_[key] = HURT[key] + (HURT_HEAVY[key] - HURT[key]) * r;
    k = 30 + r * 12;
  } else if (f.dashT > 0) {
    target_ = f.dashDir === f.facing ? DASH : BACKDASH; k = 45;
  } else if (f.act) {
    const a = f.act;
    const m = a.move;
    // the Hollow King reaps overhead with both arms, whatever the move's own animation
    const anim = ANIMS[f.def.boss === "hollow" && m.kind === "melee" ? "slam" : m.anim];
    const base = f.jugg ? FLY : f.onGround ? stanceOf(f.def) : AIR;
    if (a.t < m.wind) target_ = { ...base, ...anim.wind };
    else if (a.t < m.wind + m.act + m.rec * 0.5) { target_ = { ...base, ...anim.strike }; k = 40; }
    else target_ = base;
  } else if (f.jugg) {
    const sw = Math.sin(g.t * 5 + f.key);
    target_ = { ...FLY, t: FLY.t + (f.walkDir === f.facing ? 0.15 : 0), lF1: FLY.lF1 + sw * 0.12, lB1: FLY.lB1 - sw * 0.12, lF2: FLY.lF2 + sw * 0.1 };
  } else if (!f.onGround) {
    target_ = AIR;
  } else if (f.walkDir) {
    target_ = walkPose(f);
    k = 26;
  } else {
    target_ = idlePose(f, g.t);
  }
  smoothPose(f, target_, dt, k);
  // the striking hand or foot leaves a smear while a close-range blow lands
  const sa = f.act;
  if (sa && sa.fired && sa.move.kind === "melee" && sa.t < sa.move.wind + sa.move.act + 0.12 && f.def.boss !== "hollow") {
    const r = rig(f.x, f.y, f.pose, s, f.facing);
    const tip = sa.move.anim === "kick" ? r.fF : r.hF;
    f.trail.push({ x: tip.x, y: tip.y, life: 0.15 });
    if (f.trail.length > 14) f.trail.shift();
  }
}

/** Tumbling through the air after a launch, then settling back upright. */
function rollBody(f: Fighter, dt: number) {
  if (f.spinV && !f.onGround) f.spin += f.spinV * dt;
  else if (f.onGround) f.spinV = 0;
  if (!f.spinV && f.spin) {
    f.spin = Math.atan2(Math.sin(f.spin), Math.cos(f.spin));
    f.spin *= Math.pow(0.0004, dt);
    if (Math.abs(f.spin) < 0.01) f.spin = 0;
  }
}

function physics(f: Fighter, dt: number) {
  if (f.jugg && f.alive) {
    f.onGround = false;
    f.vy += ((f.hoverY - f.y) * 5 - f.vy) * Math.min(1, dt * 6);
  } else if (!f.onGround) f.vy += GRAV * gravK * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  if (f.y >= GROUND) {
    f.y = GROUND;
    if (!f.onGround && f.vy > 600 && !f.alive) f.vy = -f.vy * 0.25;
    else { f.vy = 0; f.onGround = true; }
  }
  f.vx *= Math.pow(f.onGround ? 0.004 : f.jugg && f.alive ? 0.03 : 0.4, dt);
  if (f.x < 24) { f.x = 24; f.vx = Math.abs(f.vx) * 0.4; }
  if (f.x > W - 24) { f.x = W - 24; f.vx = -Math.abs(f.vx) * 0.4; }
}

/** The walk cycle on the ground, leaning into the step. */
function walkPose(f: Fighter): Pose {
  const p = f.walk;
  const back = f.walkDir !== f.facing ? -1 : 1;
  const lF1 = 0.08 + 0.55 * Math.sin(p) * back;
  const lB1 = 0.08 - 0.55 * Math.sin(p) * back;
  return {
    ...stanceOf(f.def),
    t: stanceOf(f.def).t + 0.08 + Math.abs(Math.sin(p)) * 0.04,
    lF1, lF2: lF1 - (0.15 + 0.5 * Math.max(0, Math.cos(p) * back)),
    lB1, lB2: lB1 - (0.15 + 0.5 * Math.max(0, -Math.cos(p) * back)),
    aB1: 0.35 - 0.4 * Math.sin(p) * back,
  };
}

function smoothPose(f: Fighter, target: Pose, dt: number, k: number) {
  const a = 1 - Math.exp(-dt * k);
  for (const key of POSE_KEYS) f.pose[key] += (target[key] - f.pose[key]) * a;
}

export function step(g: Game, dt: number) {
  g.shake = Math.max(0, g.shake - dt * 40);
  stepCam(g, dt);
  for (const f of g.fighters) f.jolt = Math.max(0, f.jolt - dt);
  if (g.intro) {
    stepIntro(g, dt);
    return;
  }
  if (g.cut) {
    stepCut(g, dt);
    return;
  }
  // the final K.O. plays in slow motion
  if (g.slow > 0) {
    g.slow -= dt;
    dt *= 0.3;
  }
  if (g.cutin && g.cutin.t < 0.5) dt *= 0.3;
  if (g.hitstop > 0) {
    g.hitstop -= dt;
    for (const x of g.impacts) x.life -= dt * 0.5;
    return;
  }
  const t0 = g.t;
  g.t += dt;
  if (t0 === 0) sfx(g, { k: "ready" });
  if (t0 < 0.55 && g.t >= 0.55) sfx(g, { k: "fight" });
  g.flash = Math.max(0, g.flash - dt);
  stepRealm(g, dt);
  const alive = g.fighters.filter((f) => f.alive);
  for (const f of g.fighters) updateFighter(g, f, dt);

  // keep bodies from stacking
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      const min = 20 * Math.min(a.scale, b.scale);
      const d = b.x - a.x;
      if (Math.abs(d) < min && Math.abs(a.y - b.y) < 60) {
        const push = (min - Math.abs(d)) / 2;
        const sgn = d === 0 ? (a.key < b.key ? 1 : -1) : Math.sign(d);
        a.x -= sgn * push; b.x += sgn * push;
      }
    }
  }

  // pushed low: the fighter's form (one cutscene at a time)
  if (!g.preview && g.ending === 0) {
    for (const f of g.fighters) {
      const fm = f.alive ? nextForm(f) : null;
      if (fm) { startForm(g, f, fm); return; }
    }
  }

  // projectiles
  const magnetos = g.fighters.filter((f) => f.alive && f.def.id === "magneto");
  for (const p of g.projectiles) {
    paint = rageOf(g.fighters[p.owner]);
    for (const m of magnetos) {
      if (!foe(m, g.fighters[p.owner])) continue;
      const c = center(m);
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < 100 && d > 0) { p.vx += ((p.x - c.x) / d) * 1100 * dt; p.vy += ((p.y - c.y) / d) * 1100 * dt; }
    }
    p.vy += p.grav * gravK * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += dt * 10;
    p.life -= dt;
    if (Math.random() < dt * 50) {
      emitMove(g, p.move, p.power, p.x, p.y, 1, 40, { size: rand(2, 5) + p.r * 0.25, life: 0.35, max: 0.35 });
    }
    if (p.x < -40 || p.x > W + 40) p.life = 0;
    if (p.y >= GROUND) {
      p.life = 0;
      emitMove(g, p.move, p.power, p.x, GROUND - 4, 10, 220);
      if (LOOKS[p.move.id]?.hit) moveFx(g, p.move.id, true, p.x, GROUND - 8, Math.sign(p.vx) || 1, p.r / Math.max(4, p.move.size ?? 10), 0.35);
      if (p.move.kind === "rain" || p.shape === "rock") {
        g.shake = Math.max(g.shake, 4);
        mark(g, p.power, p.x, 18 + p.r * 1.6);
      }
    }
    if (p.life <= 0) continue;
    for (const f of g.fighters) {
      if (!f.alive || !foe(g.fighters[p.owner], f) || p.hits.includes(f.key) || invuln(f)) continue;
      const top = f.y - bodyH(f);
      if (Math.abs(p.x - f.x) < 14 * f.scale + p.r && p.y > top - p.r && p.y < f.y + p.r) {
        p.hits.push(f.key);
        hit(g, g.fighters[p.owner], f, p.move, p.power, Math.sign(p.vx) || 1);
        if (!p.move.pierce) { p.life = 0; break; }
      }
    }
  }
  paint = null;
  // power clashes: two shots meet, or a shot runs into a beam
  const shots = g.projectiles.filter((p) => p.life > 0 && p.move.kind === "projectile" && !p.move.ground);
  for (let i = 0; i < shots.length; i++) {
    const p = shots[i];
    if (p.life <= 0) continue;
    for (let j = i + 1; j < shots.length; j++) {
      const q = shots[j];
      if (q.life <= 0 || !foe(g.fighters[p.owner], g.fighters[q.owner])) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r + 4) {
        p.life = 0; q.life = 0;
        shockwave(g, (p.x + q.x) / 2, (p.y + q.y) / 2, p.power, q.power, 120 + (p.r + q.r) * 2.5);
        break;
      }
    }
    if (p.life <= 0) continue;
    for (const b of g.beams) {
      if (!b.clash || !foe(g.fighters[p.owner], g.fighters[b.owner]) || b.life < 0.05) continue;
      if (segDist(p.x, p.y, b) < p.r + b.width * 0.6) {
        p.life = 0;
        shockwave(g, p.x, p.y, p.power, b.power, 110 + p.r * 2);
        break;
      }
    }
  }
  g.projectiles = g.projectiles.filter((p) => p.life > 0);

  for (const b of g.beams) b.life -= dt;
  g.beams = g.beams.filter((b) => b.life > 0);

  // eruptions: telegraph, then burst out of the ground
  for (const e of g.eruptions) {
    e.t += dt;
    paint = rageOf(g.fighters[e.owner]);
    if (!e.fired && e.t >= 0.3) {
      e.fired = true;
      sfx(g, { k: "erupt", power: e.power, move: e.move.id });
      const owner = g.fighters[e.owner];
      const r = e.move.radius ?? 44;
      for (const o of g.fighters) {
        if (!o.alive || !foe(owner, o) || Math.abs(o.x - e.x) > r + 10 || o.y < GROUND - (o.jugg ? 200 : 120)) continue;
        hit(g, owner, o, e.move, e.power, Math.sign(o.x - e.x) || 1);
      }
      for (let i = 0; i < 22; i++) emitMove(g, e.move, e.power, e.x + rand(-r, r) * 0.6, GROUND - rand(0, 160), 1, 120, { vy: -rand(200, 500) });
      mark(g, e.power, e.x, r * 1.3 * (owner?.scale ?? 1));
      g.shake = Math.max(g.shake, 8);
    }
  }
  paint = null;
  g.eruptions = g.eruptions.filter((e) => e.t < 0.85);

  // zones
  for (const z of g.zones) {
    z.life -= dt;
    const owner = g.fighters[z.owner];
    const r = z.move.radius ?? 100;
    paint = rageOf(owner);
    if (Math.random() < dt * 22) emitMove(g, z.move, z.power, z.x + rand(-r, r) * 0.9, GROUND - rand(0, r * 0.5), 1, 30);
    paint = null;
    for (const o of g.fighters) {
      if (!o.alive || !foe(owner, o) || Math.abs(o.x - z.x) > r || o.y < GROUND - r * 0.9) continue;
      hurt(g, o, z.move.dmg * dt, owner);
      // a draining field feeds its owner while enemies stand in it
      if (z.move.heal && owner?.alive) {
        owner.hp = Math.min(owner.maxHp, owner.hp + z.move.heal * dt);
        if (Math.random() < dt * 8) {
          const oc = center(o), c = center(owner), life = 0.6;
          g.particles.push({ x: oc.x, y: oc.y, vx: (c.x - oc.x) / life, vy: (c.y - oc.y) / life - 60, life, max: life, size: rand(4, 7), color: owner.def.glow, shape: "dot", grav: 0, add: true, rot: 0 });
        }
      }
      if (z.move.status && !shrugsOff(o, z.move.status)) o.status[z.move.status] = Math.max(o.status[z.move.status], g.t + (z.move.statusDur ?? 0.5));
      if (z.move.pullIn) o.x += Math.sign(z.x - o.x) * Math.min(Math.abs(z.x - o.x), z.move.pullIn * dt);
    }
  }
  // fields that erase matter: enemy shots flying in are deleted
  for (const z of g.zones) {
    if (!z.move.erase) continue;
    const owner = g.fighters[z.owner];
    const r = z.move.radius ?? 100;
    for (const p of g.projectiles) {
      if (p.life <= 0 || !foe(owner, g.fighters[p.owner]) || Math.abs(p.x - z.x) > r || p.y < GROUND - r * 1.3) continue;
      p.life = 0;
      g.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 26, color: "white", shape: "ring", grav: 0, add: true, rot: 0 });
      pop(g, p.x, p.y - 24, "erased", LOOKS[z.move.id]?.b ?? "white", 15, 0.6);
    }
  }
  g.projectiles = g.projectiles.filter((p) => p.life > 0);
  g.zones = g.zones.filter((z) => z.life > 0);
  stepAnnis(g, dt);

  tickBits(g, dt);

  if (g.preview) return;
  const left = g.fighters.filter((f) => f.alive);
  const sides = g.teamMode ? new Set(left.map((f) => f.team)).size : left.length;
  if (sides <= 1 && g.ending === 0) g.ending = g.t;
  if (g.ending > 0 && g.t - g.ending > 1.6) {
    g.over = true;
    const top = [...left].sort((a, b) => b.hp - a.hp)[0];
    g.winner = top?.def.name ?? null;
    g.winnerId = top ? rosterIdOf(top.def) : null;
    g.winnerTeam = g.teamMode && top ? top.team : null;
  }
}

/** Particles, floating numbers, rings and one-off effects. They keep moving through a rage cutscene. */
function tickBits(g: Game, dt: number) {
  for (const p of g.particles) {
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.15, dt);
    if (p.grav <= 0) p.vy *= Math.pow(0.15, dt);
    p.rot += dt * 6;
    p.life -= dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  for (const t of g.pops) { t.life -= dt; t.y -= dt * 40; }
  g.pops = g.pops.filter((t) => t.life > 0);
  for (const w of g.waves) w.life -= dt;
  g.waves = g.waves.filter((w) => w.life > 0);
  for (const x of g.fx) x.life -= dt;
  g.fx = g.fx.filter((x) => x.life > 0);
  for (const x of g.impacts) x.life -= dt;
  g.impacts = g.impacts.filter((x) => x.life > 0);
  for (const m of g.marks) m.life -= dt;
  if (g.marks.length) g.marks = g.marks.filter((m) => m.life > 0);
  for (const f of g.fighters) {
    for (const p of f.trail) p.life -= dt;
    if (f.trail.length) f.trail = f.trail.filter((p) => p.life > 0);
  }
}

// ---------- deep-space realms ----------
function starField(ctx: CanvasRenderingContext2D, rnd: () => number, n: number, maxY: number) {
  for (let i = 0; i < n; i++) {
    const big = rnd() < 0.06;
    const x = rnd() * W, y = rnd() * maxY;
    ctx.fillStyle = `hsl(${rnd() < 0.25 ? 210 : rnd() < 0.5 ? 40 : 280} 70% 92% / ${0.3 + rnd() * 0.7})`;
    ctx.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
    if (big) {
      ctx.strokeStyle = "hsl(0 0% 100% / 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 1); ctx.lineTo(x + 7, y + 1);
      ctx.moveTo(x + 1, y - 5); ctx.lineTo(x + 1, y + 7);
      ctx.stroke();
    }
  }
}

function softGlow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, inner: string, outer: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A floor of light for a realm with no ground of its own: a glowing plane fading into the dark. */
function spaceFloor(ctx: CanvasRenderingContext2D, rnd: () => number, top: string, bottom: string, line: string) {
  const fl = ctx.createLinearGradient(0, GROUND - 10, 0, H);
  fl.addColorStop(0, top);
  fl.addColorStop(1, bottom);
  ctx.fillStyle = fl;
  ctx.fillRect(0, GROUND - 6, W, H - GROUND + 6);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND - 5);
  ctx.lineTo(W, GROUND - 5);
  ctx.stroke();
  // perspective lines running away to a point far behind the arena
  ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 30, GROUND - 5);
    ctx.lineTo(W / 2 + i * 150, H);
    ctx.stroke();
  }
  ctx.fillStyle = "hsl(0 0% 100% / 0.6)";
  for (let i = 0; i < 40; i++) ctx.fillRect(rnd() * W, GROUND + rnd() * (H - GROUND), 1.5, 1.5);
}

function paintSpaceRealm(ctx: CanvasRenderingContext2D, id: "galaxy" | "universe" | "nebula", rnd: () => number) {
  if (id === "galaxy") {
    // inside a spiral galaxy: a blazing core, arms of stars wheeling out across the sky
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "hsl(250 60% 6%)");
    sky.addColorStop(1, "hsl(265 50% 14%)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    starField(ctx, rnd, 180, GROUND);
    const cx = 520, cy = 210;
    ctx.globalCompositeOperation = "lighter";
    softGlow(ctx, cx, cy, 420, 150, -0.25, "hsl(265 70% 40% / 0.5)", "hsl(265 70% 30% / 0)");
    for (let arm = 0; arm < 3; arm++) {
      for (let i = 0; i < 260; i++) {
        const k = i / 260;
        const a = arm * ((Math.PI * 2) / 3) + k * 4.4 + (rnd() - 0.5) * 0.35;
        const r = 18 + k * 380 + (rnd() - 0.5) * 30 * (0.4 + k);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.36;
        const rot = -0.25;
        const xr = cx + (x - cx) * Math.cos(rot) - (y - cy) * Math.sin(rot);
        const yr = cy + (x - cx) * Math.sin(rot) + (y - cy) * Math.cos(rot);
        const hue = k < 0.3 ? 40 : rnd() < 0.5 ? 205 : 290;
        ctx.fillStyle = `hsl(${hue} 90% ${70 + rnd() * 20}% / ${0.25 + (1 - k) * 0.5})`;
        const sz = rnd() < 0.08 ? 2.6 : 1.4;
        ctx.fillRect(xr, yr, sz, sz);
      }
    }
    softGlow(ctx, cx, cy, 120, 50, -0.25, "hsl(45 100% 92% / 0.95)", "hsl(35 100% 60% / 0)");
    softGlow(ctx, cx, cy, 34, 18, -0.25, "hsl(0 0% 100%)", "hsl(48 100% 85% / 0)");
    ctx.globalCompositeOperation = "source-over";
    spaceFloor(ctx, rnd, "hsl(268 60% 30% / 0.9)", "hsl(250 60% 8%)", "hsl(285 100% 80% / 0.55)");
    return;
  }
  if (id === "universe") {
    // the open universe: black depth, far galaxies, a ringed planet and a red world, a distant star
    ctx.fillStyle = "hsl(230 40% 3%)";
    ctx.fillRect(0, 0, W, H);
    starField(ctx, rnd, 260, GROUND);
    ctx.globalCompositeOperation = "lighter";
    for (const [x, y, r, rot, h] of [[150, 90, 40, 0.5, 210], [820, 300, 26, -0.4, 30], [400, 60, 18, 1.1, 300], [640, 140, 14, 0.2, 190]] as const) {
      softGlow(ctx, x, y, r, r * 0.35, rot, `hsl(${h} 80% 80% / 0.7)`, `hsl(${h} 80% 50% / 0)`);
      softGlow(ctx, x, y, r * 0.25, r * 0.12, rot, "hsl(0 0% 100% / 0.9)", "hsl(0 0% 100% / 0)");
    }
    softGlow(ctx, 860, 70, 70, 70, 0, "hsl(200 100% 90% / 0.6)", "hsl(220 100% 60% / 0)");
    ctx.globalCompositeOperation = "source-over";
    // a red world low on the left
    const rx = 120, ry = 380, rr = 70;
    const rg = ctx.createRadialGradient(rx - 22, ry - 22, 6, rx, ry, rr);
    rg.addColorStop(0, "hsl(16 70% 58%)");
    rg.addColorStop(1, "hsl(6 60% 22%)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.fill();
    // a ringed giant
    const px = 690, py = 230, pr = 58;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.3);
    ctx.strokeStyle = "hsl(40 50% 75% / 0.85)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    const pg = ctx.createLinearGradient(0, -pr, 0, pr);
    pg.addColorStop(0, "hsl(38 60% 72%)");
    pg.addColorStop(0.5, "hsl(28 50% 55%)");
    pg.addColorStop(1, "hsl(20 40% 30%)");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "hsl(28 40% 40% / 0.5)";
    ctx.lineWidth = 3;
    for (const yy of [-24, -6, 14, 32]) {
      ctx.beginPath();
      ctx.ellipse(0, yy, pr * Math.sqrt(1 - (yy / pr) ** 2), 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "hsl(40 50% 80% / 0.9)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
    spaceFloor(ctx, rnd, "hsl(220 40% 18% / 0.95)", "hsl(230 40% 4%)", "hsl(200 100% 85% / 0.45)");
    return;
  }
  // the Nebula: rolling clouds of pink, violet and teal gas lit by young stars
  ctx.fillStyle = "hsl(255 50% 7%)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = rnd() * (GROUND - 40);
    const r = 90 + rnd() * 200;
    const hue = [320, 290, 185, 205, 340][Math.floor(rnd() * 5)];
    softGlow(ctx, x, y, r, r * (0.45 + rnd() * 0.4), rnd() * 3, `hsl(${hue} 85% 55% / ${0.12 + rnd() * 0.16})`, `hsl(${hue} 85% 45% / 0)`);
  }
  // dark dust lanes cutting through the glow
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 5; i++) softGlow(ctx, rnd() * W, 80 + rnd() * 260, 160, 26, rnd() * 0.6 - 0.3, "hsl(255 50% 5% / 0.55)", "hsl(255 50% 5% / 0)");
  ctx.globalCompositeOperation = "lighter";
  starField(ctx, rnd, 150, GROUND);
  for (const [x, y] of [[300, 170], [700, 120], [560, 300]] as const) {
    softGlow(ctx, x, y, 50, 50, 0, "hsl(190 100% 92% / 0.8)", "hsl(200 100% 70% / 0)");
    ctx.fillStyle = "white";
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  ctx.globalCompositeOperation = "source-over";
  spaceFloor(ctx, rnd, "hsl(310 55% 32% / 0.9)", "hsl(260 50% 8%)", "hsl(185 100% 75% / 0.55)");
}

// ---------- drawing ----------
const realmArt: Partial<Record<Realm, HTMLCanvasElement>> = {};

/** The realm the fight was warped into, faded in over the home arena (and faded out once it ends). */
function drawRealm(ctx: CanvasRenderingContext2D, g: Game) {
  const show = (id: Realm, a: number) => {
    if (a <= 0) return;
    const art = (realmArt[id] ??= buildRealmBackdrop(id));
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.drawImage(art, -12, -8, W + 24, H + 16);
    ctx.globalAlpha = 1;
  };
  if (g.realmOut) show(g.realmOut.id, 1 - g.realmOut.t / REALM_FADE);
  if (g.realm) {
    show(g.realm.id, Math.min(g.realm.t, g.realm.left) / REALM_FADE);
    if (g.realm.id === "galaxy" || g.realm.id === "universe" || g.realm.id === "nebula") {
      // stars twinkling over the painting
      const a = Math.min(g.realm.t, g.realm.left) / REALM_FADE;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 18; i++) {
        const x = (i * 197.3) % W, y = (i * 83.7) % (GROUND - 60);
        const tw = Math.max(0, Math.sin(g.t * (1.5 + (i % 5) * 0.6) + i * 2.1));
        ctx.globalAlpha = clamp(a, 0, 1) * tw * 0.9;
        ctx.fillStyle = i % 3 ? "hsl(210 100% 92%)" : "hsl(300 100% 88%)";
        const r = 1 + tw * 2.5;
        ctx.fillRect(x - r * 2, y - 0.5, r * 4, 1);
        ctx.fillRect(x - 0.5, y - r * 2, 1, r * 4);
      }
      ctx.restore();
    }
    if (g.realm.id === "desert") {
      // heat shimmer low over the sand
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "hsl(40 100% 92%)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = GROUND - 30 - i * 26;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.03 + g.t * 5 + i) * 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/** A whole-arena painting for a realm: the Moon with Earth in a black sky, dunes under a white-hot sun, or one of the three deep-space realms. */
function buildRealmBackdrop(id: Realm): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  let seed = { moon: 7, desert: 3, galaxy: 11, universe: 19, nebula: 23 }[id];
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  if (id === "galaxy" || id === "universe" || id === "nebula") {
    paintSpaceRealm(ctx, id, rnd);
    return c;
  }
  if (id === "moon") {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "hsl(235 45% 5%)");
    sky.addColorStop(1, "hsl(240 30% 14%)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `hsl(${rnd() < 0.2 ? 210 : 45} 60% 92% / ${0.3 + rnd() * 0.7})`;
      const r = rnd() < 0.08 ? 1.8 : 1;
      ctx.fillRect(rnd() * W, rnd() * (GROUND - 80), r, r);
    }
    // Earth
    const ex = 730, ey = 140, er = 62;
    const glowE = ctx.createRadialGradient(ex, ey, er * 0.8, ex, ey, er * 1.6);
    glowE.addColorStop(0, "hsl(205 90% 70% / 0.35)");
    glowE.addColorStop(1, "hsl(205 90% 70% / 0)");
    ctx.fillStyle = glowE;
    ctx.fillRect(ex - er * 2, ey - er * 2, er * 4, er * 4);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "hsl(212 75% 46%)";
    ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
    ctx.fillStyle = "hsl(118 38% 42%)";
    for (const [dx, dy, rx, ry, rot] of [[-22, -18, 22, 14, 0.4], [14, 8, 18, 24, -0.3], [-8, 30, 14, 9, 0.2], [30, -30, 10, 7, 0.8]] as const) {
      ctx.beginPath();
      ctx.ellipse(ex + dx, ey + dy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "hsl(0 0% 100% / 0.55)";
    for (const [dx, dy, rx] of [[-30, 4, 26], [20, -14, 20], [6, 40, 22]] as const) {
      ctx.beginPath();
      ctx.ellipse(ex + dx, ey + dy, rx, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // night side
    const sh = ctx.createLinearGradient(ex - er, 0, ex + er, 0);
    sh.addColorStop(0, "hsl(235 50% 4% / 0)");
    sh.addColorStop(0.55, "hsl(235 50% 4% / 0.1)");
    sh.addColorStop(1, "hsl(235 50% 4% / 0.85)");
    ctx.fillStyle = sh;
    ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
    ctx.restore();
    // grey hills and the cratered floor
    ctx.fillStyle = "hsl(230 8% 34%)";
    ctx.beginPath();
    ctx.moveTo(0, GROUND - 60);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, GROUND - 60 - Math.abs(Math.sin(x * 0.011)) * 50 - rnd() * 10);
    ctx.lineTo(W, GROUND);
    ctx.lineTo(0, GROUND);
    ctx.fill();
    const fl = ctx.createLinearGradient(0, GROUND - 20, 0, H);
    fl.addColorStop(0, "hsl(225 6% 66%)");
    fl.addColorStop(1, "hsl(225 8% 42%)");
    ctx.fillStyle = fl;
    ctx.fillRect(0, GROUND - 18, W, H - GROUND + 18);
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W, y = GROUND - 8 + rnd() * (H - GROUND), r = 8 + rnd() * 26;
      ctx.fillStyle = "hsl(225 8% 46%)";
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "hsl(225 10% 76%)";
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.06, r * 0.85, r * 0.2, 0, 0, Math.PI);
      ctx.fill();
    }
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "hsl(204 70% 62%)");
    sky.addColorStop(0.6, "hsl(40 80% 82%)");
    sky.addColorStop(1, "hsl(30 90% 74%)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(240, 110, 10, 240, 110, 200);
    sun.addColorStop(0, "hsl(55 100% 98%)");
    sun.addColorStop(0.18, "hsl(50 100% 88% / 0.9)");
    sun.addColorStop(1, "hsl(40 100% 80% / 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 520, 360);
    // far dunes, a mesa, near dunes
    const dune = (base: number, amp: number, col: string, k: number) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, base - Math.sin(x * k + base) * amp - Math.sin(x * k * 2.3) * amp * 0.35);
      ctx.lineTo(W, GROUND);
      ctx.fill();
    };
    ctx.fillStyle = "hsl(18 45% 52%)";
    ctx.beginPath();
    ctx.moveTo(600, GROUND - 120);
    ctx.lineTo(630, GROUND - 210); ctx.lineTo(760, GROUND - 214); ctx.lineTo(790, GROUND - 120);
    ctx.fill();
    dune(GROUND - 120, 26, "hsl(32 60% 66%)", 0.008);
    dune(GROUND - 60, 22, "hsl(30 62% 58%)", 0.012);
    const fl = ctx.createLinearGradient(0, GROUND - 20, 0, H);
    fl.addColorStop(0, "hsl(36 70% 64%)");
    fl.addColorStop(1, "hsl(28 60% 46%)");
    ctx.fillStyle = fl;
    ctx.fillRect(0, GROUND - 14, W, H - GROUND + 14);
    ctx.strokeStyle = "hsl(30 50% 50% / 0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = GROUND + 6 + i * 7, x0 = rnd() * W;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo(x0 + 60, y - 4, x0 + 130, y);
      ctx.stroke();
    }
    // a bleached rock and a cactus silhouette
    ctx.fillStyle = "hsl(25 40% 38%)";
    ctx.beginPath();
    ctx.ellipse(110, GROUND - 6, 44, 18, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "hsl(120 25% 30%)";
    ctx.lineCap = "round";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(870, GROUND - 4); ctx.lineTo(870, GROUND - 110);
    ctx.moveTo(870, GROUND - 60); ctx.lineTo(892, GROUND - 60); ctx.lineTo(892, GROUND - 90);
    ctx.moveTo(870, GROUND - 46); ctx.lineTo(850, GROUND - 46); ctx.lineTo(850, GROUND - 70);
    ctx.stroke();
  }
  return c;
}

/** Everwinter's Time Stop: the arena drains to a cold grey and a frozen clock face hangs over it. */
/** The Black Sun's Total Eclipse: night falls over the arena and a blacked-out sun hangs in the sky. */
function drawEclipse(ctx: CanvasRenderingContext2D, g: Game) {
  const left = g.eclipseUntil - g.t;
  const a = clamp(Math.min(left, 0.6) / 0.6, 0, 1) * clamp((ECLIPSE_TIME - left) / 0.5, 0, 1);
  const t = g.t;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "hsl(250 45% 5% / 0.66)";
  ctx.fillRect(-20, -20, W + 40, H + 40);
  const cx = W / 2, cy = 112, r = 44;
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 3.4);
  halo.addColorStop(0, "hsl(42 100% 70% / 0.85)");
  halo.addColorStop(0.35, "hsl(28 100% 50% / 0.35)");
  halo.addColorStop(1, "hsl(28 100% 50% / 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 3.4, 0, Math.PI * 2);
  ctx.fill();
  // corona streamers flickering out from behind the moon
  ctx.strokeStyle = "hsl(44 100% 78% / 0.7)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const an = (i / 18) * Math.PI * 2 + Math.sin(t * 0.7 + i) * 0.05;
    const len = r * (1.5 + 0.5 * Math.sin(t * 3 + i * 2.3) + (i % 3 === 0 ? 0.6 : 0));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r);
    ctx.quadraticCurveTo(cx + Math.cos(an + 0.08) * r * 1.3, cy + Math.sin(an + 0.08) * r * 1.3, cx + Math.cos(an) * len, cy + Math.sin(an) * len);
    ctx.stroke();
  }
  // the diamond ring: one bright bead of light slipping past the edge
  const da = -0.7 + Math.sin(t * 0.4) * 0.15;
  glowDot(ctx, cx + Math.cos(da) * r, cy + Math.sin(da) * r, 22, "hsl(0 0% 100%)", "hsl(44 100% 70% / 0)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "hsl(250 40% 4%)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "hsl(44 100% 80%)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // a few stars come out
  ctx.fillStyle = "hsl(0 0% 100% / 0.8)";
  for (let i = 0; i < 26; i++) {
    const sx = ((i * 157.3) % W), sy = 20 + ((i * 83.7) % 220);
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
    ctx.fillRect(sx, sy, 1.5 + tw, 1.5 + tw);
  }
  ctx.restore();
}

function drawTimeStop(ctx: CanvasRenderingContext2D, g: Game) {
  const left = g.stopUntil - g.t;
  const a = clamp(Math.min(left, 0.3) / 0.3, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = "saturation";
  ctx.fillStyle = "hsl(0 0% 50%)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "hsl(205 60% 70% / 0.16)";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = 250, r = 170;
  ctx.strokeStyle = "hsl(44 90% 80% / 0.55)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const an = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(an) * r * 0.86, cy + Math.sin(an) * r * 0.86);
    ctx.lineTo(cx + Math.cos(an) * r * 0.97, cy + Math.sin(an) * r * 0.97);
    ctx.stroke();
  }
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.7);
  ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.45, cy + r * 0.12);
  ctx.stroke();
  ctx.restore();
}

export function buildBackdrop(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, 420);
  sky.addColorStop(0, "hsl(222 70% 62%)");
  sky.addColorStop(0.55, "hsl(260 60% 78%)");
  sky.addColorStop(1, "hsl(28 95% 82%)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 440);
  // sun
  const sun = ctx.createRadialGradient(720, 250, 10, 720, 250, 190);
  sun.addColorStop(0, "hsl(48 100% 92%)");
  sun.addColorStop(0.3, "hsl(40 100% 78% / 0.8)");
  sun.addColorStop(1, "hsl(30 100% 80% / 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(500, 40, 440, 400);
  // clouds
  ctx.fillStyle = "hsl(0 0% 100% / 0.7)";
  for (const [cx, cy, s] of [[140, 90, 1], [420, 60, 0.7], [820, 110, 0.85], [600, 150, 0.5]] as const) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 30 * s, cy - 10 * s, 36 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 26 * s, cy - 14 * s, 30 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // far mountains
  const hills = (y: number, amp: number, col: string, seed: number) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 440);
    for (let x = 0; x <= W; x += 20) {
      ctx.lineTo(x, y - Math.abs(Math.sin(x * 0.006 + seed)) * amp - Math.sin(x * 0.021 + seed * 2) * amp * 0.25);
    }
    ctx.lineTo(W, 440);
    ctx.fill();
  };
  hills(300, 110, "hsl(255 32% 64%)", 1.3);
  hills(330, 70, "hsl(250 30% 54%)", 4.1);
  // colosseum wall
  const wallTop = 330, wallBot = 440;
  const wall = ctx.createLinearGradient(0, wallTop, 0, wallBot);
  wall.addColorStop(0, "hsl(30 40% 72%)");
  wall.addColorStop(1, "hsl(24 34% 56%)");
  ctx.fillStyle = wall;
  ctx.fillRect(0, wallTop, W, wallBot - wallTop);
  // crowd
  const crowd = ["hsl(12 80% 60%)", "hsl(200 70% 60%)", "hsl(50 90% 60%)", "hsl(140 50% 50%)", "hsl(300 50% 62%)", "hsl(30 30% 30%)"];
  for (let row = 0; row < 3; row++) {
    for (let x = 6 + row * 7; x < W; x += 14) {
      ctx.fillStyle = crowd[(x * 7 + row * 13) % crowd.length];
      const y = wallTop - 8 - row * 10 + ((x * 31) % 5);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 5, y + 3, 10, 8);
    }
  }
  ctx.fillStyle = INK;
  ctx.fillRect(0, wallTop - 4, W, 6);
  // arches
  for (let x = 30; x < W; x += 96) {
    ctx.fillStyle = "hsl(22 30% 34%)";
    ctx.beginPath();
    ctx.moveTo(x, wallBot);
    ctx.lineTo(x, wallTop + 48);
    ctx.arc(x + 24, wallTop + 48, 24, Math.PI, 0);
    ctx.lineTo(x + 48, wallBot);
    ctx.fill();
    ctx.strokeStyle = "hsl(22 30% 26%)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // banners
  const banners = ["hsl(14 92% 54%)", "hsl(198 88% 55%)", "hsl(50 96% 54%)", "hsl(140 58% 44%)", "hsl(274 58% 50%)"];
  for (let i = 0; i < 10; i++) {
    const x = 78 + i * 96;
    ctx.fillStyle = banners[i % banners.length];
    ctx.beginPath();
    ctx.moveTo(x - 12, wallTop + 2);
    ctx.lineTo(x + 12, wallTop + 2);
    ctx.lineTo(x + 12, wallTop + 52);
    ctx.lineTo(x, wallTop + 42);
    ctx.lineTo(x - 12, wallTop + 52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // floor
  const floor = ctx.createLinearGradient(0, 440, 0, H);
  floor.addColorStop(0, "hsl(36 60% 70%)");
  floor.addColorStop(1, "hsl(30 55% 60%)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 440, W, H - 440);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 438, W, 4);
  ctx.strokeStyle = "hsl(30 40% 52% / 0.55)";
  ctx.lineWidth = 2;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 60, 442);
    ctx.lineTo(W / 2 + i * 150, H);
    ctx.stroke();
  }
  for (const y of [462, 492, 530, 575]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // arena ring painted on the floor
  ctx.strokeStyle = "hsl(0 0% 100% / 0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(W / 2, 540, 300, 40, 0, 0, Math.PI * 2);
  ctx.stroke();
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 640);
  v.addColorStop(0, "hsl(0 0% 0% / 0)");
  v.addColorStop(1, "hsl(250 40% 10% / 0.35)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // clouds drift over the colosseum while a little confetti falls from the stands
  return setAir(c, { clouds: "hsl(0 0% 100%)", motes: "confetti", amount: 1 });
}

function limb(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], col: string, w: number, flash: boolean, ink = INK) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = ink;
  ctx.lineWidth = w + 4;
  ctx.stroke();
  ctx.strokeStyle = flash ? "white" : col;
  ctx.lineWidth = w;
  ctx.stroke();
}

const HEAD = 11;

/** Joint positions for a pose, standing at (x, y). */
function rig(x: number, y: number, p: Pose, s: number, face: number) {
  const T = 21, S = 21, TOR = 34, UA = 18, FA = 17;
  const drop = Math.max(4, Math.cos(p.lF1) * T + Math.cos(p.lF2) * S, Math.cos(p.lB1) * T + Math.cos(p.lB2) * S);
  const hip = { x, y: y - drop * s };
  const P = (a: number, len: number, o: { x: number; y: number }) => ({ x: o.x + Math.sin(a) * len * s * face, y: o.y + Math.cos(a) * len * s });
  const neck = { x: hip.x + Math.sin(p.t) * TOR * s * face, y: hip.y - Math.cos(p.t) * TOR * s };
  const shoulder = { x: hip.x + (neck.x - hip.x) * 0.88, y: hip.y + (neck.y - hip.y) * 0.88 };
  const head = { x: hip.x + Math.sin(p.t) * (TOR + HEAD + 3) * s * face, y: hip.y - Math.cos(p.t) * (TOR + HEAD + 3) * s };
  const kF = P(p.lF1, T, hip), fF = P(p.lF2, S, kF);
  const kB = P(p.lB1, T, hip), fB = P(p.lB2, S, kB);
  const eF = P(p.aF1, UA, shoulder), hF = P(p.aF2, FA, eF);
  const eB = P(p.aB1, UA, shoulder), hB = P(p.aB2, FA, eB);
  return { hip, neck, shoulder, head, kF, fF, kB, fB, eF, hF, eB, hB };
}

/** Fading coloured silhouettes left behind by a dash. */
function drawGhosts(ctx: CanvasRenderingContext2D, f: Fighter) {
  if (!f.ghosts.length) return;
  const s = f.scale;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const gh of f.ghosts) {
    const r = rig(gh.x, gh.y, gh.pose, s, gh.face);
    ctx.globalAlpha = clamp(gh.life / 0.22, 0, 1) * 0.5;
    ctx.strokeStyle = rageOf(f)?.glow ?? f.def.glow;
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    for (const seg of [[r.hip, r.kB, r.fB], [r.shoulder, r.eB, r.hB], [r.hip, r.neck], [r.hip, r.kF, r.fF], [r.shoulder, r.eF, r.hF]]) {
      ctx.moveTo(seg[0].x, seg[0].y);
      for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i].x, seg[i].y);
    }
    ctx.stroke();
    ctx.fillStyle = rageOf(f)?.body ?? f.def.color;
    ctx.beginPath();
    ctx.arc(r.head.x, r.head.y, HEAD * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWave(ctx: CanvasRenderingContext2D, w: Wave) {
  const t = 1 - w.life / w.max;
  const e = 1 - Math.pow(1 - t, 3);
  const r = 16 + w.r * e;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // flash at the point of contact
  if (t < 0.35) glowDot(ctx, w.x, w.y, 30 + w.r * 0.5 * (1 - t), `hsl(0 0% 100% / ${0.9 * (1 - t / 0.35)})`, "hsl(0 0% 100% / 0)");
  ctx.globalAlpha = 1 - t;
  ctx.lineWidth = 14 * (1 - t) + 2;
  ctx.strokeStyle = w.a;
  ctx.beginPath();
  ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 6 * (1 - t) + 1;
  ctx.strokeStyle = w.b;
  ctx.beginPath();
  ctx.arc(w.x, w.y, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w.x, w.y, r * 1.06, 0, Math.PI * 2);
  ctx.stroke();
  // dust ring where the blast meets the floor
  const gy = GROUND + 2;
  if (Math.abs(gy - w.y) < r) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = (1 - t) * 0.6;
    ctx.strokeStyle = "hsl(34 40% 88%)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(w.x, gy, r * 1.1, 10 + r * 0.06, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** A fighter, rolled while tumbling and shuddering while a hit freezes. Same options as the body. */
function drawFighter(ctx: CanvasRenderingContext2D, g: Game, f: Fighter, o: { alpha?: number; solid?: string; shadow?: boolean } = {}) {
  const jx = f.jolt > 0 ? Math.sin(f.jolt * 170) * 4.5 * f.scale * Math.min(1, f.jolt / 0.09) : 0;
  if (!f.spin && !jx) return drawFighterBody(ctx, g, f, o);
  const s = f.scale;
  if (o.shadow !== false) {
    const air = clamp((GROUND - f.y) / 300, 0, 1);
    ctx.fillStyle = `hsl(250 40% 15% / ${0.28 * (1 - air * 0.6) * (o.alpha ?? 1)})`;
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND + 2, 26 * s * (1 - air * 0.4), 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(jx, 0);
  if (f.spin) {
    const c = center(f);
    ctx.translate(c.x, c.y);
    ctx.rotate(f.spin);
    ctx.translate(-c.x, -c.y);
  }
  drawFighterBody(ctx, g, f, { ...o, shadow: false });
  ctx.restore();
}

/** The smear a fist or foot leaves through a strike: a tapered ribbon in the move's colours. */
function drawTrail(ctx: CanvasRenderingContext2D, f: Fighter) {
  const tr = f.trail;
  if (tr.length < 2) return;
  const lk = f.act ? LOOKS[f.act.move.id] : undefined;
  const rg = rageOf(f);
  const col = rg?.b ?? lk?.b ?? f.def.glow;
  const core = rg?.a ?? lk?.a ?? f.def.color;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 1; i < tr.length; i++) {
    const a = tr[i - 1], b = tr[i];
    const k = i / (tr.length - 1);
    const life = clamp(b.life / 0.15, 0, 1);
    ctx.globalAlpha = life * (0.25 + 0.65 * k);
    ctx.strokeStyle = col;
    ctx.lineWidth = (3 + 13 * k) * f.scale * life;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = k > 0.6 ? "white" : core;
    ctx.lineWidth = (1 + 4 * k) * f.scale * life;
    ctx.stroke();
  }
  ctx.restore();
}

/** A hit's impact frame: spiked starburst with a white core, and speed streaks flying the way the blow went. */
function drawImpact(ctx: CanvasRenderingContext2D, x: Impact) {
  const u = 1 - x.life / x.max;
  const R = x.size * (0.55 + 0.75 * Math.sqrt(u));
  const spikes = x.heavy ? 14 : 9;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1 - u;
  ctx.beginPath();
  for (let i = 0; i <= spikes * 2; i++) {
    const an = (i / (spikes * 2)) * Math.PI * 2 + x.seed;
    const jag = 0.6 + 0.4 * Math.abs(Math.sin(x.seed * 7.3 + i * 2.17));
    const r = i % 2 ? R * 0.34 : R * jag;
    const px = x.x + Math.cos(an) * r, py = x.y + Math.sin(an) * r * 0.85;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  const grd = ctx.createRadialGradient(x.x, x.y, 0, x.x, x.y, R);
  grd.addColorStop(0, "white");
  grd.addColorStop(0.35, x.b);
  grd.addColorStop(1, shade(x.a, 0, 0));
  ctx.fillStyle = grd;
  ctx.fill();
  // speed streaks
  ctx.strokeStyle = x.b;
  ctx.lineCap = "round";
  const n = x.heavy ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const off = (Math.sin(x.seed * 3.1 + i * 1.9) * 0.9) * R * 0.7;
    const start = R * (0.2 + u * 0.8);
    const len = R * (x.heavy ? 1.9 : 1.2) * (0.6 + 0.4 * Math.abs(Math.cos(x.seed + i)));
    ctx.lineWidth = (x.heavy ? 4 : 2.5) * (1 - u) + 1;
    ctx.beginPath();
    ctx.moveTo(x.x + x.dir * start, x.y + off);
    ctx.lineTo(x.x + x.dir * (start + len), x.y + off * 1.15);
    ctx.stroke();
  }
  // a white ring snapping outward
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3 * (1 - u) + 0.5;
  ctx.beginPath();
  ctx.ellipse(x.x, x.y, R * 1.15, R * 0.95, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

type Pt = { x: number; y: number };
/** A cape for the fighter you made: hung from the shoulders, swinging out behind as it moves. */
function drawCape(ctx: CanvasRenderingContext2D, neck: Pt, hip: Pt, face: number, wave: number, vx: number, s: number, fill: string, ink: string) {
  const back = -face * (14 + Math.min(40, Math.abs(vx) * 0.06)) * s;
  const low = hip.y + 22 * s;
  ctx.beginPath();
  ctx.moveTo(neck.x - face * 2 * s, neck.y - 1 * s);
  ctx.quadraticCurveTo(neck.x + back * 0.9, (neck.y + low) / 2 + wave, hip.x + back * 1.4, low - wave * 0.5);
  ctx.lineTo(hip.x + back * 0.5, low + 4 * s);
  ctx.quadraticCurveTo(hip.x - face * 4 * s, (neck.y + low) / 2, neck.x + face * 3 * s, neck.y + 2 * s);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5 * s;
  ctx.stroke();
}
/** A headband with two tails trailing behind, or a mask band across the eyes with the eye showing through. */
function drawHeadGear(ctx: CanvasRenderingContext2D, gear: "headband" | "mask", head: Pt, face: number, wave: number, vx: number, s: number, fill: string, ink: string, eyeOpen: boolean) {
  const r = HEAD * s;
  const y = gear === "headband" ? head.y - r * 0.45 : head.y - 1.5 * s;
  const half = gear === "headband" ? 2.6 * s : 3.6 * s;
  ctx.save();
  ctx.beginPath();
  ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(head.x - r - 2, y - half, r * 2 + 4, half * 2);
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.6 * s;
  for (const dy of [-half, half]) {
    const w = Math.sqrt(Math.max(0, r * r - (y + dy - head.y) ** 2));
    ctx.beginPath();
    ctx.moveTo(head.x - w, y + dy);
    ctx.lineTo(head.x + w, y + dy);
    ctx.stroke();
  }
  // the tails of the knot, trailing behind the head
  const bx = head.x - face * r * 0.95, tl = (12 + Math.min(16, Math.abs(vx) * 0.03)) * s;
  for (const k of gear === "headband" ? [0, 1] : [0]) {
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx - face * tl * 0.6, y + wave * (k ? -1 : 1) + k * 4 * s, bx - face * tl, y + 5 * s + k * 5 * s - wave * 0.6);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5 * s;
    ctx.stroke();
    ctx.strokeStyle = fill;
    ctx.lineWidth = 2.6 * s;
    ctx.stroke();
  }
  if (gear === "mask" && eyeOpen) {
    // the eye still shows through the mask
    const ex = head.x + face * 5 * s, ey = head.y - 1.5 * s;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.ellipse(ex, ey, 3.2 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + face * 1.2 * s, ey + 0.3 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A Story minion's gear: the grunt's horns, the caster's hood, the brute's spiked pauldron, the lieutenant's crown and cape,
 * and on every one of them its boss's sigil glowing on the chest. */
function drawMinionGear(ctx: CanvasRenderingContext2D, m: NonNullable<FighterDef["minion"]>, layer: "back" | "front", p: { head: Pt; neck: Pt; hip: Pt; shoulder: Pt }, s: number, face: number, wave: number, vx: number, ink: string, body: string) {
  const { head, neck, hip, shoulder } = p;
  const r = HEAD * s;
  ctx.lineJoin = "round";
  if (layer === "back") {
    if (m.kind === "caster") {
      // a pointed hood framing the face, its tip trailing behind
      ctx.beginPath();
      ctx.moveTo(head.x + face * r * 0.95, head.y + r * 0.85);
      ctx.quadraticCurveTo(head.x + face * r * 1.55, head.y - r * 1.35, head.x - face * r * 0.3, head.y - r * 1.55);
      ctx.quadraticCurveTo(head.x - face * r * 1.5, head.y - r * 1.9 + wave * 0.3, head.x - face * r * 2.5, head.y - r * 0.1 + wave * 0.6);
      ctx.quadraticCurveTo(head.x - face * r * 1.4, head.y + r * 0.7, head.x - face * r * 0.5, head.y + r * 1.25);
      ctx.closePath();
      ctx.fillStyle = shade(body, -14);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3 * s;
      ctx.stroke();
    }
    if (m.kind === "elite") drawCape(ctx, neck, hip, face, wave, vx, s, m.mark, ink);
    return;
  }
  // the boss's sigil, glowing on the chest
  const cx = neck.x + (hip.x - neck.x) * 0.36, cy = neck.y + (hip.y - neck.y) * 0.36, d = 5.5 * s;
  ctx.save();
  ctx.shadowColor = m.mark;
  ctx.shadowBlur = 10 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cy - d);
  ctx.lineTo(cx + d * 0.75, cy);
  ctx.lineTo(cx, cy + d);
  ctx.lineTo(cx - d * 0.75, cy);
  ctx.closePath();
  ctx.fillStyle = m.mark;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  if (m.kind === "grunt") {
    // two little horns
    for (const k of [-1, 1]) {
      const bx = head.x + k * r * 0.5, by = head.y - r * 0.75;
      ctx.beginPath();
      ctx.moveTo(bx - 3.2 * s, by + 1.5 * s);
      ctx.quadraticCurveTo(bx + k * 1.5 * s, by - 9 * s, bx + k * 6 * s, by - 12 * s);
      ctx.quadraticCurveTo(bx + k * 3 * s, by - 3 * s, bx + 3.2 * s, by + 1.5 * s);
      ctx.closePath();
      ctx.fillStyle = shade(body, -22);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2 * s;
      ctx.stroke();
    }
  } else if (m.kind === "brute") {
    // a spiked pauldron on the front shoulder
    const px = shoulder.x + face * 2 * s, py = shoulder.y - 2 * s;
    for (const a of [-0.5, 0.35]) {
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a - 1.9) * 7 * s, py + Math.sin(a - 1.9) * 7 * s);
      ctx.lineTo(px + Math.cos(a - Math.PI / 2) * 16 * s, py + Math.sin(a - Math.PI / 2) * 16 * s);
      ctx.lineTo(px + Math.cos(a - 1.2) * 7 * s, py + Math.sin(a - 1.2) * 7 * s);
      ctx.closePath();
      ctx.fillStyle = m.mark;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2 * s;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(px, py, 8.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = shade(body, -10);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.6 * s;
    ctx.stroke();
  } else if (m.kind === "elite") {
    // a crown of three spikes
    const top = head.y - r * 0.8;
    ctx.beginPath();
    ctx.moveTo(head.x - r * 0.85, top + 2 * s);
    ctx.lineTo(head.x - r * 0.75, top - 8 * s);
    ctx.lineTo(head.x - r * 0.35, top - 2 * s);
    ctx.lineTo(head.x, top - 12 * s);
    ctx.lineTo(head.x + r * 0.35, top - 2 * s);
    ctx.lineTo(head.x + r * 0.75, top - 8 * s);
    ctx.lineTo(head.x + r * 0.85, top + 2 * s);
    ctx.closePath();
    ctx.fillStyle = m.mark;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2 * s;
    ctx.stroke();
  }
}

/** `alpha` fades the whole body, `solid` paints it one flat colour (used by the entrances), `shadow: false` skips the floor shadow. */
function drawFighterBody(ctx: CanvasRenderingContext2D, g: Game, f: Fighter, o: { alpha?: number; solid?: string; shadow?: boolean } = {}) {
  const s = f.scale;
  let face: number = f.facing;
  if (f.act?.move.anim === "spin" && f.act.fired && f.def.boss !== "hollow") face = Math.sin(g.t * 40) > 0 ? 1 : -1;
  const { hip, neck, shoulder, head, kF, fF, kB, fB, eF, hF, eB, hB } = rig(f.x, f.y, f.pose, s, face);

  const flash = f.flash > 0;
  const rg = f.alive ? rageOf(f) : null;
  const col = o.solid ?? (rg ? rg.body : f.def.id === "shift" && f.lastHitBy ? DEF_BY_ID[f.lastHitBy].color : f.def.body ?? f.def.color);
  const dark = o.solid ?? shade(col, f.def.body && !rg ? 6 : -16);
  // a fighter with an outline of its own (Turbo's blue) keeps it in every form
  const ink = (!o.solid && f.def.outline) || INK;
  const deadFade = !f.alive ? clamp(1 - (f.koT - 1.5) / 1.5, 0.45, 1) : 1;
  ctx.globalAlpha = deadFade * (o.alpha ?? 1);

  // ground shadow
  if (o.shadow !== false) {
    const air = clamp((GROUND - f.y) / 300, 0, 1);
    ctx.fillStyle = `hsl(250 40% 15% / ${0.28 * (1 - air * 0.6)})`;
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND + 2, 26 * s * (1 - air * 0.4), 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const lw = 6 * s;

  if (f.jugg) drawWings(ctx, g, f, shoulder, face);
  if (rg) drawRageAura(ctx, g, f, rg, hip, head);
  const bt = g.t + (g.intro?.t ?? 0) + f.key;
  const bossPhase = rg?.kind === "phase" ? rg.step ?? 1 : 1;
  const bossPts = { hip, neck, shoulder, head, kF, fF, kB, fB, eF, hF, eB, hB };
  let bossAct: BossAct | undefined;
  if (f.def.boss && f.act && f.alive) {
    const m = f.act.move, at = f.act.t;
    const strikeLen = Math.max(0.12, m.act + m.rec * 0.5);
    const phase = at < m.wind ? "wind" : at < m.wind + strikeLen ? "strike" : "after";
    const u = phase === "wind" ? at / Math.max(0.01, m.wind) : phase === "strike" ? (at - m.wind) / strikeLen : (at - m.wind - strikeLen) / Math.max(0.1, m.rec * 0.5);
    bossAct = { kind: m.kind, id: m.id, phase, u: clamp(u, 0, 1) };
  }
  if (f.def.boss && !o.solid) drawBossDesign(ctx, f.def.boss, "back", bossPts, s, face, bt, f.alive, f.vx, bossAct, bossPhase);
  // a quest fighter (not a hybrid carrying its power) wears its own design
  const quest = isQuester(f.def.id) && !f.def.parents && !f.def.boss && !f.def.custom && !o.solid;
  let questAct: QuestAct | undefined;
  const questPaint = { glow: rg?.glow ?? f.def.glow, a: rg?.a ?? f.def.color, b: rg?.b ?? f.def.glow, nightmare: isDarkForm(rg?.kind) };
  if (quest && f.act && f.alive) {
    const m = f.act.move, at = f.act.t;
    const strikeLen = Math.max(0.12, m.act + m.rec * 0.5);
    const phase = at < m.wind ? "wind" : at < m.wind + strikeLen ? "strike" : "after";
    const u = phase === "wind" ? at / Math.max(0.01, m.wind) : phase === "strike" ? (at - m.wind) / strikeLen : 1;
    questAct = { kind: m.kind, id: m.id, phase, u: clamp(u, 0, 1) };
  }
  if (quest) drawQuestDesign(ctx, f.def.id, "back", bossPts, s, face, bt, f.alive, questAct, questPaint, f.vx);

  // scarf trailing from the neck (a boss wears its own design instead)
  const wave = Math.sin((g.t + (g.intro?.t ?? 0)) * 12 + f.key) * 4 * s;
  const gear = f.def.custom?.gear;
  if (gear === "cape") drawCape(ctx, neck, hip, face, wave, f.vx, s, o.solid ?? rg?.glow ?? f.def.glow, ink);
  if (f.def.minion && !o.solid) drawMinionGear(ctx, f.def.minion, "back", { head, neck, hip, shoulder }, s, face, wave, f.vx, ink, col);
  // Nova wears her own long hair and long pink scarf in place of the usual short one
  const nova = f.def.id === "nova" && !f.def.parents && !f.def.boss && !f.def.minion && !f.def.custom && !o.solid;
  if (nova) drawNovaLook(ctx, "back", bossPts, s, face, bt, f.alive, f.vx, rg?.power === "nova");
  if (!f.def.boss && !quest && !nova && !f.def.minion && (!gear || gear === "scarf")) {
  const sx = -face * (16 + Math.abs(f.vx) * 0.03) * s;
  ctx.beginPath();
  ctx.moveTo(neck.x, neck.y + 2 * s);
  ctx.quadraticCurveTo(neck.x + sx * 0.6, neck.y + wave, neck.x + sx * 1.5, neck.y + 6 * s - wave);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7 * s;
  ctx.stroke();
  ctx.strokeStyle = o.solid ?? rg?.glow ?? f.def.glow;
  ctx.lineWidth = 4 * s;
  ctx.stroke();
  }

  limb(ctx, [hip, kB, fB], dark, lw, flash, ink);
  limb(ctx, [shoulder, eB, hB], dark, lw, flash, ink);
  limb(ctx, [hip, neck], col, lw * 1.35, flash, ink);
  limb(ctx, [hip, kF, fF], col, lw, flash, ink);
  limb(ctx, [shoulder, eF, hF], col, lw, flash, ink);

  // power glow on the hand while acting
  if (f.act && f.alive) {
    const lk = LOOKS[f.act.move.id];
    const pc = rg ? { glow: rg.b, color: rg.a } : lk ? { glow: lk.b, color: lk.a } : DEF_BY_ID[f.act.power];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const r = (10 + Math.sin(g.t * 30) * 2) * s;
    const grd = ctx.createRadialGradient(hF.x, hF.y, 0, hF.x, hF.y, r * 2);
    grd.addColorStop(0, pc.glow);
    grd.addColorStop(1, shade(pc.color, 0, 0));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(hF.x, hF.y, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // fists
  for (const hp of [hB, hF]) {
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, 4.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = flash ? "white" : col;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();
  }
  // head
  ctx.beginPath();
  ctx.arc(head.x, head.y, HEAD * s, 0, Math.PI * 2);
  ctx.fillStyle = flash ? "white" : col;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3 * s;
  ctx.stroke();
  // eye
  const blind = f.status.blind > g.t;
  const ex = head.x + face * 5 * s, ey = head.y - 1.5 * s;
  if (!f.alive) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(ex - 3 * s, ey - 3 * s); ctx.lineTo(ex + 3 * s, ey + 3 * s);
    ctx.moveTo(ex + 3 * s, ey - 3 * s); ctx.lineTo(ex - 3 * s, ey + 3 * s);
    ctx.stroke();
  } else if (blind) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(ex - 3.5 * s, ey); ctx.lineTo(ex + 3.5 * s, ey);
    ctx.stroke();
  } else if (!quest) {
    // a minion's eye glows in its boss's colour
    ctx.fillStyle = f.def.minion && !o.solid ? f.def.minion.mark : "white";
    ctx.beginPath();
    ctx.ellipse(ex, ey, 3.6 * s, 4.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + face * 1.3 * s, ey + 0.5 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (nova) drawNovaLook(ctx, "front", bossPts, s, face, bt, f.alive, f.vx, rg?.power === "nova");
  if ((gear === "headband" || gear === "mask") && !o.solid) drawHeadGear(ctx, gear, head, face, wave, f.vx, s, rg?.glow ?? f.def.glow, ink, f.alive && !blind);
  if (f.def.minion && !o.solid) drawMinionGear(ctx, f.def.minion, "front", { head, neck, hip, shoulder }, s, face, wave, f.vx, ink, col);
  if (f.def.boss && !o.solid) drawBossDesign(ctx, f.def.boss, "front", bossPts, s, face, bt, f.alive, f.vx, bossAct, bossPhase);
  if (quest) drawQuestDesign(ctx, f.def.id, "front", bossPts, s, face, bt, f.alive, questAct, questPaint, f.vx);
  ctx.globalAlpha = 1;

  if (!f.alive) return;
  // freeze block
  if (f.status.freeze > g.t) {
    ctx.fillStyle = "hsl(195 90% 85% / 0.45)";
    ctx.strokeStyle = "hsl(195 90% 95% / 0.9)";
    ctx.lineWidth = 2;
    const top = f.y - bodyH(f) - 8 * s;
    ctx.beginPath();
    ctx.roundRect(f.x - 26 * s, top, 52 * s, f.y - top, 6);
    ctx.fill();
    ctx.stroke();
  }
  // stun stars
  if (f.status.stun > g.t) {
    for (let i = 0; i < 3; i++) {
      const a = g.t * 6 + (i * Math.PI * 2) / 3;
      star(ctx, head.x + Math.cos(a) * 16 * s, head.y - 16 * s + Math.sin(a) * 5 * s, 5 * s, "hsl(50 100% 65%)");
    }
  }
}

/** Rage Mode around the body: Pyro's blue flame, Electro's black lightning, Aero's storm. Drawn behind the limbs. */
function drawRageAura(ctx: CanvasRenderingContext2D, g: Game, f: Fighter, rg: Rage, hip: { x: number; y: number }, head: { x: number; y: number }) {
  const s = f.scale;
  const cx = (hip.x + head.x) / 2, cy = (hip.y + head.y) / 2;
  const t = g.t + (g.cut ? g.cut.t : 0);
  ctx.save();
  // soft glow behind the body
  const grd = ctx.createRadialGradient(cx, cy, 4 * s, cx, cy, 70 * s);
  grd.addColorStop(0, shade(rg.glow, 0, 0.55));
  grd.addColorStop(1, shade(rg.glow, 0, 0));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, 70 * s, 0, Math.PI * 2);
  ctx.fill();
  if (rg.kind === "phase") {
    // a boss phase: one ring of power per phase reached, turning at the feet, with sparks rising off it
    const n = (rg.step ?? 2) - 1;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.75);
      ctx.lineWidth = 2.6 * s;
      const a0 = t * (i % 2 ? -1.8 : 1.4) + i;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y - 2 * s, (44 + i * 14) * s, (9 + i * 3) * s, 0, a0, a0 + 4.4);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3 + n * 2; i++) {
      const u = (t * 0.8 + i / (3 + n * 2)) % 1;
      ctx.fillStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.85 * (1 - u));
      ctx.beginPath();
      ctx.arc(f.x + Math.sin(i * 2.7 + t * 2) * (30 + n * 8) * s, f.y - u * (110 + n * 30) * s, (2 + (i % 3)) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.def.id === "pyro") {
    // tongues of blue fire licking up the body
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const ph = t * 9 + i * 1.7;
      const x = f.x + (i - 3) * 7 * s + Math.sin(ph) * 3 * s;
      const h = (34 + 22 * Math.abs(Math.sin(ph * 0.7 + i))) * s;
      const by = f.y - (8 + Math.abs(i - 3) * 6) * s;
      ctx.fillStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.55);
      ctx.beginPath();
      ctx.moveTo(x - 7 * s, by);
      ctx.quadraticCurveTo(x - 9 * s, by - h * 0.6, x + Math.sin(ph * 1.3) * 6 * s, by - h - 50 * s);
      ctx.quadraticCurveTo(x + 9 * s, by - h * 0.6, x + 7 * s, by);
      ctx.fill();
    }
  } else if (f.def.id === "electro") {
    // black lightning crackling around the body, white sparks inside it
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const a0 = (Math.floor(t * 14) * 2.3 + i * 1.57) % (Math.PI * 2);
      let x = cx + Math.cos(a0) * 34 * s, y = cy + Math.sin(a0) * 46 * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        const a = a0 + (j + 1) * 0.35;
        x = cx + Math.cos(a) * (30 + Math.random() * 16) * s;
        y = cy + Math.sin(a) * (40 + Math.random() * 20) * s;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = shade(rg.b, 0, 0.9);
      ctx.lineWidth = 5 * s;
      ctx.stroke();
      ctx.strokeStyle = rg.dark ?? INK;
      ctx.lineWidth = 2.5 * s;
      ctx.stroke();
    }
  } else if (rg.kind === "rage" && f.def.id === "terra") {
    // molten cracks glowing through the rock, with chunks of stone orbiting
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const y0 = cy - 40 * s + i * 22 * s;
      ctx.strokeStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.55 + 0.3 * Math.sin(t * 6 + i));
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(cx - 14 * s, y0);
      ctx.lineTo(cx - 4 * s, y0 + 6 * s);
      ctx.lineTo(cx + 5 * s, y0 - 3 * s);
      ctx.lineTo(cx + 14 * s, y0 + 5 * s);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 5; i++) {
      const an = t * 2.2 + (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(an) * 46 * s, y = cy + Math.sin(an) * 18 * s + Math.sin(t * 3 + i) * 6 * s;
      ctx.fillStyle = rg.dark ?? INK;
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y);
      ctx.lineTo(x - 2 * s, y - 6 * s);
      ctx.lineTo(x + 6 * s, y - 3 * s);
      ctx.lineTo(x + 4 * s, y + 5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(rg.b, 0, 0.8);
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
    }
  } else if (rg.kind === "awakened") {
    // a column of risen power and a halo of light over the head
    ctx.globalCompositeOperation = "lighter";
    const col = ctx.createLinearGradient(cx, f.y, cx, f.y - 180 * s);
    col.addColorStop(0, shade(rg.b, 0, 0.42));
    col.addColorStop(1, shade(rg.b, 0, 0));
    ctx.fillStyle = col;
    const wv = (26 + Math.sin(t * 8) * 4) * s;
    ctx.fillRect(cx - wv, f.y - 180 * s, wv * 2, 180 * s);
    ctx.strokeStyle = shade(rg.b, 0, 0.85);
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.ellipse(head.x, head.y - 22 * s, 16 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const u = ((t * 0.9 + i / 5) % 1);
      ctx.fillStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.9 * (1 - u));
      ctx.beginPath();
      ctx.arc(cx + Math.sin(i * 2.1 + t * 3) * 22 * s, f.y - u * 160 * s, (2.5 + (i % 3)) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (rg.kind === "mastery") {
    // calm rings turning at the feet and three blades of focus circling the body
    ctx.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = shade(i ? rg.a : rg.b, 0, 0.8);
      ctx.lineWidth = 2.5 * s;
      const a0 = t * (i ? -2 : 1.5);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y - 2 * s, (38 + i * 12) * s, (8 + i * 3) * s, 0, a0, a0 + 4.6);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const an = t * 2.6 + (i / 3) * Math.PI * 2;
      const x = cx + Math.cos(an) * 44 * s, y = cy + Math.sin(an) * 30 * s;
      ctx.fillStyle = shade(rg.b, 0, 0.95);
      ctx.beginPath();
      ctx.moveTo(x, y - 8 * s);
      ctx.lineTo(x + 4 * s, y);
      ctx.lineTo(x, y + 8 * s);
      ctx.lineTo(x - 4 * s, y);
      ctx.closePath();
      ctx.fill();
    }
  } else if (rg.kind === "super" || rg.kind === "hyper") {
    // Super Form: golden sparkles twinkling round the body; Hyper Form: the same, cycling through every colour
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 8; i++) {
      const an = t * 1.7 + i * 0.79;
      const tw = Math.max(0, Math.sin(t * 6 + i * 1.9));
      if (tw < 0.05) continue;
      const x = cx + Math.cos(an) * (30 + (i % 3) * 10) * s, y = cy + Math.sin(an * 1.3) * 52 * s;
      const col = rg.kind === "hyper" ? `hsl(${Math.floor((t * 200 + i * 45) % 360)} 100% 78%)` : i % 2 ? rg.b : rg.a;
      const r = (4 + 5 * tw) * s;
      ctx.fillStyle = shade(col, 0, 0.95 * tw);
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2, rr = j % 2 ? r * 0.25 : r;
        j ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
    // a flickering light rising off the body like a flame
    const fl = ctx.createLinearGradient(cx, f.y, cx, f.y - 150 * s);
    const top = rg.kind === "hyper" ? `hsl(${Math.floor((t * 160) % 360)} 100% 80%)` : rg.b;
    fl.addColorStop(0, shade(rg.a, 0, 0.32));
    fl.addColorStop(1, shade(top, 0, 0));
    ctx.fillStyle = fl;
    const fw = (22 + Math.sin(t * 11) * 4) * s;
    ctx.fillRect(cx - fw, f.y - 150 * s, fw * 2, 150 * s);
  } else if (isDarkForm(rg.kind)) {
    // black smoke pouring upward with the form's colour flickering through it, and a jagged dark halo
    for (let i = 0; i < 9; i++) {
      const ph = (t * 1.6 + i / 9) % 1;
      const x = f.x + Math.sin(i * 2.3 + t * 3) * 22 * s;
      const y = f.y - ph * 120 * s;
      const r = (14 + 10 * Math.sin(i)) * s * (1 - ph * 0.5);
      ctx.fillStyle = shade(rg.dark ?? rg.body, 0, 0.55 * (1 - ph));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = shade(Math.floor(t * 12) % 3 ? rg.b : rg.a, 0, 0.8);
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const an = (i / 18) * Math.PI * 2;
      const rr = (58 + (i % 2 ? -10 : 8) + Math.sin(t * 9 + i) * 4) * s;
      const px = cx + Math.cos(an) * rr, py = cy + Math.sin(an) * rr * 1.15;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  } else if (rg.kind === "mystic") {
    // a turning rune circle behind the body
    runeCircle(ctx, cx, cy, 58 * s, t, rg.a, rg.b, 0.75);
  } else if (f.def.id === "aero") {
    // a ring of storm wind spinning around the fighter
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const ry = cy - 34 * s + i * 32 * s;
      const rx = (40 + i * 6) * s;
      const a0 = t * (9 + i * 2) + i * 2;
      ctx.strokeStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.85);
      ctx.lineWidth = (4 - i * 0.6) * s;
      ctx.beginPath();
      ctx.ellipse(cx, ry, rx, 9 * s, 0, a0, a0 + 2.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A turning circle of runes: two rings, tick marks and glyphs, for Mystic Mode. */
function runeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, a: string, b: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = Math.max(1.5, r * 0.035);
  ctx.strokeStyle = shade(b, 0, alpha);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = shade(a, 0, alpha);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(t * 0.8);
  for (let i = 0; i < 12; i++) {
    const an = (i / 12) * Math.PI * 2;
    ctx.strokeStyle = shade(i % 2 ? a : b, 0, alpha);
    ctx.beginPath();
    ctx.moveTo(Math.cos(an) * r * 0.8, Math.sin(an) * r * 0.8);
    ctx.lineTo(Math.cos(an) * r * 0.97, Math.sin(an) * r * 0.97);
    ctx.stroke();
  }
  // a star drawn through the inner ring, turning the other way
  ctx.rotate(-t * 1.9);
  ctx.strokeStyle = shade(b, 0, alpha * 0.8);
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const an = (i * 2 * (Math.PI * 2)) / 5 - Math.PI / 2;
    const px = Math.cos(an) * r * 0.76, py = Math.sin(an) * r * 0.76;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

/** A pair of feathered wings in the fighter's element colours, flapping from the shoulders. */
function drawWings(ctx: CanvasRenderingContext2D, g: Game, f: Fighter, shoulder: { x: number; y: number }, face: number) {
  const s = f.scale;
  const dir = -face;
  const flap = f.alive ? Math.sin(g.t * 8 + f.key * 1.3) : -0.6;
  const col = f.def.color, glow = f.def.glow;
  for (const far of [true, false]) {
    const L = (far ? 56 : 68) * s;
    const phi = (far ? 0.85 : 0.6) + flap * 0.5;
    const bx = shoulder.x + dir * 2 * s, by = shoulder.y + 3 * s;
    const tx = bx + dir * Math.cos(phi) * L, ty = by - Math.sin(phi) * L;
    const rx = bx + dir * 8 * s, ry = by + 12 * s;
    const pts: { x: number; y: number }[] = [];
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      pts.push({ x: tx + (rx - tx) * k, y: ty + (ry - ty) * k + Math.sin(k * Math.PI) * 30 * s });
    }
    const fill = ctx.createLinearGradient(bx, by, tx, ty);
    fill.addColorStop(0, shade(col, far ? -18 : -6));
    fill.addColorStop(1, shade(glow, far ? -14 : 0));
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + dir * L * 0.3, ty - 4 * s, tx, ty);
    let px = tx, py = ty;
    for (const p of pts) {
      ctx.quadraticCurveTo((px + p.x) / 2 + dir * 3 * s, Math.max(py, p.y) + 11 * s, p.x, p.y);
      px = p.x; py = p.y;
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    // feather veins
    ctx.strokeStyle = shade(col, -26, 0.7);
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    for (const p of pts.slice(0, -1)) { ctx.moveTo(bx + (tx - bx) * 0.25, by + (ty - by) * 0.25); ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    if (!far && f.alive) {
      // glowing leading edge
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = shade(glow, 0, 0.55);
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + dir * L * 0.3, ty - 4 * s, tx, ty);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string) {
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A move's colours for the plain drawings: its own look's when it has one, else its element's. */
function colsOf(id: string | undefined, power: Power) {
  const lk = id ? LOOKS[id] : undefined;
  return lk ? { color: lk.a, glow: lk.b } : DEF_BY_ID[power];
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, t: number) {
  if (drawShotLook(ctx, p.move.id, p, t)) return;
  const def = colsOf(p.move.id, p.power);
  const ang = Math.atan2(p.vy, p.vx);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glowDot(ctx, p.x, p.y, p.r * 2.4, shade(def.glow, 0, 0.55), shade(def.color, 0, 0));
  ctx.restore();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  switch (p.shape) {
    case "shard":
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(p.r * 1.8, 0); ctx.lineTo(0, p.r * 0.55); ctx.lineTo(-p.r * 1.2, 0); ctx.lineTo(0, -p.r * 0.55);
      ctx.closePath();
      ctx.fillStyle = def.glow;
      ctx.fill();
      ctx.stroke();
      break;
    case "rock":
      ctx.rotate(p.rot);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const rr = p.r * (0.8 + ((i * 37) % 5) * 0.07);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = p.power === "terra" ? DEF_BY_ID.terra.color : "hsl(20 30% 40%)";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "hsl(30 30% 70% / 0.6)";
      ctx.beginPath();
      ctx.arc(-p.r * 0.25, -p.r * 0.25, p.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "blade":
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.arc(-p.r * 0.6, 0, p.r * 1.4, -1.1, 1.1);
      ctx.arc(-p.r * 1.1, 0, p.r * 1.3, 1.0, -1.0, true);
      ctx.closePath();
      ctx.fillStyle = def.glow;
      ctx.fill();
      ctx.stroke();
      break;
    case "wave": {
      const dir = p.vx >= 0 ? 1 : -1;
      ctx.scale(dir, 1);
      ctx.beginPath();
      ctx.moveTo(-p.r * 0.6, -p.r * 1.6);
      ctx.quadraticCurveTo(p.r * 1.3, 0, -p.r * 0.6, p.r * 1.6);
      ctx.quadraticCurveTo(p.r * 0.3, 0, -p.r * 0.6, -p.r * 1.6);
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = def.glow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-p.r * 0.3, -p.r * 1.1);
      ctx.quadraticCurveTo(p.r * 0.8, 0, -p.r * 0.3, p.r * 1.1);
      ctx.stroke();
      break;
    }
    case "disc":
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.2, p.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.glow;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 0.5, p.r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-p.r * 0.2, -p.r * 0.2, p.r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = def.glow;
      ctx.fill();
      if (p.power === "electro") {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
          ctx.lineTo(Math.cos(a + 0.3) * p.r * 1.7, Math.sin(a + 0.3) * p.r * 1.7);
          ctx.stroke();
        }
      }
  }
  ctx.restore();
}

function drawBeam(ctx: CanvasRenderingContext2D, b: Beam, t: number) {
  const def = colsOf(b.look, b.power);
  const a = clamp(b.life / b.max, 0, 1);
  if (b.look && drawBeamLook(ctx, b.look, b, a, t)) return;
  const ex = b.x + Math.cos(b.ang) * b.len, ey = b.y + Math.sin(b.ang) * b.len;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    if (b.jag) {
      const n = Math.max(4, Math.floor(b.len / 30));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const off = rand(-14, 14);
        ctx.lineTo(b.x + (ex - b.x) * t - Math.sin(b.ang) * off, b.y + (ey - b.y) * t + Math.cos(b.ang) * off);
      }
    }
    ctx.lineTo(ex, ey);
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = a;
  path();
  ctx.strokeStyle = shade(def.color, 0, 0.45);
  ctx.lineWidth = b.width * 1.8;
  ctx.stroke();
  ctx.strokeStyle = def.glow;
  ctx.lineWidth = b.width * 0.7;
  ctx.stroke();
  ctx.strokeStyle = "white";
  ctx.lineWidth = b.width * 0.25;
  ctx.stroke();
  glowDot(ctx, b.x, b.y, b.width * 1.6, "white", shade(def.color, 0, 0));
  glowDot(ctx, ex, ey, b.width * 1.2, def.glow, shade(def.color, 0, 0));
  ctx.restore();
}

function drawZone(ctx: CanvasRenderingContext2D, g: Game, z: Zone) {
  const def = colsOf(z.move.id, z.power);
  const r = z.move.radius ?? 100;
  const a = clamp(Math.min(z.life, z.max - z.life) * 4, 0, 1);
  if (drawZoneLook(ctx, z.move.id, z.x, GROUND, r, a, g.t)) return;
  ctx.save();
  ctx.globalAlpha = a;
  if (z.move.pullIn) {
    const cy = GROUND - 60;
    glowDot(ctx, z.x, cy, r * 0.9, shade(def.glow, 0, 0.5), shade(def.color, 0, 0));
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(z.x, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.glow;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const rr = ((g.t * 70 + i * 30) % 90) + 10;
      ctx.globalAlpha = a * (1 - rr / 100);
      ctx.beginPath();
      ctx.arc(z.x, cy, 100 - rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const dome = ctx.createRadialGradient(z.x, GROUND, 0, z.x, GROUND, r);
    const dark = z.power === "umbra";
    dome.addColorStop(0, dark ? "hsl(270 50% 12% / 0.75)" : shade(def.color, 0, 0.45));
    dome.addColorStop(1, shade(def.color, 0, 0));
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.ellipse(z.x, GROUND, r, r * 0.75, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = def.glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(z.x, GROUND + 2, r, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (z.power === "chrono") {
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 4;
      const cy = GROUND - r * 0.4;
      ctx.beginPath();
      ctx.arc(z.x, cy, 22, 0, Math.PI * 2);
      ctx.moveTo(z.x, cy);
      ctx.lineTo(z.x + Math.cos(g.t * 4) * 16, cy + Math.sin(g.t * 4) * 16);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawEruption(ctx: CanvasRenderingContext2D, e: Eruption) {
  const def = DEF_BY_ID[e.power];
  const own = eruptionColors(e.move.id);
  const col = own?.a ?? def.color, glo = own?.b ?? def.glow;
  const r = e.move.radius ?? 44;
  if (!e.fired) {
    const pulse = 0.5 + 0.5 * Math.sin(e.t * 40);
    ctx.fillStyle = shade(col, 0, 0.3 + pulse * 0.3);
    ctx.beginPath();
    ctx.ellipse(e.x, GROUND + 2, r, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = glo;
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }
  const t = e.t - 0.3;
  const grow = clamp(t / 0.1, 0, 1);
  const fade = clamp(1 - (t - 0.3) / 0.25, 0, 1);
  const h = 190 * grow;
  ctx.save();
  ctx.globalAlpha = fade;
  if (drawEruptionLook(ctx, e.move.id, e.x, GROUND, r, h, e.t)) { ctx.restore(); return; }
  if (e.power === "terra" || e.power === "cryo") {
    const fill = e.power === "terra" ? def.color : def.glow;
    for (const [dx, sc] of [[-r * 0.55, 0.6], [r * 0.55, 0.7], [0, 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(e.x + dx - r * 0.5 * sc, GROUND + 4);
      ctx.lineTo(e.x + dx, GROUND - h * sc);
      ctx.lineTo(e.x + dx + r * 0.5 * sc, GROUND + 4);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  } else {
    ctx.globalCompositeOperation = "lighter";
    const col = ctx.createLinearGradient(0, GROUND, 0, GROUND - h);
    col.addColorStop(0, def.glow);
    col.addColorStop(0.6, shade(def.color, 0, 0.7));
    col.addColorStop(1, shade(def.color, 0, 0));
    ctx.fillStyle = col;
    const wob = Math.sin(e.t * 50) * 4;
    ctx.beginPath();
    ctx.ellipse(e.x, GROUND - h / 2, r * 0.7 + wob, h / 2 + 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade("hsl(0 0% 100%)", 0, 0.6);
    ctx.beginPath();
    ctx.ellipse(e.x, GROUND - h / 2, r * 0.22, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const a = clamp(p.life / p.max, 0, 1);
  ctx.globalAlpha = p.shape === "smoke" ? a * 0.55 : a;
  ctx.globalCompositeOperation = p.add ? "lighter" : "source-over";
  switch (p.shape) {
    case "dot":
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
      break;
    case "smoke":
      ctx.fillStyle = "hsl(270 45% 14%)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (2 - a), 0, Math.PI * 2);
      ctx.fill();
      break;
    case "spark": {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const len = Math.min(18, sp * 0.04) + 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
      ctx.stroke();
      break;
    }
    case "shard":
    case "chunk":
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.shape === "shard") { ctx.moveTo(p.size, 0); ctx.lineTo(0, p.size * 0.4); ctx.lineTo(-p.size, 0); ctx.lineTo(0, -p.size * 0.4); }
      else ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      break;
    case "ring":
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.rot === 1 ? 6 * a : 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.rot === 1 || p.size > 14 ? p.size * (1.1 - a * 0.6) : p.size, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "plus":
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size, p.y - p.size * 0.3, p.size * 2, p.size * 0.6);
      ctx.fillRect(p.x - p.size * 0.3, p.y - p.size, p.size * 0.6, p.size * 2);
      break;
    default:
      drawSpark(ctx, p.shape, p.x, p.y, p.size, p.rot, p.color, a, p.vx, p.vy);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

export function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = "center") {
  ctx.font = `700 ${size}px Fredoka, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(4, size * 0.18);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.duel) {
    const bw = 380, bh = 24, top = 24;
    g.fighters.forEach((f, i) => {
      const left = i === 0;
      const x0 = left ? 30 : W - 30 - bw;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(x0 - 4, top - 4, bw + 8, bh + 8, 8);
      ctx.fill();
      ctx.fillStyle = "hsl(250 20% 30%)";
      ctx.fillRect(x0, top, bw, bh);
      const trail = (bw * Math.max(0, f.hpTrail)) / f.maxHp;
      const cur = (bw * Math.max(0, f.hp)) / f.maxHp;
      ctx.fillStyle = "hsl(0 85% 60%)";
      ctx.fillRect(left ? x0 + bw - trail : x0, top, trail, bh);
      const grd = ctx.createLinearGradient(0, top, 0, top + bh);
      grd.addColorStop(0, shade(f.def.glow, 4));
      grd.addColorStop(1, f.def.color);
      ctx.fillStyle = grd;
      ctx.fillRect(left ? x0 + bw - cur : x0, top, cur, bh);
      ctx.fillStyle = "hsl(0 0% 100% / 0.35)";
      ctx.fillRect(x0, top + 3, bw, 4);
      // a boss's bar is notched where each of its phases begins
      const phases = f.def.boss ? BOSS_PHASES[f.def.boss] : undefined;
      if (phases) {
        ctx.fillStyle = INK;
        for (const ph of phases) ctx.fillRect((left ? x0 + bw - bw * ph.at : x0 + bw * ph.at) - 1.5, top, 3, bh);
      }
      outlinedText(ctx, hudName(f), left ? x0 : x0 + bw, top + bh + 22, 22, "white", left ? "left" : "right");
      outlinedText(ctx, `${Math.ceil(Math.max(0, f.hp))}`, left ? x0 + bw - 10 : x0 + 10, top + bh / 2 + 1, 16, "white", left ? "right" : "left");
    });
    ctx.fillStyle = "hsl(46 100% 62%)";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W / 2, top - 8); ctx.lineTo(W / 2 + 34, top + 12); ctx.lineTo(W / 2, top + 32); ctx.lineTo(W / 2 - 34, top + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    outlinedText(ctx, "VS", W / 2, top + 12, 20, "white");
  } else {
    const boss = g.fighters.find((f) => f.jugg);
    if (boss) drawBossBar(ctx, boss);
  }
}

/** Health bars and names over heads, drawn inside the camera so they stay on their fighters. */
function drawHeadBars(ctx: CanvasRenderingContext2D, g: Game) {
  {
    for (const f of g.fighters) {
      if (!f.alive || f.jugg || arriving(g, f)) continue;
      const bw = 46 * f.scale, y = f.y - bodyH(f) - 24 * f.scale;
      const tc = f.team >= 0 ? TEAM_COLORS[f.team % TEAM_COLORS.length] : null;
      ctx.fillStyle = INK;
      ctx.fillRect(f.x - bw / 2 - 2, y - 2, bw + 4, 9);
      if (tc) { ctx.strokeStyle = tc; ctx.lineWidth = 2; ctx.strokeRect(f.x - bw / 2 - 3, y - 3, bw + 6, 11); }
      ctx.fillStyle = "hsl(0 85% 60%)";
      ctx.fillRect(f.x - bw / 2, y, (bw * f.hpTrail) / f.maxHp, 5);
      ctx.fillStyle = f.def.color;
      ctx.fillRect(f.x - bw / 2, y, (bw * Math.max(0, f.hp)) / f.maxHp, 5);
      outlinedText(ctx, hudName(f), f.x, y - 12, 15, tc ?? "white");
    }
  }
}

/** The juggernaut's long health bar across the top of the arena. */
function drawBossBar(ctx: CanvasRenderingContext2D, f: Fighter) {
  const bw = 520, bh = 22, x0 = (W - bw) / 2, top = 22;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x0 - 5, top - 5, bw + 10, bh + 10, 9);
  ctx.fill();
  ctx.fillStyle = "hsl(250 20% 30%)";
  ctx.fillRect(x0, top, bw, bh);
  ctx.fillStyle = "hsl(0 85% 60%)";
  ctx.fillRect(x0, top, (bw * Math.max(0, f.hpTrail)) / f.maxHp, bh);
  const grd = ctx.createLinearGradient(0, top, 0, top + bh);
  grd.addColorStop(0, shade(f.def.glow, 4));
  grd.addColorStop(1, f.def.color);
  ctx.fillStyle = grd;
  ctx.fillRect(x0, top, (bw * Math.max(0, f.hp)) / f.maxHp, bh);
  ctx.fillStyle = "hsl(0 0% 100% / 0.35)";
  ctx.fillRect(x0, top + 3, bw, 4);
  // a notch at half: the health it would have without the juggernaut bonus
  ctx.fillStyle = INK;
  ctx.fillRect(x0 + bw / 2 - 1.5, top, 3, bh);
  outlinedText(ctx, `JUGGERNAUT  ${f.def.name.toUpperCase()}`, x0, top + bh + 20, 18, f.def.glow, "left");
  outlinedText(ctx, `${Math.ceil(Math.max(0, f.hp))} / ${f.maxHp}`, x0 + bw, top + bh + 20, 16, "white", "right");
}

/** A team-coloured disc on the floor under a fighter, shrinking as they rise. */
function drawTeamRing(ctx: CanvasRenderingContext2D, f: Fighter) {
  const lift = clamp((GROUND - f.y) / 300, 0, 0.7);
  const rx = 30 * f.scale * (1 - lift), ry = 8 * f.scale * (1 - lift);
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = TEAM_COLORS[f.team % TEAM_COLORS.length];
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(f.x, GROUND + 4, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Moves drawn next take their owner's rage colours, if they are raging. */
function tintBy(f: Fighter | undefined) {
  const r = rageOf(f);
  setLookTint(r ? { a: r.a, b: r.b } : null);
}

// ---------- living backdrops ----------
// A backdrop is painted once, so what moves in it (clouds sliding by, rain, embers, snow, spores,
// twinkling stars, mist along the floor) is drawn live on top of it, behind the fighters.

/** What drifts through the air over a backdrop. */
export type Air = {
  motes?: "embers" | "snow" | "rain" | "spores" | "bubbles" | "dust" | "ash" | "confetti" | "sparks";
  /** Hue of the motes, where it is theirs to choose (embers, spores, sparks, dust). */
  hue?: number;
  /** Cloud wisps sliding across the sky, in this colour (an `hsl(h s% l%)` without alpha). */
  clouds?: string;
  /** Stars blinking in the sky. */
  twinkle?: boolean;
  /** Mist rolling along the horizon, in this colour. */
  mist?: string;
  /** Hot air shimmering over the ground. */
  heat?: boolean;
  /** How thick it all is, 0.3 to 1.5 (1 by default). */
  amount?: number;
};

const airOf = new WeakMap<HTMLCanvasElement, Air>();
/** Gives a painted backdrop its moving air. Returns the same canvas. */
export function setAir(backdrop: HTMLCanvasElement, air: Air): HTMLCanvasElement {
  airOf.set(backdrop, air);
  return backdrop;
}

const HORIZON = 440;
const airSprites = new Map<string, HTMLCanvasElement>();
function airSprite(key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  let s = airSprites.get(key);
  if (!s) {
    s = document.createElement("canvas");
    s.width = w;
    s.height = h;
    paint(s.getContext("2d")!);
    airSprites.set(key, s);
  }
  return s;
}
const withAlpha = (col: string, a: number) => col.replace(")", ` / ${a})`);
const hash = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
let stillAir: boolean | null = null;
/** Seconds on the wall clock, so the air keeps moving through pauses and intros; frozen for reduced motion. */
function airClock() {
  if (stillAir === null) stillAir = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return stillAir ? 0 : performance.now() / 1000;
}

function drawAir(ctx: CanvasRenderingContext2D, air: Air) {
  const t = airClock();
  const k = air.amount ?? 1;
  ctx.save();
  if (air.twinkle) {
    ctx.globalCompositeOperation = "lighter";
    const n = Math.round(22 * k);
    for (let i = 0; i < n; i++) {
      const x = hash(i, 1) * W, y = hash(i, 2) * (HORIZON - 120);
      const tw = Math.max(0, Math.sin(t * (0.8 + hash(i, 3) * 1.6) + i * 2.3));
      if (tw < 0.05) continue;
      ctx.globalAlpha = tw * 0.85;
      ctx.fillStyle = i % 4 ? "hsl(210 100% 94%)" : "hsl(46 100% 86%)";
      const r = 0.8 + tw * 2.2;
      ctx.fillRect(x - r * 2, y - 0.5, r * 4, 1);
      ctx.fillRect(x - 0.5, y - r * 2, 1, r * 4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  if (air.clouds) {
    const col = air.clouds;
    const puff = airSprite(`cloud:${col}`, 260, 90, (c) => {
      for (const [x, y, rx, ry] of [[130, 52, 110, 26], [92, 40, 52, 30], [160, 34, 60, 30], [200, 54, 46, 20]] as const) {
        const gr = c.createRadialGradient(x, y, 0, x, y, rx);
        gr.addColorStop(0, withAlpha(col, 0.75));
        gr.addColorStop(1, withAlpha(col, 0));
        c.fillStyle = gr;
        c.save();
        c.translate(x, y);
        c.scale(1, ry / rx);
        c.translate(-x, -y);
        c.fillRect(x - rx, y - rx, rx * 2, rx * 2);
        c.restore();
      }
    });
    const n = Math.max(2, Math.round(4 * k));
    for (let i = 0; i < n; i++) {
      const s = 0.6 + hash(i, 4) * 0.7;
      const span = W + 300 * s;
      const x = ((hash(i, 5) * span + t * (6 + hash(i, 6) * 10)) % span) - 260 * s;
      const y = 30 + hash(i, 7) * 220;
      ctx.globalAlpha = 0.65 + hash(i, 8) * 0.35;
      ctx.drawImage(puff, x, y, 260 * s, 90 * s);
    }
    ctx.globalAlpha = 1;
  }
  if (air.mist) {
    const col = air.mist;
    const band = airSprite(`mist:${col}`, 420, 80, (c) => {
      const gr = c.createRadialGradient(210, 40, 0, 210, 40, 210);
      gr.addColorStop(0, withAlpha(col, 0.5));
      gr.addColorStop(1, withAlpha(col, 0));
      c.fillStyle = gr;
      c.save();
      c.scale(1, 80 / 420);
      c.fillRect(0, 0, 420, 420);
      c.restore();
    });
    for (let i = 0; i < 5; i++) {
      const span = W + 420;
      const dir = i % 2 ? -1 : 1;
      const x = ((((hash(i, 9) * span + dir * t * (8 + i * 3)) % span) + span) % span) - 420;
      ctx.globalAlpha = (0.55 + 0.3 * Math.sin(t * 0.4 + i)) * Math.min(1, k);
      ctx.drawImage(band, x, HORIZON - 70 + (i % 3) * 18, 420, 80);
    }
    ctx.globalAlpha = 1;
  }
  if (air.heat) {
    ctx.globalAlpha = 0.14 * k;
    ctx.strokeStyle = "hsl(40 100% 92%)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = HORIZON - 16 - i * 22;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.03 + t * 4 + i) * 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const kind = air.motes;
  if (kind) {
    const hue = air.hue ?? 30;
    const bottom = GROUND + 20;
    const count = { embers: 34, snow: 60, rain: 70, spores: 30, bubbles: 14, dust: 26, ash: 34, confetti: 18, sparks: 26 }[kind];
    const n = Math.round(count * k);
    if (kind === "embers" || kind === "sparks" || kind === "spores") ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const a = hash(i, 10), b = hash(i, 11), c2 = hash(i, 12);
      if (kind === "rain") {
        const sp = 520 + b * 260;
        const y = ((a * bottom + t * sp) % (bottom + 40)) - 40;
        const x = ((c2 * (W + 120) - y * 0.28) % (W + 120) + W + 120) % (W + 120) - 60;
        ctx.strokeStyle = `hsl(205 40% 86% / ${0.18 + b * 0.22})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 7, y + 22);
        ctx.stroke();
        continue;
      }
      // everything else floats: up (embers, sparks, spores, bubbles) or down (snow, ash, confetti), swaying as it goes
      const up = kind === "embers" || kind === "sparks" || kind === "spores" || kind === "bubbles" || kind === "dust";
      const sp = { embers: 34, sparks: 60, spores: 10, bubbles: 22, dust: 7, snow: 26, ash: 18, confetti: 40 }[kind] * (0.6 + b * 0.8);
      const range = bottom + 40;
      let y = (a * range + t * sp) % range;
      y = up ? bottom - y : y - 20;
      const sway = Math.sin(t * (0.6 + c2) + i * 1.7) * (kind === "snow" || kind === "confetti" ? 18 : 10);
      const x = c2 * W + sway;
      if (kind === "embers" || kind === "sparks") {
        const life = up ? Math.min(1, (bottom - y) / 80) * Math.min(1, y / 120) : 1;
        const flick = 0.55 + 0.45 * Math.sin(t * 9 + i * 3.1);
        ctx.fillStyle = `hsl(${hue + b * 24} 100% ${kind === "sparks" ? 78 : 62}% / ${0.75 * life * flick})`;
        const r = kind === "sparks" ? 1.2 : 1.4 + b * 1.6;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      } else if (kind === "spores" || kind === "dust") {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + i * 2.2);
        ctx.fillStyle = `hsl(${hue} ${kind === "dust" ? 70 : 90}% ${kind === "dust" ? 86 : 70}% / ${(kind === "dust" ? 0.3 : 0.45) * pulse})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + b * 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "bubbles") {
        ctx.strokeStyle = `hsl(${hue} 90% 86% / 0.45)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 5 + b * 9, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === "confetti") {
        const cols = ["hsl(14 92% 58%)", "hsl(198 88% 58%)", "hsl(50 96% 58%)", "hsl(140 58% 50%)", "hsl(274 58% 60%)"];
        ctx.fillStyle = cols[i % cols.length];
        ctx.globalAlpha = 0.9;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (2 + b * 3) + i);
        ctx.scale(1, Math.sin(t * 4 + i));
        ctx.fillRect(-5, -3, 10, 6);
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        // snow and ash
        ctx.fillStyle = kind === "snow" ? `hsl(210 60% 98% / ${0.5 + b * 0.4})` : `hsl(${hue} 10% 70% / ${0.35 + b * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, (kind === "snow" ? 1.2 : 1) + b * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, g: Game, backdrop: HTMLCanvasElement) {
  ctx.save();
  if (g.shake > 0) ctx.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake) * 0.6);
  ctx.translate(g.kick.x, g.kick.y);
  const cut = g.cut;
  const hero = cut ? g.fighters[cut.key] : null;
  const ck = cut ? cut.t / cut.max : 0;
  // the fight camera; a rage cutscene pushes in on the raging fighter, then pulls back out
  let zoom = g.cam.z, fx = g.cam.x, fy = g.cam.y;
  if (hero) {
    const cz = 1 + 0.45 * Math.min(1, ck / 0.18) * Math.min(1, (1 - ck) / 0.12);
    const c = center(hero);
    const w = cz - 1 > zoom - 1 ? 1 : 0;
    if (w) { zoom = cz; fx = c.x; fy = c.y; }
  }
  if (zoom > 1.001) {
    fx = clamp(fx, W / (2 * zoom), W - W / (2 * zoom));
    fy = clamp(fy, H / (2 * zoom), H - H / (2 * zoom));
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-fx, -fy);
  }
  ctx.drawImage(backdrop, -12, -8, W + 24, H + 16);
  const air = airOf.get(backdrop);
  if (air) drawAir(ctx, air);
  drawRealm(ctx, g);
  if (g.eclipseUntil > g.t) drawEclipse(ctx, g);
  if (g.marks.length) drawMarks(ctx, g.marks, GROUND, g.t + (g.intro?.t ?? 0));
  for (const z of g.zones) { tintBy(g.fighters[z.owner]); drawZone(ctx, g, z); }
  for (const e of g.eruptions) if (!e.fired) { tintBy(g.fighters[e.owner]); drawEruption(ctx, e); }
  setLookTint(null);
  for (const f of g.fighters) if (f.alive && f.team >= 0 && !arriving(g, f)) drawTeamRing(ctx, f);
  if (g.intro) for (const f of g.fighters) drawIntroLayer(ctx, g, f, "back");
  for (const f of g.fighters) if (!f.alive) drawFighter(ctx, g, f);
  for (const f of g.fighters) if (f.alive && f !== hero) drawGhosts(ctx, f);
  for (const f of g.fighters) if (f.alive && f !== hero) { if (g.intro) drawIntroFighter(ctx, g, f); else drawFighter(ctx, g, f); }
  for (const f of g.fighters) if (f.alive) drawTrail(ctx, f);
  if (g.intro) for (const f of g.fighters) drawIntroLayer(ctx, g, f, "front");
  for (const f of g.fighters) {
    const a = f.act;
    if (f.alive && a && a.move.kind === "dash" && a.fired && a.t < a.move.wind + a.move.act) { tintBy(f); drawRushLook(ctx, a.move.id, f.x, f.y, f.scale, f.facing, g.t); }
  }
  for (const e of g.eruptions) if (e.fired) { tintBy(g.fighters[e.owner]); drawEruption(ctx, e); }
  for (const p of g.projectiles) { tintBy(g.fighters[p.owner]); drawProjectile(ctx, p, g.t); }
  for (const b of g.beams) { tintBy(g.fighters[b.owner]); drawBeam(ctx, b, g.t); }
  setLookTint(null);
  if (hero) drawCutBackdrop(ctx, hero, ck, g.t + (cut?.t ?? 0));
  if (hero) { drawGhosts(ctx, hero); drawFighter(ctx, g, hero); }
  if (hero?.form && (hero.form.kind === "super" || hero.form.kind === "hyper")) drawEmeralds(ctx, hero, hero.form, ck, g.t + (cut?.t ?? 0), "front");
  for (const a of g.annis) {
    const owner = g.fighters[a.owner];
    drawAnnihilation(ctx, a.move.id, a.x, a.y, (a.move.radius ?? 70) * (owner?.scale ?? 1), a.t / ANNI_TIME, g.t);
  }
  // a crushing blow darkens the frame for an instant so the impact pops
  const frame = g.impacts.find((x) => x.heavy && x.life / x.max > 0.72);
  if (frame && !g.demo && g.fighters.length <= 4) {
    ctx.fillStyle = `hsl(255 45% 6% / ${0.3 * ((frame.life / frame.max - 0.72) / 0.28)})`;
    ctx.fillRect(-W, -H, W * 3, H * 3);
  }
  for (const x of g.fx) drawFx(ctx, x, g.t);
  for (const x of g.impacts) drawImpact(ctx, x);
  for (const w of g.waves) drawWave(ctx, w);
  for (const p of g.particles) drawParticle(ctx, p);
  for (const t of g.pops) {
    ctx.globalAlpha = clamp(t.life / t.max * 2, 0, 1);
    outlinedText(ctx, t.text, t.x, t.y, t.size, t.color);
  }
  ctx.globalAlpha = 1;
  for (const x of g.focus) drawFocus(ctx, x);
  if (g.pre) drawPre(ctx, g);
  if (!g.duel && !g.demo && !cut) drawHeadBars(ctx, g);
  ctx.restore();
  // the impact frame: one instant of the whole picture in negative
  if (g.inv > 0 && !g.demo) {
    ctx.save();
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (g.stopUntil > g.t) drawTimeStop(ctx, g);
  if (g.flash > 0) {
    ctx.fillStyle = `hsl(0 0% 100% / ${clamp(g.flash / 0.4, 0, 0.9)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (!g.demo) drawBars(ctx, g.bars);
  if (hero && cut) {
    drawCutTitles(ctx, hero, ck);
    return;
  }
  if (g.demo) return;
  if (g.cutin) {
    const ci = g.cutin;
    const f = g.fighters[ci.key];
    if (f) drawCutIn(ctx, ci, (px, py, size) => portrait(ctx, g, f, px, py, size, ci.side), outlinedText);
  }
  drawHud(ctx, g);
  if (g.intro && !g.preview && g.fighters.length <= 4) drawNameCards(ctx, nameCards(g), outlinedText);
  if (!g.preview && !g.intro && g.t < 1.1) {
    const k = clamp(g.t / 0.2, 0, 1);
    outlinedText(ctx, g.t < 0.55 ? "READY" : "FIGHT!", W / 2, H / 2 - 40, 60 + 30 * k, g.t < 0.55 ? "white" : "hsl(46 100% 62%)");
  }
  if (g.ending > 0) {
    const k = clamp((g.t - g.ending) / 0.25, 0, 1);
    ctx.fillStyle = `hsl(0 0% 100% / ${0.35 * (1 - k)})`;
    ctx.fillRect(0, 0, W, H);
    outlinedText(ctx, "K.O.", W / 2, H / 2 - 40, 70 + 40 * k, "hsl(0 85% 60%)");
  }
}

/** The fighter drawn large for a cut-in, its chest at (px, py), turned to face into the screen. */
function portrait(ctx: CanvasRenderingContext2D, g: Game, f: Fighter, px: number, py: number, size: number, face: 1 | -1) {
  const keep = f.facing;
  f.facing = face;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(size / f.scale, size / f.scale);
  ctx.translate(-f.x, -(f.y - 55 * f.scale));
  try {
    drawFighter(ctx, g, f, { shadow: false });
  } finally {
    f.facing = keep;
    ctx.restore();
  }
}

/** One card per fighter along the bottom, in the order they stand, each sliding in as its entrance lands. */
function nameCards(g: Game): NameCard[] {
  const it = g.intro!;
  const fs = [...g.fighters].sort((a, b) => a.x - b.x);
  const n = fs.length;
  const w = Math.min(300, W / n - 24);
  const fade = clamp(((g.pre ? g.pre.start : it.max) - it.t) / 0.3, 0, 1);
  return fs.map((f, i) => {
    const sp = introOf(f.def);
    const since = introU(g, f) - sp.hit;
    const cx = n === 2 ? (i === 0 ? 40 + w / 2 : W - 40 - w / 2) : (W * (i + 0.5)) / n;
    return { name: f.def.name, power: f.def.power, a: f.def.color, b: f.def.glow, cx, w, k: since <= 0 ? 0 : Math.min(1, since * 4) * fade };
  });
}

/** A fighter during its entrance: moved, squashed, faded or tinted as its entrance says. */
function drawIntroFighter(ctx: CanvasRenderingContext2D, g: Game, f: Fighter) {
  const u = introU(g, f);
  if (u <= 0) return;
  const b = introOf(f.def).body(Math.min(1, u), f.scale);
  const echoing = !!b.echo && b.echo.alpha > 0.01;
  if (b.alpha <= 0.001 && !echoing) return;
  const s = f.scale;
  // the floor shadow grows as the body comes down to it
  const lift = clamp(-b.dy / 320, 0, 1);
  ctx.fillStyle = `hsl(250 40% 15% / ${0.28 * (1 - lift * 0.7) * b.alpha})`;
  ctx.beginPath();
  ctx.ellipse(f.x + b.dx, GROUND + 2, 26 * s * (1 - lift * 0.5) * b.sx, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  if (b.clip) {
    ctx.beginPath();
    ctx.rect(-W, -H, W * 3, GROUND + 3 + H);
    ctx.clip();
  }
  const one = (dx: number, alpha: number) => {
    ctx.save();
    ctx.translate(f.x + b.dx + dx, f.y + b.dy);
    ctx.scale(b.sx, b.sy);
    ctx.translate(-f.x, -f.y);
    drawFighter(ctx, g, f, { alpha, shadow: false });
    const sa = b.solidA ?? 0;
    if (b.solid && sa > 0.01) drawFighter(ctx, g, f, { alpha: alpha * sa, solid: b.solid, shadow: false });
    ctx.restore();
  };
  if (b.echo && echoing) for (const d of [-1, 1]) one(d * b.echo.spread, b.echo.alpha);
  if (b.alpha > 0.001) one(0, b.alpha);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** An entrance's own drawing, behind or in front of the body. */
function drawIntroLayer(ctx: CanvasRenderingContext2D, g: Game, f: Fighter, which: "back" | "front") {
  const u = introU(g, f);
  if (u <= 0 || u >= 1 || !g.intro) return;
  const sp = introOf(f.def);
  const draw = sp[which];
  if (!draw) return;
  ctx.save();
  draw({ ctx, x: f.x, y: f.y, ground: GROUND, s: f.scale, u, t: g.intro.t - f.spawnAt, face: f.facing, body: sp.body(u, f.scale) });
  ctx.restore();
}

/** Behind the raging fighter during the cutscene: the arena darkens and speed lines burst from them. */
function drawCutBackdrop(ctx: CanvasRenderingContext2D, f: Fighter, k: number, t: number) {
  const rg = f.form;
  if (!rg) return;
  const fade = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.1);
  ctx.save();
  ctx.fillStyle = `hsl(255 45% 7% / ${0.62 * fade})`;
  ctx.fillRect(-W, -H, W * 3, H * 3);
  const c = center(f);
  ctx.globalAlpha = fade;
  const glow = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, 260);
  glow.addColorStop(0, shade(rg.glow, 0, 0.7));
  glow.addColorStop(0.4, shade(rg.a, 0, 0.3));
  glow.addColorStop(1, shade(rg.a, 0, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 260, 0, Math.PI * 2);
  ctx.fill();
  // speed lines
  ctx.lineCap = "round";
  const turn = Math.floor(t * 18);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + ((turn * 7 + i * 13) % 10) * 0.02;
    const r0 = 90 + ((turn + i * 5) % 7) * 12;
    ctx.strokeStyle = i % 3 === 0 ? (rg.dark ?? shade(rg.a, -10)) : shade(i % 2 ? rg.a : rg.b, 0, 0.75);
    ctx.lineWidth = 2 + (i % 4);
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0);
    ctx.lineTo(c.x + Math.cos(a) * 640, c.y + Math.sin(a) * 640);
    ctx.stroke();
  }
  // each kind of form has its own moment behind the fighter
  if (rg.kind === "awakened") {
    // a pillar of light comes down onto them
    const pw = 70 + 40 * Math.sin(Math.min(1, k * 2) * Math.PI);
    const pil = ctx.createLinearGradient(c.x - pw, 0, c.x + pw, 0);
    pil.addColorStop(0, shade(rg.b, 0, 0));
    pil.addColorStop(0.5, shade(rg.b, 0, 0.55));
    pil.addColorStop(1, shade(rg.b, 0, 0));
    ctx.fillStyle = pil;
    ctx.fillRect(c.x - pw, -H, pw * 2, c.y + 80 + H);
  } else if (rg.kind === "mastery") {
    // calm ripples spreading out from where they stand
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const u = (t * 0.6 + i / 4) % 1;
      ctx.strokeStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.7 * (1 - u));
      ctx.beginPath();
      ctx.ellipse(c.x, f.y, 40 + u * 420, 10 + u * 90, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (rg.kind === "mystic") {
    runeCircle(ctx, c.x, c.y, 120 + 40 * Math.min(1, k * 3), t, rg.a, rg.b, 0.9);
    runeCircle(ctx, c.x, f.y, 70, -t * 1.4, rg.b, rg.a, 0.6);
  } else if (rg.kind === "super" || rg.kind === "hyper") {
    drawEmeralds(ctx, f, rg, k, t, "back");
  } else if (isDarkForm(rg.kind)) {
    // the world goes black: everything outside a ring of the form's colour is swallowed, with cracks running out
    ctx.fillStyle = `hsl(0 0% 0% / ${0.55 * Math.min(1, k * 2)})`;
    ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const an = i * 0.7 + 0.3;
      const reach = 80 + 520 * Math.min(1, k * 1.6);
      ctx.strokeStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.85);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      for (let j = 1; j <= 6; j++) {
        const d = (reach * j) / 6;
        ctx.lineTo(c.x + Math.cos(an + Math.sin(i * 5 + j) * 0.25) * d, c.y + Math.sin(an + Math.sin(i * 3 + j) * 0.25) * d);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = shade(rg.b, 0, 0.9);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 70 + 30 * Math.sin(t * 6), 0, Math.PI * 2);
    ctx.stroke();
  } else if (rg.kind === "phase") {
    // a boss phase: the ground shakes apart in rings, one more each phase, and the arena darkens a step further
    const n = (rg.step ?? 2) - 1;
    ctx.fillStyle = `hsl(0 0% 0% / ${0.15 * n * Math.min(1, k * 2)})`;
    ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.lineWidth = 4;
    for (let i = 0; i < n + 2; i++) {
      const u = (t * 0.7 + i / (n + 2)) % 1;
      ctx.strokeStyle = shade(i % 2 ? rg.a : rg.b, 0, 0.8 * (1 - u));
      ctx.beginPath();
      ctx.arc(c.x, c.y, 60 + u * 520, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    for (let i = 0; i < 4 + n * 2; i++) {
      const an = Math.PI + (i / (3 + n * 2)) * Math.PI;
      const reach = 60 + 480 * Math.min(1, k * 1.5);
      ctx.strokeStyle = shade(i % 2 ? rg.b : rg.glow, 0, 0.85);
      ctx.beginPath();
      ctx.moveTo(c.x, f.y);
      for (let j = 1; j <= 5; j++) {
        const d = (reach * j) / 5;
        ctx.lineTo(c.x + Math.cos(an + Math.sin(i * 4 + j) * 0.2) * d, f.y + Math.abs(Math.sin(an)) * d * 0.15 + Math.sin(i + j * 2) * 8);
      }
      ctx.stroke();
    }
  } else if (rg.kind === "perfected") {
    // red fire on one side, blue on the other, meeting in them
    const side = ctx.createLinearGradient(c.x - 420, 0, c.x + 420, 0);
    side.addColorStop(0, shade(rg.a, 0, 0.45));
    side.addColorStop(0.45, shade(rg.a, 0, 0.08));
    side.addColorStop(0.55, shade(rg.b, 0, 0.08));
    side.addColorStop(1, shade(rg.b, 0, 0.45));
    ctx.fillStyle = side;
    ctx.fillRect(-W, -H, W * 3, H * 3);
  }
  // flash as the rage breaks loose
  if (k > 0.6 && k < 0.75) {
    ctx.globalAlpha = 1 - (k - 0.6) / 0.15;
    ctx.fillStyle = rg.kind === "super" ? "hsl(48 100% 72%)" : rg.dark && f.def.id === "electro" && Math.floor(t * 30) % 2 ? rg.dark : "white";
    ctx.fillRect(-W, -H, W * 3, H * 3);
  }
  ctx.restore();
}

// ---------- Super and Hyper Form: the emeralds ----------
const seg = (k: number, a: number, b: number) => clamp((k - a) / (b - a), 0, 1);
/** The seven emeralds' colours. */
const EMERALDS = ["hsl(140 85% 48%)", "hsl(355 90% 55%)", "hsl(215 95% 58%)", "hsl(50 100% 55%)", "hsl(185 95% 55%)", "hsl(285 85% 62%)", "hsl(210 20% 90%)"];

/** One cut gem: a flat top, sloped shoulders and a point at the bottom, lit from the top left, with a glow around it. */
function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, col: string, alpha: number, shine: number) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, size * 2.6);
  g.addColorStop(0, shade(col, 10, 0.6 + shine * 0.3));
  g.addColorStop(1, shade(col, 0, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, size * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const w = size, h = size * 1.2;
  const body = ctx.createLinearGradient(x - w, y - h, x + w, y + h);
  body.addColorStop(0, shade(col, 30));
  body.addColorStop(0.5, col);
  body.addColorStop(1, shade(col, -22));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.55, y - h * 0.55);
  ctx.lineTo(x + w * 0.55, y - h * 0.55);
  ctx.lineTo(x + w, y - h * 0.1);
  ctx.lineTo(x, y + h * 0.75);
  ctx.lineTo(x - w, y - h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(col, 38, 0.95);
  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.stroke();
  // the facets: the girdle line and two cuts down to the point
  ctx.beginPath();
  ctx.moveTo(x - w, y - h * 0.1);
  ctx.lineTo(x + w, y - h * 0.1);
  ctx.moveTo(x - w * 0.3, y - h * 0.1);
  ctx.lineTo(x, y + h * 0.75);
  ctx.lineTo(x + w * 0.3, y - h * 0.1);
  ctx.stroke();
  // a glint of white on the top
  ctx.fillStyle = `hsl(0 0% 100% / ${0.55 + shine * 0.45})`;
  ctx.beginPath();
  ctx.ellipse(x - w * 0.25, y - h * 0.36, w * 0.22, h * 0.09, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Super Form: seven emeralds appear round him, spin faster and faster, and crash into him in a golden light.
 * Hyper Form: a great emerald flashes first, the seven turn into super emeralds, spin, and crash in white and every colour.
 * Drawn twice, behind the fighter and in front, so the emeralds pass both ways round him. */
function drawEmeralds(ctx: CanvasRenderingContext2D, f: Fighter, rg: Rage, k: number, t: number, layer: "back" | "front") {
  const c = center(f);
  const hyper = rg.kind === "hyper";
  ctx.save();
  // Hyper Form: a great emerald flashes behind him for a moment
  if (hyper && layer === "back") {
    const m = Math.sin(seg(k, 0.02, 0.24) * Math.PI);
    if (m > 0) {
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(c.x, c.y - 30, 0, c.x, c.y - 30, 300);
      g.addColorStop(0, `hsl(140 100% 60% / ${0.55 * m})`);
      g.addColorStop(1, "hsl(140 100% 50% / 0)");
      ctx.fillStyle = g;
      ctx.fillRect(c.x - 300, c.y - 330, 600, 600);
      ctx.globalCompositeOperation = "source-over";
      drawGem(ctx, c.x, c.y - 40, 70 + 12 * m, "hsl(140 90% 44%)", m, m);
    }
  }
  // the seven circling, the ring tightening and the spin speeding up until they hit him
  const appear = seg(k, hyper ? 0.14 : 0.03, hyper ? 0.24 : 0.16);
  const close = Math.pow(seg(k, 0.36, 0.6), 2);
  const spin = k * 4 + Math.pow(k, 3) * 26;
  const turnSuper = hyper ? seg(k, 0.28, 0.38) : 0;
  const R = 170 * (1 - close) + 6;
  if (k < 0.62) {
    for (let i = 0; i < 7; i++) {
      const shown = clamp(appear * 7 - i, 0, 1);
      if (shown <= 0) continue;
      const a = spin + (i / 7) * Math.PI * 2;
      const front = Math.sin(a) > 0;
      if ((layer === "front") !== front) continue;
      const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R * 0.34 + Math.sin(t * 3 + i) * 5 * (1 - close);
      const depth = 0.85 + 0.15 * Math.sin(a);
      const size = 13 * depth * (1 + turnSuper * 0.3) * (1 - close * 0.4);
      // the streak each one leaves as it spins faster
      if (close > 0.05 || k > 0.3) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = shade(EMERALDS[i], 20, 0.45);
        ctx.lineWidth = size * 0.7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, R, R * 0.34, 0, a - 0.5 - close * 0.6, a);
        ctx.stroke();
        ctx.restore();
      }
      drawGem(ctx, x, y, size, EMERALDS[i], shown * (1 - turnSuper), 0.3);
      if (turnSuper > 0) {
        // the super emerald: paler, brighter, a ring of light round it, and a white pop as it changes
        drawGem(ctx, x, y, size, shade(EMERALDS[i], 22), shown * turnSuper, 1);
        const pop = Math.sin(turnSuper * Math.PI);
        if (pop > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
          g.addColorStop(0, `hsl(0 0% 100% / ${0.9 * pop})`);
          g.addColorStop(1, "hsl(0 0% 100% / 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, size * 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.strokeStyle = shade(EMERALDS[i], 30, 0.8 * turnSuper);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, size * 1.7 + Math.sin(t * 8 + i) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // the moment they hit: Super Form a burst of gold, Hyper Form white with rings of every colour spreading out
  if (layer === "front" && k > 0.55) {
    const u = seg(k, 0.55, 1);
    const fade = 1 - seg(k, 0.82, 1);
    ctx.globalCompositeOperation = "lighter";
    const core = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 80 + u * 260);
    core.addColorStop(0, hyper ? `hsl(0 0% 100% / ${0.9 * fade})` : `hsl(50 100% 80% / ${0.9 * fade})`);
    core.addColorStop(0.5, hyper ? `hsl(200 100% 90% / ${0.4 * fade})` : `hsl(44 100% 60% / ${0.45 * fade})`);
    core.addColorStop(1, "hsl(48 100% 60% / 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 80 + u * 260, 0, Math.PI * 2);
    ctx.fill();
    if (hyper) {
      // chromatic rings, each colour a little ahead of the last
      ctx.lineWidth = 7;
      for (let i = 0; i < 7; i++) {
        const rr = 40 + u * 560 - i * 16;
        if (rr <= 0) continue;
        ctx.strokeStyle = `hsl(${(i * 52 + t * 120) % 360} 100% 66% / ${0.75 * fade})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // golden rays bursting out
      ctx.lineCap = "round";
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + 0.2;
        const r0 = 30 + u * 80, r1 = r0 + 120 + u * 340;
        ctx.strokeStyle = `hsl(${44 + (i % 3) * 6} 100% ${70 + (i % 2) * 14}% / ${0.7 * fade})`;
        ctx.lineWidth = 4 + (i % 3) * 2;
        ctx.beginPath();
        ctx.moveTo(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0);
        ctx.lineTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Letterbox bars and the fighter's name sliding in over the cutscene. */
function drawCutTitles(ctx: CanvasRenderingContext2D, f: Fighter, k: number) {
  const rg = f.form;
  if (!rg) return;
  const bar = 64 * Math.min(1, k / 0.1) * Math.min(1, (1 - k) / 0.08);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);
  const enter = (from: number) => 1 - Math.pow(1 - clamp((k - from) / 0.14, 0, 1), 3);
  const leave = clamp((1 - k) / 0.08, 0, 1);
  const c = center(f);
  const left = c.x > W / 2;
  const x = left ? 60 : W - 60;
  const align: CanvasTextAlign = left ? "left" : "right";
  const slide = (e: number) => (left ? -1 : 1) * (1 - e) * 360;
  ctx.globalAlpha = leave;
  const e1 = enter(0.08), e2 = enter(0.2), e3 = enter(0.62);
  outlinedText(ctx, f.def.name.toUpperCase(), x + slide(e1), H * 0.3, 56, "white", align);
  outlinedText(ctx, formShout(rg), x + slide(e2), H * 0.3 + 58, 44, rg.kind === "perfected" ? rg.a : rg.glow, align);
  if (e3 > 0) {
    ctx.globalAlpha = leave * e3;
    outlinedText(ctx, rg.title, x, H * 0.3 + 104, 26 + 6 * (1 - e3), f.def.id === "electro" || rg.kind === "mastery" ? "white" : rg.b, align);
  }
  ctx.globalAlpha = 1;
}

// ---------- Free World: strolling outside a fight ----------
/** Free World: one fighter walking (dir -1 or 1, having covered `dist` pixels) or resting (dir 0), with the arena's own walk cycle and idle breathing. */
export function strollPose(g: Game, f: Fighter, dir: number, dist: number, dt: number) {
  f.walkDir = dir;
  if (dir) {
    f.facing = dir > 0 ? 1 : -1;
    f.walk += Math.abs(dist) / 14;
  }
  f.flash = Math.max(0, f.flash - dt);
  smoothPose(f, dir ? walkPose(f) : idlePose(f, g.t), dt, dir ? 26 : 10);
}

/** Free World: draw one fighter where it stands, with its shadow, and no lifebar or HUD. */
export function drawStroller(ctx: CanvasRenderingContext2D, g: Game, f: Fighter) {
  drawFighter(ctx, g, f);
}
