/**
 * Authorization helpers for API key management.
 *
 * These functions check whether a user has permission to perform
 * various API key operations based on their org role and project access.
 *
 * Authorization rules:
 * - Org admins/owners: Can create org-wide keys or keys for any project
 * - Org members: Can only create project-scoped keys for projects they have access to
 */

import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@posium/db/schema";
import type { AuthDatabase } from "./config.js";
import { getServiceUserEmail, parseApiKeyMetadata } from "./api-key-utils.js";

/**
 * Check if a user is an admin or owner of an organization.
 *
 * @example
 * ```ts
 * const isAdmin = await isOrgAdmin(db, "org_123", "usr_456");
 * // true if user has "admin" or "owner" role
 * ```
 */
export async function isOrgAdmin(
  db: AuthDatabase,
  orgId: string,
  userId: string
): Promise<boolean> {
  const member = await db.query.orgMember.findFirst({
    where: and(eq(schema.orgMember.orgId, orgId), eq(schema.orgMember.userId, userId)),
    columns: { role: true },
  });

  if (!member) return false;
  return ["admin", "owner"].includes(member.role);
}

/**
 * Check if a user has access to all specified projects.
 *
 * Access is determined by project membership via orgMember.
 * The user must be a member of all specified projects, AND
 * all projects must belong to the specified organization.
 *
 * @example
 * ```ts
 * const hasAccess = await canAccessProjects(db, "usr_123", "org_456", ["prj_a", "prj_b"]);
 * // true if user is a member of both projects AND both belong to org_456
 * ```
 */
export async function canAccessProjects(
  db: AuthDatabase,
  userId: string,
  orgId: string,
  projectIds: string[]
): Promise<boolean> {
  if (projectIds.length === 0) return true;

  // Verify all projects belong to the specified organization
  // This prevents cross-org key creation attacks
  const validProjects = await db.query.project.findMany({
    where: and(
      inArray(schema.project.id, projectIds),
      eq(schema.project.orgId, orgId)
    ),
    columns: { id: true },
  });

  if (validProjects.length !== projectIds.length) {
    return false; // Some projects don't belong to this org
  }

  // Find the user's org membership
  const orgMembership = await db.query.orgMember.findFirst({
    where: and(eq(schema.orgMember.orgId, orgId), eq(schema.orgMember.userId, userId)),
    columns: { id: true },
  });

  if (!orgMembership) return false;

  // Check if they're a member of all specified projects
  const projectMemberships = await db.query.projectMember.findMany({
    where: and(
      eq(schema.projectMember.orgMemberId, orgMembership.id),
      inArray(schema.projectMember.projectId, projectIds)
    ),
    columns: { projectId: true },
  });

  return projectMemberships.length === projectIds.length;
}

/**
 * Check if a user can create an API key with the given scope and projects.
 *
 * Rules:
 * - Org-wide keys require admin/owner role
 * - Project-scoped keys: any org member can create, but projects must belong to the org
 *
 * Note: Project membership is NOT checked for project-scoped keys.
 * Any org member can create keys for any project in their org.
 * This simplifies the authorization model while project membership UI is not implemented.
 *
 * @example
 * ```ts
 * const canCreate = await canCreateKey(db, "org_123", "usr_456", "project", ["prj_a"]);
 * ```
 */
export async function canCreateKey(
  db: AuthDatabase,
  orgId: string,
  userId: string,
  scope: "org" | "project",
  projectIds?: string[]
): Promise<boolean> {
  // Org-wide keys require admin
  if (scope === "org") {
    return isOrgAdmin(db, orgId, userId);
  }

  // Project-scoped keys: any org member can create
  // Just need to verify projectIds are provided and belong to this org
  if (!projectIds?.length) return false;

  // Verify all projects belong to the specified organization
  // This prevents cross-org key creation attacks
  const validProjects = await db.query.project.findMany({
    where: and(
      inArray(schema.project.id, projectIds),
      eq(schema.project.orgId, orgId)
    ),
    columns: { id: true },
  });

  return validProjects.length === projectIds.length;
}

/**
 * Check if a user can manage (update/delete) a specific API key.
 *
 * Rules:
 * - Org admins/owners can manage any key in the org
 * - Key creators can manage their own keys
 *
 * @example
 * ```ts
 * const canManage = await canManageKey(db, "org_123", "usr_456", "apikey_789");
 * ```
 */
export async function canManageKey(
  db: AuthDatabase,
  orgId: string,
  userId: string,
  keyId: string
): Promise<boolean> {
  // Admins can manage any key
  if (await isOrgAdmin(db, orgId, userId)) {
    return true;
  }

  // Verify user is still an org member (prevents removed users from managing old keys)
  const orgMembership = await db.query.orgMember.findFirst({
    where: and(eq(schema.orgMember.orgId, orgId), eq(schema.orgMember.userId, userId)),
    columns: { id: true },
  });

  if (!orgMembership) return false;

  // Get the service user for this org
  const email = getServiceUserEmail(orgId);
  const serviceUser = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
    columns: { id: true },
  });

  if (!serviceUser) return false;

  // Get the key
  const key = await db.query.apikey.findFirst({
    where: and(eq(schema.apikey.id, keyId), eq(schema.apikey.userId, serviceUser.id)),
    columns: { metadata: true },
  });

  if (!key) return false;

  // Check if user is the key creator
  const metadata = parseApiKeyMetadata(key.metadata);
  return metadata.createdBy === userId;
}

/**
 * Get all project IDs that a user can access in an organization.
 *
 * @example
 * ```ts
 * const projectIds = await getAccessibleProjectIds(db, "usr_123", "org_456");
 * // ["prj_a", "prj_b"]
 * ```
 */
export async function getAccessibleProjectIds(
  db: AuthDatabase,
  userId: string,
  orgId: string
): Promise<string[]> {
  // First, find the user's org membership
  const orgMembership = await db.query.orgMember.findFirst({
    where: and(eq(schema.orgMember.orgId, orgId), eq(schema.orgMember.userId, userId)),
    columns: { id: true },
  });

  if (!orgMembership) return [];

  // Get all projects they're a member of
  const projectMemberships = await db.query.projectMember.findMany({
    where: eq(schema.projectMember.orgMemberId, orgMembership.id),
    columns: { projectId: true },
  });

  return projectMemberships.map((pm: { projectId: string }) => pm.projectId);
}
