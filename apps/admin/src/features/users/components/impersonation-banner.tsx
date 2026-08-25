"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { UserCog } from "lucide-react";

/**
 * The band itself, animated.
 *
 * It has to be a Client Component for the exit to exist at all. The obvious
 * version — a server component that stops rendering once the session changes —
 * cannot animate out, because by the time React knows it is gone the element
 * has already been replaced by the server's next render. It vanished mid-frame,
 * which is what looked abrupt.
 *
 * So leaving is driven from here: pressing the button hides the band on a
 * timed collapse *while* the Server Action runs. The redirect lands after,
 * and by then there is nothing left to unmount.
 *
 * Height and opacity together, not opacity alone. The band pushes the whole
 * page down; fading it out would leave the gap and then snap it shut.
 */
export function ImpersonationBanner({
  who,
  onStop,
}: {
  who: string;
  onStop: () => Promise<void>;
}) {
  const [leaving, setLeaving] = useState(false);
  const [, startTransition] = useTransition();
  const reduce = useReducedMotion() ?? false;

  return (
    <AnimatePresence initial={!reduce}>
      {!leaving && (
        <motion.div
          role="status"
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={
            reduce
              ? { duration: 0.12 }
              : // Slightly slower out than in. Arriving should be a jolt; the
                // way out should look like a decision being carried out.
                { height: { duration: 0.32 }, opacity: { duration: 0.24 } }
          }
          className="overflow-hidden border-b border-destructive/30 bg-destructive/10"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
            <UserCog aria-hidden className="size-4 shrink-0 text-destructive" />

            <p className="grow text-xs font-medium text-foreground">
              You are signed in as <strong className="font-bold">{who}</strong>. Everything you do is
              recorded against this account.
            </p>

            <button
              type="button"
              onClick={() => {
                setLeaving(true);
                // The action redirects, so nothing here runs after it. The
                // collapse above is what covers the round trip.
                startTransition(() => void onStop());
              }}
              className="rounded-md bg-destructive px-3 py-1 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Stop impersonating
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
