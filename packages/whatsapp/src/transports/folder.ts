import { exec } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cwd } from "node:process";
import type {
  FolderProviderConfig,
  WhatsAppMessageData,
  WhatsAppPreview,
  WhatsAppResponse,
  WhatsAppTransport,
} from "../types";

/**
 * Local-dev transport that writes each send to a folder as JSON + a
 * WhatsApp-like HTML preview. Useful when you want to *see* how the
 * message would look without firing Twilio.
 *
 * Default folder is `.whatsapp-previews/` next to `process.cwd()`,
 * configurable via `outputDir`. Set `openInBrowser: true` to auto-open
 * the HTML on each send (off by default; CI/PROD skip it regardless).
 */
export class FolderTransport implements WhatsAppTransport {
  readonly name = "folder";
  readonly #config: FolderProviderConfig;

  constructor(config: FolderProviderConfig) {
    this.#config = config;
  }

  async send(message: WhatsAppMessageData): Promise<WhatsAppResponse> {
    const id = crypto.randomUUID();
    const response: WhatsAppResponse = {
      status: "sent",
      providerMessageId: id,
      provider: this.name,
      timestamp: new Date().toISOString(),
    };

    const preview: WhatsAppPreview = {
      id,
      message,
      response,
      sentAt: response.timestamp,
    };

    const dir = resolve(cwd(), this.#config.outputDir ?? ".whatsapp-previews");
    mkdirSync(dir, { recursive: true });

    const jsonPath = join(dir, `${id}.json`);
    const htmlPath = join(dir, `${id}.html`);
    writeFileSync(jsonPath, JSON.stringify(preview, null, 2));
    writeFileSync(htmlPath, renderHtml(preview));

    if (
      this.#config.openInBrowser &&
      process.env.NODE_ENV !== "production" &&
      !process.env.CI
    ) {
      const cmd =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      exec(`${cmd} "${htmlPath}"`, () => {});
    }

    return response;
  }
}

function renderHtml(preview: WhatsAppPreview): string {
  const m = preview.message;
  const safe = (s: string) =>
    s.replace(/[&<>"']/g, (c) => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[c] ?? c;
    });
  const body = safe(m.content).replace(/\n/g, "<br>");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>WhatsApp preview · ${m.to}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #e5ddd5; margin: 0; padding: 24px; }
  .chat { max-width: 480px; margin: 0 auto; background: #efe7de; border-radius: 8px; padding: 16px; }
  .meta { font-size: 12px; color: #5a5a5a; margin-bottom: 12px; }
  .bubble { background: #dcf8c6; padding: 10px 14px; border-radius: 8px 0 8px 8px; max-width: 380px; margin-left: auto; box-shadow: 0 1px 1px rgba(0,0,0,0.08); white-space: pre-wrap; }
  .media { margin-top: 8px; }
  .media img { max-width: 100%; border-radius: 4px; }
  .ts { font-size: 11px; color: #888; margin-top: 4px; text-align: right; }
  .tpl { background: #fff3cd; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="chat">
    <div class="meta">
      <strong>To:</strong> ${safe(m.to)}
      ${m.from ? `<br><strong>From:</strong> ${safe(m.from)}` : ""}
      <br><strong>Sent:</strong> ${safe(preview.sentAt)}
    </div>
    ${m.contentSid ? `<div class="tpl">Template: <code>${safe(m.contentSid)}</code></div>` : ""}
    <div class="bubble">
      ${body || "<em>(media-only)</em>"}
      ${m.mediaUrl ? `<div class="media"><img src="${safe(m.mediaUrl)}" alt="media"></div>` : ""}
      <div class="ts">${safe(preview.sentAt.slice(11, 16))}</div>
    </div>
  </div>
</body>
</html>`;
}
