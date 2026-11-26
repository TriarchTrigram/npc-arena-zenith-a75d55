import { redirect } from "../http";
import { saveStoredLocale, storedLocale } from "../locale";
import { appLocales, resolveLocale } from "../strings";
import type { SetupFlow, SetupState, SetupStep } from "../types/setup";
import { requireAuth } from "./server";

export type { SetupFlow, SetupState, SetupStep } from "../types/setup";

// The one answer to "has this app user finished setting up": the platform keeps it per
// app user in `app_setup`, and the gate and the step screens read it through these helpers.

// Its own table rather than a column on Better Auth's `user` table, so the sign-up insert
// never touches it and an app whose D1 predates setup keeps working.
const SETUP_TABLE_DDL =
  "CREATE TABLE IF NOT EXISTS `app_setup` (`user_id` text PRIMARY KEY NOT NULL, `last_step` text, `completed_at` integer);";

let ensured = false;

async function ensureSetupTable(env: Env): Promise<void> {
  if (ensured) return;
  await env.DB.prepare(SETUP_TABLE_DDL).run();
  ensured = true;
}

function sinceMoment(flow: SetupFlow): Date {
  const since = new Date(flow.since);
  // A bare day would parse as midnight UTC and send every account from earlier that day into setup.
  if (Number.isNaN(since.getTime()) || !flow.since.includes("T")) {
    throw new Error(
      `setup.since must be the moment setup went in, as an ISO date-time like 2026-10-23T14:05:00Z, got "${flow.since}"`,
    );
  }
  return since;
}

/** The step after `lastStep`; the first before any, and the final one again when the
 *  last step was saved but setup was never completed. */
function stepAfter(flow: SetupFlow, lastStep: string | null): SetupStep | null {
  if (flow.steps.length === 0) return null;
  const at = lastStep ? flow.steps.findIndex((step) => step.id === lastStep) : -1;
  return flow.steps[Math.min(at + 1, flow.steps.length - 1)];
}

/** `flow` as this request walks it: without its language step while the app speaks one language. */
export function setupFor(request: Request, flow: SetupFlow): SetupFlow {
  if (appLocales(request).locales.length > 1) return flow;
  const steps = flow.steps.filter((step) => step.kind !== "language");
  return steps.length === flow.steps.length ? flow : { ...flow, steps };
}

/** Keep the language this page is shown in on the app user's account, so it follows them
 *  to their next device. Called from the action of the language step. */
export async function saveSetupLanguage(request: Request, env: Env, userId: string): Promise<void> {
  if (appLocales(request).locales.length < 2) return;
  const { locale } = resolveLocale(request, await storedLocale(request, env));
  await saveStoredLocale(env, userId, locale);
}

/** Where `user` stands in setup. With no row of their own, an account created before
 *  `flow.since` counts as set up and a newer one as not started. */
export async function getSetupState(
  env: Env,
  user: { id: string; createdAt: Date | string | number },
  flow: SetupFlow,
): Promise<SetupState> {
  await ensureSetupTable(env);
  const row = await env.DB.prepare("SELECT `last_step`, `completed_at` FROM `app_setup` WHERE `user_id` = ?")
    .bind(user.id)
    .first<{ last_step: string | null; completed_at: number | null }>();
  const complete = row ? row.completed_at != null : new Date(user.createdAt) < sinceMoment(flow);
  const lastStep = row?.last_step ?? null;
  return { complete, lastStep, nextStep: complete ? null : stepAfter(flow, lastStep) };
}

/** Record that the app user finished `stepId`, so a later visit resumes after it. */
export async function markSetupStep(env: Env, userId: string, stepId: string): Promise<void> {
  await ensureSetupTable(env);
  await env.DB.prepare(
    "INSERT INTO `app_setup` (`user_id`, `last_step`) VALUES (?, ?) ON CONFLICT(`user_id`) DO UPDATE SET `last_step` = excluded.`last_step`",
  )
    .bind(userId, stepId)
    .run();
}

/** Mark the app user as set up. Called once, from the action of the final step. */
export async function completeSetup(env: Env, userId: string): Promise<void> {
  await ensureSetupTable(env);
  await env.DB.prepare(
    "INSERT INTO `app_setup` (`user_id`, `completed_at`) VALUES (?, ?) ON CONFLICT(`user_id`) DO UPDATE SET `completed_at` = excluded.`completed_at`",
  )
    .bind(userId, Date.now())
    .run();
}

/** Send the app user back to the first step, whenever their account was created. */
export async function resetSetup(env: Env, userId: string): Promise<void> {
  await ensureSetupTable(env);
  await env.DB.prepare(
    "INSERT INTO `app_setup` (`user_id`, `last_step`, `completed_at`) VALUES (?, NULL, NULL) ON CONFLICT(`user_id`) DO UPDATE SET `last_step` = NULL, `completed_at` = NULL",
  )
    .bind(userId)
    .run();
}

/** Where an unfinished account belongs: the step screen after the last step recorded.
 *  Falls back to the flow's own path for a flow that declares no steps. */
export function setupStepPath(flow: SetupFlow, state: SetupState): string {
  return state.nextStep ? `${flow.path}/${state.nextStep.id}` : flow.path;
}

/** Require a signed-in app user who has finished setup: redirects to /login when signed
 *  out and to their next step screen while setup is unfinished, except on `flow.path`
 *  itself and below it. Call it from the loader of the layout every signed-in screen
 *  renders under. It aims at the step screen rather than at `flow.path`, so an app user
 *  reaches setup whether or not the app registered a route at the path itself. */
export async function requireSetup(request: Request, env: Env, flow: SetupFlow) {
  const result = await requireAuth(request, env);
  const walked = setupFor(request, flow);
  const setup = await getSetupState(env, result.user, walked);
  const { pathname } = new URL(request.url);
  const onSetup = pathname === flow.path || pathname.startsWith(`${flow.path}/`);
  // A flow whose only step was the language step has nothing to ask on a one-language app.
  const nothingToAsk = walked.steps.length === 0 && flow.steps.length > 0;
  if (!setup.complete && !onSetup && !nothingToAsk) throw redirect(setupStepPath(walked, setup));
  return { ...result, setup };
}
