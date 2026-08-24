import { beforeEach, describe, expect, it } from "vitest";

import { InvalidUrlError, SlugUnavailableError } from "../errors";
import { ShortlinksManager } from "../manager";
import type { ShortlinkStore } from "../types";

/** In-memory store: slug → row, for the custom strategy under test. */
class FakeStore implements ShortlinkStore {
  rows = new Map<
    string,
    {
      slug: string;
      targetUrl: string;
      org: string;
      campaignId?: string;
      customerId?: string;
    }
  >();

  async findActiveByTarget(org: string, targetUrl: string) {
    for (const r of this.rows.values()) {
      if (r.org === org && r.targetUrl === targetUrl) return { slug: r.slug };
    }
    return null;
  }
  async slugExists(slug: string) {
    return this.rows.has(slug);
  }
  async create(input: {
    slug: string;
    targetUrl: string;
    organizationId: string;
    campaignId?: string;
    customerId?: string;
  }) {
    this.rows.set(input.slug, {
      slug: input.slug,
      targetUrl: input.targetUrl,
      org: input.organizationId,
      campaignId: input.campaignId,
      customerId: input.customerId,
    });
    return { slug: input.slug };
  }
}

const BASE = "https://l.t4diverclub.app";
const ORG = "org_1";

function manager(store: ShortlinkStore) {
  return new ShortlinksManager({
    default: "custom",
    providers: {
      null: { provider: "null" as const },
      custom: { provider: "custom" as const, store, baseUrl: BASE },
    },
  });
}

describe("custom provider", () => {
  let store: FakeStore;
  beforeEach(() => {
    store = new FakeStore();
  });

  it("shortens a URL to baseUrl/slug and persists it", async () => {
    const r = await manager(store).shorten("https://app.t4diverclub.app/card", {
      organizationId: ORG,
    });
    expect(r.shortUrl).toMatch(new RegExp(`^${BASE}/[0-9A-Za-z]{7}$`));
    expect(r.reused).toBe(false);
    expect(store.rows.size).toBe(1);
  });

  it("dedupes the same (org, target) to one slug", async () => {
    const m = manager(store);
    const a = await m.shorten("https://app.t4diverclub.app/card", {
      organizationId: ORG,
    });
    const b = await m.shorten("https://app.t4diverclub.app/card", {
      organizationId: ORG,
    });
    expect(b.slug).toBe(a.slug);
    expect(b.reused).toBe(true);
    expect(store.rows.size).toBe(1);
  });

  it("mints a fresh, attributed slug per recipient (skips dedupe)", async () => {
    const m = manager(store);
    const target = "https://app.t4diverclub.app/promo";
    const a = await m.shorten(target, {
      organizationId: ORG,
      campaignId: "camp_1",
      customerId: "cust_1",
    });
    const b = await m.shorten(target, {
      organizationId: ORG,
      campaignId: "camp_1",
      customerId: "cust_2",
    });
    // Same target, but NOT deduped — each recipient gets a distinct slug…
    expect(a.slug).not.toBe(b.slug);
    expect(a.reused).toBe(false);
    expect(b.reused).toBe(false);
    expect(store.rows.size).toBe(2);
    // …and the attribution is persisted.
    expect(store.rows.get(a.slug!)?.customerId).toBe("cust_1");
    expect(store.rows.get(b.slug!)?.customerId).toBe("cust_2");
  });

  it("honors a custom slug and rejects a taken one", async () => {
    const m = manager(store);
    const r = await m.shorten("https://x.test/promo", {
      organizationId: ORG,
      slug: "promo",
    });
    expect(r.shortUrl).toBe(`${BASE}/promo`);
    await expect(
      m.shorten("https://y.test/other", { organizationId: ORG, slug: "promo" }),
    ).rejects.toBeInstanceOf(SlugUnavailableError);
  });

  it("rejects a non-http URL", async () => {
    await expect(
      manager(store).shorten("ftp://nope", { organizationId: ORG }),
    ).rejects.toBeInstanceOf(InvalidUrlError);
  });
});

describe("null provider", () => {
  it("returns the original URL untouched", async () => {
    const m = new ShortlinksManager({
      default: "null",
      providers: { null: { provider: "null" as const } },
    });
    const url = "https://app.t4diverclub.app/very/long/path?x=1";
    const r = await m.shorten(url, { organizationId: ORG });
    expect(r.shortUrl).toBe(url);
    expect(r.slug).toBeNull();
  });
});

describe("fake mode", () => {
  it("records shortened calls + asserts", async () => {
    const m = manager(new FakeStore());
    const fake = m.fake();
    await m.shorten("https://app.t4diverclub.app/card", { organizationId: ORG });
    fake.assertShortenedCount(1).assertShortened((c) => c.url.endsWith("/card"));
    m.restore();
  });
});
