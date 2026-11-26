// What happens between the entrances and READY when certain fighters meet in a one-on-one fight: a few seconds where
// they react to each other, say a line or two in speech bubbles, and touch off a small burst of their powers.
// The engine (`arena-engine.ts`) plays these: it walks the fighters, holds the poses named here, draws the bubbles
// and throws the bursts. The words are in strings under `arena.prefight`, keyed by each line's `key`.
// Nova knows Pyro and the Riftmaker from before the Axiom corrupted him, so every one of these starts with her or them.
import type { FighterDef, Power } from "./fighters";
import type { PShape } from "./move-looks";

/** Poses the engine knows for these moments; "idle" is the fighter's own breathing stance. */
export type PrePose = "idle" | "wave" | "highfive" | "reach" | "offer" | "point" | "flick" | "flex" | "crouch";

/** Which of the pair: 0 is the first id in `pair`, 1 the second. */
type Who = 0 | 1;

export type PreFight = {
  id: string;
  /** The two fighters, by id; the same id twice is a mirror match. "any" stands for anyone else. */
  pair: [Power, Power | "any"];
  /** Seconds it lasts. */
  len: number;
  /** From `at` on, this fighter holds `pose`, and walks toward the other until it has covered `to` of the way (0 home, 1 close enough to touch). */
  acts: { who: Who; at: number; pose: PrePose; to?: number }[];
  /** Speech bubbles over a fighter's head. */
  lines: { who: Who; at: number; until: number; key: string }[];
  /** Bursts of particles at a fighter's front hand, over the head, or between the two. */
  bursts: { at: number; who: Who | "mid"; where?: "hand" | "head"; n: number; spd: number; shape: PShape; a: string; b: string; grav: number; ring?: boolean }[];
  /** A twinkling star held on a fighter's front hand from `at` to `until`. */
  stars?: { who: Who; at: number; until: number; color: string }[];
  /** Walking speed, pixels per second. */
  walk?: number;
};

const PINK = "hsl(324 85% 76%)";
const STARLIGHT = "hsl(48 100% 88%)";
const EMBER = "hsl(22 100% 58%)";
const FLAME = "hsl(42 100% 64%)";
const RIFT = "hsl(40 100% 66%)";

export const PRE_FIGHTS: PreFight[] = [
  // Pyro checks in on Nova like he does every day, they meet in the middle for a high five, then square up.
  {
    id: "pyro-nova", pair: ["pyro", "nova"], len: 5.4,
    acts: [
      { who: 0, at: 0, pose: "wave" },
      { who: 1, at: 0, pose: "idle" },
      { who: 0, at: 1.3, pose: "idle", to: 1 },
      { who: 1, at: 1.3, pose: "idle", to: 1 },
      { who: 0, at: 2.55, pose: "highfive", to: 1 },
      { who: 1, at: 2.55, pose: "highfive", to: 1 },
      { who: 0, at: 3.3, pose: "idle", to: 0 },
      { who: 1, at: 3.3, pose: "idle", to: 0 },
      { who: 0, at: 4.4, pose: "crouch", to: 0 },
      { who: 1, at: 4.6, pose: "crouch", to: 0 },
    ],
    lines: [
      { who: 0, at: 0.15, until: 1.9, key: "pyroNova1" },
      { who: 1, at: 1.9, until: 3.3, key: "pyroNova2" },
      { who: 0, at: 3.5, until: 5.3, key: "pyroNova3" },
    ],
    bursts: [
      { at: 2.85, who: "mid", n: 22, spd: 300, shape: "star", a: PINK, b: STARLIGHT, grav: 0, ring: true },
      { at: 2.85, who: "mid", n: 18, spd: 260, shape: "ember", a: EMBER, b: FLAME, grav: -200 },
    ],
  },
  // Nova meets the Riftmaker as he was before the fall. She walks up slowly; he opens a tiny rift and hands her a star.
  {
    id: "nova-pastrift", pair: ["nova", "pastrift"], len: 6, walk: 150,
    acts: [
      { who: 0, at: 0, pose: "idle", to: 0.55 },
      { who: 1, at: 0, pose: "idle" },
      { who: 0, at: 1.5, pose: "reach", to: 0.55 },
      { who: 1, at: 2.4, pose: "offer" },
      { who: 0, at: 4.1, pose: "idle", to: 0 },
      { who: 1, at: 4.1, pose: "idle" },
      { who: 0, at: 4.9, pose: "point", to: 0 },
      { who: 1, at: 4.9, pose: "point" },
    ],
    lines: [
      { who: 0, at: 0.3, until: 2.2, key: "novaRift1" },
      { who: 1, at: 2.3, until: 4, key: "novaRift2" },
      { who: 0, at: 4.1, until: 5.9, key: "novaRift3" },
    ],
    bursts: [
      { at: 2.6, who: 1, where: "hand", n: 14, spd: 160, shape: "spark", a: RIFT, b: STARLIGHT, grav: 0, ring: true },
      { at: 3.7, who: 1, where: "hand", n: 20, spd: 220, shape: "star", a: PINK, b: RIFT, grav: -40 },
    ],
    stars: [{ who: 1, at: 2.7, until: 3.7, color: STARLIGHT }],
  },
  // The old crew: the Riftmaker calls a race to the first hit and Pyro fires up.
  {
    id: "pyro-pastrift", pair: ["pyro", "pastrift"], len: 4.2,
    acts: [
      { who: 0, at: 0, pose: "idle" },
      { who: 1, at: 0, pose: "point" },
      { who: 0, at: 1.8, pose: "flex" },
      { who: 1, at: 3, pose: "crouch" },
      { who: 0, at: 3.2, pose: "crouch" },
    ],
    lines: [
      { who: 1, at: 0.15, until: 1.9, key: "pyroRift1" },
      { who: 0, at: 1.9, until: 3.7, key: "pyroRift2" },
    ],
    bursts: [
      { at: 2, who: 0, where: "hand", n: 22, spd: 240, shape: "ember", a: EMBER, b: FLAME, grav: -260, ring: true },
      { at: 3.1, who: 1, where: "hand", n: 14, spd: 200, shape: "spark", a: "hsl(300 90% 66%)", b: RIFT, grav: 0 },
    ],
  },
  // Nova against Nova: one flicks her hair, so does the other.
  {
    id: "nova-nova", pair: ["nova", "nova"], len: 3.8,
    acts: [
      { who: 0, at: 0, pose: "flick" },
      { who: 1, at: 0, pose: "idle" },
      { who: 0, at: 1.4, pose: "idle" },
      { who: 1, at: 1.6, pose: "flick" },
      { who: 1, at: 3, pose: "crouch" },
      { who: 0, at: 3, pose: "crouch" },
    ],
    lines: [
      { who: 0, at: 0.2, until: 1.7, key: "novaNova1" },
      { who: 1, at: 1.7, until: 3.4, key: "novaNova2" },
    ],
    bursts: [
      { at: 0.35, who: 0, where: "head", n: 12, spd: 150, shape: "star", a: PINK, b: STARLIGHT, grav: 0 },
      { at: 1.95, who: 1, where: "head", n: 12, spd: 150, shape: "star", a: PINK, b: STARLIGHT, grav: 0 },
    ],
  },
  // Nova against anyone else: a hair flick, then she holds up a star and blows it toward them.
  {
    id: "nova-any", pair: ["nova", "any"], len: 3.4,
    acts: [
      { who: 0, at: 0, pose: "flick" },
      { who: 1, at: 0, pose: "idle" },
      { who: 0, at: 0.9, pose: "offer" },
      { who: 0, at: 2.5, pose: "crouch" },
      { who: 1, at: 2.6, pose: "crouch" },
    ],
    lines: [{ who: 0, at: 0.9, until: 2.8, key: "novaAny1" }],
    bursts: [
      { at: 0.3, who: 0, where: "head", n: 10, spd: 140, shape: "star", a: PINK, b: STARLIGHT, grav: 0 },
      { at: 2.3, who: 0, where: "hand", n: 26, spd: 320, shape: "star", a: PINK, b: STARLIGHT, grav: 0, ring: true },
    ],
    stars: [{ who: 0, at: 1, until: 2.3, color: STARLIGHT }],
  },
];

/** A plain fighter only: not a boss, hybrid, minion, juggernaut or a fighter you made. */
const plain = (d: FighterDef) => !d.boss && !d.parents && !d.minion && !d.custom;

/**
 * The moment two fighters play before READY, if they have one, and which of them is the first of its pair.
 * A pair of their own comes first; Nova's "anyone else" moment plays against everyone she has no history with.
 */
export function preFightFor(a: FighterDef, b: FighterDef): { spec: PreFight; first: 0 | 1 } | null {
  if (!plain(a) || !plain(b)) return null;
  for (const spec of PRE_FIGHTS) {
    const [x, y] = spec.pair;
    if (y === "any") continue;
    if (a.id === x && b.id === y) return { spec, first: 0 };
    if (a.id === y && b.id === x) return { spec, first: 1 };
  }
  for (const spec of PRE_FIGHTS) {
    const [x, y] = spec.pair;
    if (y !== "any") continue;
    if (a.id === x) return { spec, first: 0 };
    if (b.id === x) return { spec, first: 1 };
  }
  return null;
}
