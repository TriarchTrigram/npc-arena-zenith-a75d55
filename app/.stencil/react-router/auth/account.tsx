import { useState } from "react";
import { Form, data, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { and, eq, ne } from "drizzle-orm";
import { ACCOUNT_PHOTO_PREFIX, ACCOUNT_PHOTO_ROUTE } from "../../auth/account-photos";
import { closeAccount, forgetSession, requireAuth, safeReturnTo } from "../../auth/server";
import { session as sessionTable } from "../../auth/schema";
import { createAuth } from "../../auth/utils";
import { forwardCookies, postToAuth } from "../../auth/two-factor";
import { getSubscription, isComplimentary, manageSubscription } from "../../payments/server";
import { createDb } from "../../db";
import { createStorage } from "../../storage";
import { SignOutButton } from "../../ui/auth/sign-out-button";
import { StoredPhoto } from "../../ui/photo/stored";
import { hasPassword as userHasPassword } from "./set-password";

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 8;

type Intent = "profile" | "remove-photo" | "email" | "password" | "devices" | "billing" | "close";
type Result = { intent: Intent; ok: boolean; message: string; billing?: boolean };

/** /auth/account — the stock account page every app with sign-in gets: name and photo,
 *  sign-in email, password, other devices, two-factor, sign out and close account.
 *  Apps link here from their account menu; an app that wants its own look builds
 *  its own screens on the same calls and keeps this one as the fallback. */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const [hasPassword, { sub }] = await Promise.all([
    userHasPassword(env, user.id),
    getSubscription(request, context),
  ]);
  return {
    backTo: backToApp(request),
    // Free access has no Stripe customer, so there is nothing for the portal to open.
    canManageBilling: Boolean(sub?.customerId) && !isComplimentary(sub),
    user: {
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
    },
    hasPassword,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const { user, session } = await requireAuth(request, env);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "") as Intent;
  const auth = createAuth(env, false, undefined, request);
  const origin = new URL(request.url).origin;

  const reply = (ok: boolean, message: string, extra: Partial<Result> = {}, status = ok ? 200 : 400) =>
    data<Result>({ intent, ok, message, ...extra }, { status });

  // Sensitive endpoints re-read the session row, so one revoked elsewhere answers 401.
  const fromAuth = async (res: Response, okMessage: string): Promise<ReturnType<typeof reply>> => {
    if (res.ok) return data<Result>({ intent, ok: true, message: okMessage }, { headers: forwardCookies(res) });
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (res.status === 401) {
      return reply(false, "Your session has ended. Sign in again, then retry.", {}, 401);
    }
    if (body?.code === "INVALID_PASSWORD") return reply(false, "That isn't your current password.");
    if (body?.code === "PASSWORD_TOO_SHORT") return reply(false, `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    return reply(false, body?.message || "That didn't work. Please try again.", {}, res.status >= 500 ? 500 : 400);
  };

  switch (intent) {
    case "profile": {
      const name = String(form.get("name") ?? "").trim();
      if (!name || name.includes("@") || name.length > 100) {
        return reply(false, "Enter the name people should see — not an email address.");
      }
      const photo = form.get("photo");
      const update: { name: string; image?: string } = { name };
      if (photo instanceof File && photo.size > 0) {
        const ext = PHOTO_TYPES[photo.type];
        if (!ext) return reply(false, "Use a JPG, PNG, WebP or GIF image.");
        if (photo.size > PHOTO_MAX_BYTES) return reply(false, "Choose a photo under 5 MB.");
        const file = `${user.id}/${crypto.randomUUID()}.${ext}`;
        await createStorage(env).put(`${ACCOUNT_PHOTO_PREFIX}${file}`, photo, {
          httpMetadata: { contentType: photo.type },
        });
        update.image = `${ACCOUNT_PHOTO_ROUTE}${file}`;
      }
      const res = await postToAuth(auth, request, "/update-user", update);
      if (res.ok) forgetSession();
      if (res.ok && update.image) await deleteStoredPhoto(env, user.id, user.image);
      return fromAuth(res, "Saved.");
    }
    case "remove-photo": {
      const res = await postToAuth(auth, request, "/update-user", { image: null });
      if (res.ok) {
        forgetSession();
        await deleteStoredPhoto(env, user.id, user.image);
      }
      return fromAuth(res, "Photo removed.");
    }
    case "email": {
      const newEmail = String(form.get("email") ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return reply(false, "Enter a valid email address.");
      if (newEmail === user.email.toLowerCase()) return reply(false, "That's already your sign-in email.");
      const res = await postToAuth(auth, request, "/change-email", {
        newEmail,
        callbackURL: `${origin}/auth/account`,
      });
      // The same answer whether or not the address is taken, so nothing leaks.
      return fromAuth(
        res,
        user.emailVerified
          ? `Check ${user.email} for a link to approve the change. Once approved, we'll send a confirmation to ${newEmail}.`
          : `Check ${newEmail} for a link to confirm your new email.`,
      );
    }
    case "password": {
      const currentPassword = String(form.get("currentPassword") ?? "");
      const newPassword = String(form.get("newPassword") ?? "");
      if (newPassword.length < MIN_PASSWORD_LENGTH) return reply(false, `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      if (newPassword !== String(form.get("confirmPassword") ?? "")) return reply(false, "The two passwords don't match.");
      const res = await postToAuth(auth, request, "/change-password", {
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      return fromAuth(res, "Password changed.");
    }
    case "devices": {
      // Deleted here in one statement: Better Auth's own endpoint only looks at the
      // first 100 session rows, so sign-ins past that stayed live behind a success.
      await createDb(env)
        .delete(sessionTable)
        .where(and(eq(sessionTable.userId, user.id), ne(sessionTable.id, session.id)));
      return reply(true, "Signed out everywhere except this device.");
    }
    case "billing": {
      // Always leaves by redirect: to the billing portal, or back here when there is nothing to manage.
      await manageSubscription(request, context, `${origin}/auth/account`);
      return reply(false, "Billing couldn't be opened. Try again.");
    }
    case "close": {
      if (form.get("billing") === "1") {
        await manageSubscription(request, context, `${origin}/auth/account`);
      }
      const { error, code } = await closeAccount(request, env, "/");
      return reply(false, error, { billing: code === "active_subscription" });
    }
    default:
      return reply(false, "Unknown action.");
  }
}

/** Where "Back to the app" leads: a same-origin `?next=`, else the same-origin page that
 *  linked here (apps link with a bare `<Link to="/auth/account">`) unless it is another
 *  auth page, else the app's home. */
function backToApp(request: Request): string {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  if (next) return safeReturnTo(next, "/");
  const referer = request.headers.get("referer");
  if (referer && URL.canParse(referer)) {
    const from = new URL(referer);
    if (from.origin === url.origin && !from.pathname.startsWith("/auth/")) return safeReturnTo(from.pathname + from.search, "/");
  }
  return "/";
}

/** A photo this page stored for this app user is deleted when replaced or removed. Any
 *  other image URL is left alone: a Google picture, an app-provided one, or another app
 *  user's stored photo, since `update-user` lets an account point its image anywhere. */
async function deleteStoredPhoto(env: Env, userId: string, image: string | null | undefined): Promise<void> {
  if (!image?.startsWith(`${ACCOUNT_PHOTO_ROUTE}${userId}/`)) return;
  try {
    await createStorage(env).delete(`${ACCOUNT_PHOTO_PREFIX}${image.slice(ACCOUNT_PHOTO_ROUTE.length)}`);
  } catch (err) {
    console.error(`[account] failed to delete replaced photo ${image}:`, err);
  }
}

export default function Account() {
  const { user, hasPassword, canManageBilling, ...loaded } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const result = useActionData() as Result | undefined;
  const busy = useNavigation().state !== "idle";
  // Kept from the first load: a save re-runs the loader with this page as the referer.
  const [backTo] = useState(loaded.backTo);
  const here = backTo === "/" ? "/auth/account" : `/auth/account?next=${encodeURIComponent(backTo)}`;
  const note = (intent: Intent) => (result?.intent === intent ? <Note result={result} /> : null);
  // The Remove photo form is gone once the photo is, so its note lives outside it.
  const removePhotoNote = note("remove-photo");

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <a href={backTo} className="text-sm text-muted-foreground hover:underline">← Back to the app</a>
      <h1 className="mt-4 text-2xl font-medium">Your account</h1>

      <Section title="Profile">
        <Form method="post" encType="multipart/form-data" className="space-y-4">
          <input type="hidden" name="intent" value="profile" />
          <div className="flex items-center gap-4">
            {user.image ? (
              <StoredPhoto ratio="1/1" src={user.image} alt="" width={64} height={64} sizes="64px" className="h-16 w-16 rounded-full" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl">
                {(user.name.trim()[0] ?? "?").toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <label htmlFor="photo" className={labelClass}>Photo</label>
              <input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-1 block w-full text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="name" className={labelClass}>Name</label>
            <input id="name" name="name" type="text" defaultValue={user.name} required maxLength={100} autoComplete="name" className={inputClass} />
          </div>
          {note("profile")}
          <button type="submit" disabled={busy} className={primaryButton}>Save</button>
        </Form>
        {user.image ? (
          <Form method="post" className="mt-2">
            <input type="hidden" name="intent" value="remove-photo" />
            <button type="submit" disabled={busy} className={linkButton}>Remove photo</button>
          </Form>
        ) : null}
        {removePhotoNote ? <div className="mt-2">{removePhotoNote}</div> : null}
      </Section>

      {canManageBilling ? (
        <Section title="Billing">
          <Form method="post">
            <input type="hidden" name="intent" value="billing" />
            <p className="text-sm text-muted-foreground">Change your card, see your receipts or cancel your subscription.</p>
            {note("billing")}
            <button type="submit" disabled={busy} className={`${secondaryButton} mt-3`}>Manage billing</button>
          </Form>
        </Section>
      ) : null}

      <Section title="Sign-in email">
        <p className="text-sm text-muted-foreground">
          You sign in as <strong className="text-foreground">{user.email}</strong>.
          {user.emailVerified
            ? " To change it, we first send an approval link to this address, then a confirmation to the new one."
            : " To change it, we send a confirmation link to the new address."}
        </p>
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="email" />
          <div>
            <label htmlFor="email" className={labelClass}>New email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
          </div>
          {note("email")}
          <button type="submit" disabled={busy} className={secondaryButton}>Change email</button>
        </Form>
      </Section>

      <Section title="Password">
        {hasPassword ? (
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="password" />
            <div>
              <label htmlFor="currentPassword" className={labelClass}>Current password</label>
              <input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" className={inputClass} />
            </div>
            <div>
              <label htmlFor="newPassword" className={labelClass}>New password</label>
              <input id="newPassword" name="newPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className={inputClass} />
            </div>
            <div>
              <label htmlFor="confirmPassword" className={labelClass}>Confirm new password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className={inputClass} />
            </div>
            {note("password")}
            <button type="submit" disabled={busy} className={secondaryButton}>Change password</button>
          </Form>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">
              You sign in without a password. Add one to sign in with your email and password as well.
            </p>
            <a href={`/auth/set-password?next=${encodeURIComponent(here)}`} className={`${secondaryButton} mt-3 inline-block`}>Set a password</a>
          </div>
        )}
      </Section>

      <Section title="Security">
        <a href={`/auth/two-factor/setup?next=${encodeURIComponent(here)}`} className="text-sm hover:underline">
          {user.twoFactorEnabled ? "Two-factor authentication is on" : "Set up two-factor authentication"}
        </a>
        <Form method="post" className="mt-3">
          <input type="hidden" name="intent" value="devices" />
          <p className="text-sm text-muted-foreground">Signed in somewhere you don't recognise? Sign out every other device.</p>
          {note("devices")}
          <button type="submit" disabled={busy} className={`${secondaryButton} mt-3`}>Sign out other devices</button>
        </Form>
      </Section>

      <Section title="Sign out">
        <SignOutButton className={secondaryButton} />
      </Section>

      <Section title="Close account">
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Close my account</summary>
          <Form method="post" className="mt-3">
            <input type="hidden" name="intent" value="close" />
            <p className="text-sm text-muted-foreground">
              This deletes your account and signs you out everywhere. It can't be undone.
            </p>
            {note("close")}
            {result?.intent === "close" && result.billing ? (
              <button type="submit" name="billing" value="1" disabled={busy} className={`${secondaryButton} mt-3 mr-2`}>Manage billing</button>
            ) : null}
            <button type="submit" disabled={busy} className={`${dangerButton} mt-3`}>Close my account</button>
          </Form>
        </details>
      </Section>
    </main>
  );
}

function Note({ result }: { result: Result }) {
  return (
    <p className={`text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`} role={result.ok ? "status" : "alert"}>
      {result.message}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-md border border-border p-5">
      <h2 className="mb-3 text-base font-medium">{title}</h2>
      {children}
    </section>
  );
}

const labelClass = "block text-sm font-medium";
const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const primaryButton =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50";
const secondaryButton =
  "rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50";
const dangerButton =
  "rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50";
const linkButton = "text-sm text-muted-foreground hover:underline disabled:opacity-50";
