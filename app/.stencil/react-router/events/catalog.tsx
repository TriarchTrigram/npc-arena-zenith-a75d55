import type { LoaderFunctionArgs } from "react-router";
import { events } from "~/events";
import type { EventSpec } from "../../events";
import { verifyPlatformBearer } from "../../internal";

/** `GET /api/internal/events/catalog` — the custom events declared in
 *  `app/events.ts`, read by the Events page in More. */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const unauthorized = verifyPlatformBearer(request, context.cloudflare.env);
  if (unauthorized) return unauthorized;

  const spec: EventSpec = events;
  return Response.json({
    events: Object.entries(spec).map(([type, v]) => ({
      type,
      description: v.description,
      example: v.example ?? null,
    })),
  });
}
