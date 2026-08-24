"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

/**
 * Thin passthrough over next-themes' provider so consumer apps import
 * the provider from `@saas/ui` (single next-themes copy → the
 * provider, `ModeToggle`'s `useTheme`, and the `Toaster`'s `useTheme`
 * all share one context). Mount once in the app root layout:
 *
 *   <ThemeProvider attribute="class" defaultTheme="system" enableSystem
 *     disableTransitionOnChange>{children}</ThemeProvider>
 */
export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>,
) {
  return <NextThemesProvider {...props} />
}
