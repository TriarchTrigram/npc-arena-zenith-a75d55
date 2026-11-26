import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";

/** The application name registered with Unsplash; every credit link carries it. */
const UTM_SOURCE = "Stencil";
const UNSPLASH_HOME = "https://unsplash.com/";

const SRCSET_WIDTHS = [480, 768, 1080, 1440, 1920];

export type PhotoSource = "unsplash" | "pexels" | "public-domain";

export interface UnsplashCredit {
  photographer: string;
  /** Absent for a photo from Stencil's library, whose credit links the photo's own page. */
  photographerUrl?: string;
  photoUrl: string;
  /** Where the photo is from; absent means Unsplash. */
  source?: PhotoSource;
}

/** One placed photo as placeStockPhoto returned it. `credit` is null only for a slot that fell
 *  back to a generated `/assets/<name>.png` because Unsplash was unavailable. */
export interface PlacedPhoto {
  src: string;
  alt: string;
  credit: UnsplashCredit | null;
}

export interface UnsplashPhotoProps
  extends PlacedPhoto, Omit<ComponentProps<"img">, "src" | "srcSet" | "sizes" | "alt" | "loading" | "className"> {
  /** The slot's shape, e.g. "16/9", "4/3", "1/1", "3/4". Omit to keep the photo's own shape. */
  ratio?: `${number}/${number}`;
  /** The `sizes` hint; default the full viewport. A half-width card: "(min-width: 768px) 50vw, 100vw". */
  sizes?: string;
  /** Visible on load (a hero): fetched eagerly and first. Everything else loads lazily. */
  priority?: boolean;
  /** Where the credit shows on the photo: a quiet caption on hover and keyboard focus (default),
   *  always visible, or none for a decorative photo. Every photo is also named in the page
   *  credits line, rendered automatically when the page places no <UnsplashCredits>. */
  caption?: "hover" | "always" | "none";
  /** JPEG/WebP quality, 1–100. Default 75. */
  quality?: number;
  /** Classes for the wrapping <figure>; the image fills it. */
  className?: string;
  imgClassName?: string;
}

/** A credit link with Unsplash's required referral parameters. */
export function withReferral(url: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", UTM_SOURCE);
  u.searchParams.set("utm_medium", "referral");
  return u.toString();
}

const SOURCE_HOME: Record<PhotoSource, string> = {
  unsplash: UNSPLASH_HOME,
  pexels: "https://www.pexels.com/",
  "public-domain": "",
};
const SOURCE_NAME: Record<PhotoSource, string> = { unsplash: "Unsplash", pexels: "Pexels", "public-domain": "the public domain" };

function sourceOf(credit: UnsplashCredit): PhotoSource {
  return credit.source ?? "unsplash";
}

/** Where the photographer's name links: their page when known, else the photo's; Unsplash links carry the referral. */
function photographerHref(credit: UnsplashCredit): string {
  const url = credit.photographerUrl ?? credit.photoUrl;
  return sourceOf(credit) === "unsplash" ? withReferral(url) : url;
}

/** "on Unsplash" / "on Pexels" / "from the public domain", the source linked where it has a home page. */
function SourceLink({ credit }: { credit: UnsplashCredit }) {
  const source = sourceOf(credit);
  if (source === "public-domain")
    return (
      <>
        from{" "}
        <a href={credit.photoUrl} target="_blank" rel="noopener noreferrer">
          the public domain
        </a>
      </>
    );
  const home = source === "unsplash" ? withReferral(SOURCE_HOME.unsplash) : SOURCE_HOME[source];
  return (
    <>
      on{" "}
      <a href={home} target="_blank" rel="noopener noreferrer">
        {SOURCE_NAME[source]}
      </a>
    </>
  );
}

/** One sized rendition of a raw Unsplash URL; keeps its `ixid` and every other parameter it came with. */
export function unsplashSrc(raw: string, width: number, ratio?: `${number}/${number}`, quality = 75): string {
  const url = new URL(raw);
  url.searchParams.set("w", String(width));
  if (ratio) {
    const [w, h] = ratio.split("/").map(Number);
    url.searchParams.set("h", String(Math.round((width * h) / w)));
    url.searchParams.set("fit", "crop");
  }
  url.searchParams.set("q", String(quality));
  url.searchParams.set("auto", "format");
  return url.toString();
}

function join(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface CreditsRegistry {
  photos: UnsplashCredit[];
  addPhoto(credit: UnsplashCredit): () => void;
  addLine(): () => void;
}

const CreditsContext = createContext<CreditsRegistry | null>(null);

/**
 * Collects every mounted <UnsplashPhoto>'s credit for a prop-less <UnsplashCredits>, and renders
 * one credits line after `children` when a photo is on the page and the page placed no line.
 * Photos register from effects, so the line appears after hydration and never mismatches.
 */
export function UnsplashCreditsProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<UnsplashCredit[]>([]);
  const [lines, setLines] = useState(0);
  // Stable for the provider's life, so a photo's registration effect never re-runs on a list change.
  const [actions] = useState(() => ({
    addPhoto(credit: UnsplashCredit) {
      setPhotos((all) => [...all, credit]);
      return () => setPhotos((all) => all.filter((c) => c !== credit));
    },
    addLine() {
      setLines((n) => n + 1);
      return () => setLines((n) => n - 1);
    },
  }));
  const registry = useMemo<CreditsRegistry>(() => ({ photos, ...actions }), [photos, actions]);
  const owed = lines === 0 && photos.length > 0;
  return (
    <CreditsContext.Provider value={registry}>
      {children}
      {owed && <CreditsLine credits={photos} className="px-4 py-3 text-center" />}
    </CreditsContext.Provider>
  );
}

/**
 * A hotlinked Unsplash photo, responsive and credited. Renders a <figure> that fills
 * its box: give the figure its size (or a `ratio`) and the image covers it.
 */
export function UnsplashPhoto({
  src,
  alt,
  credit,
  ratio,
  sizes = "100vw",
  priority = false,
  caption = "hover",
  quality,
  className,
  imgClassName,
  style,
  ...imgProps
}: UnsplashPhotoProps) {
  // A generated fallback is served by the app itself and takes none of Unsplash's URL parameters.
  const hosted = credit !== null && src.startsWith("https://images.unsplash.com/");
  const registry = useContext(CreditsContext);
  useEffect(() => {
    if (!registry || !credit) return;
    return registry.addPhoto(credit);
    // Keyed on the credit's fields: callers often build the credit object inline, every render.
  }, [registry?.addPhoto, credit?.photographer, credit?.photographerUrl, credit?.photoUrl, credit?.source]);
  const srcSet = hosted ? SRCSET_WIDTHS.map((w) => `${unsplashSrc(src, w, ratio, quality)} ${w}w`).join(", ") : undefined;
  return (
    <figure className={join("group relative m-0 overflow-hidden", className)} style={ratio ? { aspectRatio: ratio } : undefined}>
      <img
        {...imgProps}
        src={hosted ? unsplashSrc(src, 1080, ratio, quality) : src}
        srcSet={srcSet}
        sizes={hosted ? sizes : undefined}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={join(ratio ? "h-full w-full object-cover" : "h-auto w-full", imgClassName)}
        style={style}
      />
      {credit && caption !== "none" && (
        <figcaption
          className={join(
            "pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs leading-none text-white/90 transition-opacity [&_a]:pointer-events-auto [&_a]:underline [&_a]:underline-offset-2",
            caption === "hover" && "opacity-0 focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          Photo by{" "}
          <a href={photographerHref(credit)} target="_blank" rel="noopener noreferrer">
            {credit.photographer}
          </a>{" "}
          <SourceLink credit={credit} />
        </figcaption>
      )}
    </figure>
  );
}

/**
 * One line crediting every Unsplash photo on the page, for a footer. With no `credits` it
 * lists every mounted <UnsplashPhoto>; pass `credits` to name a set of your own. Each
 * photographer is named and linked once. Placing it anywhere stops the automatic line.
 */
export function UnsplashCredits({ credits, className }: { credits?: Array<UnsplashCredit | null>; className?: string }) {
  const registry = useContext(CreditsContext);
  useEffect(() => registry?.addLine(), [registry?.addLine]);
  return <CreditsLine credits={credits ?? registry?.photos ?? []} className={className} />;
}

function CreditsLine({ credits, className }: { credits: Array<UnsplashCredit | null>; className?: string }) {
  const groups = new Map<PhotoSource, UnsplashCredit[]>();
  const seen = new Set<string>();
  for (const c of credits) {
    if (!c) continue;
    const key = `${sourceOf(c)}|${c.photographer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    groups.set(sourceOf(c), [...(groups.get(sourceOf(c)) ?? []), c]);
  }
  if (groups.size === 0) return null;
  return (
    <p className={join("text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-2", className)}>
      {[...groups].map(([source, photographers], g) => (
        <span key={source}>
          {g > 0 && " "}
          Photos{" "}
          {source === "public-domain" ? "from the public domain" : <>from <SourceHome source={source} /></>} by{" "}
          {photographers.map((c, i) => (
            <span key={c.photographer}>
              {i > 0 && (i === photographers.length - 1 ? " and " : ", ")}
              <a href={photographerHref(c)} target="_blank" rel="noopener noreferrer">
                {c.photographer}
              </a>
            </span>
          ))}
          .
        </span>
      ))}
    </p>
  );
}

function SourceHome({ source }: { source: Exclude<PhotoSource, "public-domain"> }) {
  const home = source === "unsplash" ? withReferral(SOURCE_HOME.unsplash) : SOURCE_HOME[source];
  return (
    <a href={home} target="_blank" rel="noopener noreferrer">
      {SOURCE_NAME[source]}
    </a>
  );
}
