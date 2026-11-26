import type { PropsWithChildren, ReactNode } from "react";

/**
 * Soft plan lock. `unlocked` is the result of hasPlan() computed in the loader —
 * this component never decides who has a plan, it only renders the two states.
 */
export function PlanGate({
  unlocked,
  planName,
  feature,
  children,
  fallback,
}: PropsWithChildren<{
  unlocked: boolean;
  /** The lowest plan that unlocks the surface, e.g. tiers.pro.name. */
  planName: string;
  /** Short label for the locked thing, e.g. "Reels". */
  feature?: string;
  /** App-supplied locked state; the default card otherwise. */
  fallback?: ReactNode;
}>) {
  if (unlocked) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <p className="text-sm text-muted-foreground">
        {feature ? `${feature} is part of the ${planName} plan.` : `This is part of the ${planName} plan.`}
      </p>
      <a href="/upgrade" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Upgrade to unlock →
      </a>
    </div>
  );
}
