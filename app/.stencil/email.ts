import { BACKEND_BASE, createBackendFetch } from "./backend";

export interface SendEmailParams {
  /** Plain addresses only. One containing a line break or no `@` is refused (400). */
  to: string | string[];
  /** The mailbox local part (`noreply`, `support`); never a person or brand. */
  senderName?: string;
  /** Who the mail is really from when the app sends for one of its app users — a studio,
   *  a seller, a coach. Shown as `<fromName> via <app title>`; up to 60 characters. */
  fromName?: string;
  /** Line breaks are replaced with spaces before sending; a subject is one line. */
  subject: string;
  /** Sent as-is, signed by the app. Every interpolated value the app builder did not write
   *  (a visitor's or app user's text, a stored record's field) goes through `escapeHtml`. */
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  /** Set on newsletters, digests, promotions and reminder series, never on receipts or sign-in
   *  codes. Stencil skips anyone who unsubscribed (`id` is then null) and adds their unsubscribe
   *  link at `{{unsubscribe_url}}`, or under the body. One `to` address, no cc or bcc. */
  marketing?: boolean;
}

/** One attachment on a received message. `path` is an internal, bearer-gated
 *  backend path — NOT a public URL, so never hand it to the browser as a link.
 *  Fetch the bytes server-side with `createEmail(env).getAttachment(id, index)`
 *  and re-serve them from your own route. */
export interface InboundAttachment {
  filename: string;
  contentType?: string;
  size?: number;
  /** Internal backend path (e.g. `/email/inbound/:id/attachments/:index`).
   *  Reference only — fetch via `getAttachment`, don't link to it directly. */
  path: string;
}

/** The app's inbound email address, as returned by `createEmail(env).address()`. */
export interface InboundAddress {
  /** Where mail lands when the sender addresses no mailbox, e.g. `noreply.<slug>@mail.hellostencil.com`. */
  default: string;
  /** The general shape any inbound address for this app follows, e.g. `<mailbox>.<slug>@mail.hellostencil.com`. */
  pattern: string;
  /** True when the app's email identity is a custom domain its owner connected.
   *  The platform flips this automatically — app code never needs to branch on it. */
  custom: boolean;
  /** Present when `custom` is true: the app's original shared-domain address,
   *  retained as a permanent alias that still receives. */
  sharedAlias?: { default: string; pattern: string };
}

/** What became of one email the app sent, as reported by the mail provider. */
export interface EmailOutcome {
  /** The `id` that `send()` returned for this email. */
  id: string;
  to: string;
  subject: string;
  /** `failed` means it never left Stencil; the other three are the recipient's mail server's answer. */
  status: "delivered" | "bounced" | "complained" | "failed";
  /** Why it did not land, e.g. `Transient / Content Rejected / 554 5.7.1 …`; null when delivered. */
  reason: string | null;
  /** ISO time of the outcome. */
  at: string;
}

/** Make a value safe to place inside an HTML email body or attribute. Use it on
 *  every value a visitor, app user or record supplied — a name, a message, a
 *  product title — so their text can never become links, buttons or markup. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Create an email client proxied through the Stencil backend service. No API keys required in the app. */
export function createEmail(env: Env) {
  const backendFetch = createBackendFetch(env);

  function send(params: SendEmailParams & { marketing: boolean }): Promise<{ id: string | null }>;
  function send(params: SendEmailParams): Promise<{ id: string }>;
  async function send(params: SendEmailParams): Promise<{ id: string | null }> {
    const res = await backendFetch(`${BACKEND_BASE}/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Email send failed: ${await res.text()}`);
    return res.json() as Promise<{ id: string | null }>;
  }

  return {
    send,

    /** Delivery outcomes of this app's sends, newest first, at most 500; `since` narrows them to
     *  emails sent at or after that time. `send()` only says the provider accepted the email; a
     *  bounce arrives minutes later and shows up here, so match `id` against this list. */
    async outcomes(params: { since?: string | Date } = {}): Promise<EmailOutcome[]> {
      const since = params.since instanceof Date ? params.since.toISOString() : params.since;
      const query = since ? `?since=${encodeURIComponent(since)}` : "";
      const res = await backendFetch(`${BACKEND_BASE}/email/outcomes${query}`);
      if (!res.ok) throw new Error(`outcomes failed: ${await res.text()}`);
      return res.json() as Promise<EmailOutcome[]>;
    },

    /** This app's inbound email address. `default` is where mail lands when the
     *  sender uses no mailbox; `pattern` is the general `<mailbox>.<slug>@…` shape
     *  (any `<mailbox>` routes to this app). Never build the address by hand —
     *  the platform owns the domain, so always read it from here. */
    async address(): Promise<InboundAddress> {
      const res = await backendFetch(`${BACKEND_BASE}/email/address`);
      if (!res.ok) throw new Error(`address failed: ${await res.text()}`);
      return res.json() as Promise<InboundAddress>;
    },

    /** Fetch one attachment's bytes, server-side, through the platform binding.
     *  `index` is the attachment's position in the received message's attachments.
     *  Returns the platform's `Response`: the type is already pinned to what may
     *  render inline (anything else is generic bytes), with nosniff and a download
     *  disposition. Re-serve it from your own route with
     *  `untrustedFileResponse(res.body, res.headers.get("Content-Type"), …)` from
     *  `~stencil/storage` — never rebuild the headers by hand. */
    async getAttachment(id: string, index: number): Promise<Response> {
      const res = await backendFetch(
        `${BACKEND_BASE}/email/inbound/${encodeURIComponent(id)}/attachments/${index}`,
      );
      if (!res.ok) throw new Error(`getAttachment failed: ${await res.text()}`);
      return res;
    },
  };
}

export type Email = ReturnType<typeof createEmail>;
