/**
 * Organization membership authorization utilities.
 *
 * These functions check if the current actor has permission to access
 * organization resources based on their membership and role.
 */

import { eq, and } from "drizzle-orm";
import { schema } from "@posium/db";
import type { ServiceContext, OrgRole } from "../context.js";
import { getActorUserId, isSystemActor } from "../context.js";
import { ForbiddenError } from "../errors.js";

/**
 * Role hierarchy levels.
 * Higher number = more permissions.
 */
const ROLE_LEVELS: Record<OrgRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

/**
 * Check if a role has at least the required role level.
 */
export function hasRole(actual: OrgRole, required: OrgRole): boolean {
  return ROLE_LEVELS[actual] >= ROLE_LEVELS[required];
}

/**
 * Check if the current actor is a member of the organization.
 *
 * Caches the result in ctx._orgRole for subsequent checks within
 * the same request. Throws ForbiddenError if not a member.
 *
 * @param ctx - Service context
 * @param orgId - Organization ID to check membership for
 * @param requiredRole - Optional minimum role required
 * @returns The actor's role in the organization
 * @throws ForbiddenError if not a member or insufficient role
 *
 * @example
 * ```typescript
 * // Check basic membership
 * await requireOrgMembership(ctx, orgId);
 *
 * // Check admin access
 * await requireOrgMembership(ctx, orgId, "admin");
 *
 * // Check owner access
 * await requireOrgMembership(ctx, orgId, "owner");
 * ```
 */
export async function requireOrgMembership(
  ctx: ServiceContext,
  orgId: string,
  requiredRole?: OrgRole
): Promise<OrgRole> {
  // System actors have full access
  if (isSystemActor(ctx.actor)) {
    return "owner";
  }

  // Use cached result if available and for same org
  if (ctx.orgId === orgId && ctx._orgRole !== undefined) {
    if (ctx._orgRole === null) {
      throw new ForbiddenError("You are not a member of this organization");
    }
    if (requiredRole && !hasRole(ctx._orgRole, requiredRole)) {
      throw new ForbiddenError(`This action requires ${requiredRole} role`);
    }
    return ctx._orgRole;
  }

  const userId = getActorUserId(ctx.actor);
  if (!userId) {
    throw new ForbiddenError("Actor does not have a user ID");
  }

  // Note: No soft delete filter since we now use hard deletes for members
  const [membership] = await ctx.db
    .select({ role: schema.orgMember.role })
    .from(schema.orgMember)
    .where(
      and(
        eq(schema.orgMember.orgId, orgId),
        eq(schema.orgMember.userId, userId)
      )
    )
    .limit(1);

  const role = membership?.role as OrgRole | undefined;

  // Cache the result if this is the context's orgId
  if (ctx.orgId === orgId) {
    ctx._orgRole = role ?? null;
  }

  if (!role) {
    throw new ForbiddenError("You are not a member of this organization");
  }

  if (requiredRole && !hasRole(role, requiredRole)) {
    throw new ForbiddenError(`This action requires ${requiredRole} role`);
  }

  return role;
}

/**
 * Get org membership without throwing (for optional auth checks).
 *
 * @param ctx - Service context
 * @param orgId - Organization ID to check membership for
 * @returns The actor's role or null if not a member
 */
export async function getOrgMembership(
  ctx: ServiceContext,
  orgId: string
): Promise<OrgRole | null> {
  try {
    return await requireOrgMembership(ctx, orgId);
  } catch {
    return null;
  }
}

/**
 * Check if the actor is an org member (without throwing).
 */
export async function isOrgMember(
  ctx: ServiceContext,
  orgId: string
): Promise<boolean> {
  const role = await getOrgMembership(ctx, orgId);
  return role !== null;
}

/**
 * Check if the actor is an org admin or owner (without throwing).
 */
export async function isOrgAdmin(
  ctx: ServiceContext,
  orgId: string
): Promise<boolean> {
  const role = await getOrgMembership(ctx, orgId);
  return role !== null && hasRole(role, "admin");
}

/**
 * Check if the actor is the org owner (without throwing).
 */
export async function isOrgOwner(
  ctx: ServiceContext,
  orgId: string
): Promise<boolean> {
  const role = await getOrgMembership(ctx, orgId);
  return role === "owner";
}
