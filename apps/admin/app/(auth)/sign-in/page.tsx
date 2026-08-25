import { Suspense } from "react";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { getViewer } from "@/features/auth/auth-queries";
import { SignInForm, SignInFormSkeleton } from "@/features/auth/sign-in-form";

/** Only somewhere on this site — an absolute URL here would be an open redirect. */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

/**
 * The page is **synchronous**, and the heading above the boundary prerenders
 * into the static shell.
 *
 * Awaiting `searchParams` at the top instead would make the whole route
 * dynamic. Under `cacheComponents` that is not a style preference: it is a
 * build error, because a route that reads request data outside a boundary has
 * no shell to show while it waits.
 */
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-7">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Staff accounts are invited, never self-served.
          </p>
        </header>

        <Suspense fallback={<SignInFormSkeleton />}>
          {searchParams.then((params) => {
            const target = safeNext(typeof params.next === "string" ? params.next : undefined);
            return (
              <>
                <BounceSignedIn to={target} />
                <SignInForm next={target} />
              </>
            );
          })}
        </Suspense>
      </div>
    </main>
  );
}

/**
 * Nobody needs to look at a sign-in form twice.
 *
 * Renders nothing; it exists to read the session and throw a redirect. That has
 * to happen inside the boundary rather than at the top of the page, because the
 * session read is request data and the page is deliberately synchronous.
 */
async function BounceSignedIn({ to }: { to: string }) {
  if (await getViewer()) redirect(to as Route);
  return null;
}
