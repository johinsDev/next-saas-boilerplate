import { Heading, Text } from "@react-email/components";

import { EmailLayout } from "../components/email-layout";
import { renderEmail } from "../render";

export interface EmployeeEmailChangeEmailProps {
  /** The new email now on the account. */
  newEmail: string;
  /** Whether this copy is going to the OLD address (security notice) or the new. */
  toOld: boolean;
}

/**
 * Security notice sent when an owner changes an employee's login email. The OLD
 * address gets a "this was changed" heads-up; the NEW address gets a "this is
 * now your login" confirmation.
 */
export function EmployeeEmailChangeEmail({
  newEmail,
  toOld,
}: EmployeeEmailChangeEmailProps) {
  return (
    <EmailLayout preview="Tu correo de acceso a Acme cambió">
      <Heading className="text-ink text-2xl font-semibold m-0 mb-3">
        Tu correo de acceso cambió
      </Heading>

      {toOld ? (
        <Text className="text-ink text-base leading-6 m-0 mb-4">
          El correo de acceso de tu cuenta de Acme fue cambiado a{" "}
          <strong>{newEmail}</strong>. Si no reconocés este cambio, contactá al
          dueño del negocio de inmediato.
        </Text>
      ) : (
        <Text className="text-ink text-base leading-6 m-0 mb-4">
          Este correo (<strong>{newEmail}</strong>) es ahora tu acceso al panel
          de Acme. Iniciá sesión con él la próxima vez.
        </Text>
      )}

      <Text className="text-muted text-sm leading-6 m-0 mt-6">
        Este es un aviso de seguridad automático.
      </Text>
    </EmailLayout>
  );
}

EmployeeEmailChangeEmail.PreviewProps = {
  newEmail: "nuevo@t4.co",
  toOld: true,
} satisfies EmployeeEmailChangeEmailProps;

export function renderEmployeeEmailChangeEmail(
  props: EmployeeEmailChangeEmailProps,
): Promise<string> {
  return renderEmail(<EmployeeEmailChangeEmail {...props} />);
}
