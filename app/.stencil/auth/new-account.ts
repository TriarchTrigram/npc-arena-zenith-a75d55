import { sanitizeAttribution } from "./attribution";

/** The row a platform grant creates for an address with no account yet. The
 *  relayed attribution is untrusted: it is stored only when it re-validates. */
export function newAccountData(
  email: string,
  name: string,
  signupAttribution: string | undefined,
  emailVerified = false,
): { email: string; name: string; emailVerified: boolean; signupAttribution?: string } {
  const attribution = sanitizeAttribution(signupAttribution);
  return { email, name, emailVerified, ...(attribution ? { signupAttribution: attribution } : {}) };
}
