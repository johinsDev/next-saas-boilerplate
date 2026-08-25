import {
  createLoader,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { ALL_ROLES } from "@saas/auth/roles";
import {
  DEFAULT_FILTERS,
  SORT_DIRECTIONS,
  USER_SORTS,
  USER_STATUSES,
} from "@saas/services/users/schemas";

/**
 * The roster's state, as the URL carries it.
 *
 * Defined once and consumed by both halves: `loadUserSearchParams` parses it on
 * the server, `useQueryStates(userSearchParams)` binds the controls on the
 * client. Two parsers for one query string is how a filter ends up meaning one
 * thing to the table and another to the control above it.
 *
 * The vocabularies are the service's own arrays, so `?sort=password` is refused
 * by the same list the repository knows how to order by — and adding a sortable
 * column updates the parser, the control and the query together.
 *
 * `clearOnDefault` is nuqs's default and we rely on it: a filter at its default
 * value leaves no parameter behind, so the plain URL stays plain and two people
 * who filtered the same way share a link.
 *
 * **Population is not here.** Staff and customers are separate screens, so the
 * route decides it. Leaving it in the URL would let `/customers?population=staff`
 * contradict the page it is on, and one of the two would have to lose.
 */
export const userSearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(USER_STATUSES),
  role: parseAsStringLiteral(ALL_ROLES),
  sort: parseAsStringLiteral(USER_SORTS).withDefault(DEFAULT_FILTERS.sort),
  direction: parseAsStringLiteral(SORT_DIRECTIONS).withDefault(DEFAULT_FILTERS.direction),
  page: parseAsInteger.withDefault(1),
  /**
   * The invite panel. In the URL rather than in component state so the form
   * survives a refresh and can be linked to — and, more usefully, so returning
   * from an error does not silently discard what was typed.
   */
  invite: parseAsBoolean.withDefault(false),
};

export const loadUserSearchParams = createLoader(userSearchParams);

/** Everything except `invite`, which is UI state rather than a query filter. */
export type UserSearchParams = Awaited<ReturnType<typeof loadUserSearchParams>>;
