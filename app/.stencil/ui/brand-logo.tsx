import type { ComponentProps } from "react";

/** Where the app's logo is served: the Brand kit upload, or the app icon until there is one. */
export const BRAND_LOGO_SRC = "/assets/brand/logo.png";

/**
 * The app's logo, sized by its height. Every header, sidebar, footer and sign-in screen
 * draws this one component, so a new Brand kit logo shows everywhere without a build.
 */
export function BrandLogo({
  alt,
  className = "h-8 w-auto",
  ...props
}: Omit<ComponentProps<"img">, "src" | "alt"> & {
  /** The app's name, or "" when the name is written beside the logo. */
  alt: string;
}) {
  return <img data-slot="brand-logo" src={BRAND_LOGO_SRC} alt={alt} className={className} {...props} />;
}
