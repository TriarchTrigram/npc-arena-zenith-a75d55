// The character creator's "Your own power": the AI turns a power someone typed into one the game can play.
// It names it, colours it, picks the element it sounds and arrives like, decides how many moves it has and designs
// every move from scratch (kind, strength, the shape it throws, how it travels, its trail and how it bursts).
// The answer is checked with cleanOwn before it goes back, so only a playable power leaves here.
import type { Route } from "./+types/api.own-power";
import { generateObject } from "ai";
import { z } from "zod";
import { createAI } from "~stencil/ai";
import { limitVisitor } from "~stencil/form-guard";
import {
  ANIMS, FIGHTERS, MAX_OWN_MOVES, MIN_OWN_MOVES, OWN_BURSTS, OWN_GLYPHS, OWN_KINDS, OWN_MOTIONS, OWN_SIZES,
  OWN_SPARKS, OWN_SPEEDS, OWN_STRENGTHS, OWN_TRAILS, ROLES, STATUSES, cleanOwn, type OwnKind,
} from "~/lib/fighters";

const Body = z.object({ idea: z.string().trim().min(2).max(60) });

const KIND_WORDS: Record<OwnKind, string> = {
  melee: "a close strike in front", projectile: "shots fired from the hand", beam: "a held ray from the hand",
  burst: "a blast all around the user", dash: "a rush forward through enemies", eruption: "pillars bursting up from the ground under the target",
  rain: "pieces falling from the sky around the target", blink: "vanish and reappear behind the target to strike", heal: "heals the user",
  zone: "a lingering field on the ground", pull: "yanks the target in",
};

const enumOf = (xs: readonly string[]) => z.enum(xs as [string, ...string[]]);
const clamp = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo)));

const MoveDesign = z.object({
  name: z.string().describe("A new name for this move, 1 to 3 words, Title Case, at most 24 characters"),
  kind: enumOf(OWN_KINDS).describe("What kind of attack it is"),
  anim: enumOf(ANIMS).describe("How the stick figure's body moves to do it"),
  strength: enumOf(OWN_STRENGTHS).describe("light: quick and weak, used often. heavy: slow and strong, used rarely"),
  size: enumOf(OWN_SIZES).describe("How big it is: reach for a strike, shot size, blast or field size"),
  speed: enumOf(OWN_SPEEDS).describe("How fast its shots fly (only matters for shots)"),
  count: z.number().describe("How many shots (1 to 5), falling pieces (3 to 7) or pillars (1 to 4); 1 for every other kind"),
  arc: z.boolean().describe("Shots lob in an arc instead of flying straight"),
  pierce: z.boolean().describe("Shots pass through enemies instead of stopping"),
  effect: z.boolean().describe("Its hits leave the power's effect on the enemy"),
  hue: z.number().describe("This move's own colour hue, 0 to 359"),
  spark: enumOf(OWN_SPARKS).describe("The particle this move throws off"),
  glyph: enumOf(OWN_GLYPHS).describe("The shape this move is made of: what flies, rises, orbits or bursts"),
  trail: enumOf(OWN_TRAILS).describe("What it leaves behind as it travels, or the pattern of a ray or field"),
  motion: enumOf(OWN_MOTIONS).describe("How its shape moves: steady, spinning, wobbling side to side, or pulsing in size"),
  burst: enumOf(OWN_BURSTS).describe("How it bursts when it hits someone"),
});

const Answer = z.object({
  fits: z.boolean().describe(
    "false when the idea is hateful, sexual, or about hurting real people, or when it would make the fighter immortal, invincible, unkillable or unable to take damage",
  ),
  name: z.string().describe("The power's name: 1 to 3 words, Title Case, at most 22 characters"),
  word: z.string().describe("One short word (at most 10 letters) that names its two signature moves, e.g. Honey, Static, Ink"),
  about: z.string().describe("One plain sentence under 100 characters saying what the power does in a fight"),
  base: enumOf(FIGHTERS.map((f) => f.id)).describe("The game element it should sound and arrive like"),
  role: enumOf(ROLES),
  mainHue: z.number().describe("Main colour hue, 0 to 359"),
  mainSaturation: z.number().describe("Main colour saturation, 30 to 100"),
  mainLightness: z.number().describe("Main colour lightness, 25 to 62"),
  glowHue: z.number().describe("Glow colour hue, 0 to 359"),
  glowLightness: z.number().describe("Glow colour lightness, 60 to 92"),
  spark: enumOf(OWN_SPARKS).describe("The particle the power throws off"),
  effect: enumOf([...STATUSES, "none"]).describe("What its hits leave on the enemy"),
  moves: z
    .array(MoveDesign)
    .min(1)
    .describe(`Between ${MIN_OWN_MOVES} and ${MAX_OWN_MOVES} moves, as many as the idea deserves, ordered from the most basic to the strongest`),
});

const takenNames = FIGHTERS.flatMap((f) => f.moves.map((m) => m.name)).join(", ");
const kindList = OWN_KINDS.map((k) => `${k}: ${KIND_WORDS[k]}`).join("\n");

const SYSTEM = `You design powers for NPC Arena, a game where stick figures with elemental powers fight.
A player typed a power idea. Turn it into an original power the game can play, with moves nobody in the game has.
- Pick colours that look like the idea. Main colour is the body and moves, glow is the highlight.
- Decide how many moves it gets, from ${MIN_OWN_MOVES} to ${MAX_OWN_MOVES}: a simple idea gets a few, a rich idea with lots going on gets more.
- Design every move yourself, from the idea. Each move must be original and different from the power's other moves: a different kind or strength, and a different mix of shape, trail, motion and burst. Think about what this power would really do and build each move to match it (a bee power throws a swarm of small spinning hexes that burst into a fountain, a piano power drops heavy cubes from the sky).
- The first move is a close strike (kind melee). Use a mix after that: something ranged and something big. At most one heal, and only if the idea heals.
- Use "effect" only on moves that would really leave the power's effect.
- Each move's hue fits the idea; keep them close to the main colour unless the idea has several colours.
- Move names come from the idea, 1 to 3 plain words, no numbers, all different. Never use a name the game's fighters already have: ${takenNames}.
- Plain words, no em dashes, no hype, UK spelling (colour, armour).
- Never make the power immortal, invincible, unkillable, unable to take damage, or give it infinite or endless health. Whatever the idea, this fighter can always be knocked out in a fight like any other.

Kinds of move:
${kindList}`;

const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  if (request.method !== "POST") return Response.json({ ok: false, code: "failed" }, { status: 405 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, code: "short" }, { status: 400 });
  const limit = await limitVisitor(env, request, { name: "own-power", max: 60, windowSeconds: 600 });
  if (!limit.ok) return Response.json({ ok: false, code: "busy" }, { status: 429 });

  const ai = createAI(env);
  try {
    const { object } = await generateObject({
      model: ai.languageModel("anthropic:claude-haiku-5-5", { feature: "own-power" }),
      providerOptions: { anthropic: { thinking: { type: "disabled" } } },
      maxOutputTokens: 4000,
      schema: Answer,
      system: SYSTEM,
      prompt: `The player's power idea: ${JSON.stringify(parsed.data.idea)}`,
    });
    if (!object.fits) return Response.json({ ok: false, code: "refused" });
    const power = cleanOwn({
      id: newId(),
      name: object.name,
      word: object.word,
      about: object.about,
      base: object.base,
      role: object.role,
      color: hsl(clamp(object.mainHue, 0, 359), clamp(object.mainSaturation, 30, 100), clamp(object.mainLightness, 25, 62)),
      glow: hsl(clamp(object.glowHue, 0, 359), 100, clamp(object.glowLightness, 60, 92)),
      spark: object.spark,
      status: object.effect === "none" ? null : object.effect,
      moves: object.moves,
    });
    if (!power) {
      console.error("own power: the answer was not a playable power");
      return Response.json({ ok: false, code: "failed" });
    }
    return Response.json({ ok: true, power });
  } catch (error) {
    console.error("own power failed:", error);
    return Response.json({ ok: false, code: "failed" });
  }
}
