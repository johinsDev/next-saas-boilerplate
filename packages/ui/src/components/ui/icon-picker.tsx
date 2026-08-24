"use client"

import { Upload, X } from "lucide-react"

import { cn } from "../../cn"
import { Dropzone, DropzoneArea, DropzoneLabel } from "./dropzone"
import { Input } from "./input"

const DEFAULT_EMOJIS = ["🎁", "🧋", "🍮", "⬆️", "🎉", "🎂", "🔑", "⭐"]

/** An icon value is an uploaded image (rendered as <img>) when it's a data/blob/
 * http URL; otherwise it's an emoji rendered as text. */
export function isImageIcon(value: string): boolean {
  return /^(data:|blob:|https?:\/\/)/.test(value)
}

/** Render an icon value: an <img> for uploaded images, the emoji text otherwise
 * (the parent sizes the emoji). Wrap in an `overflow-hidden` box for rounding. */
export function IconGlyph({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  if (isImageIcon(value)) {
    return (
      <img src={value} alt="" className={cn("size-full object-cover", className)} />
    )
  }
  return <>{value}</>
}

interface IconPickerProps {
  value: string
  onValueChange: (value: string) => void
  /** Quick-pick emoji presets. */
  emojis?: string[]
  /** Label shown next to the free-form custom emoji field. */
  customLabel?: string
  /** Hint shown inside the image drop area. */
  uploadLabel?: string
  /** Accessible label for the "remove uploaded image" button. */
  removeLabel?: string
  /**
   * Upload the dropped image and return its URL. When provided, the icon is
   * stored via the app's pipeline (R2) instead of an inline data-URI (which
   * bloats anything the value is serialized into). Falls back to a data-URI
   * when omitted.
   */
  onUploadImage?: (file: File) => Promise<string | null>
  className?: string
}

/** Icon picker: a quick-pick emoji grid, a free-form custom emoji field, and a
 * drag-and-drop area to upload a custom image. */
function IconPicker({
  value,
  onValueChange,
  emojis = DEFAULT_EMOJIS,
  customLabel,
  uploadLabel = "Drag an image or click",
  removeLabel = "Remove",
  onUploadImage,
  className,
}: IconPickerProps) {
  const isImage = isImageIcon(value)

  const onDrop = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    if (onUploadImage) {
      const url = await onUploadImage(file)
      if (url) onValueChange(url)
      return
    }
    const reader = new FileReader()
    reader.addEventListener("load", () => onValueChange(String(reader.result)))
    reader.readAsDataURL(file)
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onValueChange(emoji)}
            className={cn(
              "grid aspect-square place-items-center rounded-2xl text-2xl outline-none transition-colors",
              value === emoji
                ? "bg-primary/10 ring-primary ring-2"
                : "bg-muted/50 hover:bg-muted"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={isImage ? "" : value}
          onChange={(e) => onValueChange(e.target.value)}
          maxLength={8}
          aria-label={customLabel}
          placeholder="🙂"
          className="h-10 w-16 rounded-xl text-center text-xl"
        />
        {customLabel ? (
          <span className="text-muted-foreground text-xs font-semibold">
            {customLabel}
          </span>
        ) : null}
      </div>

      {isImage ? (
        <div className="border-border flex items-center gap-2 rounded-xl border p-2">
          <img src={value} alt="" className="size-10 rounded-lg object-cover" />
          <span className="text-muted-foreground flex-1 truncate text-xs font-semibold">
            {customLabel ?? uploadLabel}
          </span>
          <button
            type="button"
            onClick={() => onValueChange(emojis[0] ?? "🎁")}
            aria-label={removeLabel}
            className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Dropzone
          accept={{ "image/*": [] }}
          maxFiles={1}
          multiple={false}
          onDrop={(files) => void onDrop(files)}
        >
          <DropzoneArea className="flex-row gap-2 p-4">
            <Upload className="text-muted-foreground size-4" />
            <DropzoneLabel className="text-xs">{uploadLabel}</DropzoneLabel>
          </DropzoneArea>
        </Dropzone>
      )}
    </div>
  )
}

export { IconPicker, type IconPickerProps }
