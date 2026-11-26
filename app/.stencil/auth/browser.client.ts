// Unused on purpose: `updateUser`'s exported type is only nameable through this
// import, and without it the compiler cannot write this module's declarations.
import type { InferUserUpdateCtx } from "better-auth/client";
import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  genericOAuthClient,
  magicLinkClient,
  twoFactorClient,
} from "better-auth/client/plugins";

const client = createAuthClient({
  plugins: [
    genericOAuthClient(),
    magicLinkClient(),
    emailOTPClient(),
    // An enrolled app user's sign-in answers with twoFactorRedirect instead of a
    // session; the stock challenge page finishes it and returns them here.
    twoFactorClient({
      onTwoFactorRedirect() {
        const returnTo = window.location.pathname + window.location.search;
        window.location.href = `/auth/two-factor?returnTo=${encodeURIComponent(returnTo)}`;
      },
    }),
  ],
});

// Only expose action methods. Do NOT use client hooks (useSession etc.) —
// read auth state from loaders via requireAuth / getSession instead.
export const { signIn, signOut, changeEmail, changePassword, updateUser, revokeOtherSessions, emailOtp } =
  client;

// The popup in flight and its outcome. Better Auth keeps a single state cookie, so a
// second start would overwrite it and the first popup's return would be refused.
let googlePopup: Window | null = null;
let googleResult: Promise<{ error: string | null }> | null = null;

// Google won't render inside a frame (the App preview is one), so the whole flow runs in a
// popup; /auth/done posts back a code the frame trades at /auth/handoff for its own session
// cookie. Resolves with an error code to show, or null once navigating to callbackURL.
export async function signInWithGoogle({
  callbackURL = "/",
}: { callbackURL?: string } = {}): Promise<{ error: string | null }> {
  if (googlePopup && !googlePopup.closed && googleResult) {
    googlePopup.focus();
    return googleResult;
  }
  const w = 500;
  const h = 600;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;
  const popup = window.open(
    `/auth/google?returnTo=${encodeURIComponent(callbackURL)}`,
    "google-auth",
    `width=${w},height=${h},left=${left},top=${top}`,
  );
  if (!popup) return { error: "popup_blocked" };

  googlePopup = popup;
  googleResult = new Promise((resolve) => {
    const stop = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(closedCheck);
      if (!popup.closed) popup.close();
    };
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const type = event.data?.type;
      if (type === "auth-complete") {
        stop();
        if (event.data.code) {
          const res = await fetch("/auth/handoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: event.data.code }),
            credentials: "include",
          }).catch(() => null);
          if (!res?.ok) return resolve({ error: "handoff_failed" });
        }
        window.location.href = callbackURL;
        resolve({ error: null });
      } else if (type === "auth-error") {
        stop();
        resolve({ error: String(event.data.error ?? "unknown") });
      }
    };
    window.addEventListener("message", onMessage);
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        stop();
        resolve({ error: "cancelled" });
      }
    }, 500);
  });
  return googleResult;
}
