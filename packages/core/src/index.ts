/**
 * @posium/core - Reusable business logic and CRUD operations.
 *
 * This package provides the single source of truth for domain logic,
 * used by console (tRPC), api (Fastify), and other packages.
 *
 * @example
 * ```typescript
 * import {
 *   createContextFromSession,
 *   createProjectService,
 *   CoreError,
 *   toTRPCCode,
 * } from "@posium/core";
 *
 * const projectService = createProjectService();
 * const ctx = createContextFromSession(db, session, boss, orgId);
 *
 * try {
 *   const projects = await projectService.list(ctx);
 * } catch (error) {
 *   if (error instanceof CoreError) {
 *     throw new TRPCError({ code: toTRPCCode(error), message: error.message });
 *   }
 *   throw error;
 * }
 * ```
 */

// Context types and factories
export {
  type ServiceContext,
  type Actor,
  type OrgRole,
  getActorUserId,
  requireActorUserId,
  isSystemActor,
  createContextFromSession,
  createContextFromApiKey,
  createSystemContext,
  withOrgId,
  withDb,
} from "./context.js";

// Error types and utilities
export {
  CoreError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ErrorCode,
  type TRPCErrorCode,
  toTRPCCode,
  toHttpStatus,
  isCoreError,
  wrapError,
} from "./errors.js";

// Transaction utilities
export { withTransaction, withParallelTransaction } from "./transactions.js";

// Authorization utilities
export {
  requireOrgMembership,
  getOrgMembership,
  isOrgMember,
  isOrgAdmin,
  isOrgOwner,
  hasRole,
} from "./auth/index.js";

// Pagination utilities
export {
  type PaginationOptions,
  type SortingOptions,
  type DateRangeFilter,
  type PaginationMeta,
  type PaginatedResult,
  type NormalizedPagination,
  normalizePagination,
  buildPaginationMeta,
} from "./pagination/index.js";

// Services
export * from "./services/index.js";

// Crypto utilities
export {
  createCryptoService,
  getCryptoService,
  type CryptoService,
  type CryptoConfig,
} from "./crypto/index.js";
