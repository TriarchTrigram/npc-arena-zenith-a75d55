// Quests: 9 long goals, each earning a quest fighter for good once it is complete and claimed.
// Progress is counted from finished fights and saved in this browser (localStorage), like Story progress.
// The arena screen reports each finished fight with `recordFight` and each crowned champion with `recordTournament`.
// The same save keeps the new-generation fighters won by luck after a Story boss win (`rollNewGen`).
import { useEffect, useState } from "react";
import { NEWGEN_IDS, QUESTERS, type Power } from "./fighters";

/** What the arena counts toward quests. */
export type Stat = "fights" | "kos" | "tournaments" | "bosses" | "forms";
export type Stats = Record<Stat, number>;

export type Goal = { stat: Stat; need: number };
export type Quest = {
  id: string;
  /** The fighter it earns; null while that fighter has not been added to the game yet. */
  reward: Power | null;
  goals: Goal[];
};

export const QUESTS: Quest[] = [
  { id: "fold", reward: "spatio", goals: [{ stat: "fights", need: 3 }, { stat: "kos", need: 30 }] },
  { id: "gameover", reward: "hexizon", goals: [{ stat: "tournaments", need: 1 }, { stat: "bosses", need: 1 }, { stat: "forms", need: 3 }] },
  { id: "gamma", reward: "gamma", goals: [{ stat: "kos", need: 75 }, { stat: "forms", need: 7 }, { stat: "bosses", need: 1 }] },
  { id: "speed", reward: "velo", goals: [{ stat: "fights", need: 15 }, { stat: "kos", need: 110 }, { stat: "tournaments", need: 1 }] },
  { id: "portal", reward: "portal", goals: [{ stat: "fights", need: 30 }, { stat: "forms", need: 15 }, { stat: "tournaments", need: 1 }, { stat: "bosses", need: 1 }] },
  { id: "encore", reward: "sono", goals: [{ stat: "fights", need: 45 }, { stat: "kos", need: 190 }, { stat: "forms", need: 22 }] },
  { id: "cranes", reward: "paper", goals: [{ stat: "fights", need: 60 }, { stat: "forms", need: 30 }, { stat: "tournaments", need: 1 }, { stat: "bosses", need: 1 }] },
  { id: "facet", reward: "crys", goals: [{ stat: "fights", need: 70 }, { stat: "kos", need: 280 }, { stat: "forms", need: 35 }, { stat: "bosses", need: 1 }] },
  { id: "dunes", reward: "sand", goals: [{ stat: "fights", need: 85 }, { stat: "kos", need: 320 }, { stat: "tournaments", need: 1 }, { stat: "bosses", need: 1 }] },
];

const KEY = "npc-arena-quests";
const CHANGED = "npc-arena-quests-changed";

export type QuestSave = { stats: Stats; claimed: string[]; newgen: Power[] };
const EMPTY: QuestSave = { stats: { fights: 0, kos: 0, tournaments: 0, bosses: 0, forms: 0 }, claimed: [], newgen: [] };

export function loadQuests(): QuestSave {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return EMPTY;
    const stats = { ...EMPTY.stats };
    for (const k of Object.keys(stats) as Stat[]) stats[k] = Math.max(0, Math.floor(Number(raw.stats?.[k]) || 0));
    const claimed = Array.isArray(raw.claimed) ? raw.claimed.filter((x: unknown): x is string => typeof x === "string" && QUESTS.some((q) => q.id === x)) : [];
    const newgen = Array.isArray(raw.newgen) ? NEWGEN_IDS.filter((p) => raw.newgen.includes(p)) : [];
    return { stats, claimed: [...new Set<string>(claimed)], newgen };
  } catch {
    return EMPTY;
  }
}

function save(q: QuestSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // storage blocked: progress just isn't kept
  }
}

function bump(add: Partial<Stats>) {
  const q = loadQuests();
  for (const [k, v] of Object.entries(add) as [Stat, number][]) q.stats[k] += Math.max(0, Math.floor(v));
  save(q);
}

/** A fight that played to the end: how many fell, how many forms broke loose, and whether it was a Story boss beaten. */
export const recordFight = (o: { kos: number; forms: number; boss: boolean }) => bump({ fights: 1, kos: o.kos, forms: o.forms, bosses: o.boss ? 1 : 0 });
export const recordTournament = () => bump({ tournaments: 1 });

export const goalDone = (s: Stats, g: Goal) => s[g.stat] >= g.need;
export const questReady = (s: Stats, q: Quest) => !!q.reward && q.goals.every((g) => goalDone(s, g));

/** Claim a finished quest: its fighter joins the roster for good. */
export function claimQuest(id: string): boolean {
  const q = loadQuests();
  const quest = QUESTS.find((x) => x.id === id);
  if (!quest || !questReady(q.stats, quest) || q.claimed.includes(id)) return false;
  q.claimed.push(id);
  save(q);
  return true;
}

/** The chance that a Story boss win brings in one new-generation fighter not yet unlocked. */
export const NEWGEN_CHANCE = 0.4;

/** After a Story boss win: with `NEWGEN_CHANCE`, one still-locked new-generation fighter joins for good. Returns who joined. */
export function rollNewGen(): Power | null {
  const q = loadQuests();
  const locked = NEWGEN_IDS.filter((p) => !q.newgen.includes(p));
  if (!locked.length || Math.random() >= NEWGEN_CHANCE) return null;
  const won = locked[Math.floor(Math.random() * locked.length)];
  q.newgen.push(won);
  save(q);
  return won;
}

/** Quest fighters this browser has earned, in quest order, then the new-generation fighters it has unlocked. */
export const unlockedOf = (q: QuestSave): Power[] => [
  ...QUESTS.filter((x) => x.reward && q.claimed.includes(x.id)).map((x) => x.reward!).filter((p) => QUESTERS.some((d) => d.id === p)),
  ...NEWGEN_IDS.filter((p) => q.newgen.includes(p)),
];

/** The saved quest progress, read after the first render so the server and browser agree. */
export function useQuests(): QuestSave {
  const [q, setQ] = useState<QuestSave>(EMPTY);
  useEffect(() => {
    const read = () => setQ(loadQuests());
    read();
    window.addEventListener(CHANGED, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHANGED, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return q;
}
