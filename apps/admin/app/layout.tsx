import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ToastProvider } from "@saas/ui";

import { ThemeProvider } from "@/features/shell/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin",
  description: "Staff console",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` is required by next-themes: it writes the
     * theme class onto <html> before React hydrates, so the server markup and
     * the first client render legitimately differ on this one element.
     */
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
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
