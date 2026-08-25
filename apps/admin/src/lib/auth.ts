import "server-only";

import { createAuth } from "@saas/auth/server";
import { renderMagicLinkEmail } from "@saas/email-templates";

import { email } from "./email";

/**
 * The admin's Better Auth instance.
 *
 * `sendMagicLink` is injected rather than imported inside `@saas/auth`, so that
 * package stays free of a mailer — the Worker that serves mobile has no
 * business bundling Resend and React Email just to read a session.
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
// Address and display name travel separately: `EmailMessage.from()` validates
// the address, and "Acme <noreply@example.com>" is not one.
const fromAddress = process.env.EMAIL_FROM ?? "noreply@example.com";
const fromName = process.env.EMAIL_FROM_NAME ?? "Admin";

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
