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
          className="overflow-hidden border-b-2 border-destructive"
          /*
           * Hazard stripes, not a tinted bar.
           *
           * A flat coloured strip reads as branding within a minute — it is
           * exactly what a "pro plan" banner looks like — and this must never
           * be mistaken for theme. The stripes are 13% and 5%: enough to say
           * "this is a state", not enough to fight the text on top.
           */
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgb(163 48 42 / 0.13) 0 10px, rgb(163 48 42 / 0.05) 10px 20px)",
            backgroundColor: "rgb(163 48 42 / 0.1)",
          }}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive text-white"
            >
              <UserCog className="size-4" />
            </span>

            <p className="grow text-xs leading-tight">
              <span className="block font-bold text-foreground">
                You are signed in as <span className="text-destructive">{who}</span>
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Every action is recorded against this account
              </span>
            </p>

            <button
              type="button"
              onClick={() => {
                setLeaving(true);
                // The action redirects, so nothing here runs after it. The
                // collapse above is what covers the round trip.
                startTransition(() => void onStop());
              }}
              className="shrink-0 rounded-md bg-destructive px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Stop and go back to being me
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
