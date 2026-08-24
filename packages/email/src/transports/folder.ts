import { exec } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cwd } from "node:process";

import type {
  EmailMessageData,
  EmailPreview,
  EmailResponse,
  EmailTransport,
  FolderProviderConfig,
  Recipient,
} from "../types";

function recipientLabel(r: Recipient): string {
  if (typeof r === "string") return r;
  return r.name ? `${r.name} <${r.address}>` : r.address;
}

/**
 * Local-dev transport that writes each send to a folder as JSON + an
 * inbox-style HTML preview. Useful when you want to *see* how the
 * rendered template looks without firing Resend.
 *
 * Default folder is `.email-previews/` next to `process.cwd()`,
 * configurable via `outputDir`. Set `openInBrowser: true` to auto-open
 * the HTML on each send (off by default; CI/PROD skip it regardless).
 */
export class FolderTransport implements EmailTransport {
  readonly name = "folder";
  readonly #config: FolderProviderConfig;

  constructor(config: FolderProviderConfig) {
    this.#config = config;
  }

  async send(message: EmailMessageData): Promise<EmailResponse> {
    const id = crypto.randomUUID();
    const response: EmailResponse = {
      status: "sent",
      providerMessageId: id,
      provider: this.name,
      timestamp: new Date().toISOString(),
    };

    const preview: EmailPreview = {
      id,
      message,
      response,
      sentAt: response.timestamp,
    };

    const dir = resolve(cwd(), this.#config.outputDir ?? ".email-previews");
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

function renderHtml(preview: EmailPreview): string {
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

  const meta = [
    `<dt>From</dt><dd>${m.from ? safe(recipientLabel(m.from)) : "<em>(not set)</em>"}</dd>`,
    `<dt>To</dt><dd>${m.to.map((r) => safe(recipientLabel(r))).join(", ")}</dd>`,
    m.replyTo ? `<dt>Reply-To</dt><dd>${safe(recipientLabel(m.replyTo))}</dd>` : "",
    m.cc?.length
      ? `<dt>Cc</dt><dd>${m.cc.map((r) => safe(recipientLabel(r))).join(", ")}</dd>`
      : "",
    m.bcc?.length
      ? `<dt>Bcc</dt><dd>${m.bcc.map((r) => safe(recipientLabel(r))).join(", ")}</dd>`
      : "",
    `<dt>Subject</dt><dd>${safe(m.subject)}</dd>`,
    `<dt>Sent</dt><dd>${safe(preview.sentAt)}</dd>`,
    `<dt>Provider</dt><dd>${safe(preview.response.provider)}</dd>`,
  ]
    .filter(Boolean)
    .join("");

  const bodyHtml = m.html
    ? `<iframe class="body" srcdoc="${safe(m.html)}" sandbox="allow-same-origin" onload="resize(this)"></iframe>`
    : m.text
      ? `<pre class="text">${safe(m.text)}</pre>`
      : `<em>(no body)</em>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Email preview · ${safe(m.subject)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f2f2f7; margin: 0; padding: 24px; color: #1a1a1a; }
  .envelope { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  dl.meta { display: grid; grid-template-columns: 100px 1fr; gap: 6px 12px; margin: 0 0 24px; padding: 16px; background: #f7f7f8; border-radius: 8px; font-size: 13px; }
  dl.meta dt { color: #5a5a5a; font-weight: 600; }
  dl.meta dd { margin: 0; word-break: break-word; }
  iframe.body { width: 100%; min-height: 400px; border: 1px solid #e1e1e6; border-radius: 8px; background: white; }
  pre.text { background: #f7f7f8; padding: 16px; border-radius: 8px; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
</style>
<script>
  function resize(iframe) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      iframe.style.height = (doc.body.scrollHeight + 32) + "px";
    } catch (e) {}
  }
</script>
</head>
<body>
  <div class="envelope">
    <dl class="meta">${meta}</dl>
    ${bodyHtml}
  </div>
</body>
</html>`;
}
