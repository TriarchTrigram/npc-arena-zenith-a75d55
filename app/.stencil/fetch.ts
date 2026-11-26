import { BACKEND_BASE, createBackendFetch } from "./backend";
import { publicUrlProblem } from "./safe-fetch";
import { FILES_ROUTE, storeImageFromUrl } from "./storage";

export interface FetchedPage {
  /** The page's main content as clean markdown. */
  markdown: string;
  /** Internal links found on the page (same host). */
  links: string[];
  /** Page title (Open Graph title when the page sets one), null when absent. */
  title: string | null;
  /** Page description, null when absent. */
  description: string | null;
  /** Preview image (og:image): the outside address, or `/api/files/<key>` once `storeImage`
   *  copied it into app storage. Null when the page has none or the copy was refused. */
  image: string | null;
  /** Site name (og:site_name), null when absent. */
  siteName: string | null;
}

export interface FetchPageOptions {
  /** Copy the preview image into the app's own storage under `key`, so `image` is served from
   *  the app and the linked site never learns who viewed the card. Required whenever other app
   *  users or the public see the card; the address itself is never stored or rendered. */
  storeImage?: { storage: R2Bucket; key: string };
}

/**
 * Thrown by `page()` when the platform could not read the URL. `code` is
 * `"site-unreadable"` when the site itself refuses automated readers (social
 * platforms such as Instagram do) and `"not-a-page"` when the address serves a
 * file such as a video or a large download: no retry will help either way, so
 * show a fallback instead.
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

/**
 * Fetch one known URL's content as clean markdown (Firecrawl), proxied through
 * the Stencil backend — no API key needed in the app. Server-side only.
 *
 * Use this when you already HAVE a URL and want its content (e.g. read/monitor a
 * specific page) or its link-card metadata (title, description, preview image).
 * To discover pages you do NOT have URLs for, use `createSearch` (~stencil/search)
 * instead — and note that search can already return page content inline, so you
 * rarely need to fetch a result it gave you.
 *
 * ```ts
 * const web = createFetch(env);
 * const { markdown } = await web.page("https://example.com/call-for-speakers");
 * const { title, description, image } = await web.page(savedLink.url); // link card the poster alone sees
 * const card = await web.page(savedLink.url, { storeImage: { storage, key: `links/${id}` } }); // shared card
 * ```
 */
export function createFetch(env: Env) {
  const backendFetch = createBackendFetch(env);

  return {
    /** Fetch a single URL and return its main content as markdown plus link-card metadata. */
    async page(url: string, options?: FetchPageOptions): Promise<FetchedPage> {
      // Both page readers read a bare "example.com" as http://, so that is what is vetted and sent.
      const address = /^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim()) ? url.trim() : `http://${url.trim()}`;
      const problem = publicUrlProblem(address);
      if (problem) throw new FetchError(`Fetch failed: ${problem}`);
      const res = await backendFetch(`${BACKEND_BASE}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: address }),
      });
      if (!res.ok) {
        // The proxy's body carries the provider's own status and message; `detail`
        // is raw provider text, so cap it and keep it out of anything app users see.
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string; code?: string };
        const detail = err.detail?.trim().slice(0, 300);
        throw new FetchError(
          `Fetch failed: ${err.error ?? `HTTP ${res.status}`}${detail ? ` — ${detail}` : ""}`,
          err.code,
        );
      }
      const data = (await res.json()) as Partial<FetchedPage>;
      let image = data.image ?? null;
      if (image && options?.storeImage) {
        const stored = await storeImageFromUrl(options.storeImage.storage, image, options.storeImage.key);
        image = stored.ok ? `${FILES_ROUTE}${stored.key}` : null;
      }
      return {
        markdown: data.markdown ?? "",
        links: data.links ?? [],
        title: data.title ?? null,
        description: data.description ?? null,
        image,
        siteName: data.siteName ?? null,
      };
    },
  };
}

export type Fetch = ReturnType<typeof createFetch>;
