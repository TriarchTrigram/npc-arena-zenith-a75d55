// Developer mode: checks a typed code against the developer code. Guesses are capped per visitor.
import type { Route } from "./+types/api.dev-mode";
import { z } from "zod";
import { limitVisitor } from "~stencil/form-guard";
import { isDevCode } from "~/lib/dev-code.server";

const Body = z.object({ code: z.string().max(20) });

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  if (request.method !== "POST") return new Response(null, { status: 405 });

  // five tries per ten minutes per visitor, so the code cannot be swept
  const limit = await limitVisitor(env, request, { name: "dev-mode-code", maxBodyBytes: 2_000 });
  if (!limit.ok) return Response.json({ ok: false, reason: "busy" }, { status: 429 });

  try {
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success || !isDevCode(parsed.data.code)) return Response.json({ ok: false, reason: "wrong" }, { status: 400 });
  } catch {
    return Response.json({ ok: false, reason: "wrong" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
