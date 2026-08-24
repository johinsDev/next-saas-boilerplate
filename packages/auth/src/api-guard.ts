import { NextResponse } from "next/server";

import { coerceRole, type Role } from "./roles";
import { auth, getUserRole, type Session } from "./server";

/**
 * Auth helpers for Next.js Route Handlers (`app/api/**\/route.ts`).
 * Returns a discriminated union so callers do an early-return on
 * failure without `throw` ceremony:
 *
 *   export async function GET(req: Request) {
 *     const auth = await requireApiRole(req, OWNER_ONLY);
 *     if (!auth.ok) return auth.response;
 *     // auth.session.user.id available, auth.role typed as Role
 *   }
 *
 * Follows the Better Auth Next.js doc pattern of
 * `auth.api.getSession({ headers })` — same call we use in Server
 * Components, wrapped here for /api ergonomics.
 */

type Success = { ok: true; session: Session; role: Role };
type Failure = { ok: false; response: NextResponse };

export async function requireApiSession(
  req: Request,
): Promise<{ ok: true; session: Session } | Failure> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, session };
}

export async function requireApiRole(
  req: Request,
  allowed: readonly Role[],
): Promise<Success | Failure> {
  const sessionResult = await requireApiSession(req);
  if (!sessionResult.ok) return sessionResult;

  const role = await getUserRole(sessionResult.session.user.id);
  if (!allowed.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session: sessionResult.session, role: coerceRole(role) };
}
