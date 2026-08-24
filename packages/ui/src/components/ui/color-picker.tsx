"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "../../cn"
import { Button } from "./button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

const DEFAULT_SWATCHES = [
  "#1BAD9D",
  "#7c5cff",
  "#e0467c",
  "#f0a868",
  "#3b73d6",
  "#1f9d68",
  "#0ea5e9",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f59e0b",
  "#111827",
]

interface ColorPickerProps {
  value: string
  onValueChange: (hex: string) => void
  swatches?: string[]
  className?: string
}

function normalize(hex: string): string {
  return hex.trim().toUpperCase()
}

function ColorPicker({
  value,
  onValueChange,
  swatches = DEFAULT_SWATCHES,
  className,
}: ColorPickerProps) {
  const isSelected = (color: string) => normalize(color) === normalize(value)

  // Hex without the leading "#" for the text field.
  const hexBody = value.replace(/^#/, "")

  const handleHexBodyChange = (raw: string) => {
    const body = raw.replace(/^#/, "")
    onValueChange(normalize(`#${body}`))
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-10 gap-2 rounded-xl", className)}
          >
            <span
              className="size-5 rounded-md"
              style={{ background: value }}
            />
            <span className="font-mono uppercase">{value}</span>
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent className="w-56 space-y-3 rounded-xl p-3">
        <div className="grid grid-cols-6 gap-1.5">
          {swatches.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => onValueChange(normalize(color))}
              className={cn(
                "size-7 rounded-md outline-none",
                isSelected(color) &&
                  "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
              )}
              style={{ background: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onValueChange(normalize(e.target.value))}
            className="size-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
          />
          <InputGroup className="h-9">
            <InputGroupAddon align="inline-start">#</InputGroupAddon>
            <InputGroupInput
              value={hexBody}
              onChange={(e) => handleHexBodyChange(e.target.value)}
            />
          </InputGroup>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { ColorPicker, type ColorPickerProps }
