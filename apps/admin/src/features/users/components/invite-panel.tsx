"use client";

import { useQueryStates } from "nuqs";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ROLES, type Role } from "@saas/auth/roles";
import { Button, Choicebox, MotionInput, ResponsiveModal, useToast, type ChoiceboxOption } from "@saas/ui";

import { inviteUserAction } from "../users-actions";
import { userSearchParams } from "../users-search-params";
import { roleLabel } from "./user-badges";

/**
 * The schema, at module scope.
 *
 * Not inside the component: a fresh `zodResolver` on every render thrashes
 * validation. Same reason as the sign-in form, and the same shape of rule — the
 * address is trimmed *before* the checks, so what is validated and what is sent
 * are one string.
 */
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter the address to invite.")
    .email("That does not look like an email address."),
  name: z.string().trim().max(80, "That name is longer than we can show."),
  role: z.enum(["customer", "staff", "manager", "owner"]),
});

type InviteValues = z.infer<typeof inviteSchema>;

/**
 * Invite somebody.
 *
 * A dialog on a desktop and a drag-to-dismiss sheet on a phone, from one
 * `ResponsiveModal` — the difference is not styling: a centred box on a phone
 * puts a form half behind the keyboard with nowhere to scroll.
 *
 * Open state lives in the URL (`?invite=1`) rather than in component state, so
 * a refresh does not silently throw away what was typed, and the panel can be
 * linked to.
 *
 * What it actually does is worth knowing: it **creates the account** and then
 * sends a magic link. Magic-link sign-in runs with `disableSignUp: true`, so a
 * link to an address with no account is refused on redemption — creating the
 * row first makes the link itself the acceptance. There is no second table and
 * no accept page, and "invited" stays a derived state rather than a record that
 * can disagree with reality.
 */
export function InviteModal({
  roles,
  fixedRole,
}: {
  /** Roles offered. Omitted when `fixedRole` is set. */
  roles?: readonly Role[];
  /** The customers roster invites customers and nothing else, so it says so. */
  fixedRole?: Role;
}) {
  const [{ invite }, setParams] = useQueryStates(userSearchParams);
  const { toast } = useToast();

  const defaultRole = fixedRole ?? roles?.[0] ?? ROLES.staff;
  const close = () => setParams({ invite: null });

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", name: "", role: defaultRole },
  });


  async function send(values: InviteValues) {
    const result = await inviteUserAction(values);

    if (!result.ok) {
      // A form-level problem — the address may be perfectly valid and already
      // taken — so it stays on the form rather than becoming a toast the modal
      // would cover. The person can fix it without losing what they typed.
      setError("root", { message: result.message });
      return;
    }

    /*
     * Toast, then close. The confirmation has to outlive the modal or it goes
     * with it, and what somebody wants next is to see the new row appear on
     * the roster behind — not to dismiss a panel that is now empty.
     */
    toast({
      status: "success",
      title: "Invitation sent",
      description: values.email,
    });
    reset({ email: "", name: "", role: values.role });
    close();
  }

  return (
    <ResponsiveModal
      open={invite}
      onOpenChange={(next) => setParams({ invite: next ? true : null })}
      title="Invite somebody"
      description="Creates the account and emails a sign-in link. They show as Invited until they follow it."
    >
      <form onSubmit={handleSubmit(send)} noValidate className="flex flex-col gap-4">
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <MotionInput
              label="Email"
              type="email"
              autoComplete="off"
              value={field.value}
              // beUI's input hands back a string, not an event.
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message}
              disabled={isSubmitting}
            />
          )}
        />

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <MotionInput
              label="Name (optional)"
              autoComplete="off"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.name?.message}
              disabled={isSubmitting}
            />
          )}
        />

        {roles && roles.length > 0 && !fixedRole && (
          <fieldset className="flex flex-col gap-2">
            {/* A plain `<legend>`: our `Label` renders a `<label>`, and a label
                pointing at a group of radios has nothing to be `for`. */}
            <legend className="text-xs font-semibold text-foreground">
              What they will be able to do
            </legend>

            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                /*
                 * Cards rather than pills, because here the choice *is* the
                 * explanation: picking a role is choosing what somebody can do,
                 * and a row of four words assumes you already know. The
                 * descriptions are what stop the form needing a paragraph
                 * underneath it.
                 */
                <Choicebox
                  value={field.value}
                  onValueChange={field.onChange}
                  options={roles.map(roleOption)}
                />
              )}
            />
          </fieldset>
        )}

        {fixedRole === ROLES.customer && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A player account: no membership row, and no access to this admin.
          </p>
        )}

        {errors.root && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send invitation"}
          </Button>
          <Button type="button" variant="ghost" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

/**
 * What each role actually grants, in one line.
 *
 * Written out rather than generated, because the useful sentence is not the
 * role's name reworded — it is the thing somebody is about to hand over.
 */
const ROLE_DESCRIPTION: Record<string, string> = {
  customer: "Plays the game. No access to this admin at all.",
  staff: "Reviews generated cases and draws boards.",
  manager: "Everything staff can do, plus inviting other people.",
  owner: "Everything, including disabling accounts and signing in as other people.",
};

function roleOption(role: Role): ChoiceboxOption<Role> {
  return { value: role, label: roleLabel(role), description: ROLE_DESCRIPTION[role] };
}

/** The button that opens it. Separate so the page can put it in its header. */
export function InviteTrigger({ label = "Invite somebody" }: { label?: string }) {
  const [, setParams] = useQueryStates(userSearchParams);

  return <Button onClick={() => setParams({ invite: true })}>{label}</Button>;
}
