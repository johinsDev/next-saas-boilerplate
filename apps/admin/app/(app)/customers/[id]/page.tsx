import { ALL_ROLES } from "@saas/auth/roles";

import { UserDetailScreen } from "@/features/users/components/user-detail";

export default function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  return (
    <UserDetailScreen
      params={params}
      population="player"
      backLabel="Back to customers"
      roles={ALL_ROLES}
    />
  );
}
