import type { NextConfig } from "next";

const config: NextConfig = {
  // The workspace packages ship raw TypeScript, so Next has to compile them
  // like app source rather than expecting a build step.
  transpilePackages: ["@saas/ui", "@saas/auth", "@saas/db", "@saas/services"],
  typedRoutes: true,

  // Static shell + dynamic holes. Every async read now has to sit inside a
  // `<Suspense>` or carry a cache directive, and the build fails otherwise —
  // which is the point: it turns "this page is accidentally dynamic" from an
  // invisible cost into an error.
  cacheComponents: true,

  // A visible `<Link>` prefetches the destination's App Shell, one per route and
  // shared across links to it. Per-link prefetching stays opt-in, because
  // `prefetch={true}` on a fifty-row table is fifty server invocations on
  // scroll.
  partialPrefetching: true,

  // The dev indicator's default corner is `bottom-left`, which is exactly where
  // the sidebar footer puts the theme toggle — it covers the control and eats
  // the click.
  devIndicators: { position: "bottom-right" },
};

export default config;
