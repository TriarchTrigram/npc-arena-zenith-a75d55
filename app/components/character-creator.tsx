// Free World's character creator: name your stick figure, pick up to three powers, then choose what it wears,
// how tall it stands and which of its powers' colours it takes. The powers decide the rest (colours, stance,
// entrance, effects and moves), and the preview shows the fighter breathing in the stance they give it.
// "Your own power" sends a typed idea to the AI, which designs a power the game doesn't have; it becomes the main power.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PiFloppyDiskBold, PiSparkleBold, PiXBold } from "react-icons/pi";
import { Text, useString } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { FighterDot } from "~/components/fighter-dot";
import { cn } from "~/lib/utils";
import {
  BUILDS, CUSTOM_HP_MAX, CUSTOM_HP_MIN, CUSTOM_HP_STEP, DEF_BY_ID, GEARS, MAX_CUSTOM_POWERS, MAX_NAME, SHADES,
  cleanOwn, customAutoHp, customMoveTotal, customOf, powerCount,
  type CustomSpec, type FighterDef, type OwnPower, type Power, type RosterId,
} from "~/lib/fighters";
import { GROUND, newGame, strollPose, drawStroller, type Game } from "~/lib/arena-engine";
import { saveMyFighter } from "~/lib/my-fighter";

const STARTER: CustomSpec = { name: "", powers: ["pyro"], gear: "scarf", build: "regular", shade: "main" };
const PW = 320;
const PH = 260;

/** The fighter breathing in its stance, on a floor lit in its colours. */
function Preview({ spec, fallbackName }: { spec: CustomSpec; fallbackName: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const aria = useString("creator.previewAria");
  const key = [spec.powers.join("."), spec.gear, spec.build, spec.shade, spec.own?.id ?? ""].join("|");
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const def = customOf(spec, fallbackName);
    const g: Game = newGame([def], true);
    const f = g.fighters[0];
    f.x = 0;
    f.y = GROUND;
    f.facing = 1;
    f.scale = (f.scale / 1.25) * 1.3;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) g.t += dt;
      strollPose(g, f, 0, 0, reduce ? 1 : dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, PW, PH);
      const floor = PH - 34;
      // a pool of light in the main colour, ringed in the glow
      const grd = ctx.createRadialGradient(PW / 2, floor, 6, PW / 2, floor, 150);
      grd.addColorStop(0, def.glow);
      grd.addColorStop(0.35, def.color);
      grd.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, PW, PH);
      ctx.globalAlpha = 1;
      ctx.translate(PW / 2, floor - GROUND);
      drawStroller(ctx, g, f);
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <canvas
      ref={ref}
      width={PW}
      height={PH}
      role="img"
      aria-label={aria}
      className="mx-auto block h-auto w-full max-w-80 rounded-xl border-4 border-border bg-background-secondary"
      data-creator-preview
    />
  );
}

function Choice({ on, onClick, disabled, children, className }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-hover active:bg-surface-active disabled:opacity-50",
        on ? "border-foreground bg-card font-semibold text-foreground" : "border-border bg-background text-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Heading({ id, hint }: { id: StringKey; hint?: StringKey }) {
  return (
    <div className="flex flex-col gap-1">
      <Text id={id} as="h3" className="font-display text-lg text-foreground" />
      {hint && <Text id={hint} as="p" className="text-sm text-muted-foreground" />}
    </div>
  );
}

type OwnError = "short" | "busy" | "refused" | "failed";
const OWN_ERRORS: OwnError[] = ["short", "busy", "refused", "failed"];

/** The swatch an invented power is drawn with. */
const ownDot = (own: OwnPower): FighterDef => ({ ...DEF_BY_ID[own.base], color: own.color, glow: own.glow, body: undefined, outline: undefined });

/** Type a power idea; the AI turns it into a power with its own colours, effects and moves. */
function OwnPowerBox({ own, willDrop, onMade, onRemove }: {
  own: OwnPower | undefined;
  willDrop: boolean;
  onMade: (p: OwnPower) => void;
  onRemove: () => void;
}) {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OwnError | null>(null);
  const placeholder = useString("creator.own.placeholder");
  const removeAria = useString("creator.own.removeAria").replace("{{name}}", own?.name ?? "");
  const make = async (e: FormEvent) => {
    e.preventDefault();
    const text = idea.replace(/\s+/g, " ").trim();
    if (text.length < 2) return setError("short");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/own-power", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idea: text }) });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; power?: unknown; code?: string } | null;
      const power = data?.ok ? cleanOwn(data.power) : null;
      if (power) {
        onMade(power);
        setIdea("");
      } else {
        setError(OWN_ERRORS.includes(data?.code as OwnError) ? (data!.code as OwnError) : "failed");
      }
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-4" data-creator-own>
      <Heading id="creator.own.title" hint="creator.own.hint" />
      {own && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-foreground bg-card px-3 py-3" data-creator-own-power>
          <FighterDot def={ownDot(own)} className="mt-1 size-5" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{own.name}</span>
              <span className="shrink-0 rounded-full border-2 border-foreground px-1.5 text-xs font-extrabold text-foreground">
                <Text id="creator.mainPower" />
              </span>
            </div>
            {own.about && <p className="text-sm text-foreground-secondary">{own.about}</p>}
            <Text id="creator.own.soundsLike" vars={{ power: DEF_BY_ID[own.base].power }} as="p" className="text-sm text-muted-foreground" />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={removeAria} title={removeAria} className="shrink-0">
            <PiXBold className="size-4" aria-hidden />
            <Text id="creator.own.remove" />
          </Button>
        </div>
      )}
      <form onSubmit={make} className="flex flex-col gap-2">
        <Label htmlFor="creator-own-idea" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
          <Text id="creator.own.label" />
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="creator-own-idea"
            value={idea}
            maxLength={60}
            placeholder={placeholder}
            autoComplete="off"
            disabled={busy}
            onChange={(e) => {
              setIdea(e.target.value);
              setError(null);
            }}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={busy} className="shrink-0" data-creator-own-make>
            <PiSparkleBold className={cn("size-5", busy && "motion-safe:animate-pulse")} aria-hidden />
            <Text id={busy ? "creator.own.making" : own ? "creator.own.remake" : "creator.own.make"} />
          </Button>
        </div>
        {willDrop && <Text id="creator.own.replaceNote" as="p" className="text-sm text-muted-foreground" />}
        <div aria-live="polite">
          {error && <Text id={`creator.own.error.${error}` as StringKey} as="p" role="alert" className="text-sm text-error" />}
        </div>
      </form>
    </div>
  );
}

/** The creator sheet. `powers` are the powers on offer (the fighters plus any quest or new-gen fighter you've earned). */
export function CharacterCreator({ open, onOpenChange, saved, powers, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: CustomSpec | null;
  powers: Power[];
  onSaved: (id: RosterId) => void;
}) {
  const [draft, setDraft] = useState<CustomSpec>(saved ?? STARTER);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  // every time the sheet opens it starts from what you saved
  useEffect(() => {
    if (open) {
      setDraft(saved ?? STARTER);
      setSavedNote(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const fallbackName = useString("creator.fallbackName");
  const namePlaceholder = useString("creator.namePlaceholder");
  const def = useMemo(() => customOf(draft, fallbackName), [draft, fallbackName]);
  const set = (patch: Partial<CustomSpec>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSavedNote(null);
  };
  const count = powerCount(draft);
  const togglePower = (p: Power) => {
    const has = draft.powers.includes(p);
    if (has && count === 1) return;
    if (!has && count >= MAX_CUSTOM_POWERS) return;
    set({ powers: has ? draft.powers.filter((x) => x !== p) : [...draft.powers, p] });
  };
  const name = draft.name.replace(/\s+/g, " ").trim();
  const save = () => {
    if (!name) return;
    const id = saveMyFighter({ ...draft, name });
    setSavedNote(name);
    onSaved(id);
  };
  const full = count >= MAX_CUSTOM_POWERS;
  const madeOwn = (own: OwnPower) => {
    setDraft((d) => ({ ...d, own, powers: d.powers.slice(0, MAX_CUSTOM_POWERS - 1) }));
    setSavedNote(null);
  };
  // without another power, the invented one leaves behind the element it was built on
  const removeOwn = () => {
    setDraft((d) => ({ ...d, own: undefined, powers: d.powers.length ? d.powers : d.own ? [d.own.base] : ["pyro"] }));
    setSavedNote(null);
  };
  const ownSwatch = draft.own ? ownDot(draft.own) : null;
  const autoHp = customAutoHp(draft);
  const moveTotal = useMemo(() => customMoveTotal(draft), [draft]);
  const abilities = Math.min(draft.moveCap ?? moveTotal, moveTotal);
  const hpAria = useString("creator.tune.healthLabel");
  const movesAria = useString("creator.tune.abilitiesLabel");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg" data-creator>
        <SheetHeader>
          <SheetTitle className="font-display text-xl"><Text id="creator.title" /></SheetTitle>
          <SheetDescription><Text id="creator.intro" /></SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-6">
          <Preview spec={draft} fallbackName={fallbackName} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="creator-name" className="font-display text-lg text-foreground"><Text id="creator.nameLabel" /></Label>
            <Input
              id="creator-name"
              value={draft.name}
              maxLength={MAX_NAME}
              placeholder={namePlaceholder}
              autoComplete="off"
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>

          <section className="flex flex-col gap-3" data-creator-powers>
            <div className="flex flex-wrap items-baseline gap-2">
              <Heading id="creator.powersTitle" hint="creator.powersHint" />
            </div>
            <OwnPowerBox own={draft.own} willDrop={!draft.own && full} onMade={madeOwn} onRemove={removeOwn} />
            <Text id="creator.powersCount" vars={{ count, max: MAX_CUSTOM_POWERS }} as="p" className="text-sm text-muted-foreground tabular-nums" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {powers.map((p) => {
                const d = DEF_BY_ID[p];
                const at = draft.powers.indexOf(p) + (draft.own && draft.powers.includes(p) ? 1 : 0);
                const on = draft.powers.includes(p);
                return (
                  <Choice key={p} on={on} disabled={!on && full} onClick={() => togglePower(p)}>
                    <FighterDot def={d} className="size-5" />
                    <span className="min-w-0 truncate" title={d.power}>{d.power}</span>
                    {on && (
                      <span className="ml-auto shrink-0 rounded-full border-2 border-foreground px-1.5 text-xs font-extrabold tabular-nums text-foreground">
                        {at === 0 ? <Text id="creator.mainPower" /> : at + 1}
                      </span>
                    )}
                  </Choice>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3" data-creator-look>
            <Heading id="creator.lookTitle" hint="creator.lookHint" />
            <Text id="creator.gearLabel" as="h4" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GEARS.map((gear) => (
                <Choice key={gear} on={draft.gear === gear} onClick={() => set({ gear })}>
                  <Text id={`creator.gear.${gear}` as StringKey} />
                </Choice>
              ))}
            </div>
            <Text id="creator.buildLabel" as="h4" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
            <div className="grid grid-cols-3 gap-2">
              {BUILDS.map((build) => (
                <Choice key={build} on={draft.build === build} onClick={() => set({ build })}>
                  <Text id={`creator.build.${build}` as StringKey} />
                </Choice>
              ))}
            </div>
            <Text id="creator.shadeLabel" as="h4" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SHADES.map((shade) => {
                const look = customOf({ ...draft, shade }, fallbackName);
                return (
                  <Choice key={shade} on={draft.shade === shade} onClick={() => set({ shade })}>
                    <FighterDot def={look} className="size-5" />
                    <Text id={`creator.shade.${shade}` as StringKey} />
                  </Choice>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-4" data-creator-tune>
            <Heading id="creator.tune.title" hint="creator.tune.hint" />
            <div className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Text id="creator.tune.healthLabel" as="h4" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
                <span className="ml-auto font-semibold tabular-nums text-foreground" data-creator-hp>{draft.hp ?? autoHp}</span>
              </div>
              <Slider
                min={CUSTOM_HP_MIN}
                max={CUSTOM_HP_MAX}
                step={CUSTOM_HP_STEP}
                value={[draft.hp ?? autoHp]}
                onValueChange={([v]) => set({ hp: v })}
                aria-label={hpAria}
              />
              <div className="flex items-center gap-2">
                <Text id={draft.hp ? "creator.tune.healthChosen" : "creator.tune.healthAuto"} as="p" className="text-sm text-muted-foreground" />
                {draft.hp !== undefined && (
                  <Button type="button" variant="ghost" size="sm" className="ml-auto shrink-0" onClick={() => set({ hp: undefined })}>
                    <Text id="creator.tune.reset" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Text id="creator.tune.abilitiesLabel" as="h4" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
                <Text id="creator.tune.abilitiesOf" vars={{ count: abilities, total: moveTotal }} className="ml-auto font-semibold tabular-nums text-foreground" />
              </div>
              <Slider
                min={1}
                max={moveTotal}
                step={1}
                value={[abilities]}
                onValueChange={([v]) => set({ moveCap: v >= moveTotal ? undefined : v })}
                aria-label={movesAria}
              />
              <Text id="creator.tune.abilitiesHint" as="p" className="text-sm text-muted-foreground" />
            </div>
          </section>

          <section className="flex flex-col gap-3" data-creator-moves>
            <Heading id="creator.givesTitle" />
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {([
                ["creator.stat.role", <Text key="r" id={`creator.role.${def.role}` as StringKey} />],
                ["creator.stat.health", def.hp],
                ["creator.stat.speed", def.speed],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl border-2 border-border bg-background px-3 py-2">
                  <Text id={label} as="dt" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
                  <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <Text id="creator.movesCount" vars={{ count: def.moves.length }} as="p" className="text-sm text-muted-foreground tabular-nums" />
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {def.moves.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-foreground">
                  <FighterDot def={ownSwatch && m.id.startsWith("own-") ? ownSwatch : DEF_BY_ID[m.power ?? def.id]} className="size-3" />
                  <span className="min-w-0 truncate">{m.name}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-2">
            <Button onClick={save} disabled={!name} data-creator-save>
              <PiFloppyDiskBold className="size-5" aria-hidden />
              <Text id="creator.save" />
            </Button>
            {!name && <Text id="creator.needName" as="p" className="text-sm text-muted-foreground" />}
            <div aria-live="polite" className="text-sm text-foreground-secondary">
              {savedNote && <Text id="creator.savedNote" vars={{ name: savedNote }} />}
            </div>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
