// The fighter you made in Free World's character creator, kept in this browser like hybrids are.
// Free World walks it as you, and the arena offers it in its own row of the fighter picker.
import { useEffect, useState } from "react";
import { cleanSpec, customKey, rememberOwnPower, type CustomSpec, type RosterId } from "./fighters";

const KEY = "npc-arena-me";
const CHANGED = "npc-arena-me-changed";

/** Your saved character, or null when you have not made one. */
export function loadMyFighter(): CustomSpec | null {
  try {
    const spec = cleanSpec(JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<CustomSpec> | null);
    if (spec?.own) rememberOwnPower(spec.own);
    return spec;
  } catch {
    return null;
  }
}

/** Save your character (replacing the last one) and tell every open screen. Returns its roster id. */
export function saveMyFighter(spec: CustomSpec): RosterId {
  const clean = cleanSpec(spec) ?? spec;
  // a power you invented is kept by id, so the arena can rebuild the fighter from its roster id
  if (clean.own) rememberOwnPower(clean.own);
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // not kept if storage is blocked
  }
  return customKey(clean);
}

/** Your character's sheet and roster id, read after the first render so the server and browser agree. */
export function useMyFighter(): { spec: CustomSpec | null; id: RosterId | null } {
  const [spec, setSpec] = useState<CustomSpec | null>(null);
  useEffect(() => {
    const read = () => setSpec(loadMyFighter());
    read();
    window.addEventListener(CHANGED, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHANGED, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return { spec, id: spec ? customKey(spec) : null };
}
