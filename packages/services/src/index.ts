/**
 * The service layer.
 *
 * Every caller that needs data goes through here: the Next.js apps import it
 * directly and run it in process, and the Hono API calls the same functions
 * behind HTTP for clients that are not our server.
 *
 * `server-only` makes "a client component imported a service" a build error
 * instead of a runtime data leak.
 */
import "server-only";

export * from "./features/organizations";
