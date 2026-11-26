import type * as LeafletNs from "leaflet";

export type Leaflet = typeof LeafletNs;

let loading: Promise<Leaflet> | null = null;

/** Loads Leaflet and its stylesheet once, in the browser only — the library touches `window` on import. */
export function loadLeaflet(): Promise<Leaflet> {
  if (!loading) {
    loading = Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([mod]) => {
      const m = mod as unknown as { default?: Leaflet };
      return m.default ?? (mod as unknown as Leaflet);
    });
  }
  return loading;
}

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** A marker drawn in the app's primary colour, so pins follow the brand kit instead of Leaflet's blue image. */
export function pinIcon(L: Leaflet): LeafletNs.DivIcon {
  return L.divIcon({
    className: "",
    html:
      '<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">' +
      '<path d="M14 1C7 1 1.5 6.5 1.5 13.5c0 9.5 12.5 21.5 12.5 21.5S26.5 23 26.5 13.5C26.5 6.5 21 1 14 1z" fill="var(--primary)" stroke="var(--background)" stroke-width="2"/>' +
      '<circle cx="14" cy="13.5" r="4.5" fill="var(--primary-foreground)"/></svg>',
    iconSize: [28, 36],
    iconAnchor: [14, 35],
    popupAnchor: [0, -30],
  });
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
