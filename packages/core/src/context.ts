/**
 * ServiceContext - Authorization context for all core service operations.
 *
 * Every service method receives a ServiceContext that contains:
 * - Database connection (which can be a transaction)
 * - Optional PgBoss instance for event publishing
 * - Actor information (who is making the request)
 * - Optional org scope for multi-tenant queries
 * - Optional auth instance for BetterAuth operations
 */

import type { DBType } from "@posium/db";
import type { PgBoss } from "@posium/boss";
import type { Auth } from "@posium/auth/server";

/**
 * Actor represents who is making the request.
 * Either a user (via session/JWT) or an API key.
 */
export type Actor =
  | { type: "user"; userId: string }
  | { type: "apiKey"; apiKeyId: string; createdBy: string }
  | { type: "system" }; // For internal/cron jobs

/**
 * Organization role hierarchy.
 */
export type OrgRole = "owner" | "admin" | "member";

/**
 * ServiceContext contains all information needed for authorization
 * and database access. Passed to every service method.
 */
export interface ServiceContext {
  /** Database connection (can be a transaction) */
  db: DBType;

  /** PgBoss instance for event publishing (optional for read-only operations) */
  boss?: PgBoss;

  /** The actor making the request */
  actor: Actor;

  /**
   * Active organization ID for scoped operations.
   * When set, queries are automatically filtered to this org.
   */
  orgId?: string;

  /**
   * Project IDs that the API key is allowed to access.
   * - undefined: No project restrictions (org-wide access or session-based auth)
   * - string[]: List of project IDs the API key can access
   *
   * Used to enforce project-scoped API key restrictions at the service layer.
   */
  allowedProjectIds?: string[];

  /**
   * BetterAuth instance for auth operations (e.g., org creation).
   * Optional - only needed for operations that use BetterAuth APIs.
   */
  auth?: Auth;

  /**
   * Cached org membership role for the current actor + orgId.
   * Lazily populated by authorization checks.
   * @internal
   */
  _orgRole?: OrgRole | null;

  /**
   * Request metadata for audit logging.
   */
  request?: {
    ip?: string;
    userAgent?: string;
    requestId?: string;
  };

  /**
   * HTTP headers for BetterAuth API calls that require user context.
   * Optional - only needed for invitation operations.
   */
  headers?: Headers;
}

/**
 * Get the userId from an actor.
 * For API keys, returns the user who created the key.
 * For system actors, returns undefined.
 */
export function getActorUserId(actor: Actor): string | undefined {
  switch (actor.type) {
    case "user":
      return actor.userId;
    case "apiKey":
      return actor.createdBy;
    case "system":
      return undefined;
  }
}

/**
 * Get the userId from an actor, throwing if it's a system actor.
 */
export function requireActorUserId(actor: Actor): string {
  const userId = getActorUserId(actor);
  if (!userId) {
    throw new Error("System actor cannot perform user-scoped operations");
  }
  return userId;
}

/**
 * Check if the actor is a system actor.
 */
export function isSystemActor(actor: Actor): actor is { type: "system" } {
  return actor.type === "system";
}

// ============================================================================
// Context Factory Functions
// ============================================================================

interface SessionLike {
  user: { id: string };
}

interface ApiKeyUserLike {
  id: string;
  createdBy: string;
  /**
   * Project IDs the API key is allowed to access.
   * - undefined/null: Org-wide access (all projects)
   * - string[]: List of allowed project IDs
   */
  allowedProjectIds?: string[] | null;
}

/**
 * Create a context from a tRPC/Next.js session.
 */
export function createContextFromSession(
  db: DBType,
  session: SessionLike,
  boss?: PgBoss,
  orgId?: string
): ServiceContext {
  return {
    db,
    boss,
    actor: { type: "user", userId: session.user.id },
    orgId,
  };
}

/**
 * Create a context from a Fastify API key authentication.
 */
export function createContextFromApiKey(
  db: DBType,
  apiKeyUser: ApiKeyUserLike,
  boss?: PgBoss,
  orgId?: string
): ServiceContext {
  return {
    db,
    boss,
    actor: {
      type: "apiKey",
      apiKeyId: apiKeyUser.id,
      createdBy: apiKeyUser.createdBy,
    },
    orgId,
    // Pass allowed project IDs for project-scoped API keys
    // undefined means org-wide access (no restrictions)
    allowedProjectIds: apiKeyUser.allowedProjectIds ?? undefined,
  };
}

/**
 * Create a context for system/internal operations.
 * Use sparingly - most operations should have a user context.
 */
export function createSystemContext(
  db: DBType,
  boss?: PgBoss,
  orgId?: string
): ServiceContext {
  return {
    db,
    boss,
    actor: { type: "system" },
    orgId,
  };
}

/**
 * Create a new context with a different orgId.
 * Useful when switching org context within a request.
 */
export function withOrgId(ctx: ServiceContext, orgId: string): ServiceContext {
  return {
    ...ctx,
    orgId,
    _orgRole: undefined, // Reset cached role for new org
  };
}

/**
 * Create a new context with a different database connection.
 * Used internally by withTransaction.
 */
export function withDb(ctx: ServiceContext, db: DBType): ServiceContext {
  return {
    ...ctx,
    db,
  };
}
