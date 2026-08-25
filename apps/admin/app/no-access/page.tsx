import Link from "next/link";

/**
 * Signed in, but not staff.
 *
 * Deliberately not a redirect back to sign-in: the visitor already has a valid
 * session, so bouncing them there would loop forever and look like the login is
 * broken.
 */
export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold text-foreground">No access</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Your account is signed in but is not a member of the staff for this workspace. Ask an
        owner to grant you a role.
      </p>
      <Link href="/sign-in" className="text-sm underline underline-offset-4">
        Sign in as somebody else
      </Link>
    </main>
  );
}
