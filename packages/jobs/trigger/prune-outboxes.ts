import { db } from "@saas/db";
import {
  EmailOutboxRepository,
  EmailOutboxService,
} from "@saas/services/email-outbox";
import {
  PushOutboxRepository,
  PushOutboxService,
} from "@saas/services/push-outbox";
import {
  SmsOutboxRepository,
  SmsOutboxService,
} from "@saas/services/sms-outbox";
import {
  WhatsAppOutboxRepository,
  WhatsAppOutboxService,
} from "@saas/services/whatsapp-outbox";
import { logger, schedules } from "@trigger.dev/sdk/v3";

import { env } from "../env";

/**
 * Daily cleanup for the `*_outbox` tables. Calls `service.prune(N)`
 * on each channel's outbox feature, which delegates to the repository
 * for the actual Drizzle `DELETE`. Keeps the per-feature layering
 * rule from `.claude/skills/api-filters/SKILL.md` intact — the task
 * is a thin orchestrator, no queries here.
 *
 * Retention window is `OUTBOX_RETENTION_DAYS` (default 30 days).
 *
 * Why this exists: the `outbox` transport for each channel persists
 * a row per send so devs/PMs can review messages in preview deploys.
 * Production uses Twilio / Resend / Expo / WebPush directly, so these
 * tables stay empty there — but local dev + preview can pile up over
 * time. Email rows are particularly heavy because they store the full
 * HTML body.
 *
 * Cron is 04:00 UTC (off-peak in AR). Safe to widen via env or to
 * pause the task in the Trigger.dev dashboard.
 */
export const pruneOutboxesTask = schedules.task({
  id: "prune-outboxes",
  cron: "0 4 * * *",
  run: async () => {
    const retentionDays = env.OUTBOX_RETENTION_DAYS ?? 30;

    const whatsappService = new WhatsAppOutboxService(
      new WhatsAppOutboxRepository(db),
    );
    const smsService = new SmsOutboxService(new SmsOutboxRepository(db));
    const emailService = new EmailOutboxService(new EmailOutboxRepository(db));
    const pushService = new PushOutboxService(new PushOutboxRepository(db));

    const [whatsapp, sms, email, push] = await Promise.all([
      whatsappService.prune(retentionDays),
      smsService.prune(retentionDays),
      emailService.prune(retentionDays),
      pushService.prune(retentionDays),
    ]);

    const result = { retentionDays, whatsapp, sms, email, push };
    logger.info("prune-outboxes done", result);
    return result;
  },
});
