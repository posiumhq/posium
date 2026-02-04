/**
 * Custom error classes for the core package.
 *
 * These errors provide consistent error handling across consumers
 * (tRPC, Fastify, etc.) with type-safe error codes and HTTP status mapping.
 */

/**
 * Error codes used across the core package.
 */
export const ErrorCode = {
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Base error for all core service errors.
 * Extends Error with additional metadata for HTTP/tRPC mapping.
 */
export class CoreError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "CoreError";
    // Maintains proper stack trace for where error was thrown (V8 engines)
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Resource not found error (404).
 */
export class NotFoundError extends CoreError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, ErrorCode.NOT_FOUND, 404);
    this.name = "NotFoundError";
  }
}

/**
 * User does not have permission to access resource (403).
 */
export class ForbiddenError extends CoreError {
  constructor(message = "You do not have permission to access this resource") {
    super(message, ErrorCode.FORBIDDEN, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * Resource already exists or constraint violation (409).
 */
export class ConflictError extends CoreError {
  constructor(message: string) {
    super(message, ErrorCode.CONFLICT, 409);
    this.name = "ConflictError";
  }
}

/**
 * Invalid input data (400).
 */
export class ValidationError extends CoreError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, 400);
    this.name = "ValidationError";
  }
}

/**
 * Unauthenticated request (401).
 */
export class UnauthorizedError extends CoreError {
  constructor(message = "Authentication required") {
    super(message, ErrorCode.UNAUTHORIZED, 401);
    this.name = "UnauthorizedError";
  }
}

// ============================================================================
// Error Mapping Utilities
// ============================================================================

/**
 * tRPC error code type (subset of actual tRPC codes we use).
 */
export type TRPCErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "INTERNAL_SERVER_ERROR";

/**
 * Maps CoreError to tRPC error codes.
 */
export function toTRPCCode(error: CoreError): TRPCErrorCode {
  switch (error.code) {
    case ErrorCode.NOT_FOUND:
      return "NOT_FOUND";
    case ErrorCode.FORBIDDEN:
      return "FORBIDDEN";
    case ErrorCode.CONFLICT:
      return "CONFLICT";
    case ErrorCode.VALIDATION_ERROR:
      return "BAD_REQUEST";
    case ErrorCode.UNAUTHORIZED:
      return "UNAUTHORIZED";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

/**
 * Maps CoreError to HTTP status code.
 */
export function toHttpStatus(error: CoreError): number {
  return error.statusCode;
}

/**
 * Type guard to check if an error is a CoreError.
 */
export function isCoreError(error: unknown): error is CoreError {
  return error instanceof CoreError;
}

/**
 * Wraps an unknown error into a CoreError.
 * Useful for catch blocks that need consistent error handling.
 */
export function wrapError(error: unknown): CoreError {
  if (error instanceof CoreError) {
    return error;
  }
  if (error instanceof Error) {
    return new CoreError(error.message, ErrorCode.INTERNAL_ERROR, 500);
  }
  return new CoreError(String(error), ErrorCode.INTERNAL_ERROR, 500);
}
