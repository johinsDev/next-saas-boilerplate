"use client"

import { cn } from "../../cn"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "./input-group"

export interface UrlInputProps {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export function UrlInput({
  value,
  onChange,
  placeholder,
  className,
  id,
}: UrlInputProps) {
  // Show the bare host/path; the protocol lives in the add-on. Pasting a full
  // URL strips the protocol so it never doubles up.
  const bare = (value ?? "").replace(/^https?:\/\//i, "")
  return (
    <InputGroup className={cn("h-10 rounded-xl", className)}>
      <InputGroupAddon align="inline-start">
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        value={bare}
        onChange={(e) => {
          const stripped = e.target.value.replace(/^https?:\/\//i, "").trimStart()
          // Always emit a complete URL (or "") so it validates with zod `.url()`.
          onChange?.(stripped ? `https://${stripped}` : "")
        }}
        placeholder={placeholder}
      />
    </InputGroup>
  )
}
