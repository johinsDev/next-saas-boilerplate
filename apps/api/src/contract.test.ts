import { describe, expect, expectTypeOf, test } from "vitest";
import { hc } from "hono/client";
import type { AppType } from "./index";

/*
 * The contract is inferred from the route chain in `index.ts`. A route declared
 * outside that chain still serves traffic but vanishes from the client's type,
 * and nothing else in the codebase would notice. This is the check that does.
 */
describe("the typed client", () => {
  const api = hc<AppType>("http://localhost");

  test("knows the routes the app actually mounts", () => {
    expectTypeOf(api.health.$get).toBeFunction();
    expectTypeOf(api.organizations[":id"].settings.$get).toBeFunction();
  });

  test("builds the URL a caller would hit, from the type alone", () => {
    expect(api.organizations[":id"].settings.$url({ param: { id: "org_1" } }).pathname).toBe(
      "/organizations/org_1/settings",
    );
  });
});
