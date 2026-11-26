import { useEffect, useRef, useState } from "react";
import type * as LeafletNs from "leaflet";
import type { LatLng, MapPlace } from "../../types/maps";
import { useHydrated } from "../hydration";
import { TILE_ATTRIBUTION, TILE_URL, escapeHtml, loadLeaflet, pinIcon, type Leaflet } from "./leaflet";

export interface PlacesMapProps {
  /** The markers to draw. The view fits them when the set of ids changes; an empty list shows `center`. */
  places: MapPlace[];
  /** Id of the place whose popup is open; the map pans to it when it changes. */
  selectedId?: string | null;
  /** Called when a visitor clicks a marker. */
  onSelect?: (place: MapPlace) => void;
  /** The view when there are no places. Defaults to a world view. */
  center?: LatLng;
  zoom?: number;
  /** Sizes and frames the map. Defaults to a bordered, rounded block 20rem tall. */
  className?: string;
  /** Shown over the map while there are no places. */
  emptyText?: string;
}

function popupHtml(place: MapPlace): string {
  const title = place.title ? `<strong>${escapeHtml(place.title)}</strong>` : "";
  const subtitle = place.subtitle ? `<div>${escapeHtml(place.subtitle)}</div>` : "";
  const link = place.href ? `<a href="${escapeHtml(place.href)}">Open</a>` : "";
  return `<div class="text-sm">${title}${subtitle}${link}</div>`;
}

/**
 * A map with one pin per place, each with a popup. Pure display: give it the
 * rows that carry a location and it draws them. It renders only in the browser
 * and needs no ClientOnly wrapper.
 */
export function PlacesMap({
  places,
  selectedId,
  onSelect,
  center = { lat: 20, lng: 0 },
  zoom = 2,
  className = "h-80 w-full rounded-lg border border-border",
  emptyText = "Nothing to show on the map yet.",
}: PlacesMapProps) {
  const hydrated = useHydrated();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNs.Map | null>(null);
  const markersRef = useRef<Map<string, LeafletNs.Marker>>(new Map());
  const fittedRef = useRef<string | null>(null);
  const placesRef = useRef<Map<string, MapPlace>>(new Map());
  placesRef.current = new Map(places.map((p) => [p.id, p]));
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [L, setL] = useState<Leaflet | null>(null);

  useEffect(() => {
    if (!hydrated || !containerRef.current) return;
    let cancelled = false;
    void loadLeaflet().then((lib) => {
      if (cancelled || !containerRef.current) return;
      const map = lib.map(containerRef.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], zoom);
      lib.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      setL(lib);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      fittedRef.current = null;
    };
    // The map is created once; later view changes come from `places`.
  }, [hydrated]);

  // Markers are keyed by id and updated in place, so a re-render with the same
  // places (a filter box, a selection) neither rebuilds them nor moves the view.
  useEffect(() => {
    const map = mapRef.current;
    if (!L || !map) return;
    const markers = markersRef.current;
    const icon = pinIcon(L);
    const ids = new Set<string>();
    for (const place of places) {
      ids.add(place.id);
      const existing = markers.get(place.id);
      if (existing) {
        existing.setLatLng([place.lat, place.lng]).setPopupContent(popupHtml(place));
        continue;
      }
      const marker = L.marker([place.lat, place.lng], { icon, title: place.title })
        .bindPopup(popupHtml(place))
        .on("click", () => {
          const current = placesRef.current.get(place.id);
          if (current) onSelectRef.current?.(current);
        })
        .addTo(map);
      markers.set(place.id, marker);
    }
    for (const [id, marker] of markers) {
      if (ids.has(id)) continue;
      marker.remove();
      markers.delete(id);
    }
    const key = [...ids].sort().join("\n");
    if (key === fittedRef.current) return;
    fittedRef.current = key;
    if (places.length > 0) {
      map.fitBounds(
        L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [32, 32], maxZoom: 15 },
      );
    } else {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [L, places, center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (!map || !marker) return;
    map.panTo(marker.getLatLng());
    marker.openPopup();
  }, [selectedId, L]);

  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      <div ref={containerRef} className="h-full w-full bg-muted" />
      {places.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </div>
  );
}
