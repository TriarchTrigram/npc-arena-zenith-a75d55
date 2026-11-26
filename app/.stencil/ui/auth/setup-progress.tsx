import type { SetupStep } from "../../types/setup";

/** The ordered steps of first-login setup: finished ones ticked, the current one marked. */
export function SetupProgress({
  steps,
  current,
  className,
}: {
  steps: SetupStep[];
  current: string;
  className?: string;
}) {
  const at = steps.findIndex((step) => step.id === current);
  return (
    <ol aria-label="Setup progress" className={className ?? "flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"}>
      {steps.map((step, i) => {
        const done = i < at;
        const active = i === at;
        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={active ? "flex items-center font-semibold" : "flex items-center text-muted-foreground"}
          >
            <span
              className={
                "mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs " +
                (done || active ? "border-primary bg-primary text-primary-foreground" : "border-border")
              }
            >
              {done ? "✓" : i + 1}
            </span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
