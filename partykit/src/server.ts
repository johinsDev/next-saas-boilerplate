import type * as Party from "partykit/server";

/**
 * PartyKit `main` entrypoint. Routing is handled by the `parties` map
 * in `partykit.json` — each named party (`user` and `organization`)
 * resolves to its own file. This default party is the catch-all for
 * any request to the root path; we only use it for a tiny health
 * check so monitoring + the deploy command have something to ping.
 */
export default class DefaultParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "GET") {
      return Response.json({
        ok: true,
        project: "saas-realtime",
        time: new Date().toISOString(),
      });
    }
    return new Response("method not allowed", { status: 405 });
  }
}
