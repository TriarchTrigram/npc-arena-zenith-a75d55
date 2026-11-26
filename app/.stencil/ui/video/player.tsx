import { useState } from "react";
import type { ComponentProps } from "react";

export interface VideoPlayerProps extends ComponentProps<"video"> {
  /** The video URL — a stored file served by the app's own file route. */
  src: string;
  /** URL of the WebVTT caption file, usually the video's `captionKeyFor` key
   *  served by the same route. Omit or pass null when the app has none yet:
   *  the player then shows no captions control and nothing else changes. */
  captions?: string | null;
  /** Name shown in the browser's captions menu. */
  captionsLabel?: string;
  /** Language of the captions as an ISO 639-1 code. */
  captionsLang?: string;
  /** Start with captions showing. Default true: an app user who cannot hear
   *  the video gets the text without hunting for the switch. */
  captionsOn?: boolean;
}

/** A <video> for platform-hosted files with its caption track attached; the
 *  browser's own controls carry the captions switch. A caption URL that fails to
 *  load drops the track quietly instead of leaving a dead control. */
export function VideoPlayer({
  src,
  captions,
  captionsLabel = "Captions",
  captionsLang = "en",
  captionsOn = true,
  children,
  ...videoProps
}: VideoPlayerProps) {
  const [failedTrack, setFailedTrack] = useState<string | null>(null);
  const track = captions && captions !== failedTrack ? captions : null;

  return (
    <video controls playsInline preload="metadata" {...videoProps} src={src}>
      {track && (
        <track
          kind="captions"
          src={track}
          srcLang={captionsLang}
          label={captionsLabel}
          default={captionsOn}
          onError={() => setFailedTrack(track)}
        />
      )}
      {children}
    </video>
  );
}
