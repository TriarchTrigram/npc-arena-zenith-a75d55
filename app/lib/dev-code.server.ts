// The developer code lives only on the server, so it never ships in the game's browser files.
const DEV_CODE = "335533";

/** Whether `typed` is the developer code, compared without an early exit. */
export function isDevCode(typed: string): boolean {
  const a = new TextEncoder().encode(typed.trim());
  const b = new TextEncoder().encode(DEV_CODE);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}
