import { Suspense } from "react";

import { Plans, PlansSkeleton } from "@/features/marketing/components/plans";

/**
 * A public page, readable by anyone.
 *
 * Everything outside the boundary is synchronous, so it prerenders and is
 * served from the shell — which is what makes this page cheap and indexable.
 * Nothing here reads the session: the header's account slot does that, in its
 * own boundary, so an anonymous visitor and a signed-in one get the same static
 * HTML with a different chip streamed into it.
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Everything you need, already wired
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          Auth, database, email, jobs and realtime — behind ports you can swap, with the
          conventions settled before the first line of product code.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-foreground">Plans</h2>
        <Suspense fallback={<PlansSkeleton />}>
          <Plans />
        </Suspense>
      </section>
    </div>
  );
}
