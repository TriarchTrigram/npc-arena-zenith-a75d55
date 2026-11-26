import { useId, useState, type FormEvent } from "react";

export interface WaitlistFormProps {
  /** Where the form sits, shown beside each sign-up on the Users page (for example `footer`). */
  source?: string;
  buttonLabel?: string;
  placeholder?: string;
  /** Shown after a sign-up, the same for a new and a known address. A join sends no email, so never promise one. */
  successMessage?: string;
  errorMessage?: string;
  className?: string;
}

const FIELD_CLASS =
  "h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
const BUTTON_CLASS =
  "h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

/**
 * An email sign-up box for a landing page, a footer or a pop-up: one field and one button.
 * Every address lands on the app's one waitlist, the list on the Users page, which also
 * syncs to the app's connected mailing lists. Needs `stencilWaitlistRoutes` in `app/routes.ts`.
 */
export function WaitlistForm({
  source,
  buttonLabel = "Sign up",
  placeholder = "you@example.com",
  successMessage = "Thanks! You're on the list.",
  errorMessage = "That did not go through. Check the address and try again.",
  className,
}: WaitlistFormProps) {
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const messageId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    setStatus("busy");
    try {
      const res = await fetch("/__stencil/waitlist", { method: "POST", body });
      setStatus(res.ok ? "done" : "error");
    } catch (err) {
      console.error("[waitlist] form could not send the sign-up:", err);
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className={className ?? "flex w-full max-w-md flex-col gap-2"} aria-busy={status === "busy"}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="source" value={source ?? ""} />
        <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          aria-label="Email address"
          aria-describedby={messageId}
          placeholder={placeholder}
          disabled={status === "busy" || status === "done"}
          className={FIELD_CLASS}
        />
        <button type="submit" disabled={status === "busy" || status === "done"} className={BUTTON_CLASS}>
          {buttonLabel}
        </button>
      </div>
      <p id={messageId} role="status" className="text-sm text-muted-foreground">
        {status === "done" ? successMessage : status === "error" ? errorMessage : ""}
      </p>
    </form>
  );
}
