// Progress codes: a copy of this browser's saved progress kept on the server, opened by a minted code.
// The code is made and checked by the platform's access codes (`routes/api.progress-code.tsx`); this file is the
// browser side: which saves travel, gathering them up, and writing a loaded copy back before the page reloads.
// Each save is cleaned by its own loader when it is read, so a loaded copy goes through the same checks as one made here.

/** Every localStorage save that counts as progress. Sound and music volume stay with the device. */
export const SAVE_KEYS = [
  "npc-arena-story",
  "npc-arena-story-intros",
  "npc-arena-quests",
  "npc-arena-hybrids",
  "npc-arena-me",
  "npc-arena-own-powers",
  "npc-arena-free",
  "npc-arena-rehab",
] as const;

export type SaveKey = (typeof SAVE_KEYS)[number];
export type ProgressSave = Partial<Record<SaveKey, string>>;

/** Largest single save the server accepts, in characters. */
export const MAX_SAVE_CHARS = 40_000;
/** Minted codes are this long; shown as two halves with a hyphen. */
export const CODE_LENGTH = 10;

const CODE_KEY = "npc-arena-progress-code";

/** Uppercase letters and digits only, so "abcde-23456" and "ABCDE 23456" are the same code. */
export const normalizeCode = (typed: string) => typed.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const formatCode = (code: string) => {
  const c = normalizeCode(code);
  return c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
};

/** This browser's progress, ready to send. */
export function collectSave(): ProgressSave {
  const save: ProgressSave = {};
  for (const key of SAVE_KEYS) {
    try {
      const v = localStorage.getItem(key);
      if (v != null && v.length <= MAX_SAVE_CHARS) save[key] = v;
    } catch {
      // storage blocked: nothing to send for this one
    }
  }
  return save;
}

/** Replace this browser's progress with a loaded copy. Saves the copy does not have are cleared. */
export function applySave(save: ProgressSave) {
  for (const key of SAVE_KEYS) {
    const v = save[key];
    if (typeof v === "string") localStorage.setItem(key, v);
    else localStorage.removeItem(key);
  }
}

/** The code this browser saves to, so the player can see it again and keep it up to date. */
export function loadCode(): string | null {
  try {
    const c = normalizeCode(localStorage.getItem(CODE_KEY) ?? "");
    return c.length === CODE_LENGTH ? c : null;
  } catch {
    return null;
  }
}

export function rememberCode(code: string | null) {
  try {
    if (code) localStorage.setItem(CODE_KEY, normalizeCode(code));
    else localStorage.removeItem(CODE_KEY);
  } catch {
    // storage blocked: the code just isn't remembered here
  }
}

export type CodeReply =
  | { ok: true; code: string; save?: ProgressSave }
  | { ok: false; reason: "wrong" | "too_many" | "busy" | "too_large" | "failed"; retryAfterSeconds?: number };

async function post(body: unknown): Promise<CodeReply> {
  try {
    const res = await fetch("/api/progress-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as CodeReply;
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Save this browser's progress: to its code when it has one, or under a new code when it does not. */
export const saveToCode = (code: string | null) => post({ action: "save", code: code ?? undefined, save: collectSave() });
/** Fetch the progress a code holds (nothing is written until `applySave`). */
export const loadFromCode = (code: string) => post({ action: "load", code: normalizeCode(code) });
