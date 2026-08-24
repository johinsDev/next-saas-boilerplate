/**
 * The error a service raises.
 *
 * Services must not throw transport errors. A transport error thrown from a service
 * is meaningless to a Server Action, to a Trigger.dev task, and to the batch
 * pipeline — all of which call the same service without any HTTP in sight. The
 * transport is what knows how to turn a code into a status.
 *
 * The codes map one-to-one onto HTTP statuses, so the edge stays a lookup rather
 * than a translation.
 */

export type ServiceErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR";

const STATUS: Record<ServiceErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  override readonly cause?: unknown;

  constructor({
    code,
    message,
    cause,
  }: {
    code: ServiceErrorCode;
    message?: string;
    cause?: unknown;
  }) {
    super(message ?? code);
    this.name = "ServiceError";
    this.code = code;
    this.cause = cause;
  }

  /** The HTTP status this code maps to, for the transport at the edge. */
  get status(): number {
    return STATUS[this.code];
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
