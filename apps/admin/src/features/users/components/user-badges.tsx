import type { Role } from "@saas/auth/roles";
import { Badge } from "@saas/ui";
import type { Population, UserStatus } from "@saas/services/users/schemas";

/**
 * The three labels a roster row wears, in one file.
 *
 * Together rather than inline, because the same vocabulary appears in the table,
 * on the detail page and beside the filters — and a status that reads
 * "Disabled" in one place and "Banned" in another is two different things to
 * whoever is reading it.
 */

const STATUS_VARIANT: Record<UserStatus, "secondary" | "outline" | "destructive"> = {
  active: "secondary",
  invited: "outline",
  disabled: "destructive",
};

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Active",
  // Not "Pending": what is pending is them, not us.
  invited: "Invited",
  disabled: "Disabled",
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  staff: "Staff",
  manager: "Manager",
  owner: "Owner",
};

/**
 * The label a role wears on screen.
 *
 * A lookup rather than a `capitalize`, because the stored word and the shown
 * word are allowed to differ — an app whose fourth population is players or
 * members or patients renames it here, not in a migration.
 */
export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={role === "owner" ? "default" : "outline"}>{ROLE_LABEL[role]}</Badge>;
}

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

export function populationLabel(population: Population): string {
  return population === "staff" ? "Staff" : "Customers";
}
