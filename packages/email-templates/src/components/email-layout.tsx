import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
  /** Inbox preview snippet (shown next to the subject in most clients). */
  preview: string;
  children: ReactNode;
  /** Override the footer "from" name. Defaults to "Acme". */
  fromName?: string;
}

/**
 * Shared visual shell for every transactional email. Wraps the
 * template-specific content in `<Html>` → `<Head>` → `<Tailwind>` →
 * `<Body>` and adds a brand header + footer (unsubscribe + address +
 * year). Use as the outermost element of every template.
 *
 * Tailwind tokens here mirror the brand palette
 * (`emerald-600`/`amber-50`); kept inline so we don't depend on
 * `@saas/ui`'s CSS pipeline (email clients won't run it anyway).
 *
 * `pixelBasedPreset` is required — email clients don't support `rem`.
 */
export function EmailLayout({
  preview,
  children,
  fromName = "Acme",
}: EmailLayoutProps) {
  return (
    <Html lang="es">
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: "#16a34a",
                "brand-fg": "#ffffff",
                ink: "#0f172a",
                muted: "#64748b",
                surface: "#f8fafc",
              },
            },
          },
        }}
      >
        <Head />
        <Preview>{preview}</Preview>
        <Body className="bg-surface font-sans m-0 p-0">
          <Container className="max-w-[600px] mx-auto px-6 py-8">
            <Section className="pb-6">
              <Text className="text-brand text-xl font-semibold m-0">
                {fromName}
              </Text>
            </Section>

            <Section className="bg-white rounded-lg p-8 border border-solid border-slate-200">
              {children}
            </Section>

            <Hr className="my-6 border-solid border-slate-200" />

            <Section>
              <Text className="text-muted text-xs m-0 leading-5">
                © {new Date().getFullYear()} Acme · Buenos Aires,
                Argentina
              </Text>
              <Text className="text-muted text-xs m-0 mt-2 leading-5">
                ¿No querés recibir más emails como este?{" "}
                <Link
                  href="https://t4.app/preferences"
                  className="text-brand underline"
                >
                  Cambiá tus preferencias
                </Link>
                .
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
