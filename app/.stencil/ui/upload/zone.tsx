import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type * as UploadClient from "../../upload/client";
import type { InterruptedUpload, UploadedFile, UploadRules } from "../../upload/client";

export interface UploadZoneProps {
  /** The browser uploader, passed in whole: `import * as uploader from "~stencil/upload/client"`. */
  uploader: Pick<
    typeof UploadClient,
    "uploadFiles" | "uploadRules" | "interruptedUploads" | "forgetInterruptedUploads"
  >;
  /** Called once per batch with the files that reached storage; save each `key` on its row. */
  onUploaded: (files: UploadedFile[]) => void;
  /** The app's upload route. Defaults to `/api/upload`. */
  route?: string;
  /** The record the files belong to, such as `gallery:42`, so a batch cut short is offered only there. */
  batch?: string;
  /** Take many files and whole folders. Pass false for a field that holds one file. */
  multiple?: boolean;
  /** The line inside the drop area. */
  label?: string;
  className?: string;
}

interface Row {
  id: number;
  file: File;
  name: string;
  percent: number;
  done?: boolean;
  error?: string;
  /** False for a refusal, which the same file would get again. */
  retry?: boolean;
}

const BUTTON_CLASS =
  "h-10 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-surface-hover " +
  "disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
const UNFINISHED = "The upload didn't finish. Check your connection and try again.";
const BUSY = "Uploading. Add more files when this upload finishes.";

const readEntries = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));

// `dataTransfer.files` lists a dropped folder as one empty file, so folders are walked entry by entry.
async function walk(entry: FileSystemEntry, into: File[]): Promise<void> {
  if (entry.isFile) {
    into.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // One call returns at most a page of entries; an empty page is the end.
  for (let page = await readEntries(reader); page.length; page = await readEntries(reader)) {
    for (const child of page) {
      // Folders carry files the app user never chose, such as `.DS_Store`.
      if (!child.name.startsWith(".")) await walk(child, into);
    }
  }
}

/**
 * An upload field: a drop area with buttons to choose files or a folder, the allowed formats
 * and size cap read from the upload route and shown before picking, a progress row per file,
 * each refusal's sentence beside its file, Retry for the files that failed and Cancel for the batch.
 */
export function UploadZone({
  uploader,
  onUploaded,
  route,
  batch,
  multiple = true,
  label = multiple ? "Drop files or a folder here" : "Drop a file here",
  className = "flex w-full flex-col gap-3",
}: UploadZoneProps) {
  const [rules, setRules] = useState<UploadRules | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [waiting, setWaiting] = useState<InterruptedUpload[]>([]);
  const [note, setNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const hintId = useId();

  useEffect(() => {
    let current = true;
    uploader
      .uploadRules(route)
      .then((answer) => current && setRules(answer))
      .catch((err) => console.warn(`[upload] ${route ?? "/api/upload"} did not answer what it accepts, so the field shows no formats or size:`, err));
    if (batch) void uploader.interruptedUploads({ route, batch }).then((files) => current && setWaiting(files));
    return () => {
      current = false;
    };
  }, [uploader, route, batch]);

  const update = (file: File, changes: Partial<Row>) =>
    setRows((all) => all.map((row) => (row.file === file ? { ...row, ...changes } : row)));

  async function send(picked: File[]) {
    const files = multiple ? picked : picked.slice(0, 1);
    if (!files.length || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    const landed: UploadedFile[] = [];
    let failed = 0;
    setBusy(true);
    setWaiting([]);
    setNote(BUSY);
    setRows((all) => [
      ...all.filter((row) => !files.includes(row.file)),
      ...files.map((file) => ({ id: nextId.current++, file, name: file.webkitRelativePath || file.name, percent: 0 })),
    ]);
    try {
      await uploader.uploadFiles(files, {
        route,
        batch,
        signal: abort.signal,
        onFileProgress: (file, percent) => update(file, { percent }),
        onFile: ({ file, uploaded, error }) => {
          if (uploaded) landed.push(uploaded);
          else failed += 1;
          update(
            file,
            uploaded
              ? { percent: 100, done: true }
              : { error: error?.message ?? UNFINISHED, retry: !error?.status || error.status >= 500 },
          );
        },
      });
      setNote(`${landed.length} uploaded${failed ? `, ${failed} not uploaded` : ""}.`);
    } catch (err) {
      if (abort.signal.aborted) {
        setRows((all) => all.filter((row) => row.done || row.error));
        setNote("Upload cancelled.");
      } else {
        console.error(`[upload] the batch of ${files.length} file(s) stopped before every file was tried:`, err);
        setRows((all) => all.map((row) => (row.done || row.error ? row : { ...row, error: UNFINISHED, retry: true })));
      }
    } finally {
      setBusy(false);
      if (landed.length) onUploaded(landed);
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].filter((file) => !file.name.startsWith("."));
    // Cleared so picking the same file again still fires a change.
    event.target.value = "";
    void send(files);
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    if (busy) return;
    const dropped = [...event.dataTransfer.files];
    // Entries are only readable while the drop event is being handled, so they are taken first.
    const entries = [...event.dataTransfer.items].flatMap((item) => item.webkitGetAsEntry?.() ?? []);
    const files: File[] = [];
    try {
      for (const entry of entries) await walk(entry, files);
    } catch (err) {
      console.warn("[upload] a dropped folder could not be read, so only the files dropped beside it are sent:", err);
      files.splice(0, files.length, ...dropped.filter((file) => file.size > 0));
    }
    void send(entries.length ? files : dropped);
  }

  const retryable = rows.filter((row) => row.retry).map((row) => row.file);
  const stored = waiting.filter((file) => file.stored).length;

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          // Always prevented, or the browser opens a dropped file and the upload under way is lost.
          event.preventDefault();
          if (busy) event.dataTransfer.dropEffect = "none";
          else setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center ${
          over ? "border-primary bg-muted" : "border-border bg-background"
        } ${busy ? "opacity-60" : ""}`}
      >
        <p className="text-sm font-medium text-foreground">{busy ? BUSY : label}</p>
        {rules?.hint ? (
          <p id={hintId} className="text-sm text-muted-foreground">
            {rules.hint}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className={BUTTON_CLASS}
            disabled={busy}
            aria-describedby={rules?.hint ? hintId : undefined}
            onClick={() => fileInput.current?.click()}
          >
            {multiple ? "Choose files" : "Choose a file"}
          </button>
          {multiple ? (
            <button type="button" className={BUTTON_CLASS} disabled={busy} onClick={() => folderInput.current?.click()}>
              Choose a folder
            </button>
          ) : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          hidden
          multiple={multiple}
          accept={rules?.accept?.join(",")}
          onChange={onPick}
        />
        {multiple ? (
          <input
            ref={(el) => {
              folderInput.current = el;
              el?.setAttribute("webkitdirectory", "");
            }}
            type="file"
            hidden
            multiple
            onChange={onPick}
          />
        ) : null}
      </div>

      {waiting.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
          <p>
            {stored} of {waiting.length} files were uploaded before the page closed. Choose the same files or folder to
            send the rest.
          </p>
          <button
            type="button"
            className={BUTTON_CLASS}
            onClick={() => {
              setWaiting([]);
              void uploader.forgetInterruptedUploads({ route, batch });
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {rows.length ? (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-foreground">{row.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {row.error ? "Not uploaded" : row.done ? "Uploaded" : `${row.percent}%`}
                </span>
              </div>
              {row.error ? (
                <p className="text-destructive">{row.error}</p>
              ) : row.done ? null : (
                <div
                  role="progressbar"
                  aria-label={`Uploading ${row.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.percent}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full bg-primary" style={{ width: `${row.percent}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {busy || retryable.length ? (
        <div className="flex gap-2">
          {busy ? (
            <button type="button" className={BUTTON_CLASS} onClick={() => controller.current?.abort()}>
              Cancel
            </button>
          ) : (
            <button type="button" className={BUTTON_CLASS} onClick={() => void send(retryable)}>
              Retry failed
            </button>
          )}
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {note}
      </div>
    </div>
  );
}
