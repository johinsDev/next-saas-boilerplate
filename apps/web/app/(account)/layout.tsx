import { Suspense, type ReactNode } from "react";

import { verifyAuth } from "@/features/auth/auth-queries";

/**
 * The one gated segment.
 *
 * The rest of this app renders for anybody; everything filed under here needs a
 * session. Putting the check in the segment layout means a new account screen
 * is protected by where it is filed rather than by remembering to add a line —
 * and it keeps the public pages entirely free of it.
 *
 * The bar is `customer`: signed in at all. Staff clear it too, because an owner
 * looking at their own account is not an error.
 */
async function Gate({ children }: { children: ReactNode }) {
  await verifyAuth();
  return children;
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-16" aria-hidden>
          <span className="size-6 animate-pulse rounded-full border-2 border-border" />
        </div>
      }
    >
      <Gate>{children}</Gate>
    </Suspense>
  );
}
