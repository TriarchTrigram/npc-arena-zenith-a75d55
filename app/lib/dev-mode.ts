// Developer mode: unlocked once per browser by typing the developer code, which only the server knows
// (`routes/api.dev-mode.tsx`). While it is on, every fighter, boss, book, chapter and stage is open, and nothing
// played changes the real save: Story progress, quest counts and new-generation rolls are left as they were.
// It is a device setting like the volume, not progress, so it is not in the progress code's SAVE_KEYS.
import { useEffect, useState } from "react";

const KEY = "npc-arena-dev";
const CHANGED = "npc-arena-dev-changed";

/** "on" and "off" both mean the code was entered here; with no value the code has never been entered. */
export type DevState = { unlocked: boolean; on: boolean };
const LOCKED: DevState = { unlocked: false, on: false };

export function loadDevMode(): DevState {
  try {
    const v = localStorage.getItem(KEY);
    return v === "on" ? { unlocked: true, on: true } : v === "off" ? { unlocked: true, on: false } : LOCKED;
  } catch {
    return LOCKED;
  }
}

/** Whether developer mode is on right now, for event handlers and effects. */
export const isDevMode = () => loadDevMode().on;

function store(v: "on" | "off" | null) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // storage blocked: developer mode just isn't kept
  }
}

/** Turn developer mode on or off in a browser that has already entered the code. */
export const setDevMode = (on: boolean) => {
  if (loadDevMode().unlocked) store(on ? "on" : "off");
};
/** After the server accepted the code: unlock and switch on. */
export const unlockDevMode = () => store("on");
/** Forget the code here: the next use needs it typed again. */
export const lockDevMode = () => store(null);

/** Ask the server whether a typed code is the developer code. */
export async function checkDevCode(code: string): Promise<{ ok: true } | { ok: false; reason: "wrong" | "busy" | "failed" }> {
  try {
    const res = await fetch("/api/dev-mode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return (await res.json()) as { ok: true } | { ok: false; reason: "wrong" | "busy" | "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Developer mode for this browser, read after the first render so the server and browser agree. */
export function useDevMode(): DevState {
  const [s, setS] = useState<DevState>(LOCKED);
  useEffect(() => {
    const read = () => setS(loadDevMode());
    read();
    window.addEventListener(CHANGED, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(CHANGED, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return s;
}
