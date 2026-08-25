import { Suspense } from "react";

import {
  WorkspaceCard,
  WorkspaceCardSkeleton,
} from "@/features/dashboard/components/workspace-card";

export const metadata = { title: "Dashboard · Admin" };

/**
 * The reference page.
 *
 * It composes and never fetches: the heading is synchronous so it prerenders
 * into the static shell, and the one data-dependent section suspends on its own
 * with a height-matched skeleton. A `<div>` rather than a `<main>` — the
 * sidebar inset already provides that landmark, and nesting a second one gives
 * a screen reader two "main" regions to choose between.
 *
 * `w-full` because `mx-auto` sets auto margins on the cross axis, and auto
 * cross-axis margins suppress a flex item's stretch: without it this sizes
 * itself to its content inside the inset instead of filling it.
 */
export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          The shape every screen in this app follows.
        </p>
      </header>

      <Suspense fallback={<WorkspaceCardSkeleton />}>
        <WorkspaceCard />
      </Suspense>
    </div>
  );
}
