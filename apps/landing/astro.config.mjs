// @ts-check
import { defineConfig } from "astro/config";

/**
 * Static marketing site, deployed on its own.
 *
 * Deliberately not Next: a marketing page is content, it changes on a different
 * cadence from the product, and it must stay fast on a phone over mobile data.
 * Astro ships zero JavaScript unless a component asks for it, which is the
 * whole reason to keep this separate rather than adding routes to `apps/web`.
 *
 * It shares design tokens with the apps and nothing else — no `@saas/ui`, which
 * is React and would drag a runtime into a page that does not need one.
 *
 * Tailwind is wired through PostCSS (see postcss.config.mjs), not the Vite
 * plugin.
 */
export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:3002",
});
