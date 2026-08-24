"use client";

import { type Tag, TagInput as EmblorTagInput } from "emblor";
import { useState } from "react";
import { cn } from "../../cn";

export type { Tag };

export interface TagInputProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function TagInput({ value, onChange, placeholder, id, className }: TagInputProps) {
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);

  return (
    <div className={cn(className)}>
      <EmblorTagInput
        tags={value}
        // emblor's setTags is a React state setter — handle both updater fn and array.
        setTags={(t) => onChange(typeof t === "function" ? t(value) : t)}
        activeTagIndex={activeTagIndex}
        setActiveTagIndex={setActiveTagIndex}
        id={id}
        placeholder={placeholder}
        inlineTags={false}
        inputFieldPosition="top"
        styleClasses={{
          input:
            "rounded-md transition-[color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          tag: {
            body: "relative h-7 bg-background border border-input hover:bg-background rounded-md font-medium text-xs ps-2 pe-7",
            closeButton:
              "absolute -inset-y-px -end-px p-0 rounded-s-none rounded-e-md flex size-7 transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-muted-foreground/80 hover:text-foreground",
          },
          tagList: { container: "gap-1" },
        }}
      />
    </div>
  );
}
