/**
 * Utility functions for API key operations.
 *
 * These are pure functions for parsing metadata and permissions
 * stored as JSON strings in the database.
 */

import type { ApiKeyMetadata } from "./types.js";

/**
 * Generate a deterministic service user email for an organization.
 *
 * @example
 * ```ts
 * getServiceUserEmail("org_abc123")
 * // => "service-account_org_abc123@posiumsystem.com"
 * ```
 */
export function getServiceUserEmail(orgId: string): string {
  return `service-account_${orgId}@posiumsystem.com`;
}

/**
 * Parse API key metadata from JSON string or object.
 * BetterAuth may return metadata as either a string (from text column)
 * or an object (from JSON column), so we handle both cases.
 * Returns empty object if parsing fails or input is null/empty.
 *
 * @example
 * ```ts
 * parseApiKeyMetadata('{"organizationId":"org_123","scope":"org"}')
 * // => { organizationId: "org_123", scope: "org" }
 *
 * parseApiKeyMetadata({ organizationId: "org_123", scope: "org" })
 * // => { organizationId: "org_123", scope: "org" }
 *
 * parseApiKeyMetadata(null)
 * // => {}
 * ```
 */
export function parseApiKeyMetadata(raw: string | object | null): Partial<ApiKeyMetadata> {
  if (!raw) return {};
  // Handle case where BetterAuth returns metadata as already-parsed object
  if (typeof raw === "object") return raw as Partial<ApiKeyMetadata>;
  try {
    return JSON.parse(raw) as Partial<ApiKeyMetadata>;
  } catch {
    return {};
  }
}

/**
 * Parse permissions from JSON string or object.
 * BetterAuth may return permissions as either a string (from text column)
 * or an object (from JSON column), so we handle both cases.
 * Returns empty object if parsing fails or input is null/empty.
 *
 * @example
 * ```ts
 * parsePermissions('{"org:org_123":["manage"]}')
 * // => { "org:org_123": ["manage"] }
 *
 * parsePermissions({ "org:org_123": ["manage"] })
 * // => { "org:org_123": ["manage"] }
 *
 * parsePermissions(null)
 * // => {}
 * ```
 */
export function parsePermissions(raw: string | object | null): Record<string, string[]> {
  if (!raw) return {};
  // Handle case where BetterAuth returns permissions as already-parsed object
  if (typeof raw === "object") return raw as Record<string, string[]>;
  try {
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

/**
 * Build permissions object for an API key.
 *
 * @example
 * ```ts
 * buildPermissions("org", "org_123", [])
 * // => { "org:org_123": ["manage"] }
 *
 * buildPermissions("project", "org_123", ["prj_a", "prj_b"])
 * // => { "project:prj_a": ["manage"], "project:prj_b": ["manage"] }
 * ```
 */
export function buildPermissions(
  scope: "org" | "project",
  orgId: string,
  projectIds: string[]
): Record<string, string[]> {
  const permissions: Record<string, string[]> = {};

  if (scope === "org") {
    permissions[`org:${orgId}`] = ["manage"];
  } else {
    for (const projectId of projectIds) {
      permissions[`project:${projectId}`] = ["manage"];
    }
  }

  return permissions;
}

/**
 * Extract project IDs from a permissions object.
 *
 * @example
 * ```ts
 * extractProjectIds({ "project:prj_a": ["manage"], "project:prj_b": ["manage"] })
 * // => ["prj_a", "prj_b"]
 *
 * extractProjectIds({ "org:org_123": ["manage"] })
 * // => []
 * ```
 */
export function extractProjectIds(permissions: Record<string, string[]>): string[] {
  return Object.keys(permissions)
    .filter((r) => r.startsWith("project:"))
    .map((r) => r.replace("project:", ""));
}

/**
 * Check if permissions include org-wide access.
 *
 * @example
 * ```ts
 * hasOrgPermission({ "org:org_123": ["manage"] }, "org_123")
 * // => true
 *
 * hasOrgPermission({ "project:prj_a": ["manage"] }, "org_123")
 * // => false
 * ```
 */
export function hasOrgPermission(
  permissions: Record<string, string[]>,
  orgId: string
): boolean {
  const orgResource = `org:${orgId}`;
  return permissions[orgResource] !== undefined;
}

/**
 * Build metadata object for an API key.
 */
export function buildMetadata(
  orgId: string,
  createdBy: string,
  suffix: string,
  scope: "org" | "project",
  projectIds: string[]
): ApiKeyMetadata {
  return {
    organizationId: orgId,
    createdBy,
    suffix,
    scope,
    projects: scope === "project" ? projectIds : [],
  };
}
