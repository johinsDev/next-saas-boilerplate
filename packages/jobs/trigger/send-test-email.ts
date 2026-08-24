import {
  renderTestEmailTemplate,
  type TestEmailTemplateId,
} from "@saas/email-templates";
import { logger, task } from "@trigger.dev/sdk/v3";

import { email } from "../email";

type Mailer = "log" | "outbox" | "resend";

type Payload =
  | { mode: "template"; to: string; templateId: TestEmailTemplateId; mailer?: Mailer }
  | { mode: "custom"; to: string; subject: string; html: string; mailer?: Mailer };

/**
 * One-off "test email" behind the admin /email-outbox dev tool. Renders
 * a known template (its sample props) or a custom subject + HTML, then
 * sends through `@saas/email`.
 *
 * The optional `mailer` override forces a specific transport — set it to
 * `resend` on a preview deploy to smoke-test the live provider. Without
 * it the env default applies (log in dev, outbox in preview, resend in
 * prod). Mirrors `send-test-push`: same delivery path real flows use,
 * with Trigger.dev's automatic retries.
 */
export const sendTestEmailTask = task({
  id: "send-test-email",
  maxDuration: 30,
  run: async (payload: Payload) => {
    const { to, mailer } = payload;

    const { subject, html, text } =
      payload.mode === "template"
        ? await renderTestEmailTemplate(payload.templateId)
        : { subject: payload.subject, html: payload.html, text: undefined };

    logger.info("send-test-email start", {
      to,
      mode: payload.mode,
      mailer: mailer ?? "default",
    });

    const sender = mailer ? email.use(mailer) : email;
    const response = await sender.send((m) => {
      m.to(to).subject(subject).html(html);
      if (text) m.text(text);
    });

    logger.info("send-test-email done", {
      provider: response.provider,
      status: response.status,
      providerMessageId: response.providerMessageId,
    });
    return { ok: true, providerMessageId: response.providerMessageId };
  },
});
