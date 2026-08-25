import type { EmailMessageData } from "@saas/email";
import { logger, task } from "@trigger.dev/sdk/v3";

import { email } from "../email";

/**
 * Delivers an already-rendered email.
 *
 * The generic counterpart to a per-email task: any app can put any message on
 * the queue by selecting the `queue` provider, with no task to write per
 * message type. The app renders and hands over; this owns the provider call,
 * the retries and the run you can open when somebody says it never arrived.
 *
 * Rendering stays on the request path here, which is a deliberate trade. It
 * costs a few milliseconds and it keeps the payload a plain rendered message,
 * so the queue never has to know what a template is. When rendering itself is
 * expensive, write a task that takes the *inputs* instead — see
 * `send-magic-link-email.ts`.
 */
export const sendEmailTask = task({
  id: "send-email",
  maxDuration: 60,
  // The provider, not us, is the flaky part. Retry it rather than dropping a
  // sign-in link because Resend had a bad thirty seconds.
  retry: { maxAttempts: 5 },
  run: async (message: EmailMessageData) => {
    logger.info("send-email start", {
      subject: message.subject,
      recipients: message.to.length,
    });

    /*
     * `sendCompiled`, not `send`. The message arrives already rendered, and
     * rebuilding it through the compose callback would mean re-listing every
     * field — which is how a `cc` or a `replyTo` goes missing in silence.
     */
    const response = await email.use().sendCompiled(message);

    logger.info("send-email done", { provider: response.provider, status: response.status });
    return response;
  },
});
