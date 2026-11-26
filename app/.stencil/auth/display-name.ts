/** The label a person is shown by when no name is set. */
export const ANONYMOUS_LABEL = "Guest";

/**
 * The name to show for a person on any screen. Reads only `name`, never an
 * email, so an account with no name shows `fallback` instead of its address.
 * A stored name that is itself an email address counts as no name.
 */
export function displayName(
  person: { name?: string | null } | null | undefined,
  fallback: string = ANONYMOUS_LABEL,
): string {
  const name = person?.name?.trim() ?? "";
  if (!name || name.includes("@")) return fallback;
  return name;
}
