import type { Role } from "@saas/auth/roles";
import { Badge, cn } from "@saas/ui";
import type { Population, UserStatus, UserSummary } from "@saas/services/users/schemas";

/**
 * How a person's state and role appear, in one file.
 *
 * Together rather than inline, because the same vocabulary appears in the
 * table, on the cards, on the detail page and beside the filters — and a status
 * that reads one way in one place and another elsewhere is two different things
 * to whoever is reading it.
 */

/* ------------------------------------------------------------------ *
 * Status: not a badge.
 * ------------------------------------------------------------------ */

/**
 * **An active row says nothing at all.**
 *
 * That is the whole idea, and it is worth defending: a badge on every row
 * makes the common case shout as loudly as the exception, so nine "Active"
 * chips are nine things to read past before finding the one that matters.
 * Silence for the ordinary case turns the status column into a list of
 * exceptions, scannable down a single edge.
 *
 * `rail` is the colour of the row's left edge — transparent for active, so
 * anything visible on that edge is something to look at.
 */
const STATUS = {
  active: { label: "Active", rail: "transparent", text: "text-muted-foreground" },
  invited: { label: "Invited", rail: "var(--warning)", text: "text-[var(--warning)]" },
  banned: { label: "Banned", rail: "var(--destructive)", text: "text-destructive" },
  removed: { label: "Removed", rail: "rgb(86 48 12 / 0.35)", text: "text-muted-foreground" },
} as const satisfies Record<UserStatus, { label: string; rail: string; text: string }>;

export function statusRail(status: UserStatus): string {
  return STATUS[status].rail;
}

export function statusLabel(status: UserStatus): string {
  return STATUS[status].label;
}

/**
 * The word, and only when there is one worth saying.
 *
 * Renders nothing for an active account — see above. Everything else gets a
 * small uppercase word in its own colour, which is quieter than a filled chip
 * and reads faster because there is no pill outline competing with the text.
 */
export function StatusMark({ status, className }: { status: UserStatus; className?: string }) {
  if (status === "active") return null;

  return (
    <span
      className={cn(
        "text-[10.5px] font-semibold uppercase tracking-[0.06em]",
        STATUS[status].text,
        className,
      )}
    >
      {STATUS[status].label}
    </span>
  );
}

/**
 * Why the row is in that state, in one line.
 *
 * This is the half the old badge could not carry, and the reason `banned` and
 * `removed` were worth splitting: a ban has a reason and an author, a removed
 * membership has neither. Saying so on the row saves opening the person.
 */
export function StatusNote({ user }: { user: UserSummary }) {
  const note =
    user.status === "banned"
      ? user.banReason
        ? `“${user.banReason}”`
        : "Banned — no reason was recorded"
      : user.status === "removed"
        ? "Membership removed — assign a role to restore it"
        : user.status === "invited"
          ? "Invited — waiting on them"
          : null;

  if (!note) return null;

  return <span className={cn("text-[11.5px]", STATUS[user.status].text)}>{note}</span>;
}

/* ------------------------------------------------------------------ *
 * Role: still a badge, because it is an attribute rather than a state.
 * ------------------------------------------------------------------ */

const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  staff: "Staff",
  manager: "Manager",
  owner: "Owner",
};

/**
 * `customer` is the stored word; "Customer" is what it means here.
 *
 * The ladder is shared with a boilerplate whose fourth role really is a
 * customer. Renaming it in the database would be a migration for a word;
 * naming it correctly on screen costs one lookup.
 */
export function RoleBadge({ role }: { role: Role }) {
  /*
   * Only the owner is filled. There is exactly one, it is the only role that
   * can disable or impersonate anybody, and it should be findable in a list
   * without reading — the other three are outlines because their differences
   * are worth reading rather than glancing at.
   */
  return <Badge variant={role === "owner" ? "default" : "outline"}>{ROLE_LABEL[role]}</Badge>;
}

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

export function populationLabel(population: Population): string {
  return population === "staff" ? "Staff" : "Customers";
}
