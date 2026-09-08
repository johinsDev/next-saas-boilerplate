/**
 * Tailwind through PostCSS, not through `@tailwindcss/vite`.
 *
 * The vite plugin types itself against whichever Vite it resolves, and this
 * workspace has two: vitest pins v5 at the root, Astro needs v6 and nests its
 * own. The plugin resolved the root's, so `astro check` rejected a plugin that
 * built fine — two structurally identical types from different copies of the
 * same package. PostCSS has no such coupling; the build cost is a few ms.
 */
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
