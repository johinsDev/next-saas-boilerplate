import "server-only";

import { createAuth } from "@saas/auth/server";
import { EmailManager } from "@saas/email";
import { renderMagicLinkEmail } from "@saas/email-templates";

/**
 * The admin's Better Auth instance.
 *
 * `sendMagicLink` is injected rather than imported inside `@saas/auth`, so that
 * package stays free of a mailer — the Worker that serves mobile has no
 * business bundling Resend and React Email just to read a session.
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
// Address and display name travel separately: `EmailMessage.from()` validates
// the address, and "Acme <noreply@example.com>" is not one.
const fromAddress = process.env.EMAIL_FROM ?? "noreply@example.com";
const fromName = process.env.EMAIL_FROM_NAME ?? "Admin";

/*
 * `folder` writes every send to `.email-previews/` as an HTML file you can
 * open. That is the whole local story: no keys, no quota, and you get to look
 * at the thing you are shipping. Production sets EMAIL_PROVIDER=resend.
 *
 * A mailer whose credentials are missing is left `undefined` on purpose — the
 * manager drops those, so a machine that sets EMAIL_PROVIDER=resend without a
 * key fails loudly with "unknown mailer" instead of swallowing sign-in emails.
 */
const email = new EmailManager({
  default: (process.env.EMAIL_PROVIDER ?? "folder") as "folder" | "resend",
  mailers: {
    folder: { provider: "folder", outputDir: ".email-previews", openInBrowser: true },
    resend: process.env.RESEND_API_KEY
      ? {
          provider: "resend",
          apiKey: process.env.RESEND_API_KEY,
          from: `${fromName} <${fromAddress}>`,
        }
      : undefined,
  },
});

export const auth = createAuth(
  {
    sendMagicLink: async ({ email: to, url }) => {
      const html = await renderMagicLinkEmail({ url });

      await email.send((message) => {
        message.to(to).from(fromAddress, fromName).subject("Your sign-in link").html(html);
      });
    },
  },
  { baseURL: appUrl, emailAndPasswordEnabled: false },
);
