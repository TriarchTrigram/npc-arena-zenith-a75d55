/** A point on the globe, in decimal degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** One marker on a `<PlacesMap>`, usually built from a record with location fields. */
export interface MapPlace extends LatLng {
  id: string;
  /** Popup heading. */
  title?: string;
  /** Popup line under the heading — an address, a category, a status. */
  subtitle?: string;
  /** Same-origin path the popup links to, such as the record's own page. */
  href?: string;
}

/**
 * How closely the provider matched the address. `exact` is a rooftop match;
 * `street` is interpolated along a road; `area` is the middle of a region
 * (a city, a postcode); `approximate` is a loose guess.
 */
export type GeocodePrecision = "exact" | "street" | "area" | "approximate";

/** The best match for an address lookup. */
export interface GeocodeResult extends LatLng {
  /** The address as the provider normalised it. */
  formattedAddress: string;
  precision: GeocodePrecision;
  /** True when the address carried a house number the lookup could not place — the pin is the street, not the door. */
  partial: boolean;
}
