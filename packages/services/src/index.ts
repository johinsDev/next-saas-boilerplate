/**
 * The service layer.
 *
 * Every caller that needs data goes through here: the Next.js apps import it
 * and run it in process, and the Hono API calls the same functions behind HTTP
 * for clients that are not our server.
 *
 * There is deliberately no `import "server-only"` here. That guard is a Next.js
 * construct and it throws anywhere React is not — including inside the Worker
 * and in a plain test run. It belongs one layer up, in each app's
 * `<domain>-queries.ts`, which is where a client/server boundary actually
 * exists. See the `architecture-guard` skill.
 */

export * from "./features/_shared/errors";
export * from "./features/organizations";
