import { useEffect, useState, type ReactNode } from "react";
import { PiCodeBold, PiLockSimpleBold } from "react-icons/pi";
import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { checkDevCode, lockDevMode, setDevMode, unlockDevMode, useDevMode } from "~/lib/dev-mode";
import { UNLOCKABLE_BOSSES, UNLOCKABLE_FIGHTERS, toggleBookUnlock, toggleBossUnlock, toggleFighterUnlock, useDevUnlocks } from "~/lib/dev-unlocks";
import { DEF_BY_ID } from "~/lib/fighters";
import { BOSSES, type BossId } from "~/lib/bosses";
import { BOOKS } from "~/lib/story";

type Problem = "wrong" | "busy" | "failed";
const PROBLEM_KEYS: Record<Problem, StringKey> = {
  wrong: "devMode.error.wrong",
  busy: "devMode.error.busy",
  failed: "devMode.error.failed",
};
const OPENS: StringKey[] = ["devMode.opens1", "devMode.opens2", "devMode.opens3", "devMode.opens4"];

/** One fighter, boss or book, toggled between "picked for good" and not. */
function UnlockChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} aria-pressed={active} onClick={onClick} className="shrink-0">
      {children}
    </Button>
  );
}

/** The developer mode panel: type the developer code to unlock it, then switch it on or off in this browser. */
export function DevModeSheet() {
  const triggerLabel = useString("devMode.open");
  const inputLabel = useString("devMode.label");
  const placeholder = useString("devMode.placeholder");
  const dev = useDevMode();
  const perm = useDevUnlocks();
  const permCount = perm.fighters.length + perm.bosses.length + perm.books.length;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (!open) return;
    setTyped("");
    setProblem(null);
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    setBusy(true);
    setProblem(null);
    const reply = await checkDevCode(typed);
    setBusy(false);
    if (reply.ok) {
      unlockDevMode();
      setTyped("");
    } else setProblem(reply.reason);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={triggerLabel} title={triggerLabel} data-dev-mode-open>
          <PiCodeBold className="size-5" aria-hidden />
          <Text id="devMode.open" className="hidden whitespace-nowrap sm:inline" />
          {dev.on && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-extrabold uppercase tracking-[0.08em] text-primary-foreground" data-dev-mode-on>
              <Text id="devMode.on" />
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md" data-dev-mode-sheet>
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            <Text id="devMode.title" />
          </SheetTitle>
          <SheetDescription>
            <Text id="devMode.intro" />
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-6">
          {!dev.unlocked ? (
            <section className="flex flex-col gap-3">
              <Text id="devMode.lockedBody" as="p" className="text-sm text-foreground-secondary" />
              <form onSubmit={submit} className="flex flex-col gap-2">
                <Label htmlFor="dev-code-input" className="sr-only">{inputLabel}</Label>
                <div className="flex gap-3">
                  <Input
                    id="dev-code-input"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={placeholder}
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={20}
                    className="font-mono tracking-[0.08em] tabular-nums"
                  />
                  <Button type="submit" disabled={busy || typed.trim() === ""}>
                    <Text id={busy ? "devMode.checking" : "devMode.unlock"} />
                  </Button>
                </div>
              </form>
              {problem && <Text id={PROBLEM_KEYS[problem]} as="p" role="alert" className="text-sm font-bold text-error" />}
            </section>
          ) : (
            <>
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-border-strong bg-background-secondary px-4 py-3">
                  <Label htmlFor="dev-mode-switch" className="font-display text-lg text-foreground">
                    <Text id="devMode.switchLabel" />
                  </Label>
                  <Switch id="dev-mode-switch" checked={dev.on} onCheckedChange={(v) => setDevMode(v)} />
                </div>
                <Text id={dev.on ? "devMode.switchOn" : "devMode.switchOff"} as="p" role="status" className="text-sm font-bold text-foreground" />
              </section>
              <section className="flex flex-col gap-3">
                <Text id="devMode.opensHeading" as="h3" className="font-display text-lg text-foreground" />
                <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-foreground-secondary">
                  {OPENS.map((id) => (
                    <Text key={id} id={id} as="li" />
                  ))}
                </ul>
              </section>
              <section className="flex flex-col gap-4 border-t-2 border-border-subtle pt-6" data-dev-permanent-unlocks>
                <div className="flex flex-col gap-1">
                  <Text id="devMode.permHeading" as="h3" className="font-display text-lg text-foreground" />
                  <Text id="devMode.permIntro" as="p" className="text-sm text-foreground-secondary" />
                  {permCount > 0 && <Text id="devMode.permCount" vars={{ count: permCount }} as="p" className="text-sm font-bold text-foreground" />}
                </div>
                <div className="flex flex-col gap-2">
                  <Text id="devMode.permFighters" as="h4" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
                  <div className="flex flex-wrap gap-2">
                    {UNLOCKABLE_FIGHTERS.map((p) => (
                      <UnlockChip key={p} active={perm.fighters.includes(p)} onClick={() => toggleFighterUnlock(p)}>
                        {DEF_BY_ID[p].name}
                      </UnlockChip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Text id="devMode.permBosses" as="h4" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
                  <div className="flex flex-wrap gap-2">
                    {UNLOCKABLE_BOSSES.map((id: BossId) => (
                      <UnlockChip key={id} active={perm.bosses.includes(id)} onClick={() => toggleBossUnlock(id)}>
                        {BOSSES[id].name}
                      </UnlockChip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Text id="devMode.permBooks" as="h4" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
                  <div className="flex flex-wrap gap-2">
                    {BOOKS.map((_, i) => (
                      <UnlockChip key={i} active={perm.books.includes(i)} onClick={() => toggleBookUnlock(i)}>
                        <Text id={`story.books.b${i + 1}` as StringKey} />
                      </UnlockChip>
                    ))}
                  </div>
                </div>
              </section>
              <section className="flex flex-col gap-3 border-t-2 border-border-subtle pt-6">
                <Text id="devMode.lockHint" as="p" className="text-sm text-muted-foreground" />
                <Button type="button" variant="outline" onClick={lockDevMode} className="self-start">
                  <PiLockSimpleBold className="size-5" aria-hidden />
                  <Text id="devMode.lock" />
                </Button>
              </section>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
