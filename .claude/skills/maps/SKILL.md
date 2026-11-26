---
name: maps
description: >
  Putting places on a map — a map of records with pins, a location picker on a form, an address turned into coordinates, "show them on a map", "nearby", "directory map", "where is it", a store or venue locator, pins for listings, properties, meetings, wells, routes or members. The platform ships the map, the pin picker and the address lookup; never draw a map by hand.
metadata:
  agents: [chat, builder]
---

# Maps

The platform ships three pieces, so a map is a screen like any other and never
a build spent on geometry:

- `<PlacesMap>` from `~stencil/ui/maps/places-map` — pins for a list of records, with popups.
- `<PinPicker>` from `~stencil/ui/maps/pin-picker` — a map an app user clicks or searches to set a record's location, inside an ordinary form.
- `createGeocoder(env)` from `~stencil/geocode` — address → coordinates, server-side, no key in the app.

The map tiles are OpenStreetMap and need no key. Pins take the app's primary
colour from the brand kit. Both components render only in the browser and
handle that themselves — do not wrap them in `<ClientOnly>`.

## Never hand-roll

Do NOT draw country or state outlines, type coordinate tables, hand-build an
SVG or canvas map, add another map library, call a tile or geocoding service
with a key, or write a geocoder from a city list. Every one of those is what
this skill replaces. An app that already carries a hand-built map keeps working;
replace it with these pieces only when the app builder asks, or when the next
map change lands on it anyway.

## Data model

A place is two optional `number` fields on the entity, named `latitude` and
`longitude`. Add them with the entity tools; store nothing else for the point.
When the location comes from an address, keep the address as its own text
field, and when the lookup set the point, keep its `precision` (text) too — an
`area` or `approximate` match may be the wrong spot and the app builder should
be able to see which rows need a hand-placed pin.

## Show records on a map

Build the pin list in the loader from rows that have both fields, then render:

```tsx
import { PlacesMap } from "~stencil/ui/maps/places-map";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = await data(request, context.cloudflare.env, { requireUser: false });
  const venues = await db.from("venues").list({ where: { latitude: { op: "isNotNull" } }, limit: 500 });
  return { venues };
}

export default function Venues({ loaderData }: Route.ComponentProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const places = loaderData.venues.map((v) => ({
    id: v.id, lat: v.latitude!, lng: v.longitude!,
    title: v.name, subtitle: v.address ?? undefined, href: `/venues/${v.id}`,
  }));
  return (
    <PlacesMap places={places} selectedId={selected} onSelect={(p) => setSelected(p.id)} className="h-[70vh] w-full rounded-lg border border-border" />
  );
}
```

`places` is `{ id, lat, lng, title?, subtitle?, href? }[]`; the view fits every
pin. `selectedId` opens that pin's popup and pans to it, so a list beside the
map highlights on the map by setting it. `className` sizes the map (default
20rem tall); an empty list shows `emptyText` over the map. Filters belong in
the loader, as always (`control-driven-data`): a filtered map is a filtered
`list()` call, not a client-side slice.

## Set a record's location on a form

```tsx
import { PinPicker } from "~stencil/ui/maps/pin-picker";

<Form method="post">
  <input name="name" />
  <PinPicker value={venue.latitude != null ? { lat: venue.latitude, lng: venue.longitude! } : null} latName="latitude" lngName="longitude" />
  <button type="submit">Save</button>
</Form>
```

The picker posts the point through two hidden inputs named by `latName` /
`lngName` (empty strings when no pin), so the action reads
`form.get("latitude")` and stores `Number(...)` or `null`. Its address box
calls `/api/geocode`, which comes from the route pack — spread it once into
`app/routes.ts` with a relative import:

```ts
import { stencilMapRoutes } from "./.stencil/react-router/maps/routes";

export default [
  index("routes/home.tsx"),
  ...stencilMapRoutes,
] satisfies RouteConfig;
```

The lookup is for signed-in app users only; a signed-out visitor can still
click the map to place the pin. Pass `search={false}` to drop the address box.

## Addresses already in the data

When rows arrive with an address and no point — an import, a seed, a form that
only asks for the address — look them up server-side, in an action or a
scheduled handler, never in a loader:

```ts
import { createGeocoder } from "~stencil/geocode";

const hit = await createGeocoder(env).lookup(row.address);
if (hit) await db.from("venues").update(row.id, { latitude: hit.lat, longitude: hit.lng, precision: hit.precision });
```

Pass the address to `lookup` as one string, exactly as the row carries it (or
as a plain join of its street, city, state, zip and country columns when the
file has them). Never parse a freeform address into city and state yourself
before the lookup: a wrong split still returns a confident-looking result for
the wrong place, which is the silent failure this helper exists to prevent.

When an import or seed geocodes many rows, treat `area`, `approximate`,
`partial: true` and `null` as unresolved: store the address and the precision,
leave the point empty or mark the row for review, and show the app builder a
count and a list of those rows after the import. Only `exact` and `street`
matches become pins without a look. A wrong pin on the Published app is found
by eye, if at all.

`lookup` returns `{ lat, lng, formattedAddress, precision, partial }` or `null`
for no match. Each call is metered to the app, so a bulk pass runs in slices
like any other bulk work (`data-sdk`, "Bulk work beyond one request") and skips
rows that already have a point. When it throws, the failure is on Stencil's
side and the Stencil team is paged for it; tell the app builder and leave the
lookup in place. Never route around it by calling Nominatim, Photon or any
other geocoder from app code: their terms forbid that use and the app would
break again.

## Out of scope

Live positions — vehicles, couriers, "where is everyone now" — need a location
feed the app supplies (a device posting its position on a schedule) and are
not part of this skill; a map of the last stored position per record is.
Driving directions and route lines are not shipped either; say so instead of
improvising a router.
