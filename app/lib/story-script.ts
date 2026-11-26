// Who says what in Story mode's scenes. The words live in strings.json under story.script.c<chapter>;
// this file only says how many lines each scene has and who speaks each one.
import type { StringKey } from "~stencil/types/strings";
import { bookOf, lairOf } from "./story";

export type Speaker = "narrator" | "you" | "foe" | "boss";
export type Line = { who: Speaker; key: StringKey };
export type SceneKind = "intro" | "stage" | "outro" | "ending";
export type Scene = { kind: SceneKind; ch: number; stage: number };

const k = (ch: number, part: string, n: number) => `story.script.c${ch + 1}.${part}.l${n}` as StringKey;

/** Book 2's epilogue, after the Elder Dark falls: the narrator, then the player's pair, then the closing line. */
const ENDING: Line[] = [
  { who: "narrator", key: "story.ending.l1" },
  { who: "narrator", key: "story.ending.l2" },
  { who: "narrator", key: "story.ending.l3" },
  { who: "narrator", key: "story.ending.l4" },
  { who: "you", key: "story.ending.l5" },
  { who: "narrator", key: "story.ending.l6" },
];

/** Book 3's epilogue, after Aeon falls: the same shape, the narrator, the player's pair, then the closing line. */
const ENDING3: Line[] = [
  { who: "narrator", key: "story.ending3.l1" },
  { who: "narrator", key: "story.ending3.l2" },
  { who: "narrator", key: "story.ending3.l3" },
  { who: "narrator", key: "story.ending3.l4" },
  { who: "you", key: "story.ending3.l5" },
  { who: "narrator", key: "story.ending3.l6" },
];

/** The lines of one scene: a chapter's opening, the words before a stage, the boss's last words, or a book's ending. */
export function sceneLines(scene: Scene): Line[] {
  const { kind, ch, stage } = scene;
  if (kind === "ending") return bookOf(ch) === 2 ? ENDING3 : ENDING;
  if (kind === "intro") return [1, 2, 3].map((n) => ({ who: "narrator", key: k(ch, "intro", n) }));
  if (kind === "outro") return [{ who: "boss", key: k(ch, "outro", 1) }, { who: "you", key: k(ch, "outro", 2) }, { who: "narrator", key: k(ch, "outro", 3) }];
  // the boss's stage: the last of the chapter (s10 in Book 1, s9 in Book 2, s8 in Book 3)
  if (stage >= lairOf(ch)) {
    const part = `s${lairOf(ch) + 1}`;
    return [{ who: "boss", key: k(ch, part, 1) }, { who: "you", key: k(ch, part, 2) }, { who: "boss", key: k(ch, part, 3) }];
  }
  return [{ who: "foe", key: k(ch, `s${stage + 1}`, 1) }, { who: "you", key: k(ch, `s${stage + 1}`, 2) }];
}
