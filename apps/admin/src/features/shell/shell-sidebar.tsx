"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
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
  AnimatedSidebarRail,
  ThemeToggle,
} from "@saas/ui";

/**
 * The sidebar's links, as `next/link` rather than the plain `<a>` beUI renders.
 *
 * beUI is framework-agnostic, so `href` on a menu button is an anchor — a full
 * page load. That costs three things at once: client-side navigation, the
 * prefetch `partialPrefetching` sets up, and every provider's state above it
 * (the sidebar springs back open on every click, which is how it was noticed).
 *
 * Module scope, not inside the component. `motion.create` returns a new
 * component type on every call, and a new type makes React unmount and remount
 * the entire subtree each render.
 */
const MotionLink = motion.create(Link);

/**
 * The admin's navigation.
 *
 * It lists **only what exists**. A menu full of entries that go nowhere is
 * worse than a short one: it trains everybody to ignore the sidebar, and it
 * hides which parts of the product are actually built.
 */
const SECTIONS = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] as const;

export function ShellSidebar() {
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
             * `isActive=false`, keeps the shape identical — React reconciles
             * the resolved tree in place instead of swapping elements, so
             * nothing moves and nothing flashes.
             */}
            <Suspense fallback={<Sections activeHref={null} />}>
              <ActiveSections />
            </Suspense>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>
      </AnimatedSidebarContent>

      <AnimatedSidebarFooter>
        <span className="flex items-center gap-2 px-2 py-1.5">
          <ThemeToggle />
          <span className="truncate text-xs text-muted-foreground">Appearance</span>
        </span>
      </AnimatedSidebarFooter>

      <AnimatedSidebarRail />
    </AnimatedSidebar>
  );
}

function ActiveSections() {
  const pathname = usePathname();
  return <Sections activeHref={pathname} />;
}

function Sections({ activeHref }: { activeHref: string | null }) {
  return (
    <AnimatedSidebarMenu>
      {SECTIONS.map(({ href, label, icon: Icon }) => (
        <AnimatedSidebarMenuItem key={href}>
          <AnimatedSidebarMenuButton
            href={href}
            linkAs={MotionLink}
            icon={<Icon aria-hidden className="size-4" />}
            // `startsWith` so a future `/members/<id>` still lights its section.
            isActive={activeHref === href || (activeHref?.startsWith(`${href}/`) ?? false)}
          >
            {label}
          </AnimatedSidebarMenuButton>
        </AnimatedSidebarMenuItem>
      ))}
    </AnimatedSidebarMenu>
  );
}
