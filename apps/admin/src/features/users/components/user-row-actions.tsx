"use client";

import { useTransition } from "react";
import { Menu } from "@base-ui/react/menu";
import { Ban, EllipsisVertical, KeyRound, Send, ShieldCheck, UserCog } from "lucide-react";
import { ALL_ROLES, ROLES, type Role } from "@saas/auth/roles";
import type { UserSummary } from "@saas/services/users/schemas";
import { cn, useToast } from "@saas/ui";

import {
  banUserAction,
  impersonateAction,
  resendInvitationAction,
  revokeSessionsAction,
  setUserRoleAction,
  unbanUserAction,
  type ActionResult,
} from "../users-actions";
import { roleLabel } from "./user-badges";

/**
 * What can be done to one row.
 *
 * On Base UI's `Menu`, which is already a dependency — shadcn's dropdown
 * arrives on Radix and would put a second primitive library in the tree for one
 * control.
 *
 * Every item calls a Server Action that guards itself. Nothing here decides who
 * may do what: hiding a button is a courtesy to the person looking at it, never
 * a control. `viewerIsOwner` only trims the menu to what will actually work.
 *
 * Results go to the toast stack rather than into the row. A message rendered
 * beside the trigger dies with the menu that closes over it, and the row
 * itself re-renders from the server the moment the action lands — taking any
 * message it was holding with it.
 */
export function UserRowActions({
  user,
  viewerId,
  viewerIsOwner,
  /** Roles this menu may assign. Every roster can move somebody anywhere. */
  roles = ALL_ROLES,
}: {
  user: UserSummary;
  viewerId: string;
  viewerIsOwner: boolean;
  roles?: readonly Role[];
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const who = user.name?.trim() || user.email || "that account";
  const isSelf = user.id === viewerId;

  /*
   * Somebody who has never followed their link has no sessions to revoke, and
   * impersonating them shows you an account nobody has set up. Offering either
   * is a menu that describes a different person from the one on the row.
   */
  const invited = user.status === "invited";

  const run = (action: () => Promise<ActionResult>, done: string) => {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        toast({ status: "success", title: done, description: who });
        return;
      }

      toast({
        status: "error",
        title: result.message,
        description: who,
        /*
         * A failure stays until it is dismissed. The successes are
         * confirmations of something already visible on the row behind them;
         * a failure is the only trace that nothing happened at all.
         */
        duration: Number.POSITIVE_INFINITY,
      });
    });
  };

  if (!viewerIsOwner) return null;

  return (
    <div className="flex items-center justify-end">
      <Menu.Root>
        <Menu.Trigger
          disabled={pending}
          className={cn(
            "flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
            "hover:border-border hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            pending && "opacity-50",
          )}
        >
          <EllipsisVertical aria-hidden className="size-4" />
          <span className="sr-only">Actions for {who}</span>
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={6}>
            <Menu.Popup className="min-w-52 rounded-lg border border-border bg-card p-1 shadow-lg outline-none">
              {roles.length > 0 && (
                <>
                  <Group label="Role">
                    {roles.map((role) => (
                      <Item
                        key={role}
                        icon={<UserCog aria-hidden className="size-3.5" />}
                        selected={user.role === role}
                        // The owner cannot demote themselves — they hold the
                        // only admin capability flag, so it is a one-way door
                        // out of the roster. The action refuses it too; this
                        // just greys it.
                        disabled={user.role === role || (isSelf && role !== ROLES.owner)}
                        onClick={() =>
                          run(() => setUserRoleAction(user.id, role), movedTo(user.role, role))
                        }
                      >
                        {roleLabel(role)}
                      </Item>
                    ))}
                  </Group>
                  <Separator />
                </>
              )}

              <Group label="Access">
                {user.status === "disabled" ? (
                  <Item
                    icon={<ShieldCheck aria-hidden className="size-3.5" />}
                    onClick={() => run(() => unbanUserAction(user.id), "Account re-enabled")}
                  >
                    Re-enable account
                  </Item>
                ) : (
                  <Item
                    icon={<Ban aria-hidden className="size-3.5" />}
                    destructive
                    disabled={isSelf}
                    onClick={() => run(() => banUserAction(user.id, ""), "Account disabled")}
                  >
                    Disable account
                  </Item>
                )}

                {invited ? (
                  <Item
                    icon={<Send aria-hidden className="size-3.5" />}
                    onClick={() =>
                      run(() => resendInvitationAction(user.id), "Invitation sent again")
                    }
                  >
                    Resend invitation
                  </Item>
                ) : (
                  <Item
                    icon={<KeyRound aria-hidden className="size-3.5" />}
                    onClick={() => run(() => revokeSessionsAction(user.id), "Sessions revoked")}
                  >
                    Revoke sessions
                  </Item>
                )}
              </Group>

              {!invited && (
                <>
                  <Separator />

                  <Group label="Impersonate">
                    <Item
                      icon={<UserCog aria-hidden className="size-3.5" />}
                      disabled={isSelf}
                      // No success toast: this redirects, and the band across
                      // the top of every page is a louder confirmation than a
                      // toast the navigation would unmount anyway.
                      onClick={() => run(() => impersonateAction(user.id), "")}
                    >
                      Sign in as this person
                    </Item>
                  </Group>
                </>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

/**
 * What to say after a role change.
 *
 * Crossing between `customer` and a staff role does not just relabel somebody —
 * it adds or removes their membership, so they leave the roster the change was
 * made on. Saying only "Now a manager" leaves whoever did it looking for a row
 * that has moved to the other screen.
 */
function movedTo(from: Role, to: Role): string {
  const wasStaff = from !== ROLES.customer;
  const isStaff = to !== ROLES.customer;

  if (!wasStaff && isStaff) return `Moved to staff as ${roleLabel(to).toLowerCase()}`;
  if (wasStaff && !isStaff) return "Moved to customers";
  return `Now a ${roleLabel(to).toLowerCase()}`;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Menu.Group>
      <Menu.GroupLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Menu.GroupLabel>
      {children}
    </Menu.Group>
  );
}

function Separator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}

function Item({
  icon,
  children,
  onClick,
  disabled,
  selected,
  destructive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  selected?: boolean;
  destructive?: boolean;
}) {
  return (
    <Menu.Item
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium outline-none transition-colors",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        destructive ? "text-destructive" : "text-foreground",
      )}
    >
      {icon}
      <span className="grow text-left">{children}</span>
      {selected && <span className="text-[10px] uppercase text-muted-foreground">current</span>}
    </Menu.Item>
  );
}
