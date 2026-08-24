import { renderMagicLinkEmail } from "@saas/email-templates";
import { logger, task } from "@trigger.dev/sdk/v3";

import { email } from "../email";

type Payload = {
  email: string;
  url: string;
};

// Delivers the admin passwordless magic-link by email. Enqueued from the Worker
// (apps/api/src/lib/auth.ts) so the lean Worker never runs the mailer; the
// provider (log / outbox / resend) is selected per-env by `../email`.
export const sendMagicLinkEmailTask = task({
  id: "send-magic-link-email",
  maxDuration: 30,
  run: async ({ email: to, url }: Payload) => {
    logger.info("send-magic-link-email start", { to });
    const html = await renderMagicLinkEmail({ url });
    await email.send((m) => {
      m.to(to).subject("Tu acceso a Acme Admin").html(html);
    });
    return { ok: true };
  },
});
