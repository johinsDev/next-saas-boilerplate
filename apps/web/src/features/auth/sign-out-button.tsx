"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@saas/auth/client";
import { Button } from "@saas/ui";

export function SignOutButton() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  return (
    <Button
      variant="secondary"
      size="sm"
      className="self-start"
      disabled={leaving}
      onClick={() => {
        setLeaving(true);
        void signOut().then(() => {
          /*
           * `refresh()` before navigating: the session lives in a cookie the
           * server read while rendering, so without dropping that cache the
           * next page would still be built from the signed-in one.
           */
          router.refresh();
          router.replace("/");
        });
      }}
    >
      {leaving ? "Signing out…" : "Sign out"}
    </Button>
  );
}
