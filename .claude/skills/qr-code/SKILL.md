---
name: qr-code
description: A QR code for a link or any short text in a built app — "QR code for this link", scan to join, a share card, a sign-up poster, a printed tag, a ticket or table code. Load before drawing any QR code, and before adding a QR package or writing an encoder.
metadata:
  agents: [builder]
---

# QR codes

Every app already ships a QR encoder: `qrSvgPath(text)` from `~stencil/auth/qr`. It has no dependencies, runs in the browser and on the server, and returns `{ size, path }` — the dark modules as one SVG path in a `size`-unit square. **Never add a QR package and never write an encoder.** The file lives under `auth/` only because two-factor setup was its first caller; it encodes any text.

```tsx
import { qrSvgPath } from "~stencil/auth/qr";

function QrCode({ value, label }: { value: string; label: string }) {
  const { size, path } = qrSvgPath(value);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label={label} className="h-48 w-48"
      viewBox={`-4 -4 ${size + 8} ${size + 8}`} shapeRendering="crispEdges">
      <rect x={-4} y={-4} width={size + 8} height={size + 8} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
```

- **One `<svg>`, nothing else.** No canvas drawing, no `<img>` from an outside QR service, no logo over the middle.
- **Quiet zone.** The `-4 -4 size+8 size+8` viewBox leaves the 4 empty modules scanners need on every side. Keep it; CSS padding on a coloured card does not replace it.
- **Dark modules on a light background**, drawn as literal `fill` colours so a downloaded file looks the same as the screen. Use the app's brand colour for the modules only when it is dark enough to keep contrast high against white (about 7:1); otherwise stay black. Never light-on-dark.
- **Encode the full absolute URL** (`https://…`), built from the request origin in the loader, not a relative path. Shorter text gives bigger modules; `qrSvgPath` throws only when the text cannot fit any QR size (about 2,300 bytes).
- **Size.** At least 160 px on screen and 2 cm in print.

## Download and print

Save through `saveFile` from `~stencil/files` (the `file-export` skill), from a click handler:

- **SVG** — `saveFile(new Blob([new XMLSerializer().serializeToString(svgEl)], { type: "image/svg+xml" }), "qr-code.svg")`.
- **PNG** — load that same SVG Blob into an `Image` through `URL.createObjectURL`, draw it on a 1024 × 1024 `<canvas>` with `imageSmoothingEnabled = false`, then `canvas.toBlob` → `saveFile(blob, "qr-code.png")`. Revoke the object URL afterwards.
- **Print** — a poster, tag or ticket goes through the `print-to-pdf` skill, with the `<svg>` inside the print container and its size set in `cm`.

Barcodes and scanning a code with the camera are not covered here.
