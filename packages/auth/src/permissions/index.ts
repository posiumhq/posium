/**
 * Access Control & Permissions
 *
 * TODO: Implement centralized permission definitions
 *
 * Planned features:
 * - Define permission statements (project, run, member, etc.)
 * - Create role definitions (owner, admin, member)
 * - Permission checking utilities
 * - Integration with BetterAuth organization plugin
 *
 * @see .claude/skills/foundations/betterauth.md for access control patterns
 *
 * @example
 * ```ts
 * // Future API:
 * import { createAccessControl } from "better-auth/plugins/access";
 * import { ac, owner, admin, member } from "@posium/auth/permissions";
 *
 * // In auth config:
 * organization({
 *   ac,
 *   roles: { owner, admin, member },
 * })
 *
 * // In routes:
 * const canDelete = await auth.api.hasPermission({
 *   headers: req.headers,
 *   body: { permissions: { project: ["delete"] } },
 * });
 * ```
 */

// Placeholder exports - implement when needed

/**
 * Permission statements for access control.
 * Define what actions can be performed on which resources.
 */
export const statements = {
  // TODO: Define permission statements
  // organization: ["update", "delete"],
  // member: ["create", "update", "delete"],
  // invitation: ["create", "cancel"],
  // project: ["create", "read", "update", "delete"],
  // run: ["create", "read", "cancel"],
} as const;

/**
 * Role definitions mapping roles to permissions.
 */
export const roles = {
  // TODO: Define role mappings
  // owner: { ... },
  // admin: { ... },
  // member: { ... },
} as const;
