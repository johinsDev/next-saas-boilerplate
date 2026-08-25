"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  AnimatedSidebar,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupContent,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarMenuSub,
  AnimatedSidebarMenuSubButton,
  AnimatedSidebarMenuSubItem,
  AnimatedSidebarRail,
} from "@saas/ui";

import { isWithin, PEOPLE, SECTIONS } from "./nav";

/**
 * The sidebar's links, as `next/link` rather than the plain `<a>` beUI renders.
 *
 * beUI is framework-agnostic, so `href` on a menu button is an anchor — a full
 * page load. That costs three things at once: client-side navigation, the
 * prefetch `partialPrefetching` sets up, and every provider's state above it
 * (the sidebar sprang back open on every click, which is how this was found).
 *
 * Module scope, not inside the component. `motion.create` returns a new
 * component type on every call, and a new type makes React unmount and remount
 * the entire subtree each render.
 */
const MotionLink = motion.create(Link);

export function ShellSidebar({ viewer }: { viewer: ReactNode }) {
  return (
    <AnimatedSidebar>
      <AnimatedSidebarHeader>
        <span className="flex items-center gap-2.5 px-2 py-1.5">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-black text-primary-foreground"
          >
            S
          </span>
          <span className="truncate text-base font-semibold tracking-tight text-foreground">
            Admin
          </span>
        </span>
      </AnimatedSidebarHeader>

      <AnimatedSidebarContent>
        <AnimatedSidebarGroup>
          <AnimatedSidebarGroupLabel>Workspace</AnimatedSidebarGroupLabel>
          <AnimatedSidebarGroupContent>
            {/*
             * `usePathname` is dynamic under `cacheComponents`, so reading it
             * would drag the whole sidebar out of the static shell. One
             * boundary around the list, with a fallback of the *same* items at
             * `activeHref=null`, keeps the shape identical — React reconciles
             * the resolved tree in place instead of swapping elements, so
             * nothing moves and nothing flashes.
             */}
            <Suspense fallback={<Sections activeHref={null} />}>
              <ActiveSections />
            </Suspense>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>
      </AnimatedSidebarContent>

      {/*
       * The viewer chip, passed in from the layout as a server-rendered slot.
       * The sidebar is a Client Component and the session is a server read, so
       * it arrives as `children` rather than being fetched here — that is what
       * keeps `getViewer` on the server and out of this bundle.
       */}
      <AnimatedSidebarFooter>{viewer}</AnimatedSidebarFooter>

      <AnimatedSidebarRail />
    </AnimatedSidebar>
  );
}

function ActiveSections() {
  const pathname = usePathname();
  return <Sections activeHref={pathname} />;
}

function Sections({ activeHref }: { activeHref: string | null }) {
  const within = (href: string) => isWithin(activeHref, href);

  const peopleActive = PEOPLE.items.some((item) => within(item.href));

  /*
   * Open when you are inside it, and openable when you are not. Seeded from the
   * path rather than defaulted shut, so landing on `/staff` from a link does
   * not show a collapsed group with no sign of where you are.
   */
  const [peopleOpen, setPeopleOpen] = useState(peopleActive);
  const open = peopleOpen || peopleActive;

  return (
    <AnimatedSidebarMenu>
      {SECTIONS.map(({ href, label, icon: Icon }) => (
        <AnimatedSidebarMenuItem key={href}>
          <AnimatedSidebarMenuButton
            href={href}
            linkAs={MotionLink}
            icon={<Icon aria-hidden className="size-4" />}
            isActive={within(href)}
          >
            {label}
          </AnimatedSidebarMenuButton>
        </AnimatedSidebarMenuItem>
      ))}

      <AnimatedSidebarMenuItem>
        <AnimatedSidebarMenuButton
          icon={<PEOPLE.icon aria-hidden className="size-4" />}
          // No `href`: the parent is a disclosure, not a destination.
          onSelect={() => setPeopleOpen((current) => !current)}
          // Passing `ariaExpanded` at all is what makes the component draw
          // its own disclosure chevron and rotate it. A `badge` chevron here
          // would be a second one beside it.
          ariaExpanded={open}
          // Active when a child is, so a collapsed group still shows you are
          // somewhere inside it.
          isActive={peopleActive && !open}
        >
          {PEOPLE.label}
        </AnimatedSidebarMenuButton>

        <AnimatedSidebarMenuSub open={open}>
          {PEOPLE.items.map(({ href, label, icon: Icon }) => (
            <AnimatedSidebarMenuSubItem key={href}>
              <AnimatedSidebarMenuSubButton
                href={href}
                linkAs={MotionLink}
                icon={<Icon aria-hidden className="size-3.5" />}
                isActive={within(href)}
              >
                {label}
              </AnimatedSidebarMenuSubButton>
            </AnimatedSidebarMenuSubItem>
          ))}
        </AnimatedSidebarMenuSub>
      </AnimatedSidebarMenuItem>
    </AnimatedSidebarMenu>
  );
}
