---
name: print-to-pdf
description: Printing and save-as-PDF from a built app — invoices, receipts, reports, statements, tickets, anything the app user needs on paper or as a file. Also thumbnails, previews and prints of something the app draws itself — a floor plan, diagram, seating chart, canvas or chart editor. Load before wiring any print button or PDF export, and whenever the brief asks for a thumbnail, preview or print of app-drawn content.
metadata:
  agents: [chat, builder]
---

# Print and save-as-PDF

When implementing any print or save-as-PDF feature, **always append the print container directly to `document.body`** — never render it inside the React tree. The standard print CSS pattern (`body > :not(.print-root) { display: none !important }`) hides all direct `<body>` children that don't have the class. If the print container is inside `#root`, the entire React tree gets hidden along with it and the page prints blank.

**Correct pattern:**

```tsx
function handlePrint(content: string) {
  const container = document.createElement('div');
  container.className = 'print-root';
  container.innerHTML = content;

  document.body.appendChild(container);

  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    document.body.removeChild(container);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
```

To render React components into the print container, use `ReactDOM.createRoot`:

```tsx
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

function handlePrint() {
  const container = document.createElement('div');
  container.className = 'print-root';
  document.body.appendChild(container);

  const root = createRoot(container);
  flushSync(() => root.render(<PrintLayout />));

  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    root.unmount();
    document.body.removeChild(container);
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
```

**Print CSS** — add `@media print` rules in the route file or a `<style>` tag:

```css
@media print {
  body > :not(.print-root) { display: none !important; }
  .print-root { display: block !important; }
  @page { margin: 0; }
}
```

Never call `document.body.removeChild` synchronously after `window.print()` — the print dialog is async. Always use the `afterprint` event for cleanup.

## Thumbnails, previews and prints of app-drawn content

When the app draws something itself — a floor plan, diagram, seating chart, canvas editor — a thumbnail, preview or print of it **reuses the component that draws it on screen**, in a read-only mode scaled to fit: no toolbars, no selection, no editing. Never write a second renderer for it, and never store a snapshot image of it. A copy drifts from the real editor and misses object types; the on-screen component already knows how to draw everything.

- Give the drawing component a `readOnly` (or similar) prop and a size, and let it render into any container at any scale.
- For print, render that same component into the `print-root` container above with `createRoot`.
- On a page with many thumbnails, render only the ones on screen (an `IntersectionObserver` or a virtualised list), not every drawing at once.
