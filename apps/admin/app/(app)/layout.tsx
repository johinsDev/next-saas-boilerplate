import { Suspense, type ReactNode } from "react";
import { AnimatedSidebarInset, AnimatedSidebarProvider } from "@saas/ui";

import {
  Gate,
  GateFallback,
  ViewerBadge,
  ViewerBadgeSkeleton,
} from "@/features/auth/viewer-badge";
import { ShellHeader, ShellHeaderSkeleton } from "@/features/shell/shell-header";
import { ShellSidebar } from "@/features/shell/shell-sidebar";
import { ImpersonationBar } from "@/features/users/components/impersonation-bar";

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
      {/*
       * The viewer chip is passed as a slot rather than fetched inside the
       * sidebar. The sidebar is a Client Component; the session is a server
       * read. Composing them this way keeps `getViewer` on the server and out
       * of the client bundle, and keeps its boundary here with the others.
       */}
      <ShellSidebar
        viewer={
          <Suspense fallback={<ViewerBadgeSkeleton />}>
            <ViewerBadge />
          </Suspense>
        }
      />

      <AnimatedSidebarInset>
        {/*
         * Above the header, and in the layout rather than on any one page:
         * impersonation follows you everywhere, so the reminder has to too.
         * Its own boundary with no fallback — an empty band is the honest
         * placeholder, since the ordinary case renders nothing at all and a
         * skeleton would announce a warning that never arrives.
         */}
        <Suspense fallback={null}>
          <ImpersonationBar />
        </Suspense>

        {/*
         * `usePathname` is dynamic under `cacheComponents`, so the header sits
         * behind its own boundary — same shape, minus the title, so the toggle
         * does not move when the name lands.
         */}
        <Suspense fallback={<ShellHeaderSkeleton />}>
          <ShellHeader />
        </Suspense>

        <Suspense fallback={<GateFallback />}>
          <Gate>{children}</Gate>
        </Suspense>
      </AnimatedSidebarInset>
    </AnimatedSidebarProvider>
  );
}
