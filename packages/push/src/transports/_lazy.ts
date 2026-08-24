/**
 * Imports a module by name without exposing the string literal to the
 * bundler. Turbopack / Webpack do constant propagation, so both
 *
 *   await import("web-push")
 *
 * and
 *
 *   const name = "web-push";
 *   await import(name)
 *
 * still get traced as static imports → "Module not found" warnings on
 * every dev compile when the optional peer dep isn't installed.
 *
 * Building the import body through the `Function` constructor produces
 * a dynamic-code closure that bundlers can't analyze. Cost is one
 * `new Function(...)` call per process (cached at module load).
 */
let importer: ((specifier: string) => Promise<unknown>) | undefined;

export function dynamicImport(specifier: string): Promise<unknown> {
  // Built lazily on first use: Cloudflare Workers forbid code-gen (`new
  // Function`) at module load, and the lean API Worker never calls this (the
  // optional SDK providers run in Node — Next apps + Trigger.dev jobs). See the
  // API-Worker plan.
  importer ??= new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<unknown>;
  return importer(specifier);
}
