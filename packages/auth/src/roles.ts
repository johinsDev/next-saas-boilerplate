/**
 * Canonical role model for the next-saas-boilerplate monorepo.
 *
 * Every authorization decision (tRPC procedures, layouts, /api handlers,
 * UI conditional rendering) reads from this single source of truth.
 *
 * Storage: `member.role` in @saas/db. The column is `text` so the
 * runtime check uses string comparison — invalid values degrade to
 * `customer` (see `getUserRole` in ./server).
 *
 * The four personas:
 *
 * | Role | Member row? | Where they sign in | What they can do |
 * |------|-------------|---------------------|------------------|
 * | customer | no | apps/web (phone or Google) | Use the customer app: see card, manage their account |
 * | staff    | yes | apps/admin (Google) | Cashier ops: add stamps, look up customers |
 * | manager  | yes | apps/admin (Google) | Staff + invite/manage staff, configure rewards, read reports |
 * | owner    | yes | apps/admin (Google) | Manager + access dev tooling (outboxes, smoke pages) |
 */
export const ROLES = {
  customer: "customer",
  staff: "staff",
  manager: "manager",
  owner: "owner",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const STAFF_OR_ABOVE: readonly Role[] = [
  ROLES.staff,
  ROLES.manager,
  ROLES.owner,
];

export const MANAGER_OR_ABOVE: readonly Role[] = [ROLES.manager, ROLES.owner];

export const OWNER_ONLY: readonly Role[] = [ROLES.owner];

/**
 * Seniority ladder. Only meaningful for the three operator roles — `customer`
 * sits below the floor and is never an operator.
 */
const RANK: Record<Role, number> = {
  [ROLES.customer]: 0,
  [ROLES.staff]: 1,
  [ROLES.manager]: 2,
  [ROLES.owner]: 3,
};

/**
 * Every operator role at or above `min`, for fanning something out to "managers
 * and up". Returns concrete roles (not a predicate) so callers can push the
 * filter down into SQL with an `inArray`.
 */
export function rolesAtOrAbove(min: Role): Role[] {
  return STAFF_OR_ABOVE.filter((r) => RANK[r] >= RANK[min]);
}

const KNOWN_ROLES: readonly string[] = Object.values(ROLES);

/**
 * Narrows a free-text DB value to a known Role. Falls back to
 * `customer` for unknown values so misconfigured rows fail safe
 * (least privilege).
 */
export function coerceRole(value: string | null | undefined): Role {
  if (value && KNOWN_ROLES.includes(value)) return value as Role;
  return ROLES.customer;
}

export function isStaffRole(role: Role): boolean {
  return STAFF_OR_ABOVE.includes(role);
}
