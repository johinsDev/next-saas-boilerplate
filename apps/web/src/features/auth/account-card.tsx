import { getViewer } from "./auth-queries";
import { SignOutButton } from "./sign-out-button";

/**
 * Behind the segment's gate, so the session is guaranteed by the time this
 * renders — but it still reads `getViewer()` rather than taking the viewer as a
 * prop. The read is cached per browser, so asking again costs nothing, and the
 * component stays independent of who rendered it.
 */
export async function AccountCard() {
  const viewer = await getViewer();
  if (!viewer) return null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-5">
      <dl className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
          <dd className="text-sm font-medium text-foreground">{viewer.name ?? "—"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
          <dd className="text-sm font-medium text-foreground">{viewer.email}</dd>
        </div>
      </dl>

      <SignOutButton />
    </section>
  );
}

export function AccountCardSkeleton() {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-5" aria-hidden>
      {Array.from({ length: 2 }, (_unused, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <span className="h-3 w-16 animate-pulse rounded bg-muted" />
          <span className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
      ))}
      <span className="h-9 w-24 animate-pulse rounded-md bg-muted" />
    </section>
  );
}
