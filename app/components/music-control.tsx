import { useString } from "~stencil/ui/strings";
import { PiMusicNotesBold, PiMusicNotesMinusBold } from "react-icons/pi";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { cn } from "~/lib/utils";

/** Theme music mute button and volume slider, separate from the sound effects control. */
export function MusicControl({
  volume,
  muted,
  onVolume,
  onToggle,
  className,
}: {
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onToggle: () => void;
  className?: string;
}) {
  const groupAria = useString("arena.controls.musicAria");
  const muteAria = useString(muted ? "arena.controls.musicUnmute" : "arena.controls.musicMute");
  const volumeAria = useString("arena.controls.musicVolume");
  const off = muted || volume === 0;
  return (
    <div className={cn("flex items-center gap-2", className)} role="group" aria-label={groupAria}>
      <Button size="sm" variant={muted ? "secondary" : "outline"} onClick={onToggle} aria-label={muteAria} aria-pressed={muted}>
        {off ? <PiMusicNotesMinusBold className="size-5" /> : <PiMusicNotesBold className="size-5" />}
      </Button>
      <Slider
        className="w-28"
        min={0}
        max={100}
        step={5}
        value={[muted ? 0 : volume]}
        onValueChange={(v) => onVolume(v[0] ?? 0)}
        aria-label={volumeAria}
      />
    </div>
  );
}
