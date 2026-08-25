import type { QueuedEmailJob } from "@saas/email";
import { logger, task } from "@trigger.dev/sdk/v3";

import { email } from "../email";

/**
 * Delivers an already-rendered email.
 *
 * The generic counterpart to a per-email task: any app can put any message on
 * the queue with no task to write per message type. The app renders, names the
 * mailer and hands over; this resolves that name against its own credentials
 * and owns the provider call, the retries and the run you can open when
 * somebody says it never arrived.
 *
 * The mailer travels in the payload rather than being decided here, because
 * "queue it" and "send it through Resend" are two different questions — and an
 * app that could only say the first would have no way to say the second.
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
  run: async ({ mailer, message }: QueuedEmailJob) => {
    logger.info("send-email start", {
      mailer,
      subject: message.subject,
      recipients: message.to.length,
    });

    /*
     * `sendCompiled`, not `send`. The message arrives already rendered, and
     * rebuilding it through the compose callback would mean re-listing every
     * field — which is how a `cc` or a `replyTo` goes missing in silence.
     */
    const response = await email.use(mailer as never).sendCompiled(message);

    logger.info("send-email done", { provider: response.provider, status: response.status });
    return response;
  },
});
