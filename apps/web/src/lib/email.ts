import "server-only";

import { EmailManager, type QueuedEmailJob } from "@saas/email";
import { tasks } from "@trigger.dev/sdk/v3";
import type { sendEmailTask } from "@saas/jobs/trigger/send-email";

/**
 * How the customer app sends mail.
 *
 * Two independent questions, kept independent:
 *
 * - **Where** it goes — `mailers`. This process can write an HTML file, and
 *   that is all it can do; it holds no provider credentials on purpose.
 * - **When** it goes — `queue`. Present in production, so the message is handed
 *   to a worker that delivers it through Resend, with retries and a run you can
 *   open when somebody reports an email that never arrived.
 *
 * Locally neither is set, the file lands in `.email-previews/`, and a fresh
 * clone signs in with `bun run dev` and nothing else running. Requiring a queue
 * to read your own magic link is a bad first ten minutes.
 *
 * **`EMAIL_QUEUE`, not the presence of `TRIGGER_SECRET_KEY`.** Those are two
 * different facts: the worker needs its credentials in every environment it
 * runs in, including a laptop, and having them there must not silently divert
 * this app's mail to a provider nobody wanted locally. Whether the queue is
 * *reachable* and whether this app should *use* it are separate questions.
 *
 * It is also an env var rather than `NODE_ENV`, so exercising the real queue
 * locally is `EMAIL_QUEUE=1 bun run dev` rather than a code change.
 */

const queued = ["1", "true", "on"].includes(process.env.EMAIL_QUEUE ?? "");

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
