import { useEffect, useRef, useState } from "react";
import type * as LeafletNs from "leaflet";
import type { GeocodeResult, LatLng } from "../../types/maps";
import { useHydrated } from "../hydration";
import { TILE_ATTRIBUTION, TILE_URL, loadLeaflet, pinIcon, type Leaflet } from "./leaflet";

export interface PinPickerProps {
  /** The point the pin starts on, or null for no pin yet. */
  value?: LatLng | null;
  /** Called with the new point whenever the pin is placed, dragged or cleared. */
  onChange?: (value: LatLng | null) => void;
  /** Names of the hidden inputs that post the point with a plain form. */
  latName?: string;
  lngName?: string;
  /** An address box above the map that looks the address up and drops the pin there. */
  search?: boolean;
  /** The view when there is no pin yet. Defaults to a world view. */
  center?: LatLng;
  zoom?: number;
  /** Sizes and frames the map. Defaults to a bordered, rounded block 20rem tall. */
  className?: string;
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "note"; text: string } | { kind: "error"; text: string };

const PRECISION_NOTE: Record<GeocodeResult["precision"], string> = {
  exact: "",
  street: "Matched to the street — drag the pin if the exact spot matters.",
  area: "Matched to the area only — drag the pin to the exact spot.",
  approximate: "Only an approximate match — drag the pin to the exact spot.",
};

/**
 * A map an app user drops a pin on to set a record's location: click to place,
 * drag to adjust, or type an address and let the lookup place it. The chosen
 * point is reported through `onChange` and through two hidden inputs, so the
 * picker works inside an ordinary form. Renders only in the browser.
 */
export function PinPicker({
  value = null,
  onChange,
  latName = "lat",
  lngName = "lng",
  search = true,
  center = { lat: 20, lng: 0 },
  zoom = 2,
  className = "h-80 w-full rounded-lg border border-border",
}: PinPickerProps) {
  const hydrated = useHydrated();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNs.Map | null>(null);
  const markerRef = useRef<LeafletNs.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [L, setL] = useState<Leaflet | null>(null);
  const [point, setPoint] = useState<LatLng | null>(value);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function place(next: LatLng | null) {
    setPoint(next);
    onChangeRef.current?.(next);
  }

  useEffect(() => {
    if (!hydrated || !containerRef.current) return;
    let cancelled = false;
    void loadLeaflet().then((lib) => {
      if (cancelled || !containerRef.current) return;
      const start = value ?? center;
      const map = lib.map(containerRef.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 15 : zoom);
      lib.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
      map.on("click", (e: LeafletNs.LeafletMouseEvent) => place({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
      setL(lib);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; the pin follows `point` below.
  }, [hydrated]);

  // A new `value` (the same edit screen moving to another record) replaces the pin and recentres.
  useEffect(() => {
    setPoint(value);
    if (value) mapRef.current?.setView([value.lat, value.lng], 15);
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!L || !map) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([point.lat, point.lng]);
      return;
    }
    const marker = L.marker([point.lat, point.lng], { icon: pinIcon(L), draggable: true }).addTo(map);
    marker.on("dragend", () => {
      const at = marker.getLatLng();
      place({ lat: at.lat, lng: at.lng });
    });
    markerRef.current = marker;
  }, [L, point]);

  async function lookup() {
    const q = query.trim();
    if (!q) return;
    setStatus({ kind: "busy" });
    let result: GeocodeResult | null;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      result = ((await res.json()) as { result: GeocodeResult | null }).result;
    } catch {
      setStatus({ kind: "error", text: "Couldn't look that address up just now." });
      return;
    }
    if (!result) {
      setStatus({ kind: "error", text: "No match for that address — click the map to place the pin." });
      return;
    }
    place({ lat: result.lat, lng: result.lng });
    mapRef.current?.setView([result.lat, result.lng], result.precision === "exact" ? 17 : 13);
    const note = [result.partial ? "Partial match." : "", PRECISION_NOTE[result.precision]].filter(Boolean).join(" ");
    setStatus({ kind: "note", text: note ? `${result.formattedAddress}. ${note}` : result.formattedAddress });
  }

  const message = status.kind === "busy" ? "Looking up…" : status.kind === "idle" ? "" : status.text;

  return (
    <div>
      {search && (
        <div className="mb-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void lookup();
              }
            }}
            placeholder="Search an address"
            autoComplete="off"
            aria-label="Address"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => void lookup()}
            disabled={status.kind === "busy" || !query.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            Find
          </button>
        </div>
      )}
      <div className={`relative isolate overflow-hidden ${className}`}>
        <div ref={containerRef} className="h-full w-full bg-muted" />
      </div>
      <p role="status" className={`mt-1 min-h-5 text-xs ${status.kind === "error" ? "text-error" : "text-muted-foreground"}`}>
        {message || (point ? `Pin at ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "Click the map to place the pin.")}
        {point && (
          <>
            {" "}
            <button type="button" onClick={() => place(null)} className="underline">
              Clear
            </button>
          </>
        )}
      </p>
      <input type="hidden" name={latName} value={point ? String(point.lat) : ""} />
      <input type="hidden" name={lngName} value={point ? String(point.lng) : ""} />
    </div>
  );
}
