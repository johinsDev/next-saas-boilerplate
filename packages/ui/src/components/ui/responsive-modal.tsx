"use client";

import * as React from "react";

import { cn } from "../../cn";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "./drawer";
import { useIsMobile } from "../../hooks/use-mobile";

/**
 * ResponsiveModal — one modal, two presentations: a bottom **Drawer** (vaul) on
 * mobile and a centered medium **Dialog** (Base UI) on desktop, sharing the same
 * compound API so a screen writes its content once. Controlled only (`open` +
 * `onOpenChange`) — every consumer in this app drives modals from state. The
 * sub-parts pick the right primitive from context, so swapping `<Drawer>` /
 * `<DrawerContent>` / `<DrawerTitle>` … for the `ResponsiveModal*` equivalents
 * is a near 1:1 replacement.
 *
 * `ResponsiveModalContent` accepts `className` (both) plus `mobileClassName` /
 * `desktopClassName` for per-presentation tweaks (e.g. an immersive full-height
 * drawer that becomes an auto-height dialog). `ResponsiveModalClose` closes via
 * context (sidestepping vaul `asChild` vs Base UI `render`) and renders a
 * standardized secondary button the same size as the primary action.
 */

type ResponsiveModalContextValue = {
  isMobile: boolean;
  onOpenChange: (open: boolean) => void;
};

const ResponsiveModalContext =
  React.createContext<ResponsiveModalContextValue | null>(null);

function useResponsiveModal() {
  const ctx = React.useContext(ResponsiveModalContext);
  if (!ctx) {
    throw new Error(
      "ResponsiveModal.* must be used inside <ResponsiveModal>.",
    );
  }
  return ctx;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  dismissible,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mobile drawer only: allow swipe / outside-press to dismiss (default true). */
  dismissible?: boolean;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const value = React.useMemo(
    () => ({ isMobile, onOpenChange }),
    [isMobile, onOpenChange],
  );

  return (
    <ResponsiveModalContext.Provider value={value}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange} dismissible={dismissible}>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveModalContext.Provider>
  );
}

export function ResponsiveModalContent({
  className,
  mobileClassName,
  desktopClassName,
  overlayClassName,
  showCloseButton = true,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  mobileClassName?: string;
  desktopClassName?: string;
  /** Desktop dialog only: override the backdrop (e.g. a darker scrim when this
   *  modal opens stacked over another modal so it clearly reads as "on top"). */
  overlayClassName?: string;
  /** Desktop dialog only: render the top-right X (default true). */
  showCloseButton?: boolean;
}) {
  const { isMobile } = useResponsiveModal();

  if (isMobile) {
    return (
      <DrawerContent className={cn(className, mobileClassName)} {...props}>
        {children}
      </DrawerContent>
    );
  }

  return (
    <DialogContent
      showCloseButton={showCloseButton}
      overlayClassName={overlayClassName}
      className={cn(
        "flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
        className,
        desktopClassName,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveModalHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="responsive-modal-header"
      className={cn(
        "flex flex-col gap-1 p-4 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

export function ResponsiveModalFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="responsive-modal-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export function ResponsiveModalTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerTitle>) {
  const { isMobile } = useResponsiveModal();
  const Title = isMobile ? DrawerTitle : DialogTitle;
  return <Title className={className} {...props} />;
}

export function ResponsiveModalDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerDescription>) {
  const { isMobile } = useResponsiveModal();
  const Description = isMobile ? DrawerDescription : DialogDescription;
  return <Description className={className} {...props} />;
}

/**
 * Standardized close button — same size as the primary action so footers read
 * balanced. Closes via context, so it works under both primitives without the
 * `asChild` / `render` mismatch. Override `variant` / `className` if needed; for
 * a non-button close (e.g. an icon) use {@link ResponsiveModalCloseRaw}.
 */
export function ResponsiveModalClose({
  className,
  variant = "secondary",
  size = "lg",
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { onOpenChange } = useResponsiveModal();
  return (
    <Button
      variant={variant}
      size={size}
      className={cn("h-13 rounded-full text-base font-semibold", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onOpenChange(false);
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
