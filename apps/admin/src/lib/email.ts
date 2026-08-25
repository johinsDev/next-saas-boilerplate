import "server-only";

import { EmailManager, type QueuedEmailJob } from "@saas/email";
import { tasks } from "@trigger.dev/sdk/v3";
import type { sendEmailTask } from "@saas/jobs/trigger/send-email";

/**
 * How the admin sends mail.
 *
 * Two independent questions, kept independent:
 *
 * - **Where** it goes — `mailers`. This process can write an HTML file, and
 *   that is all it can do; it holds no provider credentials on purpose.
 * - **When** it goes — `queue`. Present in production, so the message is handed
 *   to a worker that delivers it through Resend, with retries and a run you can
 *   open when somebody reports a sign-in link that never arrived.
 *
 * Locally the queue is absent and the file lands in `.email-previews/`, so a
 * fresh clone signs in with `bun run dev` and nothing else running. Requiring a
 * queue to read your own magic link is a bad first ten minutes.
 *
 * The switch is the presence of `TRIGGER_SECRET_KEY`, not `NODE_ENV`, so
 * pointing a local run at a real queue is one variable rather than a code
 * change.
 */

const queued = Boolean(process.env.TRIGGER_SECRET_KEY);

/**
 * The task is a **type-only** import; the id travels as a string.
 *
 * That is the same bargain the architecture already makes with `hc<AppType>`:
 * the payload is type-checked at compile time, and not one byte of
 * `@saas/jobs` — with its mailer and every other task — is pulled into this
 * app's bundle.
 */
async function dispatch(job: QueuedEmailJob) {
  const handle = await tasks.trigger<typeof sendEmailTask>("send-email", job);
  return { id: handle.id };
}

export const email = new EmailManager({
  // What this process can deliver by itself. `openInBrowser` opens the rendered
  // HTML on send, so a sign-in link is one click rather than a trip through the
  // file system; the transport refuses it in production and in CI regardless.
  default: "folder",
  mailers: {
    folder: { provider: "folder", outputDir: ".email-previews", openInBrowser: true },
  },
  // In production, hand off instead — and tell the worker where to deliver.
  queue: queued ? { mailer: "resend", dispatch } : undefined,
});
