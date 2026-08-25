import type { Metadata } from "next";
import type { ReactNode } from "react";

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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
