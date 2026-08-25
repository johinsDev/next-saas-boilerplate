import { renderMagicLinkEmail } from "@saas/email-templates";
import { logger, task } from "@trigger.dev/sdk/v3";

import { email } from "../email";

type Payload = {
  email: string;
  url: string;
};

/**
 * Delivers the passwordless magic link, rendering it here rather than on the
 * request path.
 *
 * The variant to reach for when rendering itself is worth moving off the
 * request: the payload is the *inputs*, and the template never runs in the app.
 * For everything else `send-email` takes an already-rendered message, so there
 * is no task to write per message type.
 *
 * The provider (log / outbox / resend) is chosen per environment by `../email`.
 */
export const sendMagicLinkEmailTask = task({
  id: "send-magic-link-email",
  maxDuration: 30,
  run: async ({ email: to, url }: Payload) => {
    logger.info("send-magic-link-email start", { to });
    const html = await renderMagicLinkEmail({ url });
    await email.send((m) => {
      m.to(to).subject("Your sign-in link").html(html);
    });
    return { ok: true };
  },
});
