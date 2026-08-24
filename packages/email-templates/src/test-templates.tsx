import { renderEmail } from "./render";
import { MagicLinkEmail } from "./templates/magic-link-email";
import { WelcomeEmail } from "./templates/welcome-email";

/**
 * Templates the admin `/email-outbox` dev tool can send as a one-off
 * "test email". Each entry pairs a stable `id` (shipped in the
 * Trigger.dev payload) with a default subject; the body renders from the
 * template's own `PreviewProps`, so an operator picks a template and
 * sends without typing anything.
 *
 * Add a template here AND a matching case in `renderTestEmailTemplate`.
 */
export const TEST_EMAIL_TEMPLATES = [
  { id: "welcome", subject: "¡Bienvenida a Acme! 🍵" },
  { id: "magic-link", subject: "Tu acceso a Acme Admin 🔑" },
] as const;

export type TestEmailTemplateId = (typeof TEST_EMAIL_TEMPLATES)[number]["id"];

export const TEST_EMAIL_TEMPLATE_IDS = TEST_EMAIL_TEMPLATES.map((t) => t.id) as [
  TestEmailTemplateId,
  ...TestEmailTemplateId[],
];

/**
 * Render a known template to `{ subject, html, text }` using its sample
 * props. Keeps all JSX/React inside this package so callers (the jobs
 * task, which is plain TypeScript) never depend on `react` directly.
 */
export async function renderTestEmailTemplate(
  id: TestEmailTemplateId,
): Promise<{ subject: string; html: string; text: string }> {
  switch (id) {
    case "welcome": {
      const element = <WelcomeEmail {...WelcomeEmail.PreviewProps} />;
      const [html, text] = await Promise.all([
        renderEmail(element),
        renderEmail(element, { plainText: true }),
      ]);
      return { subject: "¡Bienvenida a Acme! 🍵", html, text };
    }
    case "magic-link": {
      const element = <MagicLinkEmail {...MagicLinkEmail.PreviewProps} />;
      const [html, text] = await Promise.all([
        renderEmail(element),
        renderEmail(element, { plainText: true }),
      ]);
      return { subject: "Tu acceso a Acme Admin 🔑", html, text };
    }
  }
  throw new Error(`Unknown test email template: ${id satisfies never}`);
}
