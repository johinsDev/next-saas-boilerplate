import { Button, Heading, Section, Text } from "@react-email/components";

import { EmailLayout } from "../components/email-layout";

export interface WelcomeEmailProps {
  /** Recipient's first name — shown in the greeting. */
  name: string;
  /** Where the CTA button takes them (usually their account URL). */
  ctaUrl: string;
}

/**
 * Sent right after sign-up. Welcomes the user by name and links them
 * to their account.
 *
 * Author guidelines (per `.claude/skills/react-email/SKILL.md`):
 *   - Always include `box-border` on `<Button>` so padding doesn't
 *     overflow.
 *   - Borders need explicit type (`border-solid`).
 *   - No flexbox/grid — use `<Section>` + Tailwind block utilities.
 *   - No media queries / `dark:` selectors — minimal client support.
 */
export function WelcomeEmail({ name, ctaUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`¡Bienvenida a Acme, ${name}!`}>
      <Heading className="text-ink text-2xl font-semibold m-0 mb-3">
        ¡Bienvenida, {name}! 🍵
      </Heading>

      <Text className="text-ink text-base leading-6 m-0 mb-4">
        Tu tarjeta digital de fidelización ya está lista. Acumulá sellos
        en cada visita y canjealos por bebidas de cortesía.
      </Text>

      <Section className="text-center my-8">
        <Button
          href={ctaUrl}
          className="bg-brand text-brand-fg px-6 py-3 rounded-md no-underline text-base font-medium box-border inline-block"
        >
          Ver mi tarjeta
        </Button>
      </Section>

      <Text className="text-ink text-base leading-6 m-0 mb-2">
        Cómo funciona:
      </Text>
      <Text className="text-ink text-sm leading-6 m-0">
        1. Mostrá tu tarjeta digital en mostrador
        <br />
        2. Sumá un sello por cada compra
        <br />
        3. Completá la tarjeta y reclamá tu premio
      </Text>

      <Text className="text-muted text-sm leading-6 m-0 mt-6">
        Si tenés alguna duda, respondé este email — leemos todo.
      </Text>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  name: "Lucía",
  ctaUrl: "https://t4.app/card",
} satisfies WelcomeEmailProps;
