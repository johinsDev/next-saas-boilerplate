"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@saas/auth/client";
import { Button } from "@saas/ui";

/**
 * Who you are, and the way out.
 *
 * Both belong together: an admin that never says whose session you are in is
 * how somebody edits a record from a colleague's account without noticing.
 */
export function ViewerMenu({
  email,
  name,
  role,
}: {
  email: string;
  name: string | null;
  role: string;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const label = name?.trim() || email;

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold uppercase text-primary-foreground"
      >
        {initials(label)}
      </span>

      <span className="hidden flex-col leading-tight sm:flex">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{email}</span>
      </span>

      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-secondary-foreground">
        {role}
      </span>

      <Button
        variant="ghost"
        size="sm"
        disabled={leaving}
        onClick={() => {
          setLeaving(true);
          void signOut().then(() => {
            /*
             * `refresh()` before `replace()`: the session lives in a cookie the
             * server read while rendering, so without dropping that cache the
             * next page would still be built from the signed-in one.
             */
            router.refresh();
            router.replace("/sign-in");
          });
        }}
      >
        {leaving ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

function initials(label: string): string {
  const parts = label.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).slice(0, 2) || "?";
}
