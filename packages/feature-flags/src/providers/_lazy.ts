/**
 * Function-constructor wrapper around `import()` so the bundler can't
 * statically trace the specifier — keeps the optional provider deps
 * (`posthog-node`, `posthog-js`) out of the build graph unless the
 * matching provider is actually selected at runtime.
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
