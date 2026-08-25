"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { signIn } from "@saas/auth/client";
import { Button, Label, MotionInput } from "@saas/ui";

/**
 * The schema, at module scope.
 *
 * Not inside the component: a new `zodResolver` on every render thrashes
 * validation, which is the footgun the `react-hook-form` skill names first.
 *
 * It lives here rather than in `packages/services` because there is no server
 * handler of ours to share it with — Better Auth owns `/api/auth/*`. The day we
 * put our own endpoint in front of it, this moves and both sides import it.
 */
export const signInSchema = z.object({
  email: z
    .string()
    // Before the checks, not after: pasting an address out of a chat window
    // brings a space with it, and rejecting that is pedantry the visitor has to
    // debug. It also keeps one representation — the old form trimmed on the way
    // out, so what it validated and what it sent were not the same string.
    .trim()
    .min(1, "Enter the address you were invited with.")
    .email("That does not look like an email address."),
});

type SignInValues = z.infer<typeof signInSchema>;

/**
 * Both paths go straight to Better Auth's own route handlers under
 * `/api/auth/*`. That is the transport it ships and the one the architecture
 * guard asks for: the browser talks to a route handler, never to a Server
 * Function.
 *
 * One field still gets the full form treatment. A single input is exactly where
 * hand-rolled validation looks reasonable and then quietly diverges — the
 * required check drifts from the shape check, the disabled state drifts from
 * both, and nothing tells you. Schema in, `formState` out.
 */
export function SignInForm({ next }: { next: string }) {
  const [sent, setSent] = useState(false);
  const [google, setGoogle] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    // Always pass these: it avoids the uncontrolled→controlled warning and it
    // is what types `watch` and `reset`.
    defaultValues: { email: "" },
  });

  if (sent) return <LinkSent />;

  async function requestLink({ email }: SignInValues) {
    const { error } = await signIn.magicLink({ email, callbackURL: next });

    /*
     * A rejected address still reports success. Telling the visitor "no such
     * account" turns this form into a way to ask which addresses hold admin
     * access. Only a transport failure is worth showing — and it is a
     * form-level problem, not something wrong with what they typed, so it goes
     * on `root` rather than on the field.
     */
    if (error && error.status !== 400) {
      setError("root", { message: "Could not reach the server. Try again." });
      return;
    }

    setSent(true);
  }

  const busy = isSubmitting || google;

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="secondary"
        size="lg"
        disabled={busy}
        onClick={() => {
          setGoogle(true);
          void signIn.social({ provider: "google", callbackURL: next });
        }}
      >
        <GoogleMark />
        {google ? "Opening Google…" : "Continue with Google"}
      </Button>

      <Separator label="or" />

      {/* `noValidate`: the browser's own bubble would pre-empt our message and
          word it differently from the schema. One source of truth. */}
      <form onSubmit={handleSubmit(requestLink)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>

          {/*
           * `Controller`, not `register`. beUI's input is controlled and its
           * `onChange` hands over a string rather than an event — the one case
           * the forms skill says to reach for this. It repays it: `error` makes
           * the field shake and renders the message we already have.
           */}
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <MotionInput
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled={busy}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.email?.message}
              />
            )}
          />
        </div>

        {errors.root ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.root.message}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={busy}>
          {isSubmitting ? "Sending…" : "Send magic link"}
        </Button>
      </form>
    </div>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="h-px grow bg-border" />
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="h-px grow bg-border" />
    </span>
  );
}

function LinkSent() {
  return (
    <div
      role="status"
      className="flex animate-[slide-in_.5s_cubic-bezier(.16,1,.3,1)] flex-col gap-2 rounded-xl border border-border bg-card p-5 motion-reduce:animate-none"
    >
      <p className="text-sm font-semibold text-foreground">Check your inbox</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        If that address has access, a single-use link is on its way. It expires in 10 minutes.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Stands in while `searchParams` resolves.
 *
 * Matched to the real form's rhythm — the same control heights, gaps and
 * separator row — because the heading above it and the footer below it are
 * already painted from the static shell. A shorter skeleton drops the footer up
 * the page and then pushes it back down.
 */
export function SignInFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <span className="h-12 animate-pulse rounded-lg bg-muted" />
      <Separator label="or" />
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
