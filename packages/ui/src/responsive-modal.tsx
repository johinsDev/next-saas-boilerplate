"use client";

import type { ReactNode } from "react";

import { cn } from "./cn";
import { BottomSheet } from "./components/motion/bottom-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { DESKTOP_QUERY, useMediaQuery } from "./use-media-query";

/**
 * A dialog on a desktop and a drag-to-dismiss sheet on a phone, from one call.
 *
 * Two components rather than one responsive one, because the difference is not
 * styling. A centred dialog and a bottom sheet want different gestures, a
 * different focus order, and a different answer to "where does the keyboard
 * push the content" — a form in a centred box on a phone ends up half behind
 * the keyboard with nowhere to scroll.
 *
 * The desktop half is **this kit's own `Dialog`**, not a hand-rolled Base UI
 * popup. It has to be: a modal that does not look like every other dialog in
 * the app is a modal somebody will notice, and the styling would drift the
 * first time the kit is restyled.
 *
 * **Nothing renders while closed**, which is what makes the switch safe. The
 * server has no viewport, so `useMediaQuery` reports `false` on the first pass
 * and would briefly pick the sheet on a desktop — but by the time anybody has
 * opened this, the client has hydrated and the query is real. No flash, and no
 * mounting of both.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  if (!open) return null;

  if (!isDesktop) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        // `auto` first: a short form should not open to half the screen with a
        // void under it. The second point lets a taller one be dragged up.
        snapPoints={["auto", 0.92]}
      >
        <div className={cn("px-4 pb-6", className)}>{children}</div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {/*
           * Rendered only when there is one. An empty `DialogDescription`
           * still emits the element the dialog points `aria-describedby` at,
           * so a screen reader announces the title and then silence.
           */}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className={className}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
