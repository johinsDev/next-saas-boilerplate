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

/**
 * Queue by default, wherever a queue is actually reachable.
 *
 * Local should rehearse production's shape, not a simplified version of it —
 * the whole point of a queue is that it changes when things happen, and bugs
 * that only appear once mail is deferred are exactly the ones worth catching on
 * a laptop. With `EMAIL_PROVIDER=folder` you get that rehearsal for free: the
 * worker writes an HTML file you can open, no provider account involved.
 *
 * The fallback is for a fresh clone with no Trigger project, where deferring
 * could only fail. It is **not** the coupling this replaced: back then having
 * credentials silently rerouted mail to Resend, because the destination was
 * hardcoded. The destination is `EMAIL_PROVIDER` now, so turning the queue on
 * cannot change where anything lands.
 *
 * `EMAIL_QUEUE=false` forces direct delivery; `true` demands the queue and
 * fails loudly if it is not configured, rather than quietly doing something
 * else.
 */
const EMAIL_QUEUE = process.env.EMAIL_QUEUE?.toLowerCase();
const queued =
  EMAIL_QUEUE === undefined || EMAIL_QUEUE === ""
    ? Boolean(process.env.TRIGGER_SECRET_KEY)
    : !["0", "false", "off", "no"].includes(EMAIL_QUEUE);

/**
 * Where the worker should deliver once the queue is on.
 *
 * Hardcoding `resend` here made the two axes only half-independent: you could
 * say "queue it", but not "queue it and write a file", which is exactly what
 * you want to exercise the queue locally without a provider account. Reading
 * `EMAIL_PROVIDER` makes `EMAIL_QUEUE=1 EMAIL_PROVIDER=folder` mean what it
 * looks like it means.
 */


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
  // Where the worker delivers: `EMAIL_PROVIDER`, the same "where" axis as
  // always. The queue only changes *who reads it* — this process or the worker.
  queue: queued ? { mailer: process.env.EMAIL_PROVIDER ?? "folder", dispatch } : undefined,
});
