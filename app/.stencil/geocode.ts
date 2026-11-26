import { BACKEND_BASE, createBackendFetch } from "./backend";
import type { GeocodeResult } from "./types/maps";

export type { GeocodePrecision, GeocodeResult } from "./types/maps";

/**
 * Address → coordinates, proxied through the Stencil backend — no API key in
 * the app. Server-side only (loaders / actions / scheduled handlers); the pin
 * picker reaches it through the `stencilMapRoutes` pack.
 *
 * Store `precision` and `partial` next to the point: anything short of `exact`
 * may be the wrong spot and should be shown to the app builder as such instead
 * of silently plotted.
 *
 * ```ts
 * const hit = await createGeocoder(env).lookup("1 Infinite Loop, Cupertino, CA");
 * if (hit) await db.from("venues").update(id, { latitude: hit.lat, longitude: hit.lng });
 * ```
 */
export function createGeocoder(env: Env) {
  const backendFetch = createBackendFetch(env);

  return {
    /** The best match for an address, or null when the provider finds none. */
    async lookup(address: string): Promise<GeocodeResult | null> {
      const res = await backendFetch(`${BACKEND_BASE}/geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        const detail = err.detail?.trim().slice(0, 300);
        throw new Error(
          `Address lookup failed: ${err.error ?? `HTTP ${res.status}`}${detail ? ` — ${detail}` : ""}`,
        );
      }
      const data = (await res.json()) as { result: GeocodeResult | null };
      return data.result;
    },
  };
}

export type Geocoder = ReturnType<typeof createGeocoder>;
