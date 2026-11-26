import { Children, type ReactNode } from "react";
import { cn } from "~/lib/utils";

// NPC Arena design language: cream arena floor, ink outlines, chunky radii, hard drop shadows.

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12">{children}</div>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-3 inline-flex rounded-full border-2 border-border-strong bg-highlight px-3 py-0.5 text-xs font-extrabold uppercase tracking-[0.1em] text-highlight-foreground shadow-sm">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-4xl leading-[1.15] tracking-[-0.02em] text-balance text-foreground">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-prose text-base text-foreground-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-2xl leading-[1.2] text-foreground">{title}</h2>
      {action ? <div className="shrink-0 text-sm font-bold text-muted-foreground hover:text-foreground">{action}</div> : null}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border-2 border-border-strong bg-card text-card-foreground shadow-md", className)}>
      {children}
    </div>
  );
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4 sm:p-6", className)}>{children}</div>;
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: "bg-muted", dot: "bg-muted-foreground" },
  info: { box: "bg-primary-muted", dot: "bg-primary" },
  success: { box: "bg-success/20", dot: "bg-success" },
  warning: { box: "bg-warning/25", dot: "bg-warning" },
  danger: { box: "bg-error/15", dot: "bg-error" },
};

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-border-strong px-2.5 py-0.5 text-xs font-extrabold text-foreground", TONES[tone].box)}>
      <span aria-hidden className={cn("size-2 rounded-full border border-border-strong", TONES[tone].dot)} />
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-border-strong bg-background-secondary px-6 py-12 text-center">
      <span aria-hidden className="mb-6 flex gap-2">
        <span className="size-4 rounded-full border-2 border-border-strong bg-highlight" />
        <span className="size-4 rounded-full border-2 border-border-strong bg-primary" />
        <span className="size-4 rounded-full border-2 border-border-strong bg-success" />
      </span>
      <h3 className="font-display text-2xl leading-[1.2] text-balance text-foreground">{title}</h3>
      {body ? <p className="mt-2 max-w-prose text-base text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

// Literal class strings per tile count so Tailwind can find them.
const STRIP_COLS: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5 sm:[&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1",
};
const STRIP_COLS_MANY = "sm:grid-cols-2 lg:grid-cols-3";

export function MetricStrip({ children }: { children: ReactNode }) {
  const count = Children.toArray(children).length;
  return (
    <div className={cn("mb-6 grid gap-0.5 overflow-hidden rounded-xl border-2 border-border-strong bg-border-strong shadow-md", STRIP_COLS[count] ?? STRIP_COLS_MANY)}>
      {children}
    </div>
  );
}

export function Metric({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col bg-card px-6 py-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl font-(--font-weight-display) leading-[1.15] tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
