"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  AnimatedToastStack,
  useAnimatedToastStack,
  type ToastInput,
  type ToastPosition,
} from "./components/motion/animated-toast-stack";

/**
 * One toast stack for the whole app.
 *
 * beUI ships `useAnimatedToastStack` as local state, which is right for a demo
 * and wrong for an app: a toast raised by a row menu has to outlive the menu
 * that raised it, and two components each holding their own stack would stack
 * their toasts on top of each other in the same corner.
 *
 * So the hook is hoisted into a provider mounted once, and everything else
 * reaches it through `useToast`. The stack itself is `fixed` and portalled, so
 * it is not clipped by whatever overflow container the caller happens to be in
 * — which is the other thing that goes wrong when a toast lives beside its
 * trigger.
 */

type ToastApi = {
  /** Raise a toast. Returns its id, so a pending one can be updated in place. */
  toast: (input: ToastInput) => string;
  /** Replace a toast's contents — a "Saving…" that becomes "Saved". */
  updateToast: (id: string, patch: Partial<ToastInput>) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({
  children,
  position = "bottom-right",
}: {
  children: ReactNode;
  position?: ToastPosition;
}) {
  const { toasts, showToast, updateToast, dismissToast } = useAnimatedToastStack({
    /*
     * Four at once, then the oldest goes. A failed bulk action can raise one
     * per row, and a column of nine toasts is a wall nobody reads — the
     * useful signal is "several of these failed", which four still carries.
     */
    limit: 4,
  });

  const api = useMemo<ToastApi>(
    () => ({ toast: showToast, updateToast, dismissToast }),
    [showToast, updateToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position={position} fixed />
    </ToastContext.Provider>
  );
}

/**
 * Throws when there is no provider above.
 *
 * Deliberately not a silent no-op: a component that thinks it reported a
 * failure and did not is worse than one that crashes in development, because
 * the failure it was reporting is the thing nobody hears about.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used within <ToastProvider>");
  return api;
}
