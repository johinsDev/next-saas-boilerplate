/**
 * PII masking for staff-facing reads. The cashier can confirm identity without
 * seeing full contact details — enough to recognize the customer, not enough to
 * exfiltrate. Synthetic `<phone>@phone.local` emails (minted for phone-first
 * users) count as "no email".
 */

const TEMP_EMAIL_SUFFIX = "@phone.local";

/** `+573001234567` → `••••4567`. Short/blank numbers pass through unchanged. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return `••••${digits.slice(-4)}`;
}

/** `john.doe@x.com` → `jo••••••@x.com`. Returns null for a missing or synthetic
 *  (`@phone.local`) email so the UI shows "no email" rather than a fake one. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || email.endsWith(TEMP_EMAIL_SUFFIX)) return null;
  const at = email.indexOf("@");
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"•".repeat(Math.max(1, local.length - head.length))}@${domain}`;
}
