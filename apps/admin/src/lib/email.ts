import "server-only";

import { EmailManager, type EmailMessageData } from "@saas/email";
import { tasks } from "@trigger.dev/sdk/v3";
import type { sendEmailTask } from "@saas/jobs/trigger/send-email";

/**
 * How this app sends mail.
 *
 * **Production hands the message to the queue and returns.** The request path
 * stops waiting on a provider, delivery gets retries and backoff, and every
 * send has a run you can open when somebody reports an email that never
 * arrived. The app itself never talks to Resend.
 *
 * **Locally it writes an HTML file** to `.email-previews/` and opens it. That
 * is deliberate: a fresh clone can sign in with `bun run dev` and nothing else
 * running. Requiring a queue to read your own magic link is how a boilerplate
 * gets abandoned in the first ten minutes.
 *
 * The switch is the presence of `TRIGGER_SECRET_KEY`, not `NODE_ENV`, so
 * pointing a local run at a real queue is one variable rather than a code
 * change.
 */

const queued = Boolean(process.env.TRIGGER_SECRET_KEY);

/**
 * The task is a **type-only** import; the id travels as a string.
 *
 * That is the same bargain as `hc<AppType>`: full type-checking of the payload
 * at compile time, and not one byte of `@saas/jobs` — with its database, its
 * mailer and every other task — pulled into this app's bundle.
 */
async function dispatch(message: EmailMessageData) {
  const handle = await tasks.trigger<typeof sendEmailTask>("send-email", message);
  return { id: handle.id };
}

export const email = new EmailManager({
  default: queued ? "queue" : "folder",
  mailers: {
    queue: { provider: "queue", dispatch },
    folder: { provider: "folder", outputDir: ".email-previews", openInBrowser: true },
  },
});
