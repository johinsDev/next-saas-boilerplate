import { Button, Heading, Section, Text } from "@react-email/components";

import { EmailLayout } from "../components/email-layout";
import { renderEmail } from "../render";

export interface EmployeeInviteEmailProps {
  /** Accept-invitation URL on the admin app (`/aceptar-invitacion?invitationId=…`). */
  acceptUrl: string;
  /** Human label for the assigned role ("Cajero" / "Gerente"). */
  roleLabel: string;
  /** Role key, to pick a "what you'll do" blurb. */
  role: string;
  /** The email the invitation was sent to (their future login). */
  email: string;
}

const ROLE_BLURB: Record<string, string> = {
  staff:
    "Como Cajero vas a operar la caja: registrar compras, otorgar sellos y confirmar canjes de recompensas.",
  manager:
    "Como Gerente vas a operar la caja y además gestionar el equipo, configurar recompensas y ver reportes.",
  owner: "Como Dueño vas a tener acceso completo al panel.",
};

/**
 * Invitation to join the staff CRM (apps/admin). Explains who they'll be, what
 * they'll be able to do, and how to accept. Clicking sends a sign-in link to
 * this email; once signed in they become a team member.
 */
export function EmployeeInviteEmail({
  acceptUrl,
  roleLabel,
  role,
  email,
}: EmployeeInviteEmailProps) {
  return (
    <EmailLayout preview={`Te invitaron a Acme como ${roleLabel}`}>
      <Heading className="text-ink text-2xl font-semibold m-0 mb-3">
        Te sumaron al equipo de Acme
      </Heading>

      <Text className="text-ink text-base leading-6 m-0 mb-4">
        Fuiste invitado a unirte al panel de Acme como <strong>{roleLabel}</strong>.
      </Text>

      <Text className="text-ink text-base leading-6 m-0 mb-4">
        {ROLE_BLURB[role] ?? ROLE_BLURB.staff}
      </Text>

      <Text className="text-ink text-base leading-6 m-0 mb-4">
        Hacé click para aceptar. Te enviaremos un enlace de acceso a{" "}
        <strong>{email}</strong> — ese será tu inicio de sesión de ahora en más.
      </Text>

      <Section className="text-center my-8">
        <Button
          href={acceptUrl}
          className="bg-brand text-brand-fg px-6 py-3 rounded-md no-underline text-base font-medium box-border inline-block"
        >
          Aceptar invitación
        </Button>
      </Section>

      <Text className="text-muted text-sm leading-6 m-0 mt-6">
        La invitación vence en 7 días. Si no esperabas este correo, podés
        ignorarlo.
      </Text>
    </EmailLayout>
  );
}

EmployeeInviteEmail.PreviewProps = {
  acceptUrl: "https://admin.t4diverclub.app/aceptar-invitacion?invitationId=preview",
  roleLabel: "Cajero",
  role: "staff",
  email: "cajero@t4.co",
} satisfies EmployeeInviteEmailProps;

export function renderEmployeeInviteEmail(
  props: EmployeeInviteEmailProps,
): Promise<string> {
  return renderEmail(<EmployeeInviteEmail {...props} />);
}
