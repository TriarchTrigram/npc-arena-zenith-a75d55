import type { RosterId } from "./fighters";

/**
 * Tournament brackets, single or double elimination, as one list of matches.
 * Each side of a match says where its fighter comes from: a seed, the winner of
 * an earlier match, or (double elimination) the loser of an earlier match.
 * Matches are stored in the order they are played, so every source comes first.
 */
export type Format = "single" | "double";
export type Section = "winners" | "losers" | "grand";
type Src = { seed: RosterId | null } | { win: number } | { lose: number };

export type Match = {
  id: number;
  section: Section;
  /** Round number inside its section, from 0. */
  round: number;
  from: [Src, Src];
  a: RosterId | null;
  b: RosterId | null;
  /** This side will never be filled: a bye, or an empty branch further back. */
  noA: boolean;
  noB: boolean;
  winner: RosterId | null;
  loser: RosterId | null;
  /** Decided: played, won by walkover, or empty on both sides. */
  done: boolean;
  /** Double elimination only: the second grand final, played if the losers-bracket fighter wins the first. */
  reset?: boolean;
};
export type Bracket = { format: Format; matches: Match[] };
/** A match's id. */
export type MatchRef = number;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffles the entrants into a bracket, handing out byes when the count is not a power of two. */
export function drawBracket(ids: RosterId[], format: Format = "single"): Bracket {
  const pool = shuffle(ids);
  let size = 2;
  while (size < pool.length) size *= 2;
  const first = size / 2;
  const byes = size - pool.length;
  // spread the byes down the bracket so they never meet each other
  const byeAt = new Set<number>();
  for (let i = 0; i < byes; i++) byeAt.add(Math.floor((i * first) / byes));

  const matches: Match[] = [];
  const add = (section: Section, round: number, from: [Src, Src], reset?: boolean) => {
    const id = matches.length;
    matches.push({ id, section, round, from, a: null, b: null, noA: false, noB: false, winner: null, loser: null, done: false, ...(reset ? { reset } : {}) });
    return id;
  };

  // Winners bracket, round one: the seeds.
  let k = 0;
  const w: number[][] = [[]];
  for (let i = 0; i < first; i++) {
    const a = pool[k++] ?? null;
    const b = byeAt.has(i) ? null : pool[k++] ?? null;
    w[0].push(add("winners", 0, [{ seed: a }, { seed: b }]));
  }
  const winnersRound = (r: number) => {
    const prev = w[r - 1];
    w[r] = [];
    for (let i = 0; i < prev.length / 2; i++) w[r].push(add("winners", r, [{ win: prev[2 * i] }, { win: prev[2 * i + 1] }]));
  };

  if (format === "single") {
    for (let r = 1; first >> r >= 1; r++) winnersRound(r);
    return settle({ format, matches });
  }

  // Double elimination, in playing order: W1, L1, then each winners round followed by
  // the losers round its losers drop into and the losers round that halves the field.
  const l: number[][] = [];
  if (first >= 2) {
    l[0] = [];
    for (let i = 0; i < first / 2; i++) l[0].push(add("losers", 0, [{ lose: w[0][2 * i] }, { lose: w[0][2 * i + 1] }]));
  }
  for (let r = 1; first >> r >= 1; r++) {
    winnersRound(r);
    // drop-in round: last losers round's winners meet this winners round's losers,
    // in reverse order every other round so early opponents do not meet again at once
    const prev = l[l.length - 1];
    const drops = w[r];
    const flip = r % 2 === 1;
    const drop: number[] = [];
    for (let i = 0; i < prev.length; i++) {
      const d = drops[flip ? drops.length - 1 - i : i];
      drop.push(add("losers", l.length, [{ win: prev[i] }, { lose: d }]));
    }
    l.push(drop);
    // halving round, until one fighter is left in the losers bracket
    if (drop.length > 1) {
      const half: number[] = [];
      for (let i = 0; i < drop.length / 2; i++) half.push(add("losers", l.length, [{ win: drop[2 * i] }, { win: drop[2 * i + 1] }]));
      l.push(half);
    }
  }
  const winnersFinal = w[w.length - 1][0];
  const losersFinal = l[l.length - 1][0];
  const grand = add("grand", 0, [{ win: winnersFinal }, { win: losersFinal }]);
  add("grand", 1, [{ lose: grand }, { win: grand }], true);
  return settle({ format, matches });
}

/** Fills every side whose source is decided, and decides walkovers and empty matches. */
function settle(b: Bracket): Bracket {
  const ms = b.matches;
  const out = (src: Src): { id: RosterId | null; none: boolean } => {
    if ("seed" in src) return { id: src.seed, none: !src.seed };
    const m = ms["win" in src ? src.win : src.lose];
    if (!m.done) return { id: null, none: false };
    const id = "win" in src ? m.winner : m.loser;
    return { id, none: !id };
  };
  for (const m of ms) {
    // a played match keeps its fighters and result
    if (m.done && m.a && m.b) continue;
    const A = out(m.from[0]);
    const B = out(m.from[1]);
    m.a = A.id;
    m.b = B.id;
    m.noA = A.none;
    m.noB = B.none;
    m.winner = null;
    m.loser = null;
    m.done = false;
    if (m.reset) {
      const gf = ms[(m.from[1] as { win: number }).win];
      // the winners-bracket fighter took the grand final: no reset needed
      if (gf.done && gf.winner === gf.a) {
        m.a = m.b = null;
        m.noA = m.noB = true;
      }
    }
    if (m.noA && m.noB) m.done = true;
    else if (m.noA && m.b) {
      m.winner = m.b;
      m.done = true;
    } else if (m.noB && m.a) {
      m.winner = m.a;
      m.done = true;
    }
  }
  return b;
}

export function recordWinner(b: Bracket, at: MatchRef, winner: RosterId): Bracket {
  const matches = b.matches.map((m) => ({ ...m }));
  const m = matches[at];
  if (!m || m.done || !m.a || !m.b || (winner !== m.a && winner !== m.b)) return b;
  m.winner = winner;
  m.loser = winner === m.a ? m.b : m.a;
  m.done = true;
  return settle({ format: b.format, matches });
}

/** The next match with both fighters known and no result yet, in playing order. */
export function nextMatch(b: Bracket): MatchRef | null {
  return b.matches.find((m) => m.a && m.b && !m.done)?.id ?? null;
}

export function champion(b: Bracket): RosterId | null {
  const last = b.matches[b.matches.length - 1];
  if (!last) return null;
  if (b.format === "single") return last.winner;
  const gf = b.matches[last.id - 1];
  if (!last.done) return null;
  return last.winner ?? gf.winner;
}

const isBout = (m: Match) => !!m.a && !!m.b;

/**
 * Real matches (byes left out): how many are done, and how many there are in all.
 * Double elimination: everyone but the champion loses twice, one loss per match,
 * and the champion loses once more if the grand final goes to a reset.
 */
export function progress(b: Bracket) {
  const n = entrants(b).length;
  const played = b.matches.filter((m) => isBout(m) && m.done).length;
  if (b.format === "single") return { played, total: Math.max(0, n - 1) };
  const last = b.matches[b.matches.length - 1];
  return { played, total: Math.max(0, 2 * n - 2 + (last && isBout(last) ? 1 : 0)) };
}

export const started = (b: Bracket) => progress(b).played > 0;

export const entrants = (b: Bracket): RosterId[] =>
  b.matches
    .filter((m) => m.section === "winners" && m.round === 0)
    .flatMap((m) => m.from.map((s) => ("seed" in s ? s.seed : null)))
    .filter((x): x is RosterId => !!x);

/** The matches of one section, grouped by round. */
export function roundsOf(b: Bracket, section: Section): Match[][] {
  const rounds: Match[][] = [];
  for (const m of b.matches) if (m.section === section) (rounds[m.round] ??= []).push(m);
  return rounds;
}
