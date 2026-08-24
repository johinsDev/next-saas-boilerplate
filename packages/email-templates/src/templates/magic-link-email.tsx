import { Button, Heading, Section, Text } from "@react-email/components";

import { EmailLayout } from "../components/email-layout";
import { renderEmail } from "../render";

export interface MagicLinkEmailProps {
  /** The Better-Auth-built magic-link verify URL — opens an admin session. */
  url: string;
}

/**
 * Passwordless sign-in for the staff CRM (apps/admin). The recipient clicks
 * the button to open an authenticated session. Link expires in 5 minutes.
 *
 * Author guidelines (per `.claude/skills/react-email/SKILL.md`):
 *   - `box-border` on `<Button>`; borders need `border-solid`.
 *   - No flexbox/grid, no media queries / `dark:`.
 */
export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Tu acceso a Acme Admin">
      <Heading className="text-ink text-2xl font-semibold m-0 mb-3">
        Acceso a Acme Admin
      </Heading>

      <Text className="text-ink text-base leading-6 m-0 mb-4">
        Hacé click en el botón para iniciar sesión en el panel. El enlace
        expira en 5 minutos y solo se puede usar una vez.
      </Text>

      <Section className="text-center my-8">
        <Button
          href={url}
          className="bg-brand text-brand-fg px-6 py-3 rounded-md no-underline text-base font-medium box-border inline-block"
        >
          Iniciar sesión
        </Button>
      </Section>

      <Text className="text-muted text-sm leading-6 m-0 mt-6">
        Si no pediste este acceso, podés ignorar este email.
      </Text>
    </EmailLayout>
  );
}

MagicLinkEmail.PreviewProps = {
  url: "https://api.t4diverclub.app/api/auth/magic-link/verify?token=preview",
} satisfies MagicLinkEmailProps;

/**
 * Render the magic-link email to an HTML string. Lets non-JSX callers
 * (the `packages/jobs` Trigger task is plain `.ts`) get the rendered body
 * without importing React / configuring JSX.
 */
export function renderMagicLinkEmail(
  props: MagicLinkEmailProps,
): Promise<string> {
  return renderEmail(<MagicLinkEmail {...props} />);
}
