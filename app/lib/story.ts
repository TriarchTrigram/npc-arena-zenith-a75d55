// Story mode: chapters of stages. The player brings two fighters into each stage and either fuses
// them into one hybrid or sends them in side by side with team attacks. Progress lives in the browser.
import { fusionOrder, hybridOf, withTeamAttack, type FighterDef, type MinionKind, type Power } from "./fighters";
import { BOSSES, type BossId } from "./bosses";
import { MINIONS } from "./minions";

export { fusionOrder };

export type Stage = {
  /** The boss's minions on the other side, by kind (see minions.ts). */
  foes: MinionKind[];
  /** Share of their normal health the minions bring, so a crowd stays beatable for a pair. */
  enemyHp?: number;
  boss?: BossId;
};

export type Chapter = { stages: Stage[] };

const KIND: Record<string, MinionKind> = { g: "grunt", c: "caster", b: "brute", e: "elite" };
/** A stage of minions written as letters: g grunt, c caster, b brute, e the lieutenant. */
const st = (code: string, enemyHp?: number): Stage => ({ foes: [...code].map((k) => KIND[k]), ...(enemyHp ? { enemyHp } : {}) });

/**
 * The chapters of every book in one list. Book 1's chapters are nine stages of the boss's minions, then the boss;
 * Book 2's are eight, then the boss; Book 3's seven, then the boss; Book 4's six, then the boss. A chapter opens once the one before it is cleared,
 * so Book 2 opens once the Reign 8 (Book 1's eight bosses) have all fallen, Book 3 once the Elder Dark has, and Book 4 once Aeon has.
 */
export const CHAPTERS: Chapter[] = [
  {
    // Chapter 1: The Rift Opens
    stages: [
      st("g"),
      st("c"),
      st("b"),
      st("gc", 0.8),
      st("bg", 0.68),
      st("cc", 0.75),
      st("ggc", 0.4),
      st("bcg", 0.42),
      st("egc", 0.48),
      { foes: [], boss: "nullshade" },
    ],
  },
  {
    // Chapter 2: The Storm Coast
    stages: [
      st("g"),
      st("c"),
      st("b"),
      st("gc", 0.8),
      st("bc", 0.75),
      st("gg", 0.75),
      st("cgb", 0.45),
      st("bgc", 0.48),
      st("egg", 0.5),
      { foes: [], boss: "maelstrom" },
    ],
  },
  {
    // Chapter 3: The Ember Wastes
    stages: [
      st("g"),
      st("c"),
      st("b"),
      st("gb", 0.82),
      st("cc", 0.8),
      st("bg", 0.7),
      st("ggc", 0.45),
      st("bbc", 0.34),
      st("egcb", 0.3),
      { foes: [], boss: "magmaw" },
    ],
  },
  {
    // Chapter 4: The Frozen Clock
    stages: [
      st("c"),
      st("g"),
      st("b"),
      st("cg", 0.85),
      st("gc", 0.75),
      st("bb", 0.65),
      st("ccg", 0.34),
      st("bgc", 0.45),
      st("egcb", 0.23),
      { foes: [], boss: "everwinter" },
    ],
  },
  {
    // Chapter 5: The Heart of the Rift
    stages: [
      st("g"),
      st("c"),
      st("bg", 0.8),
      st("gcc", 0.46),
      st("bgg", 0.46),
      st("ccb", 0.4),
      st("ggcb", 0.27),
      st("bbcc", 0.19),
      st("egcbg", 0.16),
      { foes: [], boss: "riftmaker" },
    ],
  },
  {
    // Chapter 6: The Hollow Kingdom
    stages: [
      st("g"),
      st("gc", 0.85),
      st("cc", 0.8),
      st("bg", 0.7),
      st("ggc", 0.45),
      st("ccb", 0.45),
      st("bbg", 0.38),
      st("ggcb", 0.22),
      st("egcbc", 0.13),
      { foes: [], boss: "hollowking" },
    ],
  },
  {
    // Chapter 7: The Dying Sun
    stages: [
      st("c"),
      st("gc", 0.85),
      st("bb", 0.65),
      st("gc", 0.8),
      st("bcg", 0.46),
      st("ccg", 0.46),
      st("bgc", 0.44),
      st("ggcb", 0.2),
      st("ebgcc", 0.14),
      { foes: [], boss: "blacksun" },
    ],
  },
  {
    // Chapter 8: The Edge of Everything
    stages: [
      st("b"),
      st("cc", 0.85),
      st("bg", 0.7),
      st("gc", 0.8),
      st("ccg", 0.45),
      st("bbg", 0.44),
      st("gcb", 0.44),
      st("ggcc", 0.2),
      st("ebcgc", 0.13),
      { foes: [], boss: "axiom" },
    ],
  },
  // ---------- Book 2: The Elder Dark. Nine stages a chapter: eight of minions, then the boss. ----------
  {
    // Book 2, chapter 1: Lights Under the Sea
    stages: [
      st("g"),
      st("c"),
      st("gb", 0.8),
      st("cc", 0.8),
      st("bgc", 0.48),
      st("ggc", 0.46),
      st("bbcg", 0.26),
      st("egcb", 0.24),
      { foes: [], boss: "lanternmaw" },
    ],
  },
  {
    // Book 2, chapter 2: The Singing Rot
    stages: [
      st("c"),
      st("g"),
      st("gc", 0.82),
      st("bb", 0.66),
      st("ccg", 0.46),
      st("bgc", 0.46),
      st("ggcb", 0.26),
      st("ecbg", 0.24),
      { foes: [], boss: "sporemother" },
    ],
  },
  {
    // Book 2, chapter 3: The City That Forgets
    stages: [
      st("g"),
      st("cg", 0.85),
      st("bc", 0.78),
      st("gg", 0.78),
      st("cbg", 0.46),
      st("ccb", 0.44),
      st("gbcc", 0.24),
      st("egbc", 0.22),
      { foes: [], boss: "mnemovore" },
    ],
  },
  {
    // Book 2, chapter 4: The Moth Moon
    stages: [
      st("b"),
      st("gc", 0.85),
      st("cc", 0.8),
      st("bgg", 0.48),
      st("gcb", 0.46),
      st("ccbg", 0.27),
      st("bbgc", 0.23),
      st("egcbc", 0.15),
      { foes: [], boss: "dustmoth" },
    ],
  },
  {
    // Book 2, chapter 5: The Sleeping Valley
    stages: [
      st("g"),
      st("gg", 0.82),
      st("cg", 0.8),
      st("bc", 0.72),
      st("ggc", 0.46),
      st("cbg", 0.44),
      st("bbgc", 0.24),
      st("egcbg", 0.15),
      { foes: [], boss: "somnarch" },
    ],
  },
  {
    // Book 2, chapter 6: The Silent Bells
    stages: [
      st("c"),
      st("gc", 0.85),
      st("bg", 0.72),
      st("ccg", 0.46),
      st("bgc", 0.44),
      st("ggbc", 0.26),
      st("bbcg", 0.22),
      st("ecbgc", 0.14),
      { foes: [], boss: "hush" },
    ],
  },
  {
    // Book 2, chapter 7: The Elder Dark
    stages: [
      st("gg", 0.85),
      st("cb", 0.8),
      st("ggc", 0.5),
      st("bcg", 0.46),
      st("ccbg", 0.27),
      st("bbgc", 0.24),
      st("eggcc", 0.16),
      st("ebcgb", 0.15),
      { foes: [], boss: "elderdark" },
    ],
  },
  // ---------- Book 3: The Celestials. Eight stages a chapter: seven of minions, then the boss. ----------
  {
    // Book 3, chapter 1: The Falling Star
    stages: [
      st("g"),
      st("gc", 0.84),
      st("bg", 0.78),
      st("ccg", 0.5),
      st("bgc", 0.46),
      st("ggcb", 0.27),
      st("ebcg", 0.24),
      { foes: [], boss: "perihelion" },
    ],
  },
  {
    // Book 3, chapter 2: The Hunter in the Stars
    stages: [
      st("gg", 0.85),
      st("cb", 0.8),
      st("gcg", 0.5),
      st("bbc", 0.46),
      st("ccgb", 0.27),
      st("egbcg", 0.16),
      st("ebcbc", 0.15),
      { foes: [], boss: "asterion" },
    ],
  },
  {
    // Book 3, chapter 3: Where Stars Are Born
    stages: [
      st("gc", 0.82),
      st("bc", 0.78),
      st("ggb", 0.5),
      st("ccb", 0.45),
      st("gcbg", 0.26),
      st("ebcg", 0.2),
      st("ebccg", 0.15),
      { foes: [], boss: "carina" },
    ],
  },
  {
    // Book 3, chapter 4: The Spinning Heart
    stages: [
      st("gb", 0.8),
      st("cc", 0.78),
      st("gbc", 0.48),
      st("bbg", 0.44),
      st("ccgb", 0.25),
      st("egcbg", 0.15),
      st("ebbcc", 0.14),
      { foes: [], boss: "vela" },
    ],
  },
  {
    // Book 3, chapter 5: The Eye of the Sky, the book's finale
    stages: [
      st("gc", 0.8),
      st("cb", 0.74),
      st("gcb", 0.46),
      st("bcg", 0.42),
      st("gcbc", 0.24),
      st("ecbgc", 0.15),
      st("ebcbcg", 0.12),
      { foes: [], boss: "aeon" },
    ],
  },
  // ---------- Book 4: The Titans. Seven stages a chapter: six of minions, then the boss. ----------
  {
    // Book 4, chapter 1: The Waking Mountain
    stages: [
      st("gc", 0.8),
      st("bg", 0.74),
      st("gcb", 0.45),
      st("ccbg", 0.25),
      st("egcbg", 0.15),
      st("ebcbcg", 0.12),
      { foes: [], boss: "orogen" },
    ],
  },
  {
    // Book 4, chapter 2: The Root Below
    stages: [
      st("cg", 0.8),
      st("gb", 0.74),
      st("cbg", 0.45),
      st("ggcb", 0.25),
      st("ebgcc", 0.15),
      st("ecbgbc", 0.12),
      { foes: [], boss: "gnarlroot" },
    ],
  },
  {
    // Book 4, chapter 3: The Amber Hollow
    stages: [
      st("bc", 0.78),
      st("gcg", 0.48),
      st("bcb", 0.42),
      st("cgbc", 0.24),
      st("egbcb", 0.14),
      st("ebcgcb", 0.11),
      { foes: [], boss: "ambrel" },
    ],
  },
];

/** The books of Story mode: where each starts in CHAPTERS and how many chapters it will have once it is all written. */
export const BOOKS = [
  { first: 0, planned: 8 },
  { first: 8, planned: 7 },
  { first: 15, planned: 5 },
  { first: 20, planned: 6 },
] as const;

/** Which book (0-based) a chapter belongs to. */
export const bookOf = (ch: number) => {
  let b = 0;
  while (b + 1 < BOOKS.length && ch >= BOOKS[b + 1].first) b++;
  return b;
};
/** The chapters of one book that exist so far, as indexes into CHAPTERS. */
export const chaptersOf = (book: number) => {
  const end = BOOKS[book + 1]?.first ?? CHAPTERS.length;
  return Array.from({ length: Math.max(0, Math.min(end, CHAPTERS.length) - BOOKS[book].first) }, (_, i) => BOOKS[book].first + i);
};
/** A chapter's number inside its own book, from 1. */
export const chapterInBook = (ch: number) => ch - BOOKS[bookOf(ch)].first + 1;
/** The last chapter of a whole book: beating its boss finishes the book. */
export const endsBook = (ch: number) => chapterInBook(ch) === BOOKS[bookOf(ch)].planned;

/** How many stages a chapter has (Book 1 has ten, Book 2 nine, Book 3 eight, Book 4 seven). */
export const stagesIn = (ch: number) => CHAPTERS[ch]?.stages.length ?? 10;
/** The boss's stage, the last of the chapter. */
export const lairOf = (ch: number) => stagesIn(ch) - 1;

export type Pair = { a: Power; b: Power; fuse: boolean };

/** Team attacks need two different fighters; the same fighter twice can only fuse. */
export const canTeam = (p: Pair) => p.a !== p.b;

/** The player's side: one hybrid, or two fighters each carrying a team attack. */
export function playerSide(p: Pair): FighterDef[] {
  if (p.fuse || !canTeam(p)) {
    const [a, b] = fusionOrder(p.a, p.b);
    return [hybridOf(a, b)];
  }
  return [withTeamAttack(p.a, p.b), withTeamAttack(p.b, p.a)];
}

export function enemySide(ch: number, stage: Stage): FighterDef[] {
  if (stage.boss) return [BOSSES[stage.boss]];
  const share = stage.enemyHp ?? 1;
  const crew = MINIONS[ch] ?? MINIONS[0];
  return stage.foes.map((kind) => {
    const d = crew[kind];
    // the lieutenant leads the crowd, so it keeps more of its health than the minions beside it
    const k = kind === "elite" ? Math.max(0.35, Math.min(1, share * 1.6)) : share;
    return k === 1 ? d : { ...d, hp: Math.round(d.hp * k) };
  });
}

/** Everyone in the fight, with the player on team 0 and the stage on team 1. */
export function stageLineup(p: Pair, ch: number, stage: Stage): { defs: FighterDef[]; teams: number[] } {
  const mine = playerSide(p);
  const theirs = enemySide(ch, stage);
  return { defs: [...mine, ...theirs], teams: [...mine.map(() => 0), ...theirs.map(() => 1)] };
}

// ---------- Saved progress (this browser only) ----------

const PROGRESS_KEY = "npc-arena-story";

/** How many stages of each chapter are cleared, and how many times each chapter's boss has been beaten. */
export type Progress = { cleared: number[]; wins: number[] };

/** Beat a chapter's boss this many times, and own a quest fighter, to skip straight to that boss. */
export const SKIP_AFTER = 2;

/** Whether "Skip to the boss" is open for this chapter. */
export const canSkipToBoss = (p: Progress, ch: number, hasQuester: boolean) =>
  hasQuester && (p.cleared[ch] ?? 0) >= stagesIn(ch) && (p.wins[ch] ?? 0) >= SKIP_AFTER;

export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "null");
    if (raw && Array.isArray(raw.cleared)) {
      const cleared = CHAPTERS.map((_, i) => Math.max(0, Math.min(stagesIn(i), Number(raw.cleared[i]) || 0)));
      const saved: unknown[] = Array.isArray(raw.wins) ? raw.wins : [];
      // a chapter cleared before boss wins were counted has at least its one win
      const wins = cleared.map((c, i) => Math.max(c >= stagesIn(i) ? 1 : 0, Math.min(9999, Math.floor(Number(saved[i]) || 0))));
      return { cleared, wins };
    }
  } catch {
    // unreadable storage starts fresh
  }
  return { cleared: CHAPTERS.map(() => 0), wins: CHAPTERS.map(() => 0) };
}

/** A chapter opens once every stage of the one before it is cleared. */
export const chapterOpen = (cleared: number[], ch: number) => ch === 0 || (cleared[ch - 1] ?? 0) >= stagesIn(ch - 1);

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // storage full or blocked: progress just isn't kept
  }
}


const SEEN_KEY = "npc-arena-story-intros";

/** The chapters whose opening scene this browser has already watched. */
export function loadSeenIntros(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < CHAPTERS.length) : [];
  } catch {
    return [];
  }
}

export function markIntroSeen(ch: number) {
  try {
    const seen = new Set(loadSeenIntros());
    seen.add(ch);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // storage blocked: the intro just plays again next time
  }
}

/** The Story bosses this browser has beaten, in chapter order. Each one is a fighter you can pick outside Story. */
export const bossesBeaten = (cleared: number[]): BossId[] =>
  CHAPTERS.flatMap((ch, i) => {
    const boss = ch.stages[lairOf(i)]?.boss;
    return boss && (cleared[i] ?? 0) >= stagesIn(i) ? [boss] : [];
  });

/** Every chapter with every stage cleared: what developer mode treats as open. */
export const allCleared = (): number[] => CHAPTERS.map((_, i) => stagesIn(i));

/** The book and chapter (both from 1) each boss closes. */
export const bossChapter = (id: BossId): { book: number; chapter: number } => {
  const ch = Math.max(0, CHAPTERS.findIndex((c) => c.stages.some((s) => s.boss === id)));
  return { book: bookOf(ch) + 1, chapter: chapterInBook(ch) };
};
