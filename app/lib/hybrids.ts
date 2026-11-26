// Saved hybrids: every pair fused (in the Fusion sheet or in Story mode) is kept in this browser
// and offered as a playable fighter on the Fighters page and in the arena.
import { useEffect, useState } from "react";
import { hybridKey, parseHybridKey, type Power, type RosterId } from "./fighters";

const HYBRIDS_KEY = "npc-arena-hybrids";
const CHANGED = "npc-arena-hybrids-changed";

/** The saved hybrid keys, oldest first. Unreadable entries are dropped. */
export function loadHybrids(): RosterId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HYBRIDS_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const keys = raw.filter((k): k is string => typeof k === "string" && !!parseHybridKey(k));
    return [...new Set(keys)];
  } catch {
    return [];
  }
}

/** Save a fused pair (one entry per pair, in either order) and tell every open screen. */
export function rememberHybrid(a: Power, b: Power): RosterId {
  const key = hybridKey(a, b);
  try {
    const list = loadHybrids();
    if (!list.includes(key)) localStorage.setItem(HYBRIDS_KEY, JSON.stringify([...list, key]));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // not kept if storage is blocked
  }
  return key;
}

/** The saved hybrids, read after the first render so the server and browser agree. */
export function useHybrids(): RosterId[] {
  const [list, setList] = useState<RosterId[]>([]);
  useEffect(() => {
    const read = () => setList(loadHybrids());
    read();
    window.addEventListener(CHANGED, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHANGED, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return list;
}
