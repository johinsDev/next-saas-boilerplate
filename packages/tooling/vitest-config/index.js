/**
 * Shared base Vitest config for every internal package.
 *
 * ```ts
 * import { defineConfig } from "vitest/config";
 * import { baseConfig } from "@saas/vitest-config";
 *
 * export default defineConfig(baseConfig());
 * ```
 *
 * @param {import("vitest/config").UserConfig} [overrides]
 * @returns {import("vitest/config").UserConfig}
 */
export function baseConfig(overrides = {}) {
  const baseTest = {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "src/**/__tests__/**/*.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.turbo/**", "**/.next/**"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts", "src/**/__tests__/**", "src/index.ts"],
    },
  };

  return {
    ...overrides,
    test: {
      ...baseTest,
      ...overrides.test,
      coverage: { ...baseTest.coverage, ...overrides.test?.coverage },
    },
  };
}
