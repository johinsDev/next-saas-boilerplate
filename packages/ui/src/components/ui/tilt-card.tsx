"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import * as React from "react";

import { cn } from "../../cn";

/**
 * 3D tilt wrapper for the wallet cards. Desktop (mouse/trackpad): the card
 * tilts toward the cursor with a tracked glare, à la beui.dev's tilt-card.
 * Touch: hover doesn't exist, so the card tilts toward the finger while
 * pressed and springs back on release — no gyroscope, no permission prompts.
 * Inert under `prefers-reduced-motion`. Purely decorative: it wraps content
 * without intercepting its clicks/taps.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 12,
  glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
}) {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const glareOpacity = useMotionValue(0);

  const srx = useSpring(rx, { stiffness: 220, damping: 18 });
  const sry = useSpring(ry, { stiffness: 220, damping: 18 });
  const sGlare = useSpring(glareOpacity, { stiffness: 220, damping: 26 });

  const transform = useMotionTemplate`perspective(1000px) rotateX(${srx}deg) rotateY(${sry}deg)`;
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.35), transparent 55%)`;

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    // Mouse tilts on hover; touch only while pressed (see onPointerDown).
    if (e.pointerType === "touch" && e.buttons === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rx.set((0.5 - py) * 2 * maxTilt);
    ry.set((px - 0.5) * 2 * maxTilt);
    gx.set(px * 100);
    gy.set(py * 100);
    glareOpacity.set(1);
  };

  const rest = () => {
    rx.set(0);
    ry.set(0);
    glareOpacity.set(0);
  };

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={cn("relative", className)}
      style={{ transform, transformStyle: "preserve-3d" }}
      onPointerMove={track}
      onPointerDown={track}
      onPointerLeave={rest}
      onPointerUp={rest}
      onPointerCancel={rest}
    >
      {children}
      {glare ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
          style={{ background: glareBg, opacity: sGlare }}
        />
      ) : null}
    </motion.div>
  );
}
