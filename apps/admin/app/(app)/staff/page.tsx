import { ALL_ROLES, STAFF_OR_ABOVE } from "@saas/auth/roles";

import { RosterScreen } from "@/features/users/components/roster-screen";

/**
 * Whoever runs the admin.
 *
 * Synchronous, with `searchParams` handed down as a promise and resolved
 * inside a boundary — awaiting it here would make the whole route dynamic and
 * leave no static shell at all. The versioned docs add a sharper reason:
 * passing the *promise* into a cached function hangs the build for fifty
 * seconds.
 */
export default function StaffPage({ searchParams }: PageProps<"/staff">) {
  return (
    <RosterScreen
      population="staff"
      eyebrow="Case desk"
      title="Staff"
      blurb="Everyone with a membership. A staff account can sign in here; only an owner can invite, disable or impersonate."
      // Filter and column: only the staff roles, because a "Customer" filter on
      // the staff roster matches nothing.
      roles={STAFF_OR_ABOVE}
      // The menu can assign anything, including Customer — that is how somebody
      // stops being staff. The row leaves for the customers roster, and the toast
      // says so rather than letting it look like a deletion.
      menuRoles={ALL_ROLES}
      inviteLabel="Invite staff"
      searchParams={searchParams}
    />
  );
}
