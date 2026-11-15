/**
 * Typed application errors. Services throw these; the HTTP layer maps them to
 * the standard error response. Anything else is treated as an unexpected 500.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYMENT_ERROR"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  PAYMENT_ERROR: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Per-field messages for form validation errors. */
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fields = fields;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the highlighted fields.", fields?: Record<string, string>) {
    super("VALIDATION_ERROR", message, fields);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super("UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this.") {
    super("FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "We could not find that.") {
    super("NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many attempts. Please wait a moment and try again.") {
    super("RATE_LIMITED", message);
  }
}

export class PaymentError extends AppError {
  constructor(message: string) {
    super("PAYMENT_ERROR", message);
  }
}
