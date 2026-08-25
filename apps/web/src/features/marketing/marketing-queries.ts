import "server-only";

import { cacheLife, cacheTag } from "next/cache";

/**
 * Public reads.
 *
 * These take **no viewer argument at all**, which is the point: the result is
 * identical for every visitor, so one cache entry serves the whole internet.
 * That is what `'use cache'` is for, and it is why a public page must never
 * read the session to render its body — one `cookies()` call here would turn a
 * shared entry into a per-visitor one and quietly delete the benefit.
 *
 * Stand-in data. Replace the body with a service call; the shape around it is
 * what this file exists to demonstrate.
 */
export const PLANS_TAG = "plans";

export type Plan = {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly blurb: string;
};

export async function readPlans(): Promise<readonly Plan[]> {
  "use cache";
  // Pricing changes on a deploy or an edit, not on a request. `days` with a tag
  // means the page is served from cache until something actually changes it.
  cacheLife("days");
  cacheTag(PLANS_TAG);

  return [
    { id: "free", name: "Free", priceLabel: "$0", blurb: "Everything to get started." },
    { id: "team", name: "Team", priceLabel: "$29", blurb: "For a group that ships together." },
    { id: "scale", name: "Scale", priceLabel: "$99", blurb: "When usage stops being polite." },
  ];
}
