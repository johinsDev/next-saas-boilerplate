import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import type { Role } from "@saas/auth/roles";
import type { Population } from "@saas/services/users/schemas";

import { getViewer } from "@/features/auth/auth-queries";
import { readUser } from "../users-queries";
import { RoleBadge, StatusMark } from "./user-badges";
import { UserRowActions } from "./user-row-actions";

/**
 * One person, shared by both rosters.
 *
 * Synchronous, like every page here: `params` is resolved inside the boundary
 * rather than awaited at the top, so the chrome and the back link prerender
 * into the static shell.
 *
 * **Everything identifying is behind the boundary.** Under Partial
 * Prerendering the shell is built once and served to anybody who asks for the
 * URL, so a name or an email above the boundary would be public. Route names
 * leaking is a cost we accept; a user row is not.
 */
export function UserDetailScreen({
  params,
  population,
  backLabel,
  roles,
}: {
  params: Promise<{ id: string }>;
  /** Which roster this page belongs to. A mismatch redirects rather than lies. */
  population: Population;
  backLabel: string;
  roles?: readonly Role[];
}) {
  const back = (population === "staff" ? "/staff" : "/customers") as Route;

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6">
      <Link
        href={back}
        className="flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        {backLabel}
      </Link>

      <Suspense fallback={<UserDetailSkeleton />}>
        {params.then(({ id }) => (
          <UserDetail id={id} population={population} roles={roles} />
        ))}
      </Suspense>
    </div>
  );
}

async function UserDetail({
  id,
  population,
  roles,
}: {
  id: string;
  population: Population;
  roles?: readonly Role[];
}) {
  const [user, viewer] = await Promise.all([readUser(id), getViewer()]);

  if (!user) notFound();

  /*
   * Somebody promoted from player to staff keeps the URL they were opened
   * under, and a bookmark outlives a role change. Redirecting to the matching
   * roster is better than rendering a staff member under "Customers", where the
   * back link would send you somewhere they are not.
   */
  if (user.population !== population) {
    redirect(`/${user.population === "staff" ? "staff" : "customers"}/${user.id}` as Route);
  }

  const label = user.name?.trim() || user.email || user.id;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-extrabold uppercase text-secondary-foreground"
          >
            {label.replace(/@.*/, "").slice(0, 2)}
          </span>

          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">{label}</h1>
            <p className="text-sm text-muted-foreground">{user.email ?? "No address on file"}</p>
            <div className="flex flex-wrap items-center gap-2">
              {population === "staff" && <RoleBadge role={user.role} />}
              <StatusMark status={user.status} />
            </div>
          </div>
        </div>

        <UserRowActions
          user={user}
          viewerId={viewer?.userId ?? ""}
          viewerIsOwner={viewer?.role === "owner"}
          roles={roles}
        />
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-foreground">
            Active sessions
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {/*
             * Only the ones that would still let somebody in. An expired row
             * shown greyed out is a row that invites a pointless revoke.
             */}
            Sessions that have not expired. Revoking signs them out everywhere.
          </p>
        </header>

        {user.sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {user.status === "invited"
              ? "They have not followed their invitation yet."
              : "No active sessions."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {user.sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border px-3 py-2.5 text-xs"
              >
                <span className="font-semibold text-foreground">
                  {session.ipAddress ?? "Unknown address"}
                </span>
                <span className="grow truncate text-muted-foreground">
                  {session.userAgent ?? "Unknown device"}
                </span>
                {session.impersonatedBy && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-bold uppercase tracking-wide text-destructive">
                    Impersonated
                  </span>
                )}
                <span className="tabular-nums text-muted-foreground">
                  expires{" "}
                  {session.expiresAt.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UserDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
        <span className="size-12 shrink-0 animate-shimmer rounded-full bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
        <span className="flex flex-col gap-2">
          <span className="h-5 w-44 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
          <span className="h-3.5 w-56 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
          <span className="flex gap-2">
            <span className="h-5 w-16 animate-shimmer rounded-full bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
            <span className="h-5 w-16 animate-shimmer rounded-full bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <span className="h-4 w-32 animate-shimmer rounded bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
        <span className="h-10 w-full animate-shimmer rounded-lg bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
        <span className="h-10 w-full animate-shimmer rounded-lg bg-muted bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,rgb(86_48_12/0.14)_50%,var(--muted)_100%)] motion-reduce:animate-none" />
      </div>
    </div>
  );
}
