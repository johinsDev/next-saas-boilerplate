import "server-only";

import { createAuth } from "@saas/auth/server";
import { renderMagicLinkEmail } from "@saas/email-templates";

import { email } from "./email";

/**
 * The customer app's Better Auth instance. See `./email` for why a production
 * send goes onto the queue and a local one lands in `.email-previews/`.
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const fromAddress = process.env.EMAIL_FROM ?? "noreply@example.com";
const fromName = process.env.EMAIL_FROM_NAME ?? "Acme";

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
