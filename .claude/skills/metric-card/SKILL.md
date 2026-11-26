---
name: metric-card
description: >
  KPI / stat cards showing a primary metric with label, large serif value, trend
  badge, and full-width sparkline. Use for dashboard summary rows, financial KPI
  strips, and analytics overview panels. Enforces tabular figures, semantic trend
  colors, and serif numerals.
metadata:
  agents: [builder]
---
Reference implementation — copy and adapt, do not reinvent.

## Hard rules

- **Value MUST use `font-display`** — the serif/display font. This is the #1 visual differentiator. `font-sans` on KPI numbers produces generic output.
- **Metric cards always appear as a connected strip**, not individual floating cards. The `gap-px bg-border` container lets the border color bleed through as hairline dividers. NEVER render metric cards with their own shadow, border, or border-radius.
- **The strip's column count follows its tile count.** `MetricStrip` below derives its columns from how many children it gets (one column on phones, then 2–5 matching the tiles), so four tiles never sit in three columns and five never in four. NEVER hand-write a `grid-cols-N` on the strip or copy a column count from another screen; an empty cell shows as a solid block of border colour. Pass the tiles directly or via `.map`, never inside a fragment — a fragment counts as one tile. A strip holds two to five tiles; six or more fall back to an even two-then-three-column grid, so split them into two strips.
- **NEVER add an icon or emblem to the label row.** Text only.
- **NEVER fabricate sparkline data.** No history → no sparkline. A missing chart is honest.

```tsx
import { Children, type ReactNode } from "react";

// when_to_use: KPI / stat strip — dashboard summary rows, financial KPI strips,
// analytics overviews. Always wrap MetricCards in MetricStrip, never in a grid of your own.

function Sparkline({ data, color, positive }) {
  if (!data || data.length < 2) return null;
  const W = 220,
    H = 28,
    pad = 2;
  const max = Math.max(...data),
    min = Math.min(...data);
  const range = Math.max(1, max - min);
  const step = (W - pad * 2) / (data.length - 1);
  const pts = data.map(
    (v, i) =>
      `${(pad + i * step).toFixed(1)},${(H - pad - ((v - min) / range) * (H - pad * 2)).toFixed(1)}`,
  );
  const path = `M${pts.join(" L")}`;
  return (
    <svg
      className="w-full mt-1.5"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      <path
        d={`${path} L${W - pad},${H} L${pad},${H} Z`}
        fill={color}
        fillOpacity={positive === null ? 0.04 : 0.08}
        stroke="none"
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// positive=true → success, positive=false → destructive, positive=null → muted
function MetricCard({
  label,
  period,
  value,
  unit,
  trendLabel,
  positive = null,
  sparkData,
}) {
  const trendCls =
    positive === true
      ? "text-success"
      : positive === false
        ? "text-destructive"
        : "text-muted-foreground";
  const sparkColor =
    positive === true
      ? "var(--success)"
      : positive === false
        ? "var(--destructive)"
        : "var(--muted-foreground)";
  const arrow = positive === true ? "↑" : positive === false ? "↓" : null;

  return (
    <div className="bg-card px-6 py-6 flex flex-col">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
        {period && <span className="opacity-70"> · {period}</span>}
      </p>

      <div className="flex items-baseline gap-1 mt-1">
        <span className="font-display text-[2.375rem] leading-none tracking-[-0.01em] text-foreground [font-variant-numeric:tabular-nums] font-features-['tnum']">
          {value}
        </span>
        {unit && (
          <span className="font-sans text-sm text-muted-foreground ml-0.5 [font-variant-numeric:tabular-nums] font-features-['tnum']">
            {unit}
          </span>
        )}
      </div>

      {trendLabel && (
        <p
          className={`text-xs font-medium mt-2 [font-variant-numeric:tabular-nums] ${trendCls}`}
        >
          {arrow && `${arrow} `}
          {trendLabel}
        </p>
      )}

      <Sparkline data={sparkData} color={sparkColor} positive={positive} />
    </div>
  );
}

// Literal class strings per tile count so Tailwind can find them; a five-tile strip
// runs two-up on tablets with the last tile spanning the row, so no cell is left empty.
const STRIP_COLS: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5 sm:[&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1",
};
// Six or more tiles: two columns, then three, which six fills exactly.
const STRIP_COLS_MANY = "sm:grid-cols-2 lg:grid-cols-3";

function MetricStrip({ children }: { children: ReactNode }) {
  // toArray drops null/false children and flattens arrays, so a conditional tile is not counted.
  const count = Children.toArray(children).length;
  return (
    <div
      className={`grid ${STRIP_COLS[count] ?? STRIP_COLS_MANY} gap-px bg-border border border-border rounded-xl overflow-hidden mb-7`}
    >
      {children}
    </div>
  );
}

// --- Usage example ---
// sparkData must come from real loader data — real DB records per time bucket.
// Omit sparkData when no history exists — the component renders nothing.

function MetricCardDemo() {
  return (
    <MetricStrip>
      <MetricCard
        label="Revenue"
        period="May"
        value="$24.8"
        unit="k"
        trendLabel="18% vs Apr"
        positive={true}
        sparkData={[18, 21, 19, 24, 22, 26, 23, 27, 25, 28, 26, 30]}
      />
      <MetricCard
        label="Won this month"
        value="$14.6"
        unit="k"
        trendLabel="2 deals"
        positive={true}
        sparkData={[8, 9, 10, 9, 11, 12, 10, 13, 12, 14, 13, 15]}
      />
      <MetricCard
        label="Outstanding"
        value="$11.2"
        unit="k"
        trendLabel="2 invoices · oldest 14d"
        positive={null}
        sparkData={[14, 13, 15, 12, 14, 12, 11, 12, 11, 11, 12, 11]}
      />
    </MetricStrip>
  );
}

Object.assign(window, { MetricStrip, MetricCard, MetricCardDemo });
ReactDOM.createRoot(document.getElementById("root")).render(<MetricCardDemo />);
```
