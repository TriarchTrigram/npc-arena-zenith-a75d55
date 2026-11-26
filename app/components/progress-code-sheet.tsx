import { useEffect, useState } from "react";
import { PiCheckBold, PiCopyBold, PiDownloadSimpleBold, PiKeyBold, PiUploadSimpleBold } from "react-icons/pi";
import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import {
  CODE_LENGTH, applySave, formatCode, loadCode, loadFromCode, normalizeCode, rememberCode, saveToCode,
  type CodeReply, type ProgressSave,
} from "~/lib/progress-code";

type Problem = Extract<CodeReply, { ok: false }>["reason"];
const PROBLEM_KEYS: Record<Problem, StringKey> = {
  wrong: "progressCode.error.wrong",
  too_many: "progressCode.error.tooMany",
  busy: "progressCode.error.busy",
  too_large: "progressCode.error.tooLarge",
  failed: "progressCode.error.failed",
};

/** The progress code panel: make a code for this browser's progress, keep it up to date, or load a code's progress here. */
export function ProgressCodeSheet() {
  const triggerLabel = useString("progressCode.open");
  const inputLabel = useString("progressCode.load.label");
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "load" | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveProblem, setSaveProblem] = useState<Problem | null>(null);
  const [typed, setTyped] = useState("");
  const [loadProblem, setLoadProblem] = useState<Problem | null>(null);
  const [found, setFound] = useState<{ code: string; save: ProgressSave } | null>(null);

  // the code lives in this browser's storage, so it is read once the panel opens
  useEffect(() => {
    if (!open) return;
    setCode(loadCode());
    setSaved(false);
    setCopied(false);
    setSaveProblem(null);
    setLoadProblem(null);
    setFound(null);
  }, [open]);

  const save = async () => {
    setBusy("save");
    setSaveProblem(null);
    setSaved(false);
    const reply = await saveToCode(code);
    setBusy(null);
    if (reply.ok) {
      rememberCode(reply.code);
      setCode(reply.code);
      setSaved(true);
      return;
    }
    if (reply.reason === "wrong" && code) {
      // the code this browser kept no longer opens anything: forget it so a new one can be made
      rememberCode(null);
      setCode(null);
    }
    setSaveProblem(reply.reason);
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(formatCode(code));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const look = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadProblem(null);
    setFound(null);
    if (normalizeCode(typed).length !== CODE_LENGTH) {
      setLoadProblem("wrong");
      return;
    }
    setBusy("load");
    const reply = await loadFromCode(typed);
    setBusy(null);
    if (reply.ok) setFound({ code: reply.code, save: reply.save ?? {} });
    else setLoadProblem(reply.reason);
  };

  const confirmLoad = () => {
    if (!found) return;
    try {
      applySave(found.save);
      rememberCode(found.code);
      window.location.reload();
    } catch {
      setLoadProblem("failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={triggerLabel} title={triggerLabel} data-progress-code-open>
          <PiKeyBold className="size-5" aria-hidden />
          <Text id="progressCode.open" className="hidden whitespace-nowrap sm:inline" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md" data-progress-code-sheet>
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            <Text id="progressCode.title" />
          </SheetTitle>
          <SheetDescription>
            <Text id="progressCode.intro" />
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-6">
          <section className="flex flex-col gap-3">
            <Text id="progressCode.yours.heading" as="h3" className="font-display text-lg text-foreground" />
            {code ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-border-strong bg-highlight px-4 py-3 shadow-sm">
                  <span className="font-mono text-2xl font-bold tracking-[0.12em] text-highlight-foreground tabular-nums" data-progress-code>
                    {formatCode(code)}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={copy}>
                    {copied ? <PiCheckBold className="size-5" aria-hidden /> : <PiCopyBold className="size-5" aria-hidden />}
                    <Text id={copied ? "progressCode.yours.copied" : "progressCode.yours.copy"} />
                  </Button>
                </div>
                <Text id="progressCode.yours.keep" as="p" className="text-sm text-muted-foreground" />
                <Button type="button" onClick={save} disabled={busy !== null}>
                  <PiUploadSimpleBold className="size-5" aria-hidden />
                  <Text id={busy === "save" ? "progressCode.yours.saving" : "progressCode.yours.update"} />
                </Button>
                {saved && <Text id="progressCode.yours.updated" as="p" role="status" className="text-sm font-bold text-foreground" />}
              </>
            ) : (
              <>
                <Text id="progressCode.yours.none" as="p" className="text-sm text-foreground-secondary" />
                <Button type="button" onClick={save} disabled={busy !== null}>
                  <PiKeyBold className="size-5" aria-hidden />
                  <Text id={busy === "save" ? "progressCode.yours.making" : "progressCode.yours.make"} />
                </Button>
              </>
            )}
            {saveProblem && <Text id={PROBLEM_KEYS[saveProblem]} as="p" role="alert" className="text-sm font-bold text-error" />}
          </section>

          <section className="flex flex-col gap-3 border-t-2 border-border-subtle pt-6">
            <Text id="progressCode.load.heading" as="h3" className="font-display text-lg text-foreground" />
            <Text id="progressCode.load.body" as="p" className="text-sm text-foreground-secondary" />
            {found ? (
              <div className="flex flex-col gap-3 rounded-xl border-2 border-border-strong bg-background-secondary p-4">
                <Text id="progressCode.load.confirm" vars={{ code: formatCode(found.code) }} as="p" className="text-sm text-foreground" />
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={confirmLoad}>
                    <PiDownloadSimpleBold className="size-5" aria-hidden />
                    <Text id="progressCode.load.yes" />
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setFound(null)}>
                    <Text id="progressCode.load.cancel" />
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={look} className="flex flex-col gap-2">
                <Label htmlFor="progress-code-input" className="sr-only">{inputLabel}</Label>
                <div className="flex gap-3">
                  <Input
                    id="progress-code-input"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="ABCDE-23456"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={20}
                    className="font-mono uppercase tracking-[0.08em]"
                  />
                  <Button type="submit" variant="outline" disabled={busy !== null || typed.trim() === ""}>
                    <Text id={busy === "load" ? "progressCode.load.looking" : "progressCode.load.button"} />
                  </Button>
                </div>
              </form>
            )}
            {loadProblem && <Text id={PROBLEM_KEYS[loadProblem]} as="p" role="alert" className="text-sm font-bold text-error" />}
          </section>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
