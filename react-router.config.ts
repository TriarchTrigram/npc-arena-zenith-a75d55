import type { Config } from "@react-router/dev/config";
import prerender from "./prerender";

const enabled = process.env.STENCIL_PRERENDER === "1" && prerender.length > 0;

export default {
  ssr: true,
  // Lazy discovery hard-reloads every open page the moment a publish changes the
  // manifest version; with the whole route table in the document, a superseded page
  // keeps working until the app user moves on.
  routeDiscovery: { mode: "initial" },
  prerender: enabled ? prerender : false,
  future: { v8_viteEnvironmentApi: true, unstable_previewServerPrerendering: true },
} satisfies Config;
