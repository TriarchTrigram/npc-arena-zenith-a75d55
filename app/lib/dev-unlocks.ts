// Developer mode's second part: once the code has been entered in this browser (dev-mode.ts), picking
// specific fighters, Story bosses and books here keeps them unlocked in the real save, whether the
// developer switch itself is on or off. Unlike the switch, a pick here never hides anything earned
// honestly, and never touches Story progress, quest counts or new-generation rolls — it only adds.
// Also a device setting, not progress, so it isn't in the progress code's SAVE_KEYS.
import { useEffect, useState } from "react";
import { BOSSES, type BossId } from "./bosses";
import { NEWGEN_IDS, QUEST_IDS, type Power } from "./fighters";
import { BOOKS } from "./story";
import { loadDevMode } from "./dev-mode";

const KEY = "npc-arena-dev-unlocks";
const CHANGED = "npc-arena-dev-unlocks-changed";

export type DevUnlocks = { fighters: Power[]; bosses: BossId[]; books: number[] };
const EMPTY: DevUnlocks = { fighters: [], bosses: [], books: [] };

/** Every fighter that needs unlocking at all — the 16 originals are already open. */
export const UNLOCKABLE_FIGHTERS: Power[] = [...QUEST_IDS, ...NEWGEN_IDS];
/** Every Story boss, in chapter order — what can be picked here. */
export const UNLOCKABLE_BOSSES: BossId[] = Object.keys(BOSSES) as BossId[];

export function loadDevUnlocks(): DevUnlocks {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return EMPTY;
    const fighters = Array.isArray(raw.fighters) ? UNLOCKABLE_FIGHTERS.filter((p) => raw.fighters.includes(p)) : [];
    const bosses = Array.isArray(raw.bosses) ? UNLOCKABLE_BOSSES.filter((b) => raw.bosses.includes(b)) : [];
    const books = Array.isArray(raw.books)
      ? [...new Set<number>(raw.books.filter((n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < BOOKS.length))]
      : [];
    return { fighters, bosses, books };
  } catch {
    return EMPTY;
  }
}

function store(u: DevUnlocks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // storage blocked: the pick just isn't kept
  }
}

function without<T>(list: T[], item: T): T[] {
  return list.filter((x) => x !== item);
}
function toggled<T>(list: T[], item: T): T[] {
  return list.includes(item) ? without(list, item) : [...list, item];
}

/** Turn one fighter's permanent unlock on or off. Only takes effect once the developer code has been entered here. */
export function toggleFighterUnlock(id: Power) {
  if (!loadDevMode().unlocked) return;
  const u = loadDevUnlocks();
  store({ ...u, fighters: toggled(u.fighters, id) });
}
/** Turn one Story boss's permanent unlock on or off. Only takes effect once the developer code has been entered here. */
export function toggleBossUnlock(id: BossId) {
  if (!loadDevMode().unlocked) return;
  const u = loadDevUnlocks();
  store({ ...u, bosses: toggled(u.bosses, id) });
}
/** Turn one book's permanent unlock on or off. Only takes effect once the developer code has been entered here. */
export function toggleBookUnlock(book: number) {
  if (!loadDevMode().unlocked) return;
  const u = loadDevUnlocks();
  store({ ...u, books: toggled(u.books, book) });
}

/** This browser's permanent unlocks, read after the first render so the server and browser agree. */
export function useDevUnlocks(): DevUnlocks {
  const [u, setU] = useState<DevUnlocks>(EMPTY);
  useEffect(() => {
    const read = () => setU(loadDevUnlocks());
    read();
    window.addEventListener(CHANGED, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHANGED, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return u;
}
