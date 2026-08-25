"use client";

import { useState } from "react";
import { signIn } from "@saas/auth/client";
import { Button, Input, Label } from "@saas/ui";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * The customer sign-in. Same two paths as the admin's, and the same reason for
 * the deliberately vague success message.
 *
 * Both go straight to Better Auth's own route handlers under `/api/auth/*`. That is the transport it ships and the one the architecture
 * guard asks for: the browser talks to a route handler, never to a Server
 * Function.
 */
export function SignInForm({ next }: { next: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [google, setGoogle] = useState(false);

  if (status === "sent") return <LinkSent />;

  async function requestLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    if (typeof email !== "string" || !email.trim()) return;

    setStatus("sending");
    const { error } = await signIn.magicLink({ email: email.trim(), callbackURL: next });

    /*
     * A rejected address still reports success. Telling the visitor "no such
     * account" turns this form into a way to ask which addresses hold admin
     * access. Only a transport failure is worth showing.
     */
    setStatus(error && error.status !== 400 ? "error" : "sent");
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="secondary"
        size="lg"
        disabled={google}
        onClick={() => {
          setGoogle(true);
          void signIn.social({ provider: "google", callbackURL: next });
        }}
      >
        {google ? "Opening Google…" : "Continue with Google"}
      </Button>

      <span className="flex items-center gap-3">
        <span className="h-px grow bg-border" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px grow bg-border" />
      </span>

      <form onSubmit={requestLink} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            aria-describedby={status === "error" ? "email-error" : undefined}
          />
          {status === "error" ? (
            <p id="email-error" role="alert" className="text-xs text-destructive">
              Could not reach the server. Try again.
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send magic link"}
        </Button>
      </form>
    </div>
  );
}

function LinkSent() {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-semibold text-foreground">Check your inbox</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        If that address has access, a single-use link is on its way.
      </p>
    </div>
  );
}

/**
 * Stands in while `searchParams` resolves.
 *
 * Matched to the real form's rhythm — the same control heights, the same gaps,
 * the same separator row — because the heading above it is already painted from
 * the static shell. A shorter skeleton drops what follows up the page and then
 * pushes it back down.
 */
export function SignInFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <span className="h-12 animate-pulse rounded-lg bg-muted" />
      <span className="flex items-center gap-3">
        <span className="h-px grow bg-border" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px grow bg-border" />
      </span>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="h-3.5 w-24 animate-pulse rounded bg-muted" />
          <span className="h-11 animate-pulse rounded-lg bg-muted" />
        </div>
        <span className="h-12 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
