import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeMessage } from "../../factories";
import { FolderTransport } from "../../transports/folder";

describe("FolderTransport", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "whatsapp-folder-"));
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
      fakeMessage({ to: "+5491155555555", content: "preview body" }),
    );

    expect(res.provider).toBe("folder");
    expect(res.providerMessageId).toBeTruthy();

    const id = res.providerMessageId!;
    const json = join(dir, `${id}.json`);
    const html = join(dir, `${id}.html`);
    expect(existsSync(json)).toBe(true);
    expect(existsSync(html)).toBe(true);

    const payload = JSON.parse(readFileSync(json, "utf8"));
    expect(payload.message.to).toBe("+5491155555555");
    expect(payload.message.content).toBe("preview body");
    expect(payload.response.provider).toBe("folder");

    const rendered = readFileSync(html, "utf8");
    expect(rendered).toContain("+5491155555555");
    expect(rendered).toContain("preview body");
  });

  it("escapes HTML in content", async () => {
    const transport = new FolderTransport({
      provider: "folder",
      outputDir: dir,
    });
    const res = await transport.send(
      fakeMessage({ content: "<script>alert(1)</script>" }),
    );
    const html = readFileSync(
      join(dir, `${res.providerMessageId}.html`),
      "utf8",
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
