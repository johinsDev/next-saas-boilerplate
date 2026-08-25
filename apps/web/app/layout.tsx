import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { ToastProvider } from "@saas/ui";

import { SessionChip, SessionChipSkeleton } from "@/features/auth/session-chip";
import { ThemeProvider } from "@/features/shell/theme-provider";
import "./globals.css";

/**
 * Metadata matters here in a way it never does in the admin: these pages are
 * indexed and shared. `metadataBase` is what makes relative OG image paths
 * resolve to absolute URLs — without it social previews silently fall back to
 * nothing.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Acme", template: "%s · Acme" },
  description: "The customer application.",
};

/**
 * The public shell. **No gate.**
 *
 * That is the whole difference from `apps/admin`, whose layout wraps `children`
 * in a session check. Here the layout renders for everyone, and only the
 * account slot knows whether anyone is signed in — behind its own boundary, so
 * reading the session cannot drag the public pages out of the static shell.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          {/*
           * One stack for the whole app, mounted here rather than beside
           * whatever raised the toast: a menu or a modal that reports a result
           * and then closes would take its own message with it.
           *
           * `components/ui/sonner.tsx` is still in the tree and unused. Do not
           * wire it up as well — two stacks means two corners of the screen
           * arguing about which failure you already dismissed.
           */}
          <ToastProvider>
            <div className="flex min-h-dvh flex-col">
              <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4 sm:px-6">
                <Link href="/" className="text-base font-semibold tracking-tight text-foreground">
                  Acme
                </Link>

                <div className="grow" />

                <Suspense fallback={<SessionChipSkeleton />}>
                  <SessionChip />
                </Suspense>
              </header>

              <main className="grow">{children}</main>
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
