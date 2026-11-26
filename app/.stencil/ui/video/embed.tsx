import { useEffect, useMemo, useState } from "react";
import { PlayIcon } from "lucide-react";

export type VideoProvider = "YouTube" | "Vimeo" | "Loom" | "Descript" | "Google Drive";

export interface VideoLink {
  provider: VideoProvider;
  /** The provider's player address, loaded only once the app user presses play. */
  src: string;
  /** A still known from the link alone; Vimeo and Loom stills come from oEmbed. */
  thumbnail?: string;
  /** The oEmbed address that returns the title and still, when the provider has one. */
  oembed?: string;
  /** The address never says the file is a video (a Drive file can be a PDF or an image). */
  maybeFile?: true;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** YouTube's start time: `90`, `90s` or `1m30s`, as seconds. */
function youtubeStart(t: string | null): number {
  const m = t && /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

function youtube(url: URL, host: string, parts: string[]): VideoLink | null {
  let id: string | null = null;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") id = parts[1] ?? null;
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;
  const start = youtubeStart(url.searchParams.get("t") ?? url.searchParams.get("start"));
  return {
    provider: "YouTube",
    src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1${start > 0 ? `&start=${start}` : ""}`,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

function vimeo(url: URL, host: string, parts: string[]): VideoLink | null {
  let id: string | undefined;
  let hash: string | undefined;
  if (host === "player.vimeo.com" && parts[0] === "video") {
    id = parts[1];
    hash = url.searchParams.get("h") ?? undefined;
  } else if (host === "vimeo.com") {
    // A showcase link puts the showcase id first; the video id follows `video`.
    // Without that segment the link is the whole showcase, which has no player.
    const from = parts.indexOf("video") + 1;
    if (from === 0 && (parts[0] === "showcase" || parts[0] === "album")) return null;
    const at = parts.findIndex((p, i) => i >= from && /^\d+$/.test(p));
    id = at === -1 ? undefined : parts[at];
    hash = at === -1 ? undefined : parts[at + 1];
  }
  if (!id || !/^\d+$/.test(id)) return null;
  // An unlisted video's hash must reach the player as `h=`, or it refuses to play.
  if (hash && !/^[a-f0-9]+$/i.test(hash)) hash = undefined;
  return {
    provider: "Vimeo",
    src: `https://player.vimeo.com/video/${id}?dnt=1&autoplay=1${hash ? `&h=${hash}` : ""}`,
    oembed: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}${hash ? `/${hash}` : ""}`)}`,
  };
}

function loom(host: string, parts: string[]): VideoLink | null {
  const id = host === "loom.com" && (parts[0] === "share" || parts[0] === "embed") ? parts[1] : undefined;
  if (!id || !/^[a-f0-9]{32}$/i.test(id)) return null;
  return {
    provider: "Loom",
    src: `https://www.loom.com/embed/${id}`,
    oembed: `https://www.loom.com/v1/oembed?url=${encodeURIComponent(`https://www.loom.com/share/${id}`)}`,
  };
}

function descript(host: string, parts: string[]): VideoLink | null {
  const id = host === "share.descript.com" && (parts[0] === "view" || parts[0] === "embed") ? parts[1] : undefined;
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return { provider: "Descript", src: `https://share.descript.com/embed/${id}` };
}

function drive(url: URL, host: string, parts: string[]): VideoLink | null {
  if (host !== "drive.google.com") return null;
  const id = parts[0] === "file" && parts[1] === "d" ? parts[2] : (url.searchParams.get("id") ?? undefined);
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return {
    provider: "Google Drive",
    src: `https://drive.google.com/file/d/${id}/preview`,
    thumbnail: `https://drive.google.com/thumbnail?id=${id}&sz=w640`,
    maybeFile: true,
  };
}

/** The player behind a pasted video link, or null when it is not a video address this knows. */
export function parseVideoLink(href: string): VideoLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  return youtube(url, host, parts) ?? vimeo(url, host, parts) ?? loom(host, parts) ?? descript(host, parts) ?? drive(url, host, parts);
}

type Oembed = { title?: string; thumbnail_url?: string };

function useOembed(url: string | undefined): Oembed {
  const [meta, setMeta] = useState<Oembed>({});
  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Oembed>) : {}))
      .then(setMeta)
      .catch((err) => {
        if (!ctrl.signal.aborted) console.warn(`[video-embed] no preview for ${url}:`, err);
      });
    return () => ctrl.abort();
  }, [url]);
  return meta;
}

export interface VideoEmbedProps {
  /** The address as the app user pasted it: a YouTube, Vimeo, Loom, Descript or Google Drive video. */
  url: string;
  className?: string;
}

/** A pasted video link as a player in the page: a still with a play button, which
 *  loads the provider's own player only once pressed. A link this does not know
 *  renders as a plain link, so it is safe on any address. */
export function VideoEmbed({ url, className }: VideoEmbedProps) {
  const link = useMemo(() => parseVideoLink(url), [url]);
  const [playing, setPlaying] = useState(false);
  const meta = useOembed(link?.oembed);
  if (!link) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={className}>
        {url}
      </a>
    );
  }
  const title = meta.title ?? `${link.provider} video`;
  const thumbnail = link.thumbnail ?? meta.thumbnail_url;
  const frame = `aspect-video w-full overflow-hidden rounded-lg border border-border ${className ?? ""}`;
  if (playing) {
    return (
      <iframe
        src={link.src}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={`${frame} bg-black`}
      />
    );
  }
  return (
    <button type="button" aria-label={`Play ${title}`} onClick={() => setPlaying(true)} className={`group relative block ${frame} bg-muted text-left`}>
      {thumbnail && <img src={thumbnail} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">{link.provider}</span>
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-14 place-items-center rounded-full bg-black/70 text-white transition-transform group-hover:scale-105">
          <PlayIcon className="ml-1 size-6 fill-current" />
        </span>
      </span>
      {meta.title && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-6 text-sm font-medium text-white">
          {meta.title}
        </span>
      )}
    </button>
  );
}
