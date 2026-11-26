// The Story bosses. Each is its own fighter, not a fusion: its own moves (several with mechanics no
// roster fighter has), its own body design drawn by the engine, and its own colours. `id` is only the
// voice and entrance it borrows from the roster.
import type { BossDesign, FighterDef, Move } from "./fighters";
import type { Form } from "./forms";

export type BossId = "nullshade" | "maelstrom" | "magmaw" | "everwinter" | "riftmaker" | "hollowking" | "blacksun" | "axiom" | "lanternmaw" | "sporemother" | "mnemovore" | "dustmoth" | "somnarch" | "hush" | "elderdark" | "perihelion" | "asterion" | "carina" | "vela" | "aeon" | "orogen" | "gnarlroot" | "ambrel";

const M = (m: Omit<Move, "wind" | "act" | "rec"> & Partial<Pick<Move, "wind" | "act" | "rec">>): Move => ({
  wind: 0.2,
  act: 0.12,
  rec: 0.24,
  ...m,
});

export const BOSSES: Record<BossId, FighterDef> = {
  // Chapter 1. Bends antimatter: whatever it touches cancels out.
  nullshade: {
    id: "umbra", boss: "antimatter", name: "Nullshade", power: "Antimatter", role: "control",
    ability: "Commands antimatter. Its field erases shots, and matter meeting antimatter annihilates.",
    color: "hsl(268 40% 16%)", glow: "hsl(186 100% 82%)", hp: 255, speed: 86,
    moves: [
      M({ id: "positron-palm", name: "Positron Palm", kind: "melee", anim: "thrust", range: 74, cd: 0.95, dmg: 9, kb: 260 }),
      M({ id: "antimatter-lance", name: "Antimatter Lance", kind: "beam", anim: "cast", range: 460, minRange: 70, cd: 3, dmg: 13, act: 0.32, wind: 0.32 }),
      M({ id: "annihilation", name: "Annihilation", kind: "annihilate", anim: "raise", range: 520, minRange: 40, cd: 6, dmg: 22, radius: 78, kb: 360, lift: -420, wind: 0.35, rec: 0.35 }),
      M({ id: "null-field", name: "Null Field", kind: "zone", anim: "slam", range: 380, cd: 9, dmg: 5, radius: 130, dur: 4.5, pullIn: 90, erase: true, wind: 0.35 }),
      M({ id: "pair-burst", name: "Pair Production", kind: "projectile", anim: "thrust", range: 560, minRange: 90, cd: 2.6, dmg: 6, speed: 520, size: 10, count: 2, spread: 0.16, shape: "orb" }),
      M({ id: "zero-point", name: "Zero Point", kind: "burst", anim: "slam", range: 130, cd: 7, dmg: 15, radius: 160, kb: 480, lift: -300, wind: 0.32, rec: 0.35 }),
    ],
  },
  // Chapter 2. A storm at sea given a body.
  maelstrom: {
    id: "hydro", boss: "maelstrom", name: "Maelstrom", power: "Tempest Sea", role: "attacker",
    ability: "A living sea storm. Walls of water roll across the whole arena, and its whirlpool drags everyone in.",
    color: "hsl(204 70% 30%)", glow: "hsl(186 100% 76%)", hp: 280, speed: 94,
    moves: [
      M({ id: "trident-rake", name: "Trident Rake", kind: "melee", anim: "lunge", range: 96, cd: 1, dmg: 9, kb: 240, status: "stun", statusDur: 0.2 }),
      M({ id: "tidal-wall", name: "Tidal Wall", kind: "projectile", anim: "slam", range: 900, minRange: 60, cd: 7, dmg: 16, speed: 330, size: 34, pierce: true, ground: true, shape: "wave", kb: 420, lift: -360, wind: 0.4, rec: 0.35 }),
      M({ id: "eye-of-the-storm", name: "Eye of the Storm", kind: "zone", anim: "raise", range: 420, cd: 9, dmg: 6, radius: 140, dur: 4, pullIn: 130, status: "stun", statusDur: 0.12, wind: 0.35 }),
      M({ id: "thunderhead", name: "Thunderhead", kind: "rain", anim: "raise", range: 520, cd: 5.5, dmg: 7, count: 7, radius: 160, status: "stun", statusDur: 0.25, wind: 0.35, rec: 0.3 }),
      M({ id: "riptide", name: "Riptide", kind: "pull", anim: "thrust", range: 420, minRange: 120, cd: 4.5, dmg: 7, wind: 0.24 }),
      M({ id: "waterspout", name: "Waterspout", kind: "eruption", anim: "uppercut", range: 460, minRange: 50, cd: 4.5, dmg: 13, radius: 52, lift: -820, wind: 0.32 }),
    ],
  },
  // Chapter 3. A walking volcano with a mouth of magma.
  magmaw: {
    id: "terra", boss: "magmaw", name: "Magmaw", power: "Living Volcano", role: "tank",
    ability: "A walking volcano. The floor splits into fault lines and the sky rains molten rock.",
    color: "hsl(12 30% 20%)", glow: "hsl(28 100% 58%)", hp: 266, speed: 74,
    moves: [
      M({ id: "magma-bite", name: "Magma Bite", kind: "melee", anim: "lunge", range: 88, cd: 1.3, dmg: 13, kb: 340, status: "burn", statusDur: 1.5, wind: 0.26 }),
      M({ id: "fault-line", name: "Fault Line", kind: "eruption", anim: "slam", range: 600, minRange: 40, cd: 6, dmg: 12, radius: 46, count: 4, lift: -640, status: "burn", statusDur: 1.5, wind: 0.4 }),
      M({ id: "lava-bombs", name: "Lava Bombs", kind: "rain", anim: "raise", range: 540, cd: 5.5, dmg: 9, count: 5, radius: 150, size: 13, shape: "rock", status: "burn", statusDur: 2, wind: 0.4, rec: 0.3 }),
      M({ id: "magma-lake", name: "Magma Lake", kind: "zone", anim: "slam", range: 360, cd: 9, dmg: 7, radius: 120, dur: 4, status: "burn", statusDur: 0.6, wind: 0.35 }),
      M({ id: "volcanic-roar", name: "Volcanic Roar", kind: "burst", anim: "raise", range: 150, cd: 6.5, dmg: 16, radius: 175, kb: 440, lift: -380, status: "burn", statusDur: 2.5, wind: 0.36, rec: 0.38 }),
      M({ id: "obsidian-hide", name: "Obsidian Hide", kind: "heal", anim: "raise", range: 2000, cd: 14, dmg: 0, heal: 30, below: 0.5, wind: 0.4 }),
    ],
  },
  // Chapter 4. The winter that stopped the clocks.
  everwinter: {
    id: "cryo", boss: "everwinter", name: "Everwinter", power: "Frozen Time", role: "control",
    ability: "The winter that stopped time. It can freeze the whole arena in one moment and strike while nothing moves.",
    color: "hsl(206 50% 82%)", glow: "hsl(44 90% 72%)", hp: 331, speed: 86,
    moves: [
      M({ id: "rime-sickle", name: "Rime Sickle", kind: "melee", anim: "spin", range: 84, cd: 1, dmg: 9, kb: 200, status: "slow", statusDur: 1.2 }),
      M({ id: "time-stop", name: "Time Stop", kind: "burst", anim: "raise", range: 2000, cd: 13, dmg: 6, radius: 60, world: true, status: "freeze", statusDur: 1.7, wind: 0.5, rec: 0.2 }),
      M({ id: "hourglass-icicles", name: "Hourglass Icicles", kind: "rain", anim: "raise", range: 520, cd: 5, dmg: 8, count: 6, radius: 140, shape: "shard", status: "slow", statusDur: 1.2, wind: 0.35, rec: 0.3 }),
      M({ id: "frost-lance", name: "Frost Lance", kind: "beam", anim: "thrust", range: 440, minRange: 70, cd: 3, dmg: 12, act: 0.3, status: "slow", statusDur: 1.4, wind: 0.28 }),
      M({ id: "rime-step", name: "Rime Step", kind: "blink", anim: "kick", range: 480, minRange: 140, cd: 4.5, dmg: 11, kb: 300, status: "freeze", statusDur: 0.6 }),
      M({ id: "glacial-age", name: "Glacial Age", kind: "zone", anim: "slam", range: 360, cd: 9, dmg: 5, radius: 140, dur: 4.5, status: "slow", statusDur: 0.6, wind: 0.35 }),
    ],
  },
  // Chapter 5. Bends reality: it can move the whole fight to the Moon, the desert, a galaxy, the open universe or a nebula.
  riftmaker: {
    id: "psy", boss: "riftmaker", name: "The Riftmaker", power: "Reality Warping", role: "trickster",
    ability: "Rewrites reality. It moves the whole fight to the Moon or the open Universe, where everyone floats, a scorching desert that burns its enemies, a galaxy whose shooting stars rain on them, or a nebula whose gas slows and blinds them.",
    color: "hsl(252 30% 12%)", glow: "hsl(318 100% 72%)", hp: 320, speed: 98,
    moves: [
      M({ id: "fold-strike", name: "Fold Strike", kind: "melee", anim: "jab", range: 76, cd: 0.9, dmg: 9, kb: 220 }),
      M({ id: "reality-warp", name: "Reality Warp", kind: "warp", anim: "raise", range: 2000, cd: 15, dmg: 0, wind: 0.55, rec: 0.3 }),
      M({ id: "dimension-tear", name: "Dimension Tear", kind: "beam", anim: "cast", range: 480, minRange: 70, cd: 3.2, dmg: 14, act: 0.34, wind: 0.3 }),
      M({ id: "fold-space", name: "Fold Space", kind: "blink", anim: "uppercut", range: 520, minRange: 140, cd: 4, dmg: 12, lift: -560, kb: 160 }),
      M({ id: "mirror-shards", name: "Mirror Shards", kind: "projectile", anim: "cast", range: 580, minRange: 80, cd: 2.4, dmg: 5, speed: 640, size: 9, count: 4, spread: 0.2, shape: "shard" }),
      M({ id: "unmake", name: "Unmake", kind: "burst", anim: "slam", range: 140, cd: 7, dmg: 17, radius: 165, kb: 460, lift: -320, status: "blind", statusDur: 1.5, wind: 0.34, rec: 0.36 }),
    ],
  },
  // Chapter 6. A crowned reaper that feeds on souls: most of what it lands gives it health back.
  hollowking: {
    id: "umbra", boss: "hollow", name: "The Hollow King", power: "Soul Reaping", role: "attacker",
    ability: "Reaps souls. Its scythe and its graveyard drain health back into it, and Soul Harvest tears a soul out of every enemy at once.",
    color: "hsl(170 14% 16%)", glow: "hsl(152 92% 64%)", hp: 450, speed: 90,
    moves: [
      M({ id: "reaper-scythe", name: "Reaper's Scythe", kind: "melee", anim: "spin", range: 100, cd: 1.05, dmg: 10, kb: 260, heal: 3, wind: 0.22 }),
      M({ id: "soul-chains", name: "Soul Chains", kind: "pull", anim: "thrust", range: 440, minRange: 120, cd: 4.5, dmg: 7, status: "slow", statusDur: 1.2, wind: 0.24 }),
      M({ id: "grave-hands", name: "Grave Hands", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 5.5, dmg: 11, radius: 44, count: 3, lift: -520, status: "stun", statusDur: 0.35, wind: 0.36 }),
      M({ id: "wailing-souls", name: "Wailing Souls", kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 2.8, dmg: 6, speed: 430, size: 11, count: 3, spread: 0.22, status: "blind", statusDur: 1 }),
      M({ id: "graveyard", name: "Graveyard", kind: "zone", anim: "raise", range: 380, cd: 9, dmg: 6, radius: 130, dur: 4.5, heal: 2, status: "slow", statusDur: 0.6, wind: 0.35 }),
      M({ id: "soul-harvest", name: "Soul Harvest", kind: "burst", anim: "raise", range: 2000, cd: 12, dmg: 9, heal: 6, harvest: true, wind: 0.5, rec: 0.3 }),
    ],
  },
  // Chapter 7. A sun gone dark: its corona burns, and Total Eclipse plunges the arena into night.
  blacksun: {
    id: "lux", boss: "blacksun", name: "The Black Sun", power: "Eclipse", role: "control",
    ability: "A sun swallowed by its own shadow. Solar flares burn, and Total Eclipse blacks out the sky so its enemies swing blind.",
    color: "hsl(30 30% 10%)", glow: "hsl(40 100% 64%)", hp: 420, speed: 92,
    moves: [
      M({ id: "corona-edge", name: "Corona Edge", kind: "melee", anim: "kick", range: 82, cd: 0.95, dmg: 10, kb: 240, status: "burn", statusDur: 1.2 }),
      M({ id: "solar-flare", name: "Solar Flare", kind: "beam", anim: "cast", range: 500, minRange: 70, cd: 3.2, dmg: 14, act: 0.34, status: "burn", statusDur: 1.5, wind: 0.32 }),
      M({ id: "sunspot-rain", name: "Sunspot Rain", kind: "rain", anim: "raise", range: 540, cd: 5.5, dmg: 8, count: 6, radius: 160, size: 12, status: "burn", statusDur: 1.5, wind: 0.35, rec: 0.3 }),
      M({ id: "eclipse-disc", name: "Eclipse Disc", kind: "projectile", anim: "thrust", range: 620, minRange: 90, cd: 3.4, dmg: 11, speed: 460, size: 16, pierce: true, shape: "disc", status: "blind", statusDur: 1.2 }),
      M({ id: "prominence", name: "Prominence", kind: "eruption", anim: "uppercut", range: 480, minRange: 50, cd: 4.8, dmg: 13, radius: 50, lift: -720, status: "burn", statusDur: 2, wind: 0.34 }),
      M({ id: "total-eclipse", name: "Total Eclipse", kind: "burst", anim: "raise", range: 2000, cd: 14, dmg: 6, eclipse: true, status: "blind", statusDur: 4, wind: 0.55, rec: 0.3 }),
    ],
  },
  // Chapter 8. The cosmos given a will: it rewrites reality more often than the Riftmaker, and its Event Horizon swallows shots whole.
  axiom: {
    id: "gravi", boss: "axiom", name: "The Axiom", power: "Cosmic Reality Warping", role: "control",
    ability: "The cosmos given a will. It rewrites reality more often than the Riftmaker ever could, folds galaxies into its fists, rains stars on its enemies and its Event Horizon swallows shots whole.",
    color: "hsl(236 55% 11%)", glow: "hsl(272 100% 80%)", hp: 480, speed: 96,
    moves: [
      M({ id: "galaxy-fist", name: "Galaxy Fist", kind: "melee", anim: "jab", range: 80, cd: 0.9, dmg: 10, kb: 260 }),
      M({ id: "cosmic-rewrite", name: "Cosmic Rewrite", kind: "warp", anim: "raise", range: 2000, cd: 12, dmg: 0, wind: 0.5, rec: 0.3 }),
      M({ id: "cosmic-string", name: "Cosmic String", kind: "beam", anim: "cast", range: 520, minRange: 70, cd: 3.2, dmg: 14, act: 0.36, kb: 220, wind: 0.3 }),
      M({ id: "star-shower", name: "Star Shower", kind: "rain", anim: "raise", range: 560, cd: 5.5, dmg: 8, count: 8, radius: 180, size: 11, shape: "shard", wind: 0.35, rec: 0.3 }),
      M({ id: "event-horizon", name: "Event Horizon", kind: "zone", anim: "slam", range: 400, cd: 9, dmg: 6, radius: 140, dur: 4.5, pullIn: 160, erase: true, status: "slow", statusDur: 0.6, wind: 0.35 }),
      M({ id: "wormhole-step", name: "Wormhole Step", kind: "blink", anim: "kick", range: 540, minRange: 130, cd: 4, dmg: 12, kb: 300, lift: -320 }),
    ],
  },
  // Book 2, chapter 1. The first herald of the Elder Dark: a deep-sea thing in a robe, a lure of sickly light
  // hanging over its face. Its light reels enemies in and blinds them, and tentacles rise out of the floor.
  lanternmaw: {
    id: "psy", boss: "lanternmaw", name: "The Lanternmaw", power: "Abyssal Lure", role: "control",
    ability: "A herald of the Elder Dark that swam up from below the sea. Its lure reels enemies in and blinds them, and the deep answers its call with tentacles and crushing pressure.",
    color: "hsl(196 48% 11%)", glow: "hsl(66 100% 64%)", hp: 470, speed: 90,
    moves: [
      M({ id: "hook-rake", name: "Hook Rake", kind: "melee", anim: "lunge", range: 92, cd: 1, dmg: 10, kb: 240, status: "stun", statusDur: 0.2 }),
      M({ id: "lure-light", name: "Lure Light", kind: "pull", anim: "cast", range: 460, minRange: 110, cd: 4.5, dmg: 8, status: "blind", statusDur: 0.8, wind: 0.26 }),
      M({ id: "abyssal-coil", name: "Abyssal Coil", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 5.5, dmg: 11, radius: 44, count: 3, lift: -560, status: "slow", statusDur: 1.2, wind: 0.36 }),
      M({ id: "drowned-whispers", name: "Drowned Whispers", kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 2.8, dmg: 6, speed: 420, size: 11, count: 3, spread: 0.24, shape: "orb", status: "blind", statusDur: 0.8 }),
      M({ id: "lantern-gaze", name: "Lantern Gaze", kind: "beam", anim: "thrust", range: 500, minRange: 70, cd: 3.4, dmg: 14, act: 0.34, status: "blind", statusDur: 1, wind: 0.32 }),
      M({ id: "crushing-deep", name: "Crushing Deep", kind: "zone", anim: "slam", range: 400, cd: 9, dmg: 6, radius: 140, dur: 4.5, pullIn: 140, status: "slow", statusDur: 0.6, wind: 0.36 }),
    ],
  },
  // Book 2, chapter 2. The second herald: a fungal hive grown out of a drowned forest, one mind singing
  // through a thousand mouths. Its spores poison, its roots drag you in, and its song stops you dead.
  sporemother: {
    id: "toxi", boss: "sporemother", name: "The Sporemother", power: "Hive Bloom", role: "control",
    ability: "A fungal hive that grew out of the Elder Dark's first crack. Its spores poison, its roots drag enemies in, and everything it infects joins its song.",
    color: "hsl(318 26% 17%)", glow: "hsl(170 100% 64%)", hp: 500, speed: 84,
    moves: [
      M({ id: "spore-lash", name: "Spore Lash", kind: "melee", anim: "lunge", range: 96, cd: 1, dmg: 10, kb: 220, status: "poison", statusDur: 2 }),
      M({ id: "choir-spores", name: "Choir Spores", kind: "projectile", anim: "cast", range: 560, minRange: 80, cd: 2.6, dmg: 5, speed: 380, size: 11, count: 4, spread: 0.3, shape: "orb", status: "poison", statusDur: 2 }),
      M({ id: "root-snare", name: "Root Snare", kind: "pull", anim: "slam", range: 460, minRange: 110, cd: 4.5, dmg: 8, status: "slow", statusDur: 1.2, wind: 0.28 }),
      M({ id: "mycelium-bloom", name: "Mycelium Bloom", kind: "eruption", anim: "raise", range: 540, minRange: 40, cd: 5.5, dmg: 11, radius: 46, count: 3, lift: -520, status: "poison", statusDur: 2.5, wind: 0.36 }),
      M({ id: "hive-song", name: "Hive Song", kind: "burst", anim: "raise", range: 150, cd: 6.5, dmg: 12, radius: 160, kb: 300, status: "stun", statusDur: 0.6, wind: 0.34 }),
      M({ id: "rot-garden", name: "Rot Garden", kind: "zone", anim: "slam", range: 400, cd: 9, dmg: 6, radius: 140, dur: 5, status: "poison", statusDur: 1.5, wind: 0.36 }),
    ],
  },
  // Book 2, chapter 3. The third herald: a tall, faceless thing that eats memories. Whatever it touches forgets
  // how to move, how to aim, and finally who it is. It steps out of the places people forgot.
  mnemovore: {
    id: "chrono", boss: "mnemovore", name: "The Mnemovore", power: "Memory Eating", role: "trickster",
    ability: "A herald of the Elder Dark that feeds on memories. Its touch makes enemies forget how to move, it steps out of forgotten places, and every memory it eats makes it stronger.",
    color: "hsl(262 18% 20%)", glow: "hsl(300 100% 82%)", hp: 530, speed: 96,
    moves: [
      M({ id: "forget-touch", name: "Forgetting Touch", kind: "melee", anim: "thrust", range: 84, cd: 0.95, dmg: 10, kb: 200, status: "stun", statusDur: 0.3 }),
      M({ id: "stolen-moments", name: "Stolen Moments", kind: "projectile", anim: "cast", range: 580, minRange: 90, cd: 2.4, dmg: 6, speed: 560, size: 10, count: 3, spread: 0.18, shape: "shard", status: "slow", statusDur: 1 }),
      M({ id: "unremember", name: "Unremember", kind: "blink", anim: "kick", range: 560, minRange: 130, cd: 4, dmg: 13, kb: 300, lift: -300 }),
      M({ id: "fade-ray", name: "Fade Ray", kind: "beam", anim: "thrust", range: 520, minRange: 70, cd: 3.4, dmg: 13, act: 0.32, status: "slow", statusDur: 1.2, wind: 0.32 }),
      M({ id: "memory-sink", name: "Memory Sink", kind: "zone", anim: "cast", range: 400, cd: 9, dmg: 6, radius: 130, dur: 4.5, pullIn: 160, status: "slow", statusDur: 0.6, wind: 0.34 }),
      M({ id: "blank-page", name: "Blank Page", kind: "burst", anim: "raise", range: 150, cd: 7, dmg: 13, radius: 170, kb: 360, status: "stun", statusDur: 0.5, wind: 0.34 }),
    ],
  },
  // Book 2, chapter 4. The fourth herald: a moth the size of a cathedral that came to eat the moon. The dust off
  // its wings blinds, its wingbeats throw whole crowds, and the eyes on its wings stop you where you stand.
  dustmoth: {
    id: "aero", boss: "dustmoth", name: "The Dustmoth", power: "Void Dust", role: "control",
    ability: "A herald of the Elder Dark that flew in from the space between stars to eat the moon. The dust off its wings blinds, its wingbeats throw crowds aside, and the eyes on its wings hold you still.",
    color: "hsl(32 12% 22%)", glow: "hsl(208 100% 84%)", hp: 560, speed: 92,
    moves: [
      M({ id: "wing-cut", name: "Wing Cut", kind: "melee", anim: "spin", range: 98, cd: 1, dmg: 11, kb: 260, status: "blind", statusDur: 0.4 }),
      M({ id: "moon-dust", name: "Moon Dust", kind: "projectile", anim: "cast", range: 580, minRange: 80, cd: 2.6, dmg: 5, speed: 460, size: 10, count: 4, spread: 0.26, shape: "orb", status: "blind", statusDur: 0.8 }),
      M({ id: "ash-gale", name: "Ash Gale", kind: "dash", anim: "lunge", range: 520, minRange: 90, cd: 4.5, dmg: 13, kb: 360, lift: -240, wind: 0.3 }),
      M({ id: "wingbeat", name: "Wingbeat", kind: "burst", anim: "raise", range: 160, cd: 6, dmg: 13, radius: 180, kb: 520, lift: -360, wind: 0.32 }),
      M({ id: "dust-fall", name: "Dust Fall", kind: "rain", anim: "raise", range: 540, cd: 5.5, dmg: 7, count: 7, radius: 170, size: 9, status: "blind", statusDur: 0.6, wind: 0.34 }),
      M({ id: "moth-swarm", name: "Moth Swarm", kind: "zone", anim: "cast", range: 400, cd: 9, dmg: 6, radius: 140, dur: 4.5, status: "blind", statusDur: 0.6, wind: 0.36 }),
    ],
  },
  // Book 2, chapter 5. The fifth herald: a giant that has slept since before the world, and whose dreams leak out
  // over the valley it lies under. Its lullaby slows you, its dreams knock you out, and it walks through sleep itself.
  somnarch: {
    id: "psy", boss: "somnarch", name: "The Somnarch", power: "Endless Sleep", role: "control",
    ability: "A herald of the Elder Dark that has slept under the valley since before the first dawn. Its lullaby slows enemies, its dreams knock them out, and it steps through sleep from one place to another.",
    color: "hsl(250 34% 18%)", glow: "hsl(46 100% 72%)", hp: 580, speed: 86,
    moves: [
      M({ id: "lullaby-touch", name: "Lullaby Touch", kind: "melee", anim: "thrust", range: 92, cd: 1, dmg: 11, kb: 220, status: "slow", statusDur: 1.2 }),
      M({ id: "dream-motes", name: "Dream Motes", kind: "projectile", anim: "cast", range: 580, minRange: 80, cd: 2.5, dmg: 6, speed: 420, size: 11, count: 4, spread: 0.28, shape: "orb", status: "slow", statusDur: 1 }),
      M({ id: "sleepwalk", name: "Sleepwalk", kind: "blink", anim: "kick", range: 560, minRange: 130, cd: 4.2, dmg: 13, kb: 300, lift: -280 }),
      M({ id: "dream-spiral", name: "Dream Spiral", kind: "beam", anim: "thrust", range: 520, minRange: 70, cd: 3.6, dmg: 13, act: 0.34, status: "stun", statusDur: 0.4, wind: 0.32 }),
      M({ id: "drowse-wave", name: "Drowse Wave", kind: "burst", anim: "raise", range: 160, cd: 6.5, dmg: 13, radius: 170, kb: 320, status: "stun", statusDur: 0.6, wind: 0.34 }),
      M({ id: "deep-sleep", name: "Deep Sleep", kind: "zone", anim: "cast", range: 400, cd: 9, dmg: 6, radius: 140, dur: 4.5, pullIn: 150, status: "slow", statusDur: 0.8, wind: 0.36 }),
    ],
  },
  // Book 2, chapter 6. The sixth herald: a veiled thing with a cracked bell for a head that eats every sound in the
  // world. Where it walks the bells stop, voices fail, and its silence hits like a wall.
  hush: {
    id: "sono", boss: "hush", name: "The Hush", power: "Unsound", role: "attacker",
    ability: "A herald of the Elder Dark that eats sound. Its touch steals your breath, its silent tolls knock you off your feet, and when it rings its cracked bell, nothing near it can move.",
    color: "hsl(350 14% 10%)", glow: "hsl(354 90% 66%)", hp: 600, speed: 98,
    moves: [
      M({ id: "muffle", name: "Muffle", kind: "melee", anim: "jab", range: 86, cd: 0.9, dmg: 11, kb: 200, status: "stun", statusDur: 0.3 }),
      M({ id: "silent-toll", name: "Silent Toll", kind: "projectile", anim: "thrust", range: 580, minRange: 90, cd: 2.4, dmg: 8, speed: 520, size: 14, count: 2, spread: 0.14, shape: "disc", kb: 200 }),
      M({ id: "unring", name: "Unring", kind: "pull", anim: "cast", range: 480, minRange: 110, cd: 4.5, dmg: 9, status: "stun", statusDur: 0.4, wind: 0.26 }),
      M({ id: "cracked-peal", name: "Cracked Peal", kind: "beam", anim: "thrust", range: 540, minRange: 70, cd: 3.4, dmg: 14, act: 0.32, status: "slow", statusDur: 1.2, wind: 0.32 }),
      M({ id: "the-quiet", name: "The Quiet", kind: "burst", anim: "slam", range: 160, cd: 6.5, dmg: 14, radius: 170, kb: 380, lift: -260, status: "stun", statusDur: 0.6, wind: 0.34 }),
      M({ id: "hush-dead-air", name: "Dead Air", kind: "zone", anim: "raise", range: 400, cd: 9, dmg: 6, radius: 140, dur: 4.5, status: "slow", statusDur: 0.8, wind: 0.36 }),
    ],
  },
  // Book 2, chapter 7. The Elder Dark itself: the shape in the stars, older than light. A crown of dead stars, a
  // cluster of eyes where a face should be, and arms of starless night. Every herald was one of its fingers.
  elderdark: {
    id: "umbra", boss: "elderdark", name: "The Elder Dark", power: "The Dark Before Stars", role: "control",
    ability: "The ancient evil behind every herald, older than the first star. Its arms of night drag enemies in, its eyes burn whatever they look at, and the dead stars in its crown fall like rain.",
    color: "hsl(262 40% 8%)", glow: "hsl(268 100% 78%)", hp: 680, speed: 90,
    moves: [
      M({ id: "void-tendril", name: "Void Tendril", kind: "melee", anim: "lunge", range: 110, cd: 1, dmg: 12, kb: 260, status: "slow", statusDur: 1 }),
      M({ id: "dead-stars", name: "Dead Stars", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 2.4, dmg: 6, speed: 480, size: 11, count: 5, spread: 0.3, shape: "orb", status: "blind", statusDur: 0.5 }),
      M({ id: "abyssal-pull", name: "Abyssal Pull", kind: "pull", anim: "slam", range: 500, minRange: 100, cd: 4.2, dmg: 10, status: "slow", statusDur: 1.2, wind: 0.26 }),
      M({ id: "unmaking-eye", name: "Unmaking Eye", kind: "beam", anim: "thrust", range: 560, minRange: 70, cd: 3.4, dmg: 15, act: 0.34, status: "stun", statusDur: 0.4, wind: 0.32 }),
      M({ id: "first-dark", name: "The First Dark", kind: "burst", anim: "raise", range: 160, cd: 6.5, dmg: 14, radius: 180, kb: 400, lift: -300, status: "blind", statusDur: 0.8, wind: 0.34 }),
      M({ id: "night-tide", name: "Night Tide", kind: "zone", anim: "cast", range: 420, cd: 9, dmg: 7, radius: 150, dur: 5, pullIn: 180, status: "slow", statusDur: 0.8, wind: 0.36 }),
    ],
  },
  // Book 3, chapter 1. The first of the Celestials: a living comet, a head of white fire on a body of old ice, its
  // tail streaming behind it. It falls on the north like a judgement, and everything it touches burns cold.
  perihelion: {
    id: "cryo", boss: "perihelion", name: "Perihelion", power: "Comet Fire", role: "attacker",
    ability: "A Celestial: a living comet older than the world, sent down to put the bright world back in its place. Its tail burns cold, its shards freeze you in place, and it dives on its enemies like a falling star.",
    color: "hsl(212 40% 22%)", glow: "hsl(190 100% 80%)", hp: 620, speed: 100,
    moves: [
      M({ id: "tail-lash", name: "Tail Lash", kind: "melee", anim: "spin", range: 100, cd: 1, dmg: 12, kb: 260, status: "burn", statusDur: 1 }),
      M({ id: "coma-shards", name: "Coma Shards", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 2.5, dmg: 6, speed: 560, size: 10, count: 4, spread: 0.26, shape: "shard", status: "slow", statusDur: 0.8 }),
      M({ id: "comet-dive", name: "Comet Dive", kind: "dash", anim: "lunge", range: 560, minRange: 90, cd: 4.4, dmg: 14, kb: 380, lift: -260, status: "burn", statusDur: 1, wind: 0.3 }),
      M({ id: "tailfire-ray", name: "Tailfire Ray", kind: "beam", anim: "thrust", range: 560, minRange: 70, cd: 3.4, dmg: 14, act: 0.34, status: "burn", statusDur: 1.2, wind: 0.32 }),
      M({ id: "meteor-shower", name: "Meteor Shower", kind: "rain", anim: "raise", range: 560, cd: 5.5, dmg: 8, count: 7, radius: 180, size: 10, status: "burn", statusDur: 0.8, wind: 0.34 }),
      M({ id: "nucleus-flare", name: "Nucleus Flare", kind: "burst", anim: "slam", range: 160, cd: 6.5, dmg: 14, radius: 175, kb: 440, lift: -300, status: "slow", statusDur: 0.8, wind: 0.34 }),
    ],
  },
  // Book 3, chapter 2. The second Celestial: the Hunter, a giant drawn in stars and the lines between them. It has
  // hunted across the sky since before the first sunrise, and now it has come down to hunt the ones who beat the Dark.
  asterion: {
    id: "lux", boss: "asterion", name: "Asterion", power: "Constellation", role: "attacker",
    ability: "A Celestial: the Hunter in the stars, a giant made of starlight and the lines that join it. Its spear pins you, its arrows never miss, and it steps from star to star faster than you can turn.",
    color: "hsl(232 44% 14%)", glow: "hsl(44 100% 74%)", hp: 640, speed: 104,
    moves: [
      M({ id: "star-spear", name: "Star Spear", kind: "melee", anim: "lunge", range: 112, cd: 1, dmg: 12, kb: 280, status: "stun", statusDur: 0.25 }),
      M({ id: "starshot", name: "Starshot", kind: "projectile", anim: "thrust", range: 640, minRange: 90, cd: 2.3, dmg: 8, speed: 720, size: 10, count: 3, spread: 0.12, shape: "blade" }),
      M({ id: "star-to-star", name: "Star to Star", kind: "blink", anim: "kick", range: 580, minRange: 130, cd: 4, dmg: 14, kb: 320, lift: -260 }),
      M({ id: "line-of-stars", name: "Line of Stars", kind: "beam", anim: "thrust", range: 580, minRange: 70, cd: 3.4, dmg: 14, act: 0.32, status: "stun", statusDur: 0.4, wind: 0.32 }),
      M({ id: "shooting-stars", name: "Shooting Stars", kind: "rain", anim: "raise", range: 560, cd: 5.5, dmg: 8, count: 7, radius: 180, size: 10, status: "blind", statusDur: 0.5, wind: 0.34 }),
      M({ id: "star-chart", name: "Star Chart", kind: "zone", anim: "slam", range: 420, cd: 9, dmg: 6, radius: 145, dur: 4.5, pullIn: 140, status: "slow", statusDur: 0.8, wind: 0.36 }),
    ],
  },
  // Book 3, chapter 3. The third Celestial: the Star Mother, a nebula so vast that new stars are born inside her.
  // She has come down to draw her cloud over the world, so that her own children are the only lights left.
  carina: {
    id: "vita", boss: "carina", name: "Carina", power: "Nebula", role: "attacker",
    ability: "A Celestial: the Star Mother, a cloud of rose and green gas where new stars are born. Her veil blinds and chokes, her newborn stars burn, and her nursery pulls you into the cloud.",
    color: "hsl(300 34% 16%)", glow: "hsl(326 100% 76%)", hp: 650, speed: 98,
    moves: [
      M({ id: "veil-lash", name: "Veil Lash", kind: "melee", anim: "spin", range: 108, cd: 1, dmg: 12, kb: 260, status: "poison", statusDur: 1 }),
      M({ id: "newborn-stars", name: "Newborn Stars", kind: "projectile", anim: "cast", range: 620, minRange: 80, cd: 2.5, dmg: 6, speed: 520, size: 11, count: 5, spread: 0.34, shape: "orb", status: "burn", statusDur: 0.8 }),
      M({ id: "through-the-veil", name: "Through the Veil", kind: "blink", anim: "kick", range: 560, minRange: 130, cd: 4.2, dmg: 13, kb: 300, lift: -240, status: "blind", statusDur: 0.4 }),
      M({ id: "birthlight", name: "Birthlight", kind: "beam", anim: "thrust", range: 560, minRange: 70, cd: 3.4, dmg: 14, act: 0.34, status: "blind", statusDur: 0.5, wind: 0.32 }),
      M({ id: "stardust-fall", name: "Stardust Fall", kind: "rain", anim: "raise", range: 560, cd: 5.5, dmg: 8, count: 7, radius: 180, size: 10, status: "poison", statusDur: 1, wind: 0.34 }),
      M({ id: "the-nursery", name: "The Nursery", kind: "zone", anim: "slam", range: 420, cd: 9, dmg: 6, radius: 150, dur: 4.5, pullIn: 150, status: "slow", statusDur: 0.8, wind: 0.36 }),
    ],
  },
  // Book 3, chapter 4. The fourth Celestial: a pulsar, the first star that ever burned out. Its heart crushed to the
  // size of a city, it spins a hundred times a heartbeat and keeps the time of the whole sky. Its beams turn sand to glass.
  vela: {
    id: "magneto", boss: "vela", name: "Vela", power: "Pulse", role: "attacker",
    ability: "A Celestial: a dead star that never stopped spinning, the clock of the sky. Two beams sweep out from its poles like a lighthouse, its field drags iron and bone alike, and every hit lands on the beat.",
    color: "hsl(250 22% 14%)", glow: "hsl(32 100% 66%)", hp: 660, speed: 102,
    moves: [
      M({ id: "pulse-strike", name: "Pulse Strike", kind: "melee", anim: "jab", range: 100, cd: 0.9, dmg: 11, kb: 240, status: "stun", statusDur: 0.2 }),
      M({ id: "tick-shots", name: "Tick Shots", kind: "projectile", anim: "thrust", range: 640, minRange: 90, cd: 2.2, dmg: 6, speed: 760, size: 9, count: 4, spread: 0.1, shape: "disc" }),
      M({ id: "spin-rush", name: "Spin Rush", kind: "dash", anim: "spin", range: 560, minRange: 90, cd: 4.4, dmg: 14, kb: 380, lift: -240, wind: 0.3 }),
      M({ id: "lighthouse-beam", name: "Lighthouse Beam", kind: "beam", anim: "thrust", range: 600, minRange: 70, cd: 3.4, dmg: 14, act: 0.36, status: "burn", statusDur: 1, wind: 0.32 }),
      M({ id: "glass-rain", name: "Glass Rain", kind: "rain", anim: "raise", range: 560, cd: 5.5, dmg: 8, count: 7, radius: 180, size: 10, status: "slow", statusDur: 0.8, wind: 0.34 }),
      M({ id: "magnetic-pole", name: "Magnetic Pole", kind: "pull", anim: "cast", range: 520, minRange: 110, cd: 5, dmg: 9, status: "stun", statusDur: 0.35, wind: 0.26 }),
    ],
  },  // Book 3, chapter 5. The fifth and oldest Celestial: Aeon, the first star that ever burned. It lit the sky, drove
  // the Dark out of it, and then sat watching for an age. Now it has opened its eye, and it does not like the light below.
  aeon: {
    id: "lux", boss: "aeon", name: "Aeon", power: "The First Light", role: "attacker",
    ability: "A Celestial: the first star, older than every other light in the sky, with one great eye of white fire. Its halo cuts, the first stars it ever made still answer its call, and it can cross the arena at the speed of light.",
    color: "hsl(42 34% 84%)", glow: "hsl(46 100% 66%)", hp: 700, speed: 100,
    moves: [
      M({ id: "halo-strike", name: "Halo Strike", kind: "melee", anim: "spin", range: 110, cd: 1, dmg: 12, kb: 260, status: "blind", statusDur: 0.3 }),
      M({ id: "first-stars", name: "The First Stars", kind: "projectile", anim: "cast", range: 640, minRange: 80, cd: 2.4, dmg: 6, speed: 600, size: 10, count: 6, spread: 0.36, shape: "orb", status: "burn", statusDur: 0.8 }),
      M({ id: "light-years", name: "Light Years", kind: "blink", anim: "kick", range: 580, minRange: 130, cd: 4, dmg: 13, kb: 320, lift: -260, status: "blind", statusDur: 0.4 }),
      M({ id: "eye-of-the-sky", name: "Eye of the Sky", kind: "beam", anim: "thrust", range: 620, minRange: 70, cd: 3.3, dmg: 15, act: 0.36, status: "burn", statusDur: 1, wind: 0.32 }),
      M({ id: "rain-of-ages", name: "Rain of Ages", kind: "rain", anim: "raise", range: 560, cd: 5.4, dmg: 8, count: 8, radius: 190, size: 10, status: "burn", statusDur: 0.8, wind: 0.34 }),
      M({ id: "the-old-orbit", name: "The Old Orbit", kind: "zone", anim: "slam", range: 420, cd: 9, dmg: 6, radius: 150, dur: 4.5, pullIn: 160, status: "slow", statusDur: 0.8, wind: 0.36 }),
    ],
  },
  // Book 4, chapter 1. The first Titan: a mountain range that stood up. It raised the land before there was a sky to
  // watch it, then lay down to sleep under its own peaks. The Celestials' fall woke it, and it wants the world flat again.
  orogen: {
    id: "terra", boss: "orogen", name: "Orogen", power: "Tectonics", role: "tank",
    ability: "A Titan: a mountain range with a body. Every step moves the ground, stone spikes burst up wherever it looks, and the drift of whole continents drags you in to meet its fists.",
    color: "hsl(28 10% 32%)", glow: "hsl(150 80% 62%)", hp: 720, speed: 88,
    moves: [
      M({ id: "slab-fist", name: "Slab Fist", kind: "melee", anim: "slam", range: 104, cd: 1.2, dmg: 14, kb: 340, status: "stun", statusDur: 0.25, wind: 0.26 }),
      M({ id: "upthrust", name: "Upthrust", kind: "eruption", anim: "slam", range: 600, minRange: 40, cd: 5.6, dmg: 13, radius: 48, count: 4, lift: -720, wind: 0.38 }),
      M({ id: "rockfall", name: "Rockfall", kind: "rain", anim: "raise", range: 560, cd: 5.4, dmg: 9, count: 6, radius: 170, size: 13, shape: "rock", status: "stun", statusDur: 0.3, wind: 0.36, rec: 0.3 }),
      M({ id: "fault-quake", name: "Fault Quake", kind: "burst", anim: "slam", range: 170, cd: 6.5, dmg: 16, radius: 190, kb: 460, lift: -340, wind: 0.36, rec: 0.36 }),
      M({ id: "landslide", name: "Landslide", kind: "dash", anim: "lunge", range: 560, minRange: 90, cd: 4.6, dmg: 15, kb: 440, lift: -260, wind: 0.32 }),
      M({ id: "continental-drift", name: "Continental Drift", kind: "pull", anim: "cast", range: 500, minRange: 110, cd: 4.8, dmg: 9, status: "slow", statusDur: 1, wind: 0.28 }),
    ],
  },
  // Book 4, chapter 2. The second Titan: the oldest tree, whose roots hold the whole world together from underneath.
  // Woken, it has decided that everything standing on its roots is a weed.
  gnarlroot: {
    id: "vita", boss: "gnarlroot", name: "Gnarlroot", power: "Old Growth", role: "control",
    ability: "A Titan: the first tree, its roots under every country in the world. Thorns fly from its branches, roots tear up through the floor and snare whoever runs, and its sap heals every wound you give it.",
    color: "hsl(24 30% 20%)", glow: "hsl(92 80% 60%)", hp: 740, speed: 90,
    moves: [
      M({ id: "bough-swing", name: "Bough Swing", kind: "melee", anim: "spin", range: 116, cd: 1.1, dmg: 13, kb: 300, status: "poison", statusDur: 1 }),
      M({ id: "thorn-hail", name: "Thorn Hail", kind: "projectile", anim: "thrust", range: 620, minRange: 80, cd: 2.4, dmg: 6, speed: 640, size: 10, count: 5, spread: 0.3, shape: "shard", status: "poison", statusDur: 0.8 }),
      M({ id: "gnarled-snare", name: "Gnarled Snare", kind: "pull", anim: "cast", range: 520, minRange: 110, cd: 4.6, dmg: 9, status: "stun", statusDur: 0.4, wind: 0.26 }),
      M({ id: "taproot", name: "Taproot", kind: "eruption", anim: "slam", range: 580, minRange: 40, cd: 5.6, dmg: 13, radius: 46, count: 3, lift: -680, status: "slow", statusDur: 1, wind: 0.36 }),
      M({ id: "sap-mend", name: "Sap Mend", kind: "heal", anim: "raise", range: 2000, cd: 13, dmg: 0, heal: 30, below: 0.6, wind: 0.4, act: 0.3 }),
      M({ id: "bramble-thicket", name: "Bramble Thicket", kind: "zone", anim: "slam", range: 420, cd: 9, dmg: 6, radius: 150, dur: 4.5, status: "poison", statusDur: 0.8, wind: 0.36 }),
    ],
  },
  // Book 4, chapter 3. The third Titan: a cavern of living amber under the forest, where the world keeps everything it
  // wants to remember. It has started keeping people too, sealed in gold, perfect and still for ever.
  ambrel: {
    id: "chrono", boss: "ambrel", name: "Ambrel", power: "Amber", role: "control",
    ability: "A Titan: a body of living amber with an ancient wasp sealed in its heart. Its resin sets in a moment and freezes whatever it catches, its honey lance burns, and it slips through its own gold to strike from behind.",
    color: "hsl(32 80% 36%)", glow: "hsl(44 100% 66%)", hp: 760, speed: 96,
    moves: [
      M({ id: "resin-palm", name: "Resin Palm", kind: "melee", anim: "thrust", range: 100, cd: 1, dmg: 12, kb: 240, status: "slow", statusDur: 1 }),
      M({ id: "sap-drops", name: "Sap Drops", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 2.6, dmg: 7, speed: 520, size: 12, count: 3, spread: 0.2, shape: "orb", status: "slow", statusDur: 0.9 }),
      M({ id: "honey-lance", name: "Honey Lance", kind: "beam", anim: "thrust", range: 580, minRange: 70, cd: 3.4, dmg: 14, act: 0.34, status: "burn", statusDur: 1, wind: 0.32 }),
      M({ id: "fossil-step", name: "Fossil Step", kind: "blink", anim: "kick", range: 560, minRange: 130, cd: 4.2, dmg: 13, kb: 300, lift: -240, status: "freeze", statusDur: 0.4 }),
      M({ id: "amber-pool", name: "Amber Pool", kind: "zone", anim: "slam", range: 400, cd: 9, dmg: 5, radius: 145, dur: 4.5, status: "slow", statusDur: 0.8, wind: 0.36 }),
      M({ id: "set-in-stone", name: "Set in Stone", kind: "burst", anim: "raise", range: 160, cd: 8, dmg: 12, radius: 180, kb: 300, status: "freeze", statusDur: 1, wind: 0.42, rec: 0.36 }),
    ],
  },
};

// ---------- Boss phases ----------
// Each boss breaks into a 2nd, 3rd and 4th phase as its health runs down (75%, 50%, 25%). A phase is a form
// (forms.ts, kind "phase"): the fight pauses for its cutscene, the boss is recoloured and stronger, and 2 new
// moves join the ones it already has, so by its 4th phase a boss fights with 12. Its look grows with each
// phase (drawBossPhase in boss-designs.ts).
const P2 = { kind: "phase" as const, step: 2, at: 0.75, dmg: 1.12, kb: 1.08, cd: 0.88, speed: 1.05, act: 1.05 };
const P3 = { kind: "phase" as const, step: 3, at: 0.5, dmg: 1.24, kb: 1.15, cd: 0.78, speed: 1.1, act: 1.1 };
const P4 = { kind: "phase" as const, step: 4, at: 0.25, dmg: 1.38, kb: 1.25, cd: 0.68, speed: 1.18, act: 1.18 };

export const BOSS_PHASES: Partial<Record<BossDesign, Form[]>> = {
  antimatter: [
    {
      ...P2, power: "umbra", title: "UNSTABLE PAIR", dodge: 0.1,
      blurb: "Matter and antimatter split off it and circle its body. Its shots come in threes and pass through.",
      body: "hsl(268 45% 20%)", glow: "hsl(186 100% 82%)", a: "hsl(268 60% 34%)", b: "hsl(186 100% 80%)",
      moves: [
        M({ id: "twin-orbit", name: "Twin Orbit", kind: "projectile", anim: "thrust", range: 580, minRange: 80, cd: 3, dmg: 7, speed: 560, size: 11, count: 3, spread: 0.22, pierce: true, shape: "orb" }),
        M({ id: "antimatter-grasp", name: "Antimatter Grasp", kind: "pull", anim: "cast", range: 440, minRange: 110, cd: 4.5, dmg: 9, status: "slow", statusDur: 1, wind: 0.24 }),
      ],
    },
    {
      ...P3, power: "umbra", title: "ANNIHILATION ENGINE", drain: 0.12,
      blurb: "Its body cracks open over pure antimatter and a broken halo turns behind its head. Every hit it lands takes a little health back.",
      body: "hsl(200 60% 12%)", glow: "hsl(186 100% 88%)", a: "hsl(186 100% 56%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "chain-annihilation", name: "Chain Annihilation", kind: "eruption", anim: "slam", range: 600, minRange: 40, cd: 6, dmg: 12, radius: 44, count: 5, lift: -560, status: "blind", statusDur: 0.6, wind: 0.36 }),
        M({ id: "erasure-beam", name: "Erasure Beam", kind: "beam", anim: "cast", range: 620, minRange: 60, cd: 4, dmg: 18, act: 0.4, kb: 300, wind: 0.36 }),
      ],
    },
    {
      ...P4, power: "umbra", title: "ZERO STATE", drain: 0.12, guard: 0.8,
      blurb: "Nothing left but the void it carries. Wings of erased space spread behind it, and Big Crunch blasts most of the arena.",
      body: "hsl(0 0% 4%)", glow: "hsl(186 100% 70%)", a: "hsl(268 80% 12%)", b: "hsl(186 100% 76%)", dark: "hsl(268 60% 3%)",
      moves: [
        M({ id: "absolute-null", name: "Absolute Null", kind: "zone", anim: "raise", range: 440, cd: 9, dmg: 8, radius: 170, dur: 4.5, pullIn: 260, erase: true, status: "slow", statusDur: 0.6, wind: 0.4 }),
        M({ id: "big-crunch", name: "Big Crunch", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 440, kb: 420, lift: -420, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  maelstrom: [
    {
      ...P2, power: "hydro", title: "RISING TIDE",
      blurb: "The sea climbs its body and swirls around its waist. An undertow rolls along the floor and it rides the tide straight at you.",
      body: "hsl(208 75% 26%)", glow: "hsl(186 100% 80%)", a: "hsl(205 90% 44%)", b: "hsl(186 100% 84%)",
      moves: [
        M({ id: "undertow", name: "Undertow", kind: "projectile", anim: "slam", range: 900, minRange: 60, cd: 6, dmg: 12, speed: 380, size: 26, pierce: true, ground: true, shape: "wave", kb: 300, lift: -260, status: "slow", statusDur: 1.2, wind: 0.36 }),
        M({ id: "harpoon-tide", name: "Harpoon Tide", kind: "dash", anim: "lunge", range: 380, cd: 3.8, dmg: 13, dist: 380, act: 0.24, kb: 340, lift: -200 }),
      ],
    },
    {
      ...P3, power: "hydro", title: "HURRICANE CROWN", dodge: 0.15,
      blurb: "A storm cloud crowns its head and lightning answers it. It slips some hits like spray.",
      body: "hsl(220 35% 22%)", glow: "hsl(54 100% 72%)", a: "hsl(220 40% 36%)", b: "hsl(54 100% 74%)",
      moves: [
        M({ id: "lightning-trident", name: "Lightning Trident", kind: "beam", anim: "thrust", range: 520, minRange: 60, cd: 3.6, dmg: 15, act: 0.3, status: "stun", statusDur: 0.3, wind: 0.28 }),
        M({ id: "squall-line", name: "Squall Line", kind: "rain", anim: "raise", range: 560, cd: 6, dmg: 8, count: 9, radius: 200, status: "stun", statusDur: 0.2, wind: 0.36, rec: 0.3 }),
      ],
    },
    {
      ...P4, power: "hydro", title: "ABYSSAL LEVIATHAN", regen: 1.6, guard: 0.85,
      blurb: "A sea serpent from the deep coils behind it. The storm mends it, and its last whirlpool drowns half the arena.",
      body: "hsl(200 80% 10%)", glow: "hsl(170 100% 66%)", a: "hsl(205 90% 22%)", b: "hsl(170 100% 70%)", dark: "hsl(210 70% 5%)",
      moves: [
        M({ id: "leviathan-maw", name: "Leviathan's Maw", kind: "pull", anim: "cast", range: 520, minRange: 100, cd: 5, dmg: 14, status: "slow", statusDur: 1.2, wind: 0.28 }),
        M({ id: "drowned-world", name: "Drowned World", kind: "zone", anim: "slam", range: 420, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 200, status: "slow", statusDur: 0.6, wind: 0.4 }),
      ],
    },
  ],
  magmaw: [
    {
      ...P2, power: "terra", title: "ERUPTION", guard: 0.85,
      blurb: "Its cracks split wide and magma runs down its body. It takes less damage and spits burning rock.",
      body: "hsl(12 50% 22%)", glow: "hsl(28 100% 60%)", a: "hsl(16 100% 46%)", b: "hsl(40 100% 64%)",
      moves: [
        M({ id: "magma-geyser", name: "Magma Geyser", kind: "eruption", anim: "uppercut", range: 480, minRange: 50, cd: 4.6, dmg: 14, radius: 54, lift: -820, status: "burn", statusDur: 1.5, wind: 0.3 }),
        M({ id: "cinder-spit", name: "Cinder Spit", kind: "projectile", anim: "thrust", range: 560, minRange: 80, cd: 2.6, dmg: 6, speed: 520, size: 11, count: 3, spread: 0.2, arc: true, shape: "rock", status: "burn", statusDur: 1.5 }),
      ],
    },
    {
      ...P3, power: "terra", title: "PYROCLASTIC", guard: 0.8,
      blurb: "Vents burst open on its shoulders and a column of ash pours out. Its ash blinds, and a burning flow rolls across the floor.",
      body: "hsl(20 15% 14%)", glow: "hsl(20 100% 56%)", a: "hsl(18 30% 28%)", b: "hsl(32 100% 60%)", dark: "hsl(20 20% 6%)",
      moves: [
        M({ id: "ash-storm", name: "Ash Storm", kind: "zone", anim: "raise", range: 380, cd: 8.5, dmg: 6, radius: 160, dur: 4.5, status: "blind", statusDur: 0.6, wind: 0.35 }),
        M({ id: "pyroclastic-flow", name: "Pyroclastic Flow", kind: "projectile", anim: "slam", range: 900, minRange: 60, cd: 7, dmg: 16, speed: 360, size: 32, pierce: true, ground: true, shape: "wave", kb: 440, lift: -340, status: "burn", statusDur: 2, wind: 0.4, rec: 0.35 }),
      ],
    },
    {
      ...P4, power: "terra", title: "MOLTEN CORE", guard: 0.75, regen: 1.2,
      blurb: "Its shell melts away from a white-hot core and a ring of obsidian circles it. Supervolcano blasts most of the arena.",
      body: "hsl(14 90% 40%)", glow: "hsl(48 100% 70%)", a: "hsl(10 100% 48%)", b: "hsl(50 100% 70%)",
      moves: [
        M({ id: "supervolcano", name: "Supervolcano", kind: "burst", anim: "raise", range: 460, cd: 12, dmg: 14, radius: 420, kb: 400, lift: -520, status: "burn", statusDur: 3, wind: 0.55, rec: 0.35 }),
        M({ id: "caldera-crush", name: "Caldera Crush", kind: "burst", anim: "slam", range: 160, cd: 7, dmg: 22, radius: 200, kb: 560, lift: -400, status: "burn", statusDur: 2.5, wind: 0.36, rec: 0.38 }),
      ],
    },
  ],
  everwinter: [
    {
      ...P2, power: "cryo", title: "BLACK ICE", dodge: 0.15,
      blurb: "Spikes of black ice grow along its shoulders. Glaciers break out of the floor, and it slips some hits.",
      body: "hsl(210 40% 60%)", glow: "hsl(44 90% 72%)", a: "hsl(210 60% 50%)", b: "hsl(44 95% 76%)",
      moves: [
        M({ id: "glacier-fang", name: "Glacier Fang", kind: "eruption", anim: "slam", range: 520, minRange: 50, cd: 5, dmg: 12, radius: 44, count: 3, lift: -560, status: "slow", statusDur: 1.4, wind: 0.34 }),
        M({ id: "frozen-second", name: "Frozen Second", kind: "blink", anim: "kick", range: 520, minRange: 120, cd: 4.2, dmg: 13, kb: 320, status: "freeze", statusDur: 0.5 }),
      ],
    },
    {
      ...P3, power: "cryo", title: "STOPPED HOUR", drain: 0.15,
      blurb: "A frozen clock face turns behind it. Its clock hands fly in volleys, and the seconds it steals come back as health.",
      body: "hsl(44 50% 70%)", glow: "hsl(44 100% 80%)", a: "hsl(42 80% 54%)", b: "hsl(200 90% 90%)",
      moves: [
        M({ id: "clock-hands", name: "Clock Hands", kind: "projectile", anim: "cast", range: 580, minRange: 80, cd: 3, dmg: 6, speed: 640, size: 10, count: 5, spread: 0.14, shape: "blade", status: "slow", statusDur: 1 }),
        M({ id: "rewound-blizzard", name: "Rewound Blizzard", kind: "rain", anim: "raise", range: 540, cd: 6, dmg: 8, count: 8, radius: 180, shape: "shard", status: "freeze", statusDur: 0.4, wind: 0.36, rec: 0.3 }),
      ],
    },
    {
      ...P4, power: "cryo", title: "ENDLESS WINTER", guard: 0.8, regen: 1.2,
      blurb: "A crown of icicles and a blizzard that never stops. Eternal Stop freezes the whole arena for longer than any Time Stop.",
      body: "hsl(200 70% 94%)", glow: "hsl(190 100% 96%)", a: "hsl(200 90% 68%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "eternal-stop", name: "Eternal Stop", kind: "burst", anim: "raise", range: 2000, cd: 15, dmg: 10, radius: 60, world: true, status: "freeze", statusDur: 2.4, wind: 0.55, rec: 0.2 }),
        M({ id: "absolute-winter", name: "Absolute Winter", kind: "zone", anim: "slam", range: 400, cd: 9, dmg: 7, radius: 190, dur: 5, pullIn: 120, status: "slow", statusDur: 0.8, wind: 0.36 }),
      ],
    },
  ],
  riftmaker: [
    {
      ...P2, power: "psy", title: "FRACTURED SELF", dodge: 0.15,
      blurb: "Two mirror copies split off it and sway at its sides. It slips some hits, and its mirror shards fly in a wide fan.",
      body: "hsl(262 36% 18%)", glow: "hsl(318 100% 76%)", a: "hsl(318 90% 58%)", b: "hsl(186 100% 80%)",
      moves: [
        M({ id: "kaleidoscope", name: "Kaleidoscope", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 3.4, dmg: 5, speed: 620, size: 9, count: 6, spread: 0.3, shape: "shard", status: "blind", statusDur: 0.5 }),
        M({ id: "mirror-step", name: "Mirror Step", kind: "blink", anim: "kick", range: 500, minRange: 120, cd: 4, dmg: 12, kb: 280, status: "blind", statusDur: 0.5 }),
      ],
    },
    {
      ...P3, power: "psy", title: "TORN SKY", drain: 0.12,
      blurb: "The tear behind it opens into a ring of open space full of stars, and two more eyes open on its brow. Stars fall through the ring, and every hit it lands takes a little health back.",
      body: "hsl(250 50% 10%)", glow: "hsl(186 100% 80%)", a: "hsl(252 70% 30%)", b: "hsl(318 100% 80%)",
      moves: [
        M({ id: "gravity-fold", name: "Gravity Fold", kind: "pull", anim: "cast", range: 480, minRange: 110, cd: 4.5, dmg: 10, status: "blind", statusDur: 0.6, wind: 0.24 }),
        M({ id: "falling-sky", name: "Falling Sky", kind: "rain", anim: "raise", range: 560, cd: 6, dmg: 8, count: 8, radius: 190, size: 11, shape: "shard", wind: 0.36, rec: 0.3 }),
      ],
    },
    {
      ...P4, power: "psy", title: "THE UNWRITTEN", guard: 0.8, regen: 1.2,
      blurb: "Reality stops holding it together: its body glitches into slices and a turning cube of broken space frames it. Rewrite blasts most of the arena.",
      body: "hsl(0 0% 96%)", glow: "hsl(318 100% 70%)", a: "hsl(186 100% 56%)", b: "hsl(318 100% 72%)", dark: "hsl(262 70% 6%)",
      moves: [
        M({ id: "rewrite", name: "Rewrite", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 15, radius: 430, kb: 420, lift: -400, status: "blind", statusDur: 1.2, wind: 0.55, rec: 0.35 }),
        M({ id: "infinite-mirror", name: "Infinite Mirror", kind: "beam", anim: "cast", range: 640, minRange: 60, cd: 4, dmg: 18, act: 0.4, kb: 300, status: "blind", statusDur: 0.6, wind: 0.36 }),
      ],
    },
  ],
  hollow: [
    {
      ...P2, power: "umbra", title: "SOUL FEAST", drain: 0.1,
      blurb: "Green soul fire runs along the hem of its cloak and a chain of skulls hangs from its belt. It hurls its scythe, and every hit feeds it.",
      body: "hsl(168 18% 14%)", glow: "hsl(152 100% 68%)", a: "hsl(160 40% 18%)", b: "hsl(152 100% 72%)",
      moves: [
        M({ id: "reaver-throw", name: "Reaver Throw", kind: "projectile", anim: "spin", range: 600, minRange: 90, cd: 3.4, dmg: 11, speed: 520, size: 16, pierce: true, shape: "blade" }),
        M({ id: "ghost-march", name: "Ghost March", kind: "dash", anim: "lunge", range: 380, cd: 4, dmg: 12, dist: 380, act: 0.24, kb: 300, status: "slow", statusDur: 1 }),
      ],
    },
    {
      ...P3, power: "umbra", title: "THE DEAD COURT", guard: 0.85,
      blurb: "Two ghost knights of its fallen court rise at its sides. Bone Spires burst up through the floor in a row, and Banshee Wail blinds everyone near it.",
      body: "hsl(170 22% 10%)", glow: "hsl(140 90% 70%)", a: "hsl(44 30% 82%)", b: "hsl(152 100% 66%)",
      moves: [
        M({ id: "bone-spires", name: "Bone Spires", kind: "eruption", anim: "slam", range: 600, minRange: 40, cd: 6, dmg: 11, radius: 42, count: 5, lift: -560, status: "stun", statusDur: 0.3, wind: 0.36 }),
        M({ id: "banshee-wail", name: "Banshee Wail", kind: "burst", anim: "raise", range: 160, cd: 7, dmg: 12, radius: 200, kb: 360, lift: -240, status: "blind", statusDur: 1.4, wind: 0.34, rec: 0.36 }),
      ],
    },
    {
      ...P4, power: "umbra", title: "DEATH ITSELF", guard: 0.8, drain: 0.15,
      blurb: "Wings of bone and torn shadow open behind it and a ring of soul fire burns over its crown. Final Harvest reaps every enemy at once, and Requiem feeds it while they stand in it.",
      body: "hsl(160 30% 6%)", glow: "hsl(152 100% 74%)", a: "hsl(165 40% 10%)", b: "hsl(150 100% 76%)", dark: "hsl(170 40% 3%)",
      moves: [
        M({ id: "final-harvest", name: "Final Harvest", kind: "burst", anim: "raise", range: 2000, cd: 14, dmg: 13, heal: 9, harvest: true, wind: 0.55, rec: 0.3 }),
        M({ id: "requiem", name: "Requiem", kind: "zone", anim: "slam", range: 420, cd: 10, dmg: 7, radius: 190, dur: 5, pullIn: 160, heal: 3, status: "slow", statusDur: 0.6, wind: 0.4 }),
      ],
    },
  ],
  blacksun: [
    {
      ...P2, power: "lux", title: "CORONA STORM",
      blurb: "Three sunspots break off its disc and circle its body. It fires them in volleys and charges in a trail of fire.",
      body: "hsl(26 40% 14%)", glow: "hsl(40 100% 66%)", a: "hsl(24 100% 50%)", b: "hsl(48 100% 74%)",
      moves: [
        M({ id: "sunspot-volley", name: "Sunspot Volley", kind: "projectile", anim: "thrust", range: 580, minRange: 80, cd: 3, dmg: 5, speed: 560, size: 10, count: 5, spread: 0.26, shape: "orb", status: "burn", statusDur: 1.2 }),
        M({ id: "sunrush", name: "Sunrush", kind: "dash", anim: "lunge", range: 400, cd: 3.8, dmg: 13, dist: 400, act: 0.24, kb: 320, lift: -200, status: "burn", statusDur: 1.5 }),
      ],
    },
    {
      ...P3, power: "lux", title: "PENUMBRA", dodge: 0.15,
      blurb: "A ring of black flame circles the dead sun with a diamond of light running round its edge. Its rays turn dark and blind, and it slips some hits in the shade.",
      body: "hsl(250 30% 8%)", glow: "hsl(44 100% 70%)", a: "hsl(250 40% 10%)", b: "hsl(44 100% 72%)", dark: "hsl(250 40% 4%)",
      moves: [
        M({ id: "umbral-ray", name: "Umbral Ray", kind: "beam", anim: "cast", range: 560, minRange: 70, cd: 3.8, dmg: 16, act: 0.36, status: "blind", statusDur: 0.8, wind: 0.32 }),
        M({ id: "shadow-flare", name: "Shadow Flare", kind: "eruption", anim: "slam", range: 540, minRange: 50, cd: 5.5, dmg: 12, radius: 48, count: 3, lift: -620, status: "blind", statusDur: 0.6, wind: 0.36 }),
      ],
    },
    {
      ...P4, power: "lux", title: "SUPERNOVA", guard: 0.75, regen: 1.2,
      blurb: "The dead sun cracks open and white fire pours out of it, and its fists burn white. Supernova blasts most of the arena, and Endless Night blacks out the sky and leaves its enemies blind longer than Total Eclipse.",
      body: "hsl(40 100% 86%)", glow: "hsl(0 0% 100%)", a: "hsl(36 100% 56%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "supernova", name: "Supernova", kind: "burst", anim: "raise", range: 460, cd: 12, dmg: 15, radius: 440, kb: 420, lift: -480, status: "burn", statusDur: 3, wind: 0.55, rec: 0.35 }),
        M({ id: "endless-night", name: "Endless Night", kind: "burst", anim: "raise", range: 2000, cd: 15, dmg: 9, eclipse: true, status: "blind", statusDur: 4.5, wind: 0.55, rec: 0.3 }),
      ],
    },
  ],
  axiom: [
    {
      ...P2, power: "gravi", title: "NEBULA HEART", dodge: 0.12,
      blurb: "A nebula blooms in its chest and three small worlds fall into orbit round it. It throws planets, and its nebula veil blinds whoever stands in it.",
      body: "hsl(262 50% 16%)", glow: "hsl(300 100% 78%)", a: "hsl(290 80% 52%)", b: "hsl(200 100% 80%)",
      moves: [
        M({ id: "planet-toss", name: "Planet Toss", kind: "projectile", anim: "thrust", range: 620, minRange: 90, cd: 3.6, dmg: 14, speed: 380, size: 22, arc: true, shape: "rock", kb: 380, lift: -260, wind: 0.3 }),
        M({ id: "nebula-veil", name: "Nebula Veil", kind: "zone", anim: "raise", range: 400, cd: 9, dmg: 6, radius: 160, dur: 4.5, status: "blind", statusDur: 0.6, wind: 0.35 }),
      ],
    },
    {
      ...P3, power: "gravi", title: "GALAXY CROWN", drain: 0.12,
      blurb: "A crown of stars lights over its head and a second galaxy turns behind it. Superclusters fly in fans, and every hit it lands takes a little health back.",
      body: "hsl(230 60% 12%)", glow: "hsl(48 100% 80%)", a: "hsl(240 80% 40%)", b: "hsl(48 100% 82%)",
      moves: [
        M({ id: "supercluster", name: "Supercluster", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 3, dmg: 6, speed: 600, size: 10, count: 6, spread: 0.26, shape: "orb" }),
        M({ id: "gravity-well", name: "Gravity Well", kind: "pull", anim: "cast", range: 500, minRange: 110, cd: 4.5, dmg: 11, status: "slow", statusDur: 1.2, wind: 0.26 }),
      ],
    },
    {
      ...P4, power: "gravi", title: "THE LAST LAW", guard: 0.78, regen: 1.3,
      blurb: "A black hole opens behind it and its body turns to open sky. Big Bang blasts most of the arena, and Heat Death puts out every star so its enemies swing blind.",
      body: "hsl(0 0% 3%)", glow: "hsl(0 0% 100%)", a: "hsl(272 90% 60%)", b: "hsl(48 100% 86%)", dark: "hsl(250 60% 3%)",
      moves: [
        M({ id: "big-bang", name: "Big Bang", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 440, kb: 440, lift: -460, wind: 0.55, rec: 0.35 }),
        M({ id: "heat-death", name: "Heat Death", kind: "burst", anim: "raise", range: 2000, cd: 15, dmg: 8, eclipse: true, status: "blind", statusDur: 4, wind: 0.55, rec: 0.3 }),
      ],
    },
  ],
  lanternmaw: [
    {
      ...P2, power: "psy", title: "THE LAMP OPENS", dodge: 0.12,
      blurb: "Two more lures uncurl from its shoulders and its robe splits into tentacles. Its lights fly in swarms, and ink spills across the floor.",
      body: "hsl(192 50% 13%)", glow: "hsl(66 100% 68%)", a: "hsl(180 60% 24%)", b: "hsl(66 100% 70%)",
      moves: [
        M({ id: "thousand-lures", name: "Thousand Lures", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 3.2, dmg: 5, speed: 600, size: 9, count: 5, spread: 0.28, shape: "orb", status: "blind", statusDur: 0.5 }),
        M({ id: "ink-cloud", name: "Ink Cloud", kind: "zone", anim: "raise", range: 380, cd: 8.5, dmg: 6, radius: 150, dur: 4.5, status: "blind", statusDur: 0.6, wind: 0.35 }),
      ],
    },
    {
      ...P3, power: "psy", title: "UNBLINKING", drain: 0.12,
      blurb: "Eyes open all down its body, and none of them ever close. Light rains from the dark above it, and every hit it lands takes a little health back.",
      body: "hsl(200 46% 9%)", glow: "hsl(60 100% 74%)", a: "hsl(64 90% 56%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "many-eyes", name: "Many Eyes", kind: "rain", anim: "raise", range: 540, cd: 6, dmg: 8, count: 8, radius: 180, size: 10, status: "blind", statusDur: 0.6, wind: 0.36, rec: 0.3 }),
        M({ id: "hadal-crush", name: "Hadal Crush", kind: "burst", anim: "slam", range: 150, cd: 7, dmg: 18, radius: 180, kb: 480, lift: -320, status: "slow", statusDur: 1.5, wind: 0.34, rec: 0.36 }),
      ],
    },
    {
      ...P4, power: "psy", title: "HERALD OF THE ELDER DARK", guard: 0.8, regen: 1.2,
      blurb: "A vast eye opens in the dark behind it and a crown of tentacles rises over its head. Call of the Deep drags everyone toward it, and The Elder Gaze blasts most of the arena.",
      body: "hsl(210 50% 5%)", glow: "hsl(66 100% 76%)", a: "hsl(170 70% 18%)", b: "hsl(66 100% 74%)", dark: "hsl(210 60% 3%)",
      moves: [
        M({ id: "call-of-the-deep", name: "Call of the Deep", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "slow", statusDur: 0.6, wind: 0.4 }),
        M({ id: "elder-gaze", name: "The Elder Gaze", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 15, radius: 430, kb: 400, lift: -380, status: "blind", statusDur: 1.5, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  sporemother: [
    {
      ...P2, power: "toxi", title: "THE CHOIR SWELLS", dodge: 0.1,
      blurb: "Mushroom caps burst open across its back and every one of them sings. Spores rain from the canopy, and its roots grab from further away.",
      body: "hsl(316 28% 20%)", glow: "hsl(170 100% 68%)", a: "hsl(300 40% 40%)", b: "hsl(170 100% 72%)",
      moves: [
        M({ id: "spore-rain", name: "Spore Rain", kind: "rain", anim: "raise", range: 540, cd: 5.5, dmg: 6, count: 8, radius: 170, size: 10, status: "poison", statusDur: 2, wind: 0.34 }),
        M({ id: "puppet-roots", name: "Puppet Roots", kind: "pull", anim: "cast", range: 500, minRange: 100, cd: 4.5, dmg: 9, status: "stun", statusDur: 0.4, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "toxi", title: "ONE MIND", drain: 0.12,
      blurb: "A ring of glowing fruiting bodies rises round its head like a crown. Its song becomes a beam, and every hit feeds the hive.",
      body: "hsl(312 30% 15%)", glow: "hsl(160 100% 72%)", a: "hsl(170 90% 50%)", b: "hsl(320 80% 84%)",
      moves: [
        M({ id: "fruiting-spires", name: "Fruiting Spires", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 50, count: 4, lift: -640, status: "poison", statusDur: 2, wind: 0.38 }),
        M({ id: "chorus-beam", name: "Chorus Beam", kind: "beam", anim: "thrust", range: 540, minRange: 70, cd: 4, dmg: 15, act: 0.36, status: "stun", statusDur: 0.5, wind: 0.34 }),
      ],
    },
    {
      ...P4, power: "toxi", title: "GARDEN OF THE ELDER DARK", guard: 0.8, regen: 1.2,
      blurb: "The whole forest floor wakes up under it and sings with one voice. The Last Bloom covers most of the arena in spores, and Everything Sings drags everyone into the rot.",
      body: "hsl(310 34% 10%)", glow: "hsl(166 100% 76%)", a: "hsl(160 100% 40%)", b: "hsl(300 100% 86%)", dark: "hsl(320 40% 6%)",
      moves: [
        M({ id: "everything-sings", name: "Everything Sings", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 200, status: "poison", statusDur: 1.5, wind: 0.4 }),
        M({ id: "last-bloom", name: "The Last Bloom", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 15, radius: 430, kb: 380, lift: -360, status: "poison", statusDur: 3, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  mnemovore: [
    {
      ...P2, power: "chrono", title: "THE HUNGER OPENS", dodge: 0.14,
      blurb: "Its blank face splits down the middle into a mouth full of stolen moments. Old memories swarm out of it, and it reels in whoever forgets to run.",
      body: "hsl(266 20% 22%)", glow: "hsl(300 100% 84%)", a: "hsl(280 40% 46%)", b: "hsl(300 100% 86%)",
      moves: [
        M({ id: "echo-swarm", name: "Echo Swarm", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 3, dmg: 5, speed: 600, size: 9, count: 5, spread: 0.3, shape: "shard", status: "slow", statusDur: 0.6 }),
        M({ id: "lost-way", name: "Lost Way", kind: "pull", anim: "cast", range: 480, minRange: 110, cd: 4.5, dmg: 9, status: "stun", statusDur: 0.4, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "chrono", title: "A THOUSAND FACES", drain: 0.14,
      blurb: "The faces of everyone it has eaten drift around it like masks. They fall on you as it calls them down, and every hit it lands eats a little more.",
      body: "hsl(270 22% 16%)", glow: "hsl(310 100% 86%)", a: "hsl(300 70% 70%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "falling-faces", name: "Falling Faces", kind: "rain", anim: "raise", range: 540, cd: 6, dmg: 8, count: 7, radius: 170, size: 11, status: "stun", statusDur: 0.25, wind: 0.36, rec: 0.3 }),
        M({ id: "devoured-years", name: "Devoured Years", kind: "beam", anim: "thrust", range: 560, minRange: 70, cd: 4.2, dmg: 16, act: 0.36, status: "slow", statusDur: 1.5, wind: 0.34 }),
      ],
    },
    {
      ...P4, power: "chrono", title: "THE DARK REMEMBERS YOU", guard: 0.8, regen: 1.2,
      blurb: "The page of the world behind it goes blank and a halo of written names burns round its head. The Blank drags everyone in, and Oblivion wipes most of the arena.",
      body: "hsl(270 24% 9%)", glow: "hsl(300 100% 88%)", a: "hsl(280 50% 20%)", b: "hsl(300 100% 86%)", dark: "hsl(270 40% 4%)",
      moves: [
        M({ id: "the-blank", name: "The Blank", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "slow", statusDur: 0.6, wind: 0.4 }),
        M({ id: "oblivion", name: "Oblivion", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 430, kb: 400, lift: -360, status: "stun", statusDur: 0.8, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  dustmoth: [
    {
      ...P2, power: "aero", title: "THE WINGS OPEN", dodge: 0.14,
      blurb: "Its folded wings spread wide and two great eyespots stare out of them. Their stare holds you still, and its antennae taste for whoever is hiding.",
      body: "hsl(34 14% 26%)", glow: "hsl(208 100% 86%)", a: "hsl(30 20% 50%)", b: "hsl(208 100% 86%)",
      moves: [
        M({ id: "eyespot-stare", name: "Eyespot Stare", kind: "beam", anim: "thrust", range: 540, minRange: 70, cd: 4, dmg: 13, act: 0.34, status: "stun", statusDur: 0.5, wind: 0.32 }),
        M({ id: "silk-line", name: "Silk Line", kind: "pull", anim: "cast", range: 480, minRange: 110, cd: 4.5, dmg: 9, status: "slow", statusDur: 1.2, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "aero", title: "THE MOON EATER", drain: 0.12,
      blurb: "A pale crescent of stolen moonlight hangs in its jaws, and its wings shed glowing scales. Moonlight spears up out of the ground, and every hit feeds it.",
      body: "hsl(30 14% 18%)", glow: "hsl(204 100% 88%)", a: "hsl(210 70% 70%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "moon-spears", name: "Moon Spears", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 46, count: 4, lift: -700, status: "blind", statusDur: 0.6, wind: 0.38 }),
        M({ id: "scale-storm", name: "Scale Storm", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 3.2, dmg: 5, speed: 620, size: 9, count: 6, spread: 0.32, shape: "disc", status: "blind", statusDur: 0.5 }),
      ],
    },
    {
      ...P4, power: "aero", title: "WINGS OVER THE WORLD", guard: 0.8, regen: 1.2,
      blurb: "A second pair of wings opens, made of the night sky itself, and the moon behind it goes dark. Last Light pulls everyone toward it, and Eclipse of Wings blasts most of the arena.",
      body: "hsl(230 30% 8%)", glow: "hsl(208 100% 90%)", a: "hsl(230 50% 20%)", b: "hsl(208 100% 86%)", dark: "hsl(230 50% 4%)",
      moves: [
        M({ id: "last-light", name: "Last Light", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "blind", statusDur: 0.6, wind: 0.4 }),
        M({ id: "eclipse-of-wings", name: "Eclipse of Wings", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 430, kb: 460, lift: -400, status: "blind", statusDur: 1.5, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  somnarch: [
    {
      ...P2, power: "psy", title: "THE DREAM DEEPENS", dodge: 0.12,
      blurb: "The ring of closed eyes round its head flutters open one by one. Pillows of dream cloud drift up around it, and whoever it looks at starts to nod off.",
      body: "hsl(252 34% 22%)", glow: "hsl(46 100% 76%)", a: "hsl(250 50% 56%)", b: "hsl(46 100% 80%)",
      moves: [
        M({ id: "falling-dreams", name: "Falling Dreams", kind: "rain", anim: "raise", range: 540, cd: 5.5, dmg: 7, count: 7, radius: 170, size: 10, status: "slow", statusDur: 1, wind: 0.34 }),
        M({ id: "sleep-tug", name: "Sleep Tug", kind: "pull", anim: "cast", range: 480, minRange: 110, cd: 4.5, dmg: 9, status: "stun", statusDur: 0.4, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "psy", title: "THE NIGHTMARE WAKES", drain: 0.12,
      blurb: "The great eye on its brow opens, gold and hungry. Dreams turn to nightmares, spikes of black dream burst up from the ground, and every hit feeds its sleep.",
      body: "hsl(256 36% 15%)", glow: "hsl(40 100% 70%)", a: "hsl(270 60% 30%)", b: "hsl(46 100% 80%)",
      moves: [
        M({ id: "nightmare-spires", name: "Nightmare Spires", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 48, count: 4, lift: -640, status: "stun", statusDur: 0.3, wind: 0.38 }),
        M({ id: "waking-terror", name: "Waking Terror", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 3.2, dmg: 6, speed: 600, size: 10, count: 5, spread: 0.3, shape: "shard", status: "slow", statusDur: 0.8 }),
      ],
    },
    {
      ...P4, power: "psy", title: "SLEEP FOREVER", guard: 0.8, regen: 1.2,
      blurb: "The whole valley shuts its eyes at once, and a black spiral of endless sleep turns behind it. The Long Night drags everyone toward it, and Never Wake knocks most of the arena out cold.",
      body: "hsl(252 40% 9%)", glow: "hsl(46 100% 80%)", a: "hsl(250 50% 18%)", b: "hsl(46 100% 82%)", dark: "hsl(250 50% 4%)",
      moves: [
        M({ id: "the-long-night", name: "The Long Night", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "slow", statusDur: 0.8, wind: 0.4 }),
        M({ id: "never-wake", name: "Never Wake", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 430, kb: 380, lift: -340, status: "stun", statusDur: 1, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  hush: [
    {
      ...P2, power: "sono", title: "THE BELLS GO STILL", dodge: 0.14,
      blurb: "Its veil lifts in a wind nobody can hear, and the bell that is its head starts to swing without a sound. Silent rings spread out from it, and it reels in whoever tries to shout.",
      body: "hsl(350 16% 13%)", glow: "hsl(354 94% 70%)", a: "hsl(30 40% 40%)", b: "hsl(354 100% 80%)",
      moves: [
        M({ id: "silent-rings", name: "Silent Rings", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 3, dmg: 6, speed: 560, size: 12, count: 4, spread: 0.24, shape: "disc", status: "stun", statusDur: 0.2 }),
        M({ id: "stolen-breath", name: "Stolen Breath", kind: "pull", anim: "cast", range: 480, minRange: 110, cd: 4.5, dmg: 9, status: "slow", statusDur: 1.2, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "sono", title: "A VOICE TAKEN", drain: 0.14,
      blurb: "Every voice it has eaten hangs round it as a pale thread, pulled tight. The threads snap down on you like falling bells, and every hit it lands steals a little more breath.",
      body: "hsl(350 18% 9%)", glow: "hsl(358 100% 72%)", a: "hsl(40 50% 50%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "falling-bells", name: "Falling Bells", kind: "rain", anim: "raise", range: 540, cd: 6, dmg: 8, count: 6, radius: 170, size: 12, status: "stun", statusDur: 0.3, wind: 0.36, rec: 0.3 }),
        M({ id: "throat-of-night", name: "Throat of Night", kind: "beam", anim: "thrust", range: 560, minRange: 70, cd: 4.2, dmg: 16, act: 0.36, status: "slow", statusDur: 1.5, wind: 0.34 }),
      ],
    },
    {
      ...P4, power: "sono", title: "THE LAST SILENCE", guard: 0.8, regen: 1.2,
      blurb: "The cracked bell splits wide open and there is nothing inside but the dark between the stars. No Echo pulls everyone in, and the Final Toll, the one ring nobody hears, flattens most of the arena.",
      body: "hsl(350 24% 6%)", glow: "hsl(354 100% 76%)", a: "hsl(350 40% 14%)", b: "hsl(354 100% 82%)", dark: "hsl(350 40% 3%)",
      moves: [
        M({ id: "no-echo", name: "No Echo", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "slow", statusDur: 0.8, wind: 0.4 }),
        M({ id: "final-toll", name: "The Final Toll", kind: "burst", anim: "slam", range: 480, cd: 12, dmg: 16, radius: 430, kb: 460, lift: -380, status: "stun", statusDur: 0.9, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  elderdark: [
    {
      ...P2, power: "umbra", title: "THE EYES OPEN", dodge: 0.12,
      blurb: "Eyes open all over its body, every colour no star has ever shone. More arms of night uncoil behind it, and they burst up out of the ground wherever you stand.",
      body: "hsl(262 40% 10%)", glow: "hsl(268 100% 80%)", a: "hsl(150 80% 50%)", b: "hsl(268 100% 84%)",
      moves: [
        M({ id: "rising-arms", name: "Rising Arms", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 5.5, dmg: 12, radius: 48, count: 3, lift: -620, status: "slow", statusDur: 1, wind: 0.36 }),
        M({ id: "many-gazes", name: "Many Gazes", kind: "projectile", anim: "cast", range: 600, minRange: 80, cd: 3, dmg: 6, speed: 640, size: 9, count: 6, spread: 0.34, shape: "shard", status: "stun", statusDur: 0.2 }),
      ],
    },
    {
      ...P3, power: "umbra", title: "THE SHAPE IN THE STARS", drain: 0.14,
      blurb: "The constellations come down and lock round it like a cage turned inside out. Dead stars fall wherever it points, and every hit it lands eats a little light.",
      body: "hsl(262 44% 7%)", glow: "hsl(272 100% 82%)", a: "hsl(150 100% 60%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "dark-starfall", name: "Starfall", kind: "rain", anim: "raise", range: 560, cd: 5.5, dmg: 9, count: 8, radius: 190, size: 12, status: "blind", statusDur: 0.6, wind: 0.36, rec: 0.3 }),
        M({ id: "gaze-of-eons", name: "Gaze of Eons", kind: "beam", anim: "thrust", range: 580, minRange: 70, cd: 4, dmg: 17, act: 0.38, status: "stun", statusDur: 0.5, wind: 0.34 }),
      ],
    },
    {
      ...P4, power: "umbra", title: "BEFORE THE FIRST LIGHT", guard: 0.8, regen: 1.4,
      blurb: "The sky behind it tears open on one enormous eye, older than the stars. The Void Between drags everyone toward it, and The End of All Light tries to put out the world.",
      body: "hsl(262 50% 4%)", glow: "hsl(268 100% 86%)", a: "hsl(262 60% 14%)", b: "hsl(150 100% 72%)", dark: "hsl(262 60% 2%)",
      moves: [
        M({ id: "void-between", name: "The Void Between", kind: "zone", anim: "raise", range: 460, cd: 10, dmg: 8, radius: 210, dur: 5, pullIn: 260, status: "slow", statusDur: 0.8, wind: 0.4 }),
        M({ id: "end-of-all-light", name: "The End of All Light", kind: "burst", anim: "raise", range: 500, cd: 12, dmg: 17, radius: 450, kb: 480, lift: -400, status: "blind", statusDur: 1.6, wind: 0.6, rec: 0.35 }),
      ],
    },
  ],
  perihelion: [
    {
      ...P2, power: "cryo", title: "THE TAIL IGNITES", dodge: 0.12,
      blurb: "Its tail splits in two: a straight blue tail of burning ions and a curved gold one of dust. Frozen shards spin off it, and the ion tail drags you into its wake.",
      body: "hsl(212 44% 24%)", glow: "hsl(190 100% 84%)", a: "hsl(196 90% 64%)", b: "hsl(44 100% 76%)",
      moves: [
        M({ id: "twin-tails", name: "Twin Tails", kind: "projectile", anim: "cast", range: 620, minRange: 80, cd: 3, dmg: 7, speed: 600, size: 13, count: 2, spread: 0.2, shape: "disc", status: "burn", statusDur: 0.8 }),
        M({ id: "ion-wake", name: "Ion Wake", kind: "pull", anim: "cast", range: 500, minRange: 110, cd: 4.5, dmg: 9, status: "slow", statusDur: 1.2, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "cryo", title: "SUNGRAZER", drain: 0.12,
      blurb: "It swings close to the sun and comes back white hot. A corona of cold flame wraps it, the ground cracks into craters where it points, and every hit it lands feeds its fire.",
      body: "hsl(204 40% 30%)", glow: "hsl(0 0% 100%)", a: "hsl(190 100% 86%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "impact-craters", name: "Impact Craters", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 48, count: 4, lift: -680, status: "burn", statusDur: 0.8, wind: 0.38 }),
        M({ id: "calving-ice", name: "Calving Ice", kind: "projectile", anim: "thrust", range: 600, minRange: 80, cd: 3.2, dmg: 6, speed: 620, size: 10, count: 6, spread: 0.32, shape: "shard", status: "freeze", statusDur: 0.4 }),
      ],
    },
    {
      ...P4, power: "cryo", title: "THE GREAT COMET", guard: 0.8, regen: 1.3,
      blurb: "Its head breaks into a ring of burning fragments, and its tail stretches across the whole sky. Orbit's End drags everyone round it, and Impact Winter hits most of the arena like a falling star.",
      body: "hsl(214 50% 12%)", glow: "hsl(190 100% 88%)", a: "hsl(214 60% 20%)", b: "hsl(190 100% 84%)", dark: "hsl(214 60% 4%)",
      moves: [
        M({ id: "orbits-end", name: "Orbit's End", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "slow", statusDur: 0.8, wind: 0.4 }),
        M({ id: "impact-winter", name: "Impact Winter", kind: "burst", anim: "slam", range: 480, cd: 12, dmg: 16, radius: 430, kb: 480, lift: -400, status: "freeze", statusDur: 0.8, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  asterion: [
    {
      ...P2, power: "lux", title: "THE HUNTER'S BOW", dodge: 0.14,
      blurb: "It draws a bow out of the stars on its shoulder. Its arrows of dawn fly straight and fast, and a snare of starlight pulls whoever runs back into reach of its spear.",
      body: "hsl(232 44% 17%)", glow: "hsl(44 100% 78%)", a: "hsl(220 80% 70%)", b: "hsl(44 100% 80%)",
      moves: [
        M({ id: "arrow-of-dawn", name: "Arrow of Dawn", kind: "projectile", anim: "thrust", range: 680, minRange: 90, cd: 3, dmg: 11, speed: 900, size: 14, count: 1, shape: "blade", pierce: true, kb: 260 }),
        M({ id: "hunters-snare", name: "Hunter's Snare", kind: "pull", anim: "cast", range: 500, minRange: 110, cd: 4.5, dmg: 9, status: "stun", statusDur: 0.4, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "lux", title: "THE BEASTS OF THE SKY", drain: 0.12,
      blurb: "The constellations it has hunted come down and circle it: the bull, the bear, the great snake. Pillars of starlight burst from the ground, and the bull charges with it.",
      body: "hsl(236 44% 12%)", glow: "hsl(48 100% 82%)", a: "hsl(44 100% 70%)", b: "hsl(0 0% 100%)",
      moves: [
        M({ id: "star-pillars", name: "Star Pillars", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 46, count: 4, lift: -700, status: "blind", statusDur: 0.5, wind: 0.38 }),
        M({ id: "bull-charge", name: "The Bull's Charge", kind: "dash", anim: "lunge", range: 560, minRange: 90, cd: 4.6, dmg: 15, kb: 460, lift: -300, wind: 0.32 }),
      ],
    },
    {
      ...P4, power: "lux", title: "THE WHOLE SKY", guard: 0.8, regen: 1.3,
      blurb: "Every star in the sky joins its outline, and the Hunter stands as tall as the night. The Celestial Sphere pulls everyone in, and the Last Arrow falls on most of the arena at once.",
      body: "hsl(236 60% 6%)", glow: "hsl(44 100% 84%)", a: "hsl(236 60% 16%)", b: "hsl(44 100% 80%)", dark: "hsl(236 60% 3%)",
      moves: [
        M({ id: "celestial-sphere", name: "The Celestial Sphere", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "slow", statusDur: 0.8, wind: 0.4 }),
        M({ id: "last-arrow", name: "The Last Arrow", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 430, kb: 460, lift: -380, status: "stun", statusDur: 0.8, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  carina: [
    {
      ...P2, power: "vita", title: "THE CLOUD GLOWS", dodge: 0.12,
      blurb: "Her cloud lights up from the inside, rose and green. Twin newborn suns spin out of it, and the Mother's Pull drags whoever runs back into the gas.",
      body: "hsl(300 36% 18%)", glow: "hsl(326 100% 80%)", a: "hsl(326 100% 70%)", b: "hsl(172 90% 74%)",
      moves: [
        M({ id: "twin-suns", name: "Twin Suns", kind: "projectile", anim: "cast", range: 620, minRange: 80, cd: 3, dmg: 7, speed: 560, size: 13, count: 2, spread: 0.2, shape: "disc", status: "burn", statusDur: 0.8 }),
        M({ id: "mothers-pull", name: "Mother's Pull", kind: "pull", anim: "cast", range: 500, minRange: 110, cd: 4.5, dmg: 9, status: "slow", statusDur: 1.2, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "vita", title: "PILLARS OF CREATION", drain: 0.12,
      blurb: "Towers of dark dust rise out of the ground with new stars burning at their tips. When she is hurt, her nursery pours fresh light back into her.",
      body: "hsl(296 30% 14%)", glow: "hsl(172 100% 80%)", a: "hsl(172 90% 64%)", b: "hsl(326 100% 84%)",
      moves: [
        M({ id: "creation-pillars", name: "Creation Pillars", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 46, count: 4, lift: -680, status: "poison", statusDur: 0.8, wind: 0.38 }),
        M({ id: "rekindle", name: "Rekindle", kind: "heal", anim: "raise", range: 2000, cd: 13, dmg: 0, heal: 28, below: 0.6, wind: 0.4, act: 0.3 }),
      ],
    },
    {
      ...P4, power: "vita", title: "THE GREAT VEIL", guard: 0.8, regen: 1.3,
      blurb: "Her cloud spreads across the whole sky and the world goes dim under it. The Great Veil pulls everyone in, and Ten Thousand Suns are born at once across most of the arena.",
      body: "hsl(300 50% 8%)", glow: "hsl(326 100% 84%)", a: "hsl(300 50% 18%)", b: "hsl(172 100% 80%)", dark: "hsl(300 50% 4%)",
      moves: [
        M({ id: "great-veil", name: "The Great Veil", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "blind", statusDur: 0.5, wind: 0.4 }),
        M({ id: "ten-thousand-suns", name: "Ten Thousand Suns", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 430, kb: 460, lift: -380, status: "burn", statusDur: 0.8, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  vela: [
    {
      ...P2, power: "magneto", title: "SPIN UP", dodge: 0.14,
      blurb: "It spins faster and faster until it hums. Glass spun off its edges cuts the air, and its beam sweeps the arena like a lighthouse gone mad.",
      body: "hsl(250 24% 16%)", glow: "hsl(36 100% 74%)", a: "hsl(32 100% 64%)", b: "hsl(48 100% 90%)",
      moves: [
        M({ id: "spun-glass", name: "Spun Glass", kind: "projectile", anim: "spin", range: 600, minRange: 80, cd: 3, dmg: 6, speed: 640, size: 10, count: 5, spread: 0.3, shape: "shard", status: "slow", statusDur: 0.6 }),
        M({ id: "lighthouse-sweep", name: "Lighthouse Sweep", kind: "beam", anim: "thrust", range: 640, minRange: 70, cd: 4.2, dmg: 12, act: 0.5, status: "burn", statusDur: 1, wind: 0.34 }),
      ],
    },
    {
      ...P3, power: "magneto", title: "MAGNETAR", drain: 0.12,
      blurb: "Its magnetic field wakes up, a million million times stronger than any lodestone. Iron-black spires tear out of the glass, and a starquake shakes the whole floor.",
      body: "hsl(256 30% 12%)", glow: "hsl(276 100% 80%)", a: "hsl(276 80% 66%)", b: "hsl(32 100% 74%)",
      moves: [
        M({ id: "field-lines", name: "Field Lines", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 46, count: 4, lift: -700, status: "stun", statusDur: 0.4, wind: 0.38 }),
        M({ id: "starquake", name: "Starquake", kind: "burst", anim: "slam", range: 180, cd: 6.5, dmg: 14, radius: 190, kb: 440, lift: -300, status: "stun", statusDur: 0.5, wind: 0.34 }),
      ],
    },
    {
      ...P4, power: "magneto", title: "THE LAST TICK", guard: 0.8, regen: 1.3,
      blurb: "It spins so fast that time itself starts to keep its beat. The Sky Clock drags everyone into its rhythm, and the Final Pulse sweeps across most of the arena at once.",
      body: "hsl(250 40% 7%)", glow: "hsl(32 100% 80%)", a: "hsl(250 40% 16%)", b: "hsl(32 100% 74%)", dark: "hsl(250 40% 3%)",
      moves: [
        M({ id: "sky-clock", name: "The Sky Clock", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "slow", statusDur: 0.8, wind: 0.4 }),
        M({ id: "final-pulse", name: "The Final Pulse", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 430, kb: 480, lift: -400, status: "burn", statusDur: 0.8, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  aeon: [
    {
      ...P2, power: "lux", title: "WIDE AWAKE", dodge: 0.14,
      blurb: "Its eye opens all the way and the arena turns white at the edges. It throws its halo like a blade, and nothing it looks at can hide.",
      body: "hsl(44 40% 88%)", glow: "hsl(48 100% 74%)", a: "hsl(46 100% 64%)", b: "hsl(228 80% 56%)",
      moves: [
        M({ id: "halo-ring", name: "Halo Ring", kind: "projectile", anim: "spin", range: 620, minRange: 80, cd: 3, dmg: 9, speed: 560, size: 18, count: 1, shape: "disc", status: "slow", statusDur: 0.8 }),
        M({ id: "all-seeing", name: "All-Seeing", kind: "pull", anim: "cast", range: 520, minRange: 110, cd: 4.6, dmg: 9, status: "blind", statusDur: 0.6, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "lux", title: "THE FIRST DAWN", drain: 0.12,
      blurb: "It remembers the first morning there ever was. Spears of dawn split the ground, and when it is hurt, the light of every star it ever lit flows back into it.",
      body: "hsl(40 50% 90%)", glow: "hsl(36 100% 70%)", a: "hsl(32 100% 62%)", b: "hsl(48 100% 92%)",
      moves: [
        M({ id: "rays-of-dawn", name: "Rays of Dawn", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 46, count: 5, lift: -700, status: "burn", statusDur: 0.8, wind: 0.38 }),
        M({ id: "ageless", name: "Ageless", kind: "heal", anim: "raise", range: 2000, cd: 13, dmg: 0, heal: 30, below: 0.6, wind: 0.4, act: 0.3 }),
      ],
    },
    {
      ...P4, power: "lux", title: "EVERY STAR AT ONCE", guard: 0.8, regen: 1.4,
      blurb: "It calls every star in the sky down at once. The Gathered Heavens drag everyone into its orbit, and The Beginning, the light that started everything, fills almost the whole arena.",
      body: "hsl(48 60% 94%)", glow: "hsl(48 100% 86%)", a: "hsl(228 70% 24%)", b: "hsl(46 100% 74%)", dark: "hsl(230 60% 6%)",
      moves: [
        M({ id: "gathered-heavens", name: "Gathered Heavens", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 210, dur: 5, pullIn: 250, status: "blind", statusDur: 0.5, wind: 0.4 }),
        M({ id: "the-beginning", name: "The Beginning", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 17, radius: 440, kb: 500, lift: -420, status: "burn", statusDur: 0.9, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  orogen: [
    {
      ...P2, power: "terra", title: "THE PEAKS RISE", dodge: 0.08,
      blurb: "Its shoulders push up into new peaks, snow on their tops. It hurls whole crags, and the ground under you tilts toward it.",
      body: "hsl(30 10% 28%)", glow: "hsl(150 90% 66%)", a: "hsl(28 12% 44%)", b: "hsl(150 90% 70%)",
      moves: [
        M({ id: "crag-throw", name: "Crag Throw", kind: "projectile", anim: "slam", range: 620, minRange: 90, cd: 3.2, dmg: 12, speed: 460, size: 18, count: 1, shape: "rock", kb: 380, lift: -240, wind: 0.32 }),
        M({ id: "tilting-ground", name: "Tilting Ground", kind: "zone", anim: "slam", range: 420, cd: 9, dmg: 6, radius: 150, dur: 4.5, pullIn: 150, status: "slow", statusDur: 0.8, wind: 0.36 }),
      ],
    },
    {
      ...P3, power: "terra", title: "THE JADE VEIN", drain: 0.12,
      blurb: "The green seam in its chest cracks open and the mountain's heart shows through. Jade light runs along the ground, and when it is hurt, the rock grows back over the wound.",
      body: "hsl(150 14% 22%)", glow: "hsl(150 100% 70%)", a: "hsl(150 60% 40%)", b: "hsl(150 100% 80%)",
      moves: [
        M({ id: "jade-vein", name: "Jade Vein", kind: "beam", anim: "thrust", range: 600, minRange: 70, cd: 3.6, dmg: 14, act: 0.36, status: "stun", statusDur: 0.35, wind: 0.32 }),
        M({ id: "bedrock", name: "Bedrock", kind: "heal", anim: "raise", range: 2000, cd: 13, dmg: 0, heal: 30, below: 0.6, wind: 0.4, act: 0.3 }),
      ],
    },
    {
      ...P4, power: "terra", title: "THE WORLD'S SPINE", guard: 0.82, regen: 1.3,
      blurb: "It stands up to its full height, a whole range from end to end. The plates of the world grind together under it, and Mountainfall drops the sky's worth of stone on most of the arena at once.",
      body: "hsl(28 14% 16%)", glow: "hsl(150 100% 74%)", a: "hsl(28 14% 26%)", b: "hsl(150 100% 76%)", dark: "hsl(28 14% 6%)",
      moves: [
        M({ id: "plate-grind", name: "Plate Grind", kind: "blink", anim: "kick", range: 560, minRange: 130, cd: 4.4, dmg: 14, kb: 340, lift: -280, status: "stun", statusDur: 0.4 }),
        M({ id: "mountainfall", name: "Mountainfall", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 17, radius: 430, kb: 500, lift: -420, status: "stun", statusDur: 0.8, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  gnarlroot: [
    {
      ...P2, power: "vita", title: "IN LEAF", dodge: 0.1,
      blurb: "Its bare branches burst into leaf all at once. Seed pods split and scatter, and it strides across the arena on a wave of roots.",
      body: "hsl(26 30% 18%)", glow: "hsl(96 90% 64%)", a: "hsl(96 60% 42%)", b: "hsl(80 100% 74%)",
      moves: [
        M({ id: "seed-burst", name: "Seed Burst", kind: "rain", anim: "raise", range: 540, cd: 5.4, dmg: 8, count: 7, radius: 180, size: 10, status: "poison", statusDur: 0.8, wind: 0.34 }),
        M({ id: "root-wave", name: "Root Wave", kind: "dash", anim: "lunge", range: 540, minRange: 90, cd: 4.6, dmg: 14, kb: 400, lift: -260, wind: 0.3 }),
      ],
    },
    {
      ...P3, power: "vita", title: "THE HEARTWOOD", drain: 0.14,
      blurb: "Its bark splits down the middle and the heartwood shows, glowing gold-green. Sap runs out of it like a beam of light, and its roots drink back whatever it takes.",
      body: "hsl(30 34% 14%)", glow: "hsl(70 100% 64%)", a: "hsl(40 80% 50%)", b: "hsl(80 100% 76%)",
      moves: [
        M({ id: "sap-beam", name: "Sap Beam", kind: "beam", anim: "thrust", range: 580, minRange: 70, cd: 3.6, dmg: 14, act: 0.36, status: "slow", statusDur: 1, wind: 0.32 }),
        M({ id: "deep-roots", name: "Deep Roots", kind: "blink", anim: "kick", range: 560, minRange: 130, cd: 4.4, dmg: 13, kb: 300, lift: -260, status: "stun", statusDur: 0.4 }),
      ],
    },
    {
      ...P4, power: "vita", title: "THE WORLD TREE", guard: 0.8, regen: 1.5,
      blurb: "Its crown spreads over the whole sky and the light goes green. The Canopy closes in around everyone, and Overgrowth bursts up across most of the arena at once.",
      body: "hsl(28 30% 9%)", glow: "hsl(92 100% 70%)", a: "hsl(28 30% 20%)", b: "hsl(92 100% 72%)", dark: "hsl(28 30% 4%)",
      moves: [
        M({ id: "the-canopy", name: "The Canopy", kind: "zone", anim: "raise", range: 440, cd: 10, dmg: 7, radius: 200, dur: 5, pullIn: 240, status: "blind", statusDur: 0.5, wind: 0.4 }),
        M({ id: "overgrowth", name: "Overgrowth", kind: "burst", anim: "slam", range: 480, cd: 12, dmg: 16, radius: 430, kb: 460, lift: -400, status: "poison", statusDur: 1, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
  ambrel: [
    {
      ...P2, power: "chrono", title: "THE COMB", dodge: 0.14,
      blurb: "Honeycomb grows over its shoulders, cell by golden cell. Old wasps of amber wake inside and fly at whoever is nearest, and the comb pulls the slow ones closer.",
      body: "hsl(32 80% 32%)", glow: "hsl(46 100% 70%)", a: "hsl(38 100% 52%)", b: "hsl(48 100% 82%)",
      moves: [
        M({ id: "amber-wasps", name: "Amber Wasps", kind: "rain", anim: "raise", range: 540, cd: 5.2, dmg: 8, count: 7, radius: 180, size: 9, status: "poison", statusDur: 0.8, wind: 0.34 }),
        M({ id: "honey-pull", name: "Honey Pull", kind: "pull", anim: "cast", range: 500, minRange: 110, cd: 4.6, dmg: 9, status: "slow", statusDur: 1.2, wind: 0.26 }),
      ],
    },
    {
      ...P3, power: "chrono", title: "THE KEPT HOURS", drain: 0.12,
      blurb: "Things it has kept for an age drift up out of its body: leaves, feathers, a beetle, a bird mid-song. Gold spikes burst from the floor, and when it is hurt it seals the wound in fresh resin.",
      body: "hsl(28 80% 26%)", glow: "hsl(40 100% 66%)", a: "hsl(30 90% 44%)", b: "hsl(46 100% 80%)",
      moves: [
        M({ id: "golden-spikes", name: "Golden Spikes", kind: "eruption", anim: "slam", range: 560, minRange: 40, cd: 6, dmg: 13, radius: 46, count: 4, lift: -680, status: "freeze", statusDur: 0.4, wind: 0.38 }),
        M({ id: "fresh-resin", name: "Fresh Resin", kind: "heal", anim: "raise", range: 2000, cd: 13, dmg: 0, heal: 28, below: 0.6, wind: 0.4, act: 0.3 }),
      ],
    },
    {
      ...P4, power: "chrono", title: "FOR EVER", guard: 0.8, regen: 1.3,
      blurb: "The whole cavern turns to gold around it, and the air itself starts to set. Still Gold closes in on everyone, and Sealed for Ever floods most of the arena in amber at once.",
      body: "hsl(28 80% 14%)", glow: "hsl(44 100% 74%)", a: "hsl(30 80% 22%)", b: "hsl(46 100% 76%)", dark: "hsl(28 80% 5%)",
      moves: [
        M({ id: "still-gold", name: "Still Gold", kind: "dash", anim: "lunge", range: 560, minRange: 90, cd: 4.6, dmg: 15, kb: 420, lift: -260, status: "slow", statusDur: 1, wind: 0.3 }),
        M({ id: "sealed-for-ever", name: "Sealed for Ever", kind: "burst", anim: "raise", range: 480, cd: 12, dmg: 16, radius: 430, kb: 460, lift: -380, status: "freeze", statusDur: 0.9, wind: 0.55, rec: 0.35 }),
      ],
    },
  ],
};
