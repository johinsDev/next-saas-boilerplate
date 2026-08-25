import { ALL_ROLES, ROLES } from "@saas/auth/roles";

import { RosterScreen } from "@/features/users/components/roster-screen";

/**
 * Whoever plays the game.
 *
 * No role *filter*, and that is not an omission: a customer is the absence of a
 * membership, so every row here holds the same role and a filter over it would
 * have one useful position.
 *
 * The row menu is a different matter — it assigns every role, because promoting
 * a customer is how somebody becomes staff, and this is the only screen they can
 * be promoted from. The row then leaves for the staff roster, which the toast
 * says.
 */
export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <RosterScreen
      population="player"
      eyebrow="Case desk"
      title="Customers"
      blurb="Accounts with no membership. They play the game and cannot sign in to this admin."
      menuRoles={ALL_ROLES}
      fixedInviteRole={ROLES.customer}
      inviteLabel="Add a customer"
      searchParams={searchParams}
    />
  );
}
