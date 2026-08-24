"use client"

import { cn } from "../../cn"
import { IconGlyph } from "./icon-picker"

/**
 * The visual content of one onboarding slide — the glossy icon tile, the title
 * and the (rich or plain) body. Shared by BOTH the admin editor preview and the
 * customer PWA carousel so "what we promise" and "what we deliver" can't drift.
 * The surrounding chrome (phone frame in admin; full-screen background + footer
 * in web) stays app-side.
 */
export function OnboardingSlideView({
  icon,
  title,
  body,
  sub,
  onDark = false,
  size = "lg",
  onIconClick,
  iconAriaLabel,
  className,
}: {
  icon: string
  title: string
  /** Rich HTML (tiptap) — takes precedence over `sub`. */
  body?: string | null
  /** Plain subtitle (built-in fallback slides). */
  sub?: string | null
  /** Light text + inverted prose, for a colored/photo background. */
  onDark?: boolean
  /** `lg` = customer hero; `sm` = the admin phone-mock preview. */
  size?: "sm" | "lg"
  /** Makes the icon tile a button (web taps it to advance). */
  onIconClick?: () => void
  iconAriaLabel?: string
  className?: string
}) {
  const tile =
    size === "lg"
      ? "size-36 rounded-[2.5rem] text-[78px]"
      : "size-16 rounded-2xl text-5xl"
  const heading =
    size === "lg" ? "text-4xl" : "font-display text-base"

  const glyph = (
    <span
      className={cn(
        "flex items-center justify-center bg-linear-to-b from-[#f1fffb] to-[#d6f6ed] shadow-xl shadow-primary/35",
        tile,
      )}
    >
      <span className="grid size-full place-items-center overflow-hidden rounded-[inherit]">
        <IconGlyph value={icon} />
      </span>
    </span>
  )

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        size === "lg" ? "gap-7" : "gap-4",
        className,
      )}
    >
      {onIconClick ? (
        <button type="button" onClick={onIconClick} aria-label={iconAriaLabel}>
          {glyph}
        </button>
      ) : (
        glyph
      )}
      <div className={cn("flex flex-col", size === "lg" ? "gap-3" : "gap-1.5")}>
        <h1
          className={cn(
            "font-semibold leading-[1.05] tracking-tight whitespace-pre-line",
            size === "lg" ? "font-display" : "",
            heading,
          )}
        >
          {title}
        </h1>
        {body ? (
          <div
            className={cn(
              "prose prose-sm mx-auto max-w-xs leading-relaxed",
              size === "sm" && "prose-p:my-1 text-xs",
              onDark && "prose-invert",
            )}
            // Admin-authored HTML (tiptap) — same trust boundary as the editor.
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : sub ? (
          <p
            className={cn(
              "leading-relaxed",
              size === "lg" ? "text-base" : "text-xs",
              onDark ? "text-white/85" : "text-muted-foreground",
            )}
          >
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  )
}
