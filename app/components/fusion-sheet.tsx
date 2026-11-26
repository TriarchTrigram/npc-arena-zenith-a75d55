import { useState, type ReactNode } from "react";
import { PiSparkleBold } from "react-icons/pi";
import { Text, useString } from "~stencil/ui/strings";
import { Button } from "~/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { FighterDot } from "~/components/fighter-dot";
import { FighterSelect } from "~/components/story-panel";
import { cn } from "~/lib/utils";
import { DEF_BY_ID, defOf, hybridKey, type FighterDef, type Power, type RosterId } from "~/lib/fighters";
import { rememberHybrid } from "~/lib/hybrids";

/** Who a hybrid was fused from, in words. */
export function HybridParents({ def, className }: { def: FighterDef; className?: string }) {
  if (!def.parents) return null;
  const [a, b] = def.parents;
  return a === b ? (
    <Text id="fusion.fromSame" vars={{ a: DEF_BY_ID[a].name }} className={className} />
  ) : (
    <Text id="fusion.from" vars={{ a: DEF_BY_ID[a].name, b: DEF_BY_ID[b].name }} className={className} />
  );
}

/** The fusion lab: pick two fighters (the same one twice is allowed), see the hybrid, save it to the roster. */
export function FusionSheet({ saved, disabled = false, trigger }: { saved: RosterId[]; disabled?: boolean; trigger?: ReactNode }) {
  const [a, setA] = useState<Power>("umbra");
  const [b, setB] = useState<Power>("lux");
  const [justMade, setJustMade] = useState<RosterId | null>(null);
  const firstAria = useString("story.first");
  const secondAria = useString("story.second");
  const key = hybridKey(a, b);
  const hybrid = defOf(key);
  const have = saved.includes(key);

  const pick = (side: "a" | "b", p: Power) => {
    setJustMade(null);
    if (side === "a") setA(p);
    else setB(p);
  };

  return (
    <Sheet onOpenChange={(open) => !open && setJustMade(null)}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" disabled={disabled}>
            <PiSparkleBold className="size-5" />
            <Text id="fusion.open" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md" data-fusion-sheet>
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            <Text id="fusion.title" />
          </SheetTitle>
          <SheetDescription>
            <Text id="fusion.intro" />
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <FighterSelect value={a} label={firstAria} disabled={false} onChange={(p) => pick("a", p)} />
            <span aria-hidden className="font-display text-xl text-muted-foreground">+</span>
            <FighterSelect value={b} label={secondAria} disabled={false} onChange={(p) => pick("b", p)} />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border-2 border-border bg-background-secondary px-4 py-4" data-fusion-preview>
            <Text id="fusion.yours" className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground" />
            <div className="flex items-center gap-3">
              <FighterDot def={hybrid} className="size-8 border-4" />
              <div className="min-w-0">
                <p className="font-display text-2xl leading-[1.2] text-foreground">{hybrid.name}</p>
                <HybridParents def={hybrid} className="text-sm text-muted-foreground" />
              </div>
            </div>
            <Text id="fusion.moves" vars={{ count: hybrid.moves.length }} as="p" className="text-sm text-muted-foreground tabular-nums" />
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground">
              {hybrid.moves.map((m) => (
                <li key={m.id} className={cn(m.id.startsWith("mix-") && "font-extrabold")}>{m.name}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              disabled={have}
              onClick={() => {
                rememberHybrid(a, b);
                setJustMade(key);
              }}
            >
              <PiSparkleBold className="size-5" />
              <Text id={have ? "fusion.saved" : "fusion.fuse"} />
            </Button>
            {(justMade === key || have) && (
              <Text id="fusion.savedNote" vars={{ name: hybrid.name }} as="p" className="text-sm text-foreground-secondary" role="status" />
            )}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
