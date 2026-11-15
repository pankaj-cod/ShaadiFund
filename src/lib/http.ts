import { ZodError } from "zod";
import { AppError, type ErrorCode } from "./errors";
import { logger } from "./logger";

/** Standard API envelope (docs/API.md). */
export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; fields?: Record<string, string> };
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, init);
}

function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Maps any thrown value to the standard error response. Unknown errors never leak details. */
export function toErrorResponse(error: unknown, context?: Record<string, unknown>): Response {
  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, fields: error.fields },
    };
    return Response.json(body, { status: error.status });
  }
  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Please check the highlighted fields.",
        fields: zodFields(error),
      },
    };
    return Response.json(body, { status: 400 });
  }
  logger.error("Unhandled error in route", { ...context, error });
  const body: ApiErrorBody = {
    error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." },
  };
  return Response.json(body, { status: 500 });
}

type Handler<Args extends unknown[]> = (request: Request, ...args: Args) => Promise<Response>;

/** Wraps a route handler so every error path returns the standard envelope. */
export function route<Args extends unknown[]>(handler: Handler<Args>): Handler<Args> {
  return async (request, ...args) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return toErrorResponse(error, {
        method: request.method,
        path: new URL(request.url).pathname,
      });
    }
  };
}
