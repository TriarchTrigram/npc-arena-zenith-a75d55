import type { AuthUser } from "./auth";

/** The app user whose subdomain a request arrived on. */
export type Tenant = {
  /** The word before the domain, as claimed by the app user. */
  subdomain: string;
  /** The domain it is a subdomain of. */
  domain: string;
  user: AuthUser;
};

/** What a phone shows when someone installs an app user's own address. */
export type TenantBranding = {
  /** The installed app's name, 1 to 60 characters. */
  name: string;
  /** The name under the home-screen icon, 1 to 12 characters. Defaults to `name`, cut to fit. */
  shortName?: string | null;
  /** A stored file key or its `/api/files/<key>` URL; a square picture works best. */
  iconPath?: string | null;
  /** `#rrggbb`. */
  themeColor?: string | null;
  /** The page the installed app opens on, as a path on the subdomain. */
  startPath?: string | null;
};
