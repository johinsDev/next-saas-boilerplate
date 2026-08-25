import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@saas/ui", "@saas/auth", "@saas/db", "@saas/services"],
  typedRoutes: true,
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: { position: "bottom-right" },
};

export default config;
