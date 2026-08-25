import { headers } from "next/headers";

import { PATHNAME_HEADER } from "@/lib/proxy-headers";
import { getViewer, verifyAuth } from "./auth-queries";
import { ViewerMenu } from "./viewer-menu";

/**
 * The two session-dependent slots in the admin shell, each with the skeleton
 * that stands in for it while the session resolves.
 *
 * They are separate on purpose. The badge is decoration — who am I — and can
 * pop in late without anyone minding. The gate decides whether the page renders
 * at all, so it wraps `children`. Sharing one boundary would make the whole
 * screen wait on an avatar.
 */

/** Where the visitor was heading, as the proxy recorded it. */
async function currentPath(): Promise<string> {
  return (await headers()).get(PATHNAME_HEADER) ?? "/";
}

/**
 * The door.
 *
 * `children` sits inside it deliberately, and it costs one session read. The
 * alternative — render the page and check afterwards — is how a customer with a
 * valid session gets a look at the admin. `proxy.ts` cannot make this call: it
 * knows there is a cookie, not whose it is or what it may do.
 *
 * **Know exactly what this guarantees.** Verified against a running build on
 * the sibling application: a request carrying an invalid session cookie still
 * receives the child page's *static shell* — its headings and layout — before
 * the redirect lands. That is how Partial Prerendering works: the shell is
 * built once, at build time, and streams first; only what sits behind a
 * boundary waits for this gate.
 *
 * So the rule is not "the gate hides the page". It is:
 *
 *   **Anything private must be dynamic.** Data read in a query is behind a
 *   boundary and is safe. A name, a count, or an id hardcoded into JSX is in
 *   the shell, and the shell is public.
 *
 * Route names leaking is a cost we accept. A customer row would not be.
 */
export async function Gate({ children }: { children: React.ReactNode }) {
  await verifyAuth(await currentPath());
  return children;
}

export function GateFallback() {
  return (
    <div className="flex grow items-center justify-center p-16" aria-hidden>
      <span className="size-6 animate-pulse rounded-full border-2 border-border" />
    </div>
  );
}

export async function ViewerBadge() {
  const viewer = await getViewer();
  // The gate is what redirects. If this races ahead of it, render nothing
  // rather than a half-built menu.
  if (!viewer) return null;

  return (
    <ViewerMenu
      email={viewer.email}
      name={viewer.name}
      role={viewer.role}
      impersonating={viewer.impersonatedBy !== null}
    />
  );
}

/**
 * The chip's exact shape, so the foot of the sidebar does not resize when the
 * session lands. Same padding, same avatar, same two lines of text — a
 * skeleton of a different height makes the whole sidebar jump.
 */
export function ViewerBadgeSkeleton() {
  return (
    <div className="flex w-full items-center gap-2.5 px-2 py-1.5" aria-hidden>
      <span className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
      <span className="flex grow flex-col gap-1">
        <span className="h-3 w-24 animate-pulse rounded bg-muted" />
        <span className="h-2.5 w-32 animate-pulse rounded bg-muted" />
      </span>
      <span className="size-3.5 shrink-0 animate-pulse rounded bg-muted" />
    </div>
  );
}
