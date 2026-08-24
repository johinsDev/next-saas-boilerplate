import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileNotFoundError, ProviderError } from "../../errors";
import { R2FetchProvider } from "../../providers/r2-fetch";

const baseConfig = {
  accountId: "acct123",
  accessKeyId: "AKIAFAKE",
  secretAccessKey: "secretfake",
  bucket: "uploads",
};

function makeProvider(overrides: Partial<typeof baseConfig & { publicUrl: string }> = {}) {
  return new R2FetchProvider({ ...baseConfig, ...overrides });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("R2FetchProvider", () => {
  it("has a stable `name` of 'r2'", () => {
    expect(makeProvider().name).toBe("r2");
  });

  describe("getPublicUrl", () => {
    it("returns null when no publicUrl configured", () => {
      expect(makeProvider().getPublicUrl("a.txt")).toBeNull();
    });

    it("joins publicUrl + key", () => {
      const p = makeProvider({ publicUrl: "https://cdn.example.com" });
      expect(p.getPublicUrl("avatars/lucia.png")).toBe(
        "https://cdn.example.com/avatars/lucia.png",
      );
    });

    it("strips trailing slash from publicUrl", () => {
      const p = makeProvider({ publicUrl: "https://cdn.example.com/" });
      expect(p.getPublicUrl("a.png")).toBe("https://cdn.example.com/a.png");
    });
  });

  describe("putSignedUrl", () => {
    it("returns a signed PUT URL with X-Amz-Signature + X-Amz-Expires and the right shape", async () => {
      const before = Date.now();
      const result = await makeProvider().putSignedUrl("avatars/lucia.png", {
        contentType: "image/png",
        expiresIn: 600,
      });
      expect(result.method).toBe("PUT");
      expect(result.key).toBe("avatars/lucia.png");
      expect(result.headers).toEqual({ "content-type": "image/png" });
      const url = new URL(result.url);
      expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
      expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
      expect(url.pathname).toBe("/uploads/avatars/lucia.png");
      const expiresAt = new Date(result.expiresAt).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + 600 * 1000);
      // signing must not have hit the network
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("defaults expiry to 300s", async () => {
      const result = await makeProvider().putSignedUrl("a.png", {
        contentType: "image/png",
      });
      expect(new URL(result.url).searchParams.get("X-Amz-Expires")).toBe("300");
    });
  });

  describe("getSignedUrl", () => {
    it("returns a signed GET URL with a signature + expiry", async () => {
      const url = await makeProvider().getSignedUrl("docs/a b.pdf", 120);
      const parsed = new URL(url);
      expect(parsed.searchParams.get("X-Amz-Signature")).toBeTruthy();
      expect(parsed.searchParams.get("X-Amz-Expires")).toBe("120");
      // each path segment encoded, slashes preserved
      expect(parsed.pathname).toBe("/uploads/docs/a%20b.pdf");
    });
  });

  describe("put", () => {
    it("PUTs bytes to the object URL with content-type + x-amz-meta-*", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
      const file = await makeProvider().put("k/file.txt", "hello", {
        contentType: "text/plain",
        metadata: { owner: "lucia" },
      });
      expect(file).toMatchObject({
        key: "k/file.txt",
        size: 5,
        contentType: "text/plain",
        metadata: { owner: "lucia" },
      });
      expect(file.lastModified).toBeInstanceOf(Date);

      const req = fetchMock.mock.calls[0]![0] as Request;
      expect(req.method).toBe("PUT");
      expect(req.url).toContain(
        "https://acct123.r2.cloudflarestorage.com/uploads/k/file.txt",
      );
      expect(req.headers.get("content-type")).toBe("text/plain");
      expect(req.headers.get("x-amz-meta-owner")).toBe("lucia");
    });

    it("throws ProviderError on a non-ok response", async () => {
      fetchMock.mockResolvedValue(new Response("nope", { status: 403 }));
      await expect(
        makeProvider().put("k.txt", "hi", { contentType: "text/plain" }),
      ).rejects.toBeInstanceOf(ProviderError);
    });
  });

  describe("get", () => {
    it("GETs and builds a StorageFile from response headers", async () => {
      fetchMock.mockResolvedValue(
        new Response("body-bytes", {
          status: 200,
          headers: {
            "content-type": "text/plain",
            "content-length": "10",
            "last-modified": "Wed, 21 Oct 2015 07:28:00 GMT",
            "x-amz-meta-owner": "lucia",
          },
        }),
      );
      const { body, file } = await makeProvider().get("k.txt");
      expect(new TextDecoder().decode(body)).toBe("body-bytes");
      expect(file).toMatchObject({
        key: "k.txt",
        size: 10,
        contentType: "text/plain",
        metadata: { owner: "lucia" },
      });
      expect(file.lastModified).toBeInstanceOf(Date);
      const req = fetchMock.mock.calls[0]![0] as Request;
      expect(req.method).toBe("GET");
    });

    it("maps 404 to FileNotFoundError", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
      await expect(makeProvider().get("missing.txt")).rejects.toBeInstanceOf(
        FileNotFoundError,
      );
    });
  });

  describe("head", () => {
    it("HEADs and builds a StorageFile", async () => {
      fetchMock.mockResolvedValue(
        new Response(null, {
          status: 200,
          headers: { "content-type": "image/png", "content-length": "42" },
        }),
      );
      const file = await makeProvider().head("a.png");
      expect(file).toMatchObject({ key: "a.png", size: 42, contentType: "image/png" });
      const req = fetchMock.mock.calls[0]![0] as Request;
      expect(req.method).toBe("HEAD");
    });

    it("returns null on 404", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
      expect(await makeProvider().head("missing.png")).toBeNull();
    });
  });

  describe("delete", () => {
    it("DELETEs and treats 204 as success", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      await expect(makeProvider().delete("k.txt")).resolves.toBeUndefined();
      const req = fetchMock.mock.calls[0]![0] as Request;
      expect(req.method).toBe("DELETE");
    });

    it("treats 404 as success (idempotent)", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
      await expect(makeProvider().delete("gone.txt")).resolves.toBeUndefined();
    });

    it("throws ProviderError on other failures", async () => {
      fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
      await expect(makeProvider().delete("k.txt")).rejects.toBeInstanceOf(
        ProviderError,
      );
    });
  });

  describe("list", () => {
    it("parses the S3 XML response into files + cursor", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Contents>
    <Key>avatars/a&amp;b.png</Key>
    <Size>123</Size>
    <LastModified>2015-10-21T07:28:00.000Z</LastModified>
  </Contents>
  <Contents>
    <Key>avatars/c.png</Key>
    <Size>456</Size>
    <LastModified>2016-01-01T00:00:00.000Z</LastModified>
  </Contents>
  <NextContinuationToken>next-page-token</NextContinuationToken>
</ListBucketResult>`;
      fetchMock.mockResolvedValue(new Response(xml, { status: 200 }));
      const result = await makeProvider().list({ prefix: "avatars/", limit: 2 });
      expect(result.cursor).toBe("next-page-token");
      expect(result.files).toEqual([
        {
          key: "avatars/a&b.png",
          size: 123,
          lastModified: new Date("2015-10-21T07:28:00.000Z"),
        },
        {
          key: "avatars/c.png",
          size: 456,
          lastModified: new Date("2016-01-01T00:00:00.000Z"),
        },
      ]);

      const req = fetchMock.mock.calls[0]![0] as Request;
      const url = new URL(req.url);
      expect(url.pathname).toBe("/uploads");
      expect(url.searchParams.get("list-type")).toBe("2");
      expect(url.searchParams.get("prefix")).toBe("avatars/");
      expect(url.searchParams.get("max-keys")).toBe("2");
    });

    it("returns an empty list + null cursor when there are no Contents", async () => {
      fetchMock.mockResolvedValue(
        new Response(`<ListBucketResult></ListBucketResult>`, { status: 200 }),
      );
      const result = await makeProvider().list();
      expect(result).toEqual({ files: [], cursor: null });
    });

    it("passes the continuation token from options.cursor", async () => {
      fetchMock.mockResolvedValue(
        new Response(`<ListBucketResult></ListBucketResult>`, { status: 200 }),
      );
      await makeProvider().list({ cursor: "tok-abc" });
      const req = fetchMock.mock.calls[0]![0] as Request;
      expect(new URL(req.url).searchParams.get("continuation-token")).toBe(
        "tok-abc",
      );
    });
  });
});
