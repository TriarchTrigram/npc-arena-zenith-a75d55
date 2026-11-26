// How each fighter's moves look. Every one of the 64 moves has its own colours, particles and drawing,
// so no two moves look alike. The Story bosses' moves have their own entries too. The engine calls in here when a move fires, while it flies and when it hits.

export type PShape =
  | "dot" | "spark" | "shard" | "chunk" | "ring" | "plus" | "smoke"
  | "ember" | "flake" | "drop" | "leaf" | "petal" | "bubble" | "bolt" | "glyph" | "pixel" | "star" | "dust";

type HitLook =
  | "flare" | "shatter" | "fork" | "crater" | "swirl" | "splash" | "slash" | "starburst" | "implode"
  | "sprout" | "bite" | "clock" | "sparks" | "ripple" | "splat" | "cross" | "fizz" | "portal"
  /** An invented power's move: drawn from its own design (see designLook). */
  | "own";

export type Look = {
  /** Body colour and highlight. */
  a: string; b: string;
  /** Its particles: shape, glowing or not, and gravity. */
  p: PShape; add: boolean; grav: number;
  /** Signature effect drawn when it fires: at the hand, the body, the feet or in the sky above the target. */
  cast?: "hand" | "body" | "feet" | "sky";
  castLife?: number;
  hit?: HitLook;
  /** A form move borrows the hand-drawn signature of this move, drawn in its own colours. */
  sig?: string;
};

const L = (a: string, b: string, p: PShape, add: boolean, grav: number, hit?: HitLook, cast?: Look["cast"], castLife?: number): Look =>
  ({ a, b, p, add, grav, hit, cast, castLife });

export const LOOKS: Record<string, Look> = {
  // Pyro
  "ember-jab": L("hsl(22 95% 55%)", "hsl(45 100% 62%)", "ember", true, -200, "flare", "hand", 0.26),
  "fireball": L("hsl(8 90% 52%)", "hsl(38 100% 60%)", "ember", true, -120, "flare"),
  "flame-pillar": L("hsl(30 100% 55%)", "hsl(52 100% 75%)", "ember", true, -300, "flare"),
  "inferno-ring": L("hsl(0 85% 48%)", "hsl(20 100% 58%)", "dot", true, -260, "flare", "feet", 0.6),
  // Cryo
  "frost-palm": L("hsl(195 85% 70%)", "hsl(190 100% 92%)", "flake", false, 60, "shatter", "hand", 0.4),
  "ice-shard-volley": L("hsl(205 80% 60%)", "hsl(185 100% 88%)", "shard", false, 320, "shatter"),
  "glacier-spike": L("hsl(200 70% 75%)", "hsl(0 0% 100%)", "shard", false, 450, "shatter"),
  "frozen-floor": L("hsl(210 70% 82%)", "hsl(195 90% 95%)", "flake", false, 20),
  // Electro
  "shock-knuckle": L("hsl(52 100% 58%)", "hsl(55 100% 90%)", "bolt", true, 0, "fork", "hand", 0.2),
  "thunder-bolt": L("hsl(48 100% 55%)", "hsl(0 0% 100%)", "spark", true, 0, "fork"),
  "ball-lightning": L("hsl(190 100% 60%)", "hsl(60 100% 85%)", "bolt", true, 0, "fork"),
  "storm-call": L("hsl(225 30% 40%)", "hsl(55 100% 75%)", "drop", false, 900, "fork", "sky", 1.3),
  // Terra
  "boulder-fist": L("hsl(28 35% 42%)", "hsl(35 40% 70%)", "chunk", false, 1000, "crater", "hand", 0.3),
  "rock-toss": L("hsl(20 30% 38%)", "hsl(30 30% 65%)", "dust", false, -20, "crater"),
  "earth-spike": L("hsl(25 40% 35%)", "hsl(40 35% 62%)", "chunk", false, 1100, "crater"),
  "quake-stomp": L("hsl(34 30% 50%)", "hsl(40 50% 78%)", "dust", false, -30, "crater", "feet", 0.7),
  // Aero
  "gale-kick": L("hsl(165 60% 70%)", "hsl(0 0% 100%)", "spark", false, -40, "swirl", "hand", 0.28),
  "wind-blade": L("hsl(175 70% 55%)", "hsl(160 80% 90%)", "spark", true, 0, "slash"),
  "cyclone-spin": L("hsl(150 40% 72%)", "hsl(180 50% 95%)", "leaf", false, -60, "swirl"),
  "updraft": L("hsl(185 55% 72%)", "hsl(170 70% 92%)", "dust", false, -200, "swirl"),
  // Hydro
  "splash-jab": L("hsl(205 90% 58%)", "hsl(195 100% 85%)", "drop", false, 800, "splash", "hand", 0.3),
  "water-whip": L("hsl(215 85% 50%)", "hsl(190 90% 75%)", "drop", false, 700, "ripple", "hand", 0.24),
  "tidal-wave": L("hsl(220 80% 45%)", "hsl(185 90% 80%)", "bubble", false, -60, "splash"),
  "geyser": L("hsl(200 95% 55%)", "hsl(0 0% 100%)", "drop", false, 900, "splash"),
  // Umbra
  "shade-slash": L("hsl(275 60% 22%)", "hsl(285 80% 60%)", "smoke", false, -50, "slash", "hand", 0.26),
  "shadow-step": L("hsl(260 40% 15%)", "hsl(300 70% 55%)", "smoke", false, -80, "slash", "feet", 0.5),
  "dark-orb": L("hsl(270 70% 12%)", "hsl(265 90% 65%)", "smoke", false, -40, "implode"),
  "night-veil": L("hsl(245 50% 12%)", "hsl(230 80% 80%)", "star", true, 0),
  // Lux
  "flash-jab": L("hsl(50 100% 70%)", "hsl(0 0% 100%)", "star", true, 0, "starburst", "hand", 0.3),
  "prism-beam": L("hsl(300 90% 70%)", "hsl(0 0% 100%)", "spark", true, 0, "starburst"),
  "sun-flare": L("hsl(40 100% 58%)", "hsl(55 100% 88%)", "dot", true, -40, "starburst", "body", 0.6),
  "light-lances": L("hsl(46 100% 62%)", "hsl(60 100% 92%)", "star", true, 200, "cross", "sky", 1.0),
  // Gravi
  "heavy-palm": L("hsl(255 55% 50%)", "hsl(250 80% 75%)", "ring", true, 0, "implode", "hand", 0.32),
  "singularity": L("hsl(270 60% 8%)", "hsl(25 100% 60%)", "ring", true, 0),
  "gravity-pull": L("hsl(240 50% 40%)", "hsl(220 90% 72%)", "ring", true, 0, "implode"),
  "meteor-drop": L("hsl(15 40% 30%)", "hsl(25 100% 58%)", "ember", true, -100, "crater", "sky", 1.0),
  // Tele
  "warp-kick": L("hsl(180 90% 50%)", "hsl(170 100% 85%)", "ring", true, 0, "portal", "body", 0.4),
  "phase-shot": L("hsl(290 85% 62%)", "hsl(185 100% 75%)", "pixel", true, 0, "portal"),
  "blink-barrage": L("hsl(265 85% 65%)", "hsl(195 100% 80%)", "pixel", true, 0, "portal"),
  "rift-burst": L("hsl(280 80% 45%)", "hsl(310 100% 80%)", "shard", true, 200, "portal", "body", 0.55),
  // Vita
  "life-tap": L("hsl(130 60% 42%)", "hsl(350 85% 62%)", "leaf", false, -40, "sprout", "hand", 0.4),
  "mend": L("hsl(110 65% 50%)", "hsl(80 90% 75%)", "leaf", false, -120, undefined, "body", 0.9),
  "thorn-seed": L("hsl(95 50% 35%)", "hsl(70 70% 60%)", "leaf", false, 300, "sprout"),
  "bloom-burst": L("hsl(330 85% 70%)", "hsl(55 100% 75%)", "petal", false, 60, "sprout", "body", 0.6),
  // Toxi
  "venom-jab": L("hsl(100 80% 45%)", "hsl(80 100% 65%)", "drop", false, 600, "bite", "hand", 0.34),
  "acid-spit": L("hsl(75 100% 50%)", "hsl(65 100% 75%)", "bubble", false, -80, "fizz"),
  "miasma-cloud": L("hsl(285 40% 40%)", "hsl(110 60% 55%)", "bubble", false, -60),
  "plague-burst": L("hsl(95 45% 38%)", "hsl(290 50% 60%)", "dust", false, -50, "fizz", "body", 0.7),
  // Chrono
  "tick-strike": L("hsl(42 70% 55%)", "hsl(45 90% 85%)", "glyph", true, 0, "clock", "hand", 0.3),
  "time-bolt": L("hsl(35 80% 50%)", "hsl(190 80% 80%)", "ring", true, 0, "clock"),
  "stasis-field": L("hsl(195 60% 60%)", "hsl(45 90% 75%)", "star", true, 0),
  "rewind": L("hsl(170 60% 55%)", "hsl(45 90% 80%)", "glyph", true, -60, undefined, "body", 1.0),
  // Magneto
  "iron-fist": L("hsl(220 10% 60%)", "hsl(30 100% 60%)", "spark", false, 600, "sparks", "hand", 0.3),
  "shard-storm": L("hsl(210 12% 70%)", "hsl(0 0% 100%)", "shard", false, 700, "sparks"),
  "magnet-pull": L("hsl(0 80% 55%)", "hsl(215 90% 60%)", "bolt", true, 0, "sparks"),
  "railgun": L("hsl(205 100% 60%)", "hsl(0 0% 100%)", "spark", true, 0, "sparks"),
  // Psy
  "mind-jab": L("hsl(320 85% 65%)", "hsl(300 100% 88%)", "ring", true, -20, "ripple", "hand", 0.34),
  "psychic-lift": L("hsl(285 80% 65%)", "hsl(320 100% 85%)", "glyph", true, -150, "ripple"),
  "psi-wave": L("hsl(330 90% 60%)", "hsl(290 90% 80%)", "ring", true, 0, "ripple"),
  "mind-crush": L("hsl(310 70% 45%)", "hsl(330 100% 75%)", "star", true, 0, "ripple", "body", 0.7),
  // Shift
  "morph-strike": L("hsl(150 70% 50%)", "hsl(280 80% 70%)", "bubble", false, 0, "splat", "hand", 0.3),
  "mimic": L("hsl(200 80% 60%)", "hsl(320 90% 70%)", "pixel", true, 0, undefined, "body", 0.6),
  "blade-arm": L("hsl(160 30% 70%)", "hsl(0 0% 100%)", "shard", false, 400, "cross", "hand", 0.26),
  "slime-shot": L("hsl(120 75% 50%)", "hsl(90 100% 80%)", "drop", false, 700, "splat"),

  // ----- Story bosses (bosses.ts): their own moves, no fighter's -----
  // Nullshade, antimatter
  "positron-palm": L("hsl(186 100% 70%)", "hsl(0 0% 100%)", "ring", true, 0, "implode"),
  "antimatter-lance": L("hsl(268 70% 14%)", "hsl(186 100% 78%)", "spark", true, 0, "implode"),
  "annihilation": L("hsl(0 0% 100%)", "hsl(268 70% 22%)", "spark", true, 0, "starburst"),
  "null-field": L("hsl(268 70% 8%)", "hsl(186 100% 76%)", "ring", true, 0),
  "pair-burst": L("hsl(0 0% 100%)", "hsl(268 60% 25%)", "spark", true, 0, "implode"),
  "zero-point": L("hsl(186 100% 70%)", "hsl(0 0% 100%)", "ring", true, 0, "implode"),
  // Maelstrom, the storm at sea
  "trident-rake": L("hsl(190 90% 62%)", "hsl(54 100% 75%)", "drop", false, 700, "splash"),
  "tidal-wall": L("hsl(212 80% 40%)", "hsl(186 100% 85%)", "drop", false, 800, "splash"),
  "eye-of-the-storm": L("hsl(214 50% 30%)", "hsl(186 100% 80%)", "drop", false, -40),
  "thunderhead": L("hsl(220 30% 40%)", "hsl(54 100% 75%)", "bolt", true, 0, "fork"),
  "riptide": L("hsl(205 90% 50%)", "hsl(186 100% 82%)", "drop", false, 700, "ripple"),
  "waterspout": L("hsl(205 85% 45%)", "hsl(186 100% 88%)", "drop", false, 900, "splash"),
  // Magmaw, the living volcano
  "magma-bite": L("hsl(20 100% 50%)", "hsl(44 100% 66%)", "ember", true, -200, "bite"),
  "fault-line": L("hsl(14 100% 48%)", "hsl(44 100% 64%)", "ember", true, -260, "crater"),
  "lava-bombs": L("hsl(12 60% 22%)", "hsl(30 100% 58%)", "ember", true, -120, "crater"),
  "magma-lake": L("hsl(16 100% 46%)", "hsl(44 100% 66%)", "ember", true, -200),
  "volcanic-roar": L("hsl(10 90% 45%)", "hsl(40 100% 62%)", "ember", true, -300, "flare"),
  "obsidian-hide": L("hsl(260 15% 18%)", "hsl(28 100% 60%)", "chunk", false, 600),
  // Everwinter, frozen time
  "rime-sickle": L("hsl(200 80% 78%)", "hsl(44 90% 76%)", "flake", false, 60, "shatter"),
  "time-stop": L("hsl(44 90% 66%)", "hsl(200 90% 90%)", "glyph", true, 0, "clock"),
  "hourglass-icicles": L("hsl(198 80% 80%)", "hsl(44 90% 80%)", "flake", false, 300, "shatter"),
  "frost-lance": L("hsl(200 85% 70%)", "hsl(0 0% 100%)", "flake", false, 100, "shatter"),
  "rime-step": L("hsl(200 70% 85%)", "hsl(44 90% 76%)", "flake", false, 80, "clock"),
  "glacial-age": L("hsl(205 70% 80%)", "hsl(44 85% 75%)", "flake", false, 20),
  // The Riftmaker, reality warping
  "fold-strike": L("hsl(318 100% 62%)", "hsl(186 100% 72%)", "pixel", true, 0, "portal"),
  "reality-warp": L("hsl(318 100% 60%)", "hsl(186 100% 80%)", "pixel", true, 0),
  "dimension-tear": L("hsl(252 40% 8%)", "hsl(318 100% 72%)", "shard", true, 100, "portal"),
  "fold-space": L("hsl(186 100% 60%)", "hsl(318 100% 78%)", "pixel", true, 0, "portal"),
  "mirror-shards": L("hsl(186 60% 85%)", "hsl(318 100% 80%)", "shard", true, 200, "cross"),
  "unmake": L("hsl(318 100% 55%)", "hsl(0 0% 100%)", "pixel", true, 0, "portal"),
  // The Hollow King, soul reaping
  "reaper-scythe": L("hsl(165 22% 22%)", "hsl(152 92% 66%)", "smoke", false, -60, "slash", "hand", 0.3),
  "soul-chains": L("hsl(170 8% 62%)", "hsl(152 92% 66%)", "dot", true, 0, "implode"),
  "grave-hands": L("hsl(48 22% 84%)", "hsl(152 92% 64%)", "dust", false, 600, "crater"),
  "wailing-souls": L("hsl(152 80% 72%)", "hsl(150 70% 92%)", "smoke", false, -80, "implode"),
  "graveyard": L("hsl(168 24% 20%)", "hsl(152 92% 66%)", "smoke", false, -70),
  "soul-harvest": L("hsl(160 40% 16%)", "hsl(152 92% 68%)", "dot", true, -40, "implode", "body", 0.9),
  // The Black Sun, eclipse
  "corona-edge": L("hsl(28 100% 52%)", "hsl(46 100% 72%)", "ember", true, -180, "flare", "hand", 0.28),
  "solar-flare": L("hsl(22 100% 52%)", "hsl(48 100% 80%)", "ember", true, -120, "flare"),
  "sunspot-rain": L("hsl(20 40% 10%)", "hsl(38 100% 60%)", "ember", true, -100, "crater", "sky", 1.1),
  "eclipse-disc": L("hsl(250 40% 6%)", "hsl(44 100% 70%)", "spark", true, 0, "starburst"),
  "prominence": L("hsl(18 100% 52%)", "hsl(48 100% 76%)", "ember", true, -260, "flare"),
  "total-eclipse": L("hsl(250 40% 6%)", "hsl(44 100% 72%)", "star", true, 0, "starburst", "body", 0.9),
};

// ---------- form moves ----------
// The moves a fighter gains in its form (app/lib/forms.ts). Each has its own colours, particles and hit mark,
// and borrows the hand-drawn signature (`sig`) of the move it grows out of, drawn in its own colours.
const F = (sig: string, a: string, b: string, p: PShape, add: boolean, grav: number, hit?: HitLook): Look => ({ ...L(a, b, p, add, grav, hit), sig });
const FORM_LOOKS: Record<string, Look> = {
  // Rage Mode
  "blue-comet": F("fireball", "hsl(222 100% 58%)", "hsl(190 100% 84%)", "ember", true, -140, "flare"),
  "azure-inferno": F("inferno-ring", "hsl(226 95% 52%)", "hsl(195 100% 80%)", "ember", true, -260, "flare"),
  "black-bolt-rush": F("cyclone-spin", "hsl(265 45% 9%)", "hsl(0 0% 100%)", "bolt", false, 0, "fork"),
  "thunder-judgement": F("storm-call", "hsl(265 40% 12%)", "hsl(0 0% 100%)", "bolt", false, 0, "fork"),
  "hurricane-blades": F("wind-blade", "hsl(166 88% 34%)", "hsl(146 100% 86%)", "spark", true, 0, "slash"),
  "hurricane-eye": F("singularity", "hsl(168 70% 30%)", "hsl(150 100% 84%)", "leaf", false, -80, "swirl"),
  "molten-fist": F("boulder-fist", "hsl(14 90% 46%)", "hsl(42 100% 64%)", "ember", true, -160, "crater"),
  "volcanic-rupture": F("flame-pillar", "hsl(10 85% 40%)", "hsl(38 100% 62%)", "chunk", false, 900, "crater"),
  // Awakened Mode
  "abyssal-maw": F("gravity-pull", "hsl(278 70% 20%)", "hsl(310 100% 70%)", "smoke", false, -40, "bite"),
  "eclipse-fang": F("shadow-step", "hsl(270 60% 10%)", "hsl(310 100% 72%)", "smoke", false, -60, "slash"),
  "solar-lance": F("prism-beam", "hsl(44 100% 60%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "heavens-gate": F("light-lances", "hsl(48 100% 66%)", "hsl(0 0% 100%)", "star", true, 160, "cross"),
  "collapsing-star": F("singularity", "hsl(255 70% 30%)", "hsl(275 100% 84%)", "star", true, 0, "implode"),
  "planet-crusher": F("meteor-drop", "hsl(255 50% 26%)", "hsl(275 100% 80%)", "chunk", false, 800, "crater"),
  "hydra-lash": F("blade-arm", "hsl(318 85% 54%)", "hsl(150 100% 72%)", "drop", false, 300, "bite"),
  "chimera-burst": F("plague-burst", "hsl(318 80% 48%)", "hsl(150 100% 70%)", "bubble", false, -60, "splat"),
  // Mastery Mode
  "frozen-requiem": F("frost-lance", "hsl(205 90% 66%)", "hsl(0 0% 100%)", "flake", false, 40, "shatter"),
  "glacial-lotus": F("glacier-spike", "hsl(200 80% 78%)", "hsl(0 0% 100%)", "flake", false, 200, "shatter"),
  "tsunami-crash": F("tidal-wall", "hsl(215 90% 46%)", "hsl(185 100% 88%)", "drop", false, 800, "splash"),
  "hydro-cutter": F("railgun", "hsl(205 100% 56%)", "hsl(185 100% 90%)", "drop", false, 600, "ripple"),
  "thousand-blades": F("shard-storm", "hsl(220 16% 64%)", "hsl(355 90% 68%)", "shard", false, 600, "sparks"),
  "magnetic-storm": F("stasis-field", "hsl(220 18% 50%)", "hsl(355 90% 66%)", "shard", false, 0, "sparks"),
  "hydra-venom": F("acid-spit", "hsl(100 75% 42%)", "hsl(280 70% 72%)", "bubble", false, -80, "fizz"),
  "plague-garden": F("miasma-cloud", "hsl(96 60% 34%)", "hsl(280 70% 70%)", "petal", false, -60, "fizz"),
  // Mystic Mode
  "starfall-portals": F("light-lances", "hsl(265 85% 62%)", "hsl(186 100% 84%)", "star", true, 160, "portal"),
  "void-step": F("warp-kick", "hsl(262 80% 40%)", "hsl(186 100% 82%)", "glyph", true, 0, "portal"),
  "verdant-wrath": F("earth-spike", "hsl(135 60% 34%)", "hsl(58 100% 76%)", "leaf", false, 400, "sprout"),
  "sacred-bloom": F("mend", "hsl(135 65% 44%)", "hsl(55 100% 80%)", "petal", false, -120),
  "clockwork-judgement": F("time-bolt", "hsl(38 80% 54%)", "hsl(180 100% 84%)", "glyph", true, 0, "clock"),
  "paradox-field": F("stasis-field", "hsl(40 70% 46%)", "hsl(180 100% 82%)", "glyph", true, 0, "clock"),
  "mind-shatter": F("thunder-bolt", "hsl(292 75% 58%)", "hsl(330 100% 86%)", "glyph", true, 0, "ripple"),
  "psychic-maelstrom": F("mind-crush", "hsl(290 70% 46%)", "hsl(330 100% 84%)", "star", true, -30, "ripple"),
  // Perfected Flame: red and blue fire at once
  "twin-dragon-flame": F("fireball", "hsl(2 95% 54%)", "hsl(214 100% 64%)", "ember", true, -140, "flare"),
  "crimson-azure-nova": F("sun-flare", "hsl(2 95% 54%)", "hsl(214 100% 64%)", "ember", true, -200, "starburst"),
  // Boss phases (BOSS_PHASES in bosses.ts): each grows out of one of the boss's own moves
  // Nullshade
  "twin-orbit": F("pair-burst", "hsl(0 0% 100%)", "hsl(186 100% 72%)", "ring", true, 0, "implode"),
  "antimatter-grasp": F("antimatter-lance", "hsl(268 70% 18%)", "hsl(186 100% 78%)", "spark", true, 0, "implode"),
  "chain-annihilation": F("annihilation", "hsl(186 100% 62%)", "hsl(0 0% 100%)", "spark", true, -80, "starburst"),
  "erasure-beam": F("antimatter-lance", "hsl(0 0% 100%)", "hsl(186 100% 70%)", "ring", true, 0, "implode"),
  "absolute-null": F("null-field", "hsl(268 80% 5%)", "hsl(186 100% 70%)", "ring", true, 0),
  "big-crunch": F("zero-point", "hsl(268 80% 8%)", "hsl(186 100% 76%)", "spark", true, 0, "implode"),
  // Maelstrom
  "undertow": F("tidal-wall", "hsl(212 85% 34%)", "hsl(186 100% 82%)", "drop", false, 800, "ripple"),
  "harpoon-tide": F("trident-rake", "hsl(200 90% 50%)", "hsl(186 100% 86%)", "drop", false, 600, "splash"),
  "lightning-trident": F("thunderhead", "hsl(54 100% 70%)", "hsl(0 0% 100%)", "bolt", true, 0, "fork"),
  "squall-line": F("thunderhead", "hsl(220 35% 34%)", "hsl(54 100% 76%)", "bolt", true, 0, "fork"),
  "leviathan-maw": F("riptide", "hsl(205 90% 18%)", "hsl(170 100% 70%)", "drop", false, 600, "bite"),
  "drowned-world": F("eye-of-the-storm", "hsl(205 90% 16%)", "hsl(170 100% 66%)", "bubble", false, -60),
  // Magmaw
  "magma-geyser": F("fault-line", "hsl(16 100% 48%)", "hsl(48 100% 68%)", "ember", true, -320, "flare"),
  "cinder-spit": F("lava-bombs", "hsl(14 50% 22%)", "hsl(30 100% 60%)", "ember", true, -100, "crater"),
  "ash-storm": F("magma-lake", "hsl(20 10% 24%)", "hsl(26 100% 58%)", "smoke", false, -60),
  "pyroclastic-flow": F("tidal-wall", "hsl(16 30% 20%)", "hsl(30 100% 58%)", "smoke", false, -40, "crater"),
  "supervolcano": F("volcanic-roar", "hsl(10 100% 46%)", "hsl(50 100% 72%)", "ember", true, -300, "flare"),
  "caldera-crush": F("volcanic-roar", "hsl(14 100% 44%)", "hsl(48 100% 76%)", "chunk", false, 700, "crater"),
  // Everwinter
  "glacier-fang": F("fault-line", "hsl(210 60% 40%)", "hsl(196 100% 90%)", "shard", false, 450, "shatter"),
  "frozen-second": F("rime-step", "hsl(210 60% 56%)", "hsl(44 95% 78%)", "flake", false, 80, "clock"),
  "clock-hands": F("hourglass-icicles", "hsl(42 80% 56%)", "hsl(200 90% 92%)", "glyph", true, 0, "clock"),
  "rewound-blizzard": F("hourglass-icicles", "hsl(200 80% 82%)", "hsl(44 95% 80%)", "flake", false, 300, "shatter"),
  "eternal-stop": F("time-stop", "hsl(200 90% 80%)", "hsl(0 0% 100%)", "glyph", true, 0, "clock"),
  "absolute-winter": F("glacial-age", "hsl(200 80% 88%)", "hsl(0 0% 100%)", "flake", false, 20),
  // The Riftmaker
  "kaleidoscope": F("mirror-shards", "hsl(318 90% 62%)", "hsl(186 100% 82%)", "shard", true, 200, "cross"),
  "mirror-step": F("fold-space", "hsl(0 0% 96%)", "hsl(318 100% 74%)", "shard", true, 0, "portal"),
  "gravity-fold": F("dimension-tear", "hsl(252 70% 14%)", "hsl(186 100% 78%)", "star", true, 0, "implode"),
  "falling-sky": F("light-lances", "hsl(252 60% 40%)", "hsl(318 100% 84%)", "star", true, 200, "portal"),
  "rewrite": F("rift-burst", "hsl(186 100% 56%)", "hsl(318 100% 76%)", "pixel", true, 0, "portal"),
  "infinite-mirror": F("dimension-tear", "hsl(0 0% 100%)", "hsl(318 100% 70%)", "shard", true, 100, "cross"),
  // The Hollow King
  "reaver-throw": F("reaper-scythe", "hsl(165 22% 20%)", "hsl(152 100% 70%)", "smoke", false, -60, "slash"),
  "ghost-march": F("reaper-scythe", "hsl(160 30% 30%)", "hsl(150 100% 80%)", "smoke", false, -80, "slash"),
  "bone-spires": F("bone-zone", "hsl(44 30% 84%)", "hsl(152 92% 64%)", "dust", false, 600, "crater"),
  "banshee-wail": F("wailing-souls", "hsl(150 60% 70%)", "hsl(0 0% 100%)", "smoke", false, -100, "ripple"),
  "final-harvest": F("soul-harvest", "hsl(165 40% 8%)", "hsl(150 100% 76%)", "dot", true, -60, "implode"),
  "requiem": F("graveyard", "hsl(170 40% 8%)", "hsl(150 100% 72%)", "smoke", false, -80),
  // The Black Sun
  "sunspot-volley": F("eclipse-disc", "hsl(20 50% 10%)", "hsl(40 100% 64%)", "ember", true, -120, "flare"),
  "sunrush": F("corona-edge", "hsl(26 100% 52%)", "hsl(48 100% 76%)", "ember", true, -200, "flare"),
  "umbral-ray": F("solar-flare", "hsl(250 40% 8%)", "hsl(44 100% 72%)", "spark", true, 0, "starburst"),
  "shadow-flare": F("prominence", "hsl(250 40% 10%)", "hsl(44 100% 70%)", "smoke", false, -200, "starburst"),
  "supernova": F("total-eclipse", "hsl(40 100% 70%)", "hsl(0 0% 100%)", "star", true, -100, "flare"),
  "endless-night": F("total-eclipse", "hsl(250 50% 4%)", "hsl(44 100% 76%)", "star", true, 0, "starburst"),
};
// ---------- quest fighters ----------
// Parallax (space), Hexizon (indie games), Halflife (gamma), Redline (speed), Liminal (portals and matter), Overtone (sound), Vellum (paper),
// Facet (crystal), Sirocco (sand), and the new generation: Volta (plasma), Briar (plants) and Turbo (chaos energy).
// Their signature moves have hand-drawn looks of their own (Spatial Cut, Spatial Prison, Gaster Blaster, Bone Barrage, Bone Zone, Jumbo Roundabout,
// Blaster Storm, Gamma Ray, Mach Rush, Ring Gate, Power Chord, Staccato, Wall of Sound, Crane Flock, Shuriken Fold, Scroll Unfurl);
// the rest borrow a signature (`sig`) drawn in their own colours, like the form moves.
Object.assign(LOOKS, {
  "spatial-cut": L("hsl(245 70% 8%)", "hsl(188 100% 74%)", "shard", true, 0, "slash"),
  "spatial-prison": L("hsl(250 60% 30%)", "hsl(188 100% 74%)", "shard", true, 0),
  "gaster-blaster": L("hsl(190 100% 70%)", "hsl(0 0% 100%)", "pixel", true, 0, "starburst"),
  "bone-barrage": L("hsl(45 25% 88%)", "hsl(128 100% 60%)", "dust", false, 200, "crater"),
  "bone-zone": L("hsl(45 25% 88%)", "hsl(128 100% 60%)", "dust", false, 600, "crater"),
  "jumbo-roundabout": L("hsl(330 90% 62%)", "hsl(50 100% 70%)", "star", true, 0, "starburst"),
  "blaster-storm": L("hsl(350 100% 60%)", "hsl(0 0% 100%)", "pixel", true, 0, "starburst", "sky", 1.1),
  "gamma-ray": L("hsl(80 100% 46%)", "hsl(62 100% 80%)", "spark", true, -80, "flare"),
  "mach-rush": L("hsl(356 90% 52%)", "hsl(44 100% 66%)", "spark", true, 0, "slash"),
  "ring-gate": L("hsl(318 100% 62%)", "hsl(176 100% 66%)", "ring", true, 0, "portal"),
  "power-chord": L("hsl(32 100% 56%)", "hsl(48 100% 86%)", "ring", true, 0, "ripple"),
  "staccato": L("hsl(38 100% 58%)", "hsl(48 100% 88%)", "glyph", true, 0, "sparks"),
  "wall-of-sound": L("hsl(30 100% 54%)", "hsl(48 100% 86%)", "ring", true, 0, "ripple"),
  "crane-flock": L("hsl(42 40% 93%)", "hsl(352 85% 56%)", "leaf", false, 60, "slash"),
  "shuriken-fold": L("hsl(42 40% 93%)", "hsl(352 85% 56%)", "leaf", false, 100, "slash"),
  "scroll-unfurl": L("hsl(42 45% 90%)", "hsl(352 85% 54%)", "leaf", false, 60, "slash"),
} satisfies Record<string, Look>);
const QUEST_LOOKS: Record<string, Look> = {
  // Parallax
  "fold-palm": F("mind-jab", "hsl(234 60% 40%)", "hsl(188 100% 76%)", "ring", true, 0, "ripple"),
  "rend-reach": F("blade-arm", "hsl(245 70% 14%)", "hsl(188 100% 76%)", "shard", true, 0, "slash"),
  "space-fold": F("warp-kick", "hsl(250 70% 40%)", "hsl(188 100% 80%)", "shard", true, 0, "portal"),
  "pocket-pull": F("gravity-pull", "hsl(240 60% 30%)", "hsl(188 100% 74%)", "ring", true, 0, "implode"),
  "repulse-plane": F("rift-burst", "hsl(230 60% 40%)", "hsl(188 100% 82%)", "shard", true, 200, "ripple"),
  "lattice-shards": F("shard-storm", "hsl(220 60% 60%)", "hsl(188 100% 88%)", "shard", true, 0, "shatter"),
  "compression": F("psychic-lift", "hsl(248 60% 34%)", "hsl(188 100% 78%)", "ring", true, 0, "implode"),
  "fracture-rain": F("light-lances", "hsl(240 60% 50%)", "hsl(188 100% 86%)", "shard", true, 200, "shatter"),
  "distance-zero": F("blink-barrage", "hsl(250 70% 50%)", "hsl(188 100% 80%)", "shard", true, 0, "portal"),
  "rift-disc": F("phase-shot", "hsl(255 70% 30%)", "hsl(188 100% 78%)", "shard", true, 0, "portal"),
  "world-severance": F("spatial-cut", "hsl(250 60% 3%)", "hsl(280 100% 70%)", "shard", true, 0, "slash"),
  "absolute-prison": F("spatial-prison", "hsl(268 80% 30%)", "hsl(280 100% 72%)", "shard", true, 0),
  "event-collapse": F("mind-crush", "hsl(260 70% 12%)", "hsl(188 100% 76%)", "star", true, 0, "implode"),
  // Hexizon
  "bone-staff": F("shade-slash", "hsl(45 25% 85%)", "hsl(128 100% 60%)", "pixel", true, 0, "slash"),
  "staff-vault": F("gale-kick", "hsl(128 90% 40%)", "hsl(128 100% 74%)", "pixel", true, 0, "crater"),
  "blue-soul": F("magnet-pull", "hsl(222 100% 55%)", "hsl(200 100% 80%)", "pixel", true, 0, "implode"),
  "spread-shot": F("phase-shot", "hsl(128 100% 45%)", "hsl(90 100% 78%)", "pixel", true, 0, "sparks"),
  "parry-dash": F("blink-barrage", "hsl(320 90% 62%)", "hsl(330 100% 84%)", "star", true, 0, "starburst"),
  "glitch-step": F("warp-kick", "hsl(128 100% 45%)", "hsl(300 100% 70%)", "pixel", true, 0, "portal"),
  "abyss-shriek": F("mind-crush", "hsl(150 30% 6%)", "hsl(0 0% 96%)", "smoke", false, -60, "ripple"),
  "karma-field": F("miasma-cloud", "hsl(290 70% 40%)", "hsl(350 100% 66%)", "pixel", true, -40, "fizz"),
  "bad-time": F("bone-zone", "hsl(45 25% 88%)", "hsl(350 100% 60%)", "dust", false, 600, "crater"),
  "determination": F("mend", "hsl(350 100% 55%)", "hsl(45 100% 70%)", "plus", true, -120),
  // Halflife
  "rad-fist": F("heavy-palm", "hsl(84 90% 40%)", "hsl(66 100% 72%)", "spark", true, -120, "flare"),
  "meltdown-hook": F("ember-jab", "hsl(76 100% 44%)", "hsl(55 100% 70%)", "ember", true, -200, "flare"),
  "isotope-shot": F("dark-orb", "hsl(88 100% 38%)", "hsl(68 100% 74%)", "bubble", true, -60, "fizz"),
  "fission-split": F("thunderhead", "hsl(96 90% 42%)", "hsl(60 100% 76%)", "spark", true, 0, "starburst"),
  "critical-pulse": F("sun-flare", "hsl(84 100% 42%)", "hsl(62 100% 78%)", "spark", true, -100, "flare"),
  "fallout-zone": F("miasma-cloud", "hsl(90 70% 26%)", "hsl(70 100% 60%)", "smoke", false, -40, "fizz"),
  "core-slam": F("prominence", "hsl(84 100% 40%)", "hsl(60 100% 74%)", "ember", true, -260, "crater"),
  "fallout-rain": F("sunspot-rain", "hsl(90 90% 36%)", "hsl(66 100% 70%)", "drop", true, 400, "fizz"),
  "reactor-charge": F("blink-barrage", "hsl(84 100% 40%)", "hsl(62 100% 76%)", "spark", true, -60, "crater"),
  "neutron-pull": F("gravity-pull", "hsl(96 70% 30%)", "hsl(66 100% 70%)", "ring", true, 0, "implode"),
  "cell-mutation": F("mend", "hsl(88 90% 40%)", "hsl(62 100% 76%)", "plus", true, -120),
  "omega-ray": F("gamma-ray", "hsl(62 100% 46%)", "hsl(0 0% 100%)", "spark", true, -80, "flare"),
  "chain-reaction": F("meteor-drop", "hsl(80 100% 36%)", "hsl(55 100% 70%)", "ember", true, 400, "starburst"),
  "ground-zero": F("inferno-ring", "hsl(70 100% 40%)", "hsl(55 100% 76%)", "ember", true, -260, "starburst"),
  // Redline
  "blur-jab": F("flash-jab", "hsl(356 85% 54%)", "hsl(44 100% 70%)", "spark", true, 0, "sparks"),
  "hundred-fists": F("iron-fist", "hsl(8 90% 52%)", "hsl(48 100% 70%)", "spark", true, 0, "starburst"),
  "slipstream-kick": F("gale-kick", "hsl(350 80% 50%)", "hsl(40 100% 72%)", "spark", true, -40, "swirl"),
  "sonic-boom": F("psi-wave", "hsl(30 100% 58%)", "hsl(0 0% 100%)", "spark", true, 0, "ripple"),
  "afterimage": F("shadow-step", "hsl(356 85% 48%)", "hsl(44 100% 68%)", "spark", true, 0, "slash"),
  "vortex-laps": F("eye-of-the-storm", "hsl(4 80% 46%)", "hsl(44 100% 70%)", "spark", true, -40, "swirl"),
  "friction-burn": F("inferno-ring", "hsl(14 100% 50%)", "hsl(48 100% 66%)", "ember", true, -200, "flare"),
  "mach-pebbles": F("rock-toss", "hsl(30 30% 46%)", "hsl(44 100% 70%)", "dust", false, 0, "crater"),
  "skyfall-heel": F("fault-line", "hsl(356 80% 46%)", "hsl(44 100% 68%)", "dust", false, 300, "crater"),
  "slingshot": F("magnet-pull", "hsl(356 90% 50%)", "hsl(44 100% 70%)", "spark", true, 0, "implode"),
  "lightspeed-lunge": F("blade-arm", "hsl(44 100% 56%)", "hsl(0 0% 100%)", "spark", true, 0, "slash"),
  "light-barrier": F("mach-rush", "hsl(0 100% 46%)", "hsl(0 0% 100%)", "spark", true, 0, "starburst"),
  "zero-frame": F("warp-kick", "hsl(0 100% 40%)", "hsl(40 100% 66%)", "spark", true, 0, "slash"),
  "infinite-laps": F("eye-of-the-storm", "hsl(0 90% 30%)", "hsl(40 100% 64%)", "ember", true, -60, "swirl"),
  // Liminal
  "portal-punch": F("warp-kick", "hsl(318 90% 56%)", "hsl(176 100% 70%)", "ring", true, 0, "portal"),
  "matter-palm": F("mind-jab", "hsl(280 50% 44%)", "hsl(318 100% 76%)", "chunk", false, 600, "shatter"),
  "portal-volley": F("phase-shot", "hsl(318 100% 60%)", "hsl(176 100% 72%)", "ring", true, 0, "portal"),
  "matter-lance": F("antimatter-lance", "hsl(290 70% 36%)", "hsl(176 100% 72%)", "chunk", false, 400, "shatter"),
  "portal-drop": F("meteor-drop", "hsl(300 60% 34%)", "hsl(318 100% 72%)", "chunk", false, 900, "crater"),
  "back-door": F("shadow-step", "hsl(318 90% 50%)", "hsl(176 100% 70%)", "ring", true, 0, "portal"),
  "transmute-floor": F("stasis-field", "hsl(280 50% 30%)", "hsl(176 100% 64%)", "chunk", false, 0, "shatter"),
  "matter-spike": F("earth-spike", "hsl(285 40% 30%)", "hsl(318 100% 70%)", "chunk", false, 1000, "crater"),
  "portal-pull": F("dimension-tear", "hsl(318 90% 46%)", "hsl(176 100% 70%)", "ring", true, 0, "portal"),
  "unmake": F("rift-burst", "hsl(300 80% 44%)", "hsl(176 100% 74%)", "chunk", false, 300, "shatter"),
  "reassemble": F("rewind", "hsl(318 90% 56%)", "hsl(176 100% 76%)", "chunk", false, -60),
  "thousand-doors": F("light-lances", "hsl(300 90% 40%)", "hsl(176 100% 70%)", "ring", true, 200, "portal"),
  "matter-collapse": F("singularity", "hsl(280 70% 16%)", "hsl(176 100% 66%)", "chunk", false, 0, "implode"),
  "unmaking-gate": F("ring-gate", "hsl(300 90% 40%)", "hsl(176 100% 66%)", "ring", true, 0, "portal"),
  // Overtone
  "beat-jab": F("flash-jab", "hsl(36 100% 56%)", "hsl(48 100% 86%)", "ring", true, 0, "ripple"),
  "downbeat": F("boulder-fist", "hsl(26 100% 48%)", "hsl(48 100% 80%)", "ring", true, 0, "crater"),
  "bass-drop": F("psychic-lift", "hsl(24 100% 46%)", "hsl(48 100% 80%)", "ring", true, 0, "crater"),
  "high-note": F("sun-flare", "hsl(44 100% 60%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "echo-step": F("warp-kick", "hsl(34 100% 54%)", "hsl(48 100% 88%)", "ring", true, 0, "ripple"),
  "dead-air": F("night-veil", "hsl(220 30% 14%)", "hsl(36 100% 70%)", "ring", true, 0),
  "drumroll": F("light-lances", "hsl(30 100% 54%)", "hsl(48 100% 84%)", "ring", true, 200, "ripple"),
  "feedback": F("magnet-pull", "hsl(20 100% 50%)", "hsl(48 100% 80%)", "ring", true, 0, "implode"),
  "crescendo-rush": F("blink-barrage", "hsl(36 100% 52%)", "hsl(48 100% 86%)", "ring", true, 0, "ripple"),
  "final-chorus": F("wall-of-sound", "hsl(8 100% 50%)", "hsl(0 0% 100%)", "ring", true, 0, "ripple"),
  "mosh-pit": F("singularity", "hsl(0 70% 20%)", "hsl(8 100% 64%)", "ring", true, 0, "implode"),
  "earsplitter": F("mind-crush", "hsl(8 100% 48%)", "hsl(36 100% 70%)", "ring", true, 0, "ripple"),
  // Vellum
  "papercut": F("shade-slash", "hsl(42 40% 92%)", "hsl(352 85% 58%)", "leaf", false, 120, "slash"),
  "folded-fan": F("gale-kick", "hsl(352 80% 54%)", "hsl(42 50% 94%)", "leaf", false, 80, "slash"),
  "thousand-folds": F("rift-burst", "hsl(42 40% 90%)", "hsl(352 85% 58%)", "leaf", false, 100, "slash"),
  "wrapping-seal": F("stasis-field", "hsl(42 40% 86%)", "hsl(352 85% 56%)", "leaf", false, 40),
  "paper-rain": F("crane-flock", "hsl(42 40% 92%)", "hsl(352 85% 60%)", "leaf", false, 200, "slash"),
  "folding-spire": F("glacier-spike", "hsl(42 35% 88%)", "hsl(352 85% 58%)", "leaf", false, 300, "shatter"),
  "paper-plane": F("blink-barrage", "hsl(42 40% 94%)", "hsl(352 85% 58%)", "leaf", false, 60, "slash"),
  "paper-tether": F("magnet-pull", "hsl(42 40% 90%)", "hsl(352 85% 58%)", "leaf", false, 0, "implode"),
  "refold": F("mend", "hsl(42 50% 92%)", "hsl(352 85% 62%)", "leaf", false, -100),
  "thousand-cranes": F("crane-flock", "hsl(0 0% 12%)", "hsl(352 100% 58%)", "leaf", false, 200, "slash"),
  "ink-flood": F("miasma-cloud", "hsl(0 0% 6%)", "hsl(352 100% 56%)", "smoke", false, -40, "splat"),
  "black-crane": F("crane-flock", "hsl(0 0% 10%)", "hsl(352 100% 60%)", "leaf", false, 100, "slash"),
  // Facet
  "facet-jab": F("flash-jab", "hsl(286 45% 64%)", "hsl(172 100% 78%)", "shard", true, 200, "shatter"),
  "geode-crush": F("boulder-fist", "hsl(280 35% 42%)", "hsl(172 100% 74%)", "shard", false, 600, "crater"),
  "prism-split": F("antimatter-lance", "hsl(286 60% 64%)", "hsl(172 100% 82%)", "shard", true, 0, "starburst"),
  "crystal-spray": F("ice-shard-volley", "hsl(290 50% 70%)", "hsl(172 100% 82%)", "shard", true, 200, "shatter"),
  "gem-lance": F("railgun", "hsl(282 55% 54%)", "hsl(172 100% 78%)", "shard", true, 0, "shatter"),
  "crystal-spire": F("glacier-spike", "hsl(286 45% 60%)", "hsl(172 100% 78%)", "shard", false, 400, "shatter"),
  "shard-rain": F("light-lances", "hsl(290 50% 66%)", "hsl(172 100% 84%)", "shard", true, 300, "shatter"),
  "amethyst-field": F("frozen-floor", "hsl(282 50% 48%)", "hsl(172 100% 76%)", "shard", true, 0),
  "refraction-step": F("warp-kick", "hsl(286 60% 66%)", "hsl(172 100% 84%)", "spark", true, 0, "starburst"),
  "shatter-nova": F("rift-burst", "hsl(286 45% 62%)", "hsl(172 100% 80%)", "shard", false, 500, "shatter"),
  "crystal-tether": F("magnet-pull", "hsl(282 50% 56%)", "hsl(172 100% 78%)", "shard", true, 0, "implode"),
  "regrow-facets": F("mend", "hsl(286 50% 66%)", "hsl(172 100% 80%)", "shard", true, -120),
  "diamond-storm": F("light-lances", "hsl(280 20% 12%)", "hsl(350 100% 62%)", "shard", true, 300, "shatter"),
  "obsidian-prison": F("spatial-prison", "hsl(280 20% 8%)", "hsl(350 100% 60%)", "shard", true, 0),
  "spectrum-ray": F("antimatter-lance", "hsl(340 90% 50%)", "hsl(172 100% 80%)", "spark", true, 0, "starburst"),
  // Sirocco
  "sand-lash": F("water-whip", "hsl(36 55% 58%)", "hsl(26 100% 64%)", "dust", false, 300, "slash"),
  "dune-kick": F("gale-kick", "hsl(34 50% 54%)", "hsl(26 100% 66%)", "dust", false, 300, "swirl"),
  "sand-blast": F("rock-toss", "hsl(38 50% 60%)", "hsl(28 100% 68%)", "dust", false, 300, "fizz"),
  "glass-shard": F("ice-shard-volley", "hsl(180 30% 82%)", "hsl(24 100% 64%)", "shard", true, 200, "shatter"),
  "sand-torrent": F("solar-flare", "hsl(36 55% 56%)", "hsl(30 100% 70%)", "dust", false, 200, "fizz"),
  "quicksand": F("magma-lake", "hsl(34 45% 38%)", "hsl(28 100% 62%)", "dust", false, 0, "implode"),
  "sand-spike": F("earth-spike", "hsl(36 50% 52%)", "hsl(26 100% 64%)", "dust", false, 800, "crater"),
  "sandstorm": F("meteor-drop", "hsl(36 50% 56%)", "hsl(28 100% 66%)", "dust", false, 500, "fizz"),
  "dust-devil": F("quake-stomp", "hsl(38 45% 60%)", "hsl(26 100% 66%)", "dust", false, -100, "swirl"),
  "mirage-step": F("shadow-step", "hsl(28 80% 60%)", "hsl(44 100% 80%)", "dust", false, -60, "swirl"),
  "sand-tether": F("magnet-pull", "hsl(36 50% 54%)", "hsl(26 100% 64%)", "dust", false, 0, "implode"),
  "dune-surf": F("mach-rush", "hsl(36 55% 56%)", "hsl(26 100% 66%)", "dust", false, 200, "crater"),
  "haboob": F("miasma-cloud", "hsl(20 40% 18%)", "hsl(10 100% 58%)", "dust", false, -40, "fizz"),
  "glass-tomb": F("glacier-spike", "hsl(14 40% 30%)", "hsl(10 100% 60%)", "shard", true, 300, "shatter"),
  "sand-sea": F("tidal-wall", "hsl(20 40% 16%)", "hsl(10 100% 58%)", "dust", false, 400, "splash"),
  // Volta (new generation)
  "plasma-jab": F("shock-knuckle", "hsl(322 85% 62%)", "hsl(190 100% 80%)", "spark", true, 0, "fork"),
  "flare-kick": F("gale-kick", "hsl(322 80% 60%)", "hsl(190 100% 78%)", "spark", true, -60, "flare"),
  "plasma-bolt": F("fireball", "hsl(318 90% 60%)", "hsl(190 100% 82%)", "spark", true, -80, "flare"),
  "arc-chain": F("ball-lightning", "hsl(190 100% 66%)", "hsl(322 100% 84%)", "bolt", true, 0, "fork"),
  "star-dive": F("mach-rush", "hsl(322 85% 58%)", "hsl(190 100% 80%)", "spark", true, -40, "starburst"),
  "nova-burst": F("rift-burst", "hsl(322 90% 62%)", "hsl(48 100% 84%)", "star", true, 0, "starburst"),
  "pocket-sun": F("fireball", "hsl(40 100% 62%)", "hsl(322 100% 86%)", "ember", true, -120, "starburst"),
  "recharge": F("mend", "hsl(190 100% 64%)", "hsl(322 100% 84%)", "spark", true, -120),
  // Volta, Surge Mode (SUPERNOVA)
  "corona-storm": F("sunspot-rain", "hsl(285 60% 14%)", "hsl(0 0% 100%)", "star", true, 100, "starburst"),
  "white-dwarf": F("fireball", "hsl(0 0% 100%)", "hsl(285 100% 72%)", "star", true, -80, "starburst"),
  "star-collapse": F("total-eclipse", "hsl(285 100% 60%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "supernova-fist": F("iron-fist", "hsl(285 100% 55%)", "hsl(0 0% 100%)", "spark", true, 0, "flare"),
  "twin-star-barrage": F("railgun", "hsl(190 100% 70%)", "hsl(285 100% 80%)", "star", true, 0, "starburst"),
  "zenith-beam": F("solar-flare", "hsl(285 100% 62%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "solar-rush": F("mach-rush", "hsl(285 90% 60%)", "hsl(190 100% 82%)", "star", true, -40, "flare"),
  "singularity-step": F("shadow-step", "hsl(190 100% 64%)", "hsl(285 100% 84%)", "star", true, -60, "starburst"),
  "corona-eruption": F("flame-pillar", "hsl(285 95% 58%)", "hsl(0 0% 100%)", "ember", true, -300, "flare"),
  "ion-cyclone": F("storm-call", "hsl(190 100% 60%)", "hsl(285 100% 82%)", "bolt", true, 0, "fork"),
  "stellar-undertow": F("gravity-pull", "hsl(285 80% 50%)", "hsl(190 100% 78%)", "star", true, 0, "implode"),
  "core-ignition": F("mend", "hsl(0 0% 100%)", "hsl(285 100% 78%)", "star", true, -120),
  // Briar (new generation)
  "thorn-jab": F("venom-jab", "hsl(118 50% 42%)", "hsl(330 100% 76%)", "leaf", false, 200, "bite"),
  "vine-whip": F("water-whip", "hsl(118 50% 40%)", "hsl(90 70% 62%)", "leaf", false, 200, "slash"),
  "thorn-volley": F("ice-shard-volley", "hsl(100 45% 38%)", "hsl(330 100% 74%)", "leaf", false, 200, "bite"),
  "seed-bomb": F("thorn-seed", "hsl(30 50% 36%)", "hsl(118 70% 60%)", "leaf", false, 260, "sprout"),
  "vine-grab": F("magnet-pull", "hsl(118 50% 40%)", "hsl(90 70% 62%)", "leaf", false, 0, "implode"),
  "snapjaw-bloom": F("bloom-burst", "hsl(330 90% 62%)", "hsl(118 60% 58%)", "petal", false, 120, "bite"),
  "leaf-step": F("shadow-step", "hsl(118 50% 46%)", "hsl(330 100% 78%)", "leaf", false, 80, "swirl"),
  "photosynthesis": F("mend", "hsl(100 70% 56%)", "hsl(52 100% 76%)", "leaf", false, -120, "sprout"),
  // Briar, Surge Mode (WILD OVERGROWTH)
  "thorn-forest": F("earth-spike", "hsl(140 30% 10%)", "hsl(350 100% 60%)", "leaf", false, 400, "bite"),
  "strangler-garden": F("miasma-cloud", "hsl(140 30% 8%)", "hsl(350 100% 58%)", "leaf", false, -40, "implode"),
  "carnivore-bloom": F("bloom-burst", "hsl(350 90% 40%)", "hsl(140 40% 30%)", "petal", false, 120, "bite"),
  "bramble-fist": F("venom-jab", "hsl(140 40% 20%)", "hsl(350 100% 60%)", "leaf", false, 200, "bite"),
  "spore-volley": F("acid-spit", "hsl(140 30% 24%)", "hsl(350 100% 58%)", "leaf", false, -80, "fizz"),
  "needle-storm": F("ice-shard-volley", "hsl(140 30% 16%)", "hsl(350 100% 62%)", "leaf", false, 250, "bite"),
  "seed-lance": F("soul-chains", "hsl(140 40% 22%)", "hsl(350 100% 66%)", "petal", true, 0, "flare"),
  "root-rush": F("quake-stomp", "hsl(140 35% 20%)", "hsl(350 100% 60%)", "leaf", false, -30, "crater"),
  "vine-step": F("warp-kick", "hsl(140 40% 24%)", "hsl(350 100% 66%)", "leaf", false, 80, "swirl"),
  "toxic-canopy": F("light-lances", "hsl(140 30% 12%)", "hsl(350 100% 60%)", "petal", false, 150, "fizz"),
  "deadfall-pull": F("magnet-pull", "hsl(140 35% 18%)", "hsl(350 100% 62%)", "leaf", false, 0, "implode"),
  "bloodroot-bloom": F("mend", "hsl(350 100% 40%)", "hsl(140 40% 30%)", "leaf", false, -120),
  // Turbo (new generation)
  "turbo-jab": F("shock-knuckle", "hsl(218 90% 58%)", "hsl(28 100% 66%)", "star", true, 0, "starburst"),
  "spin-kick": F("gale-kick", "hsl(218 90% 56%)", "hsl(28 100% 64%)", "spark", true, -40, "swirl"),
  "chaos-bolt": F("ball-lightning", "hsl(200 100% 62%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "chaos-javelin": F("ice-shard-volley", "hsl(210 100% 64%)", "hsl(48 100% 80%)", "star", true, 0, "flare"),
  "boost-dash": F("mach-rush", "hsl(218 95% 56%)", "hsl(28 100% 64%)", "spark", true, 0, "slash"),
  "blur-step": F("warp-kick", "hsl(210 100% 62%)", "hsl(0 0% 100%)", "star", true, 0, "swirl"),
  "chaos-burst": F("rift-burst", "hsl(218 95% 60%)", "hsl(48 100% 82%)", "star", true, 0, "starburst"),
  "second-wind": F("mend", "hsl(200 100% 66%)", "hsl(28 100% 74%)", "star", true, -120),
  // Turbo, Super Form (SEVEN EMERALDS)
  "golden-fist": F("iron-fist", "hsl(46 100% 56%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "gold-rush": F("mach-rush", "hsl(46 100% 56%)", "hsl(54 100% 84%)", "spark", true, 0, "slash"),
  "chaos-lance": F("solar-flare", "hsl(48 100% 60%)", "hsl(0 0% 100%)", "star", true, 0, "flare"),
  "emerald-volley": F("ice-shard-volley", "hsl(140 85% 50%)", "hsl(54 100% 84%)", "star", true, 0, "starburst"),
  "radiant-spin": F("rift-burst", "hsl(46 100% 58%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "chaos-rain": F("light-lances", "hsl(48 100% 62%)", "hsl(0 0% 100%)", "star", true, 100, "flare"),
  "still-field": F("storm-call", "hsl(200 100% 66%)", "hsl(50 100% 80%)", "star", true, 0, "swirl"),
  "gilded-pull": F("magnet-pull", "hsl(46 100% 54%)", "hsl(54 100% 84%)", "star", true, 0, "implode"),
  "flash-step": F("shadow-step", "hsl(50 100% 64%)", "hsl(0 0% 100%)", "star", true, -60, "starburst"),
  "chaos-pillar": F("flame-pillar", "hsl(46 100% 56%)", "hsl(0 0% 100%)", "star", true, -300, "flare"),
  "golden-comet": F("fireball", "hsl(46 100% 60%)", "hsl(0 0% 100%)", "star", true, -80, "starburst"),
  "emerald-mend": F("mend", "hsl(140 85% 56%)", "hsl(54 100% 84%)", "star", true, -120),
  // Turbo, Hyper Form (SUPER EMERALDS)
  "hyper-dash": F("mach-rush", "hsl(0 0% 96%)", "hsl(190 100% 76%)", "star", true, 0, "slash"),
  "prism-nova": F("total-eclipse", "hsl(310 100% 76%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "chromatic-lance": F("prism-beam", "hsl(190 100% 74%)", "hsl(310 100% 84%)", "star", true, 0, "flare"),
  // The Axiom, cosmic reality warping (a Story boss, kept here because every one of its moves borrows a signature)
  "galaxy-fist": F("mind-jab", "hsl(260 70% 40%)", "hsl(272 100% 84%)", "star", true, 0, "starburst"),
  "cosmic-rewrite": F("reality-warp", "hsl(272 100% 62%)", "hsl(48 100% 84%)", "star", true, 0),
  "cosmic-string": F("dimension-tear", "hsl(240 60% 8%)", "hsl(272 100% 82%)", "star", true, 0, "portal"),
  "star-shower": F("light-lances", "hsl(48 100% 70%)", "hsl(0 0% 100%)", "star", true, 200, "starburst"),
  "event-horizon": F("singularity", "hsl(250 70% 6%)", "hsl(272 100% 78%)", "star", true, 0, "implode"),
  "wormhole-step": F("warp-kick", "hsl(250 70% 30%)", "hsl(272 100% 84%)", "star", true, 0, "portal"),
  "planet-toss": F("meteor-drop", "hsl(290 50% 40%)", "hsl(200 100% 80%)", "chunk", false, 600, "crater"),
  "nebula-veil": F("night-veil", "hsl(290 70% 30%)", "hsl(200 100% 80%)", "smoke", false, -30),
  "supercluster": F("phase-shot", "hsl(48 100% 72%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "gravity-well": F("gravity-pull", "hsl(240 80% 30%)", "hsl(48 100% 82%)", "star", true, 0, "implode"),
  "big-bang": F("rift-burst", "hsl(0 0% 100%)", "hsl(272 100% 76%)", "star", true, 0, "starburst"),
  "heat-death": F("total-eclipse", "hsl(250 60% 4%)", "hsl(272 100% 80%)", "star", true, 0, "starburst"),
  // The Lanternmaw (Book 2): deep water and a lure's sickly light
  "hook-rake": F("shade-slash", "hsl(190 50% 16%)", "hsl(66 100% 66%)", "bubble", false, -60, "slash"),
  "lure-light": F("gravity-pull", "hsl(186 50% 14%)", "hsl(66 100% 72%)", "dot", true, 0, "implode"),
  "abyssal-coil": F("grave-hands", "hsl(186 44% 16%)", "hsl(66 100% 64%)", "drop", false, 600, "crater"),
  "drowned-whispers": F("wailing-souls", "hsl(180 60% 40%)", "hsl(66 100% 80%)", "bubble", false, -80, "implode"),
  "lantern-gaze": F("prism-beam", "hsl(66 100% 58%)", "hsl(60 100% 92%)", "dot", true, 0, "starburst"),
  "crushing-deep": F("null-field", "hsl(200 60% 8%)", "hsl(180 70% 60%)", "bubble", false, -40),
  "thousand-lures": F("wailing-souls", "hsl(66 100% 60%)", "hsl(60 100% 90%)", "dot", true, -40, "starburst"),
  "ink-cloud": F("night-veil", "hsl(210 60% 6%)", "hsl(180 60% 50%)", "smoke", false, -30),
  "many-eyes": F("light-lances", "hsl(64 100% 56%)", "hsl(60 40% 92%)", "dot", true, 200, "starburst"),
  "hadal-crush": F("mind-crush", "hsl(200 60% 10%)", "hsl(180 80% 66%)", "bubble", false, -60, "ripple"),
  "call-of-the-deep": F("null-field", "hsl(200 70% 4%)", "hsl(66 100% 66%)", "bubble", false, -60, "implode"),
  "elder-gaze": F("rift-burst", "hsl(64 100% 60%)", "hsl(0 0% 100%)", "dot", true, 0, "starburst"),
  // The Sporemother (Book 2): mauve fungus and cyan glowing spores
  "spore-lash": F("water-whip", "hsl(316 30% 30%)", "hsl(170 100% 70%)", "dust", false, -40, "splat"),
  "choir-spores": F("wailing-souls", "hsl(170 90% 56%)", "hsl(320 80% 86%)", "bubble", true, -60, "fizz"),
  "root-snare": F("soul-chains", "hsl(24 30% 22%)", "hsl(170 100% 66%)", "leaf", false, 0, "implode"),
  "mycelium-bloom": F("grave-hands", "hsl(310 30% 40%)", "hsl(170 100% 70%)", "dust", false, 500, "sprout"),
  "hive-song": F("rift-burst", "hsl(170 90% 52%)", "hsl(320 90% 86%)", "ring", true, 0, "ripple"),
  "rot-garden": F("graveyard", "hsl(312 30% 16%)", "hsl(170 100% 62%)", "dust", false, -40),
  "spore-rain": F("light-lances", "hsl(170 90% 56%)", "hsl(320 70% 86%)", "dust", true, 160, "fizz"),
  "puppet-roots": F("soul-chains", "hsl(300 30% 26%)", "hsl(170 100% 72%)", "leaf", false, 0, "implode"),
  "fruiting-spires": F("bone-zone", "hsl(316 40% 50%)", "hsl(170 100% 76%)", "dust", false, 500, "sprout"),
  "chorus-beam": F("prism-beam", "hsl(170 100% 56%)", "hsl(320 100% 90%)", "ring", true, 0, "ripple"),
  "everything-sings": F("null-field", "hsl(312 40% 10%)", "hsl(170 100% 66%)", "dust", false, -50, "implode"),
  "last-bloom": F("rift-burst", "hsl(170 100% 50%)", "hsl(300 100% 90%)", "petal", true, 0, "starburst"),
  // The Mnemovore (Book 2): faded violet and pale pink, like a photo left in the sun
  "forget-touch": F("shade-slash", "hsl(266 20% 40%)", "hsl(300 100% 88%)", "pixel", true, -40, "clock"),
  "stolen-moments": F("mirror-shards", "hsl(280 40% 60%)", "hsl(300 100% 92%)", "shard", true, 0, "shatter"),
  "unremember": F("shadow-step", "hsl(266 24% 30%)", "hsl(300 100% 86%)", "pixel", true, 0, "portal"),
  "fade-ray": F("prism-beam", "hsl(290 50% 70%)", "hsl(0 0% 100%)", "pixel", true, 0, "clock"),
  "memory-sink": F("null-field", "hsl(266 30% 12%)", "hsl(300 100% 80%)", "pixel", false, -30, "implode"),
  "blank-page": F("rift-burst", "hsl(300 40% 92%)", "hsl(0 0% 100%)", "pixel", true, 0, "shatter"),
  "echo-swarm": F("mirror-shards", "hsl(300 70% 72%)", "hsl(0 0% 100%)", "shard", true, -40, "shatter"),
  "lost-way": F("gravity-pull", "hsl(266 30% 24%)", "hsl(300 100% 84%)", "pixel", true, 0, "implode"),
  "falling-faces": F("light-lances", "hsl(300 30% 84%)", "hsl(300 100% 90%)", "glyph", true, 200, "clock"),
  "devoured-years": F("dimension-tear", "hsl(280 50% 18%)", "hsl(300 100% 86%)", "pixel", true, 0, "clock"),
  "the-blank": F("null-field", "hsl(300 20% 92%)", "hsl(280 60% 40%)", "pixel", false, -40, "implode"),
  "oblivion": F("rift-burst", "hsl(0 0% 100%)", "hsl(300 100% 84%)", "pixel", true, 0, "starburst"),
  // The Dustmoth (Book 2): ash-brown wings and cold moonlight
  "wing-cut": F("gale-kick", "hsl(32 16% 40%)", "hsl(208 100% 86%)", "dust", false, 40, "slash"),
  "moon-dust": F("dark-orb", "hsl(208 60% 76%)", "hsl(0 0% 100%)", "dust", true, 60, "fizz"),
  "ash-gale": F("cyclone-spin", "hsl(30 14% 36%)", "hsl(208 80% 82%)", "dust", false, 20, "swirl"),
  "wingbeat": F("quake-stomp", "hsl(32 18% 46%)", "hsl(208 100% 86%)", "dust", false, -20, "ripple"),
  "dust-fall": F("meteor-drop", "hsl(208 50% 76%)", "hsl(0 0% 100%)", "dust", true, 220, "fizz"),
  "moth-swarm": F("night-veil", "hsl(32 16% 26%)", "hsl(208 100% 84%)", "leaf", false, -40),
  "eyespot-stare": F("prism-beam", "hsl(40 100% 60%)", "hsl(208 100% 90%)", "dot", true, 0, "starburst"),
  "silk-line": F("gravity-pull", "hsl(40 20% 86%)", "hsl(208 100% 90%)", "dot", false, 0, "implode"),
  "moon-spears": F("glacier-spike", "hsl(208 80% 80%)", "hsl(0 0% 100%)", "star", true, 400, "starburst"),
  "scale-storm": F("wind-blade", "hsl(36 30% 60%)", "hsl(208 100% 90%)", "dust", true, 40, "sparks"),
  "last-light": F("singularity", "hsl(230 50% 6%)", "hsl(208 100% 86%)", "star", false, -30, "implode"),
  "eclipse-of-wings": F("total-eclipse", "hsl(230 50% 6%)", "hsl(208 100% 88%)", "dust", true, 0, "starburst"),
  // The Somnarch (Book 2): deep indigo sleep and warm dream gold
  "lullaby-touch": F("shade-slash", "hsl(250 40% 40%)", "hsl(46 100% 80%)", "star", true, -40, "swirl"),
  "dream-motes": F("dark-orb", "hsl(46 100% 70%)", "hsl(260 80% 90%)", "bubble", true, -60, "fizz"),
  "sleepwalk": F("shadow-step", "hsl(252 34% 26%)", "hsl(46 100% 78%)", "star", true, 0, "portal"),
  "dream-spiral": F("prism-beam", "hsl(260 70% 70%)", "hsl(46 100% 84%)", "star", true, 0, "swirl"),
  "drowse-wave": F("rift-burst", "hsl(250 50% 50%)", "hsl(46 100% 84%)", "ring", true, 0, "ripple"),
  "deep-sleep": F("null-field", "hsl(250 40% 10%)", "hsl(46 100% 70%)", "star", false, -40, "implode"),
  "falling-dreams": F("light-lances", "hsl(46 100% 72%)", "hsl(260 80% 92%)", "bubble", true, 160, "fizz"),
  "sleep-tug": F("gravity-pull", "hsl(252 40% 30%)", "hsl(46 100% 80%)", "star", true, 0, "implode"),
  "nightmare-spires": F("bone-zone", "hsl(270 50% 16%)", "hsl(46 100% 74%)", "shard", false, 500, "shatter"),
  "waking-terror": F("mirror-shards", "hsl(270 60% 40%)", "hsl(46 100% 80%)", "shard", true, 0, "shatter"),
  "the-long-night": F("singularity", "hsl(250 50% 6%)", "hsl(46 100% 74%)", "star", false, -30, "implode"),
  "never-wake": F("total-eclipse", "hsl(250 50% 8%)", "hsl(46 100% 82%)", "star", true, 0, "starburst"),
  // The Hush (Book 2): black velvet, old bronze and a red that makes no sound
  "muffle": F("shade-slash", "hsl(350 20% 20%)", "hsl(354 100% 76%)", "dot", false, 0, "ripple"),
  "silent-toll": F("wind-blade", "hsl(36 50% 46%)", "hsl(354 100% 80%)", "ring", true, 0, "ripple"),
  "unring": F("soul-chains", "hsl(350 20% 16%)", "hsl(354 100% 72%)", "ring", false, 0, "implode"),
  "cracked-peal": F("prism-beam", "hsl(354 90% 60%)", "hsl(36 80% 84%)", "ring", true, 0, "shatter"),
  "the-quiet": F("quake-stomp", "hsl(350 20% 14%)", "hsl(354 100% 76%)", "ring", false, -20, "ripple"),
  "hush-dead-air": F("null-field", "hsl(350 24% 8%)", "hsl(354 100% 66%)", "dust", false, -30, "implode"),
  "silent-rings": F("mirror-shards", "hsl(36 60% 52%)", "hsl(354 100% 82%)", "ring", true, 0, "ripple"),
  "stolen-breath": F("gravity-pull", "hsl(350 20% 20%)", "hsl(0 0% 96%)", "dot", true, 0, "implode"),
  "falling-bells": F("meteor-drop", "hsl(36 50% 44%)", "hsl(354 100% 80%)", "ring", false, 220, "ripple"),
  "throat-of-night": F("dimension-tear", "hsl(350 40% 8%)", "hsl(354 100% 78%)", "dot", true, 0, "implode"),
  "no-echo": F("singularity", "hsl(350 40% 4%)", "hsl(354 100% 74%)", "ring", false, -30, "implode"),
  "final-toll": F("rift-burst", "hsl(354 100% 60%)", "hsl(36 90% 86%)", "ring", true, 0, "starburst"),
  // The Elder Dark (Book 2's last boss): starless violet black, with an eerie green no star has ever shone
  "void-tendril": F("water-whip", "hsl(262 40% 16%)", "hsl(268 100% 80%)", "star", false, 0, "splat"),
  "dead-stars": F("dark-orb", "hsl(268 80% 60%)", "hsl(150 100% 80%)", "star", true, 40, "starburst"),
  "abyssal-pull": F("soul-chains", "hsl(262 50% 10%)", "hsl(268 100% 78%)", "star", false, 0, "implode"),
  "unmaking-eye": F("prism-beam", "hsl(150 100% 56%)", "hsl(268 100% 90%)", "dot", true, 0, "starburst"),
  "first-dark": F("rift-burst", "hsl(262 50% 8%)", "hsl(268 100% 84%)", "star", false, 0, "implode"),
  "night-tide": F("null-field", "hsl(262 50% 6%)", "hsl(150 100% 64%)", "star", false, -40, "implode"),
  "rising-arms": F("grave-hands", "hsl(262 40% 14%)", "hsl(268 100% 80%)", "star", false, 500, "splat"),
  "many-gazes": F("mirror-shards", "hsl(150 100% 60%)", "hsl(268 100% 90%)", "dot", true, 0, "sparks"),
  "dark-starfall": F("meteor-drop", "hsl(268 90% 70%)", "hsl(0 0% 100%)", "star", true, 220, "starburst"),
  "gaze-of-eons": F("dimension-tear", "hsl(150 100% 50%)", "hsl(268 100% 90%)", "star", true, 0, "starburst"),
  "void-between": F("singularity", "hsl(262 60% 3%)", "hsl(268 100% 80%)", "star", false, -30, "implode"),
  "end-of-all-light": F("total-eclipse", "hsl(262 60% 4%)", "hsl(150 100% 76%)", "star", true, 0, "starburst"),
  // Perihelion (Book 3): old blue ice, white comet fire and a gold dust tail
  "tail-lash": F("rime-sickle", "hsl(200 60% 60%)", "hsl(190 100% 88%)", "ember", true, -60, "slash"),
  "coma-shards": F("ice-shard-volley", "hsl(196 80% 70%)", "hsl(0 0% 100%)", "flake", true, 200, "shatter"),
  "comet-dive": F("mach-rush", "hsl(190 100% 72%)", "hsl(0 0% 100%)", "ember", true, -100, "flare"),
  "tailfire-ray": F("solar-flare", "hsl(192 100% 66%)", "hsl(0 0% 100%)", "ember", true, -120, "flare"),
  "meteor-shower": F("meteor-drop", "hsl(196 90% 70%)", "hsl(44 100% 80%)", "ember", true, 220, "crater"),
  "nucleus-flare": F("rift-burst", "hsl(190 100% 80%)", "hsl(0 0% 100%)", "flake", true, 0, "starburst"),
  "twin-tails": F("eclipse-disc", "hsl(196 100% 66%)", "hsl(44 100% 78%)", "ember", true, 0, "flare"),
  "ion-wake": F("gravity-pull", "hsl(200 90% 50%)", "hsl(190 100% 86%)", "spark", true, 0, "implode"),
  "impact-craters": F("glacier-spike", "hsl(200 70% 78%)", "hsl(0 0% 100%)", "flake", true, 400, "crater"),
  "calving-ice": F("mirror-shards", "hsl(196 60% 80%)", "hsl(0 0% 100%)", "shard", true, 300, "shatter"),
  "orbits-end": F("singularity", "hsl(214 60% 8%)", "hsl(190 100% 84%)", "ember", false, -30, "implode"),
  "impact-winter": F("total-eclipse", "hsl(214 60% 10%)", "hsl(190 100% 90%)", "flake", true, 0, "starburst"),
  // Asterion (Book 3): deep night blue and the gold of old starlight
  "star-spear": F("trident-rake", "hsl(232 40% 28%)", "hsl(44 100% 80%)", "star", true, 0, "starburst"),
  "starshot": F("railgun", "hsl(44 100% 70%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "star-to-star": F("shadow-step", "hsl(232 44% 20%)", "hsl(44 100% 80%)", "star", true, 0, "portal"),
  "line-of-stars": F("antimatter-lance", "hsl(44 100% 66%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  "shooting-stars": F("sunspot-rain", "hsl(44 100% 72%)", "hsl(220 90% 86%)", "star", true, 200, "starburst"),
  "star-chart": F("null-field", "hsl(232 50% 10%)", "hsl(44 100% 74%)", "star", false, -30, "implode"),
  "arrow-of-dawn": F("railgun", "hsl(30 100% 70%)", "hsl(48 100% 92%)", "spark", true, 0, "flare"),
  "hunters-snare": F("soul-chains", "hsl(232 40% 24%)", "hsl(44 100% 78%)", "star", false, 0, "implode"),
  "star-pillars": F("flame-pillar", "hsl(44 100% 70%)", "hsl(0 0% 100%)", "star", true, -200, "starburst"),
  "bull-charge": F("mach-rush", "hsl(232 50% 30%)", "hsl(44 100% 80%)", "star", true, 0, "crater"),
  "celestial-sphere": F("singularity", "hsl(236 60% 5%)", "hsl(44 100% 78%)", "star", false, -30, "implode"),
  "last-arrow": F("rift-burst", "hsl(44 100% 70%)", "hsl(0 0% 100%)", "star", true, 0, "starburst"),
  // Carina (Book 3): a nebula's rose and green gas on deep plum, and the white of newborn stars
  "veil-lash": F("corona-edge", "hsl(326 80% 60%)", "hsl(172 90% 80%)", "spark", true, -60, "slash"),
  "newborn-stars": F("fireball", "hsl(326 100% 70%)", "hsl(0 0% 100%)", "star", true, -80, "starburst"),
  "through-the-veil": F("shadow-step", "hsl(300 40% 20%)", "hsl(326 100% 78%)", "smoke", false, -40, "portal"),
  "birthlight": F("solar-flare", "hsl(172 90% 60%)", "hsl(0 0% 100%)", "star", true, -100, "flare"),
  "stardust-fall": F("sunspot-rain", "hsl(326 90% 70%)", "hsl(172 90% 82%)", "dust", true, 120, "starburst"),
  "the-nursery": F("miasma-cloud", "hsl(310 50% 30%)", "hsl(326 100% 76%)", "smoke", false, -30, "swirl"),
  "twin-suns": F("eclipse-disc", "hsl(326 100% 66%)", "hsl(172 90% 80%)", "star", true, 0, "flare"),
  "mothers-pull": F("gravity-pull", "hsl(300 50% 30%)", "hsl(326 100% 80%)", "smoke", false, 0, "implode"),
  "creation-pillars": F("flame-pillar", "hsl(300 30% 22%)", "hsl(326 100% 80%)", "star", true, -200, "starburst"),
  "rekindle": F("mend", "hsl(172 90% 60%)", "hsl(326 100% 86%)", "star", true, -120, "sprout"),
  "great-veil": F("singularity", "hsl(300 50% 8%)", "hsl(326 100% 76%)", "smoke", false, -30, "implode"),
  "ten-thousand-suns": F("total-eclipse", "hsl(300 50% 10%)", "hsl(172 100% 84%)", "star", true, 0, "starburst"),
  // Vela (Book 3): white-hot amber beams, dark glass and a magnetar's violet field
  "pulse-strike": F("iron-fist", "hsl(32 100% 60%)", "hsl(0 0% 100%)", "spark", true, 0, "sparks"),
  "tick-shots": F("shard-storm", "hsl(32 100% 66%)", "hsl(48 100% 92%)", "spark", true, 0, "sparks"),
  "spin-rush": F("mach-rush", "hsl(250 30% 26%)", "hsl(32 100% 70%)", "spark", true, 0, "crater"),
  "lighthouse-beam": F("railgun", "hsl(32 100% 64%)", "hsl(0 0% 100%)", "spark", true, 0, "flare"),
  "glass-rain": F("meteor-drop", "hsl(40 60% 70%)", "hsl(32 100% 80%)", "shard", true, 200, "shatter"),
  "magnetic-pole": F("magnet-pull", "hsl(250 40% 30%)", "hsl(32 100% 70%)", "spark", true, 0, "implode"),
  "spun-glass": F("mirror-shards", "hsl(40 70% 74%)", "hsl(0 0% 100%)", "shard", true, 300, "shatter"),
  "lighthouse-sweep": F("antimatter-lance", "hsl(32 100% 62%)", "hsl(0 0% 100%)", "spark", true, 0, "flare"),
  "field-lines": F("earth-spike", "hsl(256 30% 18%)", "hsl(276 100% 80%)", "spark", true, 300, "crater"),
  "starquake": F("rift-burst", "hsl(276 80% 66%)", "hsl(32 100% 80%)", "spark", true, 0, "starburst"),
  "sky-clock": F("stasis-field", "hsl(250 40% 8%)", "hsl(32 100% 72%)", "spark", false, -30, "clock"),
  "final-pulse": F("total-eclipse", "hsl(250 40% 10%)", "hsl(32 100% 80%)", "spark", true, 0, "starburst"),
  // Aeon (Book 3): white fire and gold on a deep sapphire night, the light every other star came from
  "halo-strike": F("corona-edge", "hsl(46 100% 66%)", "hsl(48 100% 96%)", "star", true, -40, "slash"),
  "first-stars": F("fireball", "hsl(46 100% 70%)", "hsl(0 0% 100%)", "star", true, -60, "starburst"),
  "light-years": F("shadow-step", "hsl(228 60% 24%)", "hsl(48 100% 90%)", "star", true, -40, "portal"),
  "eye-of-the-sky": F("railgun", "hsl(48 100% 76%)", "hsl(0 0% 100%)", "star", true, 0, "flare"),
  "rain-of-ages": F("meteor-drop", "hsl(40 100% 66%)", "hsl(48 100% 94%)", "star", true, 160, "starburst"),
  "the-old-orbit": F("stasis-field", "hsl(228 60% 14%)", "hsl(46 100% 76%)", "star", false, -30, "swirl"),
  "halo-ring": F("eclipse-disc", "hsl(46 100% 66%)", "hsl(48 100% 96%)", "spark", true, 0, "slash"),
  "all-seeing": F("gravity-pull", "hsl(228 70% 22%)", "hsl(46 100% 80%)", "star", false, 0, "implode"),
  "rays-of-dawn": F("flame-pillar", "hsl(32 100% 60%)", "hsl(48 100% 94%)", "star", true, -220, "flare"),
  "ageless": F("mend", "hsl(46 100% 70%)", "hsl(0 0% 100%)", "star", true, -120, "sprout"),
  "gathered-heavens": F("singularity", "hsl(230 60% 8%)", "hsl(46 100% 80%)", "star", false, -30, "implode"),
  "the-beginning": F("total-eclipse", "hsl(48 100% 90%)", "hsl(228 80% 40%)", "star", true, 0, "starburst"),
};
for (const [id, lk] of Object.entries(QUEST_LOOKS)) FORM_LOOKS[id] = lk;
for (const [id, lk] of Object.entries(FORM_LOOKS)) {
  const base = LOOKS[lk.sig!];
  LOOKS[id] = { ...lk, cast: base?.cast, castLife: base?.castLife };
}
/** The signature drawing a move uses: its own, or the one it borrows. */
const sigOf = (id: string) => LOOKS[id]?.sig ?? id;

/** Registers a move that borrows another move's drawing in colours of its own (a Story minion's moves). */
export function borrowLook(id: string, from: string, a: string, b: string) {
  const base = LOOKS[from];
  if (!base) return;
  LOOKS[id] = { ...base, a, b, sig: sigOf(from) };
}

/** A one-off effect: a move's signature when it fires (hit = false) or its mark on whoever it struck (hit = true). */
export type Fx = { id: string; hit: boolean; x: number; y: number; dir: number; size: number; life: number; max: number; seed: number; reach: number; tint?: Tint };

/** A colour swap for every move of one fighter (Rage Mode): same shapes, new body colour and highlight. */
export type Tint = { a: string; b: string };
let tint: Tint | null = null;
/** Set before drawing something a tinted fighter owns, and cleared after. */
export function setLookTint(t: Tint | null) {
  tint = t;
}
function lookOf(id: string): Look | undefined {
  const lk = LOOKS[id];
  return lk && tint ? { ...lk, a: tint.a, b: tint.b } : lk;
}

// ---------- helpers ----------
const TAU = Math.PI * 2;
const INK = "hsl(250 32% 14%)";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const al = (c: string, a: number) => c.replace(")", ` / ${clamp(a, 0, 1)})`);
const out3 = (k: number) => 1 - Math.pow(1 - k, 3);
/** Stable pseudo-random number in 0..1 for a seed and an index, so an effect keeps its shape frame to frame. */
const noise = (seed: number, i: number) => { const v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453; return v - Math.floor(v); };

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, a = 1) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, al(c, a));
  g.addColorStop(1, al(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A flame tongue with its base at (x, y), pointing along `ang`. */
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ang: number, t: number, seed: number, outer: string, inner: string) {
  if (h <= 0 || w <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang + Math.PI / 2);
  const wob = Math.sin(t * 22 + seed * 3) * w * 0.5;
  for (const [sc, c] of [[1, outer], [0.55, inner]] as const) {
    ctx.beginPath();
    ctx.moveTo(-w * sc, 0);
    ctx.quadraticCurveTo(-w * sc * 1.1, -h * sc * 0.5 + wob, wob * 0.6, -h * sc);
    ctx.quadraticCurveTo(w * sc * 1.1, -h * sc * 0.5 - wob, w * sc, 0);
    ctx.arc(0, 0, w * sc, 0, Math.PI);
    ctx.fillStyle = c;
    ctx.fill();
  }
  ctx.restore();
}

/** A jagged lightning path from one point to another. */
function jag(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, amp: number, n: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.moveTo(x1, y1);
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const off = (Math.random() - 0.5) * 2 * amp;
    ctx.lineTo(x1 + (x2 - x1) * k - Math.sin(ang) * off, y1 + (y2 - y1) * k + Math.cos(ang) * off);
  }
  ctx.lineTo(x2, y2);
}

function boltStroke(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, amp: number, outer: string, w: number) {
  const n = Math.max(3, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 16));
  ctx.beginPath();
  jag(ctx, x1, y1, x2, y2, amp, n);
  ctx.strokeStyle = outer;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = "white";
  ctx.lineWidth = Math.max(1, w * 0.35);
  ctx.stroke();
}

function teardrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(r * 2.2, 0);
  ctx.quadraticCurveTo(r * 0.4, -r * 1.1, -r, 0);
  ctx.arc(0, 0, r, Math.PI, 0, true);
  ctx.restore();
}

function leafPath(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.45, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.45, 0, 0);
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function rock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, seed: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * TAU;
    const rr = r * (0.75 + noise(seed, i) * 0.35);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function star4(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, thin: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 ? r * thin : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** An origami crane flying toward `ang`, kept upright either way. `flap` runs -1..1, wings down to wings up. */
export function drawCrane(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, flap: number, fill: string, edge: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (Math.cos(ang) < 0) ctx.scale(1, -1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, r * 0.09);
  const wing = (dx: number, k: number) => {
    ctx.beginPath();
    ctx.moveTo((-0.3 + dx) * r, 0);
    ctx.lineTo((0.35 + dx) * r, 0);
    ctx.lineTo((-0.05 + dx) * r, -1.15 * r * flap * k);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  ctx.fillStyle = fill;
  ctx.globalAlpha *= 0.75;
  wing(0.12, 0.85);
  ctx.globalAlpha /= 0.75;
  ctx.beginPath();
  for (const [px, py] of [[-1.25, -0.55], [-0.35, 0.05], [0, 0.28], [0.35, 0.05], [1.05, -0.62], [1.34, -0.46], [0.95, -0.48], [0.2, -0.08], [-0.2, -0.08]] as const) ctx.lineTo(px * r, py * r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -0.08 * r); ctx.lineTo(0, 0.28 * r); ctx.stroke();
  wing(0, 1);
  ctx.restore();
}

function dial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rim: string, hand: string, ha: number, hb: number, w: number) {
  ctx.strokeStyle = rim;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, w * 0.5);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const r0 = i % 3 === 0 ? r * 0.72 : r * 0.84;
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.strokeStyle = hand;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(ha) * r * 0.75, y + Math.sin(ha) * r * 0.75);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(hb) * r * 0.5, y + Math.sin(hb) * r * 0.5);
  ctx.stroke();
}

// ---------- particles ----------
/** Draws the particle shapes added for moves. Returns false for the engine's own shapes. */
export function drawSpark(ctx: CanvasRenderingContext2D, shape: PShape, x: number, y: number, size: number, rot: number, color: string, a: number, vx: number, vy: number) {
  switch (shape) {
    case "ember":
      flame(ctx, x, y, size * 0.45, size * 1.6 * (0.5 + a * 0.5), -Math.PI / 2, rot, size, color, "hsl(55 100% 85%)");
      return true;
    case "flake":
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const an = rot + (i * Math.PI) / 3;
        ctx.moveTo(x - Math.cos(an) * size, y - Math.sin(an) * size);
        ctx.lineTo(x + Math.cos(an) * size, y + Math.sin(an) * size);
      }
      ctx.stroke();
      return true;
    case "drop":
      teardrop(ctx, x, y, size * 0.5, Math.atan2(-vy, -vx));
      ctx.fillStyle = color;
      ctx.fill();
      return true;
    case "leaf":
    case "petal":
      leafPath(ctx, x, y, size * (shape === "petal" ? 1.6 : 2), rot);
      ctx.fillStyle = color;
      ctx.fill();
      if (shape === "leaf") { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
      return true;
    case "bubble":
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(x, y, size * (1.2 - a * 0.4), 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "hsl(0 0% 100% / 0.7)";
      ctx.fillRect(x - size * 0.4, y - size * 0.5, 2, 2);
      return true;
    case "bolt":
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - size, y - size);
      ctx.lineTo(x + size * 0.2, y - size * 0.1);
      ctx.lineTo(x - size * 0.2, y + size * 0.1);
      ctx.lineTo(x + size, y + size);
      ctx.stroke();
      return true;
    case "glyph":
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y - size); ctx.lineTo(x + size * 0.7, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size * 0.7, y);
      ctx.closePath();
      ctx.stroke();
      return true;
    case "pixel":
      ctx.fillStyle = color;
      ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size * (Math.random() < 0.3 ? 0.4 : 1));
      return true;
    case "star":
      star4(ctx, x, y, size * 1.3, 0.25, rot * 0.3);
      ctx.fillStyle = color;
      ctx.fill();
      return true;
    case "dust":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size * (2.2 - a * 1.2), 0, TAU);
      ctx.fill();
      return true;
    default:
      return false;
  }
}

// ---------- one-off effects ----------
export function drawFx(ctx: CanvasRenderingContext2D, fx: Fx, t: number) {
  const base = LOOKS[fx.id];
  const lk = base && fx.tint ? { ...base, ...fx.tint } : base;
  if (!lk) return;
  const k = clamp(1 - fx.life / fx.max, 0, 1);
  const e = out3(k);
  const fade = 1 - k;
  const s = fx.size;
  const { a, b } = lk;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(fx.x, fx.y);
  const od = OWN_DRAW[fx.id];
  if (od) {
    if (fx.hit) drawOwnHit(ctx, od, a, b, s, k, e, fade, fx.seed);
    else drawOwnCast(ctx, od, fx, a, b, s, k, e, fade, t);
  } else if (fx.hit) drawHit(ctx, lk.hit, a, b, s, k, e, fade, fx.seed, fx.dir);
  else drawCast(ctx, fx, a, b, s, k, e, fade, t);
  ctx.restore();
}

function drawHit(ctx: CanvasRenderingContext2D, kind: HitLook | undefined, a: string, b: string, s: number, k: number, e: number, fade: number, seed: number, dir: number) {
  ctx.globalAlpha = fade;
  switch (kind) {
    case "flare":
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, 44 * s * (1 - k * 0.5), b, 0.8);
      for (let i = 0; i < 6; i++) flame(ctx, 0, 0, 6 * s, 30 * s * e, (i / 6) * TAU + seed, k * 10, i, a, b);
      break;
    case "shatter":
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU + seed;
        const d = 8 + 46 * s * e;
        ctx.save();
        ctx.translate(Math.cos(an) * d, Math.sin(an) * d + k * k * 20);
        ctx.rotate(an + k * 4);
        ctx.beginPath();
        ctx.moveTo(9 * s, 0); ctx.lineTo(0, 3.5 * s); ctx.lineTo(-6 * s, 0); ctx.lineTo(0, -3.5 * s);
        ctx.closePath();
        ctx.fillStyle = b;
        ctx.fill();
        ctx.strokeStyle = a;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
      break;
    case "fork":
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, 34 * s, b, 0.7);
      for (let i = 0; i < 4; i++) {
        const an = (i / 4) * TAU + seed + k;
        boltStroke(ctx, 0, 0, Math.cos(an) * 50 * s, Math.sin(an) * 50 * s, 9, a, 4);
      }
      break;
    case "crater":
      ctx.strokeStyle = b;
      ctx.lineWidth = 5 * fade + 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 + 50 * s * e, 8 + 16 * s * e, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const an = -Math.PI * (0.15 + 0.7 * noise(seed, i));
        const d = 50 * s * e;
        rock(ctx, Math.cos(an) * d, Math.sin(an) * d + k * k * 50, 5 * s, k * 6 + i, seed + i);
        ctx.fillStyle = a;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      break;
    case "swirl":
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i % 2 ? a : b;
        ctx.beginPath();
        const r = (16 + i * 12) * s * (0.6 + e * 0.6);
        ctx.arc(0, 0, r, k * 9 + i * 2, k * 9 + i * 2 + 3.6);
        ctx.stroke();
      }
      break;
    case "splash":
      for (let i = 0; i < 9; i++) {
        const an = -Math.PI + (i / 8) * Math.PI;
        const d = 10 + 40 * s * e;
        teardrop(ctx, Math.cos(an) * d, Math.sin(an) * d + k * k * 40, 4 * s, an + Math.PI);
        ctx.fillStyle = i % 2 ? a : b;
        ctx.fill();
      }
      ctx.strokeStyle = b;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 8, 14 + 36 * s * e, 6 + 8 * e, 0, 0, TAU);
      ctx.stroke();
      break;
    case "slash":
      for (const [an, c, w] of [[0.7, a, 9], [0.7, b, 3], [-0.7, a, 9], [-0.7, b, 3]] as const) {
        const len = 44 * s * e;
        ctx.strokeStyle = c;
        ctx.lineWidth = w * s;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(an) * len, -Math.sin(an) * len);
        ctx.lineTo(Math.cos(an) * len, Math.sin(an) * len);
        ctx.stroke();
      }
      break;
    case "starburst":
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, 50 * s * (1 - k * 0.6), "hsl(0 0% 100%)", 0.9);
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const an = (i / 10) * TAU + seed;
        const r1 = (i % 2 ? 36 : 60) * s * e;
        ctx.moveTo(Math.cos(an) * 6, Math.sin(an) * 6);
        ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1);
      }
      ctx.stroke();
      star4(ctx, 0, 0, 16 * s, 0.22, 0);
      ctx.fillStyle = a;
      ctx.fill();
      break;
    case "implode":
      glow(ctx, 0, 0, 30 * s * fade, a, 0.8);
      ctx.strokeStyle = b;
      for (let i = 0; i < 3; i++) {
        const r = Math.max(1, (54 - i * 14) * s * (1 - e));
        ctx.lineWidth = 3 - i * 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
      }
      break;
    case "sprout":
      for (let i = 0; i < 5; i++) {
        const an = -Math.PI / 2 + (i - 2) * 0.55 + (noise(seed, i) - 0.5) * 0.3;
        const len = 46 * s * e;
        const ex = Math.cos(an) * len, ey = Math.sin(an) * len;
        ctx.strokeStyle = a;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(ex * 0.3 + dir * 10, ey * 0.6, ex, ey);
        ctx.stroke();
        leafPath(ctx, ex, ey, 11 * s, an);
        ctx.fillStyle = b;
        ctx.fill();
      }
      break;
    case "bite":
      ctx.scale(dir, 1);
      for (const sy of [-1, 1]) {
        const y0 = sy * (24 - 18 * e) * s;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const x0 = (i - 1) * 12 * s;
          ctx.moveTo(x0 - 5 * s, y0);
          ctx.lineTo(x0, y0 - sy * 14 * s);
          ctx.lineTo(x0 + 5 * s, y0);
        }
        ctx.fillStyle = b;
        ctx.fill();
        ctx.strokeStyle = a;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    case "clock":
      ctx.globalCompositeOperation = "lighter";
      dial(ctx, 0, 0, (18 + 22 * e) * s, a, b, -Math.PI / 2 + k * 12, k * 2, 3);
      break;
    case "sparks":
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const an = -Math.PI * noise(seed, i);
        const v = (40 + 50 * noise(seed, i + 20)) * s;
        const x = Math.cos(an) * v * e * dir, y = Math.sin(an) * v * e + k * k * 60;
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(an) * 8 * dir, y - Math.sin(an) * 8);
      }
      ctx.stroke();
      ctx.fillStyle = a;
      poly(ctx, 0, 0, 10 * s * fade, 6, k * 3);
      ctx.fill();
      break;
    case "ripple":
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const kk = clamp(k * 1.4 - i * 0.2, 0, 1);
        if (kk <= 0) continue;
        ctx.globalAlpha = 1 - kk;
        ctx.strokeStyle = i % 2 ? b : a;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 10 + 46 * s * kk, 8 + 30 * s * kk, 0, 0, TAU);
        ctx.stroke();
      }
      break;
    case "splat": {
      ctx.fillStyle = a;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU;
        const r = (14 + 14 * e) * s * (0.7 + noise(seed, i) * 0.6);
        ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r * (0.6 + 0.4 * fade));
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = b;
      for (let i = 0; i < 5; i++) {
        const an = (i / 5) * TAU + seed;
        ctx.beginPath();
        ctx.arc(Math.cos(an) * 38 * s * e, Math.sin(an) * 30 * s * e + k * k * 30, 4 * s, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "cross":
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, 30 * s, b, 0.7);
      star4(ctx, 0, 0, (20 + 34 * e) * s, 0.08, k * 0.5);
      ctx.fillStyle = b;
      ctx.fill();
      star4(ctx, 0, 0, (10 + 18 * e) * s, 0.12, Math.PI / 4);
      ctx.fillStyle = a;
      ctx.fill();
      break;
    case "fizz":
      for (let i = 0; i < 8; i++) {
        const x = (noise(seed, i) - 0.5) * 60 * s;
        const y = -k * (30 + 40 * noise(seed, i + 9)) * s;
        ctx.strokeStyle = i % 2 ? a : b;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, (3 + 5 * noise(seed, i + 3)) * s * (0.5 + e), 0, TAU);
        ctx.stroke();
      }
      glow(ctx, 0, 0, 30 * s, a, 0.4);
      break;
    case "portal":
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 4;
      ctx.strokeStyle = a;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1, 14 * s * Math.sin(Math.PI * k) + 2), 40 * s, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1, 8 * s * Math.sin(Math.PI * k) + 1), 30 * s, 0, 0, TAU);
      ctx.stroke();
      break;
  }
}

function drawCast(ctx: CanvasRenderingContext2D, fx: Fx, a: string, b: string, s: number, k: number, e: number, fade: number, t: number) {
  const dir = fx.dir;
  const seed = fx.seed;
  ctx.globalAlpha = fade;
  switch (sigOf(fx.id)) {
    // ----- close strikes -----
    case "ember-jab": {
      ctx.globalCompositeOperation = "lighter";
      const base = dir > 0 ? 0 : Math.PI;
      for (let i = 0; i < 3; i++) flame(ctx, 0, 0, (9 - i * 2) * s, 70 * s * e * (1 - Math.abs(i - 1) * 0.3), base + (i - 1) * 0.35, t, i, a, b);
      glow(ctx, 0, 0, 26 * s, b, 0.9);
      break;
    }
    case "frost-palm": {
      ctx.translate(dir * 22 * s * e, 0);
      ctx.rotate(k * 1.2);
      const r = 30 * s * (0.4 + e * 0.8);
      ctx.strokeStyle = b;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const an = (i / 6) * TAU;
        const cx = Math.cos(an), cy = Math.sin(an);
        ctx.moveTo(0, 0);
        ctx.lineTo(cx * r, cy * r);
        for (const d of [0.45, 0.7]) {
          const px = cx * r * d, py = cy * r * d;
          for (const sgn of [-1, 1]) {
            const ba = an + sgn * 0.7;
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(ba) * r * 0.25, py + Math.sin(ba) * r * 0.25);
          }
        }
      }
      ctx.stroke();
      ctx.strokeStyle = a;
      ctx.lineWidth = 2;
      poly(ctx, 0, 0, r * 0.3, 6, 0);
      ctx.stroke();
      break;
    }
    case "shock-knuckle": {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, 30 * s, "hsl(0 0% 100%)", 0.9);
      const base = dir > 0 ? 0 : Math.PI;
      for (let i = 0; i < 5; i++) {
        const an = base + (i - 2) * 0.32;
        const len = (40 + 26 * noise(seed, i)) * s * (0.5 + e * 0.5);
        boltStroke(ctx, 0, 0, Math.cos(an) * len, Math.sin(an) * len, 6, a, 3.5);
      }
      break;
    }
    case "boulder-fist": {
      ctx.scale(dir, 1);
      ctx.strokeStyle = al(b, 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { ctx.moveTo(-10 - i * 4, (i - 1) * 10 * s); ctx.lineTo(-40 * s - i * 6, (i - 1) * 10 * s); }
      ctx.stroke();
      rock(ctx, 18 * s * e, 0, 17 * s, k, seed);
      ctx.fillStyle = a;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = b;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(18 * s * e - 6 * s, -8 * s); ctx.lineTo(18 * s * e, -1 * s); ctx.lineTo(18 * s * e - 3 * s, 8 * s);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        rock(ctx, (30 + 30 * e) * s, (noise(seed, i) - 0.5) * 50 * s * e, 4 * s, i + k * 5, seed + i);
        ctx.fillStyle = b;
        ctx.fill();
      }
      break;
    }
    case "gale-kick": {
      ctx.scale(dir, 1);
      const end = 0.6 * Math.PI - e * 1.15 * Math.PI;
      for (const [r, w, c] of [[55, 11, al(a, 0.7)], [55, 3, b], [42, 2, b], [68, 2, al(b, 0.6)]] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w * s;
        ctx.beginPath();
        ctx.arc(-8 * s, 18 * s, r * s, 0.6 * Math.PI, end, true);
        ctx.stroke();
      }
      break;
    }
    case "splash-jab": {
      ctx.scale(dir, 1);
      ctx.strokeStyle = b;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-6 * s, 0, (16 + 26 * e) * s, -1.1, 1.1);
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const an = -0.95 + (i / 6) * 1.9;
        const d = (12 + 42 * e) * s;
        teardrop(ctx, Math.cos(an) * d, Math.sin(an) * d + k * k * 18, 4.5 * s, an + Math.PI);
        ctx.fillStyle = i % 2 ? a : b;
        ctx.fill();
      }
      break;
    }
    case "water-whip": {
      ctx.scale(dir, 1);
      const len = fx.reach * Math.min(1, k * 2.6);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const x = (i / 24) * len;
        pts.push([x, Math.sin((i / 24) * Math.PI * 2.2 - t * 26) * 12 * s * (i / 24)]);
      }
      for (const [c, w] of [[a, 10], [b, 4]] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w * s;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      const [tx, ty] = pts[pts.length - 1];
      ctx.fillStyle = "white";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(tx + (noise(seed, i) - 0.3) * 18, ty + (noise(seed, i + 5) - 0.5) * 18, 3 * s, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "shade-slash": {
      ctx.scale(dir, 1);
      ctx.rotate(-0.45);
      const sc = 0.6 + e * 0.5;
      ctx.scale(sc, sc);
      ctx.beginPath();
      ctx.arc(0, 0, 62 * s, -1.15, 1.15);
      ctx.arc(-20 * s, 0, 54 * s, 1.0, -1.0, true);
      ctx.closePath();
      ctx.fillStyle = al(a, 0.92);
      ctx.fill();
      ctx.strokeStyle = b;
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case "flash-jab": {
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(dir * 12 * s, 0);
      glow(ctx, 0, 0, 46 * s * fade + 8, "hsl(0 0% 100%)", 1);
      ctx.fillStyle = al(a, 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, 150 * s * e, 3 * s, 0, 0, TAU);
      ctx.fill();
      star4(ctx, 0, 0, 34 * s * (0.5 + e * 0.5), 0.12, k * 2);
      ctx.fillStyle = b;
      ctx.fill();
      ctx.strokeStyle = al(a, 0.7);
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        poly(ctx, dir * i * 34 * s * e, 0, (4 + i * 2) * s, 6, 0);
        ctx.stroke();
      }
      break;
    }
    case "heavy-palm": {
      ctx.scale(dir, 1);
      glow(ctx, 0, 0, 22 * s, a, 0.9);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(4 * s, 0, 6 * s * fade + 2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = b;
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = fade * (1 - i * 0.2);
        ctx.lineWidth = 3.5 - i * 0.5;
        ctx.beginPath();
        ctx.ellipse((14 + i * 16 + e * 30) * s, 0, (5 + i * 3) * s, (16 + i * 11) * s * (1 - e * 0.25), 0, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case "life-tap": {
      ctx.scale(dir, 1);
      const len = 64 * s * e;
      ctx.strokeStyle = a;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= len; x += 3) ctx.lineTo(x, Math.sin(x * 0.18 + k * 6) * 9 * s);
      ctx.stroke();
      for (let i = 1; i <= 3; i++) {
        const x = (len * i) / 3.3;
        leafPath(ctx, x, Math.sin(x * 0.18 + k * 6) * 9 * s, 12 * s, i % 2 ? -0.9 : 0.9);
        ctx.fillStyle = a;
        ctx.fill();
      }
      // drained life flows back to the user
      ctx.fillStyle = b;
      for (let i = 0; i < 5; i++) {
        const u = (k * 2.2 + i * 0.2) % 1;
        const x = len * (1 - u);
        ctx.beginPath();
        ctx.arc(x, Math.sin(x * 0.18 + k * 6) * 9 * s, 3.2 * s, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "venom-jab": {
      ctx.scale(dir, 1);
      ctx.translate(20 * s, 0);
      for (const sy of [-1, 1]) {
        const y0 = sy * (18 - 12 * e) * s;
        ctx.beginPath();
        ctx.moveTo(-8 * s, y0);
        ctx.quadraticCurveTo(4 * s, y0, 8 * s, y0 + sy * -16 * s);
        ctx.quadraticCurveTo(2 * s, y0 - sy * 4 * s, -2 * s, y0);
        ctx.closePath();
        ctx.fillStyle = "hsl(60 30% 94%)";
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = a;
      for (let i = 0; i < 3; i++) {
        teardrop(ctx, 6 * s + i * 3, (8 + k * 34 + i * 8) * s, 3 * s, -Math.PI / 2);
        ctx.fill();
      }
      break;
    }
    case "tick-strike": {
      ctx.globalCompositeOperation = "lighter";
      ctx.scale(dir, 1);
      const r = 46 * s;
      ctx.strokeStyle = a;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, r, -0.85, 0.85);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const an = -0.85 + (i / 6) * 1.7;
        ctx.moveTo(Math.cos(an) * r * 0.8, Math.sin(an) * r * 0.8);
        ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
      }
      ctx.stroke();
      const ha = -0.85 + e * 1.7;
      ctx.strokeStyle = b;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ha) * r * 1.05, Math.sin(ha) * r * 1.05);
      ctx.stroke();
      glow(ctx, Math.cos(ha) * r, Math.sin(ha) * r, 12 * s, b, 0.9);
      break;
    }
    case "iron-fist": {
      ctx.translate(dir * 16 * s, 0);
      const r = 20 * s * (0.6 + e * 0.6);
      poly(ctx, 0, 0, r, 6, k * 1.5);
      ctx.fillStyle = al(a, 0.55);
      ctx.fill();
      ctx.strokeStyle = "hsl(220 15% 92%)";
      ctx.lineWidth = 3;
      ctx.stroke();
      poly(ctx, 0, 0, r * 0.5, 6, -k * 1.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU + seed;
        ctx.moveTo(Math.cos(an) * r * 1.1, Math.sin(an) * r * 1.1);
        ctx.lineTo(Math.cos(an) * r * (1.4 + e), Math.sin(an) * r * (1.4 + e) + k * k * 20);
      }
      ctx.stroke();
      break;
    }
    case "mind-jab": {
      ctx.globalCompositeOperation = "lighter";
      ctx.scale(dir, 1);
      const w = 22 * s * (0.5 + e * 0.5);
      ctx.strokeStyle = b;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(20 * s - w, 0);
      ctx.quadraticCurveTo(20 * s, -14 * s, 20 * s + w, 0);
      ctx.quadraticCurveTo(20 * s, 14 * s, 20 * s - w, 0);
      ctx.stroke();
      glow(ctx, 20 * s, 0, 6 * s, a, 1);
      ctx.strokeStyle = a;
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 3 - i * 0.6;
        ctx.beginPath();
        ctx.arc((30 + i * 14 + e * 34) * s, 0, (14 + i * 6) * s, -0.9, 0.9);
        ctx.stroke();
      }
      break;
    }
    case "morph-strike": {
      ctx.scale(dir, 1);
      const cx = 20 * s * e;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const an = (i / 14) * TAU;
        const jit = Math.sin(t * 20 + i * 1.7) * 4 * s;
        ctx.lineTo(cx + Math.cos(an) * (22 * s * (1 + e * 0.9) + jit), Math.sin(an) * (12 * s + jit));
      }
      ctx.closePath();
      const gr = ctx.createLinearGradient(cx - 30 * s, 0, cx + 40 * s, 0);
      gr.addColorStop(0, al(a, 0.85));
      gr.addColorStop(1, al(b, 0.85));
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "blade-arm": {
      ctx.scale(dir, 1);
      const len = fx.reach * Math.min(1, k * 3);
      ctx.beginPath();
      ctx.moveTo(0, -5 * s); ctx.lineTo(len, -1.5 * s); ctx.lineTo(len + 12 * s, 0); ctx.lineTo(len, 2 * s); ctx.lineTo(0, 5 * s);
      ctx.closePath();
      ctx.fillStyle = b;
      ctx.fill();
      ctx.strokeStyle = a;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, len * Math.min(1, k * 1.6), 0, 14 * s, "hsl(0 0% 100%)", 1);
      break;
    }
    // ----- blasts around the body -----
    case "inferno-ring": {
      ctx.globalCompositeOperation = "lighter";
      const R = fx.reach * e;
      ctx.strokeStyle = al(b, 0.7);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * 0.22, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 18; i++) {
        const an = (i / 18) * TAU;
        flame(ctx, Math.cos(an) * R, Math.sin(an) * R * 0.22, 8 * s, (16 + 44 * fade) * s, -Math.PI / 2, t, i, a, b);
      }
      break;
    }
    case "quake-stomp": {
      const R = fx.reach * e;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const sgn = i % 2 ? 1 : -1;
        let x = 0, y = 2;
        ctx.moveTo(x, y);
        for (let j = 1; j <= 5; j++) {
          x = sgn * (R * j) / 5;
          y = 2 + (noise(seed, i * 7 + j) - 0.5) * 10 + (i >> 1) * 3;
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const x = (i - 3.5) / 3.5 * R * 0.9;
        const hgt = (14 + 14 * noise(seed, i)) * s * Math.sin(Math.PI * clamp(k * 1.5, 0, 1));
        ctx.beginPath();
        ctx.moveTo(x - 9 * s, 4); ctx.lineTo(x - 2 * s, -hgt); ctx.lineTo(x + 8 * s, -hgt * 0.7); ctx.lineTo(x + 10 * s, 4);
        ctx.closePath();
        ctx.fillStyle = a;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.strokeStyle = al(b, 0.8);
      ctx.lineWidth = 6 * fade + 1;
      ctx.beginPath();
      ctx.ellipse(0, 2, R * 1.1, 10 + R * 0.06, 0, 0, TAU);
      ctx.stroke();
      break;
    }
    case "sun-flare": {
      ctx.globalCompositeOperation = "lighter";
      const R = fx.reach;
      glow(ctx, 0, 0, R * (0.5 + 0.7 * e), b, 0.9 * fade);
      ctx.fillStyle = al(a, 0.85);
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU + t * 1.5;
        const len = R * 0.85 * e;
        ctx.beginPath();
        ctx.moveTo(Math.cos(an - 0.09) * 28 * s, Math.sin(an - 0.09) * 28 * s);
        ctx.lineTo(Math.cos(an) * len, Math.sin(an) * len);
        ctx.lineTo(Math.cos(an + 0.09) * 28 * s, Math.sin(an + 0.09) * 28 * s);
        ctx.fill();
      }
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * s, 0, TAU);
      ctx.fill();
      break;
    }
    case "rift-burst": {
      const R = fx.reach * e;
      ctx.fillStyle = al(a, 0.75);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const an = (i / 10) * TAU + seed;
        const r = (16 + 10 * noise(seed, i)) * s * (1 - k * 0.5);
        ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = b;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const an = (i / 9) * TAU + seed;
        let x = 0, y = 0;
        ctx.moveTo(x, y);
        for (let j = 1; j <= 4; j++) {
          const aa = an + (noise(seed, i * 5 + j) - 0.5) * 0.5;
          x = Math.cos(aa) * (R * j) / 4;
          y = Math.sin(aa) * (R * j) / 4;
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = "hsl(0 0% 100% / 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case "bloom-burst": {
      const R = fx.reach;
      for (const [n, d, len, off, c] of [[8, 0.32, 0.42, 0, a], [8, 0.18, 0.3, Math.PI / 8, b]] as const) {
        for (let i = 0; i < n; i++) {
          const an = (i / n) * TAU + off + k * 0.6;
          leafPath(ctx, Math.cos(an) * R * d * e, Math.sin(an) * R * d * e, R * len * e, an);
          ctx.fillStyle = al(c, 0.9);
          ctx.fill();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      ctx.fillStyle = "hsl(45 100% 60%)";
      ctx.beginPath();
      ctx.arc(0, 0, 10 * s, 0, TAU);
      ctx.fill();
      break;
    }
    case "plague-burst": {
      const R = fx.reach;
      for (let i = 0; i < 11; i++) {
        const an = (i / 11) * TAU + seed;
        const d = R * 0.7 * e * (0.7 + 0.3 * noise(seed, i));
        ctx.fillStyle = al(i % 3 ? a : b, 0.5);
        ctx.beginPath();
        ctx.arc(Math.cos(an) * d, Math.sin(an) * d * 0.8, (14 + R * 0.22 * e) * (0.7 + 0.5 * noise(seed, i + 3)), 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc((noise(seed, i + 30) - 0.5) * R, -k * 50 - noise(seed, i + 40) * 30, 5 * s, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case "mind-crush": {
      ctx.globalCompositeOperation = "lighter";
      const R = fx.reach;
      if (k < 0.4) {
        const kk = k / 0.4;
        ctx.strokeStyle = a;
        for (let i = 0; i < 3; i++) {
          ctx.lineWidth = 4 - i;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(2, R * (1 - kk) * (1 - i * 0.2)), 0, TAU);
          ctx.stroke();
        }
      } else {
        const kk = (k - 0.4) / 0.6;
        ctx.strokeStyle = b;
        ctx.lineWidth = 5 * (1 - kk) + 1;
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const an = (i / 48) * TAU;
          const r = R * out3(kk) * (1 + Math.sin(an * 8 + t * 20) * 0.08);
          ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
        }
        ctx.stroke();
      }
      glow(ctx, 0, 0, 24 * s, b, 0.9);
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 * s, 5 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5 * s, 0, TAU);
      ctx.fill();
      break;
    }
    // ----- heals -----
    case "mend": {
      ctx.strokeStyle = al(b, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 50 * s, 34 * s * (0.6 + e * 0.6), 8 * s, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const u = (k * 1.3 + i / 10) % 1;
        const an = t * 4 + i * 2.1;
        const x = Math.cos(an) * 28 * s;
        const y = 50 * s - u * 120 * s;
        leafPath(ctx, x, y, 12 * s, an);
        ctx.fillStyle = i % 2 ? a : b;
        ctx.globalAlpha = fade * Math.sin(Math.PI * u);
        ctx.fill();
      }
      ctx.globalAlpha = fade;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, 60 * s, a, 0.35);
      break;
    }
    case "rewind": {
      ctx.globalCompositeOperation = "lighter";
      const r = 54 * s;
      dial(ctx, 0, 0, r, a, b, -t * 14, -t * 2, 3);
      ctx.strokeStyle = b;
      ctx.lineWidth = 3;
      for (const off of [0, Math.PI]) {
        const a0 = off - k * 8;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.25, a0, a0 - 1.6, true);
        ctx.stroke();
        const ax = Math.cos(a0 - 1.6) * r * 1.25, ay = Math.sin(a0 - 1.6) * r * 1.25;
        const tang = a0 - 1.6 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(ax + Math.cos(tang + 0.5) * 10, ay + Math.sin(tang + 0.5) * 10);
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax + Math.cos(tang - 0.5) * 10, ay + Math.sin(tang - 0.5) * 10);
        ctx.stroke();
      }
      break;
    }
    // ----- teleports -----
    case "shadow-step": {
      ctx.fillStyle = al(a, 0.85);
      ctx.beginPath();
      ctx.ellipse(0, 2, 40 * s * (1 - k * 0.4), 8 * s, 0, 0, TAU);
      ctx.fill();
      const col = ctx.createLinearGradient(0, 0, 0, -130 * s);
      col.addColorStop(0, al(a, 0.85));
      col.addColorStop(1, al(a, 0));
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const y = -(i / 10) * 130 * s * e;
        ctx.lineTo(-22 * s * (1 - i / 14) + Math.sin(t * 9 + i) * 5, y);
      }
      for (let i = 10; i >= 0; i--) {
        const y = -(i / 10) * 130 * s * e;
        ctx.lineTo(22 * s * (1 - i / 14) + Math.sin(t * 9 + i + 2) * 5, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 2, 40 * s * (1 - k * 0.4), 8 * s, 0, 0, TAU);
      ctx.stroke();
      break;
    }
    case "warp-kick": {
      ctx.globalCompositeOperation = "lighter";
      const w = Math.max(1, 18 * s * Math.sin(Math.PI * k));
      glow(ctx, 0, 0, 50 * s, a, 0.35);
      ctx.strokeStyle = a;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, w, 58 * s, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, w * (0.7 - i * 0.2), 58 * s * (0.85 - i * 0.2), 0, t * 8 + i, t * 8 + i + 3.5);
        ctx.stroke();
      }
      break;
    }
    // ----- copy -----
    case "mimic": {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `hsl(${(t * 360 + i * 120) % 360} 90% 65%)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const r = (20 + i * 12) * s + e * 40 * s;
        ctx.arc(0, 0, r, t * 6 + i, t * 6 + i + 4.2);
        ctx.stroke();
      }
      ctx.fillStyle = b;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 16 * s, -10 * s); ctx.lineTo(sx * 28 * s, 0); ctx.lineTo(sx * 16 * s, 10 * s);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    // ----- from the sky -----
    case "storm-call": {
      const a2 = Math.min(1, k * 6) * fade;
      ctx.globalAlpha = a2;
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 ? "hsl(228 26% 30%)" : "hsl(228 22% 40%)";
        ctx.beginPath();
        ctx.arc((i - 3) * 30 * s + Math.sin(t * 2 + i) * 4, Math.sin(i * 1.7) * 10, (28 + 8 * noise(seed, i)) * s, 0, TAU);
        ctx.fill();
      }
      if (Math.random() < 0.18) {
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, (Math.random() - 0.5) * 160 * s, 0, 60 * s, b, 0.7);
      }
      break;
    }
    case "light-lances": {
      ctx.globalCompositeOperation = "lighter";
      const a2 = Math.min(1, k * 5) * fade;
      ctx.globalAlpha = a2;
      ctx.strokeStyle = b;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 90 * s, 16 * s, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = al(a, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const an = (i / 16) * TAU + t;
        ctx.moveTo(Math.cos(an) * 90 * s, Math.sin(an) * 16 * s);
        ctx.lineTo(Math.cos(an) * 116 * s, Math.sin(an) * 22 * s);
      }
      ctx.stroke();
      break;
    }
    case "meteor-drop": {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, k * 5) * fade;
      glow(ctx, 0, 0, 90 * s, b, 0.5);
      ctx.strokeStyle = b;
      ctx.lineWidth = 3;
      ctx.beginPath();
      jag(ctx, -80 * s, 0, 80 * s, 0, 8, 8);
      ctx.stroke();
      ctx.fillStyle = "hsl(270 60% 6% / 0.9)";
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.ellipse(0, 0, 70 * s * e, 10 * s * e, 0, 0, TAU);
      ctx.fill();
      break;
    }
    // ----- The Hollow King -----
    case "reaper-scythe": {
      // a wide crescent sweep, souls flung off the tip
      ctx.scale(dir, 1);
      const R = 62 * s;
      const sweep = -2.3 + e * 3.2;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = al(i ? b : "hsl(0 0% 100%)", 0.9 - i * 0.25);
        ctx.lineWidth = (10 - i * 3) * s;
        ctx.beginPath();
        ctx.arc(-14 * s, 6 * s, R - i * 7 * s, -2.3, Math.max(-2.29, sweep));
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const an = sweep - i * 0.25;
        const rr = R * (1 + i * 0.08);
        glow(ctx, -14 * s + Math.cos(an) * rr, 6 * s + Math.sin(an) * rr, 7 * s, b, 0.7 * (1 - i / 5));
      }
      break;
    }
    case "soul-harvest": {
      // a turning sigil, with hands of light at its rim
      ctx.globalCompositeOperation = "lighter";
      const R = 90 * s * (0.4 + 0.6 * e);
      glow(ctx, 0, 0, R * 1.4, b, 0.5);
      ctx.strokeStyle = b;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.72, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const an = -Math.PI / 2 + t * 0.8 + ((i * 2) / 5) * TAU;
        ctx.lineTo(Math.cos(an) * R * 0.72, Math.sin(an) * R * 0.72);
      }
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU - t * 0.6;
        glow(ctx, Math.cos(an) * R, Math.sin(an) * R, 9 * s, "hsl(0 0% 100%)", 0.9);
      }
      break;
    }
    // ----- The Black Sun -----
    case "corona-edge": {
      // a burning ring with a black core: a tiny eclipse on the fist
      const R = 26 * s * (0.5 + e);
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, R * 1.8, a, 0.7);
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const an = (i / 10) * TAU + seed;
        ctx.moveTo(Math.cos(an) * R, Math.sin(an) * R);
        ctx.lineTo(Math.cos(an) * R * 1.55, Math.sin(an) * R * 1.55);
      }
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = al("hsl(250 40% 6%)", 0.92);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.66, 0, TAU);
      ctx.fill();
      break;
    }
    case "sunspot-rain": {
      // a dead sun opens in the sky and sheds burning sunspots
      ctx.globalAlpha = Math.min(1, k * 6) * fade;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, 84 * s, b, 0.7);
      ctx.strokeStyle = al(b, 0.85);
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const an = (i / 14) * TAU + t * 0.4;
        const len = (48 + 14 * Math.sin(t * 4 + i * 1.9)) * s;
        ctx.beginPath();
        ctx.moveTo(Math.cos(an) * 30 * s, Math.sin(an) * 30 * s);
        ctx.quadraticCurveTo(Math.cos(an + 0.1) * len * 0.8, Math.sin(an + 0.1) * len * 0.8, Math.cos(an) * len, Math.sin(an) * len);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "hsl(250 40% 5%)";
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 30 * s, 0, TAU);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "total-eclipse": {
      // above the caster, a moon slides across a burning sun
      ctx.translate(0, -78 * s);
      const R = 28 * s;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, R * (2 + e * 1.6), b, 0.9);
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      const off = (1 - Math.min(1, k * 2.2)) * R * 2.2;
      ctx.fillStyle = "hsl(250 40% 5%)";
      ctx.beginPath();
      ctx.arc(off, 0, R * 1.02, 0, TAU);
      ctx.fill();
      break;
    }
  }
}

// ---------- shots in flight ----------
type Shot = { x: number; y: number; vx: number; vy: number; r: number; rot: number };

/** Draws a move's shot. Returns false when the move has no look of its own. */
export function drawShotLook(ctx: CanvasRenderingContext2D, id: string, p: Shot, t: number) {
  const lk = lookOf(id);
  if (!lk) return false;
  const { a, b } = lk;
  if (OWN_DRAW[id]) {
    drawOwnShot(ctx, OWN_DRAW[id], a, b, p, t);
    return true;
  }
  const r = p.r;
  const ang = Math.atan2(p.vy, p.vx);
  const dir = p.vx >= 0 ? 1 : -1;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (sigOf(id)) {
    case "bone-barrage": {
      // a bone tumbling end over end
      ctx.translate(p.x, p.y);
      ctx.rotate(ang + t * 14);
      ctx.strokeStyle = al(b, 0.5);
      ctx.lineWidth = r * 1.1;
      ctx.beginPath(); ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 1.6, 0); ctx.stroke();
      ctx.strokeStyle = a;
      ctx.lineWidth = r * 0.55;
      ctx.stroke();
      ctx.fillStyle = a;
      for (const ex of [-r * 1.6, r * 1.6]) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(ex, sd * r * 0.42, r * 0.48, 0, TAU); ctx.fill(); }
      break;
    }
    case "power-chord": {
      // a chord made visible: three arcs of sound rolling forward, the front one brightest
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(p.x, p.y);
      ctx.scale(dir, 1);
      glow(ctx, 0, 0, r * 1.8, a, 0.3);
      for (let i = 0; i < 3; i++) {
        const rr = r * (1.4 - i * 0.28) * (1 + 0.06 * Math.sin(t * 30 + i));
        ctx.strokeStyle = i === 0 ? b : al(a, 0.9 - i * 0.25);
        ctx.lineWidth = r * (0.32 - i * 0.07);
        ctx.beginPath(); ctx.arc(-i * r * 0.6 - rr, 0, rr, -0.95, 0.95); ctx.stroke();
      }
      break;
    }
    case "staccato": {
      // an eighth note bouncing along, a little glow behind it
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x - p.vx * 0.015, p.y - p.vy * 0.015, r * 2.4, a, 0.4);
      ctx.globalCompositeOperation = "source-over";
      ctx.translate(p.x, p.y + Math.sin(t * 26 + p.rot * 3) * r * 0.3);
      ctx.fillStyle = b;
      ctx.strokeStyle = a;
      ctx.lineWidth = Math.max(1.4, r * 0.24);
      ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 0.75, r * 0.52, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.66, r * 0.4); ctx.lineTo(r * 0.66, -r * 1.7); ctx.quadraticCurveTo(r * 1.5, -r * 1.2, r * 1.35, -r * 0.5); ctx.stroke();
      break;
    }
    case "crane-flock": {
      // an origami crane, wings beating as it flies
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x, p.y, r * 1.8, b, 0.25);
      ctx.globalCompositeOperation = "source-over";
      drawCrane(ctx, p.x, p.y, r * 1.3, ang, Math.sin(t * 22 + p.rot * 5), a, b);
      break;
    }
    case "shuriken-fold": {
      // a folded paper star spinning flat, two colours of paper locked together
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 18 * dir);
      ctx.lineJoin = "round";
      ctx.strokeStyle = "hsl(0 0% 10% / 0.7)";
      ctx.lineWidth = Math.max(1, r * 0.1);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = i % 2 ? a : b;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.45, -r * 0.45); ctx.lineTo(r * 1.45, r * 0.05); ctx.lineTo(r * 0.45, r * 0.05); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.strokeRect(-r * 0.32, -r * 0.32, r * 0.64, r * 0.64);
      break;
    }
    case "ring-gate": {
      // a spinning ring door flying edge-on, its dark middle full of the other side's colour, little bits of matter dragged in its wake
      ctx.translate(p.x, p.y);
      const tilt = 0.45 + 0.15 * Math.sin(t * 8);
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, r * 2.2, a, 0.35);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "hsl(270 50% 5% / 0.9)";
      ctx.beginPath(); ctx.ellipse(0, 0, r * tilt, r * 1.2, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = b;
      ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.ellipse(0, 0, r * tilt * 0.7, r * 0.85, 0, t * 6, t * 6 + 4); ctx.stroke();
      ctx.strokeStyle = a;
      ctx.lineWidth = r * 0.28;
      ctx.beginPath(); ctx.ellipse(0, 0, r * tilt, r * 1.2, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = al(b, 0.8);
      for (let i = 0; i < 5; i++) {
        const k = ((t * 3 + i / 5) % 1);
        const z = r * 0.22 * (1 - k);
        ctx.fillRect(-dir * k * r * 3 - z, Math.sin(i * 2.3) * r * 0.8 - z, z * 2, z * 2);
      }
      break;
    }
    case "jumbo-roundabout": {
      // a big wheel of orbs spinning round a bright core, swinging up and down as it rolls forward
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x, p.y, r * 2.4, a, 0.45);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const an = t * 9 * dir + (i / n) * TAU;
        const ox = p.x + Math.cos(an) * r * 1.4, oy = p.y + Math.sin(an) * r * 1.4;
        glow(ctx, ox, oy, r * 0.62, i % 2 ? a : b, 0.95);
        ctx.fillStyle = "white";
        ctx.beginPath(); ctx.arc(ox, oy, r * 0.18, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = al(b, 0.6);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.4, 0, TAU); ctx.stroke();
      glow(ctx, p.x, p.y, r * 0.7, "hsl(0 0% 100%)", 1);
      break;
    }
    case "blaster-storm": {
      // a small skull diving down, firing a beam ahead of it
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(p.x, p.y);
      ctx.rotate(ang - Math.PI / 2);
      const gr = ctx.createLinearGradient(0, 0, 0, r * 6);
      gr.addColorStop(0, "white");
      gr.addColorStop(1, al(a, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(-r * 0.5, 0, r, r * 6);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "hsl(45 25% 92%)";
      ctx.beginPath(); ctx.moveTo(-r, -r * 1.8); ctx.quadraticCurveTo(0, -r * 2.5, r, -r * 1.8); ctx.lineTo(r * 0.7, 0); ctx.lineTo(-r * 0.7, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = a;
      ctx.beginPath(); ctx.arc(-r * 0.4, -r * 1.1, r * 0.28, 0, TAU); ctx.arc(r * 0.4, -r * 1.1, r * 0.28, 0, TAU); ctx.fill();
      break;
    }
    case "fireball": {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x, p.y, r * 2.8, b, 0.6);
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      const fl = Math.sin(t * 30) * r * 0.4;
      for (const [sc, c] of [[1, a], [0.6, b]] as const) {
        ctx.beginPath();
        ctx.moveTo(r * 1.1 * sc, 0);
        ctx.quadraticCurveTo(r * 0.6, -r * 1.25 * sc, -r * 3.6 * sc + fl, fl * 0.5);
        ctx.quadraticCurveTo(r * 0.6, r * 1.25 * sc, r * 1.1 * sc, 0);
        ctx.fillStyle = c;
        ctx.fill();
      }
      glow(ctx, r * 0.3, 0, r * 0.8, "hsl(0 0% 100%)", 1);
      break;
    }
    case "ice-shard-volley": {
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(r * 2.1, 0); ctx.lineTo(r * 0.3, -r * 0.75); ctx.lineTo(-r * 1.4, -r * 0.3); ctx.lineTo(-r * 1.4, r * 0.3); ctx.lineTo(r * 0.3, r * 0.75);
      ctx.closePath();
      ctx.fillStyle = a;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.moveTo(r * 2.1, 0); ctx.lineTo(r * 0.3, -r * 0.75); ctx.lineTo(-r * 1.4, -r * 0.3); ctx.lineTo(-r * 0.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      star4(ctx, r * 2.1, 0, r * (0.8 + 0.4 * Math.sin(t * 25)), 0.2, 0);
      ctx.fillStyle = "white";
      ctx.fill();
      break;
    }
    case "ball-lightning": {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x, p.y, r * 2.6, a, 0.6);
      glow(ctx, p.x, p.y, r, b, 1);
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 1.6, r * 0.5, t * (3 + i) + i * 1.05, 0, TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const an = Math.random() * TAU;
        boltStroke(ctx, p.x + Math.cos(an) * r * 0.6, p.y + Math.sin(an) * r * 0.6, p.x + Math.cos(an) * r * 2.2, p.y + Math.sin(an) * r * 2.2, 4, a, 2);
      }
      break;
    }
    case "rock-toss": {
      ctx.fillStyle = al(b, 0.35);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(p.x - p.vx * 0.02 * i, p.y - p.vy * 0.02 * i, r * (0.5 + i * 0.15), 0, TAU);
        ctx.fill();
      }
      rock(ctx, p.x, p.y, r, p.rot, 3);
      ctx.fillStyle = a;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = b;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.rot) * r * 0.7, p.y + Math.sin(p.rot) * r * 0.7);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.rot + 2) * r * 0.5, p.y + Math.sin(p.rot + 2) * r * 0.5);
      ctx.stroke();
      break;
    }
    case "wind-blade": {
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.strokeStyle = al(a, 0.7);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-r * (1.6 + i * 1.1), (i - 1) * r * 0.7, r * 0.9, -0.8 + t * 10, 1.4 + t * 10);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(-r * 0.6, 0, r * 1.5, -1.15, 1.15);
      ctx.arc(-r * 1.15, 0, r * 1.35, 1.05, -1.05, true);
      ctx.closePath();
      ctx.fillStyle = b;
      ctx.fill();
      ctx.strokeStyle = a;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case "tidal-wave": {
      ctx.translate(p.x, p.y);
      ctx.scale(dir, 1);
      ctx.beginPath();
      ctx.moveTo(-r * 1.6, r * 1.6);
      ctx.lineTo(-r * 0.9, -r * 0.5);
      ctx.quadraticCurveTo(r * 0.1, -r * 2.3, r * 1.35, -r * 1.05);
      ctx.quadraticCurveTo(r * 0.5, -r * 1.25, r * 0.55, -r * 0.3);
      ctx.quadraticCurveTo(r * 0.9, r * 0.8, r * 1.5, r * 1.6);
      ctx.closePath();
      const gr = ctx.createLinearGradient(0, r * 1.6, 0, -r * 2);
      gr.addColorStop(0, a);
      gr.addColorStop(1, b);
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "white";
      for (let i = 0; i < 6; i++) {
        const u = i / 5;
        ctx.beginPath();
        ctx.arc(-r * 0.9 + u * r * 2.2 + Math.sin(t * 14 + i) * 2, -r * (0.5 + Math.sin(u * Math.PI) * 1.3), r * 0.18, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "dark-orb": {
      glow(ctx, p.x, p.y, r * 2.6, b, 0.45);
      ctx.strokeStyle = al(a, 0.8);
      ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const a0 = t * 5 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.6, a0, a0 + 1.2);
        ctx.stroke();
      }
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case "thorn-seed": {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const an = (i / 16) * TAU;
        const rr = i % 2 ? r * 0.8 : r * 1.55;
        ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = b;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, TAU);
      ctx.fill();
      break;
    }
    case "acid-spit": {
      glow(ctx, p.x, p.y, r * 2.2, a, 0.4);
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(r * 1.2, 0);
      ctx.quadraticCurveTo(r * 0.8, -r, -r * 0.4, -r * 0.8);
      ctx.quadraticCurveTo(-r * 2.6, 0, -r * 0.4, r * 0.8);
      ctx.quadraticCurveTo(r * 0.8, r, r * 1.2, 0);
      ctx.fillStyle = a;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.ellipse(r * 0.3, -r * 0.3, r * 0.4, r * 0.2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = a;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(-r * (1.6 + i * 0.9), Math.sin(t * 20 + i) * r * 0.3, r * (0.35 - i * 0.08), 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "phase-shot": {
      ctx.globalCompositeOperation = "lighter";
      const jx = Math.random() < 0.15 ? (Math.random() - 0.5) * 14 : 0;
      for (let i = 2; i >= 0; i--) {
        const gx = p.x - p.vx * 0.03 * i + (i ? 0 : jx), gy = p.y - p.vy * 0.03 * i;
        ctx.globalAlpha = i ? 0.3 / i : 1;
        ctx.fillStyle = i ? b : a;
        ctx.beginPath();
        ctx.ellipse(gx, gy, r * 1.3, r * 0.5, p.rot, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = b;
      for (let i = 0; i < 3; i++) ctx.fillRect(p.x + (Math.random() - 0.5) * r * 4, p.y + (Math.random() - 0.5) * r * 2, 3, 3);
      break;
    }
    case "time-bolt": {
      glow(ctx, p.x, p.y, r * 2.2, b, 0.4);
      ctx.fillStyle = "hsl(45 60% 92%)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.15, 0, TAU);
      ctx.fill();
      dial(ctx, p.x, p.y, r * 1.15, a, INK, t * 14, t * 2, 2.5);
      break;
    }
    case "shard-storm": {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x - p.vx * 0.02, p.y - p.vy * 0.02, r * 1.8, "hsl(30 100% 60%)", 0.5);
      ctx.globalCompositeOperation = "source-over";
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * 1.6);
      ctx.beginPath();
      ctx.moveTo(r * 1.6, 0); ctx.lineTo(-r * 0.4, -r * 0.5); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(-r * 0.4, r * 0.5);
      ctx.closePath();
      ctx.fillStyle = a;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = b;
      ctx.beginPath();
      ctx.moveTo(r * 1.6, 0); ctx.lineTo(-r * 0.4, -r * 0.5);
      ctx.stroke();
      break;
    }
    case "psi-wave": {
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(p.x, p.y);
      ctx.scale(dir, 1);
      glow(ctx, 0, 0, r * 1.6, a, 0.35);
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i % 2 ? b : a;
        ctx.lineWidth = 5 - i * 1.2;
        ctx.beginPath();
        ctx.arc(-i * r * 0.55, 0, r * (1.5 - i * 0.25) * (1 + Math.sin(t * 18 + i) * 0.06), -1.05, 1.05);
        ctx.stroke();
      }
      break;
    }
    case "slime-shot": {
      const sp = Math.hypot(p.vx, p.vy);
      const st = 1 + Math.min(0.6, sp / 1500) + Math.sin(t * 25) * 0.08;
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * st, r / st, 0, 0, TAU);
      ctx.fillStyle = al(a, 0.9);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.ellipse(r * 0.2, -r * 0.35, r * 0.35, r * 0.18, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case "storm-call": {
      ctx.globalCompositeOperation = "lighter";
      boltStroke(ctx, p.x - 30 + Math.random() * 20, Math.max(0, p.y - 260), p.x, p.y, 12, al(b, 0.7), 6);
      glow(ctx, p.x, p.y, r * 2.6, b, 0.8);
      break;
    }
    case "light-lances": {
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      const gr = ctx.createLinearGradient(-r * 6, 0, r * 2.4, 0);
      gr.addColorStop(0, al(a, 0));
      gr.addColorStop(0.7, a);
      gr.addColorStop(1, "white");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(r * 2.4, 0); ctx.lineTo(0, -r * 0.45); ctx.lineTo(-r * 6, 0); ctx.lineTo(0, r * 0.45);
      ctx.closePath();
      ctx.fill();
      glow(ctx, r * 1.6, 0, r * 1.4, b, 0.8);
      break;
    }
    case "meteor-drop": {
      ctx.globalCompositeOperation = "lighter";
      flame(ctx, p.x, p.y, r * 0.95, r * 4.5, ang + Math.PI, t, 1, b, "hsl(50 100% 75%)");
      ctx.globalCompositeOperation = "source-over";
      rock(ctx, p.x, p.y, r, p.rot, 7);
      ctx.fillStyle = a;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = b;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - r * 0.5, p.y); ctx.lineTo(p.x, p.y + r * 0.3); ctx.lineTo(p.x + r * 0.4, p.y - r * 0.2);
      ctx.stroke();
      break;
    }
    // ----- boss shots -----
    case "pair-burst": {
      // one shot is matter (white), the next antimatter (black with a cyan rim)
      const anti = Math.sin(ang) * dir > 0;
      ctx.globalCompositeOperation = anti ? "source-over" : "lighter";
      if (anti) {
        glow(ctx, p.x, p.y, r * 2.4, "hsl(268 70% 20%)", 0.5);
        ctx.fillStyle = "hsl(268 70% 6%)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "hsl(186 100% 72%)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        glow(ctx, p.x, p.y, r * 2.6, "hsl(186 100% 80%)", 0.7);
        glow(ctx, p.x, p.y, r * 1.1, "hsl(0 0% 100%)", 1);
      }
      ctx.strokeStyle = al(anti ? "hsl(186 100% 72%)" : "hsl(0 0% 100%)", 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 1.8, r * 0.6, p.rot, 0, TAU);
      ctx.stroke();
      break;
    }
    case "tidal-wall": {
      // a curling wall of water rolling along the floor
      const h = r * 3.4;
      const base = p.y + r;
      const gr = ctx.createLinearGradient(0, base - h, 0, base);
      gr.addColorStop(0, b);
      gr.addColorStop(0.35, "hsl(200 85% 55%)");
      gr.addColorStop(1, a);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * r * 3.2, base);
      ctx.quadraticCurveTo(p.x - dir * r * 2.4, base - h * 0.7, p.x - dir * r * 0.4, base - h);
      ctx.quadraticCurveTo(p.x + dir * r * 1.2, base - h * 1.04, p.x + dir * r * 1.3, base - h * 0.62);
      ctx.quadraticCurveTo(p.x + dir * r * 0.5, base - h * 0.72, p.x + dir * r * 0.7, base - h * 0.45);
      ctx.quadraticCurveTo(p.x + dir * r * 1.2, base - h * 0.15, p.x + dir * r * 1.6, base);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // foam along the crest
      ctx.fillStyle = "hsl(0 0% 100% / 0.9)";
      for (let i = 0; i < 7; i++) {
        const u = i / 6;
        const fx = p.x - dir * r * 0.4 + dir * u * r * 1.6;
        const fy = base - h * (1 - u * 0.4) + Math.sin(t * 14 + i) * 2;
        ctx.beginPath();
        ctx.arc(fx, fy, r * 0.16, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = "hsl(0 0% 100% / 0.5)";
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(p.x - dir * r * (2.8 - i * 0.5), base - h * 0.15 * i);
        ctx.quadraticCurveTo(p.x - dir * r * (1.8 - i * 0.4), base - h * 0.2 * i - 6, p.x - dir * r * (0.8 - i * 0.3), base - h * 0.18 * i);
        ctx.stroke();
      }
      break;
    }
    case "thunderhead": {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x, p.y, r * 2.4, b, 0.6);
      boltStroke(ctx, p.x - p.vx * 0.12, p.y - p.vy * 0.12, p.x, p.y, 7, al(b, 0.9), r * 0.7);
      glow(ctx, p.x, p.y, r * 0.8, "hsl(0 0% 100%)", 1);
      break;
    }
    case "wailing-souls": {
      // a ghost: a round head, a wavering tail streaming behind, hollow eyes and an open mouth
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x, p.y, r * 2.6, a, 0.55);
      ctx.globalCompositeOperation = "source-over";
      const tl = r * 3.2;
      const wv = Math.sin(t * 12 + p.rot * 3) * r * 0.5;
      ctx.fillStyle = al(b, 0.92);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, Math.PI / 2, -Math.PI / 2, dir < 0);
      ctx.quadraticCurveTo(p.x - dir * tl * 0.5, p.y - r * 0.9 - wv * 0.4, p.x - dir * tl, p.y + wv);
      ctx.quadraticCurveTo(p.x - dir * tl * 0.5, p.y + r * 0.9 + wv * 0.4, p.x, p.y + r);
      ctx.fill();
      ctx.fillStyle = "hsl(170 40% 10%)";
      for (const ex of [0.05, 0.5]) {
        ctx.beginPath();
        ctx.ellipse(p.x + dir * r * ex, p.y - r * 0.25, r * 0.16, r * 0.26, 0, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(p.x + dir * r * 0.3, p.y + r * 0.38, r * 0.17, r * 0.24 + Math.abs(Math.sin(t * 9)) * r * 0.1, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case "eclipse-disc": {
      // a spinning black disc rimmed in corona fire, one bright bead racing round it
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x, p.y, r * 2.6, "hsl(32 100% 55%)", 0.7);
      ctx.strokeStyle = al(b, 0.85);
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU + t * 6;
        const len = r * (1.5 + 0.3 * Math.sin(t * 20 + i));
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(an) * r, p.y + Math.sin(an) * r);
        ctx.lineTo(p.x + Math.cos(an) * len, p.y + Math.sin(an) * len);
        ctx.stroke();
      }
      glow(ctx, p.x + Math.cos(t * 14) * r, p.y + Math.sin(t * 14) * r, r * 0.7, "hsl(0 0% 100%)", 1);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = a;
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "sunspot-rain": {
      // a falling ball of sun with a black spot in its heart and a flame tail
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, p.x, p.y, r * 2.6, b, 0.65);
      flame(ctx, p.x, p.y, r * 0.9, r * 3.2, Math.atan2(-p.vy, -p.vx), t, p.rot, "hsl(24 100% 52%)", b);
      glow(ctx, p.x, p.y, r * 1.1, "hsl(48 100% 80%)", 1);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.5, 0, TAU);
      ctx.fill();
      break;
    }
    default:
      ctx.restore();
      return false;
  }
  ctx.restore();
  return true;
}

// ---------- beams and tethers ----------
type BeamShape = { x: number; y: number; ang: number; len: number; width: number };

export function drawBeamLook(ctx: CanvasRenderingContext2D, id: string, bm: BeamShape, alpha: number, t: number) {
  const lk = lookOf(id);
  if (!lk) return false;
  const { a, b } = lk;
  if (OWN_DRAW[id]) {
    drawOwnBeam(ctx, OWN_DRAW[id], a, b, bm, alpha, t);
    return true;
  }
  const w = bm.width;
  const len = bm.len;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(bm.x, bm.y);
  ctx.rotate(bm.ang);
  switch (sigOf(id)) {
    case "spatial-cut": {
      // a line where space is sliced: a black gap with bright edges, the world on either side slipping apart
      const slip = Math.sin(t * 40) * w * 0.12;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, len * 0.5, 0, w * 3, b, 0.25);
      for (const sd of [-1, 1]) {
        ctx.strokeStyle = al(b, 0.9);
        ctx.lineWidth = w * 0.18;
        ctx.beginPath(); ctx.moveTo(0, sd * w * 0.32 + slip * sd); ctx.lineTo(len, sd * w * 0.14); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = a;
      ctx.beginPath(); ctx.moveTo(0, -w * 0.3); ctx.lineTo(len, -w * 0.1); ctx.lineTo(len + w, 0); ctx.lineTo(len, w * 0.1); ctx.lineTo(0, w * 0.3); ctx.closePath(); ctx.fill();
      // shards of displaced space flaking off the edges
      ctx.fillStyle = al(b, 0.8);
      for (let i = 0; i < 8; i++) {
        const xx = len * noise(i, Math.floor(t * 12)), yy = (noise(i, 3) - 0.5) * w * 2.4;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + w * 0.4, yy - w * 0.2); ctx.lineTo(xx + w * 0.2, yy + w * 0.3); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "white";
      ctx.lineWidth = Math.max(1, w * 0.06);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len + w, 0); ctx.stroke();
      break;
    }
    case "wall-of-sound": {
      // a speaker cone at the hand and arcs of sound marching down the beam
      ctx.globalCompositeOperation = "lighter";
      const gr = ctx.createLinearGradient(0, -w, 0, w);
      gr.addColorStop(0, al(a, 0));
      gr.addColorStop(0.5, al(a, 0.45));
      gr.addColorStop(1, al(a, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, -w, len, w * 2);
      const gap = Math.max(14, w * 1.4);
      for (let x = (t * 700) % gap; x < len; x += gap) {
        const k = x / len, rr = w * (0.8 + k * 0.9);
        ctx.strokeStyle = al(Math.floor(x / gap) % 2 ? b : a, 0.9 - k * 0.5);
        ctx.lineWidth = Math.max(1.5, w * 0.22);
        ctx.beginPath(); ctx.arc(x - rr, 0, rr, -0.9, 0.9); ctx.stroke();
      }
      ctx.strokeStyle = "hsl(0 0% 100% / 0.8)";
      ctx.lineWidth = Math.max(1, w * 0.12);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      glow(ctx, 0, 0, w * 2.2, b, 0.8);
      ctx.globalCompositeOperation = "source-over";
      for (const [k, c] of [[1.1, "hsl(220 14% 12%)"], [0.75, a], [0.32, "hsl(220 14% 12%)"]] as const) {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(0, 0, w * k * 0.45, w * k * (1 + 0.08 * Math.sin(t * 50)), 0, 0, TAU); ctx.fill();
      }
      break;
    }
    case "scroll-unfurl": {
      // a paper scroll rolling out from the hand, inked as it goes, its roller at the far end
      const top = (x: number) => -w * 0.55 + Math.sin(x * 0.06 + t * 18) * w * 0.08;
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.moveTo(0, top(0));
      for (let x = 0; x <= len; x += 12) ctx.lineTo(x, top(x));
      ctx.lineTo(len, top(len) + w * 1.1);
      for (let x = len; x >= 0; x -= 12) ctx.lineTo(x, top(x) + w * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "hsl(20 30% 30% / 0.6)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // brush strokes of ink down the paper
      ctx.strokeStyle = "hsl(0 0% 8% / 0.75)";
      ctx.lineWidth = Math.max(1.2, w * 0.12);
      for (let x = w; x < len - w; x += w * 1.3) {
        const n = noise(x, 1);
        ctx.beginPath(); ctx.moveTo(x, top(x) + w * 0.3); ctx.lineTo(x + w * 0.1, top(x) + w * (0.55 + n * 0.3)); ctx.stroke();
        if (n > 0.5) { ctx.beginPath(); ctx.moveTo(x - w * 0.2, top(x) + w * 0.45); ctx.lineTo(x + w * 0.3, top(x) + w * 0.42); ctx.stroke(); }
      }
      // a red seal near the end
      ctx.strokeStyle = b;
      ctx.lineWidth = Math.max(1.2, w * 0.12);
      ctx.strokeRect(len - w * 1.6, top(len) + w * 0.25, w * 0.6, w * 0.6);
      // the roller
      ctx.fillStyle = "hsl(20 40% 22%)";
      ctx.fillRect(len - w * 0.2, top(len) - w * 0.25, w * 0.4, w * 1.6);
      ctx.fillStyle = b;
      ctx.fillRect(len - w * 0.28, top(len) - w * 0.4, w * 0.56, w * 0.2);
      ctx.fillRect(len - w * 0.28, top(len) + w * 1.3, w * 0.56, w * 0.2);
      break;
    }
    case "gamma-ray": {
      // a thick green ray that boils along its length, with a radiation core blazing at the hand
      ctx.globalCompositeOperation = "lighter";
      const bw = w * (1 + Math.sin(t * 45) * 0.1);
      const gr = ctx.createLinearGradient(0, -bw, 0, bw);
      gr.addColorStop(0, al(a, 0));
      gr.addColorStop(0.25, al(a, 0.75));
      gr.addColorStop(0.5, al(b, 1));
      gr.addColorStop(0.75, al(a, 0.75));
      gr.addColorStop(1, al(a, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(0, -bw, len, bw * 2);
      // bubbles of hot light running down the beam
      for (let i = 0; i < 10; i++) {
        const xx = ((t * 900 + i * len / 10) % len);
        const yy = Math.sin(i * 3.1 + t * 20) * bw * 0.5;
        glow(ctx, xx, yy, bw * 0.55, b, 0.6);
      }
      ctx.strokeStyle = "hsl(0 0% 100% / 0.9)";
      ctx.lineWidth = Math.max(1, bw * 0.18);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      glow(ctx, 0, 0, bw * 2.2, b, 0.9);
      glow(ctx, len, 0, bw * 1.6, a, 0.7);
      // the three-bladed core at the hand
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "hsl(90 40% 6%)";
      ctx.beginPath(); ctx.arc(0, 0, bw * 0.9, 0, TAU); ctx.fill();
      ctx.fillStyle = b;
      for (let i = 0; i < 3; i++) {
        const a0 = t * 5 + (i * TAU) / 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, bw * 0.8, a0, a0 + 0.9); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case "gaster-blaster": {
      // the skull hangs at the hand with its jaw open, firing a white beam that shudders
      ctx.globalCompositeOperation = "lighter";
      const bw = w * (1.1 + Math.sin(t * 60) * 0.12);
      const gr = ctx.createLinearGradient(0, -bw, 0, bw);
      gr.addColorStop(0, al(a, 0));
      gr.addColorStop(0.3, al(a, 0.8));
      gr.addColorStop(0.5, "hsl(0 0% 100%)");
      gr.addColorStop(0.7, al(a, 0.8));
      gr.addColorStop(1, al(a, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(w * 1.2, -bw, len - w * 1.2, bw * 2);
      glow(ctx, len, 0, bw * 1.4, a, 0.7);
      ctx.globalCompositeOperation = "source-over";
      const k = Math.max(w * 0.9, 14) / 20;
      ctx.save();
      ctx.translate(-w * 0.2, 0);
      ctx.scale(k, k);
      ctx.fillStyle = "hsl(45 25% 92%)";
      ctx.strokeStyle = "hsl(150 30% 6%)";
      ctx.lineWidth = 2;
      // skull seen side-on, snout toward the beam
      ctx.beginPath(); ctx.moveTo(-30, -22); ctx.quadraticCurveTo(-34, 0, -24, 12); ctx.lineTo(20, 4); ctx.lineTo(26, -6); ctx.quadraticCurveTo(0, -30, -30, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, 16); ctx.lineTo(22, 16); ctx.lineTo(18, 26); ctx.lineTo(-16, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "hsl(150 30% 6%)";
      ctx.beginPath(); ctx.ellipse(-6, -10, 7, 6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "hsl(128 100% 60%)";
      ctx.beginPath(); ctx.arc(-5, -10, 2.6, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case "thunder-bolt": {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, w * 2.4, "hsl(0 0% 100%)", 1);
      boltStroke(ctx, 0, 0, len, 0, 16, al(a, 0.75), w * 0.9);
      for (let i = 0; i < 3; i++) {
        const x0 = len * (0.25 + 0.2 * i + Math.random() * 0.1);
        const an = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.4);
        boltStroke(ctx, x0, 0, x0 + Math.cos(an) * len * 0.22, Math.sin(an) * len * 0.22, 8, al(a, 0.6), w * 0.4);
      }
      glow(ctx, len, 0, w * 1.6, a, 0.9);
      break;
    }
    case "prism-beam": {
      ctx.globalCompositeOperation = "lighter";
      const hues = [0, 35, 58, 130, 205, 270];
      hues.forEach((h, i) => {
        const off = (i - 2.5) * w * 0.32;
        ctx.strokeStyle = `hsl(${h} 95% 62% / 0.85)`;
        ctx.lineWidth = w * 0.38;
        ctx.beginPath();
        ctx.moveTo(w * 0.6, 0);
        ctx.lineTo(len, off * (1 + Math.sin(t * 20 + i) * 0.1));
        ctx.stroke();
      });
      ctx.strokeStyle = "white";
      ctx.lineWidth = w * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.moveTo(w * 0.9, 0); ctx.lineTo(-w * 0.5, -w * 0.8); ctx.lineTo(-w * 0.5, w * 0.8);
      ctx.closePath();
      ctx.fillStyle = "hsl(0 0% 100% / 0.85)";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "railgun": {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = al(a, 0.5);
      ctx.lineWidth = w * 1.1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= len; x += 6) ctx.lineTo(x, Math.sin(x * 0.09 - t * 50) * w * 0.85);
      ctx.stroke();
      ctx.strokeStyle = "white";
      ctx.lineWidth = w * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.strokeStyle = a;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(10 + i * 16, 0, 4, w * (1 + i * 0.45), 0, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case "gravity-pull": {
      ctx.strokeStyle = al(a, 0.85);
      ctx.lineWidth = w * 1.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) {
        const u = (t * 2.5 + i / 5) % 1;
        ctx.beginPath();
        ctx.ellipse(len * (1 - u), 0, 4, w * 2.2 * (1 - u * 0.6), 0, 0, TAU);
        ctx.stroke();
      }
      glow(ctx, len, 0, w * 3, b, 0.7);
      break;
    }
    case "magnet-pull": {
      ctx.strokeStyle = al(b, 0.5);
      ctx.lineWidth = 2;
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len / 2, sy * len * 0.22, len, 0);
        ctx.stroke();
      }
      for (let x = 6, i = 0; x < len; x += 15, i++) {
        ctx.strokeStyle = i % 2 ? b : a;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, 0, 8, i % 2 ? 2.5 : 5, 0, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    // ----- boss beams -----
    case "antimatter-lance": {
      // a black core with a white and cyan skin: light bending around nothing
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, w * 2.2, b, 0.9);
      ctx.strokeStyle = al(b, 0.55);
      ctx.lineWidth = w * 1.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.strokeStyle = "hsl(0 0% 100%)";
      ctx.lineWidth = w * 0.95;
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = a;
      ctx.lineWidth = w * 0.55;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.strokeStyle = al(b, 0.9);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        for (let x = 0; x <= len; x += 12) ctx.lineTo(x, Math.sin(x * 0.05 + t * 30 + i * Math.PI) * w * 0.7);
        ctx.stroke();
      }
      ctx.fillStyle = a;
      ctx.beginPath(); ctx.arc(len, 0, w * 0.7, 0, TAU); ctx.fill();
      break;
    }
    case "dimension-tear": {
      // reality cracks open: a black jagged rift edged in magenta and cyan, with stars inside
      const pts: [number, number][] = [];
      const n = Math.max(6, Math.floor(len / 26));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const wv = Math.sin(u * Math.PI) * w * (0.9 + 0.3 * Math.sin(i * 7.3 + t * 8));
        pts.push([u * len, wv]);
      }
      const shape = (k: number) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (const [x, y] of pts) ctx.lineTo(x, -y * k);
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] * k * 0.8);
        ctx.closePath();
      };
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(-2, 0);
      shape(1.25); ctx.fillStyle = al(b, 0.7); ctx.fill();
      ctx.translate(4, 0);
      shape(1.25); ctx.fillStyle = al("hsl(186 100% 60%)", 0.7); ctx.fill();
      ctx.translate(-2, 0);
      ctx.globalCompositeOperation = "source-over";
      shape(1); ctx.fillStyle = a; ctx.fill();
      ctx.fillStyle = "hsl(0 0% 100%)";
      for (let i = 0; i < 10; i++) ctx.fillRect((i / 10) * len + Math.sin(t * 3 + i) * 6, Math.sin(i * 2.1) * w * 0.4, 2, 2);
      break;
    }
    case "frost-lance": {
      // a long spear of ice with a faceted tip
      const gr = ctx.createLinearGradient(0, -w, 0, w);
      gr.addColorStop(0, b);
      gr.addColorStop(0.5, a);
      gr.addColorStop(1, "hsl(205 60% 55%)");
      ctx.fillStyle = gr;
      ctx.strokeStyle = "hsl(205 60% 45%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -w * 0.25);
      ctx.lineTo(len - w * 2.2, -w * 0.45);
      ctx.lineTo(len, 0);
      ctx.lineTo(len - w * 2.2, w * 0.45);
      ctx.lineTo(0, w * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "hsl(0 0% 100% / 0.8)";
      ctx.beginPath();
      ctx.moveTo(w, -w * 0.1); ctx.lineTo(len - w * 2.4, -w * 0.2);
      ctx.stroke();
      ctx.fillStyle = "hsl(44 90% 80%)";
      for (let i = 1; i < 6; i++) {
        const x = (i / 6) * (len - w * 2);
        poly(ctx, x, (i % 2 ? -1 : 1) * w * 0.55, 3, 6, t * 2 + i);
        ctx.fill();
      }
      break;
    }
    case "soul-chains": {
      // a spectral chain, links alternating flat and round, with a hook at the end
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = al(b, 0.45);
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = a;
      ctx.lineWidth = 3;
      for (let x = 6, i = 0; x < len - 6; x += 13, i++) {
        ctx.beginPath();
        ctx.ellipse(x, 0, 8, i % 2 ? 2 : 5, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = "hsl(180 10% 84%)";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(len - 6, 0);
      ctx.quadraticCurveTo(len + 12, -6, len + 2, -20);
      ctx.quadraticCurveTo(len + 4, -8, len - 6, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "solar-flare": {
      // a torrent of plasma: white-gold core, two strands twisting round it, loops arching off the top
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, 0, 0, w * 2.6, b, 1);
      ctx.strokeStyle = al(a, 0.6);
      ctx.lineWidth = w * 1.9;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.strokeStyle = b;
      ctx.lineWidth = w * 0.9;
      ctx.stroke();
      ctx.strokeStyle = "hsl(0 0% 100%)";
      ctx.lineWidth = w * 0.35;
      ctx.stroke();
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 2; i++) {
        ctx.strokeStyle = i ? al(b, 0.9) : al("hsl(14 100% 58%)", 0.9);
        ctx.beginPath();
        for (let x = 0; x <= len; x += 10) ctx.lineTo(x, Math.sin(x * 0.045 - t * 26 + i * Math.PI) * w * 0.9);
        ctx.stroke();
      }
      ctx.strokeStyle = al(a, 0.8);
      ctx.lineWidth = 3;
      for (let i = 1; i < 5; i++) {
        const x0 = (i / 5) * len, sp = 30 + 12 * Math.sin(i * 2.7);
        const hh = w * (1.6 + 0.6 * Math.sin(t * 9 + i));
        ctx.beginPath();
        ctx.moveTo(x0 - sp / 2, -w * 0.4);
        ctx.bezierCurveTo(x0 - sp / 2, -hh * 1.4, x0 + sp / 2, -hh * 1.4, x0 + sp / 2, -w * 0.4);
        ctx.stroke();
      }
      glow(ctx, len, 0, w * 1.5, "hsl(0 0% 100%)", 1);
      break;
    }
    default:
      ctx.restore();
      return false;
  }
  ctx.restore();
  return true;
}

// ---------- ground eruptions ----------
export function eruptionColors(id: string) {
  const lk = lookOf(id);
  return lk ? { a: lk.a, b: lk.b } : null;
}

/** Draws a risen eruption whose column is `h` tall, standing on the ground at `gy`. */
export function drawEruptionLook(ctx: CanvasRenderingContext2D, id: string, x: number, gy: number, r: number, h: number, t: number) {
  const lk = lookOf(id);
  if (!lk) return false;
  const { a, b } = lk;
  if (OWN_DRAW[id]) {
    drawOwnEruption(ctx, OWN_DRAW[id], a, b, x, gy, r, h, t);
    return true;
  }
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (sigOf(id)) {
    case "bone-zone": {
      // a fence of bones stabbing up out of the floor, tallest in the middle
      const n = 5;
      for (let i = 0; i < n; i++) {
        const dx = (i / (n - 1) - 0.5) * r * 1.8;
        const hh = h * (1 - Math.abs(dx) / (r * 1.4)) * (0.85 + 0.15 * Math.sin(i * 2.1));
        const cx = x + dx, top = gy - hh, bw = r * 0.16;
        ctx.strokeStyle = al(b, 0.45);
        ctx.lineWidth = bw * 2.4;
        ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx, top); ctx.stroke();
        ctx.strokeStyle = a;
        ctx.lineWidth = bw * 1.2;
        ctx.stroke();
        ctx.fillStyle = a;
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sd * bw * 0.8, top, bw * 0.95, 0, TAU); ctx.fill(); }
      }
      break;
    }
    case "flame-pillar": {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, gy - h * 0.3, r * 1.6, a, 0.5);
      for (let i = 0; i < 6; i++) {
        flame(ctx, x + Math.sin(t * 9 + i * 2) * r * 0.18, gy - i * h * 0.13, r * 0.62 * (1 - i * 0.1), h * 0.5, -Math.PI / 2, t, i, a, b);
      }
      break;
    }
    case "glacier-spike": {
      const spikes = [[-0.75, 0.5], [-0.38, 0.78], [0, 1], [0.36, 0.7], [0.72, 0.45]] as const;
      for (const [dx, sc] of spikes) {
        const cx = x + dx * r, w = r * 0.22, top = gy - h * sc;
        const gr = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
        gr.addColorStop(0, b);
        gr.addColorStop(1, a);
        ctx.beginPath();
        ctx.moveTo(cx - w, gy + 4);
        ctx.lineTo(cx - w, top + w * 1.4);
        ctx.lineTo(cx, top);
        ctx.lineTo(cx + w, top + w * 1.4);
        ctx.lineTo(cx + w, gy + 4);
        ctx.closePath();
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.strokeStyle = "hsl(210 60% 30%)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = "hsl(0 0% 100% / 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, top + 4);
        ctx.lineTo(cx, gy);
        ctx.stroke();
      }
      break;
    }
    case "earth-spike": {
      for (const [dx, sc, sd] of [[-0.55, 0.6, 1], [0.55, 0.72, 2], [0, 1, 3]] as const) {
        const cx = x + dx * r, w = r * 0.5 * sc, top = gy - h * sc;
        ctx.beginPath();
        ctx.moveTo(cx - w, gy + 4);
        for (let j = 1; j <= 4; j++) ctx.lineTo(cx - w * (1 - j / 4) + (noise(sd, j) - 0.5) * 6, gy - (gy - top) * (j / 4));
        for (let j = 3; j >= 0; j--) ctx.lineTo(cx + w * (1 - j / 4) + (noise(sd, j + 9) - 0.5) * 6, gy - (gy - top) * (j / 4));
        ctx.closePath();
        ctx.fillStyle = a;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = b;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let j = 1; j <= 3; j++) {
          const yy = gy - (gy - top) * (j / 4.4);
          const ww = w * (1 - j / 4.4) * 0.8;
          ctx.moveTo(cx - ww, yy);
          ctx.lineTo(cx + ww, yy + 4);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        rock(ctx, x + (noise(5, i) - 0.5) * r * 1.6, gy - h - 10 - noise(6, i) * 40, 5, t * 6 + i, i);
        ctx.fillStyle = b;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      break;
    }
    case "updraft": {
      for (let i = 0; i < 9; i++) {
        const u = i / 8;
        const rx = r * 0.3 + u * r * 1.0;
        const y = gy - u * h;
        ctx.strokeStyle = i % 2 ? al(b, 0.85) : al(a, 0.85);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x + Math.sin(t * 6 + u * 3) * 8, y, rx, rx * 0.22, 0, t * 12 + i, t * 12 + i + 4);
        ctx.stroke();
      }
      ctx.fillStyle = al(b, 0.35);
      ctx.beginPath();
      ctx.ellipse(x, gy, r * 1.2, 9, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case "geyser": {
      const w = r * 0.42;
      const gr = ctx.createLinearGradient(0, gy, 0, gy - h);
      gr.addColorStop(0, a);
      gr.addColorStop(1, al(b, 0.9));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x - w, gy + 4);
      for (let i = 0; i <= 8; i++) ctx.lineTo(x - w * (1 - i * 0.04) + Math.sin(t * 30 + i) * 4, gy - (h * i) / 8);
      for (let i = 8; i >= 0; i--) ctx.lineTo(x + w * (1 - i * 0.04) + Math.sin(t * 30 + i + 2) * 4, gy - (h * i) / 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "white";
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.arc(x + (i - 3) * w * 0.4, gy - h - Math.sin((i / 6) * Math.PI) * 18, w * 0.32, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = b;
      for (let i = 0; i < 8; i++) {
        const an = -Math.PI * (0.1 + 0.8 * (i / 7));
        teardrop(ctx, x + Math.cos(an) * w * 2.2, gy - h + Math.sin(an) * 30 + 20, 4, an + Math.PI);
        ctx.fill();
      }
      break;
    }
    case "psychic-lift": {
      ctx.globalCompositeOperation = "lighter";
      const col = ctx.createLinearGradient(0, gy, 0, gy - h);
      col.addColorStop(0, al(a, 0.55));
      col.addColorStop(1, al(a, 0));
      ctx.fillStyle = col;
      ctx.fillRect(x - r * 0.8, gy - h, r * 1.6, h);
      ctx.strokeStyle = b;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const u = (t * 1.8 + i / 6) % 1;
        ctx.globalAlpha = Math.sin(Math.PI * u);
        ctx.beginPath();
        ctx.ellipse(x, gy - u * h, r * 0.85, 7, 0, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    // ----- boss eruptions -----
    case "fault-line": {
      // the floor splits and magma fountains up between broken slabs
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, gy - h * 0.35, r * 1.8, a, 0.55);
      for (let i = 0; i < 5; i++) flame(ctx, x + (i - 2) * r * 0.22, gy, r * 0.32, h * (0.55 + 0.25 * Math.sin(i * 1.7 + t * 9)), -Math.PI / 2 + (i - 2) * 0.12, t, i, a, b);
      ctx.globalCompositeOperation = "source-over";
      for (const sd of [-1, 1]) {
        ctx.fillStyle = "hsl(12 25% 18%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + sd * r * 0.3, gy + 4);
        ctx.lineTo(x + sd * r * 0.5, gy - h * 0.22);
        ctx.lineTo(x + sd * r * 1.05, gy - h * 0.12);
        ctx.lineTo(x + sd * r * 1.15, gy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = b;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + sd * r * 0.55, gy - h * 0.18);
        ctx.lineTo(x + sd * r * 0.8, gy - h * 0.05);
        ctx.stroke();
      }
      break;
    }
    case "grave-hands": {
      // a skeletal hand bursts out of the ground and grabs
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, gy - h * 0.4, r * 1.6, b, 0.45);
      ctx.globalCompositeOperation = "source-over";
      const top = gy - h * 0.72;
      const sway = Math.sin(t * 6) * 4;
      const grip = Math.min(1, Math.max(0, (t - 0.45) * 4));
      const bones = (wid: number, col: string) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = wid;
        ctx.beginPath();
        ctx.moveTo(x - 3, gy + 4); ctx.lineTo(x - 3 + sway, top + 10);
        ctx.moveTo(x + 4, gy + 4); ctx.lineTo(x + 4 + sway, top + 10);
        for (let i = 0; i < 4; i++) {
          const fx0 = x + sway + (i - 1.5) * r * 0.2, fy0 = top;
          const fx1 = x + sway + (i - 1.5) * r * 0.28, fy1 = top - r * 0.55;
          ctx.moveTo(fx0, fy0);
          ctx.lineTo(fx1, fy1);
          ctx.lineTo(fx1 + (x + sway - fx1) * 0.55 * grip, fy1 - r * 0.2 * (1 - grip) + r * 0.05);
        }
        ctx.moveTo(x + sway - r * 0.36, top + 8);
        ctx.lineTo(x + sway - r * 0.55, top - r * 0.2);
        ctx.stroke();
      };
      bones(8, INK);
      bones(4.5, a);
      ctx.fillStyle = a;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + sway, top + 4, r * 0.38, r * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "hsl(28 25% 24%)";
      for (let i = 0; i < 5; i++) {
        rock(ctx, x + (i - 2) * r * 0.42, gy - 3 - (i % 2) * 5, 6 + (i % 3) * 2, i, i * 3.1);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "prominence": {
      // a solar prominence: a loop of plasma arching out of the ground and back in
      const bez = (u: number) => {
        const p0 = [x - r * 0.8, gy], p1 = [x - r * 1.7, gy - h * 1.2], p2 = [x + r * 1.7, gy - h * 1.2], p3 = [x + r * 0.8, gy];
        const v = 1 - u;
        return [
          v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
          v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
        ];
      };
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, gy - h * 0.5, r * 2.2, a, 0.5);
      for (const [wd, c] of [[r * 0.75, al(a, 0.7)], [r * 0.4, b], [r * 0.14, "hsl(0 0% 100%)"]] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = wd;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.8, gy);
        ctx.bezierCurveTo(x - r * 1.7, gy - h * 1.2, x + r * 1.7, gy - h * 1.2, x + r * 0.8, gy);
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const [px, py] = bez((i / 7 + t * 0.9) % 1);
        glow(ctx, px, py, r * 0.4, "hsl(0 0% 100%)", 0.8);
      }
      for (let i = 0; i < 3; i++) flame(ctx, x + (i - 1) * r * 0.5, gy, r * 0.35, h * 0.3, -Math.PI / 2, t, i, a, b);
      break;
    }
    default:
      ctx.restore();
      return false;
  }
  ctx.restore();
  return true;
}

// ---------- lingering fields ----------
export function drawZoneLook(ctx: CanvasRenderingContext2D, id: string, x: number, gy: number, r: number, alpha: number, t: number) {
  const lk = lookOf(id);
  if (!lk) return false;
  const { a, b } = lk;
  if (OWN_DRAW[id]) {
    drawOwnZone(ctx, OWN_DRAW[id], a, b, x, gy, r, alpha, t);
    return true;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (sigOf(id)) {
    case "spatial-prison": {
      // a cage of folded space: a wireframe cube turning slowly around the spot, its faces shimmering
      const cy = gy - r * 0.85, sz = r * 0.8;
      const ry = t * 0.9, rx = 0.35;
      const pts: [number, number][] = [];
      for (const [px, py, pz] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
        const x1 = px * Math.cos(ry) - pz * Math.sin(ry), z1 = px * Math.sin(ry) + pz * Math.cos(ry);
        pts.push([x + x1 * sz, cy + (py * Math.cos(rx) - z1 * Math.sin(rx)) * sz]);
      }
      ctx.fillStyle = al(a, 0.28);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]); [1, 2, 3].forEach((i) => ctx.lineTo(pts[i][0], pts[i][1])); ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); }
      ctx.stroke();
      for (const [px, py] of pts) glow(ctx, px, py, 8, b, 0.9);
      glow(ctx, x, cy, r * 0.9, b, 0.18 + 0.08 * Math.sin(t * 6));
      break;
    }
    case "frozen-floor": {
      glow(ctx, x, gy - 10, r * 0.9, b, 0.35);
      const gr = ctx.createLinearGradient(0, gy - 14, 0, gy + 14);
      gr.addColorStop(0, al(b, 0.9));
      gr.addColorStop(1, al(a, 0.75));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, gy + 2, r, 14, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "hsl(205 60% 45%)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "hsl(0 0% 100% / 0.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x0 = x + (noise(11, i) - 0.5) * r * 1.4;
        ctx.moveTo(x0, gy + 2);
        ctx.lineTo(x0 + (noise(12, i) - 0.5) * 30, gy - 4 + noise(13, i) * 12);
        ctx.lineTo(x0 + (noise(14, i) - 0.5) * 40, gy + 6);
      }
      ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const sx = x + ((i - 4) / 4) * r * 0.85;
        const hh = 8 + noise(15, i) * 14;
        ctx.beginPath();
        ctx.moveTo(sx - 4, gy - 4); ctx.lineTo(sx, gy - 4 - hh); ctx.lineTo(sx + 4, gy - 4);
        ctx.closePath();
        ctx.fillStyle = b;
        ctx.fill();
        ctx.strokeStyle = a;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      break;
    }
    case "night-veil": {
      const dome = ctx.createRadialGradient(x, gy, 0, x, gy, r);
      dome.addColorStop(0, al(a, 0.85));
      dome.addColorStop(1, al(a, 0.1));
      ctx.fillStyle = dome;
      ctx.beginPath();
      ctx.ellipse(x, gy, r, r * 0.8, 0, Math.PI, 0);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 14; i++) {
        const an = Math.PI + noise(21, i) * Math.PI;
        const d = Math.sqrt(noise(22, i)) * 0.9;
        const sx = x + Math.cos(an) * r * d, sy = gy + Math.sin(an) * r * 0.8 * d;
        ctx.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i)));
        star4(ctx, sx, sy, 4 + noise(23, i) * 4, 0.25, 0);
        ctx.fillStyle = b;
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = "source-over";
      const my = gy - r * 0.55;
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.arc(x, my, 14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.arc(x + 6, my - 4, 12, 0, TAU);
      ctx.fill();
      break;
    }
    case "singularity": {
      const cy = gy - 60;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, cy, r * 1.1, b, 0.35);
      ctx.strokeStyle = al(b, 0.85);
      ctx.lineWidth = 2.5;
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const u = i / 30;
          const an = arm * (TAU / 4) + u * 4 - t * 3;
          const rr = 18 + u * r * 0.95;
          ctx.lineTo(x + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.45);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.arc(x, cy, 20, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "hsl(40 100% 85%)";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "miasma-cloud": {
      for (let i = 0; i < 10; i++) {
        const px = x + Math.sin(t * 0.9 + i * 1.3) * r * 0.65;
        const py = gy - 18 - (i % 3) * 22 - Math.sin(t * 1.3 + i) * 6;
        ctx.fillStyle = al(i % 2 ? a : b, i % 2 ? 0.38 : 0.26);
        ctx.beginPath();
        ctx.arc(px, py, 26 + noise(31, i) * 18, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const u = (t * 0.6 + i / 6) % 1;
        ctx.globalAlpha = alpha * (1 - u);
        ctx.beginPath();
        ctx.arc(x + (noise(32, i) - 0.5) * r * 1.4, gy - u * r, 3 + noise(33, i) * 4, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case "stasis-field": {
      const dome = ctx.createRadialGradient(x, gy, 0, x, gy, r);
      dome.addColorStop(0, al(a, 0.4));
      dome.addColorStop(1, al(a, 0));
      ctx.fillStyle = dome;
      ctx.beginPath();
      ctx.ellipse(x, gy, r, r * 0.8, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = a;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, gy + 2, r, 12, 0, 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      // the hands barely move: time is held still inside
      const tick = Math.floor(t * 2) * 0.05;
      dial(ctx, x, gy - r * 0.45, r * 0.38, b, a, -Math.PI / 2 + tick, tick * 0.2, 3);
      break;
    }
    // ----- boss fields -----
    case "null-field": {
      // a dome of nothing: black inside, a cyan event horizon, rings falling inward
      const cy = gy - r * 0.45;
      const dome = ctx.createRadialGradient(x, gy, 0, x, gy, r);
      dome.addColorStop(0, al(a, 0.85));
      dome.addColorStop(0.75, al(a, 0.55));
      dome.addColorStop(1, al(a, 0));
      ctx.fillStyle = dome;
      ctx.beginPath();
      ctx.ellipse(x, gy, r, r * 0.95, 0, Math.PI, 0);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x, gy, r, r * 0.95, 0, Math.PI, 0);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const k = 1 - ((t * 0.7 + i / 3) % 1);
        ctx.strokeStyle = al(b, 0.7 * (1 - k));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, cy, r * 0.9 * k, r * 0.22 * k, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "hsl(0 0% 0%)";
      ctx.beginPath();
      ctx.arc(x, cy, 14, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "hsl(0 0% 100%)";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "eye-of-the-storm": {
      // a whirlpool on the floor under a spinning cloud, with lightning down the middle
      for (let i = 0; i < 6; i++) {
        const k = i / 5;
        ctx.strokeStyle = i % 2 ? al(b, 0.8) : al("hsl(210 80% 45%)", 0.85);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, gy - 2, r * (1 - k * 0.8), r * 0.16 * (1 - k * 0.8), 0, t * 6 + i, t * 6 + i + 4.4);
        ctx.stroke();
      }
      const top = gy - r * 1.6;
      ctx.fillStyle = al("hsl(215 25% 28%)", 0.9);
      for (let i = 0; i < 6; i++) {
        const an = t * 2 + (i / 6) * TAU;
        ctx.beginPath();
        ctx.arc(x + Math.cos(an) * r * 0.55, top + Math.sin(an) * 10, 20, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 4; i++) {
        const an = (i / 4) * TAU - t * 3;
        ctx.strokeStyle = al(b, 0.35);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * r * 0.5, top + 14);
        ctx.quadraticCurveTo(x + Math.cos(an + 1) * r * 0.7, (top + gy) / 2, x + Math.cos(an + 2) * r * 0.9, gy - 4);
        ctx.stroke();
      }
      if (Math.sin(t * 13) > 0.55) {
        ctx.globalCompositeOperation = "lighter";
        boltStroke(ctx, x, top + 10, x + Math.sin(t * 40) * 16, gy - 6, 14, al("hsl(54 100% 70%)", 0.9), 4);
      }
      break;
    }
    case "magma-lake": {
      // a pool of lava with a black crust and bubbles that pop
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, gy - 10, r * 1.1, a, 0.5);
      ctx.globalCompositeOperation = "source-over";
      const gr = ctx.createRadialGradient(x, gy, 0, x, gy, r);
      gr.addColorStop(0, b);
      gr.addColorStop(0.6, a);
      gr.addColorStop(1, "hsl(10 60% 22%)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, gy + 2, r, 15, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "hsl(12 30% 14%)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "hsl(12 25% 16% / 0.8)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(x + (i - 1.5) * r * 0.45 + Math.sin(t + i) * 4, gy + 2 + (i % 2 ? 4 : -3), r * 0.14, 3, 0.2, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.9 + i * 0.37) % 1;
        const bx = x + Math.sin(i * 12.9) * r * 0.75;
        ctx.strokeStyle = al(b, 1 - k);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, gy - 2 - k * 26, 3 + k * 7, Math.PI, 0);
        ctx.stroke();
      }
      break;
    }
    case "graveyard": {
      // a patch of grave mist: leaning headstones and will-o'-wisps that feed the reaper
      const gr = ctx.createRadialGradient(x, gy, 0, x, gy, r);
      gr.addColorStop(0, al(a, 0.85));
      gr.addColorStop(1, al(a, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, gy, r, r * 0.55, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, gy + 2, r, 11, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const th = 26 + (i % 2) * 9;
        ctx.save();
        ctx.translate(x + (i - 1.5) * r * 0.48, gy + 2);
        ctx.rotate(Math.sin(i * 3.1) * 0.16);
        ctx.fillStyle = "hsl(200 6% 50%)";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(-9, -th + 9);
        ctx.arc(0, -th + 9, 9, Math.PI, 0);
        ctx.lineTo(9, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -th + 6); ctx.lineTo(0, -th + 18);
        ctx.moveTo(-4, -th + 10); ctx.lineTo(4, -th + 10);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const wx = x + Math.sin(i * 2.7 + t * 0.8) * r * 0.7;
        const wy = gy - 46 - Math.sin(t * 3 + i) * 12;
        glow(ctx, wx, wy, 14, b, 0.8);
        glow(ctx, wx, wy, 4, "hsl(0 0% 100%)", 1);
      }
      break;
    }
    default:
      ctx.restore();
      return false;
  }
  ctx.restore();
  return true;
}

// ---------- annihilation (Nullshade) ----------
/** Matter (white) and antimatter (black) orbs slide in from both sides of the spot; at k = 1 they meet and cancel out in a flash. */
export function drawAnnihilation(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, r: number, k: number, t: number) {
  const lk = lookOf(id);
  const b = lk?.b ?? "hsl(268 70% 22%)";
  ctx.save();
  if (k < 1) {
    const e = out3(Math.min(1, k));
    const gap = (1 - e) * (r * 3.2);
    // the target line
    ctx.strokeStyle = al("hsl(186 100% 72%)", 0.35 + 0.3 * Math.sin(t * 30));
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // matter
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, x - gap, y, 28, "hsl(186 100% 80%)", 0.8);
    glow(ctx, x - gap, y, 12, "hsl(0 0% 100%)", 1);
    // antimatter
    ctx.globalCompositeOperation = "source-over";
    glow(ctx, x + gap, y, 30, b, 0.6);
    ctx.fillStyle = "hsl(268 70% 5%)";
    ctx.beginPath();
    ctx.arc(x + gap, y, 11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "hsl(186 100% 72%)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    const u = Math.min(1, (k - 1) / 0.55);
    const e = out3(u);
    ctx.globalAlpha = 1 - u;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, x, y, r * (0.6 + e * 1.4), "hsl(0 0% 100%)", 1);
    ctx.strokeStyle = "hsl(186 100% 80%)";
    ctx.lineWidth = 6 * (1 - u) + 1;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.3 + e * 1.5), 0, TAU);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "hsl(268 70% 10%)";
    ctx.lineWidth = 8 * (1 - u) + 1;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.15 + e * 1.1), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- rushing moves ----------
/** Drawn around a fighter while a rush move carries them forward. */
export function drawRushLook(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, s: number, dir: number, t: number) {
  const lk = lookOf(id);
  if (!lk) return;
  const { a, b } = lk;
  if (OWN_DRAW[id]) {
    drawOwnRush(ctx, OWN_DRAW[id], a, b, x, y, s, dir, t);
    return;
  }
  ctx.save();
  ctx.lineCap = "round";
  switch (sigOf(id)) {
    case "cyclone-spin":
      for (let i = 0; i < 7; i++) {
        const u = i / 6;
        const rx = (18 + u * 34) * s;
        ctx.strokeStyle = i % 2 ? al(b, 0.9) : al(a, 0.9);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y - u * 120 * s, rx, rx * 0.24, 0, t * 16 + i, t * 16 + i + 4.2);
        ctx.stroke();
      }
      break;
    case "mach-rush": {
      // a cone of compressed air at the front, a sonic ring peeling off behind and a trail of afterimage outlines
      ctx.globalCompositeOperation = "lighter";
      const cy = y - 55 * s;
      for (let i = 1; i <= 4; i++) {
        ctx.strokeStyle = al(i % 2 ? b : a, 0.7 / i);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x - dir * i * 28 * s, cy, 10 * s, 48 * s, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = al(b, 0.35);
      ctx.beginPath();
      ctx.moveTo(x + dir * 46 * s, cy);
      ctx.quadraticCurveTo(x + dir * 18 * s, cy - 60 * s, x - dir * 10 * s, cy - 66 * s);
      ctx.lineTo(x - dir * 10 * s, cy + 66 * s);
      ctx.quadraticCurveTo(x + dir * 18 * s, cy + 60 * s, x + dir * 46 * s, cy);
      ctx.fill();
      ctx.strokeStyle = al("hsl(0 0% 100%)", 0.8);
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const yy = cy + (i - 2.5) * 18 * s;
        const l = (60 + ((i * 29 + Math.floor(t * 40) * 7) % 50)) * s;
        ctx.beginPath(); ctx.moveTo(x - dir * 20 * s, yy); ctx.lineTo(x - dir * (20 * s + l), yy); ctx.stroke();
      }
      break;
    }
    case "blink-barrage":
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i % 2 ? b : a;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - i * 0.28;
        ctx.beginPath();
        ctx.ellipse(x - dir * (26 + i * 40) * s, y - 55 * s, 6 * s, 46 * s, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = b;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const cy = y - (30 + Math.random() * 60) * s;
        ctx.moveTo(x - 30 * s, cy - 18 * s);
        ctx.lineTo(x + 30 * s, cy + 18 * s);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}

// ---------- invented powers' own moves ----------
// A power typed into the character creator gets moves of its own. For each move the AI picks a shape, how it travels,
// the trail it leaves and how it bursts on a hit, and the drawings below build the move from those choices, in the
// move's own colours. None of them reuses a fighter's hand-drawn signature.

export const OWN_GLYPHS = ["orb", "star", "crescent", "diamond", "spiral", "ring", "arrow", "fang", "cube", "heart", "eye", "flower", "hex", "cross", "drop", "feather"] as const;
export type OwnGlyph = (typeof OWN_GLYPHS)[number];
export const OWN_TRAILS = ["none", "streak", "dots", "ribbon", "sparkle", "echo"] as const;
export type OwnTrail = (typeof OWN_TRAILS)[number];
export const OWN_MOTIONS = ["steady", "spin", "wobble", "pulse"] as const;
export type OwnMotion = (typeof OWN_MOTIONS)[number];
export const OWN_BURSTS = ["scatter", "ring", "spiral", "fountain", "crack"] as const;
export type OwnBurst = (typeof OWN_BURSTS)[number];

/** How one invented move is drawn. `kind` is the move's kind, so its cast effect fits what it does. */
export type OwnDraw = { kind: string; glyph: OwnGlyph; trail: OwnTrail; motion: OwnMotion; burst: OwnBurst };
const OWN_DRAW: Record<string, OwnDraw> = {};
const SPARK_GRAV: Partial<Record<PShape, number>> = { drop: 700, chunk: 900, shard: 400, flake: 60, ember: -200, smoke: -60, bubble: -80, leaf: -40, petal: 40, dust: -30 };
const WHITE = "hsl(0 0% 100%)";
const CAST_AT: Record<string, Look["cast"]> = {
  melee: "hand", projectile: "hand", beam: "hand", pull: "hand", burst: "body", heal: "body", blink: "body", dash: "body", zone: "feet", eruption: "feet", rain: "sky",
};

/** Registers an invented move's look: its colours, particles and its own drawing. */
export function designLook(id: string, a: string, b: string, p: PShape, d: OwnDraw) {
  const prev = LOOKS[id];
  const same = OWN_DRAW[id];
  if (prev && same && prev.a === a && prev.b === b && prev.p === p && same.glyph === d.glyph && same.trail === d.trail && same.motion === d.motion && same.burst === d.burst && same.kind === d.kind) return;
  const light = Number(/(\d+(?:\.\d+)?)%\)$/.exec(a)?.[1] ?? 50) >= 36;
  const cast = CAST_AT[d.kind] ?? "hand";
  LOOKS[id] = { a, b, p, add: light, grav: SPARK_GRAV[p] ?? 0, hit: "own", cast, castLife: cast === "sky" ? 1 : cast === "hand" ? 0.3 : 0.55 };
  OWN_DRAW[id] = d;
}

/** A glyph's turn for its motion: along its path, spinning, or rocking. */
function spinOf(m: OwnMotion, base: number, t: number, seed = 0) {
  return m === "spin" ? t * 10 + seed : m === "wobble" ? base + Math.sin(t * 14 + seed) * 0.5 : base;
}
const pulseOf = (m: OwnMotion, t: number, seed = 0) => (m === "pulse" ? 1 + 0.2 * Math.sin(t * 16 + seed) : 1);

/** One glyph centred on (0, 0) pointing along +x, `r` its radius. */
function drawGlyph(ctx: CanvasRenderingContext2D, g: OwnGlyph, r: number, a: string, b: string) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = a;
  ctx.strokeStyle = b;
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  const fs = () => { ctx.fill(); ctx.stroke(); };
  switch (g) {
    case "orb":
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); fs();
      ctx.fillStyle = al(WHITE, 0.7);
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, TAU); ctx.fill();
      break;
    case "star":
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU; const rr = i % 2 ? r * 0.45 : r * 1.15; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      ctx.closePath(); fs();
      break;
    case "crescent":
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.1, -1.9, 1.9);
      ctx.arc(-r * 0.6, 0, r * 1.07, 1.335, -1.335, true);
      ctx.closePath(); fs();
      break;
    case "diamond":
      ctx.beginPath(); ctx.moveTo(r * 1.35, 0); ctx.lineTo(0, r * 0.62); ctx.lineTo(-r * 0.95, 0); ctx.lineTo(0, -r * 0.62); ctx.closePath(); fs();
      ctx.strokeStyle = al(WHITE, 0.6); ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath(); ctx.moveTo(r * 1.1, 0); ctx.lineTo(-r * 0.6, 0); ctx.stroke();
      break;
    case "spiral":
      for (const [c, w] of [[a, 0.3], [b, 0.12]] as const) {
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(1.5, r * w);
        ctx.beginPath();
        for (let i = 0; i <= 36; i++) { const an = i * 0.38; const rr = (r * 1.15 * i) / 36; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        ctx.stroke();
      }
      break;
    case "ring":
      ctx.strokeStyle = a; ctx.lineWidth = Math.max(2, r * 0.36);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.stroke();
      ctx.strokeStyle = b; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
      break;
    case "arrow":
      ctx.strokeStyle = a; ctx.lineWidth = Math.max(1.5, r * 0.26);
      ctx.beginPath(); ctx.moveTo(-r * 1.3, 0); ctx.lineTo(r * 0.4, 0); ctx.stroke();
      ctx.strokeStyle = b; ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.beginPath();
      for (const sd of [-1, 1]) { ctx.moveTo(-r * 1.3, 0); ctx.lineTo(-r * 1.6, sd * r * 0.4); ctx.moveTo(-r * 1, 0); ctx.lineTo(-r * 1.3, sd * r * 0.4); }
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 1.3, 0); ctx.lineTo(r * 0.15, r * 0.62); ctx.lineTo(r * 0.4, 0); ctx.lineTo(r * 0.15, -r * 0.62); ctx.closePath();
      ctx.lineWidth = Math.max(1.5, r * 0.12); fs();
      break;
    case "fang":
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.6);
      ctx.quadraticCurveTo(r * 0.7, -r * 0.55, r * 1.25, r * 0.55);
      ctx.quadraticCurveTo(r * 0.2, r * 0.05, -r * 0.8, r * 0.55);
      ctx.closePath(); fs();
      break;
    case "cube":
      ctx.beginPath(); ctx.rect(-r * 0.7, -r * 0.5, r * 1.2, r * 1.2); fs();
      ctx.fillStyle = al(b, 0.75);
      ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(-r * 0.3, -r * 0.9); ctx.lineTo(r * 0.9, -r * 0.9); ctx.lineTo(r * 0.5, -r * 0.5); ctx.closePath(); fs();
      ctx.fillStyle = a;
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(r * 0.9, -r * 0.9); ctx.lineTo(r * 0.9, r * 0.3); ctx.lineTo(r * 0.5, r * 0.7); ctx.closePath(); fs();
      break;
    case "heart":
      ctx.save();
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, r * 1.1);
      ctx.bezierCurveTo(-r * 1.3, r * 0.15, -r * 0.95, -r * 1.0, 0, -r * 0.35);
      ctx.bezierCurveTo(r * 0.95, -r * 1.0, r * 1.3, r * 0.15, 0, r * 1.1);
      ctx.closePath(); fs();
      ctx.restore();
      break;
    case "eye":
      ctx.fillStyle = b;
      ctx.strokeStyle = a;
      ctx.beginPath(); ctx.moveTo(-r * 1.2, 0); ctx.quadraticCurveTo(0, -r * 1.05, r * 1.2, 0); ctx.quadraticCurveTo(0, r * 1.05, -r * 1.2, 0); ctx.closePath(); fs();
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, TAU); ctx.fill();
      break;
    case "flower":
      for (let i = 0; i < 5; i++) {
        const an = (i / 5) * TAU;
        ctx.beginPath(); ctx.ellipse(Math.cos(an) * r * 0.55, Math.sin(an) * r * 0.55, r * 0.55, r * 0.3, an, 0, TAU); fs();
      }
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, TAU); ctx.fill();
      break;
    case "hex":
      poly(ctx, 0, 0, r, 6, 0); fs();
      ctx.strokeStyle = al(b, 0.7); ctx.lineWidth = Math.max(1, r * 0.1);
      poly(ctx, 0, 0, r * 0.55, 6, Math.PI / 6); ctx.stroke();
      break;
    case "cross": {
      const w = r * 0.24;
      ctx.beginPath();
      ctx.moveTo(-w, -r); ctx.lineTo(w, -r); ctx.lineTo(w, -w); ctx.lineTo(r, -w); ctx.lineTo(r, w); ctx.lineTo(w, w);
      ctx.lineTo(w, r); ctx.lineTo(-w, r); ctx.lineTo(-w, w); ctx.lineTo(-r, w); ctx.lineTo(-r, -w); ctx.lineTo(-w, -w);
      ctx.closePath(); fs();
      break;
    }
    case "drop":
      ctx.beginPath(); ctx.arc(r * 0.25, 0, r * 0.78, -2.2, 2.2); ctx.lineTo(-r * 1.35, 0); ctx.closePath(); fs();
      ctx.fillStyle = al(WHITE, 0.6); ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.25, r * 0.2, 0, TAU); ctx.fill();
      break;
    case "feather":
      ctx.beginPath(); ctx.moveTo(-r * 1.1, 0); ctx.quadraticCurveTo(0, -r * 0.8, r * 1.3, 0); ctx.quadraticCurveTo(0, r * 0.5, -r * 1.1, 0); ctx.closePath(); fs();
      ctx.strokeStyle = al(b, 0.9); ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath(); ctx.moveTo(-r * 1.5, 0); ctx.lineTo(r * 1.2, 0);
      for (let i = 1; i < 5; i++) { const x = -r * 0.8 + i * r * 0.4; ctx.moveTo(x, 0); ctx.lineTo(x - r * 0.25, -r * 0.4); }
      ctx.stroke();
      break;
  }
}

/** A glyph with a soft glow behind it, at (x, y), turned by `rot`. */
function glyphAt(ctx: CanvasRenderingContext2D, g: OwnGlyph, x: number, y: number, r: number, rot: number, a: string, b: string) {
  if (r <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, 0, 0, r * 2.1, b, 0.32);
  ctx.globalCompositeOperation = "source-over";
  ctx.rotate(rot);
  drawGlyph(ctx, g, r, a, b);
  ctx.restore();
}

/** What a shot leaves behind it: from (x, y) back along (bx, by). */
function ownTrail(ctx: CanvasRenderingContext2D, d: OwnDraw, x: number, y: number, bx: number, by: number, r: number, a: string, b: string, t: number) {
  const nx = -by, ny = bx;
  ctx.save();
  switch (d.trail) {
    case "streak": {
      ctx.globalCompositeOperation = "lighter";
      const ex = x + bx * r * 5.5, ey = y + by * r * 5.5;
      const gr = ctx.createLinearGradient(x, y, ex, ey);
      gr.addColorStop(0, al(b, 0.75));
      gr.addColorStop(1, al(b, 0));
      ctx.strokeStyle = gr;
      ctx.lineWidth = r * 1.3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = al(a, 0.8);
      ctx.lineWidth = r * 0.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + bx * r * 3.5, y + by * r * 3.5); ctx.stroke();
      break;
    }
    case "dots":
      for (let i = 1; i <= 4; i++) {
        ctx.fillStyle = al(i % 2 ? b : a, 0.85 - i * 0.17);
        ctx.beginPath(); ctx.arc(x + bx * r * 1.35 * i, y + by * r * 1.35 * i, r * (0.5 - i * 0.08), 0, TAU); ctx.fill();
      }
      break;
    case "ribbon":
      ctx.lineCap = "round";
      for (const sd of [-1, 1]) {
        ctx.strokeStyle = al(sd > 0 ? b : a, 0.8);
        ctx.lineWidth = Math.max(1.5, r * 0.28);
        ctx.beginPath();
        for (let j = 0; j <= 14; j++) {
          const u = j / 14;
          const along = r * 6 * u, off = sd * Math.sin(u * 9 - t * 22) * r * 0.7 * (1 - u * 0.6);
          ctx.lineTo(x + bx * along + nx * off, y + by * along + ny * off);
        }
        ctx.stroke();
      }
      break;
    case "sparkle":
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = b;
      for (let i = 0; i < 6; i++) {
        const along = r * (1.2 + i * 0.9), off = (noise(i, Math.floor(t * 14)) - 0.5) * r * 2;
        star4(ctx, x + bx * along + nx * off, y + by * along + ny * off, r * (0.55 - i * 0.06), 0.25, t * 4 + i);
        ctx.fill();
      }
      break;
    case "echo":
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.55 / i;
        glyphAt(ctx, d.glyph, x + bx * r * 1.6 * i, y + by * r * 1.6 * i, r * (1 - i * 0.15), spinOf(d.motion, Math.atan2(-by, -bx), t - i * 0.05), a, b);
      }
      break;
    case "none":
      break;
  }
  ctx.restore();
}

function drawOwnShot(ctx: CanvasRenderingContext2D, d: OwnDraw, a: string, b: string, p: Shot, t: number) {
  const ang = Math.atan2(p.vy, p.vx);
  const cx = Math.cos(ang), cy = Math.sin(ang);
  const wob = d.motion === "wobble" ? Math.sin(t * 18) * p.r * 0.5 : 0;
  const x = p.x - cy * wob, y = p.y + cx * wob;
  ownTrail(ctx, d, x, y, -cx, -cy, p.r, a, b, t);
  glyphAt(ctx, d.glyph, x, y, p.r * pulseOf(d.motion, t), spinOf(d.motion, ang, t), a, b);
}

function drawOwnBeam(ctx: CanvasRenderingContext2D, d: OwnDraw, a: string, b: string, bm: BeamShape, alpha: number, t: number) {
  const w = Math.max(8, bm.width), len = bm.len;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.translate(bm.x, bm.y);
  ctx.rotate(bm.ang);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = al(b, 0.3);
  ctx.lineWidth = w * 1.7;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
  switch (d.trail) {
    case "ribbon":
      for (const sd of [-1, 1]) {
        ctx.strokeStyle = sd > 0 ? b : a;
        ctx.lineWidth = w * 0.22;
        ctx.beginPath();
        for (let xx = 0; xx <= len; xx += 6) ctx.lineTo(xx, sd * Math.sin(xx / (w * 1.4) - t * 30) * w * 0.5);
        ctx.stroke();
      }
      break;
    case "dots": {
      const gap = w * 0.95, off = (t * w * 14) % gap;
      ctx.fillStyle = b;
      for (let xx = off; xx < len; xx += gap) { ctx.beginPath(); ctx.arc(xx, 0, w * 0.24, 0, TAU); ctx.fill(); }
      break;
    }
    case "sparkle":
      ctx.strokeStyle = al(a, 0.8);
      ctx.lineWidth = w * 0.3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.fillStyle = b;
      for (let i = 0; i < 10; i++) {
        star4(ctx, len * noise(i, Math.floor(t * 16)), (noise(i, 7 + Math.floor(t * 16)) - 0.5) * w * 1.8, w * 0.35, 0.25, t * 5 + i);
        ctx.fill();
      }
      break;
    default:
      ctx.strokeStyle = a;
      ctx.lineWidth = w * 0.55;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = Math.max(1.5, w * 0.14);
      ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  const gap = w * 2.3, off = (t * w * 10) % gap;
  const gr = w * (d.trail === "echo" ? 0.55 : 0.42);
  for (let xx = off + gap * 0.5; xx < len - w; xx += gap) {
    const wob = d.motion === "wobble" ? Math.sin(xx / w - t * 18) * w * 0.4 : 0;
    glyphAt(ctx, d.glyph, xx, wob, gr * pulseOf(d.motion, t, xx), spinOf(d.motion, 0, t, xx), a, b);
  }
  glyphAt(ctx, d.glyph, len, 0, w * 0.75 * pulseOf(d.motion, t), spinOf(d.motion, 0, t), a, b);
  ctx.restore();
}

function drawOwnEruption(ctx: CanvasRenderingContext2D, d: OwnDraw, a: string, b: string, x: number, gy: number, r: number, h: number, t: number) {
  if (h <= 1) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, x, gy - h * 0.45, r * 1.5, b, 0.35);
  const gr = ctx.createLinearGradient(0, gy, 0, gy - h);
  gr.addColorStop(0, al(a, 0.7));
  gr.addColorStop(1, al(b, 0));
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, gy);
  ctx.quadraticCurveTo(x - r * 0.4, gy - h * 0.6, x, gy - h);
  ctx.quadraticCurveTo(x + r * 0.4, gy - h * 0.6, x + r * 0.55, gy);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const n = Math.max(2, Math.round(h / (r * 0.95)));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const wob = d.motion === "wobble" ? Math.sin(t * 16 + i) * r * 0.3 : d.trail === "ribbon" ? Math.sin(u * 7 + t * 10) * r * 0.35 : 0;
    glyphAt(ctx, d.glyph, x + wob, gy - u * h, r * 0.48 * (1 - u * 0.35) * pulseOf(d.motion, t, i), spinOf(d.motion, -Math.PI / 2, t, i), a, b);
  }
  ctx.restore();
}

function drawOwnZone(ctx: CanvasRenderingContext2D, d: OwnDraw, a: string, b: string, x: number, gy: number, r: number, alpha: number, t: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const pu = d.motion === "pulse" ? 1 + 0.06 * Math.sin(t * 8) : 1;
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, x, gy - r * 0.35, r * 1.1, b, 0.18);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = al(a, 0.32);
  ctx.strokeStyle = b;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(x, gy + 2, r * pu, 15, 0, 0, TAU); ctx.fill(); ctx.stroke();
  if (d.trail !== "none") {
    ctx.strokeStyle = al(a, 0.7);
    ctx.setLineDash(d.trail === "dots" ? [3, 9] : [14, 10]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.ellipse(x, gy + 2, r * 0.7 * pu, 10, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  const n = 5;
  const speed = d.motion === "spin" ? 1.8 : 0.7;
  for (let i = 0; i < n; i++) {
    const an = t * speed + (i / n) * TAU;
    const bob = Math.sin(t * 3 + i * 1.7) * 8;
    glyphAt(ctx, d.glyph, x + Math.cos(an) * r * 0.8, gy - 34 - Math.sin(an) * 12 + bob, 10 * pulseOf(d.motion, t, i), spinOf(d.motion, -Math.PI / 2, t, i), a, b);
  }
  for (let i = 0; i < 4; i++) {
    const rise = (t * 38 + i * 41) % (r * 1.1);
    ctx.globalAlpha = alpha * (1 - rise / (r * 1.1));
    glyphAt(ctx, d.glyph, x + (noise(i, 3) - 0.5) * r * 1.2, gy - 10 - rise, 5, spinOf(d.motion, -Math.PI / 2, t, i), a, b);
  }
  ctx.restore();
}

function drawOwnRush(ctx: CanvasRenderingContext2D, d: OwnDraw, a: string, b: string, x: number, y: number, s: number, dir: number, t: number) {
  const cy = y - 55 * s;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = al(b, 0.6);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const yy = cy + (i - 2) * 20 * s;
    const l = (50 + noise(i, Math.floor(t * 30)) * 60) * s;
    ctx.moveTo(x - dir * 24 * s, yy); ctx.lineTo(x - dir * (24 * s + l), yy);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.85 - i * 0.2;
    glyphAt(ctx, d.glyph, x - dir * (20 + i * 32) * s, cy, 20 * s * (1 - i * 0.18), spinOf(d.motion, dir > 0 ? 0 : Math.PI, t, i), a, b);
  }
  ctx.globalAlpha = 1;
  glyphAt(ctx, d.glyph, x + dir * 30 * s, cy, 18 * s * pulseOf(d.motion, t), spinOf(d.motion, dir > 0 ? 0 : Math.PI, t), a, b);
  ctx.restore();
}

/** The move firing: a glyph blooming at the hand, a ring of glyphs from the body, a circle at the feet, a sigil in the sky. */
function drawOwnCast(ctx: CanvasRenderingContext2D, d: OwnDraw, fx: Fx, a: string, b: string, s: number, k: number, e: number, fade: number, t: number) {
  const dir = fx.dir;
  ctx.globalAlpha = fade;
  const cast = CAST_AT[d.kind] ?? "hand";
  if (cast === "hand") {
    ctx.strokeStyle = b;
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(dir * 10 * s, 0, 26 * s * e, 0, TAU); ctx.stroke();
    glyphAt(ctx, d.glyph, dir * 16 * s * e, 0, 14 * s * (0.4 + e * 0.8), spinOf(d.motion, dir > 0 ? 0 : Math.PI, t), a, b);
    return;
  }
  if (cast === "sky") {
    const R = 62 * s * (0.5 + e * 0.5);
    ctx.strokeStyle = b;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = al(a, 0.8);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const an = (i / 6) * TAU + t * 1.5;
      glyphAt(ctx, d.glyph, Math.cos(an) * R * 0.85, Math.sin(an) * R * 0.85, 8 * s, an, a, b);
    }
    glyphAt(ctx, d.glyph, 0, 0, 20 * s, spinOf(d.motion, Math.PI / 2, t), a, b);
    return;
  }
  if (cast === "feet") {
    ctx.strokeStyle = b;
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 90 * s * e, 14 * s * e + 2, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const u = (i / 4 - 0.5) * 2;
      glyphAt(ctx, d.glyph, u * 70 * s * e, -30 * s * e * (1 - Math.abs(u) * 0.5), 9 * s, -Math.PI / 2, a, b);
    }
    return;
  }
  // from the body
  if (d.kind === "heal") {
    for (let i = 0; i < 7; i++) {
      const an = (i / 7) * TAU + t * 2;
      glyphAt(ctx, d.glyph, Math.cos(an) * 38 * s, Math.sin(an) * 12 * s - e * 70 * s + 30 * s, 9 * s, -Math.PI / 2, a, b);
    }
    return;
  }
  const reach = d.kind === "burst" ? Math.min(fx.reach || 140 * s, 220 * s) : 70 * s;
  const R = d.kind === "blink" ? reach * (1 - e * 0.7) : reach * e;
  ctx.strokeStyle = b;
  ctx.lineWidth = 5 * (1 - k) + 1;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  const twist = d.burst === "spiral" || d.motion === "spin" ? k * 3 : 0;
  for (let i = 0; i < 8; i++) {
    const an = (i / 8) * TAU + twist;
    glyphAt(ctx, d.glyph, Math.cos(an) * R, Math.sin(an) * R, 12 * s * (1 - k * 0.4), an, a, b);
  }
}

/** The move landing: its glyphs scatter, ring out, spiral, spray up or crack outward. */
function drawOwnHit(ctx: CanvasRenderingContext2D, d: OwnDraw, a: string, b: string, s: number, k: number, e: number, fade: number, seed: number) {
  ctx.globalAlpha = fade;
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, 0, 0, 34 * s * (1 - k * 0.5), b, 0.7);
  ctx.globalCompositeOperation = "source-over";
  switch (d.burst) {
    case "scatter":
      for (let i = 0; i < 6; i++) {
        const an = seed + (i / 6) * TAU + (noise(seed, i) - 0.5) * 0.6;
        const dd = 10 + 46 * s * e;
        glyphAt(ctx, d.glyph, Math.cos(an) * dd, Math.sin(an) * dd, 8 * s * (1 - k * 0.5), an + k * 5, a, b);
      }
      break;
    case "ring": {
      const R = 10 + 52 * s * e;
      ctx.strokeStyle = b;
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) { const an = seed + (i / 8) * TAU; glyphAt(ctx, d.glyph, Math.cos(an) * R, Math.sin(an) * R, 6 * s, an, a, b); }
      break;
    }
    case "spiral":
      for (let i = 0; i < 7; i++) {
        const an = seed + i * 0.9 + e * 3;
        const dd = (8 + i * 8) * s * e * 1.2;
        glyphAt(ctx, d.glyph, Math.cos(an) * dd, Math.sin(an) * dd, 7 * s * (1 - i * 0.07), an, a, b);
      }
      break;
    case "fountain":
      for (let i = 0; i < 6; i++) {
        const vx = (noise(seed, i) - 0.5) * 120 * s, vy = -(90 + noise(seed, i + 9) * 60) * s;
        glyphAt(ctx, d.glyph, vx * k, vy * k + 220 * s * k * k, 8 * s, -Math.PI / 2 + vx * 0.01, a, b);
      }
      break;
    case "crack":
      ctx.strokeStyle = b;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const an = seed + (i / 6) * TAU;
        const L = 50 * s * e, kink = (noise(seed, i) - 0.5) * 0.8;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(an + kink) * L * 0.5, Math.sin(an + kink) * L * 0.5);
        ctx.lineTo(Math.cos(an) * L, Math.sin(an) * L);
      }
      ctx.stroke();
      glyphAt(ctx, d.glyph, 0, 0, 14 * s * (1 - k * 0.3), seed, a, b);
      break;
  }
}
