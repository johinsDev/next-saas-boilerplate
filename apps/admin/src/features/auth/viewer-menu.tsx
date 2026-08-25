"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "@saas/auth/client";
import {
  cn,
  MotionPopover,
  MotionPopoverContent,
  MotionPopoverTrigger,
  ThemeChoice,
} from "@saas/ui";

/**
 * Who you are, and the way out — at the foot of the sidebar.
 *
 * Both belong together: an admin that never says whose session you are in is
 * how somebody edits a board from a colleague's account without noticing. At
 * the foot rather than in the header because that is where the answer to
 * "which account is this" is looked for, and because the header is where a
 * screen puts its own controls.
 *
 * The contents are **only what exists**. A menu of Docs, Changelog and Help
 * links pointing at pages nobody has written is worse than a short one: it
 * teaches people the menu lies. Those entries arrive when their pages do.
 */
export function ViewerMenu({
  email,
  name,
  role,
  impersonating,
}: {
  email: string;
  name: string | null;
  role: string;
  impersonating: boolean;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false);

  const label = name?.trim() || email;

  return (
    <MotionPopover
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="start"
      // A detached panel, not a blob with a neck.
      //
      // beUI's default melts the panel out of its trigger — `gooStrength`
      // feeds a Gaussian blur, and the sharpening pass behind it fuses two
      // shapes that are close into one, which is what draws the tail. Zero
      // means no blur, so nothing fuses and the panel simply opens. The
      // morph itself is untouched.
      gooStrength={0}
      // Enough gap that the panel reads as its own surface.
      sideOffset={12}
    >
      <MotionPopoverTrigger>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors",
            "hover:border-border hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50",
            open && "border-border bg-card",
          )}
        >
          <Avatar label={label} impersonating={impersonating} />

          <span className="flex min-w-0 grow flex-col leading-tight">
            <span className="truncate text-xs font-semibold text-foreground">{label}</span>
            <span className="truncate text-[11px] text-muted-foreground">{email}</span>
          </span>

          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-90",
              "motion-reduce:transition-none",
            )}
          />
        </button>
      </MotionPopoverTrigger>

      <MotionPopoverContent className="w-64 p-0">
        <header className="flex items-start gap-2.5 px-3 py-3">
          <Avatar label={label} impersonating={impersonating} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-foreground">{label}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </span>
        </header>

        <div className="border-t border-border">
          <Row label="Role">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
              {role}
            </span>
          </Row>

          <Row label="Theme">
            <ThemeChoice />
          </Row>
        </div>

        <div className="border-t border-border p-1">
          <Action
            icon={<LayoutDashboard aria-hidden className="size-3.5" />}
            onClick={() => {
              setOpen(false);
              router.push("/dashboard");
            }}
          >
            Dashboard
          </Action>

          <Action
            icon={<LogOut aria-hidden className="size-3.5" />}
            disabled={leaving}
            onClick={() => {
              setLeaving(true);
              void signOut().then(() => {
                /*
                 * `refresh()` before `replace()`: the session lives in a cookie
                 * the server read while rendering, so without dropping that
                 * cache the next page would still be built from the signed-in
                 * one.
                 */
                router.refresh();
                router.replace("/sign-in");
              });
            }}
          >
            {leaving ? "Signing out…" : "Sign out"}
          </Action>
        </div>
      </MotionPopoverContent>
    </MotionPopover>
  );
}

/**
 * Ringed while impersonating.
 *
 * The band across the top already says so, but this is the control that claims
 * to be *you* — leaving it unmarked is what makes an impersonated session feel
 * like your own one screen later.
 */
function Avatar({ label, impersonating }: { label: string; impersonating: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold uppercase",
        impersonating
          ? "bg-destructive text-white ring-2 ring-destructive/40 ring-offset-2 ring-offset-background"
          : "bg-primary text-primary-foreground",
      )}
    >
      {initials(label)}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
    </div>
  );
}

function Action({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {icon}
      <span className="grow text-left">{children}</span>
    </button>
  );
}

function initials(label: string): string {
  const [first = "", second = ""] = label.replace(/@.*/, "").split(/[\s._-]+/);
  return ((first[0] ?? "") + (second[0] ?? "")).trim().slice(0, 2) || label.slice(0, 2);
}
