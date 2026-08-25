import Link from "next/link";

import { getViewer } from "./auth-queries";

/**
 * The header's account slot — and the clearest illustration of how this app
 * differs from the admin.
 *
 * There is no gate here. The session is read, and **both answers are valid
 * renders**: a signed-in visitor gets their account link, an anonymous one gets
 * "Sign in". Nothing redirects, because the page around this is public.
 *
 * It still sits behind its own `<Suspense>` in the layout. Reading the session
 * is request data, so awaiting it in the layout body would drag the entire
 * public site out of the static shell — every marketing page would become
 * dynamic to decide the wording of one link.
 */
export async function SessionChip() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <Link
        href="/sign-in"
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        Sign in
      </Link>
    );
  }

  const label = viewer.name?.trim() || viewer.email;

  return (
    <Link href="/account" className="flex items-center gap-2.5" aria-label="Your account">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold uppercase text-primary-foreground"
      >
        {initials(label)}
      </span>
      <span className="hidden text-sm font-medium text-foreground sm:block">{label}</span>
    </Link>
  );
}

/**
 * Same footprint as either resolved state, so the header does not resize when
 * the session lands — and it must not guess which one is coming. A skeleton
 * shaped like the signed-in chip would flash an avatar at every anonymous
 * visitor.
 */
export function SessionChipSkeleton() {
  return <span className="h-8 w-24 animate-pulse rounded-lg bg-muted" aria-hidden />;
}

function initials(label: string): string {
  const parts = label.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).slice(0, 2) || "?";
}
