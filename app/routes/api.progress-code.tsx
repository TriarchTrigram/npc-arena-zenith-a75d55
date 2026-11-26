// Progress codes: "save" keeps a copy of a browser's progress under a minted code (or refreshes the copy a code
// already holds), "load" hands that copy back to whoever types the code. No account is involved: the code is the
// key, made and checked by ~stencil/access-codes, which stores it one-way and limits wrong guesses.
import type { Route } from "./+types/api.progress-code";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "~stencil/db";
import { limitVisitor } from "~stencil/form-guard";
import { mintAccessCode, verifyAccessCode } from "~stencil/access-codes";
import { progressSaves } from "~/generated/db-schema";
import { CODE_LENGTH, MAX_SAVE_CHARS, SAVE_KEYS, normalizeCode, type ProgressSave } from "~/lib/progress-code";

const PURPOSE = "progress-code";

const Save = z
  .record(z.string(), z.string().max(MAX_SAVE_CHARS))
  .transform((raw) => {
    const save: ProgressSave = {};
    for (const key of SAVE_KEYS) {
      const v = raw[key];
      if (typeof v !== "string") continue;
      // only well-formed saves are kept; each save is cleaned again by its own loader when read
      try {
        JSON.parse(v);
        save[key] = v;
      } catch {
        // an unreadable save is left out
      }
    }
    return save;
  });

const Code = z.string().max(40).transform(normalizeCode).pipe(z.string().length(CODE_LENGTH));

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), code: Code.optional(), save: Save }),
  z.object({ action: z.literal("load"), code: Code }),
]);

const refuse = (reason: string, retryAfterSeconds?: number) =>
  Response.json({ ok: false, reason, retryAfterSeconds }, { status: reason === "failed" ? 500 : 400 });

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  if (request.method !== "POST") return new Response(null, { status: 405 });

  const limit = await limitVisitor(env, request, { name: "progress-code", max: 30, windowSeconds: 600, maxBodyBytes: 400_000 });
  if (!limit.ok) return refuse(limit.reason === "too_large" ? "too_large" : "busy");

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) return refuse("wrong");
    body = parsed.data;
  } catch {
    return refuse("wrong");
  }

  const db = createDb(env);
  try {
    // a code someone has: check it first, and every refusal looks the same
    let saveId: string | null = null;
    if (body.code) {
      const check = await verifyAccessCode(env, request, { purpose: PURPOSE, code: body.code });
      if (!check.ok) return refuse(check.reason, check.reason === "too_many" ? check.retryAfterSeconds : undefined);
      saveId = check.pass.subject;
    }

    if (body.action === "load") {
      const [row] = await db.select({ save: progressSaves.save }).from(progressSaves).where(eq(progressSaves.id, saveId!));
      if (!row) return refuse("wrong");
      const save = Save.safeParse(row.save);
      return Response.json({ ok: true, code: body.code, save: save.success ? save.data : {} });
    }

    const now = new Date().toISOString();
    if (saveId) {
      await db.update(progressSaves).set({ save: body.save, updatedAt: now }).where(eq(progressSaves.id, saveId));
      return Response.json({ ok: true, code: body.code });
    }

    // a new code: a fresh copy plus a code that names it, with a tighter cap on how many one visitor makes
    const fresh = await limitVisitor(env, request, { name: "progress-code-new", max: 5, windowSeconds: 3600, maxBodyBytes: 400_000 });
    if (!fresh.ok) return refuse("busy");
    const id = crypto.randomUUID();
    await db.insert(progressSaves).values({ id, save: body.save, createdAt: now, updatedAt: now });
    const { code } = await mintAccessCode(env, { subject: id, purpose: PURPOSE, length: CODE_LENGTH });
    return Response.json({ ok: true, code });
  } catch (error) {
    console.error("progress code failed", body.action, error);
    return refuse("failed");
  }
}
