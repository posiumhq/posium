/**
 * Authorization helpers for API key-authenticated requests.
 *
 * These functions check whether an API key has permission to access
 * specific resources based on its permission structure.
 *
 * Permission format:
 * - Org-wide: { "org:org_123": ["manage"] }
 * - Project-scoped: { "project:prj_123": ["manage"], "project:prj_456": ["manage"] }
 */

import type { ApiKeyUser } from "./index.js";

/**
 * Check if an API key can access a specific project.
 *
 * Checks for org-wide access first, then project-specific.
 * Org-wide access grants access to all projects in the SAME org.
 *
 * @param apiKeyUser - The API key user context from request
 * @param projectId - The project ID to check access for
 * @param projectOrgId - The organization ID that owns the project (optional)
 * @param requiredAction - The action to check (default: "manage")
 * @returns true if the key has access
 *
 * @example
 * ```ts
 * // Org-wide key can access projects in same org
 * canAccessProject(
 *   { permissions: { "org:org_123": ["manage"] }, organizationId: "org_123", ... },
 *   "prj_456",
 *   "org_123"
 * ) // => true
 *
 * // Org-wide key CANNOT access projects in different org
 * canAccessProject(
 *   { permissions: { "org:org_123": ["manage"] }, organizationId: "org_123", ... },
 *   "prj_456",
 *   "org_456" // different org!
 * ) // => false
 *
 * // Project-scoped key can access its projects
 * canAccessProject(
 *   { permissions: { "project:prj_456": ["manage"] }, ... },
 *   "prj_456"
 * ) // => true
 * ```
 */
export function canAccessProject(
  apiKeyUser: ApiKeyUser,
  projectId: string,
  projectOrgId?: string,
  requiredAction: string = "manage"
): boolean {
  const perms = apiKeyUser.permissions;
  const keyOrgId = apiKeyUser.organizationId;

  // Check org-wide access - requires projectOrgId to verify org match
  const orgResource = `org:${keyOrgId}`;
  if (perms[orgResource]?.includes(requiredAction)) {
    // SECURITY: Only grant org-wide access if we can verify the project belongs
    // to the same organization. If projectOrgId is not provided, we cannot safely
    // assume the project is in the right org - fall through to project-specific check.
    if (projectOrgId && projectOrgId === keyOrgId) {
      return true;
    }
    // Either projectOrgId not provided or different org - check project-specific access
  }

  // Check project-specific access
  const projectResource = `project:${projectId}`;
  if (perms[projectResource]?.includes(requiredAction)) {
    // SECURITY: If projectOrgId is provided, verify the project belongs to
    // the same organization as the API key. This prevents cross-org access
    // even if a key somehow has permissions for projects in other orgs.
    if (projectOrgId && projectOrgId !== keyOrgId) {
      return false; // Project belongs to different org than the key
    }
    return true;
  }

  return false;
}

/**
 * Check if an API key has org-wide access.
 *
 * Org-wide keys have the format { "org:org_123": ["manage"] }
 * and can access all projects in the organization.
 *
 * @param apiKeyUser - The API key user context from request
 * @param requiredAction - The action to check (default: "manage")
 * @returns true if the key has org-wide access
 *
 * @example
 * ```ts
 * hasOrgWideAccess({ permissions: { "org:org_123": ["manage"] }, organizationId: "org_123", ... })
 * // => true
 *
 * hasOrgWideAccess({ permissions: { "project:prj_123": ["manage"] }, organizationId: "org_123", ... })
 * // => false
 * ```
 */
export function hasOrgWideAccess(
  apiKeyUser: ApiKeyUser,
  requiredAction: string = "manage"
): boolean {
  const orgResource = `org:${apiKeyUser.organizationId}`;
  return apiKeyUser.permissions[orgResource]?.includes(requiredAction) ?? false;
}

/**
 * Get all project IDs this API key can access.
 *
 * Returns null if the key has org-wide access (meaning all projects).
 * Returns an array of project IDs for project-scoped keys.
 *
 * @param apiKeyUser - The API key user context from request
 * @returns Array of project IDs, or null for org-wide access
 *
 * @example
 * ```ts
 * // Org-wide key returns null (all projects)
 * getAccessibleProjects({ permissions: { "org:org_123": ["manage"] }, ... })
 * // => null
 *
 * // Project-scoped key returns specific IDs
 * getAccessibleProjects({ permissions: { "project:prj_a": ["manage"], "project:prj_b": ["manage"] }, ... })
 * // => ["prj_a", "prj_b"]
 *
 * // Key with no permissions returns empty array
 * getAccessibleProjects({ permissions: {}, ... })
 * // => []
 * ```
 */
export function getAccessibleProjects(apiKeyUser: ApiKeyUser): string[] | null {
  // If org-wide access, return null to indicate "all projects"
  if (hasOrgWideAccess(apiKeyUser)) {
    return null;
  }

  // Extract project IDs from project: permissions
  return Object.keys(apiKeyUser.permissions)
    .filter((r) => r.startsWith("project:"))
    .map((r) => r.replace("project:", ""));
}
