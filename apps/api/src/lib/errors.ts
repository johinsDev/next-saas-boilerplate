import { isServiceError, type ServiceErrorCode } from "@saas/services";

export type HttpError = {
  readonly status: number;
  readonly body: { readonly code: ServiceErrorCode; readonly message: string };
};

/**
 * Turns whatever a service raised into a response.
 *
 * A service raises a code, never a status: the same function runs behind a
 * Server Action, inside a Trigger.dev task and in a batch pipeline, where an
 * HTTP status would mean nothing. Mapping it belongs here, at the edge.
 *
 * Anything that is not a `ServiceError` is a bug, and a bug's message is for
 * the logs. Passing it through would hand the caller connection strings, file
 * paths and internal hostnames.
 */
export function toHttpError(error: unknown): HttpError {
  if (isServiceError(error)) {
    return { status: error.status, body: { code: error.code, message: error.message } };
  }

  return {
    status: 500,
    body: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong." },
  };
}
