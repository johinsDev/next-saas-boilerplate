/**
 * The public surface of the users slice. Anything not exported here is internal
 * — in particular the repository, which no caller above this layer may reach.
 */

export type {
  OrderKey,
  Population,
  SortDirection,
  UserDetail,
  UserFacets,
  UserFilters,
  UserPage,
  UserSession,
  UserSort,
  UserStatus,
  UserSummary,
} from "./schemas";

export {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  POPULATIONS,
  SORT_DIRECTIONS,
  USER_SORTS,
  USER_STATUSES,
} from "./schemas";

export type { MembershipChange } from "./service";

export {
  changeUserRole,
  getUser,
  getUserFacets,
  getUserPage,
  inviteUser,
  normaliseFilters,
  planMembershipChange,
} from "./service";
