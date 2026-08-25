import { readPlans } from "../marketing-queries";

/**
 * A public, fully cacheable section: no session, no request data, one entry
 * shared by every visitor.
 */
export async function Plans() {
  const plans = await readPlans();

  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {plans.map((plan) => (
        <li key={plan.id} className="flex flex-col gap-2 rounded-xl border border-border p-5">
          <span className="text-sm font-semibold text-foreground">{plan.name}</span>
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {plan.priceLabel}
          </span>
          <span className="text-sm leading-relaxed text-muted-foreground">{plan.blurb}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlansSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_unused, index) => (
        <li key={index} className="flex flex-col gap-3 rounded-xl border border-border p-5">
          <span className="h-4 w-16 animate-pulse rounded bg-muted" />
          <span className="h-9 w-20 animate-pulse rounded bg-muted" />
          <span className="h-4 w-full animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}
