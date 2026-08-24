"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { SegmentedControl } from "./segmented-control";

export interface ModeSegmentedLabels {
  light: string;
  dark: string;
}

const DEFAULT_LABELS: ModeSegmentedLabels = { light: "Light", dark: "Dark" };

/**
 * Light / Dark theme as a {@link SegmentedControl} (the Mode picker without the
 * "system" option, matching the Preferences design). Unlike {@link ModeToggle}
 * this reads the active theme to highlight the chip, so it needs a mount guard:
 * server + first client render both resolve to `light`, then the effect swaps in
 * the real theme — same markup on both passes, no hydration mismatch.
 */
export function ModeSegmented({
  labels = DEFAULT_LABELS,
  "aria-label": ariaLabel,
}: {
  labels?: ModeSegmentedLabels;
  "aria-label"?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const value: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <SegmentedControl
      aria-label={ariaLabel}
      value={value}
      onValueChange={setTheme}
      options={[
        { value: "light", label: labels.light, icon: SunIcon },
        { value: "dark", label: labels.dark, icon: MoonIcon },
      ]}
    />
  );
}

type ThemeWithSystem = "system" | "light" | "dark";

/**
 * Theme picker as an icon-only segmented control (System / Light / Dark),
 * matching Vercel's. Unlike {@link ModeSegmented} it reads the chosen `theme`
 * (not the resolved one) so "System" stays selectable. Same mount guard to
 * avoid a hydration mismatch (server + first client render resolve to `system`,
 * then the effect swaps in the real value — same markup on both passes).
 */
export function ModeSegmentedSystem({
  "aria-label": ariaLabel,
}: {
  "aria-label"?: string;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const value: ThemeWithSystem =
    mounted && (theme === "light" || theme === "dark") ? theme : "system";

  return (
    <SegmentedControl<ThemeWithSystem>
      aria-label={ariaLabel}
      value={value}
      onValueChange={setTheme}
      className="gap-0.5 p-0.5"
      options={[
        { value: "system", label: "", icon: MonitorIcon },
        { value: "light", label: "", icon: SunIcon },
        { value: "dark", label: "", icon: MoonIcon },
      ]}
    />
  );
}
