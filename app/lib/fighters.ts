// The 16 fighters, the 9 quest fighters, the 3 new-generation fighters and their power moves. Shared by the arena engine and the Fighters page.
import { BOSSES, type BossId } from "./bosses";
import {
  OWN_BURSTS, OWN_GLYPHS, OWN_MOTIONS, OWN_TRAILS, designLook,
  type OwnBurst, type OwnGlyph, type OwnMotion, type OwnTrail, type PShape,
} from "./move-looks";

export type Power =
  | "pyro" | "cryo" | "electro" | "terra" | "aero" | "hydro" | "umbra" | "lux"
  | "gravi" | "tele" | "vita" | "toxi" | "chrono" | "magneto" | "psy" | "shift"
  // quest fighters, earned on the Quests page
  | "spatio" | "hexizon" | "gamma" | "velo" | "portal" | "sono" | "paper" | "crys" | "sand"
  // new generation, a chance to join after any Story boss win
  | "plasma" | "flora" | "chaos";

export type Role = "attacker" | "control" | "tank" | "support" | "trickster";

/** What a move does in the fight. */
export type MoveKind =
  | "melee"      // strike in front
  | "projectile" // fired from the hand
  | "beam"       // held ray from the hand
  | "burst"      // blast around the user
  | "dash"       // rush forward, hitting everyone in the path
  | "eruption"   // pillar bursts out of the ground under the target
  | "rain"       // falls from the sky around the target
  | "blink"      // vanish, reappear behind the target and strike
  | "heal"       // restore own health
  | "zone"       // lingering field on the ground
  | "pull"       // yank the target in
  | "mimic"      // borrow a move from the last power that hit
  | "warp"       // boss only: tear reality and move the whole fight to another realm (the Riftmaker and the Axiom)
  | "annihilate"; // boss only: matter and antimatter close in on the target from both sides and cancel out

/** Body animation the stickman plays for a move. */
export type Anim = "jab" | "kick" | "cast" | "thrust" | "raise" | "slam" | "uppercut" | "spin" | "lunge";

export type StatusEffect = "burn" | "slow" | "stun" | "poison" | "blind" | "freeze";

export type Move = {
  id: string;
  name: string;
  kind: MoveKind;
  anim: Anim;
  /** Furthest horizontal distance at which the fighter starts it. */
  range: number;
  minRange?: number;
  cd: number;
  dmg: number;
  /** Seconds of wind-up, active time and recovery. */
  wind: number;
  act: number;
  rec: number;
  kb?: number;
  lift?: number;
  status?: StatusEffect;
  statusDur?: number;
  speed?: number;
  size?: number;
  count?: number;
  spread?: number;
  arc?: boolean;
  pierce?: boolean;
  shape?: "orb" | "shard" | "rock" | "blade" | "wave" | "disc";
  radius?: number;
  /** Zone lifetime in seconds. */
  dur?: number;
  /** Zone pull strength toward its centre. */
  pullIn?: number;
  heal?: number;
  dist?: number;
  crit?: number;
  /** Only used below this share of health (heals). */
  below?: number;
  /** Element the move is drawn in, when it is not the fighter's own (a hybrid's second parent). */
  power?: Power;
  /** A shot that rolls along the floor instead of leaving the hand (a tidal wall). */
  ground?: boolean;
  /** A field that deletes enemy shots flying into it. */
  erase?: boolean;
  /** Reaches every enemy on the field, wherever they stand. */
  world?: boolean;
  /** A blast that reaches every enemy and pulls a soul out of each one; its `heal` is gained per enemy hit. */
  harvest?: boolean;
  /** A blast that reaches every enemy and darkens the whole arena under an eclipse. */
  eclipse?: boolean;
};

/** A Story boss's own body design, drawn by the engine on top of the stickman. */
export type BossDesign = "antimatter" | "maelstrom" | "magmaw" | "everwinter" | "riftmaker" | "hollow" | "blacksun" | "axiom" | "lanternmaw" | "sporemother" | "mnemovore" | "dustmoth" | "somnarch" | "hush" | "elderdark" | "perihelion" | "asterion" | "carina" | "vela" | "aeon";

export type FighterDef = {
  id: Power;
  name: string;
  power: string;
  role: Role;
  ability: string;
  color: string;
  glow: string;
  /** The stick figure's own fill, when it differs from `color` (which still tints its moves, bars and swatches). */
  body?: string;
  /** The stick figure's outline, when it is not the usual ink. */
  outline?: string;
  hp: number;
  speed: number;
  moves: Move[];
  /** Set on a hybrid: the two fighters it was fused from. */
  parents?: [Power, Power];
  /** Set on a Story boss: its own body design. A boss is no fighter's mix; `id` is only the voice and entrance it borrows. */
  boss?: BossDesign;
  /** Set on the fighter you made in Free World: its name, powers and look. */
  custom?: CustomSpec;
  /** Set on a Story minion: which kind it is, and the glowing colour of the boss it serves. `id` is only the power it fights with. */
  minion?: { kind: MinionKind; mark: string };
};

/** The kinds of minion each Story boss sends: small grunts, hooded casters, big brutes and one crowned lieutenant. */
export type MinionKind = "grunt" | "caster" | "brute" | "elite";

/** What you wear on the stick figure you made. */
export type Gear = "scarf" | "cape" | "headband" | "mask" | "none";
/** How tall your fighter stands. */
export type Build = "small" | "regular" | "tall";
/** Which of your powers' colours the body takes: the main colour, the glow, or black with a glowing outline. */
export type Shade = "main" | "glow" | "dark";
/** The character sheet. `powers` are the game's powers you picked; `own` is a power you invented, always your main one. */
export type CustomSpec = {
  name: string; powers: Power[]; gear: Gear; build: Build; shade: Shade; own?: OwnPower;
  /** Health you chose; unset means the powers and build decide it. */
  hp?: number;
  /** How many of its moves it fights with; unset means all of them. */
  moveCap?: number;
};

/** A power you typed in and the AI made up, with moves it designed itself (as many as it chose). */
export type OwnPower = {
  id: string;
  name: string;
  /** One short word its signature moves are named with. */
  word: string;
  about: string;
  /** The game element it sounds and arrives like. */
  base: Power;
  role: Role;
  color: string;
  glow: string;
  spark: PShape;
  /** The effect its moves leave; null when it leaves none. */
  status: StatusEffect | null;
  moves: OwnMove[];
};

const M = (m: Omit<Move, "wind" | "act" | "rec"> & Partial<Pick<Move, "wind" | "act" | "rec">>): Move => ({
  wind: 0.18,
  act: 0.12,
  rec: 0.22,
  ...m,
});

export const FIGHTERS: FighterDef[] = [
  {
    id: "pyro", name: "Pyro", power: "Pyrokinesis", role: "attacker",
    ability: "Burns everything it touches. Fire keeps hurting after the hit.",
    color: "hsl(14 92% 54%)", glow: "hsl(42 100% 60%)", hp: 100, speed: 92,
    moves: [
      M({ id: "ember-jab", name: "Ember Jab", kind: "melee", anim: "jab", range: 70, cd: 0.9, dmg: 7, kb: 140, status: "burn", statusDur: 1.5 }),
      M({ id: "fireball", name: "Fireball", kind: "projectile", anim: "cast", range: 560, minRange: 90, cd: 1.8, dmg: 10, speed: 540, size: 12, status: "burn", statusDur: 2 }),
      M({ id: "flame-pillar", name: "Flame Pillar", kind: "eruption", anim: "raise", range: 440, minRange: 60, cd: 4.5, dmg: 16, radius: 46, lift: -620, status: "burn", statusDur: 2.5, wind: 0.35 }),
      M({ id: "inferno-ring", name: "Inferno Ring", kind: "burst", anim: "slam", range: 120, cd: 6, dmg: 14, radius: 140, kb: 420, lift: -260, status: "burn", statusDur: 3, wind: 0.3, rec: 0.35 }),
    ],
  },
  {
    id: "cryo", name: "Cryo", power: "Cryokinesis", role: "control",
    ability: "Ice that slows enemies down and can freeze them solid.",
    color: "hsl(198 88% 62%)", glow: "hsl(190 100% 88%)", hp: 100, speed: 88,
    moves: [
      M({ id: "frost-palm", name: "Frost Palm", kind: "melee", anim: "thrust", range: 68, cd: 0.9, dmg: 7, kb: 160, status: "slow", statusDur: 1.5 }),
      M({ id: "ice-shard-volley", name: "Ice Shard Volley", kind: "projectile", anim: "cast", range: 520, minRange: 80, cd: 2, dmg: 5, speed: 640, size: 8, count: 3, spread: 0.12, shape: "shard", status: "slow", statusDur: 1.5 }),
      M({ id: "glacier-spike", name: "Glacier Spike", kind: "eruption", anim: "slam", range: 420, minRange: 60, cd: 5, dmg: 14, radius: 42, lift: -560, status: "freeze", statusDur: 0.9, wind: 0.35 }),
      M({ id: "frozen-floor", name: "Frozen Floor", kind: "zone", anim: "slam", range: 300, cd: 7, dmg: 4, radius: 120, dur: 3.5, status: "slow", statusDur: 0.6, wind: 0.3 }),
    ],
  },
  {
    id: "electro", name: "Electro", power: "Electrokinesis", role: "attacker",
    ability: "Fast lightning hits that stun for a split second.",
    color: "hsl(50 96% 54%)", glow: "hsl(58 100% 86%)", hp: 95, speed: 100,
    moves: [
      M({ id: "shock-knuckle", name: "Shock Knuckle", kind: "melee", anim: "jab", range: 70, cd: 0.8, dmg: 8, kb: 120, status: "stun", statusDur: 0.25, wind: 0.12 }),
      M({ id: "thunder-bolt", name: "Thunder Bolt", kind: "beam", anim: "cast", range: 400, minRange: 60, cd: 2.4, dmg: 12, act: 0.3, status: "stun", statusDur: 0.35 }),
      M({ id: "ball-lightning", name: "Ball Lightning", kind: "projectile", anim: "thrust", range: 600, minRange: 120, cd: 3.5, dmg: 11, speed: 260, size: 17, pierce: true, status: "stun", statusDur: 0.3 }),
      M({ id: "storm-call", name: "Storm Call", kind: "rain", anim: "raise", range: 480, cd: 6, dmg: 7, count: 5, radius: 130, status: "stun", statusDur: 0.3, wind: 0.35, rec: 0.3 }),
    ],
  },
  {
    id: "terra", name: "Terra", power: "Geokinesis", role: "tank",
    ability: "Slow but very tough. Rocks, spikes and ground-shaking stomps.",
    color: "hsl(28 52% 42%)", glow: "hsl(36 70% 70%)", hp: 150, speed: 70,
    moves: [
      M({ id: "boulder-fist", name: "Boulder Fist", kind: "melee", anim: "jab", range: 76, cd: 1.4, dmg: 12, kb: 320, wind: 0.24 }),
      M({ id: "rock-toss", name: "Rockslide", kind: "rain", anim: "slam", range: 480, cd: 3.2, dmg: 7, count: 3, radius: 90, size: 15, shape: "rock", kb: 180, wind: 0.3 }),
      M({ id: "earth-spike", name: "Earth Spike", kind: "eruption", anim: "slam", range: 420, minRange: 50, cd: 4, dmg: 15, radius: 44, lift: -700, wind: 0.35 }),
      M({ id: "quake-stomp", name: "Quake Stomp", kind: "burst", anim: "slam", range: 150, cd: 5.5, dmg: 13, radius: 180, kb: 200, lift: -420, status: "stun", statusDur: 0.4, wind: 0.35, rec: 0.35 }),
    ],
  },
  {
    id: "aero", name: "Aero", power: "Aerokinesis", role: "control",
    ability: "The fastest fighter. Blows enemies away and launches them high.",
    color: "hsl(168 58% 58%)", glow: "hsl(170 80% 90%)", hp: 90, speed: 140,
    moves: [
      M({ id: "gale-kick", name: "Gale Kick", kind: "melee", anim: "kick", range: 82, cd: 1, dmg: 8, kb: 380 }),
      M({ id: "wind-blade", name: "Wind Blade", kind: "projectile", anim: "thrust", range: 560, minRange: 80, cd: 1.6, dmg: 8, speed: 720, size: 13, shape: "blade", pierce: true }),
      M({ id: "cyclone-spin", name: "Cyclone Spin", kind: "dash", anim: "spin", range: 260, cd: 4, dmg: 9, dist: 260, act: 0.45, lift: -380, kb: 160 }),
      M({ id: "updraft", name: "Updraft", kind: "eruption", anim: "raise", range: 440, minRange: 50, cd: 4.5, dmg: 8, radius: 52, lift: -860, wind: 0.3 }),
    ],
  },
  {
    id: "hydro", name: "Hydro", power: "Hydrokinesis", role: "attacker",
    ability: "Waves and water jets that push enemies across the arena.",
    color: "hsl(214 86% 52%)", glow: "hsl(196 100% 80%)", hp: 105, speed: 90,
    moves: [
      M({ id: "splash-jab", name: "Splash Jab", kind: "melee", anim: "jab", range: 70, cd: 0.9, dmg: 7, kb: 220 }),
      M({ id: "water-whip", name: "Water Whip", kind: "melee", anim: "lunge", range: 150, minRange: 50, cd: 1.6, dmg: 10, kb: 260, wind: 0.22 }),
      M({ id: "tidal-wave", name: "Tidal Wave", kind: "projectile", anim: "cast", range: 600, minRange: 60, cd: 4, dmg: 10, speed: 380, size: 28, shape: "wave", pierce: true, kb: 420, wind: 0.3 }),
      M({ id: "geyser", name: "Geyser", kind: "eruption", anim: "raise", range: 440, minRange: 50, cd: 4.5, dmg: 13, radius: 46, lift: -780, wind: 0.35 }),
    ],
  },
  {
    id: "umbra", name: "Umbra", power: "Shadow manipulation", role: "trickster",
    ability: "Slips through shadows to strike from behind, often for critical hits.",
    color: "hsl(274 58% 40%)", glow: "hsl(280 70% 72%)", hp: 90, speed: 108,
    moves: [
      M({ id: "shade-slash", name: "Shade Slash", kind: "melee", anim: "lunge", range: 84, cd: 0.9, dmg: 9, kb: 160, crit: 0.2 }),
      M({ id: "shadow-step", name: "Shadow Step", kind: "blink", anim: "jab", range: 640, minRange: 90, cd: 3.5, dmg: 13, kb: 260, crit: 0.4, wind: 0.2 }),
      M({ id: "dark-orb", name: "Dark Orb", kind: "projectile", anim: "cast", range: 520, minRange: 90, cd: 2.2, dmg: 9, speed: 440, size: 14, status: "blind", statusDur: 1.5 }),
      M({ id: "night-veil", name: "Night Veil", kind: "zone", anim: "raise", range: 160, cd: 7, dmg: 5, radius: 115, dur: 3, status: "blind", statusDur: 0.8, wind: 0.3 }),
    ],
  },
  {
    id: "lux", name: "Lux", power: "Light manipulation", role: "control",
    ability: "Blinding light. A blinded fighter misses half its attacks.",
    color: "hsl(46 100% 66%)", glow: "hsl(52 100% 92%)", hp: 95, speed: 96,
    moves: [
      M({ id: "flash-jab", name: "Flash Jab", kind: "melee", anim: "jab", range: 70, cd: 0.9, dmg: 7, kb: 140, status: "blind", statusDur: 1 }),
      M({ id: "prism-beam", name: "Prism Beam", kind: "beam", anim: "cast", range: 560, minRange: 80, cd: 3, dmg: 14, act: 0.5, wind: 0.28 }),
      M({ id: "sun-flare", name: "Sun Flare", kind: "burst", anim: "raise", range: 140, cd: 5, dmg: 8, radius: 160, kb: 260, status: "blind", statusDur: 2.5, wind: 0.3 }),
      M({ id: "light-lances", name: "Light Lances", kind: "rain", anim: "raise", range: 480, cd: 4, dmg: 7, count: 4, radius: 90, wind: 0.3 }),
    ],
  },
  {
    id: "gravi", name: "Gravi", power: "Gravity control", role: "control",
    ability: "Bends gravity to drag enemies in and drop rocks on them.",
    color: "hsl(240 56% 50%)", glow: "hsl(250 90% 80%)", hp: 110, speed: 82,
    moves: [
      M({ id: "heavy-palm", name: "Heavy Palm", kind: "melee", anim: "thrust", range: 70, cd: 1.1, dmg: 9, kb: 300 }),
      M({ id: "singularity", name: "Singularity", kind: "zone", anim: "cast", range: 420, minRange: 60, cd: 6, dmg: 6, radius: 95, dur: 2.5, pullIn: 380, status: "slow", statusDur: 0.5, wind: 0.3 }),
      M({ id: "gravity-pull", name: "Gravity Pull", kind: "pull", anim: "cast", range: 400, minRange: 100, cd: 3, dmg: 8, status: "stun", statusDur: 0.4 }),
      M({ id: "meteor-drop", name: "Meteor Drop", kind: "rain", anim: "raise", range: 480, cd: 5, dmg: 11, count: 3, radius: 80, shape: "rock", size: 18, wind: 0.35 }),
    ],
  },
  {
    id: "tele", name: "Tele", power: "Teleportation", role: "trickster",
    ability: "Blinks around the arena and dodges one in four hits.",
    color: "hsl(312 78% 58%)", glow: "hsl(300 100% 86%)", hp: 85, speed: 100,
    moves: [
      M({ id: "warp-kick", name: "Warp Kick", kind: "blink", anim: "kick", range: 600, minRange: 80, cd: 2.5, dmg: 11, kb: 300 }),
      M({ id: "phase-shot", name: "Phase Shot", kind: "projectile", anim: "thrust", range: 580, minRange: 80, cd: 1.3, dmg: 8, speed: 660, size: 9, shape: "disc" }),
      M({ id: "blink-barrage", name: "Blink Barrage", kind: "dash", anim: "lunge", range: 300, cd: 3.5, dmg: 9, dist: 300, act: 0.25, kb: 200 }),
      M({ id: "rift-burst", name: "Rift Burst", kind: "burst", anim: "raise", range: 120, cd: 5, dmg: 10, radius: 125, kb: 380, wind: 0.25 }),
    ],
  },
  {
    id: "vita", name: "Vita", power: "Healing", role: "support",
    ability: "Heals over time and patches itself up mid-fight.",
    color: "hsl(140 58% 44%)", glow: "hsl(110 80% 78%)", hp: 110, speed: 86,
    moves: [
      M({ id: "life-tap", name: "Life Tap", kind: "melee", anim: "jab", range: 70, cd: 1, dmg: 7, kb: 140, heal: 4 }),
      M({ id: "mend", name: "Mend", kind: "heal", anim: "raise", range: 2000, cd: 7, dmg: 0, heal: 22, below: 0.7, wind: 0.3, act: 0.3 }),
      M({ id: "thorn-seed", name: "Thorn Seed", kind: "projectile", anim: "cast", range: 500, minRange: 90, cd: 2, dmg: 8, speed: 440, size: 10, arc: true, status: "poison", statusDur: 2 }),
      M({ id: "bloom-burst", name: "Bloom Burst", kind: "burst", anim: "raise", range: 130, cd: 6, dmg: 8, radius: 130, kb: 260, heal: 10, wind: 0.3 }),
    ],
  },
  {
    id: "toxi", name: "Toxi", power: "Poison", role: "attacker",
    ability: "Poison that keeps eating away at health.",
    color: "hsl(86 78% 46%)", glow: "hsl(80 100% 72%)", hp: 100, speed: 88,
    moves: [
      M({ id: "venom-jab", name: "Venom Jab", kind: "melee", anim: "jab", range: 70, cd: 0.9, dmg: 6, kb: 120, status: "poison", statusDur: 3 }),
      M({ id: "acid-spit", name: "Acid Spit", kind: "projectile", anim: "thrust", range: 500, minRange: 80, cd: 1.8, dmg: 6, speed: 500, size: 10, arc: true, status: "poison", statusDur: 3 }),
      M({ id: "miasma-cloud", name: "Miasma Cloud", kind: "zone", anim: "cast", range: 420, cd: 6, dmg: 5, radius: 100, dur: 4, status: "poison", statusDur: 1.5, wind: 0.3 }),
      M({ id: "plague-burst", name: "Plague Burst", kind: "burst", anim: "slam", range: 130, cd: 5.5, dmg: 9, radius: 135, kb: 300, status: "poison", statusDur: 4, wind: 0.3 }),
    ],
  },
  {
    id: "chrono", name: "Chrono", power: "Time manipulation", role: "control",
    ability: "Slows enemies down and rewinds its own wounds.",
    color: "hsl(38 94% 52%)", glow: "hsl(45 100% 80%)", hp: 100, speed: 92,
    moves: [
      M({ id: "tick-strike", name: "Tick Strike", kind: "melee", anim: "jab", range: 70, cd: 0.8, dmg: 7, kb: 140, wind: 0.12 }),
      M({ id: "time-bolt", name: "Time Bolt", kind: "projectile", anim: "cast", range: 540, minRange: 80, cd: 1.8, dmg: 9, speed: 540, size: 11, shape: "disc", status: "slow", statusDur: 2 }),
      M({ id: "stasis-field", name: "Stasis Field", kind: "zone", anim: "raise", range: 420, cd: 6, dmg: 2, radius: 100, dur: 3, status: "freeze", statusDur: 0.35, wind: 0.3 }),
      M({ id: "rewind", name: "Rewind", kind: "heal", anim: "raise", range: 2000, cd: 9, dmg: 0, heal: 18, below: 0.6, wind: 0.3, act: 0.4 }),
    ],
  },
  {
    id: "magneto", name: "Magneto", power: "Magnetism", role: "tank",
    ability: "Pulls enemies close and fires metal at them. Bends projectiles away.",
    color: "hsl(0 70% 50%)", glow: "hsl(210 20% 86%)", hp: 115, speed: 80,
    moves: [
      M({ id: "iron-fist", name: "Iron Fist", kind: "melee", anim: "jab", range: 72, cd: 1.1, dmg: 10, kb: 260, wind: 0.2 }),
      M({ id: "shard-storm", name: "Shard Storm", kind: "projectile", anim: "cast", range: 520, minRange: 70, cd: 2.2, dmg: 4, speed: 640, size: 8, count: 4, spread: 0.2, shape: "shard" }),
      M({ id: "magnet-pull", name: "Magnet Pull", kind: "pull", anim: "thrust", range: 420, minRange: 100, cd: 3, dmg: 7, status: "stun", statusDur: 0.3 }),
      M({ id: "railgun", name: "Railgun", kind: "beam", anim: "thrust", range: 640, minRange: 80, cd: 5, dmg: 16, act: 0.2, kb: 500, wind: 0.4 }),
    ],
  },
  {
    id: "psy", name: "Psy", power: "Telekinesis", role: "control",
    ability: "Lifts enemies with the mind and slams them down.",
    color: "hsl(330 84% 66%)", glow: "hsl(320 100% 88%)", hp: 95, speed: 92,
    moves: [
      M({ id: "mind-jab", name: "Mind Jab", kind: "melee", anim: "thrust", range: 92, cd: 1, dmg: 8, kb: 220 }),
      M({ id: "psychic-lift", name: "Psychic Lift", kind: "eruption", anim: "raise", range: 440, minRange: 50, cd: 3.5, dmg: 12, radius: 40, lift: -680, status: "stun", statusDur: 0.6, wind: 0.3 }),
      M({ id: "psi-wave", name: "Psi Wave", kind: "projectile", anim: "cast", range: 560, minRange: 60, cd: 3, dmg: 8, speed: 440, size: 22, shape: "wave", pierce: true, status: "stun", statusDur: 0.3 }),
      M({ id: "mind-crush", name: "Mind Crush", kind: "pull", anim: "raise", range: 440, minRange: 100, cd: 5, dmg: 11, status: "stun", statusDur: 0.8, wind: 0.3 }),
    ],
  },
  {
    id: "shift", name: "Shift", power: "Shapeshifting", role: "trickster",
    ability: "Turns its arm into a blade and copies the last power that hit it.",
    color: "hsl(186 84% 46%)", glow: "hsl(180 100% 82%)", hp: 100, speed: 96,
    moves: [
      M({ id: "morph-strike", name: "Morph Strike", kind: "melee", anim: "lunge", range: 80, cd: 1, dmg: 9, kb: 180 }),
      M({ id: "mimic", name: "Mimic", kind: "mimic", anim: "cast", range: 400, cd: 3, dmg: 0 }),
      M({ id: "blade-arm", name: "Blade Arm", kind: "melee", anim: "lunge", range: 115, minRange: 40, cd: 2, dmg: 12, kb: 240, wind: 0.22 }),
      M({ id: "slime-shot", name: "Slime Shot", kind: "projectile", anim: "thrust", range: 500, minRange: 80, cd: 2, dmg: 8, speed: 480, size: 12, arc: true, status: "slow", statusDur: 1.5 }),
    ],
  },
];

// ---------- Quest fighters ----------
// Earned on the Quests page and kept in this browser (app/lib/quests.ts). Each has 12 moves, its own look
// (app/lib/quest-designs.ts), entrance, stance, voice and a Nightmare Mode form. Strong enough to beat a Story boss alone.

export const QUESTERS: FighterDef[] = [
  {
    id: "spatio", name: "Parallax", power: "Spatiokinesis", role: "control",
    ability: "Bends space itself. Folds the arena to step anywhere, cuts through distance and locks enemies in spatial prisons.",
    color: "hsl(234 48% 26%)", glow: "hsl(188 100% 70%)", hp: 300, speed: 104,
    moves: [
      M({ id: "fold-palm", name: "Fold Palm", kind: "melee", anim: "thrust", range: 78, cd: 0.8, dmg: 10, kb: 260 }),
      M({ id: "rend-reach", name: "Rend Reach", kind: "melee", anim: "lunge", range: 150, minRange: 50, cd: 1.6, dmg: 13, kb: 300, wind: 0.2 }),
      M({ id: "spatial-cut", name: "Spatial Cut", kind: "beam", anim: "thrust", range: 560, minRange: 70, cd: 2.6, dmg: 15, act: 0.22, kb: 200, wind: 0.24 }),
      M({ id: "space-fold", name: "Space Fold", kind: "blink", anim: "kick", range: 640, minRange: 110, cd: 3, dmg: 14, kb: 320, lift: -260 }),
      M({ id: "pocket-pull", name: "Pocket Pull", kind: "pull", anim: "cast", range: 460, minRange: 110, cd: 3.4, dmg: 10, status: "stun", statusDur: 0.35 }),
      M({ id: "repulse-plane", name: "Repulse Plane", kind: "burst", anim: "thrust", range: 140, cd: 5, dmg: 14, radius: 165, kb: 620, lift: -240, wind: 0.24 }),
      M({ id: "spatial-prison", name: "Spatial Prison", kind: "zone", anim: "raise", range: 420, minRange: 40, cd: 8, dmg: 6, radius: 110, dur: 3.5, pullIn: 260, status: "slow", statusDur: 0.6, wind: 0.32 }),
      M({ id: "lattice-shards", name: "Lattice Shards", kind: "projectile", anim: "cast", range: 580, minRange: 80, cd: 2.2, dmg: 6, speed: 700, size: 9, count: 4, spread: 0.16, shape: "shard" }),
      M({ id: "compression", name: "Compression", kind: "eruption", anim: "slam", range: 480, minRange: 50, cd: 4.5, dmg: 16, radius: 50, lift: -700, status: "stun", statusDur: 0.4, wind: 0.32 }),
      M({ id: "fracture-rain", name: "Fracture Rain", kind: "rain", anim: "raise", range: 520, cd: 5.5, dmg: 8, count: 6, radius: 150, shape: "shard", wind: 0.32 }),
      M({ id: "distance-zero", name: "Distance Zero", kind: "dash", anim: "lunge", range: 340, cd: 3.6, dmg: 13, dist: 340, act: 0.2, kb: 340 }),
      M({ id: "rift-disc", name: "Rift Disc", kind: "projectile", anim: "thrust", range: 620, minRange: 90, cd: 3, dmg: 12, speed: 520, size: 15, shape: "disc", pierce: true, kb: 240 }),
    ],
  },
  {
    id: "hexizon", name: "Hexizon", power: "Indie Game Manipulation", role: "attacker",
    ability: "Pulls powers out of indie games. Skull blasters, walls of bones, a roundabout of orbs and a bone staff swung like a monk's.",
    color: "hsl(150 30% 4%)", glow: "hsl(128 100% 58%)", hp: 290, speed: 108,
    moves: [
      M({ id: "bone-staff", name: "Bone Staff", kind: "melee", anim: "spin", range: 104, cd: 0.85, dmg: 11, kb: 260 }),
      M({ id: "staff-vault", name: "Staff Vault Kick", kind: "melee", anim: "kick", range: 96, cd: 1.3, dmg: 12, kb: 300, lift: -380 }),
      M({ id: "gaster-blaster", name: "Gaster Blaster", kind: "beam", anim: "cast", range: 600, minRange: 70, cd: 3.2, dmg: 18, act: 0.4, wind: 0.36, kb: 260 }),
      M({ id: "bone-barrage", name: "Bone Barrage", kind: "projectile", anim: "thrust", range: 580, minRange: 80, cd: 2.2, dmg: 5, speed: 680, size: 9, count: 5, spread: 0.14, shape: "blade" }),
      M({ id: "bone-zone", name: "Bone Zone", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 5, dmg: 12, radius: 44, count: 4, lift: -620, wind: 0.34 }),
      M({ id: "blue-soul", name: "Blue Soul", kind: "pull", anim: "cast", range: 460, minRange: 110, cd: 4, dmg: 10, status: "stun", statusDur: 0.5 }),
      M({ id: "jumbo-roundabout", name: "Jumbo Roundabout", kind: "projectile", anim: "thrust", range: 620, minRange: 90, cd: 4.2, dmg: 15, speed: 300, size: 24, pierce: true, kb: 300, wind: 0.26 }),
      M({ id: "spread-shot", name: "Spread Shot", kind: "projectile", anim: "jab", range: 420, minRange: 60, cd: 1.5, dmg: 5, speed: 760, size: 7, count: 3, spread: 0.26 }),
      M({ id: "parry-dash", name: "Parry Dash", kind: "dash", anim: "lunge", range: 320, cd: 3.4, dmg: 12, dist: 320, act: 0.22, kb: 320, lift: -200 }),
      M({ id: "glitch-step", name: "Glitch Step", kind: "blink", anim: "uppercut", range: 600, minRange: 110, cd: 3.2, dmg: 13, lift: -560, kb: 160 }),
      M({ id: "abyss-shriek", name: "Abyss Shriek", kind: "burst", anim: "raise", range: 150, cd: 6, dmg: 16, radius: 175, kb: 440, lift: -420, status: "blind", statusDur: 1.2, wind: 0.3 }),
      M({ id: "karma-field", name: "Karma Field", kind: "zone", anim: "slam", range: 380, cd: 8, dmg: 5, radius: 130, dur: 4, status: "poison", statusDur: 1.5, wind: 0.32 }),
    ],
  },
  {
    id: "gamma", name: "Halflife", power: "Gamma Radiation", role: "tank",
    ability: "A walking reactor. Every hit leaks radiation that keeps burning, and the hotter the fight runs, the closer he gets to meltdown.",
    color: "hsl(100 45% 16%)", glow: "hsl(78 100% 56%)", hp: 340, speed: 90,
    moves: [
      M({ id: "rad-fist", name: "Rad Fist", kind: "melee", anim: "jab", range: 80, cd: 0.9, dmg: 11, kb: 280 }),
      M({ id: "meltdown-hook", name: "Meltdown Hook", kind: "melee", anim: "uppercut", range: 92, cd: 1.6, dmg: 14, kb: 220, lift: -520, wind: 0.22 }),
      M({ id: "gamma-ray", name: "Gamma Ray", kind: "beam", anim: "thrust", range: 600, minRange: 70, cd: 3.2, dmg: 17, act: 0.36, kb: 240, status: "poison", statusDur: 1.5, wind: 0.32 }),
      M({ id: "isotope-shot", name: "Isotope Shot", kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 1.8, dmg: 9, speed: 560, size: 13, status: "poison", statusDur: 2 }),
      M({ id: "fission-split", name: "Fission Split", kind: "projectile", anim: "thrust", range: 580, minRange: 90, cd: 2.6, dmg: 7, speed: 620, size: 11, count: 3, spread: 0.2, shape: "orb" }),
      M({ id: "critical-pulse", name: "Critical Pulse", kind: "burst", anim: "slam", range: 150, cd: 5.5, dmg: 16, radius: 180, kb: 520, lift: -300, status: "poison", statusDur: 1.5, wind: 0.3 }),
      M({ id: "fallout-zone", name: "Fallout Zone", kind: "zone", anim: "raise", range: 400, cd: 8, dmg: 6, radius: 130, dur: 4, status: "poison", statusDur: 1.2, wind: 0.32 }),
      M({ id: "core-slam", name: "Core Slam", kind: "eruption", anim: "slam", range: 480, minRange: 40, cd: 4.5, dmg: 15, radius: 52, lift: -640, wind: 0.32 }),
      M({ id: "fallout-rain", name: "Fallout Rain", kind: "rain", anim: "raise", range: 520, cd: 5.5, dmg: 8, count: 6, radius: 150, status: "poison", statusDur: 1, wind: 0.32 }),
      M({ id: "reactor-charge", name: "Reactor Charge", kind: "dash", anim: "lunge", range: 300, cd: 3.8, dmg: 14, dist: 300, act: 0.25, kb: 420, lift: -200 }),
      M({ id: "neutron-pull", name: "Neutron Pull", kind: "pull", anim: "cast", range: 440, minRange: 110, cd: 4, dmg: 9, status: "stun", statusDur: 0.35 }),
      M({ id: "cell-mutation", name: "Cell Mutation", kind: "heal", anim: "raise", range: 2000, cd: 12, dmg: 0, heal: 22, below: 0.6, wind: 0.36, rec: 0.3 }),
    ],
  },
  {
    id: "velo", name: "Redline", power: "Superspeed", role: "trickster",
    ability: "Moves faster than the arena can draw him. Leaves afterimages that still hit, throws a hundred punches a second and turns laps into tornadoes.",
    color: "hsl(356 72% 40%)", glow: "hsl(44 100% 62%)", hp: 260, speed: 165,
    moves: [
      M({ id: "blur-jab", name: "Blur Jab", kind: "melee", anim: "jab", range: 74, cd: 0.5, dmg: 7, kb: 160, wind: 0.1 }),
      M({ id: "hundred-fists", name: "Hundred Fists", kind: "melee", anim: "jab", range: 88, cd: 1.6, dmg: 13, kb: 300, act: 0.24, wind: 0.14 }),
      M({ id: "slipstream-kick", name: "Slipstream Kick", kind: "melee", anim: "kick", range: 96, cd: 1.2, dmg: 11, kb: 260, lift: -360 }),
      M({ id: "mach-rush", name: "Mach Rush", kind: "dash", anim: "lunge", range: 420, cd: 2.6, dmg: 12, dist: 420, act: 0.16, kb: 340 }),
      M({ id: "sonic-boom", name: "Sonic Boom", kind: "projectile", anim: "thrust", range: 600, minRange: 80, cd: 2.2, dmg: 11, speed: 820, size: 16, shape: "wave", pierce: true, kb: 260 }),
      M({ id: "afterimage", name: "Afterimage", kind: "blink", anim: "kick", range: 620, minRange: 100, cd: 2.4, dmg: 12, kb: 300, lift: -240 }),
      M({ id: "vortex-laps", name: "Vortex Laps", kind: "zone", anim: "spin", range: 360, cd: 8, dmg: 5, radius: 140, dur: 3.5, pullIn: 280, wind: 0.28 }),
      M({ id: "friction-burn", name: "Friction Burn", kind: "burst", anim: "spin", range: 140, cd: 5, dmg: 13, radius: 160, kb: 480, lift: -260, status: "burn", statusDur: 2, wind: 0.22 }),
      M({ id: "mach-pebbles", name: "Mach Pebbles", kind: "projectile", anim: "jab", range: 520, minRange: 60, cd: 1.6, dmg: 4, speed: 900, size: 7, count: 5, spread: 0.14, shape: "rock" }),
      M({ id: "skyfall-heel", name: "Skyfall Heel", kind: "eruption", anim: "kick", range: 520, minRange: 40, cd: 4, dmg: 14, radius: 46, lift: -660, wind: 0.24 }),
      M({ id: "slingshot", name: "Slingshot", kind: "pull", anim: "cast", range: 460, minRange: 110, cd: 3.6, dmg: 9, status: "stun", statusDur: 0.3 }),
      M({ id: "lightspeed-lunge", name: "Lightspeed Lunge", kind: "melee", anim: "lunge", range: 165, minRange: 50, cd: 1.8, dmg: 13, kb: 320, wind: 0.14 }),
    ],
  },
  {
    id: "portal", name: "Liminal", power: "Portal and Matter Manipulation", role: "control",
    ability: "Opens doors anywhere and rebuilds whatever comes through them. Punches through portals, drops things from the sky and pulls itself back together.",
    color: "hsl(265 30% 14%)", glow: "hsl(318 100% 66%)", hp: 300, speed: 102,
    moves: [
      M({ id: "portal-punch", name: "Portal Punch", kind: "melee", anim: "thrust", range: 160, minRange: 40, cd: 1, dmg: 11, kb: 260 }),
      M({ id: "matter-palm", name: "Matter Palm", kind: "melee", anim: "jab", range: 80, cd: 0.8, dmg: 9, kb: 240 }),
      M({ id: "ring-gate", name: "Ring Gate", kind: "projectile", anim: "thrust", range: 620, minRange: 90, cd: 2.8, dmg: 13, speed: 480, size: 18, shape: "disc", pierce: true, kb: 280 }),
      M({ id: "portal-volley", name: "Portal Volley", kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 2, dmg: 6, speed: 640, size: 9, count: 3, spread: 0.18, shape: "orb" }),
      M({ id: "matter-lance", name: "Matter Lance", kind: "beam", anim: "thrust", range: 580, minRange: 70, cd: 3, dmg: 16, act: 0.3, kb: 260, wind: 0.28 }),
      M({ id: "portal-drop", name: "Portal Drop", kind: "rain", anim: "raise", range: 540, cd: 5, dmg: 9, count: 5, radius: 150, wind: 0.32 }),
      M({ id: "back-door", name: "Back Door", kind: "blink", anim: "kick", range: 640, minRange: 110, cd: 3, dmg: 13, kb: 320, lift: -260 }),
      M({ id: "transmute-floor", name: "Transmute Floor", kind: "zone", anim: "slam", range: 400, cd: 8, dmg: 5, radius: 135, dur: 4, status: "slow", statusDur: 0.6, wind: 0.32 }),
      M({ id: "matter-spike", name: "Matter Spike", kind: "eruption", anim: "slam", range: 500, minRange: 40, cd: 4.2, dmg: 14, radius: 44, count: 2, lift: -600, wind: 0.3 }),
      M({ id: "portal-pull", name: "Portal Pull", kind: "pull", anim: "cast", range: 480, minRange: 110, cd: 3.6, dmg: 10, status: "stun", statusDur: 0.35 }),
      M({ id: "unmake", name: "Unmake", kind: "burst", anim: "raise", range: 150, cd: 5.5, dmg: 15, radius: 170, kb: 540, lift: -280, wind: 0.3 }),
      M({ id: "reassemble", name: "Reassemble", kind: "heal", anim: "raise", range: 2000, cd: 12, dmg: 0, heal: 20, below: 0.6, wind: 0.36, rec: 0.3 }),
    ],
  },
  {
    id: "sono", name: "Overtone", power: "Sound Manipulation", role: "attacker",
    ability: "Turns sound into a weapon. Beats that hit like fists, chords that knock fighters flat and a bass drop that throws them into the sky.",
    color: "hsl(220 14% 14%)", glow: "hsl(36 100% 58%)", hp: 280, speed: 106,
    moves: [
      M({ id: "beat-jab", name: "Beat Jab", kind: "melee", anim: "jab", range: 76, cd: 0.7, dmg: 9, kb: 220, wind: 0.12 }),
      M({ id: "downbeat", name: "Downbeat", kind: "melee", anim: "slam", range: 92, cd: 1.5, dmg: 14, kb: 200, lift: -460, wind: 0.22 }),
      M({ id: "power-chord", name: "Power Chord", kind: "projectile", anim: "cast", range: 600, minRange: 70, cd: 2.6, dmg: 12, speed: 600, size: 20, shape: "wave", pierce: true, kb: 280 }),
      M({ id: "staccato", name: "Staccato", kind: "rain", anim: "jab", range: 500, cd: 2, dmg: 4, size: 8, count: 5, radius: 120 }),
      M({ id: "wall-of-sound", name: "Wall of Sound", kind: "beam", anim: "thrust", range: 580, minRange: 70, cd: 3, dmg: 16, act: 0.36, kb: 320, wind: 0.3 }),
      M({ id: "bass-drop", name: "Bass Drop", kind: "eruption", anim: "slam", range: 500, minRange: 40, cd: 4.5, dmg: 16, radius: 54, lift: -680, wind: 0.32 }),
      M({ id: "high-note", name: "High Note", kind: "burst", anim: "raise", range: 150, cd: 5.5, dmg: 14, radius: 170, kb: 460, lift: -260, status: "stun", statusDur: 0.5, wind: 0.3 }),
      M({ id: "echo-step", name: "Echo Step", kind: "blink", anim: "kick", range: 620, minRange: 100, cd: 3, dmg: 13, kb: 300, lift: -240 }),
      M({ id: "dead-air", name: "Dead Air", kind: "zone", anim: "raise", range: 400, cd: 8, dmg: 5, radius: 125, dur: 3.5, status: "blind", statusDur: 0.8, wind: 0.32 }),
      M({ id: "drumroll", name: "Drumroll", kind: "rain", anim: "raise", range: 520, cd: 5.5, dmg: 7, count: 7, radius: 150, wind: 0.32 }),
      M({ id: "feedback", name: "Feedback", kind: "pull", anim: "cast", range: 460, minRange: 110, cd: 3.6, dmg: 10, status: "stun", statusDur: 0.35 }),
      M({ id: "crescendo-rush", name: "Crescendo Rush", kind: "dash", anim: "lunge", range: 320, cd: 3.6, dmg: 14, dist: 320, act: 0.22, kb: 380 }),
    ],
  },
  {
    id: "paper", name: "Vellum", power: "Paper Manipulation", role: "support",
    ability: "Folds paper into anything. Blades sharp enough to cut, flocks of cranes, scrolls that bind and a body that refolds its own wounds.",
    color: "hsl(42 35% 88%)", glow: "hsl(352 85% 56%)", hp: 290, speed: 104,
    moves: [
      M({ id: "papercut", name: "Papercut", kind: "melee", anim: "lunge", range: 90, cd: 0.8, dmg: 9, kb: 200, crit: 0.25 }),
      M({ id: "folded-fan", name: "Folded Fan", kind: "melee", anim: "spin", range: 100, cd: 1.4, dmg: 12, kb: 320, heal: 3 }),
      M({ id: "crane-flock", name: "Crane Flock", kind: "rain", anim: "cast", range: 520, cd: 2.6, dmg: 5, size: 10, count: 4, radius: 120, shape: "blade" }),
      M({ id: "shuriken-fold", name: "Shuriken Fold", kind: "projectile", anim: "thrust", range: 600, minRange: 80, cd: 2.4, dmg: 11, speed: 680, size: 13, shape: "disc", pierce: true, kb: 240 }),
      M({ id: "scroll-unfurl", name: "Scroll Unfurl", kind: "beam", anim: "thrust", range: 540, minRange: 70, cd: 3, dmg: 15, act: 0.3, kb: 260, status: "slow", statusDur: 1, wind: 0.28 }),
      M({ id: "thousand-folds", name: "Thousand Folds", kind: "burst", anim: "raise", range: 150, cd: 5, dmg: 13, radius: 160, kb: 480, lift: -240, wind: 0.28 }),
      M({ id: "wrapping-seal", name: "Wrapping Seal", kind: "zone", anim: "raise", range: 420, minRange: 40, cd: 8, dmg: 5, radius: 115, dur: 3.5, pullIn: 220, status: "slow", statusDur: 0.6, wind: 0.32 }),
      M({ id: "paper-rain", name: "Paper Rain", kind: "rain", anim: "raise", range: 520, cd: 5.5, dmg: 7, count: 7, radius: 160, shape: "blade", wind: 0.32 }),
      M({ id: "folding-spire", name: "Folding Spire", kind: "eruption", anim: "slam", range: 480, minRange: 40, cd: 4.2, dmg: 14, radius: 46, lift: -600, wind: 0.3 }),
      M({ id: "paper-plane", name: "Paper Plane", kind: "dash", anim: "lunge", range: 320, cd: 3.4, dmg: 12, dist: 320, act: 0.22, kb: 300, lift: -220 }),
      M({ id: "paper-tether", name: "Paper Tether", kind: "pull", anim: "cast", range: 460, minRange: 110, cd: 3.6, dmg: 9, status: "stun", statusDur: 0.35 }),
      M({ id: "refold", name: "Refold", kind: "heal", anim: "raise", range: 2000, cd: 11, dmg: 0, heal: 24, below: 0.65, wind: 0.34, rec: 0.3 }),
    ],
  },
  {
    id: "crys", name: "Facet", power: "Crystal Manipulation", role: "tank",
    ability: "Grows crystal out of anything. Spires burst from the floor, gems fly like bullets, light splits through its prisms and its body grows back facet by facet.",
    color: "hsl(286 38% 60%)", glow: "hsl(172 100% 70%)", hp: 320, speed: 94,
    moves: [
      M({ id: "facet-jab", name: "Facet Jab", kind: "melee", anim: "jab", range: 76, cd: 0.85, dmg: 10, kb: 240 }),
      M({ id: "geode-crush", name: "Geode Crush", kind: "melee", anim: "slam", range: 90, cd: 1.5, dmg: 14, kb: 220, lift: -460, wind: 0.22 }),
      M({ id: "prism-split", name: "Prism Split", kind: "beam", anim: "thrust", range: 580, minRange: 70, cd: 3, dmg: 16, act: 0.32, kb: 240, status: "blind", statusDur: 0.6, wind: 0.3 }),
      M({ id: "crystal-spray", name: "Crystal Hail", kind: "rain", anim: "raise", range: 520, cd: 2.6, dmg: 5, size: 9, count: 5, radius: 130, shape: "shard" }),
      M({ id: "gem-lance", name: "Gem Lance", kind: "projectile", anim: "thrust", range: 620, minRange: 90, cd: 3, dmg: 13, speed: 600, size: 15, shape: "shard", pierce: true, kb: 280 }),
      M({ id: "crystal-spire", name: "Crystal Spire", kind: "eruption", anim: "slam", range: 520, minRange: 40, cd: 4.6, dmg: 13, radius: 44, count: 3, lift: -620, wind: 0.32 }),
      M({ id: "shard-rain", name: "Shard Rain", kind: "rain", anim: "raise", range: 520, cd: 5.5, dmg: 8, count: 6, radius: 150, shape: "shard", wind: 0.32 }),
      M({ id: "amethyst-field", name: "Amethyst Field", kind: "zone", anim: "slam", range: 400, cd: 8, dmg: 5, radius: 130, dur: 4, status: "slow", statusDur: 0.6, wind: 0.32 }),
      M({ id: "refraction-step", name: "Refraction Step", kind: "blink", anim: "kick", range: 600, minRange: 110, cd: 3.2, dmg: 13, kb: 300, lift: -240, status: "blind", statusDur: 0.4 }),
      M({ id: "shatter-nova", name: "Shatter Nova", kind: "burst", anim: "raise", range: 150, cd: 5.5, dmg: 15, radius: 170, kb: 500, lift: -280, wind: 0.3 }),
      M({ id: "crystal-tether", name: "Crystal Tether", kind: "pull", anim: "cast", range: 460, minRange: 110, cd: 3.8, dmg: 10, status: "slow", statusDur: 0.8 }),
      M({ id: "regrow-facets", name: "Regrow Facets", kind: "heal", anim: "raise", range: 2000, cd: 12, dmg: 0, heal: 24, below: 0.6, wind: 0.36, rec: 0.3 }),
    ],
  },
  {
    id: "sand", name: "Sirocco", power: "Sand Manipulation", role: "control",
    ability: "Commands the desert. Sand that blinds, quicksand that swallows, glass spun out of the heat and a storm that is never where you think it is.",
    color: "hsl(36 52% 58%)", glow: "hsl(20 100% 60%)", hp: 285, speed: 110,
    moves: [
      M({ id: "sand-lash", name: "Sand Lash", kind: "melee", anim: "lunge", range: 120, minRange: 30, cd: 1, dmg: 10, kb: 240 }),
      M({ id: "dune-kick", name: "Dune Kick", kind: "melee", anim: "kick", range: 92, cd: 1.3, dmg: 12, kb: 280, lift: -400 }),
      M({ id: "sand-blast", name: "Sand Blast", kind: "projectile", anim: "thrust", range: 520, minRange: 60, cd: 2, dmg: 5, speed: 700, size: 8, count: 5, spread: 0.2, shape: "rock", status: "blind", statusDur: 0.5 }),
      M({ id: "glass-shard", name: "Glass Shard", kind: "projectile", anim: "cast", range: 620, minRange: 90, cd: 2.8, dmg: 12, speed: 660, size: 13, shape: "shard", pierce: true, kb: 240 }),
      M({ id: "sand-torrent", name: "Sand Torrent", kind: "pull", anim: "thrust", range: 500, minRange: 110, cd: 3.6, dmg: 13, status: "blind", statusDur: 0.8, wind: 0.3 }),
      M({ id: "quicksand", name: "Quicksand", kind: "zone", anim: "slam", range: 420, minRange: 40, cd: 8, dmg: 6, radius: 125, dur: 4, pullIn: 240, status: "slow", statusDur: 0.6, wind: 0.32 }),
      M({ id: "sand-spike", name: "Sand Spike", kind: "eruption", anim: "slam", range: 500, minRange: 40, cd: 4.4, dmg: 14, radius: 46, count: 2, lift: -640, wind: 0.3 }),
      M({ id: "sandstorm", name: "Sandstorm", kind: "rain", anim: "raise", range: 540, cd: 5.5, dmg: 7, count: 8, radius: 170, shape: "rock", status: "blind", statusDur: 0.4, wind: 0.32 }),
      M({ id: "dust-devil", name: "Dust Devil", kind: "burst", anim: "spin", range: 150, cd: 5.5, dmg: 14, radius: 170, kb: 460, lift: -340, status: "blind", statusDur: 0.8, wind: 0.26 }),
      M({ id: "mirage-step", name: "Mirage Step", kind: "blink", anim: "uppercut", range: 620, minRange: 100, cd: 3, dmg: 13, lift: -540, kb: 180 }),
      M({ id: "sand-tether", name: "Sand Tether", kind: "pull", anim: "cast", range: 460, minRange: 110, cd: 3.6, dmg: 9, status: "stun", statusDur: 0.35 }),
      M({ id: "dune-surf", name: "Dune Surf", kind: "dash", anim: "lunge", range: 360, cd: 3.4, dmg: 13, dist: 360, act: 0.22, kb: 340, lift: -180 }),
    ],
  },
  // ----- New generation: young fighters with a chance to join after any Story boss win (app/lib/quests.ts) -----
  {
    id: "plasma", name: "Volta", power: "Plasma Manipulation", role: "attacker",
    ability: "The youngest fighter in the arena, and the one the veterans watch. Volta heats the air until it turns to plasma: star-hot fists, bolts that chain from one enemy to the next and a sun the size of a fist, thrown like a fastball.",
    color: "hsl(322 78% 58%)", glow: "hsl(190 100% 64%)", hp: 300, speed: 128,
    moves: [
      M({ id: "plasma-jab", name: "Plasma Jab", kind: "melee", anim: "jab", range: 76, cd: 0.75, dmg: 11, kb: 240, status: "burn", statusDur: 1 }),
      M({ id: "flare-kick", name: "Flare Kick", kind: "melee", anim: "kick", range: 92, cd: 1.2, dmg: 13, kb: 300, lift: -420 }),
      M({ id: "plasma-bolt", name: "Plasma Bolt", kind: "projectile", anim: "cast", range: 600, minRange: 70, cd: 1.8, dmg: 9, speed: 820, size: 11, shape: "orb", status: "burn", statusDur: 1.5 }),
      M({ id: "arc-chain", name: "Arc Chain", kind: "projectile", anim: "thrust", range: 560, minRange: 70, cd: 2.4, dmg: 6, speed: 900, size: 8, count: 3, spread: 0.12, shape: "orb", status: "stun", statusDur: 0.2 }),
      M({ id: "star-dive", name: "Star Dive", kind: "dash", anim: "lunge", range: 380, cd: 3.2, dmg: 15, dist: 380, act: 0.2, kb: 380, lift: -200 }),
      M({ id: "nova-burst", name: "Nova Burst", kind: "burst", anim: "spin", range: 150, cd: 5, dmg: 16, radius: 180, kb: 520, lift: -320, status: "burn", statusDur: 1, wind: 0.26 }),
      M({ id: "pocket-sun", name: "Pocket Sun", kind: "projectile", anim: "raise", range: 700, minRange: 90, cd: 6, dmg: 20, speed: 420, size: 24, shape: "orb", pierce: true, kb: 460, status: "burn", statusDur: 2, wind: 0.4 }),
      M({ id: "recharge", name: "Recharge", kind: "heal", anim: "raise", range: 2000, cd: 12, dmg: 0, heal: 22, below: 0.55, wind: 0.34, rec: 0.3 }),
    ],
  },
  {
    id: "flora", name: "Briar", power: "Plant Manipulation", role: "control",
    ability: "Barely old enough to enter the arena and already able to grow a forest in a heartbeat. Vines that grab, thorns that fly like arrows, roots that spear up through the floor and flowers big enough to bite.",
    color: "hsl(118 46% 46%)", glow: "hsl(330 100% 72%)", hp: 310, speed: 104,
    moves: [
      M({ id: "thorn-jab", name: "Thorn Jab", kind: "melee", anim: "jab", range: 78, cd: 0.85, dmg: 10, kb: 230, status: "poison", statusDur: 1 }),
      M({ id: "vine-whip", name: "Vine Whip", kind: "melee", anim: "lunge", range: 130, minRange: 30, cd: 1, dmg: 11, kb: 260 }),
      M({ id: "thorn-volley", name: "Thorn Volley", kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 2, dmg: 5, speed: 720, size: 8, count: 5, spread: 0.18, shape: "shard", status: "poison", statusDur: 1.5 }),
      M({ id: "seed-bomb", name: "Seed Bomb", kind: "projectile", anim: "thrust", range: 600, minRange: 90, cd: 2.8, dmg: 13, speed: 520, size: 14, shape: "orb", arc: true, kb: 280 }),
      M({ id: "vine-grab", name: "Vine Grab", kind: "pull", anim: "cast", range: 480, minRange: 110, cd: 3.4, dmg: 10, status: "stun", statusDur: 0.35 }),
      M({ id: "snapjaw-bloom", name: "Snapjaw Bloom", kind: "burst", anim: "slam", range: 150, cd: 5.5, dmg: 16, radius: 160, kb: 480, lift: -320, status: "stun", statusDur: 0.3, wind: 0.3 }),
      M({ id: "leaf-step", name: "Leaf Step", kind: "blink", anim: "kick", range: 600, minRange: 110, cd: 3.2, dmg: 13, kb: 300, lift: -240 }),
      M({ id: "photosynthesis", name: "Photosynthesis", kind: "heal", anim: "raise", range: 2000, cd: 11, dmg: 0, heal: 26, below: 0.65, wind: 0.34, rec: 0.3 }),
    ],
  },
  {
    id: "chaos", name: "Turbo", power: "Chaos Energy Manipulation", role: "attacker",
    ability: "The fastest of the new generation, and he knows it. Turbo runs on raw chaos energy: spears of it thrown on the move, a dash that breaks the sound barrier and a step that skips him through space. Push him far enough and seven emeralds answer.",
    color: "hsl(218 88% 52%)", glow: "hsl(28 100% 58%)", body: "hsl(228 24% 9%)", outline: "hsl(212 100% 58%)", hp: 300, speed: 140,
    moves: [
      M({ id: "turbo-jab", name: "Turbo Jab", kind: "melee", anim: "jab", range: 76, cd: 0.7, dmg: 10, kb: 240 }),
      M({ id: "spin-kick", name: "Spin Kick", kind: "melee", anim: "kick", range: 94, cd: 1.1, dmg: 13, kb: 320, lift: -380 }),
      M({ id: "chaos-bolt", name: "Chaos Bolt", kind: "projectile", anim: "cast", range: 620, minRange: 70, cd: 1.8, dmg: 10, speed: 880, size: 11, shape: "orb", status: "stun", statusDur: 0.15 }),
      M({ id: "chaos-javelin", name: "Chaos Javelin", kind: "projectile", anim: "thrust", range: 600, minRange: 80, cd: 2.4, dmg: 6, speed: 960, size: 9, count: 3, spread: 0.1, shape: "shard", pierce: true }),
      M({ id: "boost-dash", name: "Boost Dash", kind: "dash", anim: "lunge", range: 420, cd: 2.8, dmg: 14, dist: 420, act: 0.18, kb: 380, lift: -180 }),
      M({ id: "blur-step", name: "Blur Step", kind: "blink", anim: "kick", range: 640, minRange: 100, cd: 3, dmg: 13, kb: 300, lift: -260 }),
      M({ id: "chaos-burst", name: "Chaos Burst", kind: "burst", anim: "spin", range: 150, cd: 5, dmg: 15, radius: 170, kb: 500, lift: -320, wind: 0.26 }),
      M({ id: "second-wind", name: "Second Wind", kind: "heal", anim: "raise", range: 2000, cd: 12, dmg: 0, heal: 22, below: 0.55, wind: 0.32, rec: 0.3 }),
    ],
  },
];

export const QUEST_IDS = new Set<Power>(QUESTERS.map((q) => q.id));
export const isQuester = (id: string) => QUEST_IDS.has(id as Power);
/** The young new-generation fighters: listed with the quest fighters for the arena, but won by luck after a boss win, not by a quest. */
export const NEWGEN_IDS: Power[] = ["plasma", "flora", "chaos"];
export const isNewGen = (id: string) => NEWGEN_IDS.includes(id as Power);

export const DEF_BY_ID = Object.fromEntries([...FIGHTERS, ...QUESTERS].map((f) => [f.id, f])) as Record<Power, FighterDef>;

// ---------- Juggernaut ----------
// A juggernaut keeps its own 4 moves and gains 6 wing moves in its element, for 10 in all, with double health.

type Wing = { word: string; shape: NonNullable<Move["shape"]>; status?: StatusEffect; statusDur?: number; heal?: number };

const WINGS: Record<Power, Wing> = {
  pyro: { word: "Blaze", shape: "orb", status: "burn", statusDur: 2 },
  cryo: { word: "Frost", shape: "shard", status: "slow", statusDur: 1.5 },
  electro: { word: "Thunder", shape: "orb", status: "stun", statusDur: 0.25 },
  terra: { word: "Granite", shape: "rock" },
  aero: { word: "Gale", shape: "blade" },
  hydro: { word: "Tide", shape: "orb" },
  umbra: { word: "Shadow", shape: "blade", status: "blind", statusDur: 1.2 },
  lux: { word: "Radiant", shape: "shard", status: "blind", statusDur: 1.2 },
  gravi: { word: "Void", shape: "rock", status: "slow", statusDur: 1 },
  tele: { word: "Warp", shape: "disc" },
  vita: { word: "Verdant", shape: "orb", status: "poison", statusDur: 2, heal: 10 },
  toxi: { word: "Venom", shape: "orb", status: "poison", statusDur: 3 },
  chrono: { word: "Hourglass", shape: "disc", status: "slow", statusDur: 1.5 },
  magneto: { word: "Iron", shape: "shard", status: "stun", statusDur: 0.2 },
  psy: { word: "Mind", shape: "disc", status: "stun", statusDur: 0.25 },
  shift: { word: "Morph", shape: "blade", status: "slow", statusDur: 1 },
  spatio: { word: "Rift", shape: "shard", status: "slow", statusDur: 1 },
  hexizon: { word: "Bone", shape: "blade", status: "poison", statusDur: 1.5 },
  gamma: { word: "Gamma", shape: "orb", status: "poison", statusDur: 1.5 },
  velo: { word: "Mach", shape: "wave" },
  portal: { word: "Portal", shape: "disc", status: "slow", statusDur: 1 },
  sono: { word: "Sonic", shape: "wave", status: "stun", statusDur: 0.2 },
  paper: { word: "Paper", shape: "blade", heal: 10 },
  crys: { word: "Crystal", shape: "shard", status: "slow", statusDur: 1 },
  sand: { word: "Dune", shape: "rock", status: "blind", statusDur: 0.8 },
  plasma: { word: "Plasma", shape: "orb", status: "burn", statusDur: 1.5 },
  flora: { word: "Thorn", shape: "shard", status: "poison", statusDur: 2, heal: 8 },
  chaos: { word: "Chaos", shape: "shard", status: "stun", statusDur: 0.15 },
};

export function wingMoves(id: Power): Move[] {
  const w = WINGS[id];
  const st = w.status ? { status: w.status, statusDur: w.statusDur } : {};
  // a lingering field re-applies its effect every frame, so a stun there would never wear off
  const fieldSt = w.status === "stun" ? { status: "slow" as const, statusDur: 0.6 } : w.status ? { status: w.status, statusDur: 0.6 } : {};
  return [
    M({ id: "wing-volley", name: `${w.word} Feather Volley`, kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 2.4, dmg: 4, speed: 620, size: 9, count: 5, spread: 0.16, shape: w.shape, ...st }),
    M({ id: "wing-dive", name: `${w.word} Dive`, kind: "dash", anim: "lunge", range: 320, cd: 4.5, dmg: 12, dist: 320, act: 0.35, kb: 360, ...st }),
    M({ id: "wing-skyfall", name: `${w.word} Skyfall`, kind: "rain", anim: "raise", range: 520, cd: 6, dmg: 7, count: 6, radius: 150, wind: 0.35, ...st }),
    M({ id: "wing-beat", name: `${w.word} Wingbeat`, kind: "burst", anim: "spin", range: 150, cd: 6.5, dmg: 12, radius: 175, kb: 480, lift: -300, heal: w.heal, wind: 0.3, rec: 0.35 }),
    M({ id: "wing-lance", name: `${w.word} Sky Lance`, kind: "beam", anim: "thrust", range: 600, minRange: 80, cd: 5.5, dmg: 15, act: 0.4, wind: 0.35, ...st }),
    M({ id: "wing-storm", name: `${w.word} Storm`, kind: "zone", anim: "raise", range: 440, cd: 9, dmg: 5, radius: 130, dur: 3.5, pullIn: 120, wind: 0.35, ...fieldSt }),
  ];
}

/** The fighter as a juggernaut: double health and 10 moves. */
export function juggernautOf(def: FighterDef): FighterDef {
  return { ...def, hp: def.hp * 2, moves: [...def.moves, ...wingMoves(def.id)] };
}

// ---------- Hybrids and team attacks (Story mode) ----------
// A hybrid keeps both parents' moves (each drawn in its parent's element) and gains two mixed moves.
// Two fighters who stay separate each gain one team attack that mixes both powers.

/** Umbra plus Lux is always Equinox; every other pair gets a blended name. */
const NAMED_HYBRIDS: Record<string, string> = { "lux+umbra": "Equinox" };

const VOWELS = /[aeiouy]/i;

export function hybridName(a: Power, b: Power): string {
  const named = NAMED_HYBRIDS[[a, b].sort().join("+")];
  if (named) return named;
  const A = DEF_BY_ID[a].name, B = DEF_BY_ID[b].name;
  if (a === b) return `${A} Prime`;
  let head = A.match(/^[^aeiouy]*[aeiouy]+/i)?.[0] ?? A.slice(0, 2);
  if (head.length < 2) head = A.slice(0, 2);
  const lower = B.toLowerCase();
  let tail = lower.match(/[^aeiouy]*[aeiouy]+[^aeiouy]*$/i)?.[0] ?? lower.slice(-3);
  if (tail === lower) tail = lower.slice(1);
  if (VOWELS.test(head.slice(-1)) && VOWELS.test(tail[0] ?? "")) tail = tail.slice(1) || tail;
  return head + tail;
}

function mixedMoves(a: Power, b: Power): Move[] {
  const wa = WINGS[a], wb = WINGS[b];
  const stB = wb.status ? { status: wb.status, statusDur: wb.statusDur } : {};
  const stA = wa.status ? { status: wa.status, statusDur: wa.statusDur } : {};
  return [
    M({ id: `mix-comet-${a}-${b}`, name: `${wa.word} ${wb.word} Comet`, kind: "projectile", anim: "cast", power: a, range: 580, minRange: 80, cd: 3.2, dmg: 13, speed: 560, size: 16, shape: wb.shape, pierce: true, kb: 260, wind: 0.25, ...stB }),
    M({ id: `mix-nova-${a}-${b}`, name: `${wb.word} ${wa.word} Nova`, kind: "burst", anim: "slam", power: b, range: 150, cd: 6.5, dmg: 15, radius: 165, kb: 400, lift: -320, heal: wa.heal ?? wb.heal, wind: 0.3, rec: 0.35, ...stA }),
  ];
}

/** Two fighters fused into one: both move sets plus two mixed moves, and close to the pair's health. */
export function hybridOf(a: Power, b: Power, name = hybridName(a, b)): FighterDef {
  const A = DEF_BY_ID[a], B = DEF_BY_ID[b];
  const parentMoves = a === b ? A.moves : [...A.moves, ...B.moves.map((m) => ({ ...m, power: b }))];
  return {
    ...A,
    name,
    power: a === b ? `${A.power}, doubled` : `${A.power} and ${B.power}`,
    ability: a === b ? `${A.name} fused with itself.` : `${A.name} and ${B.name} fused into one body.`,
    color: A.color,
    glow: B.glow,
    hp: Math.round((A.hp + B.hp) * 0.85),
    speed: Math.round((A.speed + B.speed) / 2),
    moves: [...parentMoves, ...mixedMoves(a, b)],
    parents: [a, b],
  };
}

/** The fighter with its team attack for fighting beside a partner. */
export function withTeamAttack(self: Power, partner: Power): FighterDef {
  const D = DEF_BY_ID[self];
  const ws = WINGS[self], wp = WINGS[partner];
  const st = wp.status ? { status: wp.status, statusDur: wp.statusDur } : {};
  const first = [self, partner].sort()[0] === self;
  const move = first
    ? M({ id: `duo-rush-${self}-${partner}`, name: `${ws.word} ${wp.word} Duo Rush`, kind: "dash", anim: "lunge", range: 320, cd: 5, dmg: 14, dist: 320, act: 0.35, kb: 380, lift: -260, ...st })
    : M({ id: `duo-barrage-${self}-${partner}`, name: `${ws.word} ${wp.word} Duo Barrage`, kind: "rain", anim: "raise", range: 500, cd: 5.5, dmg: 8, count: 6, radius: 140, wind: 0.3, ...st });
  return { ...D, moves: [...D.moves, move] };
}

// ---------- A power you invented ----------
// The AI names it, colours it and designs every one of its moves from scratch: what kind of attack it is, how strong,
// big and fast, the shape it throws, how that shape travels, the trail it leaves and how it bursts on a hit. The
// numbers come from the move's kind and strength (so it stays fair) and the drawing from its design (designLook in
// move-looks), so no invented move copies a fighter's move. The AI also decides how many moves a power has.

export const OWN_SPARKS: PShape[] = ["dot", "spark", "shard", "chunk", "ring", "plus", "smoke", "ember", "flake", "drop", "leaf", "petal", "bubble", "bolt", "glyph", "pixel", "star", "dust"];
export const STATUSES: StatusEffect[] = ["burn", "slow", "stun", "poison", "blind", "freeze"];
export const ROLES: Role[] = ["attacker", "control", "tank", "support", "trickster"];
export const MIN_OWN_MOVES = 3;
export const MAX_OWN_MOVES = 8;
export type OwnKind = Exclude<MoveKind, "mimic" | "warp" | "annihilate">;
export const OWN_KINDS: OwnKind[] = ["melee", "projectile", "beam", "burst", "dash", "eruption", "rain", "blink", "heal", "zone", "pull"];
export const ANIMS: Anim[] = ["jab", "kick", "cast", "thrust", "raise", "slam", "uppercut", "spin", "lunge"];
export const OWN_STRENGTHS = ["light", "medium", "heavy"] as const;
export const OWN_SIZES = ["small", "medium", "large"] as const;
export const OWN_SPEEDS = ["slow", "normal", "fast"] as const;
export { OWN_GLYPHS, OWN_TRAILS, OWN_MOTIONS, OWN_BURSTS };

/** One invented move, as the AI designed it. */
export type OwnMove = {
  name: string;
  kind: OwnKind;
  anim: Anim;
  strength: (typeof OWN_STRENGTHS)[number];
  size: (typeof OWN_SIZES)[number];
  speed: (typeof OWN_SPEEDS)[number];
  /** How many shots, falling pieces or pillars (1 for the rest). */
  count: number;
  arc: boolean;
  pierce: boolean;
  /** Whether its hits leave the power's effect. */
  effect: boolean;
  /** Its own colour's hue; saturation and lightness follow the power's main colour. */
  hue: number;
  spark: PShape;
  glyph: OwnGlyph;
  trail: OwnTrail;
  motion: OwnMotion;
  burst: OwnBurst;
};

const HSL = /^hsl\((\d{1,3}(?:\.\d+)?) (\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%\)$/;
const tidy = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const oneOf = <T extends string>(xs: readonly T[], v: unknown, fallback: T): T => (xs.includes(v as T) ? (v as T) : fallback);
const hashOf = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const pickBy = <T,>(xs: readonly T[], seed: number) => xs[seed % xs.length];

// Powers made before moves were designed saved, per move, the fighter move it played like. Those are rebuilt as
// designed moves of the same kind, so every invented power plays its own moves.
const OLD_MOVES = new Map(FIGHTERS.flatMap((f) => f.moves).map((m) => [m.id, m]));
function fromOld(name: string, from: string, hue: number, spark: PShape): OwnMove | null {
  const m = OLD_MOVES.get(from);
  if (!m || !OWN_KINDS.includes(m.kind as OwnKind)) return null;
  const h = hashOf(name);
  return {
    name, kind: m.kind as OwnKind, anim: m.anim,
    strength: m.cd < 1.5 ? "light" : m.cd < 4.5 ? "medium" : "heavy",
    size: "medium", speed: "normal", count: m.count ?? 1, arc: !!m.arc, pierce: !!m.pierce, effect: !!m.status,
    hue, spark,
    glyph: pickBy(OWN_GLYPHS, h), trail: pickBy(OWN_TRAILS, h >>> 4), motion: pickBy(OWN_MOTIONS, h >>> 8), burst: pickBy(OWN_BURSTS, h >>> 12),
  };
}

function cleanMove(raw: unknown, hue: number, spark: PShape): OwnMove | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = tidy(r.name, 26);
  if (!name) return null;
  if (typeof r.from === "string") return fromOld(name, r.from, hue, spark);
  if (!OWN_KINDS.includes(r.kind as OwnKind)) return null;
  const h = Number(r.hue);
  const count = Math.round(Number(r.count));
  return {
    name,
    kind: r.kind as OwnKind,
    anim: oneOf(ANIMS, r.anim, "cast"),
    strength: oneOf(OWN_STRENGTHS, r.strength, "medium"),
    size: oneOf(OWN_SIZES, r.size, "medium"),
    speed: oneOf(OWN_SPEEDS, r.speed, "normal"),
    count: Number.isFinite(count) ? Math.max(1, Math.min(7, count)) : 1,
    arc: r.arc === true,
    pierce: r.pierce === true,
    effect: r.effect === true,
    hue: Number.isFinite(h) ? ((Math.round(h) % 360) + 360) % 360 : hue,
    spark: oneOf(OWN_SPARKS, r.spark, spark),
    glyph: oneOf(OWN_GLYPHS, r.glyph, "orb"),
    trail: oneOf(OWN_TRAILS, r.trail, "streak"),
    motion: oneOf(OWN_MOTIONS, r.motion, "steady"),
    burst: oneOf(OWN_BURSTS, r.burst, "scatter"),
  };
}

/** A tidy copy of an invented power, or null when it is not one. */
export function cleanOwn(raw: unknown): OwnPower | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = tidy(r.id, 24).replace(/[^a-z0-9]/g, "");
  const name = tidy(r.name, 24);
  const base = typeof r.base === "string" && isPower(r.base) && !QUEST_IDS.has(r.base) ? r.base : null;
  const color = tidy(r.color, 40), glow = tidy(r.glow, 40);
  const main = HSL.exec(color);
  if (!id || !name || !base || !main || !HSL.test(glow)) return null;
  const spark = oneOf(OWN_SPARKS, r.spark, "spark");
  const names = new Set<string>();
  const moves = (Array.isArray(r.moves) ? r.moves : [])
    .map((m) => cleanMove(m, Number(main[1]), spark))
    .filter((m): m is OwnMove => !!m && !names.has(m.name.toLowerCase()) && !!names.add(m.name.toLowerCase()))
    .slice(0, MAX_OWN_MOVES);
  if (moves.length === 0) return null;
  // every fighter needs a close strike to fight up close, and one heal is plenty
  if (!moves.some((m) => m.kind === "melee")) moves[0] = { ...moves[0], kind: "melee", anim: ["cast", "raise"].includes(moves[0].anim) ? "jab" : moves[0].anim };
  let heals = 0;
  for (let i = 0; i < moves.length; i++) if (moves[i].kind === "heal" && ++heals > 1) moves[i] = { ...moves[i], kind: "burst" };
  return {
    id,
    name,
    word: tidy(r.word, 12) || name.split(" ")[0],
    about: tidy(r.about, 120),
    base,
    role: ROLES.includes(r.role as Role) ? (r.role as Role) : DEF_BY_ID[base].role,
    color,
    glow,
    spark,
    status: STATUSES.includes(r.status as StatusEffect) ? (r.status as StatusEffect) : null,
    moves,
  };
}

const STATUS_DUR: Record<StatusEffect, number> = { burn: 2, slow: 1.5, stun: 0.3, poison: 3, blind: 1.2, freeze: 0.6 };
const TIER = { light: 0, medium: 1, heavy: 2 } as const;
const SIZE = { small: 0, medium: 1, large: 2 } as const;

/** A designed move's numbers, from its kind and its strength, size and speed. */
function ownStats(om: OwnMove): Omit<Move, "id" | "name" | "status" | "statusDur" | "power"> {
  const t = TIER[om.strength];
  const z = SIZE[om.size];
  const by = <T,>(xs: readonly [T, T, T], i: number) => xs[i];
  const anim = om.anim;
  switch (om.kind) {
    case "melee": {
      const range = by([68, 84, 112], z);
      return { kind: "melee", anim, range, minRange: range > 100 ? 40 : undefined, cd: by([0.9, 1.3, 2], t), dmg: by([7, 10, 13], t), kb: by([150, 240, 340], t), wind: by([0.13, 0.19, 0.25], t), act: 0.12, rec: 0.22 };
    }
    case "projectile": {
      const n = Math.min(om.count, 5);
      const ground = om.size === "large" && !om.arc && om.speed === "slow";
      const per = n === 1 ? 1 : 1.7 / n;
      return {
        kind: "projectile", anim, range: 560, minRange: 80, cd: by([1.6, 2.4, 4], t),
        dmg: Math.max(3, Math.round(by([8, 10, 13], t) * per * (om.pierce ? 0.85 : 1))),
        speed: by([300, 520, 700], TIER[om.speed === "slow" ? "light" : om.speed === "fast" ? "heavy" : "medium"]),
        size: by([9, 13, 20], z) + (ground ? 8 : 0), count: n > 1 ? n : undefined, spread: n > 1 ? 0.15 : undefined,
        arc: om.arc || undefined, pierce: om.pierce || ground || undefined, ground: ground || undefined,
        kb: by([100, 200, 320], t), wind: by([0.18, 0.24, 0.3], t), act: 0.12, rec: 0.22,
      };
    }
    case "beam":
      return { kind: "beam", anim, range: by([420, 520, 620], z), minRange: 60, cd: by([2.4, 3.2, 5], t), dmg: by([10, 13, 16], t), act: by([0.3, 0.4, 0.5], t), kb: by([0, 150, 450], t) || undefined, wind: by([0.25, 0.3, 0.4], t), rec: 0.22 };
    case "burst": {
      const radius = by([120, 145, 175], z);
      return { kind: "burst", anim, range: Math.round(radius * 0.85), cd: by([4.5, 5.5, 7], t), dmg: by([8, 11, 14], t), radius, kb: by([260, 340, 420], t), lift: by([-200, -280, -360], t), wind: 0.3, act: 0.12, rec: 0.35 };
    }
    case "dash": {
      const dist = by([240, 280, 320], z);
      return { kind: "dash", anim, range: dist, cd: by([3.5, 4, 5], t), dmg: by([8, 10, 12], t), dist, act: by([0.3, 0.35, 0.45], t), kb: by([180, 260, 360], t), lift: by([-150, -250, -350], t), wind: 0.18, rec: 0.22 };
    }
    case "eruption": {
      const n = Math.min(om.count, 4);
      return { kind: "eruption", anim, range: 440, minRange: 50, cd: by([3.5, 4.5, 5.5], t) + (n > 1 ? 1 : 0), dmg: Math.round(by([12, 14, 16], t) * (n > 1 ? 0.7 : 1)), radius: by([40, 46, 54], z), count: n > 1 ? n : undefined, lift: by([-600, -700, -800], t), wind: 0.35, act: 0.12, rec: 0.22 };
    }
    case "rain": {
      const n = Math.max(3, Math.min(om.count, 7));
      return { kind: "rain", anim, range: 480, cd: by([4, 5, 6.5], t), dmg: Math.max(4, Math.round(by([20, 26, 34], t) / n)), count: n, radius: by([90, 120, 140], z), size: by([9, 12, 16], z), wind: 0.35, act: 0.12, rec: 0.3 };
    }
    case "blink":
      return { kind: "blink", anim, range: 600, minRange: 80, cd: by([2.5, 3.2, 4], t), dmg: by([10, 12, 14], t), kb: by([220, 280, 340], t), wind: 0.2, act: 0.12, rec: 0.22 };
    case "heal":
      return { kind: "heal", anim, range: 2000, cd: by([7, 8, 9], t), dmg: 0, heal: by([14, 18, 22], t), below: 0.65, wind: 0.3, act: 0.3, rec: 0.22 };
    case "zone":
      return { kind: "zone", anim, range: om.size === "small" ? 160 : 420, cd: by([6, 6.5, 7], t), dmg: by([3, 4, 5], t), radius: by([95, 110, 125], z), dur: by([3, 3.5, 4], t), pullIn: om.motion === "spin" ? 260 : undefined, wind: 0.3, act: 0.12, rec: 0.22 };
    case "pull":
      return { kind: "pull", anim, range: 400, minRange: 100, cd: by([3, 3.5, 4], t), dmg: by([6, 8, 10], t), wind: 0.18, act: 0.12, rec: 0.22 };
  }
}

/** The colours a designed move is drawn in: its own hue, in the power's main colour's saturation and lightness. */
function ownColours(own: OwnPower, hue: number) {
  const [, , s, l] = HSL.exec(own.color) ?? [];
  const [, , , gl] = HSL.exec(own.glow) ?? [];
  return { a: `hsl(${hue} ${s ?? 80}% ${l ?? 50}%)`, b: `hsl(${hue} 100% ${gl ?? 80}%)` };
}

/** The invented power's moves: each built from its own design, under its own name, in its own colours. */
function ownMoves(own: OwnPower): Move[] {
  return own.moves.map((om, i) => {
    const id = `own-${own.id}-${i}`;
    const { a, b } = ownColours(own, om.hue);
    designLook(id, a, b, om.spark, { kind: om.kind, glyph: om.glyph, trail: om.trail, motion: om.motion, burst: om.burst });
    const stats = ownStats(om);
    // its own effect, on the moves designed to carry it; a lingering field never stuns, or the stun would never wear off
    const st = om.effect && own.status && om.kind !== "heal" ? (om.kind === "zone" && own.status === "stun" ? "slow" : own.status) : undefined;
    const statusDur = st ? (om.kind === "zone" ? Math.min(0.6, STATUS_DUR[st]) : STATUS_DUR[st] * (om.strength === "heavy" ? 1.3 : 1)) : undefined;
    return { ...stats, id, name: om.name, power: own.base, status: st, statusDur };
  });
}

// ---------- Your own fighter (Free World's character creator) ----------
// The powers decide everything that is not a choice of look: the first power is the main one (its colour, voice,
// role and stance), the second lends its glow, and each power brings some of its own fighter's moves, drawn in its
// element. Two signature moves mix the first two powers (or double down on a single one). A power you invented
// is always the main one: its colours and role lead, and it sounds and arrives like the game element it is closest to.

export const GEARS: Gear[] = ["scarf", "cape", "headband", "mask", "none"];
export const BUILDS: Build[] = ["small", "regular", "tall"];
export const SHADES: Shade[] = ["main", "glow", "dark"];
export const MAX_CUSTOM_POWERS = 3;
export const MAX_NAME = 16;
/** The health you can give your character. */
export const CUSTOM_HP_MIN = 50;
export const CUSTOM_HP_MAX = 500;
export const CUSTOM_HP_STEP = 10;
const ROLE_HP: Record<Role, number> = { attacker: 100, control: 100, tank: 120, support: 105, trickster: 95 };
const BUILD_HP: Record<Build, number> = { small: -8, regular: 0, tall: 10 };
const BUILD_SPEED: Record<Build, number> = { small: 8, regular: 0, tall: -6 };

function signatureMoves(a: Power, b: Power, own?: OwnPower): Move[] {
  const wa = WINGS[a], wb = WINGS[b];
  const stA = wa.status ? { status: wa.status, statusDur: wa.statusDur } : {};
  const stB = wb.status ? { status: wb.status, statusDur: wb.statusDur } : {};
  const one = a === b;
  const moves = [
    M({ id: `sig-comet-${a}-${b}`, name: one ? `${wa.word} Comet` : `${wa.word} ${wb.word} Comet`, kind: "projectile", anim: "cast", power: one ? a : b, range: 580, minRange: 80, cd: 3.2, dmg: 13, speed: 560, size: 16, shape: wb.shape, pierce: true, kb: 260, wind: 0.25, ...stB }),
    M({ id: `sig-nova-${a}-${b}`, name: one ? `${wa.word} Nova` : `${wb.word} ${wa.word} Nova`, kind: "burst", anim: "slam", power: a, range: 150, cd: 6.5, dmg: 15, radius: 165, kb: 400, lift: -320, heal: wa.heal ?? wb.heal, wind: 0.3, rec: 0.35, ...stA }),
  ];
  if (!own) return moves;
  // an invented power names both and draws them from its own designs: the comet like its first shot, the nova like its first blast
  const word = own.word;
  const [comet, nova] = moves;
  const cometId = `own-${own.id}-comet-${b}`, novaId = `own-${own.id}-nova-${b}`;
  const shot = own.moves.find((m) => m.kind === "projectile" || m.kind === "rain") ?? own.moves[0];
  const blast = own.moves.find((m) => m.kind === "burst" || m.kind === "eruption" || m.kind === "zone") ?? own.moves[own.moves.length - 1];
  const design = (m: OwnMove, kind: string) => ({ kind, glyph: m.glyph, trail: m.trail, motion: m.motion, burst: m.burst });
  designLook(cometId, own.color, own.glow, shot.spark, design(shot, "projectile"));
  designLook(novaId, own.color, own.glow, blast.spark, design(blast, "burst"));
  const ownSt = own.status ? { status: own.status, statusDur: own.status === "stun" ? 0.25 : 1.5 } : {};
  return [
    { ...comet, id: cometId, name: one ? `${word} Comet` : `${word} ${wb.word} Comet`, power: one ? a : b, ...(one ? ownSt : {}) },
    { ...nova, id: novaId, name: one ? `${word} Nova` : `${wb.word} ${word} Nova`, power: a, ...ownSt },
  ];
}

/** A tidy copy of a character: a real name, one to three different powers (an invented one counts), known look choices. Null when it has no power. */
export function cleanSpec(raw: Partial<CustomSpec> | null | undefined): CustomSpec | null {
  if (!raw) return null;
  const own = cleanOwn(raw.own) ?? undefined;
  const powers = [...new Set((Array.isArray(raw.powers) ? raw.powers : []).filter((p): p is Power => typeof p === "string" && isPower(p)))].slice(0, MAX_CUSTOM_POWERS - (own ? 1 : 0));
  if (powers.length === 0 && !own) return null;
  const name = (typeof raw.name === "string" ? raw.name : "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  const hpRaw = Number(raw.hp);
  const hp = Number.isFinite(hpRaw) && hpRaw > 0 ? Math.min(CUSTOM_HP_MAX, Math.max(CUSTOM_HP_MIN, Math.round(hpRaw))) : undefined;
  const capRaw = Number(raw.moveCap);
  const moveCap = Number.isFinite(capRaw) && capRaw >= 1 ? Math.min(99, Math.round(capRaw)) : undefined;
  return {
    name,
    powers,
    gear: GEARS.includes(raw.gear as Gear) ? (raw.gear as Gear) : "scarf",
    build: BUILDS.includes(raw.build as Build) ? (raw.build as Build) : "regular",
    shade: SHADES.includes(raw.shade as Shade) ? (raw.shade as Shade) : "main",
    ...(own ? { own } : {}),
    ...(hp ? { hp } : {}),
    ...(moveCap ? { moveCap } : {}),
  };
}

/** The game elements behind a character, in order: an invented power's own element first, then the picked powers. */
export function customElements(spec: CustomSpec): Power[] {
  return spec.own ? [spec.own.base, ...spec.powers] : spec.powers;
}

/** How many powers a character has, an invented one included. */
export const powerCount = (spec: CustomSpec) => spec.powers.length + (spec.own ? 1 : 0);

/** Health a character gets from its powers and build when you have not chosen it. */
export function customAutoHp(spec: CustomSpec): number {
  const role = spec.own ? spec.own.role : DEF_BY_ID[customElements(spec)[0]].role;
  return ROLE_HP[role] + BUILD_HP[spec.build];
}

/** Keep `cap` of a character's moves, taken in turn from each source (invented power, each picked power, signatures) so a short list still mixes them. */
function capMoves(groups: Move[][], cap: number | undefined): Move[] {
  const all = groups.flat();
  if (!cap || cap >= all.length) return all;
  const keep = new Set<string>();
  for (let i = 0; keep.size < cap; i++) {
    for (const g of groups) {
      if (keep.size >= cap) break;
      if (g[i]) keep.add(g[i].id);
    }
  }
  return all.filter((m) => keep.has(m.id));
}

/** Every move a character sheet could fight with, before its ability count is applied. */
export const customMoveTotal = (spec: CustomSpec) => customOf({ ...spec, moveCap: undefined }).moves.length;

/** The fighter a character sheet makes. `fallbackName` stands in while the name is blank. */
export function customOf(spec: CustomSpec, fallbackName = "You"): FighterDef {
  const own = spec.own;
  const els = customElements(spec);
  const [a, b = a] = els;
  const A = DEF_BY_ID[a], B = DEF_BY_ID[b];
  const count = els.length;
  const per = count === 1 ? 6 : count === 2 ? 3 : 2;
  const pickedGroups = spec.powers.map((p) => DEF_BY_ID[p].moves.slice(0, per).map((m) => (!own && p === a ? m : { ...m, power: p })));
  // an invented power keeps every move the AI gave it (unless you chose to fight with fewer)
  const groups = own ? [ownMoves(own), ...pickedGroups] : pickedGroups;
  const speed = Math.round(els.reduce((s, p) => s + DEF_BY_ID[p].speed, 0) / count) + BUILD_SPEED[spec.build];
  const names = [...(own ? [own.name] : []), ...spec.powers.map((p) => DEF_BY_ID[p].power)];
  const color = own ? own.color : A.color;
  const glow = own && spec.powers.length === 0 ? own.glow : B.glow;
  const mainGlow = own ? own.glow : A.glow;
  const role = own ? own.role : A.role;
  const dark = "hsl(250 22% 10%)";
  return {
    ...A,
    name: spec.name || fallbackName,
    power: names.join(", "),
    role,
    ability: names.length === 1 ? `Made by you, with ${names[0]}.` : `Made by you, with ${names.join(" and ")}.`,
    color,
    glow,
    body: spec.shade === "glow" ? mainGlow : spec.shade === "dark" ? dark : undefined,
    outline: spec.shade === "dark" ? color : undefined,
    hp: spec.hp ?? ROLE_HP[role] + BUILD_HP[spec.build],
    speed,
    moves: capMoves([...groups, signatureMoves(a, b, own)], spec.moveCap),
    parents: undefined,
    boss: undefined,
    custom: spec,
  };
}

// Invented powers are kept in this browser by id, so a roster id that names one can rebuild it on any screen.
const OWN_KEY = "npc-arena-own-powers";
const OWN_KEEP = 12;
const ownById = new Map<string, OwnPower>();
let ownLoaded = false;
function loadOwn() {
  if (ownLoaded || typeof localStorage === "undefined") return;
  ownLoaded = true;
  try {
    const list = JSON.parse(localStorage.getItem(OWN_KEY) ?? "[]");
    for (const raw of Array.isArray(list) ? list : []) {
      const p = cleanOwn(raw);
      if (p && !ownById.has(p.id)) ownById.set(p.id, p);
    }
  } catch {
    // nothing kept
  }
}
/** Keep an invented power in this browser (the newest dozen are kept). */
export function rememberOwnPower(p: OwnPower) {
  loadOwn();
  ownById.delete(p.id);
  ownById.set(p.id, p);
  try {
    localStorage.setItem(OWN_KEY, JSON.stringify([...ownById.values()].slice(-OWN_KEEP)));
  } catch {
    // not kept if storage is blocked
  }
}
function ownPowerById(id: string): OwnPower | undefined {
  loadOwn();
  return ownById.get(id);
}

/** The roster id your fighter is picked by. The whole sheet rides in it (an invented power by its id), so any screen can rebuild the fighter. */
export function customKey(spec: CustomSpec): RosterId {
  // health and ability count ride after the invented power's slot (left empty when there is none)
  const tuned = spec.hp || spec.moveCap ? [spec.own?.id ?? "", spec.hp ?? "", spec.moveCap ?? ""] : spec.own ? [spec.own.id] : [];
  return ["me", encodeURIComponent(spec.name), spec.powers.join("."), spec.gear, spec.build, spec.shade, ...tuned].join("|");
}
export const isCustomKey = (id: string) => id.startsWith("me|");
function parseCustomKey(id: string): CustomSpec | null {
  if (!isCustomKey(id)) return null;
  const [, name, powers, gear, build, shade, ownId, hp, moveCap] = id.split("|");
  let decoded = "";
  try {
    decoded = decodeURIComponent(name ?? "");
  } catch {
    decoded = "";
  }
  const own = ownId ? ownPowerById(ownId) : undefined;
  return cleanSpec({ name: decoded, powers: (powers ?? "").split(".").filter(Boolean) as Power[], gear: gear as Gear, build: build as Build, shade: shade as Shade, own, hp: hp ? Number(hp) : undefined, moveCap: moveCap ? Number(moveCap) : undefined });
}

// ---------- Roster ids ----------
// An original fighter is picked by its power id; a hybrid by its pair key ("lux+umbra", "pyro+pyro");
// a Story boss, once beaten, by "boss:<id>" (its power id is only the voice it borrows, and two bosses share one).

export type RosterId = string;

/** The same two fighters always share one key, in either order. */
export const hybridKey = (a: Power, b: Power): RosterId => [a, b].sort().join("+");

const ROSTER_ORDER = new Map([...FIGHTERS, ...QUESTERS].map((f, i) => [f.id, i]));
/** The same two fighters make the same hybrid whichever is picked first. */
export function fusionOrder(a: Power, b: Power): [Power, Power] {
  return (ROSTER_ORDER.get(a) ?? 0) <= (ROSTER_ORDER.get(b) ?? 0) ? [a, b] : [b, a];
}

const BOSS_OF_DESIGN = Object.fromEntries(Object.entries(BOSSES).map(([id, d]) => [d.boss, id])) as Record<BossDesign, BossId>;
/** The roster id a beaten Story boss is picked by. */
export const bossRosterId = (id: BossId): RosterId => `boss:${id}`;
const bossOfRosterId = (id: RosterId): BossId | null => {
  const b = id.startsWith("boss:") ? id.slice(5) : "";
  return b in BOSSES ? (b as BossId) : null;
};

/** The id a fighter is picked, saved and crowned by. */
export const rosterIdOf = (d: FighterDef): RosterId =>
  d.custom ? customKey(d.custom) : d.boss ? bossRosterId(BOSS_OF_DESIGN[d.boss]) : d.parents ? hybridKey(d.parents[0], d.parents[1]) : d.id;

const isPower = (x: string): x is Power => x in DEF_BY_ID;

/** The pair behind a hybrid key, or null when the key is not one. */
export function parseHybridKey(key: string): [Power, Power] | null {
  const [a, b, extra] = key.split("+");
  if (extra !== undefined || !a || !b || !isPower(a) || !isPower(b)) return null;
  return fusionOrder(a, b);
}

const hybridCache = new Map<RosterId, FighterDef>();
/** The fighter behind any roster id: an original, a beaten boss, the fighter you made, or the hybrid its pair key makes. */
export function defOf(id: RosterId): FighterDef {
  if (isPower(id)) return DEF_BY_ID[id];
  const boss = bossOfRosterId(id);
  if (boss) return BOSSES[boss];
  let d = hybridCache.get(id);
  if (!d) {
    const mine = parseCustomKey(id);
    const pair = mine ? null : parseHybridKey(id);
    d = mine ? customOf(mine) : pair ? hybridOf(pair[0], pair[1]) : DEF_BY_ID.pyro;
    hybridCache.set(id, d);
  }
  return d;
}
