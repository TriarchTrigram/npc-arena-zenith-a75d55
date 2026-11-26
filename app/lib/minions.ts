// The Story bosses' minions. Each chapter's boss sends four kinds: a grunt, a caster, a brute and one
// lieutenant who guards the gate before the boss. Every minion has a power of its own: its own name, its own
// moves and its own colours. Underneath it fights like one roster element (its `id`, which gives it that
// element's voice, entrance and move shapes), and it carries one move of its boss's energy: a smaller copy of
// one of the boss's own attacks, drawn in the boss's colours. Its gear is drawn by the engine from `minion`.
import { BOSSES, type BossId } from "./bosses";
import { DEF_BY_ID, type FighterDef, type MinionKind, type Move, type MoveKind, type Power, type Role } from "./fighters";
import { borrowLook } from "./move-looks";

const HP: Record<MinionKind, number> = { grunt: 90, caster: 80, brute: 125, elite: 165 };
const SPEED: Record<MinionKind, number> = { grunt: 1.06, caster: 0.96, brute: 0.84, elite: 1 };
const ROLE: Record<MinionKind, Role> = { grunt: "attacker", caster: "control", brute: "tank", elite: "attacker" };

const CLOSE: MoveKind[] = ["melee", "dash", "blink"];
const FAR: MoveKind[] = ["projectile", "beam", "rain", "zone", "pull", "eruption"];
const HEAVY: MoveKind[] = ["melee", "burst", "eruption", "dash"];

/** The move shapes a minion fights with: grunts close in, casters keep their distance, brutes hit hard. A lieutenant has them all. */
function movesFor(kind: MinionKind, all: Move[]): Move[] {
  if (kind === "elite") return all;
  const want = kind === "grunt" ? CLOSE : kind === "caster" ? FAR : HEAVY;
  const size = kind === "caster" ? 4 : 3;
  const picked = all.filter((m) => want.includes(m.kind)).slice(0, size);
  // a caster still has one way to hit up close
  if (kind === "caster" && !picked.some((m) => m.kind === "melee")) {
    const melee = all.find((m) => m.kind === "melee");
    if (melee) picked.unshift(melee);
  }
  for (const m of all) if (picked.length < size && !picked.includes(m)) picked.push(m);
  return picked;
}

/** A minion's share of its boss's energy: the boss's move, smaller, slower to come back and weaker. */
function surgeOf(boss: FighterDef, from: string, id: string, name: string): Move {
  const src = boss.moves.find((m) => m.id === from) ?? boss.moves[0];
  const cut = (v: number | undefined, k: number) => (v == null ? v : Math.round(v * k));
  return {
    ...src,
    id, name,
    power: boss.id,
    dmg: Math.max(3, Math.round(src.dmg * 0.6)),
    cd: Math.round(src.cd * 1.5 * 10) / 10,
    kb: cut(src.kb, 0.75),
    lift: cut(src.lift, 0.8),
    radius: cut(src.radius, 0.8),
    count: src.count && src.count > 1 ? Math.max(2, Math.ceil(src.count * 0.6)) : src.count,
    dur: src.dur ? Math.round(src.dur * 0.7 * 10) / 10 : src.dur,
    pullIn: cut(src.pullIn, 0.7),
    statusDur: src.statusDur ? Math.round(src.statusDur * 0.7 * 100) / 100 : src.statusDur,
    heal: src.heal ? Math.max(1, Math.round(src.heal * 0.5)) : src.heal,
  };
}

type Spec = {
  /** The roster element it fights like. */
  base: Power;
  name: string;
  /** Body colour, and the boss's glowing colour it wears. */
  color: string;
  mark: string;
  /** Its own power. */
  power: string;
  ability: string;
  /** Its own moves' colours: body and highlight. */
  tone: [string, string];
  /** Its own names for its moves, in the order movesFor picks them. */
  moves: string[];
  /** The boss move it borrows energy from, and what it calls its copy. */
  surge: { from: string; name: string };
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function minion(kind: MinionKind, boss: BossId, s: Spec): FighterDef {
  const d = DEF_BY_ID[s.base];
  const b = BOSSES[boss];
  const key = `minion-${slug(s.name)}`;
  const own = movesFor(kind, d.moves).map((m, i) => {
    const id = `${key}-${i}`;
    borrowLook(id, m.id, s.tone[0], s.tone[1]);
    return { ...m, id, name: s.moves[i] ?? m.name };
  });
  const surgeId = `${key}-surge`;
  borrowLook(surgeId, s.surge.from, b.glow, b.color);
  const surge = surgeOf(b, s.surge.from, surgeId, s.surge.name);
  return {
    id: s.base, name: s.name, power: s.power, role: ROLE[kind], ability: s.ability,
    color: s.color, glow: s.mark, hp: HP[kind], speed: Math.round(d.speed * SPEED[kind]),
    moves: [...own, surge],
    minion: { kind, mark: s.mark },
  };
}

type Crew = Record<MinionKind, FighterDef>;

/** Each chapter's minions, in chapter order. */
export const MINIONS: Crew[] = [
  // Chapter 1: Nullshade's shadows from the rift
  {
    grunt: minion("grunt", "nullshade", {
      base: "umbra", name: "Voidling", color: "hsl(268 34% 26%)", mark: "hsl(186 100% 70%)",
      power: "Hungry Dark", ability: "Gnaws with teeth of living shadow and slips through the dark to bite again.",
      tone: ["hsl(272 60% 34%)", "hsl(280 90% 76%)"], moves: ["Shadow Gnaw", "Dark Slip", "Hunger Orb"],
      surge: { from: "positron-palm", name: "Positron Bite" },
    }),
    caster: minion("caster", "nullshade", {
      base: "psy", name: "Null Acolyte", color: "hsl(276 30% 34%)", mark: "hsl(186 100% 70%)",
      power: "Hollow Chant", ability: "Chants minds empty: whispers that lift, ring out and crush.",
      tone: ["hsl(250 50% 46%)", "hsl(230 100% 84%)"], moves: ["Hush Palm", "Rising Chant", "Empty Whisper", "Silence Crush"],
      surge: { from: "pair-burst", name: "Pair Spark" },
    }),
    brute: minion("brute", "nullshade", {
      base: "gravi", name: "Rift Brute", color: "hsl(262 36% 20%)", mark: "hsl(186 100% 70%)",
      power: "Rift Weight", ability: "Carries a piece of the rift on its back. It drags in and sinks whatever comes near.",
      tone: ["hsl(258 40% 28%)", "hsl(264 70% 70%)"], moves: ["Rift Hammer", "Sinking Pit", "Rift Drag"],
      surge: { from: "zero-point", name: "Zero Slam" },
    }),
    elite: minion("elite", "nullshade", {
      base: "tele", name: "Shade Herald", color: "hsl(268 40% 16%)", mark: "hsl(186 100% 76%)",
      power: "Herald Step", ability: "Steps between shadows to announce its master, striking from where it stood a moment ago.",
      tone: ["hsl(284 45% 30%)", "hsl(300 80% 80%)"], moves: ["Herald's Heel", "Summons Bolt", "Procession", "Proclamation"],
      surge: { from: "annihilation", name: "Small Annihilation" },
    }),
  },
  // Chapter 2: Maelstrom's sea creatures
  {
    grunt: minion("grunt", "maelstrom", {
      base: "hydro", name: "Brine Imp", color: "hsl(196 62% 38%)", mark: "hsl(176 90% 62%)",
      power: "Salt Spray", ability: "Spits stinging brine and lashes out with seaweed.",
      tone: ["hsl(168 60% 38%)", "hsl(150 70% 78%)"], moves: ["Brine Jab", "Kelp Lash", "Salt Surge"],
      surge: { from: "trident-rake", name: "Trident Jab" },
    }),
    caster: minion("caster", "maelstrom", {
      base: "electro", name: "Squall Caller", color: "hsl(212 48% 42%)", mark: "hsl(186 100% 72%)",
      power: "Sea Squall", ability: "Calls rain-soaked lightning down from the clouds over the waves.",
      tone: ["hsl(220 70% 56%)", "hsl(205 100% 88%)"], moves: ["Static Slap", "Squall Bolt", "Drifting Spark", "Downpour"],
      surge: { from: "thunderhead", name: "Squall Cloud" },
    }),
    brute: minion("brute", "maelstrom", {
      base: "terra", name: "Reef Brute", color: "hsl(184 40% 30%)", mark: "hsl(14 90% 64%)",
      power: "Living Coral", ability: "Its body is a reef: coral fists, and coral spears from the sea floor.",
      tone: ["hsl(10 70% 56%)", "hsl(30 100% 80%)"], moves: ["Coral Fist", "Reef Spear", "Seabed Stomp"],
      surge: { from: "tidal-wall", name: "Reef Wave" },
    }),
    elite: minion("elite", "maelstrom", {
      base: "aero", name: "Tide Captain", color: "hsl(204 70% 30%)", mark: "hsl(186 100% 76%)",
      power: "Sea Wind", ability: "Steers the sea wind like a sail: cutting gusts, a spinning rush and a spout that throws enemies overboard.",
      tone: ["hsl(190 60% 50%)", "hsl(180 80% 90%)"], moves: ["Boarding Kick", "Gust Cutlass", "Keelhaul Spin", "Overboard"],
      surge: { from: "eye-of-the-storm", name: "Storm Eye" },
    }),
  },
  // Chapter 3: Magmaw's fire-born
  {
    grunt: minion("grunt", "magmaw", {
      base: "pyro", name: "Cinder Imp", color: "hsl(14 64% 36%)", mark: "hsl(34 100% 58%)",
      power: "Cinders", ability: "Flicks hot cinders and starts small fires underfoot.",
      tone: ["hsl(36 95% 52%)", "hsl(52 100% 72%)"], moves: ["Cinder Flick", "Spark Lob", "Kindling"],
      surge: { from: "magma-bite", name: "Magma Nip" },
    }),
    caster: minion("caster", "magmaw", {
      base: "lux", name: "Ash Priest", color: "hsl(20 14% 38%)", mark: "hsl(28 100% 58%)",
      power: "Ashlight", ability: "Prays in smoke and ash. Its light comes through the haze dim and grey, and still burns.",
      tone: ["hsl(24 20% 50%)", "hsl(36 60% 80%)"], moves: ["Ash Palm", "Smoke Ray", "Ashfall", "Pyre Blessing"],
      surge: { from: "lava-bombs", name: "Lava Hail" },
    }),
    brute: minion("brute", "magmaw", {
      base: "terra", name: "Basalt Golem", color: "hsl(12 18% 22%)", mark: "hsl(24 100% 54%)",
      power: "Cooled Lava", ability: "Made of cooled lava. Its fists are black stone and its stomp cracks the floor.",
      tone: ["hsl(0 0% 26%)", "hsl(20 40% 60%)"], moves: ["Basalt Fist", "Obsidian Spike", "Golem Stomp"],
      surge: { from: "fault-line", name: "Fault Crack" },
    }),
    elite: minion("elite", "magmaw", {
      base: "gravi", name: "Caldera Warden", color: "hsl(12 30% 20%)", mark: "hsl(40 100% 60%)",
      power: "Crater Pull", ability: "Guards the crater. It pulls enemies into the pit and drops the rim down on them.",
      tone: ["hsl(16 50% 34%)", "hsl(30 90% 66%)"], moves: ["Warden's Palm", "Crater Pit", "Rim Pull", "Rockslide"],
      surge: { from: "volcanic-roar", name: "Caldera Roar" },
    }),
  },
  // Chapter 4: Everwinter's frozen servants
  {
    grunt: minion("grunt", "everwinter", {
      base: "cryo", name: "Frostling", color: "hsl(200 56% 70%)", mark: "hsl(196 100% 90%)",
      power: "Frostbite", ability: "A small thing of snow that nips at ankles and throws icicles.",
      tone: ["hsl(190 70% 80%)", "hsl(0 0% 100%)"], moves: ["Frost Nip", "Icicle Toss", "Snow Spike"],
      surge: { from: "rime-sickle", name: "Rime Claw" },
    }),
    caster: minion("caster", "everwinter", {
      base: "chrono", name: "Stopped Seer", color: "hsl(214 30% 56%)", mark: "hsl(44 90% 68%)",
      power: "Frozen Hour", ability: "Sees only the moment that stopped, and tries to keep everyone stuck in it.",
      tone: ["hsl(214 40% 64%)", "hsl(48 80% 82%)"], moves: ["Still Hand", "Stuck Second", "Frozen Moment", "Rewound Breath"],
      surge: { from: "hourglass-icicles", name: "Hourglass Sleet" },
    }),
    brute: minion("brute", "everwinter", {
      base: "cryo", name: "Glacier Ogre", color: "hsl(206 40% 60%)", mark: "hsl(196 100% 88%)",
      power: "Glacier Bulk", ability: "Hits like a sliding glacier and hurls whole chunks of ice.",
      tone: ["hsl(204 50% 62%)", "hsl(196 90% 90%)"], moves: ["Glacier Palm", "Ice Shelf", "Hailstone Heave"],
      surge: { from: "glacial-age", name: "Rime Ground" },
    }),
    elite: minion("elite", "everwinter", {
      base: "chrono", name: "Hourglass Knight", color: "hsl(206 50% 76%)", mark: "hsl(44 90% 64%)",
      power: "Frozen Sand", ability: "Its hourglass runs with frozen sand, and every swing steals a second.",
      tone: ["hsl(40 50% 64%)", "hsl(200 90% 90%)"], moves: ["Hourglass Edge", "Sand Bolt", "Stopped Glass", "Turn the Glass"],
      surge: { from: "rime-step", name: "Frozen Second" },
    }),
  },
  // Chapter 5: the Riftmaker's twisted things
  {
    grunt: minion("grunt", "riftmaker", {
      base: "shift", name: "Rift Sprite", color: "hsl(286 40% 30%)", mark: "hsl(318 100% 72%)",
      power: "Misshapen", ability: "Its body never holds a shape: limbs turn into blades, and it copies the last move that hit it.",
      tone: ["hsl(300 70% 56%)", "hsl(320 100% 86%)"], moves: ["Twist Strike", "Bent Blade", "Funhouse Mirror"],
      surge: { from: "fold-strike", name: "Fold Pinch" },
    }),
    caster: minion("caster", "riftmaker", {
      base: "psy", name: "Mirage Mage", color: "hsl(252 32% 30%)", mark: "hsl(318 100% 76%)",
      power: "Mirage", ability: "Shows enemies things that are not there, then makes them real enough to hurt.",
      tone: ["hsl(270 60% 64%)", "hsl(190 100% 84%)"], moves: ["Phantom Palm", "False Floor", "Shimmer Wave", "Vanishing Point"],
      surge: { from: "mirror-shards", name: "Mirror Splinters" },
    }),
    brute: minion("brute", "riftmaker", {
      base: "gravi", name: "Gravity Hulk", color: "hsl(246 30% 20%)", mark: "hsl(300 90% 68%)",
      power: "Wrong Weight", ability: "Where it stands, down is the wrong way, and enemies fall sideways into it.",
      tone: ["hsl(240 40% 30%)", "hsl(280 70% 72%)"], moves: ["Heavy Fist", "Sideways Well", "Wrong-Way Pull"],
      surge: { from: "unmake", name: "Unmaking Slam" },
    }),
    elite: minion("elite", "riftmaker", {
      base: "tele", name: "Fold Walker", color: "hsl(252 30% 14%)", mark: "hsl(318 100% 72%)",
      power: "Paper Space", ability: "Folds space like paper and walks across the crease.",
      tone: ["hsl(260 50% 40%)", "hsl(330 90% 82%)"], moves: ["Crease Kick", "Folded Shot", "Paper Cuts", "Unfold"],
      surge: { from: "dimension-tear", name: "Tear in Space" },
    }),
  },
  // Chapter 6: the Hollow King's undead court
  {
    grunt: minion("grunt", "hollowking", {
      base: "umbra", name: "Hollow Squire", color: "hsl(170 10% 30%)", mark: "hsl(152 92% 60%)",
      power: "Grave Shade", ability: "A dead knight's squire, still swinging a sword made of grave shadow.",
      tone: ["hsl(160 20% 28%)", "hsl(150 40% 70%)"], moves: ["Rusted Cut", "Grave Step", "Tomb Orb"],
      surge: { from: "reaper-scythe", name: "Squire's Scythe" },
    }),
    caster: minion("caster", "hollowking", {
      base: "toxi", name: "Plague Monk", color: "hsl(110 16% 28%)", mark: "hsl(96 90% 56%)",
      power: "Crypt Rot", ability: "Swings a censer of crypt rot that sickens everything around it.",
      tone: ["hsl(80 50% 40%)", "hsl(70 80% 70%)"], moves: ["Rot Touch", "Bile Spit", "Censer Smoke", "Plague Bell"],
      surge: { from: "wailing-souls", name: "Wailing Breath" },
    }),
    brute: minion("brute", "hollowking", {
      base: "terra", name: "Crypt Brute", color: "hsl(40 10% 40%)", mark: "hsl(152 92% 60%)",
      power: "Bone Pile", ability: "Built from crypt stone and old bones: fists of bone, and bones that burst from the floor.",
      tone: ["hsl(40 20% 66%)", "hsl(45 40% 90%)"], moves: ["Bone Fist", "Ossuary Spikes", "Crypt Quake"],
      surge: { from: "grave-hands", name: "Grasping Dead" },
    }),
    elite: minion("elite", "hollowking", {
      base: "psy", name: "Pale Regent", color: "hsl(170 14% 18%)", mark: "hsl(152 92% 66%)",
      power: "Dead Will", ability: "Rules the court while the king sleeps. Its will reaches into living minds.",
      tone: ["hsl(180 20% 56%)", "hsl(170 50% 88%)"], moves: ["Royal Touch", "Raise the Dead", "Decree", "Pale Command"],
      surge: { from: "soul-chains", name: "Regent's Chains" },
    }),
  },
  // Chapter 7: the Black Sun's eclipse cult
  {
    grunt: minion("grunt", "blacksun", {
      base: "pyro", name: "Sunspot Imp", color: "hsl(22 40% 24%)", mark: "hsl(40 100% 62%)",
      power: "Sunspots", ability: "Throws the dark spots from the sun's face, which burn far hotter than they look.",
      tone: ["hsl(10 80% 40%)", "hsl(30 100% 64%)"], moves: ["Spot Burn", "Sunspot", "Dark Flame"],
      surge: { from: "corona-edge", name: "Corona Scratch" },
    }),
    caster: minion("caster", "blacksun", {
      base: "lux", name: "Eclipse Priest", color: "hsl(30 20% 16%)", mark: "hsl(44 100% 66%)",
      power: "Crescent Light", ability: "Worships the sun gone dark. Its light only comes through a narrow crescent.",
      tone: ["hsl(36 60% 46%)", "hsl(48 100% 80%)"], moves: ["Crescent Palm", "Crescent Ray", "Corona Shards", "Shadowed Halo"],
      surge: { from: "eclipse-disc", name: "Dark Disc" },
    }),
    brute: minion("brute", "blacksun", {
      base: "electro", name: "Flare Hulk", color: "hsl(16 50% 28%)", mark: "hsl(30 100% 58%)",
      power: "Solar Storm", ability: "Crackles with the storm a solar flare throws off.",
      tone: ["hsl(26 100% 52%)", "hsl(50 100% 80%)"], moves: ["Flare Knuckle", "Storm Ray", "Plasma Ball"],
      surge: { from: "prominence", name: "Solar Geyser" },
    }),
    elite: minion("elite", "blacksun", {
      base: "umbra", name: "Dusk Paladin", color: "hsl(30 30% 10%)", mark: "hsl(40 100% 64%)",
      power: "Dusk Oath", ability: "Swore itself to the last hour of light. Half its blade is sunset, half is night.",
      tone: ["hsl(16 60% 26%)", "hsl(30 90% 70%)"], moves: ["Dusk Blade", "Twilight Step", "Sunset Orb", "Nightfall"],
      surge: { from: "solar-flare", name: "Dusk Flare" },
    }),
  },
  // Chapter 8: the Axiom's cosmic constructs
  {
    grunt: minion("grunt", "axiom", {
      base: "magneto", name: "Proof Drone", color: "hsl(232 36% 30%)", mark: "hsl(272 100% 80%)",
      power: "Logic Field", ability: "Holds its pieces together with a field of pure logic, and pulls enemies into line.",
      tone: ["hsl(210 40% 56%)", "hsl(200 90% 86%)"], moves: ["Iron Lemma", "Axiom Shards", "Fall in Line"],
      surge: { from: "galaxy-fist", name: "Star Knuckle" },
    }),
    caster: minion("caster", "axiom", {
      base: "tele", name: "Theorem Caster", color: "hsl(250 40% 24%)", mark: "hsl(200 100% 76%)",
      power: "Proof Steps", ability: "Moves only in proven steps, and arrives exactly where the proof says.",
      tone: ["hsl(196 70% 50%)", "hsl(180 100% 86%)"], moves: ["Given Shot", "Therefore Kick", "Step by Step", "Q.E.D."],
      surge: { from: "star-shower", name: "Falling Proofs" },
    }),
    brute: minion("brute", "axiom", {
      base: "gravi", name: "Constant Golem", color: "hsl(236 40% 16%)", mark: "hsl(272 100% 76%)",
      power: "Constant Mass", ability: "A weight that never changes, whatever hits it.",
      tone: ["hsl(230 40% 36%)", "hsl(250 80% 80%)"], moves: ["Constant Fist", "Fixed Point", "Inverse Pull"],
      surge: { from: "event-horizon", name: "Small Horizon" },
    }),
    elite: minion("elite", "axiom", {
      base: "chrono", name: "The Paradox", color: "hsl(236 55% 11%)", mark: "hsl(272 100% 82%)",
      power: "Paradox", ability: "Remembers fights that have not happened yet, and wins them twice.",
      tone: ["hsl(290 50% 52%)", "hsl(48 100% 80%)"], moves: ["Before Strike", "After Bolt", "Loop", "Undo"],
      surge: { from: "wormhole-step", name: "Wormhole Lunge" },
    }),
  },
  // Book 2, chapter 1: the Lanternmaw's drowned congregation
  {
    grunt: minion("grunt", "lanternmaw", {
      base: "hydro", name: "Deepling", color: "hsl(190 40% 20%)", mark: "hsl(66 100% 64%)",
      power: "Brine Claws", ability: "Crawled up out of the black water with claws that never dry.",
      tone: ["hsl(184 60% 30%)", "hsl(170 80% 72%)"], moves: ["Brine Claw", "Kelp Lash", "Black Tide"],
      surge: { from: "hook-rake", name: "Little Hook" },
    }),
    caster: minion("caster", "lanternmaw", {
      base: "psy", name: "Tide Whisperer", color: "hsl(200 30% 22%)", mark: "hsl(66 100% 64%)",
      power: "Undersong", ability: "Sings the song it hears from under the sea, and the song lifts whoever hears it.",
      tone: ["hsl(160 50% 38%)", "hsl(150 90% 80%)"], moves: ["Hymn Strike", "Rising Hymn", "Drowned Verse", "Last Chorus"],
      surge: { from: "drowned-whispers", name: "Whisper Swarm" },
    }),
    brute: minion("brute", "lanternmaw", {
      base: "toxi", name: "Hullbreaker", color: "hsl(170 25% 16%)", mark: "hsl(66 100% 64%)",
      power: "Rot Tide", ability: "A shipwreck that walked out of the sea, dripping a rot that eats through armour.",
      tone: ["hsl(96 40% 30%)", "hsl(80 80% 64%)"], moves: ["Barnacle Fist", "Bilge Burst", "Rot Spit"],
      surge: { from: "abyssal-coil", name: "Coil Snap" },
    }),
    elite: minion("elite", "lanternmaw", {
      base: "umbra", name: "The Lamplighter", color: "hsl(196 50% 10%)", mark: "hsl(64 100% 70%)",
      power: "Drowned Lamp", ability: "Lights the way down for the Lanternmaw. Wherever its lamp points, the dark follows.",
      tone: ["hsl(210 50% 22%)", "hsl(64 100% 72%)"], moves: ["Lamp Hook", "Wick Step", "Drowned Flame", "Lights Out"],
      surge: { from: "lantern-gaze", name: "Lamp Gaze" },
    }),
  },
  // Book 2, chapter 2: the Sporemother's choir, everything the rot has taken
  {
    grunt: minion("grunt", "sporemother", {
      base: "flora", name: "Sporeling", color: "hsl(316 22% 26%)", mark: "hsl(170 100% 64%)",
      power: "Cap Bite", ability: "A walking mushroom with a mouth under its cap. It bites and leaves spores in the wound.",
      tone: ["hsl(330 40% 44%)", "hsl(330 90% 82%)"], moves: ["Cap Bite", "Stalk Hop", "Puffball"],
      surge: { from: "spore-lash", name: "Little Lash" },
    }),
    caster: minion("caster", "sporemother", {
      base: "sono", name: "Choir Husk", color: "hsl(300 16% 30%)", mark: "hsl(170 100% 64%)",
      power: "Borrowed Voice", ability: "Once a traveller in the wood. Now it only sings the hive's song, loud enough to knock you flat.",
      tone: ["hsl(190 50% 40%)", "hsl(180 100% 84%)"], moves: ["Hollow Note", "Hush Wave", "Sour Chord", "Pull of the Song"],
      surge: { from: "choir-spores", name: "Spore Verse" },
    }),
    brute: minion("brute", "sporemother", {
      base: "terra", name: "Rotwood Giant", color: "hsl(24 26% 18%)", mark: "hsl(170 100% 64%)",
      power: "Bark Rot", ability: "An old oak the fungus wears like armour. It hits like a falling tree.",
      tone: ["hsl(28 34% 30%)", "hsl(90 60% 64%)"], moves: ["Stump Fist", "Root Quake", "Rot Boulder"],
      surge: { from: "mycelium-bloom", name: "Rot Bloom" },
    }),
    elite: minion("elite", "sporemother", {
      base: "toxi", name: "The Gardener", color: "hsl(312 30% 14%)", mark: "hsl(166 100% 70%)",
      power: "Blight Shears", ability: "Tends the Sporemother's garden and cuts down anything that will not grow the right way.",
      tone: ["hsl(300 40% 30%)", "hsl(166 100% 70%)"], moves: ["Shear Snip", "Blight Spray", "Weed Out", "Mulch"],
      surge: { from: "hive-song", name: "Garden Hymn" },
    }),
  },
  // Book 2, chapter 3: the Mnemovore's forgotten, people with their faces worn away
  {
    grunt: minion("grunt", "mnemovore", {
      base: "shift", name: "Faceless", color: "hsl(262 12% 34%)", mark: "hsl(300 100% 82%)",
      power: "Worn Away", ability: "Someone the Mnemovore finished with. It forgot its own face, so it borrows yours.",
      tone: ["hsl(270 20% 50%)", "hsl(300 60% 88%)"], moves: ["Blank Jab", "Copy Swipe", "Mimic"],
      surge: { from: "forget-touch", name: "Dull Touch" },
    }),
    caster: minion("caster", "mnemovore", {
      base: "chrono", name: "Archivist", color: "hsl(250 16% 26%)", mark: "hsl(300 100% 82%)",
      power: "Torn Pages", ability: "Rips pages out of the city's records and throws the moments written on them.",
      tone: ["hsl(40 30% 70%)", "hsl(300 100% 88%)"], moves: ["Page Cut", "Lost Hour", "Torn Minute", "Ink Blot"],
      surge: { from: "stolen-moments", name: "Stolen Second" },
    }),
    brute: minion("brute", "mnemovore", {
      base: "magneto", name: "Statue Keeper", color: "hsl(220 8% 36%)", mark: "hsl(300 100% 82%)",
      power: "Stone Memory", ability: "A statue of a hero nobody remembers, still guarding a square nobody visits.",
      tone: ["hsl(210 10% 54%)", "hsl(220 20% 84%)"], moves: ["Plinth Smash", "Stone Pull", "Toppling Blow"],
      surge: { from: "blank-page", name: "Blank Slam" },
    }),
    elite: minion("elite", "mnemovore", {
      base: "tele", name: "The Understudy", color: "hsl(270 20% 16%)", mark: "hsl(306 100% 86%)",
      power: "Stolen Life", ability: "Wears a life the Mnemovore ate and plays it perfectly. It steps in wherever someone was forgotten.",
      tone: ["hsl(290 40% 34%)", "hsl(306 100% 86%)"], moves: ["Cue Strike", "Exit Left", "Spotlight", "Curtain Fall"],
      surge: { from: "unremember", name: "Forgotten Step" },
    }),
  },
  // Book 2, chapter 4: the Dustmoth's brood, things that crawled out of the moon dust
  {
    grunt: minion("grunt", "dustmoth", {
      base: "velo", name: "Mothling", color: "hsl(34 14% 30%)", mark: "hsl(208 100% 84%)",
      power: "Flutter Rush", ability: "Fast, small and always flying at the brightest thing it can see.",
      tone: ["hsl(36 24% 52%)", "hsl(46 60% 84%)"], moves: ["Flutter Jab", "Wing Rush", "Dart"],
      surge: { from: "wing-cut", name: "Dust Cut" },
    }),
    caster: minion("caster", "dustmoth", {
      base: "lux", name: "Lamp Moth", color: "hsl(40 16% 34%)", mark: "hsl(208 100% 84%)",
      power: "Stolen Glow", ability: "Swallowed so much moonlight it glows. It spits the light back out as bolts.",
      tone: ["hsl(208 60% 70%)", "hsl(0 0% 100%)"], moves: ["Glow Jab", "Moonbolt", "Pale Flash", "Night Lances"],
      surge: { from: "moon-dust", name: "Moon Puff" },
    }),
    brute: minion("brute", "dustmoth", {
      base: "aero", name: "Cocoon Hulk", color: "hsl(36 12% 40%)", mark: "hsl(208 100% 84%)",
      power: "Silk Armour", ability: "Never finished hatching. It wraps itself in silk thick enough to stop a sword.",
      tone: ["hsl(40 20% 76%)", "hsl(40 40% 92%)"], moves: ["Silk Slam", "Cocoon Roll", "Thread Gust"],
      surge: { from: "wingbeat", name: "Heavy Wingbeat" },
    }),
    elite: minion("elite", "dustmoth", {
      base: "umbra", name: "The Moonless", color: "hsl(230 24% 12%)", mark: "hsl(208 100% 88%)",
      power: "Moon Shadow", ability: "The shadow the Dustmoth throws across the moon, given claws. It hunts wherever the light has gone out.",
      tone: ["hsl(230 40% 22%)", "hsl(208 100% 86%)"], moves: ["Crescent Claw", "Dark Side", "New Moon Orb", "Moonless Night"],
      surge: { from: "dust-fall", name: "Ash Fall" },
    }),
  },
  // Book 2, chapter 5: the Somnarch's dreamers, the valley's people and the things they dream
  {
    grunt: minion("grunt", "somnarch", {
      base: "gravi", name: "Sleepwalker", color: "hsl(246 18% 30%)", mark: "hsl(46 100% 74%)",
      power: "Heavy Eyes", ability: "A villager who lay down for a nap a week ago. It walks, it fights, and it never wakes up.",
      tone: ["hsl(250 30% 44%)", "hsl(46 90% 80%)"], moves: ["Limp Swing", "Stumble", "Heavy Lid"],
      surge: { from: "lullaby-touch", name: "Yawn Touch" },
    }),
    caster: minion("caster", "somnarch", {
      base: "sono", name: "Lullabist", color: "hsl(256 24% 26%)", mark: "hsl(46 100% 74%)",
      power: "Hushaby", ability: "Sings the valley's children to sleep every night. Now it sings at anyone still awake, and the song hits hard.",
      tone: ["hsl(268 50% 60%)", "hsl(46 100% 86%)"], moves: ["Soft Note", "Cradle Song", "Drowse Chord", "Lull"],
      surge: { from: "dream-motes", name: "Dream Mote" },
    }),
    brute: minion("brute", "somnarch", {
      base: "terra", name: "Counted Sheep", color: "hsl(240 14% 14%)", mark: "hsl(46 100% 74%)",
      power: "Bad Dream", ability: "The last sheep someone counted before they fell asleep for good. It grew huge and black in the dream and walked out of it.",
      tone: ["hsl(240 10% 30%)", "hsl(46 70% 84%)"], moves: ["Horn Butt", "Stampede", "Thunder Hoof"],
      surge: { from: "drowse-wave", name: "Drowse Stomp" },
    }),
    elite: minion("elite", "somnarch", {
      base: "pyro", name: "The Snuffer", color: "hsl(250 30% 12%)", mark: "hsl(42 100% 70%)",
      power: "Lights Out", ability: "Walks the valley at dusk putting out every lamp, so nobody can stay awake. It keeps the flames it snuffs.",
      tone: ["hsl(30 90% 50%)", "hsl(46 100% 80%)"], moves: ["Snuffer Strike", "Wick Snip", "Dark Lantern", "Last Lamp"],
      surge: { from: "dream-spiral", name: "Little Spiral" },
    }),
  },
  // Book 2, chapter 6: the Hush's silent order, the bell city's people with their voices taken
  {
    grunt: minion("grunt", "hush", {
      base: "psy", name: "Hushed Monk", color: "hsl(350 8% 22%)", mark: "hsl(354 90% 70%)",
      power: "Vow of Silence", ability: "Took a vow of silence long ago. The Hush made it a vow that can never be broken.",
      tone: ["hsl(350 20% 36%)", "hsl(354 80% 84%)"], moves: ["Silent Palm", "Still Step", "Quiet Blow"],
      surge: { from: "muffle", name: "Muffled Palm" },
    }),
    caster: minion("caster", "hush", {
      base: "chrono", name: "Bell Ringer", color: "hsl(30 18% 20%)", mark: "hsl(354 90% 70%)",
      power: "Dead Toll", ability: "Rang the city's hours for forty years. It still pulls the ropes, and the bells still hit, but they make no sound.",
      tone: ["hsl(36 50% 46%)", "hsl(40 80% 82%)"], moves: ["Rope Lash", "Cracked Chime", "Hollow Toll", "Ring Out"],
      surge: { from: "silent-toll", name: "Little Toll" },
    }),
    brute: minion("brute", "hush", {
      base: "magneto", name: "The Clapper", color: "hsl(32 30% 24%)", mark: "hsl(354 90% 70%)",
      power: "Iron Tongue", ability: "The iron tongue torn out of the cathedral's great bell. It got up and walked, swinging itself at anything that moves.",
      tone: ["hsl(30 20% 40%)", "hsl(30 40% 70%)"], moves: ["Bell Swing", "Iron Pull", "Gong Slam"],
      surge: { from: "the-quiet", name: "Quiet Slam" },
    }),
    elite: minion("elite", "hush", {
      base: "sono", name: "The Unsung", color: "hsl(350 24% 10%)", mark: "hsl(356 100% 74%)",
      power: "Stolen Voice", ability: "The city's finest singer, until the Hush took her voice. She fights with the shape of the song she can no longer sing.",
      tone: ["hsl(350 60% 40%)", "hsl(354 100% 84%)"], moves: ["Mute Note", "Breathless", "Empty Aria", "Curtain Call"],
      surge: { from: "cracked-peal", name: "Cracked Note" },
    }),
  },
  // Book 2, chapter 7: the Elder Dark's own, things that were never born under any star
  {
    grunt: minion("grunt", "elderdark", {
      base: "hydro", name: "Starspawn", color: "hsl(262 30% 16%)", mark: "hsl(150 100% 66%)",
      power: "Formless", ability: "A small piece of the Elder Dark that broke off and learned to crawl. It is mostly mouth and mostly hungry.",
      tone: ["hsl(262 40% 30%)", "hsl(150 90% 70%)"], moves: ["Tendril Slap", "Ooze Lunge", "Spit"],
      surge: { from: "void-tendril", name: "Little Tendril" },
    }),
    caster: minion("caster", "elderdark", {
      base: "umbra", name: "Void Cantor", color: "hsl(268 30% 12%)", mark: "hsl(268 100% 80%)",
      power: "Unspeakable Hymn", ability: "Sings the names of stars that went out before the world began. Each name lands like a stone.",
      tone: ["hsl(268 60% 40%)", "hsl(268 100% 86%)"], moves: ["Dark Verse", "Unnamed Star", "Hymn of Nothing", "Last Amen"],
      surge: { from: "dead-stars", name: "Dead Star" },
    }),
    brute: minion("brute", "elderdark", {
      base: "gravi", name: "Abyss Titan", color: "hsl(258 24% 10%)", mark: "hsl(150 100% 66%)",
      power: "Crushing Void", ability: "A giant made of the dark between galaxies. Where it stands, everything falls toward it.",
      tone: ["hsl(258 40% 22%)", "hsl(150 80% 66%)"], moves: ["Void Fist", "Black Hole Pull", "Collapse"],
      surge: { from: "first-dark", name: "First Shadow" },
    }),
    elite: minion("elite", "elderdark", {
      base: "tele", name: "The First Herald", color: "hsl(262 40% 6%)", mark: "hsl(268 100% 84%)",
      power: "Open Door", ability: "The oldest of the heralds, the one that opened the first crack in the sky. It has waited at the door since, to welcome its master home.",
      tone: ["hsl(268 70% 50%)", "hsl(150 100% 76%)"], moves: ["Doorkeeper's Strike", "Step Between", "Keyhole Eye", "Threshold"],
      surge: { from: "unmaking-eye", name: "Herald's Gaze" },
    }),
  },
  // Book 3, chapter 1: Perihelion's fallen, pieces of the comet that hit the snow and got up again
  {
    grunt: minion("grunt", "perihelion", {
      base: "pyro", name: "Cinderflake", color: "hsl(210 30% 30%)", mark: "hsl(190 100% 80%)",
      power: "Cold Fire", ability: "A flake that broke off the comet's head and never stopped burning. Its fire is blue, and it burns like frost.",
      tone: ["hsl(200 90% 56%)", "hsl(190 100% 86%)"], moves: ["Frostburn Jab", "Bluefire Ball", "Cold Flame Pillar"],
      surge: { from: "tail-lash", name: "Little Lash" },
    }),
    caster: minion("caster", "perihelion", {
      base: "electro", name: "Ion Wisp", color: "hsl(216 30% 26%)", mark: "hsl(190 100% 80%)",
      power: "Ion Stream", ability: "A thread of the comet's blue ion tail, still crackling with the solar wind it was born in.",
      tone: ["hsl(214 90% 60%)", "hsl(200 100% 88%)"], moves: ["Static Touch", "Ion Ray", "Charged Mote", "Solar Wind"],
      surge: { from: "coma-shards", name: "Coma Shard" },
    }),
    brute: minion("brute", "perihelion", {
      base: "terra", name: "Impact Golem", color: "hsl(214 16% 34%)", mark: "hsl(190 100% 80%)",
      power: "Crater", ability: "A boulder of comet ice and rock that hit the ground so hard it got up angry.",
      tone: ["hsl(210 14% 46%)", "hsl(196 60% 80%)"], moves: ["Iceboulder Fist", "Crater Spike", "Impact Stomp"],
      surge: { from: "nucleus-flare", name: "Small Flare" },
    }),
    elite: minion("elite", "perihelion", {
      base: "chrono", name: "The Returner", color: "hsl(214 34% 16%)", mark: "hsl(190 100% 86%)",
      power: "Long Orbit", ability: "Comes back round the sun once a lifetime and remembers every world it has passed. It fights like it already knows how this ends.",
      tone: ["hsl(44 90% 60%)", "hsl(190 100% 86%)"], moves: ["Orbit Strike", "Return Bolt", "Aphelion Field", "Come Round Again"],
      surge: { from: "tailfire-ray", name: "Tailfire" },
    }),
  },
  // Book 3, chapter 2: Asterion's hunting party, the constellations that run with the Hunter
  {
    grunt: minion("grunt", "asterion", {
      base: "velo", name: "Star Hound", color: "hsl(232 34% 22%)", mark: "hsl(44 100% 74%)",
      power: "Dog Star", ability: "The Hunter's hound: seven stars and a few bright lines. It runs down whatever the Hunter points at.",
      tone: ["hsl(220 80% 70%)", "hsl(44 100% 86%)"], moves: ["Bright Bite", "Pack Rush", "Hound's Kick"],
      surge: { from: "star-to-star", name: "Star Leap" },
    }),
    caster: minion("caster", "asterion", {
      base: "psy", name: "The Lyre", color: "hsl(240 30% 22%)", mark: "hsl(44 100% 74%)",
      power: "Music of the Spheres", ability: "A constellation shaped like a harp, strung with starlight. Each note it plays moves something in the sky, and something on the ground.",
      tone: ["hsl(266 60% 66%)", "hsl(44 100% 86%)"], moves: ["Plucked Note", "Rising Chord", "Sphere Song", "Crushing Harmony"],
      surge: { from: "starshot", name: "Small Starshot" },
    }),
    brute: minion("brute", "asterion", {
      base: "gravi", name: "Star Bull", color: "hsl(232 30% 16%)", mark: "hsl(44 100% 74%)",
      power: "Heavy Heavens", ability: "The bull of the sky. Every star in it weighs as much as a mountain, and it knows it.",
      tone: ["hsl(232 40% 30%)", "hsl(44 100% 80%)"], moves: ["Horn Hook", "Weight of Stars", "Drag of the Heavens"],
      surge: { from: "shooting-stars", name: "Star Hooves" },
    }),
    elite: minion("elite", "asterion", {
      base: "toxi", name: "The Star Scorpion", color: "hsl(240 40% 10%)", mark: "hsl(44 100% 78%)",
      power: "Sting of Night", ability: "The Hunter's oldest enemy. When the Celestials came down it put the old fight aside to guard his gate, and its sting is still the brightest red in the sky.",
      tone: ["hsl(354 90% 56%)", "hsl(44 100% 80%)"], moves: ["Pincer Snap", "Star Venom", "Red Star Field", "Sting of Night"],
      surge: { from: "line-of-stars", name: "Line of Venom" },
    }),
  },
  // Book 3, chapter 3: Carina's brood, the newborn stars and living gas of her nursery
  {
    grunt: minion("grunt", "carina", {
      base: "pyro", name: "Starling", color: "hsl(304 30% 24%)", mark: "hsl(326 100% 80%)",
      power: "Firstlight", ability: "A star born last night, small and hot and very sure of itself. It has never seen anything brighter than its mother, and it wants to keep it that way.",
      tone: ["hsl(326 100% 66%)", "hsl(48 100% 92%)"], moves: ["Firstlight Jab", "Newborn Spark", "Birth Flame"],
      surge: { from: "newborn-stars", name: "Little Sisters" },
    }),
    caster: minion("caster", "carina", {
      base: "toxi", name: "Veil Wisp", color: "hsl(296 26% 22%)", mark: "hsl(326 100% 80%)",
      power: "Star Gas", ability: "A curl of the nebula's glowing gas that learned to float on its own. Breathe it in and everything goes soft and pink, then goes away.",
      tone: ["hsl(172 80% 52%)", "hsl(326 100% 86%)"], moves: ["Gas Sting", "Glow Spit", "Nebula Fog", "Gas Bloom"],
      surge: { from: "the-nursery", name: "Small Nursery" },
    }),
    brute: minion("brute", "carina", {
      base: "gravi", name: "Protostar", color: "hsl(300 30% 14%)", mark: "hsl(326 100% 80%)",
      power: "Collapse", ability: "A star that has not been born yet: a ball of gas pulling itself tighter and hotter every second. It is heavy, it is cross, and it is getting worse.",
      tone: ["hsl(320 60% 30%)", "hsl(326 100% 80%)"], moves: ["Heavy Glow", "Falling In", "Drawing Close"],
      surge: { from: "veil-lash", name: "Gas Lash" },
    }),
    elite: minion("elite", "carina", {
      base: "terra", name: "The Pillar", color: "hsl(300 26% 10%)", mark: "hsl(172 100% 80%)",
      power: "Pillar of Creation", ability: "A tower of dark dust taller than mountains, with stars being born at its tips. It has guarded Carina's nursery since before the sun was lit.",
      tone: ["hsl(300 20% 20%)", "hsl(172 90% 76%)"], moves: ["Dust Fist", "Dark Clod", "Pillar Rise", "Nursery Quake"],
      surge: { from: "birthlight", name: "Pillar Light" },
    }),
  },
  // Book 3, chapter 4: Vela's keepers, things the pulsar's beat has shaken loose or turned to glass
  {
    grunt: minion("grunt", "vela", {
      base: "electro", name: "Blip", color: "hsl(250 20% 22%)", mark: "hsl(32 100% 70%)",
      power: "Flicker", ability: "A spark thrown off the pulsar's spin. It blinks on and off a hundred times a second, and you never quite know which one is real.",
      tone: ["hsl(32 100% 62%)", "hsl(48 100% 92%)"], moves: ["Blip Strike", "Pulse Line", "Spark Tick"],
      surge: { from: "tick-shots", name: "Tick Tock" },
    }),
    caster: minion("caster", "vela", {
      base: "psy", name: "Radio Ghost", color: "hsl(254 22% 20%)", mark: "hsl(32 100% 70%)",
      power: "Static", ability: "A voice caught in the pulsar's radio beam, crackling between stations. It talks in hiss and whispers, and every whisper is counting down.",
      tone: ["hsl(276 70% 64%)", "hsl(32 100% 84%)"], moves: ["Crackle", "Signal Lift", "Radio Wave", "Interference"],
      surge: { from: "lighthouse-beam", name: "Small Beacon" },
    }),
    brute: minion("brute", "vela", {
      base: "cryo", name: "Glass Giant", color: "hsl(36 30% 30%)", mark: "hsl(32 100% 74%)",
      power: "Glassing", ability: "A dune that the beam swept across one night and turned to glass. Then it stood up. Then it got bigger.",
      tone: ["hsl(36 60% 62%)", "hsl(48 100% 92%)"], moves: ["Glass Fist", "Glass Spire", "Shard Spray"],
      surge: { from: "spin-rush", name: "Rolling Dune" },
    }),
    elite: minion("elite", "vela", {
      base: "gravi", name: "The White Dwarf", color: "hsl(220 20% 82%)", mark: "hsl(32 100% 70%)",
      power: "Dead Weight", ability: "The cinder of the star that once circled Vela. It burned out long ago, small and cold and heavy as a mountain, but it never stopped following Vela round.",
      tone: ["hsl(220 30% 70%)", "hsl(32 100% 80%)"], moves: ["Dense Palm", "Collapsed Star", "Old Companion", "Cinder Rain"],
      surge: { from: "magnetic-pole", name: "Pole Pull" },
    }),
  },
  // Book 3, chapter 5: Aeon's watch, the oldest lights in the sky, still keeping their places after an age
  {
    grunt: minion("grunt", "aeon", {
      base: "aero", name: "Glint", color: "hsl(230 30% 26%)", mark: "hsl(46 100% 74%)",
      power: "Old Light", ability: "A speck of light that left Aeon before the world was made and is only arriving now. It is very fast, it has come a very long way, and it does not want to have come all this way for nothing.",
      tone: ["hsl(46 100% 70%)", "hsl(48 100% 94%)"], moves: ["Glint Jab", "Speck Dart", "Long Arrival"],
      surge: { from: "first-stars", name: "Little Stars" },
    }),
    caster: minion("caster", "aeon", {
      base: "chrono", name: "Skywatcher", color: "hsl(228 36% 18%)", mark: "hsl(46 100% 74%)",
      power: "Long Watch", ability: "One of the thousand small eyes that open around Aeon when it looks down. Each one has watched a single patch of sky since the beginning, and each one remembers everything it saw.",
      tone: ["hsl(222 80% 64%)", "hsl(46 100% 84%)"], moves: ["Blink Touch", "Old Glance", "Remembered Hour", "Unblinking"],
      surge: { from: "eye-of-the-sky", name: "Small Gaze" },
    }),
    brute: minion("brute", "aeon", {
      base: "pyro", name: "Red Giant", color: "hsl(8 50% 24%)", mark: "hsl(46 100% 74%)",
      power: "Swell", ability: "An old star near the end of its life, swollen up huge and red and slow. It has eaten its own planets and it is still hungry, and every time it breathes out it gets a little bigger.",
      tone: ["hsl(10 90% 52%)", "hsl(36 100% 76%)"], moves: ["Swollen Fist", "Red Breath", "Last Swell"],
      surge: { from: "rain-of-ages", name: "Ember Rain" },
    }),
    elite: minion("elite", "aeon", {
      base: "cryo", name: "Polaris", color: "hsl(214 40% 86%)", mark: "hsl(46 100% 70%)",
      power: "True North", ability: "The North Star, the one light in the sky that never moves. Every lost traveller who ever lived steered home by it, and all that time it was standing guard for Aeon at the top of the world.",
      tone: ["hsl(204 100% 76%)", "hsl(0 0% 100%)"], moves: ["North Strike", "Fixed Point", "Cold Bearing", "The Still Star"],
      surge: { from: "the-old-orbit", name: "Still Orbit" },
    }),
  },
  // Book 4, chapter 1: Orogen's stones, the boulders and foothills that woke up when the mountain did
  {
    grunt: minion("grunt", "orogen", {
      base: "terra", name: "Pebbler", color: "hsl(30 8% 40%)", mark: "hsl(150 80% 62%)",
      power: "Scree", ability: "A handful of loose stones that rolled down the mountain and kept rolling. It is small, it is hard, and it never stops bouncing.",
      tone: ["hsl(30 10% 50%)", "hsl(150 80% 72%)"], moves: ["Pebble Punch", "Skipping Stone", "Bounce Back"],
      surge: { from: "upthrust", name: "Little Upthrust" },
    }),
    caster: minion("caster", "orogen", {
      base: "psy", name: "Cairn Seer", color: "hsl(28 8% 30%)", mark: "hsl(150 80% 62%)",
      power: "Stacked Stones", ability: "A pile of flat stones someone balanced on a hilltop long ago. It has been listening to the mountain breathe ever since, and now it hears it talking.",
      tone: ["hsl(150 50% 46%)", "hsl(150 90% 80%)"], moves: ["Stone Tap", "Cairn Lift", "Hill Hum", "Topple"],
      surge: { from: "continental-drift", name: "Small Drift" },
    }),
    brute: minion("brute", "orogen", {
      base: "gravi", name: "Boulderback", color: "hsl(26 10% 24%)", mark: "hsl(150 80% 62%)",
      power: "Dead Weight", ability: "A boulder as big as a house that sat in one field for ten thousand years. It has got up, and it is not happy about the sheep.",
      tone: ["hsl(26 10% 34%)", "hsl(150 80% 70%)"], moves: ["Boulder Slam", "Heavy Roll", "Settle"],
      surge: { from: "landslide", name: "Little Landslide" },
    }),
    elite: minion("elite", "orogen", {
      base: "cryo", name: "The Old Peak", color: "hsl(210 10% 78%)", mark: "hsl(150 80% 60%)",
      power: "Snowcap", ability: "The highest peak of Orogen's range, broken off and walking on its own. Snow on its head, ice in its joints, and the cold patience of something that has watched every sunrise there ever was.",
      tone: ["hsl(204 40% 80%)", "hsl(150 80% 76%)"], moves: ["Summit Strike", "Avalanche", "Glacier Bed", "Peak Cold"],
      surge: { from: "rockfall", name: "Snowslide" },
    }),
  },
  // Book 4, chapter 2: Gnarlroot's undergrowth, everything that grows in the shade of the first tree
  {
    grunt: minion("grunt", "gnarlroot", {
      base: "toxi", name: "Thornling", color: "hsl(90 30% 22%)", mark: "hsl(92 80% 60%)",
      power: "Prickle", ability: "A bramble that pulled itself out of the ground. It has a hundred thorns and no idea which way it is facing.",
      tone: ["hsl(100 60% 36%)", "hsl(80 100% 70%)"], moves: ["Thorn Jab", "Burr Spit", "Prickle Bloom"],
      surge: { from: "thorn-hail", name: "Few Thorns" },
    }),
    caster: minion("caster", "gnarlroot", {
      base: "vita", name: "Sapwhisper", color: "hsl(70 24% 24%)", mark: "hsl(92 80% 60%)",
      power: "Green Song", ability: "A spirit of the leaves that hums the forest awake every spring. This year Gnarlroot has given it a new song, and the forest is waking up angry.",
      tone: ["hsl(92 70% 50%)", "hsl(60 100% 80%)"], moves: ["Leaf Touch", "Green Seed", "Spring Mend", "Bloom"],
      surge: { from: "gnarled-snare", name: "Small Snare" },
    }),
    brute: minion("brute", "gnarlroot", {
      base: "terra", name: "Stumpgut", color: "hsl(24 30% 18%)", mark: "hsl(92 80% 60%)",
      power: "Old Stump", ability: "What is left of a tree that was cut down a hundred years ago. It remembers the axe. It remembers everyone who sat on it.",
      tone: ["hsl(24 30% 30%)", "hsl(92 70% 66%)"], moves: ["Stump Smash", "Splinter Toss", "Root Stamp"],
      surge: { from: "taproot", name: "Short Taproot" },
    }),
    elite: minion("elite", "gnarlroot", {
      base: "gravi", name: "The Heartwood", color: "hsl(36 40% 22%)", mark: "hsl(80 100% 66%)",
      power: "Ring Upon Ring", ability: "The oldest oak in the forest, a thousand rings thick. It was Gnarlroot's first seedling, and it has guarded the way down to its roots ever since.",
      tone: ["hsl(36 60% 40%)", "hsl(80 100% 74%)"], moves: ["Oak Palm", "Acorn Fall", "Heavy Bough", "Ring of Years"],
      surge: { from: "bramble-thicket", name: "Bramble Patch" },
    }),
  },
  // Book 4, chapter 3: Ambrel's keepers, the creatures the amber has held since the world was young
  {
    grunt: minion("grunt", "ambrel", {
      base: "electro", name: "Ambermite", color: "hsl(34 70% 34%)", mark: "hsl(44 100% 66%)",
      power: "Buzz", ability: "A tiny fly that was sealed in amber before the first bird ever sang. Ambrel let it out. It is very fast, very loud, and very cross about the wait.",
      tone: ["hsl(40 100% 56%)", "hsl(50 100% 84%)"], moves: ["Sting Jab", "Buzz Bolt", "Zip"],
      surge: { from: "sap-drops", name: "Sticky Drop" },
    }),
    caster: minion("caster", "ambrel", {
      base: "chrono", name: "Combweaver", color: "hsl(30 60% 26%)", mark: "hsl(44 100% 66%)",
      power: "Slow Honey", ability: "A spider that spins in honey instead of silk. Whatever lands in its web stays there, a little slower every second, until it is not moving at all.",
      tone: ["hsl(36 90% 48%)", "hsl(48 100% 82%)"], moves: ["Honey Tap", "Slow Thread", "Comb Web", "Hold Still"],
      surge: { from: "amber-pool", name: "Honey Puddle" },
    }),
    brute: minion("brute", "ambrel", {
      base: "terra", name: "Fossil Ox", color: "hsl(36 30% 52%)", mark: "hsl(44 100% 66%)",
      power: "Old Bones", ability: "The bones of a beast no one alive has ever seen, set in gold and stood back up. It still remembers which way the herd went.",
      tone: ["hsl(40 30% 70%)", "hsl(44 100% 76%)"], moves: ["Horn Toss", "Bone Throw", "Stampede Stomp"],
      surge: { from: "set-in-stone", name: "Set Hard" },
    }),
    elite: minion("elite", "ambrel", {
      base: "toxi", name: "The Comb Queen", color: "hsl(28 70% 18%)", mark: "hsl(46 100% 70%)",
      power: "The Hive", ability: "The queen of a hive that was sealed whole in amber in one golden afternoon. She has been waiting a very long time to finish that afternoon.",
      tone: ["hsl(44 100% 52%)", "hsl(28 80% 20%)"], moves: ["Queen's Sting", "Royal Jelly", "Swarm Field", "Hive Sting"],
      surge: { from: "honey-lance", name: "Honey Ray" },
    }),
  },
];
