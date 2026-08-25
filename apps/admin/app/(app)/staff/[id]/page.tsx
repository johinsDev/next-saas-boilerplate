import { ALL_ROLES } from "@saas/auth/roles";

import { UserDetailScreen } from "@/features/users/components/user-detail";

export default function StaffMemberPage({ params }: PageProps<"/staff/[id]">) {
  return (
    <UserDetailScreen
      params={params}
      population="staff"
      backLabel="Back to staff"
      roles={ALL_ROLES}
    />
  );
}
