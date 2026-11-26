/** One step of an app's first-login setup, in the order app users take them. */
export type SetupStep = {
  /** Stable id the step is saved under; keep it when the label changes. */
  id: string;
  label: string;
  /** Marks the step that offers the app's languages. It is skipped while the app speaks
   *  one language, so only an app with a choice to make shows it. */
  kind?: "language";
};

/** An app's first-login setup, declared once in `app/setup.ts` and handed to the helpers. */
export type SetupFlow = {
  /** Where the step screens live. The gate sends an unfinished account here and lets
   *  this path and everything under it through. */
  path: string;
  /** The moment setup went into the app, as an ISO date-time (`2026-10-23T14:05:00Z`).
   *  Accounts created before it count as set up, so existing app users are never sent
   *  through the steps. A bare day is refused: it would mean midnight UTC. */
  since: string;
  steps: SetupStep[];
};

/** Where one app user stands in setup. */
export type SetupState = {
  complete: boolean;
  /** The last step the app user finished, or null before the first. */
  lastStep: string | null;
  /** The step to show next; null once setup is complete. */
  nextStep: SetupStep | null;
};
