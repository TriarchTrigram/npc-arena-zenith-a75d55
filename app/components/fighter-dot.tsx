import { cn } from "~/lib/utils";
import type { FighterDef } from "~/lib/fighters";

/** A fighter's colour swatch. A hybrid's is split down the middle: its first parent's colour and its second's glow. */
export function FighterDot({ def, className }: { def: FighterDef; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-3 shrink-0 rounded-full border-2 border-foreground", className)}
      style={{
        background: def.parents ? `linear-gradient(90deg, ${def.color} 50%, ${def.glow} 50%)` : def.body ?? def.color,
        ...(def.outline && !def.parents ? { borderColor: def.outline } : {}),
      }}
    />
  );
}
