import type { ComponentProps } from "react";

const SRCSET_WIDTHS = [160, 320, 480, 768, 1080, 1440, 1920];

export interface StoredPhotoProps extends Omit<ComponentProps<"img">, "src" | "srcSet" | "alt" | "loading"> {
  /** A picture the app serves itself: `/assets/<name>` or a file route such as `/api/files/<key>`. */
  src: string;
  alt: string;
  /** Crop to this shape, e.g. "1/1" for an avatar or "4/3" for uniform tiles. Omit to keep the picture's own shape. */
  ratio?: `${number}/${number}`;
  /** What a `ratio` crop keeps: `"face"`, `"auto"` (the most notable area) or a point such as `"0.5x0.2"`. Default: the centre. */
  gravity?: string;
  /** The `sizes` hint. Default: the browser measures a lazy picture's slot itself, else the full viewport. */
  sizes?: string;
  /** Visible on load (a hero, a logo in the header): fetched eagerly and first. Everything else loads lazily. */
  priority?: boolean;
}

/** `src` asking the platform for one resized rendition; any other parameter it carries is kept. */
export function storedPhotoSrc(src: string, width: number, ratio?: `${number}/${number}`, gravity?: string): string {
  const [path, hash = ""] = src.split("#");
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("width", String(width));
  if (ratio) {
    const [w, h] = ratio.split("/").map(Number);
    params.set("height", String(Math.round((width * h) / w)));
    params.set("fit", "cover");
    if (gravity) params.set("gravity", gravity);
  }
  return `${base}?${params}${hash && `#${hash}`}`;
}

/**
 * An <img> for a picture the app stores (an asset or an upload): the browser picks a
 * rendition sized for its slot and screen, and loads it only when it scrolls into view.
 * Takes every <img> prop; an outside address or a `blob:`/`data:` preview renders as given.
 */
export function StoredPhoto({ src, alt, ratio, gravity, sizes, priority = false, style, ...imgProps }: StoredPhotoProps) {
  // Only the app's own routes resize on `?width=`; a vector has no pixel size to pick from.
  const resizable = src.startsWith("/") && !src.startsWith("//") && !/\.svg([?#]|$)/i.test(src);
  return (
    <img
      {...imgProps}
      src={resizable ? storedPhotoSrc(src, 1080, ratio, gravity) : src}
      srcSet={resizable ? SRCSET_WIDTHS.map((w) => `${storedPhotoSrc(src, w, ratio, gravity)} ${w}w`).join(", ") : undefined}
      // "auto" is honoured on lazy images only; browsers without it read the fallback after the comma.
      sizes={resizable ? (sizes ?? (priority ? "100vw" : "auto, 100vw")) : undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      style={ratio ? { aspectRatio: ratio, objectFit: "cover", ...style } : style}
    />
  );
}
