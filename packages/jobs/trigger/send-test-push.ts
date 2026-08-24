import { logger, task } from "@trigger.dev/sdk/v3";

import { push } from "../push";

type Payload = {
  userId: string;
  title?: string;
  body?: string;
};

/**
 * Sends a one-off "test" push to every active token registered for
 * the user. Used by the admin /push-outbox "Send test push" button to
 * verify VAPID keys, the service worker, and the round-trip end to
 * end. Trigger.dev gives us free retries (3, exp backoff) so a
 * transient Web Push 5xx doesn't surface as a UI error.
 *
 * Production push flows (event earned, entitlement ready, etc.) follow the
 * same pattern — service triggers a task, task uses `@saas/push`,
 * retries are automatic.
 */
export const sendTestPushTask = task({
  id: "send-test-push",
  maxDuration: 30,
  run: async ({ userId, title, body }: Payload) => {
    logger.info("send-test-push start", { userId });
    const responses = await push.send((m) => {
      m.toUser(userId)
        .title(title ?? "Push de prueba Acme")
        .body(body ?? "Si ves esto, las notificaciones funcionan ✅")
        .data({ kind: "test", at: new Date().toISOString() });
    });
    logger.info("send-test-push done", { sent: responses.length });
    return { ok: true, sent: responses.length };
  },
});
