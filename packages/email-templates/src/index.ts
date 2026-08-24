// Public API of @saas/email-templates.
//
// Importers (apps/web, apps/admin, packages/jobs) do:
//
//   import { renderEmail, WelcomeEmail } from "@saas/email-templates";
//   const html = await renderEmail(<WelcomeEmail name="..." ctaUrl="..." />);
//
// See .claude/skills/email/SKILL.md and .claude/skills/react-email/SKILL.md
// for the full handbook.

export { EmailLayout } from "./components/email-layout";
export { renderEmail } from "./render";
export {
  EmployeeInviteEmail,
  type EmployeeInviteEmailProps,
  renderEmployeeInviteEmail,
} from "./templates/employee-invite-email";
export {
  EmployeeEmailChangeEmail,
  type EmployeeEmailChangeEmailProps,
  renderEmployeeEmailChangeEmail,
} from "./templates/employee-email-change-email";
export {
  MagicLinkEmail,
  type MagicLinkEmailProps,
  renderMagicLinkEmail,
} from "./templates/magic-link-email";
export {
  TEST_EMAIL_TEMPLATE_IDS,
  TEST_EMAIL_TEMPLATES,
  renderTestEmailTemplate,
  type TestEmailTemplateId,
} from "./test-templates";
export { WelcomeEmail, type WelcomeEmailProps } from "./templates/welcome-email";
