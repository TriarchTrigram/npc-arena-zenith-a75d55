/** The query the seller helpers redirect with when an app user holds no plan. */
export const SELLER_NEEDS_PLAN_REASON = "seller-needs-plan";

/** True when this URL's search string is a seller sent here for want of a plan. */
export function isSellerPlanRedirect(search: string): boolean {
  return new URLSearchParams(search).get("reason") === SELLER_NEEDS_PLAN_REASON;
}

// The app's own upgrade page may say nothing about selling, so the platform shows the
// reason itself rather than leaving the app user on a pricing page with no explanation.
export function SellerPlanNotice({ shown }: { shown: boolean }) {
  if (!shown) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
    >
      <div className="pointer-events-auto max-w-md rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg">
        <p className="m-0 font-medium">Selling needs an active plan.</p>
        <p className="m-0 mt-1 text-foreground-secondary">
          Choose a plan here, then set up payments to start selling.
        </p>
      </div>
    </div>
  );
}
