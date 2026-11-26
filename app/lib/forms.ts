// Every original fighter has one form it breaks into once per fight when pushed low: four Rage Modes,
// four Awakened, four Mastery and four Mystic. Pyro goes one step further, from Blue Flame into Perfected Flame.
// A form recolours the fighter and its moves, changes its stats, adds a passive and adds 2 new moves.
// Shared by the arena engine (the transformation and the fight) and the Fighters page (who has what).

import type { Move, Power } from "./fighters";

export type FormKind = "rage" | "perfected" | "awakened" | "mastery" | "mystic" | "nightmare" | "surge" | "super" | "hyper" | "phase";

export type Form = {
  power: Power;
  kind: FormKind;
  /** The form's own name, shown under the mode title in the cutscene. */
  title: string;
  /** One line for the Fighters page. */
  blurb: string;
  /** Body colour and glow while in the form. */
  body: string; glow: string;
  /** Its moves' new colour and highlight. */
  a: string; b: string;
  /** A dark streak mixed in (Electro's black lightning). */
  dark?: string;
  /** Fires once the fighter drops to this share of health. */
  at: number;
  dmg: number; kb: number; cd: number; speed: number; act: number;
  /** Passives: health back per second, chance to slip a hit, share of damage dealt drained back, share of damage taken. */
  regen?: number; dodge?: number; drain?: number; guard?: number;
  /** The new moves it fights with on top of its own. */
  moves: Move[];
  /** A Story boss's phase number (2, 3 or 4); see BOSS_PHASES in bosses.ts. */
  step?: number;
  /** Overrides the generic kind name (e.g. "Nightmare Mode") with this fighter's own, in the badge and the cutscene shout. */
  label?: string;
};

export const FORM_NAME: Record<FormKind, string> = {
  rage: "Rage Mode",
  perfected: "Perfected Flame",
  awakened: "Awakened Mode",
  mastery: "Mastery Mode",
  mystic: "Mystic Mode",
  nightmare: "Nightmare Mode",
  surge: "Surge Mode",
  super: "Super Form",
  hyper: "Hyper Form",
  phase: "Boss Phase",
};

/** The big title the cutscene shouts. */
export const FORM_SHOUT: Record<FormKind, string> = {
  rage: "RAGE MODE",
  perfected: "PERFECTED FLAME",
  awakened: "AWAKENED",
  mastery: "MASTERY MODE",
  mystic: "MYSTIC MODE",
  nightmare: "NIGHTMARE MODE",
  surge: "SURGE MODE",
  super: "SUPER FORM",
  hyper: "HYPER FORM",
  phase: "NEXT PHASE",
};

/** The big title a form's cutscene shouts: a boss phase names its number. */
export const formShout = (f: Form) => (f.kind === "phase" && f.step ? `PHASE ${f.step}` : f.label ? f.label.toUpperCase() : FORM_SHOUT[f.kind]);

const M = (m: Omit<Move, "wind" | "act" | "rec"> & Partial<Pick<Move, "wind" | "act" | "rec">>): Move => ({
  wind: 0.18,
  act: 0.12,
  rec: 0.22,
  ...m,
});

const RAGE_STATS = { at: 0.34 };
const AWAKE = { at: 0.4, regen: 1.6 };
const MASTER = { at: 0.45, dodge: 0.22 };
const MYSTIC = { at: 0.42, drain: 0.2 };

export const FORMS = {
  // ----- Rage Mode: raw fury -----
  pyro: {
    power: "pyro", kind: "rage", title: "BLUE FLAME", ...RAGE_STATS,
    blurb: "His fire turns blue and hotter. Every hit burns.",
    body: "hsl(218 88% 56%)", glow: "hsl(195 100% 74%)", a: "hsl(222 100% 58%)", b: "hsl(190 100% 80%)",
    dmg: 1.3, kb: 1.1, cd: 0.8, speed: 1.1, act: 1.1,
    moves: [
      M({ id: "blue-comet", name: "Blue Comet", kind: "rain", anim: "raise", range: 540, cd: 3, dmg: 8, count: 3, radius: 110, size: 16, status: "burn", statusDur: 2.5, kb: 220, wind: 0.28 }),
      M({ id: "azure-inferno", name: "Azure Inferno", kind: "burst", anim: "slam", range: 150, cd: 6.5, dmg: 18, radius: 175, kb: 480, lift: -320, status: "burn", statusDur: 3, wind: 0.32, rec: 0.35 }),
    ],
  },
  electro: {
    power: "electro", kind: "rage", title: "BLACK LIGHTNING", ...RAGE_STATS,
    blurb: "White lightning with a black aura. Much faster, and he juggles in the air.",
    body: "hsl(0 0% 97%)", glow: "hsl(0 0% 100%)", a: "hsl(0 0% 100%)", b: "hsl(215 40% 94%)", dark: "hsl(265 45% 7%)",
    dmg: 1.15, kb: 1, cd: 0.45, speed: 1.6, act: 1.45,
    moves: [
      M({ id: "black-bolt-rush", name: "Black Bolt Rush", kind: "dash", anim: "lunge", range: 340, cd: 3.2, dmg: 13, dist: 340, act: 0.25, kb: 320, lift: -220, status: "stun", statusDur: 0.35 }),
      M({ id: "thunder-judgement", name: "Thunder Judgement", kind: "rain", anim: "raise", range: 520, cd: 6, dmg: 9, count: 7, radius: 160, status: "stun", statusDur: 0.35, wind: 0.3, rec: 0.3 }),
    ],
  },
  aero: {
    power: "aero", kind: "rage", title: "STORM FURY", ...RAGE_STATS,
    blurb: "Storm winds around him hit harder, throw further and gust every second or so.",
    body: "hsl(168 78% 36%)", glow: "hsl(150 100% 80%)", a: "hsl(166 88% 34%)", b: "hsl(146 100% 82%)",
    dmg: 1.5, kb: 1.7, cd: 0.8, speed: 1.15, act: 1.1,
    moves: [
      M({ id: "hurricane-blades", name: "Hurricane Blades", kind: "projectile", anim: "thrust", range: 560, minRange: 80, cd: 2.4, dmg: 7, speed: 720, size: 11, count: 3, spread: 0.16, pierce: true, shape: "blade" }),
      M({ id: "hurricane-eye", name: "Hurricane Eye", kind: "zone", anim: "spin", range: 280, cd: 7, dmg: 6, radius: 150, dur: 3.5, pullIn: 140, wind: 0.3 }),
    ],
  },
  terra: {
    power: "terra", kind: "rage", title: "MAGMA CORE", ...RAGE_STATS, guard: 0.7,
    blurb: "His rock splits open over molten stone. He takes less damage and his fists burn.",
    body: "hsl(12 70% 34%)", glow: "hsl(28 100% 60%)", a: "hsl(14 90% 46%)", b: "hsl(40 100% 64%)", dark: "hsl(15 30% 12%)",
    dmg: 1.35, kb: 1.3, cd: 0.8, speed: 1.05, act: 1.05,
    moves: [
      M({ id: "molten-fist", name: "Molten Fist", kind: "melee", anim: "uppercut", range: 78, cd: 1.1, dmg: 12, kb: 300, lift: -360, status: "burn", statusDur: 2 }),
      M({ id: "volcanic-rupture", name: "Volcanic Rupture", kind: "eruption", anim: "slam", range: 460, minRange: 60, cd: 6, dmg: 15, radius: 44, count: 3, lift: -640, status: "burn", statusDur: 2, wind: 0.36 }),
    ],
  },

  // ----- Awakened Mode: a hidden power wakes up, health slowly comes back -----
  umbra: {
    power: "umbra", kind: "awakened", title: "ABYSS", ...AWAKE,
    blurb: "The shadow wakes up hungry. Darkness mends him while he fights.",
    body: "hsl(276 70% 18%)", glow: "hsl(300 100% 66%)", a: "hsl(282 80% 30%)", b: "hsl(310 100% 72%)", dark: "hsl(270 60% 6%)",
    dmg: 1.25, kb: 1.15, cd: 0.75, speed: 1.15, act: 1.15,
    moves: [
      M({ id: "abyssal-maw", name: "Abyssal Maw", kind: "pull", anim: "cast", range: 460, minRange: 100, cd: 4.5, dmg: 12, status: "blind", statusDur: 1.2 }),
      M({ id: "eclipse-fang", name: "Eclipse Fang", kind: "blink", anim: "lunge", range: 520, minRange: 90, cd: 4, dmg: 18, kb: 360, lift: -260 }),
    ],
  },
  lux: {
    power: "lux", kind: "awakened", title: "RADIANCE", ...AWAKE,
    blurb: "Light pours out of her. Her shots blind and she heals as she glows.",
    body: "hsl(46 100% 70%)", glow: "hsl(52 100% 92%)", a: "hsl(44 100% 62%)", b: "hsl(0 0% 100%)",
    dmg: 1.25, kb: 1.1, cd: 0.75, speed: 1.15, act: 1.15,
    moves: [
      M({ id: "solar-lance", name: "Solar Lance", kind: "beam", anim: "thrust", range: 460, minRange: 60, cd: 3.4, dmg: 17, act: 0.32, status: "blind", statusDur: 1.2 }),
      M({ id: "heavens-gate", name: "Heaven's Gate", kind: "rain", anim: "raise", range: 520, cd: 6.5, dmg: 9, count: 7, radius: 160, status: "blind", statusDur: 0.8, wind: 0.32 }),
    ],
  },
  gravi: {
    power: "gravi", kind: "awakened", title: "EVENT HORIZON", ...AWAKE,
    blurb: "Gravity bends around him. His pull grows stronger and he recovers as he fights.",
    body: "hsl(250 60% 22%)", glow: "hsl(268 100% 76%)", a: "hsl(255 70% 36%)", b: "hsl(275 100% 82%)", dark: "hsl(250 50% 6%)",
    dmg: 1.25, kb: 1.2, cd: 0.75, speed: 1.1, act: 1.1,
    moves: [
      M({ id: "collapsing-star", name: "Collapsing Star", kind: "zone", anim: "cast", range: 360, cd: 7, dmg: 8, radius: 150, dur: 3.2, pullIn: 230, wind: 0.32 }),
      M({ id: "planet-crusher", name: "Planet Crusher", kind: "rain", anim: "slam", range: 500, cd: 7, dmg: 18, count: 2, radius: 90, wind: 0.4, rec: 0.35 }),
    ],
  },
  shift: {
    power: "shift", kind: "awakened", title: "PRIMAL FORM", ...AWAKE,
    blurb: "Her true shape breaks out: longer reach, harder hits and a body that knits back together.",
    body: "hsl(322 80% 50%)", glow: "hsl(150 100% 66%)", a: "hsl(318 85% 54%)", b: "hsl(150 100% 70%)",
    dmg: 1.25, kb: 1.2, cd: 0.75, speed: 1.15, act: 1.15,
    moves: [
      M({ id: "hydra-lash", name: "Hydra Lash", kind: "melee", anim: "lunge", range: 120, cd: 1.3, dmg: 13, kb: 300, lift: -200 }),
      M({ id: "chimera-burst", name: "Chimera Burst", kind: "burst", anim: "slam", range: 150, cd: 6, dmg: 16, radius: 170, kb: 440, lift: -300, status: "poison", statusDur: 2, wind: 0.3 }),
    ],
  },

  // ----- Mastery Mode: perfect control, slips some hits entirely -----
  cryo: {
    power: "cryo", kind: "mastery", title: "ABSOLUTE ZERO", ...MASTER,
    blurb: "Perfect control of the cold. Her ice freezes longer and she slips some hits.",
    body: "hsl(200 60% 88%)", glow: "hsl(190 100% 96%)", a: "hsl(205 90% 66%)", b: "hsl(0 0% 100%)",
    dmg: 1.2, kb: 1.1, cd: 0.7, speed: 1.15, act: 1.2,
    moves: [
      M({ id: "frozen-requiem", name: "Frozen Requiem", kind: "beam", anim: "cast", range: 440, minRange: 60, cd: 4, dmg: 14, act: 0.34, status: "freeze", statusDur: 0.9 }),
      M({ id: "glacial-lotus", name: "Glacial Lotus", kind: "eruption", anim: "raise", range: 440, minRange: 60, cd: 6, dmg: 13, radius: 42, count: 3, lift: -520, status: "freeze", statusDur: 0.7, wind: 0.34 }),
    ],
  },
  hydro: {
    power: "hydro", kind: "mastery", title: "FLOWING TIDE", ...MASTER,
    blurb: "He moves like water: hard to hit, and his waves roll along the floor.",
    body: "hsl(210 90% 46%)", glow: "hsl(186 100% 82%)", a: "hsl(215 90% 50%)", b: "hsl(185 100% 86%)",
    dmg: 1.2, kb: 1.25, cd: 0.7, speed: 1.2, act: 1.2,
    moves: [
      M({ id: "tsunami-crash", name: "Tsunami Crash", kind: "projectile", anim: "slam", range: 600, minRange: 90, cd: 4.5, dmg: 15, speed: 420, size: 26, ground: true, pierce: true, kb: 420, lift: -300 }),
      M({ id: "hydro-cutter", name: "Hydro Cutter", kind: "beam", anim: "thrust", range: 460, minRange: 60, cd: 3.2, dmg: 14, act: 0.28 }),
    ],
  },
  magneto: {
    power: "magneto", kind: "mastery", title: "IRON SOVEREIGN", ...MASTER,
    blurb: "Every scrap of metal answers him. Blades fly in sixes and he turns hits aside.",
    body: "hsl(220 14% 58%)", glow: "hsl(0 90% 64%)", a: "hsl(220 16% 62%)", b: "hsl(355 90% 66%)",
    dmg: 1.2, kb: 1.15, cd: 0.7, speed: 1.1, act: 1.2,
    moves: [
      M({ id: "thousand-blades", name: "Thousand Blades", kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 3, dmg: 5, speed: 760, size: 9, count: 6, spread: 0.1, shape: "blade" }),
      M({ id: "magnetic-storm", name: "Magnetic Storm", kind: "rain", anim: "raise", range: 520, cd: 6, dmg: 7, count: 7, radius: 160, size: 9, shape: "shard", status: "slow", statusDur: 0.8, wind: 0.3 }),
    ],
  },
  toxi: {
    power: "toxi", kind: "mastery", title: "VENOM SAGE", ...MASTER,
    blurb: "Poison mastered, not just thrown. Three-headed spit and a garden of plague.",
    body: "hsl(96 70% 38%)", glow: "hsl(78 100% 66%)", a: "hsl(100 75% 40%)", b: "hsl(280 70% 70%)",
    dmg: 1.2, kb: 1.1, cd: 0.7, speed: 1.1, act: 1.2,
    moves: [
      M({ id: "hydra-venom", name: "Hydra Venom", kind: "projectile", anim: "thrust", range: 540, minRange: 80, cd: 2.6, dmg: 6, speed: 560, size: 11, count: 3, spread: 0.2, arc: true, status: "poison", statusDur: 2.5 }),
      M({ id: "plague-garden", name: "Plague Garden", kind: "eruption", anim: "slam", range: 480, minRange: 50, cd: 6.5, dmg: 10, radius: 44, count: 3, lift: -520, status: "poison", statusDur: 2.5, wind: 0.34 }),
    ],
  },

  // ----- Mystic Mode: arcane power, every hit drains health back -----
  tele: {
    power: "tele", kind: "mystic", title: "ASTRAL GATE", ...MYSTIC,
    blurb: "Portals open to the stars. Every hit she lands pulls a little health back.",
    body: "hsl(262 80% 60%)", glow: "hsl(186 100% 80%)", a: "hsl(265 85% 62%)", b: "hsl(186 100% 82%)",
    dmg: 1.25, kb: 1.1, cd: 0.75, speed: 1.15, act: 1.15,
    moves: [
      M({ id: "starfall-portals", name: "Starfall Portals", kind: "rain", anim: "raise", range: 520, cd: 6, dmg: 9, count: 6, radius: 150, wind: 0.3 }),
      M({ id: "void-step", name: "Void Step", kind: "blink", anim: "kick", range: 520, minRange: 90, cd: 3.6, dmg: 16, kb: 340, lift: -280 }),
    ],
  },
  vita: {
    power: "vita", kind: "mystic", title: "WORLD TREE", ...MYSTIC,
    blurb: "Ancient roots wake under her. Her hits drain life and she can bloom herself back.",
    body: "hsl(140 60% 40%)", glow: "hsl(60 100% 78%)", a: "hsl(135 65% 40%)", b: "hsl(55 100% 76%)",
    dmg: 1.2, kb: 1.1, cd: 0.75, speed: 1.1, act: 1.15,
    moves: [
      M({ id: "verdant-wrath", name: "Verdant Wrath", kind: "eruption", anim: "slam", range: 460, minRange: 60, cd: 5.5, dmg: 15, radius: 46, count: 2, lift: -560, status: "slow", statusDur: 1, wind: 0.34 }),
      M({ id: "sacred-bloom", name: "Sacred Bloom", kind: "heal", anim: "raise", range: 2000, cd: 11, dmg: 0, heal: 18, below: 0.7, wind: 0.4, rec: 0.3 }),
    ],
  },
  chrono: {
    power: "chrono", kind: "mystic", title: "ETERNITY", ...MYSTIC,
    blurb: "He steps outside time. Clock hands fly in volleys and stolen seconds heal him.",
    body: "hsl(40 70% 52%)", glow: "hsl(180 90% 78%)", a: "hsl(38 80% 54%)", b: "hsl(180 100% 82%)",
    dmg: 1.2, kb: 1.1, cd: 0.7, speed: 1.15, act: 1.25,
    moves: [
      M({ id: "clockwork-judgement", name: "Clockwork Judgement", kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 3, dmg: 5, speed: 620, size: 10, count: 5, spread: 0.14, status: "slow", statusDur: 1 }),
      M({ id: "paradox-field", name: "Paradox Step", kind: "blink", anim: "kick", range: 540, minRange: 90, cd: 4, dmg: 15, kb: 300, lift: -240, status: "stun", statusDur: 0.35 }),
    ],
  },
  psy: {
    power: "psy", kind: "mystic", title: "THIRD EYE", ...MYSTIC,
    blurb: "The third eye opens. Her mind attacks stun, and she feeds on the pain.",
    body: "hsl(290 70% 56%)", glow: "hsl(320 100% 82%)", a: "hsl(292 75% 58%)", b: "hsl(330 100% 84%)",
    dmg: 1.25, kb: 1.15, cd: 0.75, speed: 1.1, act: 1.15,
    moves: [
      M({ id: "mind-shatter", name: "Mind Shatter", kind: "beam", anim: "cast", range: 440, minRange: 60, cd: 3.6, dmg: 15, act: 0.3, status: "stun", statusDur: 0.45 }),
      M({ id: "psychic-maelstrom", name: "Psychic Maelstrom", kind: "burst", anim: "raise", range: 160, cd: 6.5, dmg: 16, radius: 185, kb: 300, lift: -480, wind: 0.32 }),
    ],
  },
} as Record<Power, Form>;

// ----- Nightmare Mode: the quest fighters' dark form -----
// Darker body, a black-and-colour aura, 3 new moves, a little of every passive, and it can't be stunned or frozen (enforced in the arena engine).
const NIGHTMARE = { at: 0.4, regen: 2, drain: 0.12, guard: 0.85 };

FORMS.spatio = {
  power: "spatio", kind: "nightmare", title: "COLLAPSED SPACE", ...NIGHTMARE,
  blurb: "Space caves in around him. Cracks of nothing split the air, and his prisons crush whatever they hold.",
  body: "hsl(250 50% 8%)", glow: "hsl(280 100% 64%)", a: "hsl(268 80% 30%)", b: "hsl(188 100% 72%)", dark: "hsl(250 60% 3%)",
  dmg: 1.35, kb: 1.25, cd: 0.7, speed: 1.2, act: 1.2,
  moves: [
    M({ id: "world-severance", name: "World Severance", kind: "beam", anim: "thrust", range: 900, minRange: 60, cd: 5, dmg: 24, act: 0.3, kb: 420, wind: 0.4 }),
    M({ id: "absolute-prison", name: "Absolute Prison", kind: "zone", anim: "raise", range: 420, cd: 9, dmg: 8, radius: 150, dur: 4, pullIn: 340, erase: true, status: "slow", statusDur: 0.6, wind: 0.36 }),
    M({ id: "event-collapse", name: "Event Collapse", kind: "burst", anim: "slam", range: 170, cd: 7, dmg: 22, radius: 210, kb: 560, lift: -420, status: "stun", statusDur: 0.6, wind: 0.34, rec: 0.35 }),
  ],
};
FORMS.hexizon = {
  power: "hexizon", kind: "nightmare", title: "CORRUPTED SAVE", ...NIGHTMARE,
  blurb: "His save file corrupts. The green turns to glitching black and red, blasters fill the sky and he refuses to stay down.",
  body: "hsl(0 0% 2%)", glow: "hsl(350 100% 56%)", a: "hsl(128 100% 50%)", b: "hsl(350 100% 62%)", dark: "hsl(0 0% 0%)",
  dmg: 1.35, kb: 1.2, cd: 0.7, speed: 1.2, act: 1.2,
  moves: [
    M({ id: "blaster-storm", name: "Blaster Storm", kind: "rain", anim: "raise", range: 560, cd: 6, dmg: 10, count: 6, radius: 170, wind: 0.34, rec: 0.3 }),
    M({ id: "bad-time", name: "Bad Time", kind: "eruption", anim: "slam", range: 640, minRange: 40, cd: 6.5, dmg: 13, radius: 46, count: 6, lift: -700, status: "poison", statusDur: 2, wind: 0.36 }),
    M({ id: "determination", name: "Determination", kind: "heal", anim: "raise", range: 2000, cd: 14, dmg: 0, heal: 30, below: 0.45, wind: 0.36 }),
  ],
};
FORMS.gamma = {
  power: "gamma", kind: "nightmare", title: "MELTDOWN", ...NIGHTMARE,
  blurb: "His core goes critical. The green burns to a sick black glow, every swing leaks fallout and the ground itself starts to split.",
  body: "hsl(90 30% 6%)", glow: "hsl(62 100% 55%)", a: "hsl(88 100% 42%)", b: "hsl(58 100% 62%)", dark: "hsl(90 40% 3%)",
  dmg: 1.35, kb: 1.25, cd: 0.7, speed: 1.15, act: 1.2,
  moves: [
    M({ id: "omega-ray", name: "Omega Ray", kind: "beam", anim: "thrust", range: 860, minRange: 60, cd: 5, dmg: 24, act: 0.45, kb: 380, status: "poison", statusDur: 2.5, wind: 0.42 }),
    M({ id: "chain-reaction", name: "Chain Reaction", kind: "rain", anim: "raise", range: 560, cd: 6, dmg: 10, count: 7, radius: 180, status: "poison", statusDur: 1.5, wind: 0.34, rec: 0.3 }),
    M({ id: "ground-zero", name: "Ground Zero", kind: "burst", anim: "slam", range: 180, cd: 7.5, dmg: 24, radius: 230, kb: 600, lift: -460, status: "poison", statusDur: 2, wind: 0.38, rec: 0.35 }),
  ],
};
FORMS.velo = {
  power: "velo", kind: "nightmare", title: "TERMINAL VELOCITY", ...NIGHTMARE,
  blurb: "He breaks a speed nothing should reach. His afterimages turn black and red, stay behind to fight, and his laps tear the arena open.",
  body: "hsl(0 40% 6%)", glow: "hsl(0 100% 58%)", a: "hsl(0 100% 48%)", b: "hsl(40 100% 64%)", dark: "hsl(0 0% 0%)",
  dmg: 1.3, kb: 1.2, cd: 0.65, speed: 1.3, act: 1.2,
  moves: [
    M({ id: "light-barrier", name: "Light Barrier", kind: "dash", anim: "lunge", range: 640, cd: 4, dmg: 20, dist: 640, act: 0.2, kb: 480, lift: -260 }),
    M({ id: "zero-frame", name: "Zero Frame", kind: "blink", anim: "uppercut", range: 700, minRange: 80, cd: 3.2, dmg: 18, kb: 260, lift: -620 }),
    M({ id: "infinite-laps", name: "Infinite Laps", kind: "zone", anim: "spin", range: 380, cd: 8.5, dmg: 8, radius: 170, dur: 4, pullIn: 380, status: "burn", statusDur: 0.6, wind: 0.32 }),
  ],
};
FORMS.portal = {
  power: "portal", kind: "nightmare", title: "EVERY DOOR OPEN", ...NIGHTMARE,
  blurb: "Every door it ever opened swings wide at once. Things fall through from everywhere, shots vanish into its field and matter comes apart at its touch.",
  body: "hsl(270 40% 5%)", glow: "hsl(176 100% 56%)", a: "hsl(300 90% 40%)", b: "hsl(176 100% 66%)", dark: "hsl(270 50% 2%)",
  dmg: 1.35, kb: 1.2, cd: 0.7, speed: 1.2, act: 1.2,
  moves: [
    M({ id: "thousand-doors", name: "Thousand Doors", kind: "rain", anim: "raise", range: 580, cd: 6, dmg: 10, count: 8, radius: 190, wind: 0.34, rec: 0.3 }),
    M({ id: "matter-collapse", name: "Matter Collapse", kind: "zone", anim: "raise", range: 420, cd: 9, dmg: 8, radius: 150, dur: 4, pullIn: 320, erase: true, status: "slow", statusDur: 0.6, wind: 0.36 }),
    M({ id: "unmaking-gate", name: "Unmaking Gate", kind: "projectile", anim: "thrust", range: 700, minRange: 80, cd: 4.5, dmg: 20, speed: 420, size: 26, shape: "disc", pierce: true, kb: 420, wind: 0.32 }),
  ],
};

FORMS.sono = {
  power: "sono", kind: "nightmare", title: "FULL DISTORTION", ...NIGHTMARE,
  blurb: "The music breaks into distortion. His speakers blow out into black static, every hit lands on the beat and the arena shakes in time.",
  body: "hsl(220 20% 5%)", glow: "hsl(8 100% 58%)", a: "hsl(20 100% 50%)", b: "hsl(8 100% 66%)", dark: "hsl(0 0% 0%)",
  dmg: 1.35, kb: 1.25, cd: 0.7, speed: 1.2, act: 1.2,
  moves: [
    M({ id: "final-chorus", name: "Final Chorus", kind: "beam", anim: "thrust", range: 880, minRange: 60, cd: 5, dmg: 24, act: 0.4, kb: 400, wind: 0.4 }),
    M({ id: "mosh-pit", name: "Mosh Pit", kind: "zone", anim: "slam", range: 400, cd: 9, dmg: 8, radius: 160, dur: 4, pullIn: 300, status: "slow", statusDur: 0.6, wind: 0.34 }),
    M({ id: "earsplitter", name: "Earsplitter", kind: "eruption", anim: "slam", range: 640, minRange: 40, cd: 7, dmg: 15, radius: 48, count: 5, lift: -720, status: "stun", statusDur: 0.6, wind: 0.36, rec: 0.35 }),
  ],
};
FORMS.paper = {
  power: "paper", kind: "nightmare", title: "BLACK INK", ...NIGHTMARE,
  blurb: "Ink floods every page. The paper turns black and red, the cranes become a swarm and shots that fly into the ink are never seen again.",
  body: "hsl(0 0% 9%)", glow: "hsl(352 100% 56%)", a: "hsl(352 90% 44%)", b: "hsl(40 60% 90%)", dark: "hsl(0 0% 0%)",
  dmg: 1.3, kb: 1.2, cd: 0.7, speed: 1.2, act: 1.2,
  moves: [
    M({ id: "thousand-cranes", name: "Thousand Cranes", kind: "rain", anim: "raise", range: 580, cd: 6, dmg: 9, count: 9, radius: 190, wind: 0.34, rec: 0.3 }),
    M({ id: "ink-flood", name: "Ink Flood", kind: "zone", anim: "slam", range: 420, cd: 9, dmg: 8, radius: 150, dur: 4, pullIn: 260, erase: true, status: "blind", statusDur: 0.8, wind: 0.36 }),
    M({ id: "black-crane", name: "Black Crane", kind: "rain", anim: "raise", range: 620, cd: 4.5, dmg: 20, count: 1, radius: 40, size: 26, shape: "blade", kb: 420, wind: 0.32 }),
  ],
};
FORMS.crys = {
  power: "crys", kind: "nightmare", title: "BLACK DIAMOND", ...NIGHTMARE,
  blurb: "Its crystal turns to black diamond with red light burning in every facet. Diamonds fall like hail, and shots that fly into its prison shatter.",
  body: "hsl(280 20% 8%)", glow: "hsl(350 100% 60%)", a: "hsl(340 90% 44%)", b: "hsl(172 100% 74%)", dark: "hsl(0 0% 0%)",
  dmg: 1.3, kb: 1.25, cd: 0.7, speed: 1.15, act: 1.2,
  moves: [
    M({ id: "diamond-storm", name: "Diamond Storm", kind: "rain", anim: "raise", range: 580, cd: 6, dmg: 10, count: 8, radius: 190, shape: "shard", wind: 0.34, rec: 0.3 }),
    M({ id: "obsidian-prison", name: "Obsidian Prison", kind: "zone", anim: "slam", range: 420, cd: 9, dmg: 8, radius: 150, dur: 4, pullIn: 280, erase: true, status: "slow", statusDur: 0.6, wind: 0.36 }),
    M({ id: "spectrum-ray", name: "Spectrum Ray", kind: "beam", anim: "thrust", range: 880, minRange: 60, cd: 5, dmg: 24, act: 0.4, kb: 400, status: "blind", statusDur: 1, wind: 0.4 }),
  ],
};
FORMS.sand = {
  power: "sand", kind: "nightmare", title: "ENDLESS DESERT", ...NIGHTMARE,
  blurb: "The sand turns black and the sun behind it burns red. A wall of dust swallows the arena, glass tombs burst from the floor and the dunes roll over everyone.",
  body: "hsl(20 30% 10%)", glow: "hsl(10 100% 56%)", a: "hsl(16 90% 46%)", b: "hsl(40 90% 70%)", dark: "hsl(20 40% 3%)",
  dmg: 1.3, kb: 1.2, cd: 0.7, speed: 1.25, act: 1.2,
  moves: [
    M({ id: "haboob", name: "Haboob", kind: "zone", anim: "raise", range: 440, cd: 9, dmg: 8, radius: 180, dur: 4.5, pullIn: 200, status: "blind", statusDur: 0.8, wind: 0.36 }),
    M({ id: "glass-tomb", name: "Glass Tomb", kind: "eruption", anim: "slam", range: 620, minRange: 40, cd: 6.5, dmg: 13, radius: 46, count: 5, lift: -680, status: "stun", statusDur: 0.4, wind: 0.36 }),
    M({ id: "sand-sea", name: "Sand Sea", kind: "projectile", anim: "slam", range: 900, minRange: 60, cd: 6, dmg: 18, speed: 360, size: 30, pierce: true, ground: true, shape: "wave", kb: 420, lift: -320, status: "blind", statusDur: 1, wind: 0.4, rec: 0.35 }),
  ],
};
// ----- Surge Mode: the new generation's own form -----
// Built like Nightmare Mode (the same passives, and it can't be stunned or frozen) but it carries 12 original moves of its own.
const SURGE = NIGHTMARE;

FORMS.plasma = {
  power: "plasma", kind: "surge", title: "SUPERNOVA", ...SURGE,
  blurb: "Volta stops holding back. The plasma burns white and violet, a corona flares off every limb and each star thrown collapses into a nova.",
  body: "hsl(280 40% 10%)", glow: "hsl(0 0% 100%)", a: "hsl(285 100% 62%)", b: "hsl(190 100% 80%)", dark: "hsl(270 60% 3%)",
  dmg: 1.35, kb: 1.25, cd: 0.7, speed: 1.25, act: 1.2,
  moves: [
    M({ id: "corona-storm", name: "Corona Storm", kind: "rain", anim: "raise", range: 600, cd: 6, dmg: 10, count: 10, radius: 200, shape: "orb", status: "burn", statusDur: 1.5, wind: 0.34, rec: 0.3 }),
    M({ id: "white-dwarf", name: "White Dwarf", kind: "projectile", anim: "raise", range: 800, minRange: 80, cd: 5, dmg: 24, speed: 380, size: 30, shape: "orb", pierce: true, kb: 520, status: "burn", statusDur: 2, wind: 0.4 }),
    M({ id: "star-collapse", name: "Star Collapse", kind: "burst", anim: "raise", range: 200, cd: 8, dmg: 22, radius: 240, kb: 620, lift: -400, status: "burn", statusDur: 2, wind: 0.45, rec: 0.35 }),
    M({ id: "supernova-fist", name: "Supernova Fist", kind: "melee", anim: "uppercut", range: 92, cd: 1.1, dmg: 18, kb: 360, lift: -320, status: "burn", statusDur: 2 }),
    M({ id: "twin-star-barrage", name: "Twin Star Barrage", kind: "projectile", anim: "thrust", range: 640, minRange: 80, cd: 2.2, dmg: 13, speed: 780, size: 14, count: 2, spread: 0.1, shape: "orb", pierce: true, kb: 300, status: "burn", statusDur: 1.5 }),
    M({ id: "zenith-beam", name: "Zenith Beam", kind: "beam", anim: "thrust", range: 860, minRange: 70, cd: 4.6, dmg: 22, act: 0.4, kb: 420, status: "burn", statusDur: 2, wind: 0.4 }),
    M({ id: "solar-rush", name: "Solar Rush", kind: "dash", anim: "lunge", range: 460, cd: 3.6, dmg: 17, dist: 460, act: 0.22, kb: 400, lift: -220, status: "burn", statusDur: 1.5 }),
    M({ id: "singularity-step", name: "Singularity Step", kind: "blink", anim: "uppercut", range: 660, minRange: 100, cd: 3.4, dmg: 17, lift: -600, kb: 240 }),
    M({ id: "corona-eruption", name: "Corona Eruption", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 5.6, dmg: 16, radius: 48, count: 3, lift: -680, status: "burn", statusDur: 2, wind: 0.36 }),
    M({ id: "ion-cyclone", name: "Ion Cyclone", kind: "zone", anim: "spin", range: 420, cd: 8.5, dmg: 8, radius: 170, dur: 4.2, pullIn: 220, status: "stun", statusDur: 0.3, wind: 0.32 }),
    M({ id: "stellar-undertow", name: "Stellar Undertow", kind: "pull", anim: "cast", range: 520, minRange: 110, cd: 3.8, dmg: 11, status: "stun", statusDur: 0.4 }),
    M({ id: "core-ignition", name: "Core Ignition", kind: "heal", anim: "raise", range: 2000, cd: 13, dmg: 0, heal: 28, below: 0.5, wind: 0.36, rec: 0.3 }),
  ],
};
FORMS.flora = {
  power: "flora", kind: "surge", title: "WILD OVERGROWTH", ...SURGE,
  blurb: "The leaves turn black and the flowers bleed red. The floor splits under a forest of thorns, and nothing caught in it gets out.",
  body: "hsl(140 30% 8%)", glow: "hsl(350 100% 58%)", a: "hsl(140 40% 22%)", b: "hsl(350 100% 66%)", dark: "hsl(140 40% 3%)",
  dmg: 1.3, kb: 1.2, cd: 0.7, speed: 1.2, act: 1.2,
  moves: [
    M({ id: "thorn-forest", name: "Thorn Forest", kind: "eruption", anim: "slam", range: 620, minRange: 40, cd: 6.5, dmg: 14, radius: 46, count: 5, lift: -700, status: "poison", statusDur: 2, wind: 0.36 }),
    M({ id: "strangler-garden", name: "Strangler Garden", kind: "zone", anim: "slam", range: 440, cd: 9, dmg: 8, radius: 160, dur: 4.5, pullIn: 280, status: "slow", statusDur: 0.6, wind: 0.36 }),
    M({ id: "carnivore-bloom", name: "Carnivore Bloom", kind: "burst", anim: "raise", range: 180, cd: 7, dmg: 20, radius: 200, kb: 500, lift: -380, heal: 12, status: "poison", statusDur: 2, wind: 0.4, rec: 0.35 }),
    M({ id: "bramble-fist", name: "Bramble Fist", kind: "melee", anim: "uppercut", range: 88, cd: 1, dmg: 15, kb: 300, lift: -260, status: "poison", statusDur: 1.5 }),
    M({ id: "spore-volley", name: "Spore Volley", kind: "rain", anim: "cast", range: 560, cd: 2.4, dmg: 6, count: 6, radius: 150, size: 10, shape: "orb", status: "poison", statusDur: 2 }),
    M({ id: "needle-storm", name: "Needle Storm", kind: "projectile", anim: "thrust", range: 600, minRange: 90, cd: 2.6, dmg: 9, speed: 700, size: 9, count: 4, spread: 0.14, shape: "shard", pierce: true, status: "poison", statusDur: 1.5 }),
    M({ id: "seed-lance", name: "Seed Lance", kind: "beam", anim: "thrust", range: 640, minRange: 70, cd: 4, dmg: 19, act: 0.34, kb: 320, status: "poison", statusDur: 2, wind: 0.32 }),
    M({ id: "root-rush", name: "Root Rush", kind: "dash", anim: "lunge", range: 440, cd: 3.6, dmg: 16, dist: 440, act: 0.22, kb: 380, lift: -200 }),
    M({ id: "vine-step", name: "Vine Step", kind: "blink", anim: "kick", range: 640, minRange: 110, cd: 3.4, dmg: 16, kb: 320, lift: -260 }),
    M({ id: "toxic-canopy", name: "Toxic Canopy", kind: "rain", anim: "raise", range: 580, cd: 6, dmg: 9, count: 9, radius: 190, shape: "orb", status: "poison", statusDur: 2, wind: 0.34, rec: 0.3 }),
    M({ id: "deadfall-pull", name: "Deadfall Pull", kind: "pull", anim: "cast", range: 500, minRange: 110, cd: 3.6, dmg: 10, status: "stun", statusDur: 0.4 }),
    M({ id: "bloodroot-bloom", name: "Bloodroot Bloom", kind: "heal", anim: "raise", range: 2000, cd: 12, dmg: 0, heal: 30, below: 0.55, wind: 0.36, rec: 0.3 }),
  ],
};

/** Pyro's second step: from Blue Flame into red and blue fire at once. Stronger and faster than his Rage Mode. */
export const PERFECTED_FLAME: Form = {
  power: "pyro", kind: "perfected", title: "RED AND BLUE", at: 0.2, regen: 1,
  blurb: "Pushed past Blue Flame, he wields red and blue fire together. Stronger and faster than his Rage Mode.",
  body: "hsl(350 85% 52%)", glow: "hsl(0 0% 100%)", a: "hsl(2 95% 54%)", b: "hsl(214 100% 62%)",
  dmg: 1.65, kb: 1.3, cd: 0.55, speed: 1.4, act: 1.35,
  moves: [
    M({ id: "twin-dragon-flame", name: "Twin Dragon Flame", kind: "projectile", anim: "thrust", range: 620, minRange: 90, cd: 2.4, dmg: 13, speed: 760, size: 18, count: 2, spread: 0.12, pierce: true, status: "burn", statusDur: 3 }),
    M({ id: "crimson-azure-nova", name: "Crimson Azure Nova", kind: "burst", anim: "raise", range: 170, cd: 7, dmg: 24, radius: 230, kb: 560, lift: -420, status: "burn", statusDur: 3.5, wind: 0.36, rec: 0.35 }),
  ],
};

// ----- Turbo: Super Form, then Hyper Form -----
// Seven emeralds circle him and crash into him in a golden light; pushed further, a great emerald flashes, the seven turn
// into super emeralds and crash into him again in white and every colour at once (both cutscenes are in the arena engine).
FORMS.chaos = {
  power: "chaos", kind: "super", title: "SEVEN EMERALDS", at: 0.45, regen: 1.6, dodge: 0.15,
  blurb: "Seven emeralds circle him, spin faster and faster and crash into him in a burst of golden light. His whole body turns gold and he barely touches the ground.",
  body: "hsl(48 100% 58%)", glow: "hsl(52 100% 80%)", a: "hsl(46 100% 56%)", b: "hsl(54 100% 82%)",
  dmg: 1.35, kb: 1.2, cd: 0.72, speed: 1.3, act: 1.2,
  moves: [
    M({ id: "golden-fist", name: "Golden Fist", kind: "melee", anim: "uppercut", range: 90, cd: 1, dmg: 17, kb: 360, lift: -340 }),
    M({ id: "gold-rush", name: "Gold Rush", kind: "dash", anim: "lunge", range: 480, cd: 3.2, dmg: 17, dist: 480, act: 0.2, kb: 420, lift: -220 }),
    M({ id: "chaos-lance", name: "Chaos Lance", kind: "beam", anim: "thrust", range: 760, minRange: 70, cd: 4, dmg: 20, act: 0.36, kb: 380, wind: 0.34 }),
    M({ id: "emerald-volley", name: "Emerald Volley", kind: "projectile", anim: "cast", range: 620, minRange: 80, cd: 2.4, dmg: 6, speed: 820, size: 10, count: 7, spread: 0.2, shape: "shard" }),
    M({ id: "radiant-spin", name: "Radiant Spin", kind: "burst", anim: "spin", range: 170, cd: 5.5, dmg: 18, radius: 200, kb: 540, lift: -360, wind: 0.3 }),
    M({ id: "chaos-rain", name: "Chaos Rain", kind: "rain", anim: "raise", range: 580, cd: 6, dmg: 9, count: 9, radius: 190, shape: "shard", wind: 0.34, rec: 0.3 }),
    M({ id: "still-field", name: "Still Field", kind: "zone", anim: "raise", range: 400, cd: 9, dmg: 6, radius: 150, dur: 3.5, status: "stun", statusDur: 0.4, wind: 0.34 }),
    M({ id: "gilded-pull", name: "Gilded Chain", kind: "beam", anim: "cast", range: 620, minRange: 70, cd: 3.6, dmg: 14, act: 0.3, kb: 300, status: "stun", statusDur: 0.35, wind: 0.3 }),
    M({ id: "flash-step", name: "Flash Step", kind: "blink", anim: "uppercut", range: 680, minRange: 100, cd: 3.2, dmg: 16, lift: -580, kb: 240 }),
    M({ id: "chaos-pillar", name: "Chaos Pillar", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 5.4, dmg: 16, radius: 46, count: 3, lift: -680, wind: 0.34 }),
    M({ id: "golden-comet", name: "Golden Comet", kind: "projectile", anim: "raise", range: 760, minRange: 90, cd: 6, dmg: 22, speed: 460, size: 26, shape: "orb", pierce: true, kb: 500, wind: 0.4 }),
    M({ id: "emerald-mend", name: "Emerald Mend", kind: "heal", anim: "raise", range: 2000, cd: 13, dmg: 0, heal: 26, below: 0.5, wind: 0.36, rec: 0.3 }),
  ],
};

/** Turbo's second step: past Super Form into Hyper Form. Stronger and faster again, and it can't be stunned or frozen. */
export const HYPER_FORM: Form = {
  power: "chaos", kind: "hyper", title: "SUPER EMERALDS", at: 0.2, regen: 2.4, dodge: 0.25, guard: 0.85,
  blurb: "A great emerald flashes, the seven turn into super emeralds and crash into him in white and every colour at once. He shimmers through the whole rainbow and nothing can stop him moving.",
  body: "hsl(0 0% 96%)", glow: "hsl(0 0% 100%)", a: "hsl(190 100% 72%)", b: "hsl(310 100% 80%)",
  dmg: 1.7, kb: 1.35, cd: 0.55, speed: 1.45, act: 1.35,
  moves: [
    M({ id: "hyper-dash", name: "Hyper Dash", kind: "dash", anim: "lunge", range: 560, cd: 3, dmg: 20, dist: 560, act: 0.2, kb: 480, lift: -260 }),
    M({ id: "prism-nova", name: "Prism Nova", kind: "burst", anim: "raise", range: 200, cd: 7, dmg: 24, radius: 250, kb: 620, lift: -420, wind: 0.42, rec: 0.35 }),
    M({ id: "chromatic-lance", name: "Chromatic Lance", kind: "beam", anim: "thrust", range: 900, minRange: 70, cd: 4.6, dmg: 24, act: 0.4, kb: 440, status: "stun", statusDur: 0.3, wind: 0.38 }),
  ],
};

/** Every form a power has, in the order they come. */
export const formsOf = (p: Power): Form[] => (p === "pyro" ? [FORMS.pyro, PERFECTED_FLAME] : p === "chaos" ? [FORMS.chaos, HYPER_FORM] : [FORMS[p]]);
