import { exec } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cwd } from "node:process";

import { smsSegmentInfo } from "../schemas";
import type {
  FolderProviderConfig,
  SmsMessageData,
  SmsPreview,
  SmsResponse,
  SmsTransport,
} from "../types";

/**
 * Local-dev transport that writes each send to a folder as JSON + an
 * SMS-like HTML preview. Useful when you want to *see* how the message
 * would look on a handset without firing Twilio.
 *
 * Default folder is `.sms-previews/` next to `process.cwd()`,
 * configurable via `outputDir`. Set `openInBrowser: true` to auto-open
 * the HTML on each send (off by default; CI/PROD skip it regardless).
 */
export class FolderTransport implements SmsTransport {
  readonly name = "folder";
  readonly #config: FolderProviderConfig;

  constructor(config: FolderProviderConfig) {
    this.#config = config;
  }

  async send(message: SmsMessageData): Promise<SmsResponse> {
    const id = crypto.randomUUID();
    const seg = smsSegmentInfo(message.content);
    const response: SmsResponse = {
      status: "sent",
      providerMessageId: id,
      provider: this.name,
      timestamp: new Date().toISOString(),
      segments: {
        encoding: seg.encoding,
        characters: seg.characters,
        count: seg.segments,
      },
    };

    const preview: SmsPreview = {
      id,
      message,
      response,
      segments: {
        encoding: seg.encoding,
        characters: seg.characters,
        count: seg.segments,
      },
      sentAt: response.timestamp,
    };

    const dir = resolve(cwd(), this.#config.outputDir ?? ".sms-previews");
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

function renderHtml(preview: SmsPreview): string {
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
<title>SMS preview · ${m.to}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f2f2f7; margin: 0; padding: 24px; }
  .chat { max-width: 420px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .meta { font-size: 12px; color: #5a5a5a; margin-bottom: 16px; }
  .bubble { background: #007aff; color: #fff; padding: 10px 14px; border-radius: 18px 18px 4px 18px; max-width: 320px; margin-left: auto; white-space: pre-wrap; }
  .ts { font-size: 11px; color: #888; margin-top: 6px; text-align: right; }
  .seg { font-size: 11px; color: #5a5a5a; text-align: right; margin-top: 4px; }
</style>
</head>
<body>
  <div class="chat">
    <div class="meta">
      <strong>To:</strong> ${safe(m.to)}
      ${m.from ? `<br><strong>From:</strong> ${safe(m.from)}` : ""}
      <br><strong>Sent:</strong> ${safe(preview.sentAt)}
    </div>
    <div class="bubble">${body}</div>
    <div class="ts">${safe(preview.sentAt.slice(11, 16))}</div>
    <div class="seg">${preview.segments.encoding} · ${preview.segments.characters} chars · ${preview.segments.count} segment${preview.segments.count > 1 ? "s" : ""}</div>
  </div>
</body>
</html>`;
}
