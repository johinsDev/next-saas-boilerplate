"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

type HoverPrefetchLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

/**
 * A link that only asks the server for its own data once you look like you mean
 * it.
 *
 * The problem it solves is specific to long lists. Under `partialPrefetching`,
 * the three `prefetch` values are not "off / on / more":
 *
 * - `null` (the default) fetches the destination's **App Shell** — one per
 *   route, shared by every link pointing at it. Cheap, and worth having.
 * - `true` additionally resolves that link's own `params`/`searchParams`, which
 *   means **a server invocation per link**. A fifty-row table with
 *   `prefetch={true}` on each row is fifty invocations on one scroll.
 * - `false` gives up the shared App Shell too, which is throwing away the part
 *   that was free.
 *
 * So this starts at the default and escalates to `true` on hover or focus —
 * never below it. Focus matters as much as hover: a keyboard user tabbing down
 * the table should get the same head start as somebody with a mouse.
 *
 * Use it for rows in a list. Fixed navigation with a handful of destinations —
 * the sidebar — can just pass `prefetch` directly.
 */
export function HoverPrefetchLink({ children, ...props }: HoverPrefetchLinkProps) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? true : null}
      // One-way: once escalated it stays there. Dropping back on mouse-leave
      // would discard a prefetch that has probably already landed, and would
      // re-request it if the pointer crossed the row twice.
      onMouseEnter={() => setIntent(true)}
      onFocus={() => setIntent(true)}
      onTouchStart={() => setIntent(true)}
    >
      {children}
    </Link>
  );
}
