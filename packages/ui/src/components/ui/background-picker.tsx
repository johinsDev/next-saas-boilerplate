"use client"

import * as React from "react"
import { Upload, X } from "lucide-react"

import { cn } from "../../cn"
import { ColorPicker } from "./color-picker"
import { Dropzone, DropzoneArea, DropzoneLabel } from "./dropzone"

export type BackgroundPreset = { key: string; css: string }

// ─── Hex helpers (recolor gradients from one base color) ─────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  return [
    parseInt(v.slice(0, 2), 16) || 0,
    parseInt(v.slice(2, 4), 16) || 0,
    parseInt(v.slice(4, 6), 16) || 0,
  ]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt))
}
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt)
}

/** A background "style" parametrized by one base color → a CSS `background`
 *  string. Includes a plain solid fill. Recoloring 'a template with X color'. */
export type GradientStyle = { key: string; make: (color: string) => string }

export const GRADIENT_STYLES: GradientStyle[] = [
  { key: "solid", make: (c) => c },
  { key: "diagonal", make: (c) => `linear-gradient(135deg, ${c}, ${darken(c, 0.45)})` },
  { key: "vertical", make: (c) => `linear-gradient(180deg, ${c}, ${darken(c, 0.45)})` },
  {
    key: "radial",
    make: (c) =>
      `radial-gradient(circle at 30% 20%, ${lighten(c, 0.25)}, ${c} 55%, ${darken(c, 0.4)})`,
  },
  { key: "soft", make: (c) => `linear-gradient(135deg, ${lighten(c, 0.22)}, ${darken(c, 0.3)})` },
  {
    key: "glow",
    make: (c) =>
      `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.28), transparent 42%), linear-gradient(135deg, ${c}, ${darken(c, 0.5)})`,
  },
]

/** Legacy fixed gradient presets (kept for existing seeds / defaults). */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { key: "mint", css: "linear-gradient(135deg, #1BAD9D, #0e6f64)" },
  { key: "grape", css: "linear-gradient(135deg, #7c5cff, #4527a0)" },
  { key: "sunset", css: "linear-gradient(135deg, #f0a868, #e0467c)" },
  { key: "ocean", css: "linear-gradient(135deg, #3b73d6, #1f3a8a)" },
  { key: "berry", css: "linear-gradient(135deg, #e0467c, #7c1d3f)" },
  { key: "ink", css: "linear-gradient(135deg, #1f2937, #000323)" },
]

/** Decorative patterns — a layered CSS `background` (texture over a gradient). */
export const BACKGROUND_PATTERNS: BackgroundPreset[] = [
  {
    key: "dots",
    css: "radial-gradient(rgba(255,255,255,0.18) 1.5px, transparent 1.6px) 0 0/14px 14px, linear-gradient(135deg, #1BAD9D, #0e6f64)",
  },
  {
    key: "grid",
    css: "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px) 0 0/20px 20px, linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px) 0 0/20px 20px, linear-gradient(135deg, #3b73d6, #1f3a8a)",
  },
  {
    key: "stripes",
    css: "repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 10px, transparent 10px 20px), linear-gradient(135deg, #7c5cff, #4527a0)",
  },
  {
    key: "mesh",
    css: "radial-gradient(at 18% 22%, #f0a868 0, transparent 45%), radial-gradient(at 82% 28%, #e0467c 0, transparent 45%), radial-gradient(at 50% 82%, #7c5cff 0, transparent 45%), #1f2937",
  },
]

/** A background value is an uploaded image when it's a CSS `url(...)`. */
function isImageBackground(value: string): boolean {
  return value.startsWith("url(")
}
/** First `#rrggbb` in a CSS string (to seed the base color from an existing value). */
function firstHex(value: string): string | null {
  return /#[0-9a-fA-F]{6}/.exec(value)?.[0] ?? null
}

interface BackgroundPickerProps {
  /** A CSS background string — a recolored style, a solid hex, a pattern, or a
   *  `url(...)` image. */
  value: string
  onValueChange: (background: string) => void
  /**
   * Curated fixed-gradient templates shown as their own grid (with a selected
   * ring on the active one). Off by default; pass `BACKGROUND_PRESETS` to show
   * them. Use when a value may be a hand-picked two-color gradient the
   * recolor-from-one-color styles can't reproduce.
   */
  presets?: BackgroundPreset[]
  /** Decorative patterns shown as a second grid. Pass `[]` to hide them. */
  patterns?: BackgroundPreset[]
  swatches?: string[]
  /** Hint shown inside the image drop area. */
  uploadLabel?: string
  /** Accessible label for the "remove uploaded image" button. */
  removeLabel?: string
  /** Optional label for the base color control. */
  colorLabel?: string
  /**
   * Upload the dropped image and return its URL. When provided, the image is
   * stored via the app's pipeline (R2) instead of an inline data-URI (which
   * overflows a CSS length limit). Falls back to a data-URI when omitted.
   */
  onUploadImage?: (file: File) => Promise<string | null>
  className?: string
}

function BackgroundPicker({
  value,
  onValueChange,
  presets = [],
  patterns = BACKGROUND_PATTERNS,
  swatches,
  uploadLabel = "Drag an image or click",
  removeLabel = "Remove",
  colorLabel,
  onUploadImage,
  className,
}: BackgroundPickerProps) {
  const isImage = isImageBackground(value)
  const [baseColor, setBaseColor] = React.useState<string>(
    () => firstHex(value) ?? "#7c5cff",
  )
  // The active style is whichever one reproduces the current value with the
  // current base color (else default to the first gradient).
  const activeStyle =
    GRADIENT_STYLES.find((s) => s.make(baseColor) === value)?.key ?? null

  const applyStyle = (key: string) => {
    const s = GRADIENT_STYLES.find((x) => x.key === key)
    if (s) onValueChange(s.make(baseColor))
  }
  const onColor = (c: string) => {
    setBaseColor(c)
    const s = GRADIENT_STYLES.find((x) => x.key === (activeStyle ?? "diagonal"))
    if (s) onValueChange(s.make(c))
  }

  const onDrop = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    if (onUploadImage) {
      const url = await onUploadImage(file)
      if (url) onValueChange(`url("${url}") center/cover no-repeat`)
      return
    }
    const reader = new FileReader()
    reader.addEventListener("load", () =>
      onValueChange(`url("${String(reader.result)}") center/cover no-repeat`),
    )
    reader.readAsDataURL(file)
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Base color + recolorable styles */}
      <div className="flex items-center gap-2">
        <ColorPicker value={baseColor} onValueChange={onColor} swatches={swatches} />
        {colorLabel ? (
          <span className="text-muted-foreground text-xs font-semibold">{colorLabel}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {GRADIENT_STYLES.map((s) => {
          const css = s.make(baseColor)
          return (
            <button
              key={s.key}
              type="button"
              aria-label={s.key}
              onClick={() => applyStyle(s.key)}
              style={{ background: css }}
              className={cn(
                "h-12 rounded-xl outline-none transition-transform",
                activeStyle === s.key
                  ? "ring-foreground ring-offset-card ring-2 ring-offset-2"
                  : "hover:scale-105",
              )}
            />
          )
        })}
      </div>

      {presets.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-label={p.key}
              onClick={() => onValueChange(p.css)}
              style={{ background: p.css }}
              className={cn(
                "h-12 rounded-xl outline-none transition-transform",
                value === p.css
                  ? "ring-foreground ring-offset-card ring-2 ring-offset-2"
                  : "hover:scale-105",
              )}
            />
          ))}
        </div>
      ) : null}

      {patterns.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {patterns.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-label={p.key}
              onClick={() => onValueChange(p.css)}
              style={{ background: p.css }}
              className={cn(
                "h-12 rounded-xl outline-none transition-transform",
                value === p.css
                  ? "ring-foreground ring-offset-card ring-2 ring-offset-2"
                  : "hover:scale-105",
              )}
            />
          ))}
        </div>
      ) : null}

      {isImage ? (
        <div className="border-border flex items-center gap-2 rounded-xl border p-2">
          <span className="size-10 rounded-lg" style={{ background: value }} />
          <span className="text-muted-foreground flex-1 truncate text-xs font-semibold">
            {uploadLabel}
          </span>
          <button
            type="button"
            onClick={() => onValueChange(GRADIENT_STYLES[1]!.make(baseColor))}
            aria-label={removeLabel}
            className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Dropzone accept={{ "image/*": [] }} maxFiles={1} multiple={false} onDrop={onDrop}>
          <DropzoneArea className="flex-row gap-2 p-4">
            <Upload className="text-muted-foreground size-4" />
            <DropzoneLabel className="text-xs">{uploadLabel}</DropzoneLabel>
          </DropzoneArea>
        </Dropzone>
      )}
    </div>
  )
}

export { BackgroundPicker, type BackgroundPickerProps }
