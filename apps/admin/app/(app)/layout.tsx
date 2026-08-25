import { Suspense, type ReactNode } from "react";
import { AnimatedSidebarInset, AnimatedSidebarProvider, AnimatedSidebarTrigger } from "@saas/ui";

import { Gate, GateFallback, ViewerBadge, ViewerBadgeSkeleton } from "@/features/auth/viewer-badge";
import { ShellSidebar } from "@/features/shell/shell-sidebar";

/**
 * Everything under this layout is staff-only.
 *
 * The guard sits in the layout rather than in each page so a new screen is
 * protected by where it is filed, not by remembering to add a line. Forgetting
 * is the failure mode that actually happens.
 *
 * The layout itself is **synchronous**, and that is the whole trick under
 * `cacheComponents`. An `await` up here would make the entire admin dynamic and
 * there would be no static shell at all — the chrome would wait on the session
 * before painting a single pixel. Instead the chrome is plain synchronous JSX
 * that prerenders, and the two things that genuinely need to know who you are
 * sit behind their own Suspense boundaries.
 *
 * The providers are Client Components wrapping server `children`. That
 * composition is the point: they stay mounted across navigations, so the
 * sidebar keeps its collapsed state and the theme never re-flashes, while
 * everything inside them is still rendered on the server.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AnimatedSidebarProvider>
      <ShellSidebar />

      <AnimatedSidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4 sm:px-6">
          <AnimatedSidebarTrigger />

          <div className="grow" />

          {/*
           * Its own boundary. Who you are is worth knowing but not worth
           * waiting for — sharing the gate's boundary would hold the whole page
           * for an avatar.
           */}
          <Suspense fallback={<ViewerBadgeSkeleton />}>
            <ViewerBadge />
          </Suspense>
        </header>

        <Suspense fallback={<GateFallback />}>
          <Gate>{children}</Gate>
        </Suspense>
      </AnimatedSidebarInset>
    </AnimatedSidebarProvider>
  );
}
