"use client";

import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { AnimatedSidebarTrigger } from "@saas/ui";

import { titleFor } from "./nav";

/**
 * The top bar: the sidebar toggle, then where you are.
 *
 * The name comes from the same list the sidebar draws, so a renamed section
 * cannot end up called one thing in the nav and another above the page. Pages
 * do not pass it — that would be a prop every new screen has to remember, and
 * forgetting is the failure mode that actually happens.
 *
 * It is a Client Component because `usePathname` is one. That is fine here and
 * would not be in the layout: this is a strip of chrome with no data in it, so
 * putting it on the client costs nothing that `cacheComponents` cares about.
 */
export function ShellHeader() {
  const title = titleFor(usePathname());

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      {/*
       * The icon is ours to pass. beUI's trigger renders a bare `<button>` and
       * spreads whatever children it is given — with none, it is a 40px
       * invisible target that toggles the sidebar when you happen to hit it.
       */}
      <AnimatedSidebarTrigger className="text-muted-foreground transition-colors hover:text-foreground">
        <PanelLeft aria-hidden className="size-4" />
      </AnimatedSidebarTrigger>

      {/*
       * A divider only when there is something to divide. On an unlisted route
       * the bar is just the toggle, and a rule hanging beside it would be
       * pointing at nothing.
       */}
      {title && (
        <>
          <span aria-hidden className="h-5 w-px bg-border" />
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        </>
      )}
    </header>
  );
}

/**
 * The same bar without the title, for the moment before the path resolves.
 *
 * Same height and the same first element, so the toggle does not move when the
 * name arrives.
 */
export function ShellHeaderSkeleton() {
  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-6"
      aria-hidden
    >
      <span className="size-10 rounded-xl bg-muted" />
    </header>
  );
}
