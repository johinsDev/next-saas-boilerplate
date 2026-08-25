import { LayoutDashboard, ShieldUser, Users, type LucideIcon } from "lucide-react";

/**
 * The admin's navigation, in one place.
 *
 * The sidebar draws it and the header reads the current page's name out of it.
 * Two lists would drift the day a section is renamed, and the failure is quiet:
 * a sidebar saying "Customers" above a header still saying "Users".
 *
 * It lists **only what exists**. A menu full of entries that go nowhere is
 * worse than a short one — it trains everybody to ignore the sidebar, and it
 * hides which parts of the product are actually built. Add an entry when its
 * screen lands, not when it is planned.
 */

export type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

export const SECTIONS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

/**
 * The one group with children.
 *
 * Two rosters that are obviously one subject: nesting them says so, and keeps
 * the top level from growing an entry per population. The parent is a
 * disclosure rather than a link — it has no page of its own, and inventing a
 * `/people` index that redirects would be a route that exists to be skipped.
 */
export const PEOPLE = {
  label: "People",
  icon: Users,
  items: [
    { href: "/staff", label: "Staff", icon: ShieldUser },
    { href: "/customers", label: "Customers", icon: Users },
  ] as readonly NavItem[],
} as const;

const ALL: readonly NavItem[] = [...SECTIONS, ...PEOPLE.items];

/** True when `pathname` is that route or somewhere beneath it. */
export function isWithin(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * What to call the page at `pathname`.
 *
 * Longest match wins, so `/staff/abc` is "Staff" rather than falling through.
 * Returns null for anything unlisted — the header renders nothing rather than
 * guessing a name from the URL, which is how you end up with a heading that
 * says "abc".
 */
export function titleFor(pathname: string | null): string | null {
  if (!pathname) return null;

  return (
    [...ALL]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => isWithin(pathname, item.href))?.label ?? null
  );
}
