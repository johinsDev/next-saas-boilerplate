import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fakeMessage } from "../../factories";
import { FolderTransport } from "../../transports/folder";

describe("FolderTransport", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "email-folder-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes JSON + HTML preview files", async () => {
    const transport = new FolderTransport({
      provider: "folder",
      outputDir: dir,
    });
    const res = await transport.send(
      fakeMessage({
        to: ["lucia@example.com"],
        subject: "Bienvenida",
        html: "<h1>Bienvenida</h1>",
      }),
    );

    expect(res.provider).toBe("folder");
    expect(res.providerMessageId).toBeTruthy();

    const id = res.providerMessageId!;
    const json = join(dir, `${id}.json`);
    const html = join(dir, `${id}.html`);
    expect(existsSync(json)).toBe(true);
    expect(existsSync(html)).toBe(true);

    const payload = JSON.parse(readFileSync(json, "utf8"));
    expect(payload.message.to).toEqual(["lucia@example.com"]);
    expect(payload.message.subject).toBe("Bienvenida");

    const rendered = readFileSync(html, "utf8");
    expect(rendered).toContain("Bienvenida");
    expect(rendered).toContain("lucia@example.com");
    expect(rendered).toContain("iframe");
  });

  it("escapes HTML in metadata", async () => {
    const transport = new FolderTransport({
      provider: "folder",
      outputDir: dir,
    });
    const res = await transport.send(
      fakeMessage({ subject: "<script>alert(1)</script>" }),
    );
    const html = readFileSync(
      join(dir, `${res.providerMessageId}.html`),
      "utf8",
    );
    // The metadata <dt>Subject</dt> block must be escaped.
    expect(html).toContain("&lt;script&gt;");
  });

  it("falls back to text-only body when no html", async () => {
    const transport = new FolderTransport({
      provider: "folder",
      outputDir: dir,
    });
    const res = await transport.send(
      fakeMessage({ html: undefined, text: "plain text body" }),
    );
    const html = readFileSync(
      join(dir, `${res.providerMessageId}.html`),
      "utf8",
    );
    expect(html).toContain("plain text body");
    expect(html).toContain("<pre");
  });
});
