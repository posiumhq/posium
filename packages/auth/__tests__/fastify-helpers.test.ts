/**
 * Unit tests for Fastify authorization helpers.
 *
 * These are pure functions that can be tested without database access.
 */

import { describe, expect, it } from "vitest";
import type { ApiKeyUser } from "../src/fastify/index.js";
import {
  canAccessProject,
  hasOrgWideAccess,
  getAccessibleProjects,
} from "../src/fastify/helpers.js";

/**
 * Helper to create an ApiKeyUser for testing.
 */
function createApiKeyUser(
  permissions: Record<string, string[]>,
  organizationId: string = "org_abc123"
): ApiKeyUser {
  return {
    userId: "usr_svc_123",
    organizationId,
    permissions,
    createdBy: "usr_456",
  };
}

describe("canAccessProject", () => {
  describe("with org-wide permissions", () => {
    it("allows access to projects in same org", () => {
      const user = createApiKeyUser({ "org:org_abc123": ["manage"] });

      // With projectOrgId matching user's org - allowed
      expect(canAccessProject(user, "prj_123", "org_abc123")).toBe(true);
      expect(canAccessProject(user, "prj_456", "org_abc123")).toBe(true);
      expect(canAccessProject(user, "prj_any", "org_abc123")).toBe(true);
    });

    it("denies org-wide access when projectOrgId not provided", () => {
      const user = createApiKeyUser({ "org:org_abc123": ["manage"] });

      // SECURITY: Without projectOrgId, we cannot verify org match - deny org-wide access
      // This forces callers to always provide projectOrgId for org-wide keys
      expect(canAccessProject(user, "prj_123")).toBe(false);
      expect(canAccessProject(user, "prj_456")).toBe(false);
    });

    it("denies access to projects in different org", () => {
      const user = createApiKeyUser({ "org:org_abc123": ["manage"] });

      // With projectOrgId NOT matching user's org - denied
      expect(canAccessProject(user, "prj_123", "org_different")).toBe(false);
      expect(canAccessProject(user, "prj_456", "org_other")).toBe(false);
    });

    it("respects required action parameter", () => {
      const user = createApiKeyUser({ "org:org_abc123": ["read"] });

      expect(canAccessProject(user, "prj_123", "org_abc123", "read")).toBe(true);
      expect(canAccessProject(user, "prj_123", "org_abc123", "write")).toBe(false);
      expect(canAccessProject(user, "prj_123", "org_abc123", "manage")).toBe(false);
    });

    it("allows when action is in permission array", () => {
      const user = createApiKeyUser({
        "org:org_abc123": ["read", "write", "manage"],
      });

      expect(canAccessProject(user, "prj_123", "org_abc123", "read")).toBe(true);
      expect(canAccessProject(user, "prj_123", "org_abc123", "write")).toBe(true);
      expect(canAccessProject(user, "prj_123", "org_abc123", "manage")).toBe(true);
      expect(canAccessProject(user, "prj_123", "org_abc123", "delete")).toBe(false);
    });
  });

  describe("with project-specific permissions", () => {
    it("allows access to specific project", () => {
      const user = createApiKeyUser({ "project:prj_123": ["manage"] });

      expect(canAccessProject(user, "prj_123")).toBe(true);
    });

    it("allows access when projectOrgId matches key org", () => {
      const user = createApiKeyUser({ "project:prj_123": ["manage"] });

      // Project is in same org as the key
      expect(canAccessProject(user, "prj_123", "org_abc123")).toBe(true);
    });

    it("denies access when projectOrgId differs from key org", () => {
      const user = createApiKeyUser({ "project:prj_123": ["manage"] });

      // SECURITY: Even if key has explicit project permission,
      // deny if projectOrgId shows it belongs to different org
      expect(canAccessProject(user, "prj_123", "org_different")).toBe(false);
    });

    it("denies access to other projects", () => {
      const user = createApiKeyUser({ "project:prj_123": ["manage"] });

      expect(canAccessProject(user, "prj_456")).toBe(false);
      expect(canAccessProject(user, "prj_other")).toBe(false);
    });

    it("allows access to multiple specified projects", () => {
      const user = createApiKeyUser({
        "project:prj_a": ["manage"],
        "project:prj_b": ["manage"],
        "project:prj_c": ["manage"],
      });

      expect(canAccessProject(user, "prj_a")).toBe(true);
      expect(canAccessProject(user, "prj_b")).toBe(true);
      expect(canAccessProject(user, "prj_c")).toBe(true);
      expect(canAccessProject(user, "prj_d")).toBe(false);
    });

    it("checks action for each project", () => {
      const user = createApiKeyUser({
        "project:prj_a": ["manage"],
        "project:prj_b": ["read"],
        "project:prj_c": ["read", "write"],
      });

      // prj_a has manage - default action
      expect(canAccessProject(user, "prj_a")).toBe(true);
      // prj_b has only read
      expect(canAccessProject(user, "prj_b", undefined, "read")).toBe(true);
      expect(canAccessProject(user, "prj_b", undefined, "manage")).toBe(false);
      // prj_c has read and write
      expect(canAccessProject(user, "prj_c", undefined, "read")).toBe(true);
      expect(canAccessProject(user, "prj_c", undefined, "write")).toBe(true);
      expect(canAccessProject(user, "prj_c", undefined, "manage")).toBe(false);
    });

    it("respects required action parameter", () => {
      const user = createApiKeyUser({ "project:prj_123": ["read"] });

      expect(canAccessProject(user, "prj_123", undefined, "read")).toBe(true);
      expect(canAccessProject(user, "prj_123", undefined, "write")).toBe(false);
      expect(canAccessProject(user, "prj_123", undefined, "manage")).toBe(false);
    });
  });

  describe("with empty permissions", () => {
    it("denies access to all projects", () => {
      const user = createApiKeyUser({});

      expect(canAccessProject(user, "prj_123")).toBe(false);
      expect(canAccessProject(user, "prj_456")).toBe(false);
    });
  });

  describe("with mixed permissions", () => {
    it("prefers org-wide over project-specific", () => {
      const user = createApiKeyUser({
        "org:org_abc123": ["manage"],
        "project:prj_123": ["read"],
      });

      // Should allow via org-wide, not just project-specific
      expect(canAccessProject(user, "prj_123", "org_abc123", "manage")).toBe(true);
      expect(canAccessProject(user, "prj_456", "org_abc123", "manage")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles different org ID format", () => {
      const user = createApiKeyUser(
        { "org:org_seed_acme": ["manage"] },
        "org_seed_acme"
      );

      // Must provide projectOrgId for org-wide access verification
      expect(canAccessProject(user, "prj_123", "org_seed_acme")).toBe(true);
    });

    it("denies access when org permission is for different org than user context", () => {
      // User claims to be from org_abc123 but has permission for org_different
      // This is a data integrity edge case that shouldn't happen in practice
      const user = createApiKeyUser(
        { "org:org_different": ["manage"] },
        "org_abc123"
      );

      // Should deny - the org permission doesn't match the user's organizationId
      expect(canAccessProject(user, "prj_123", "org_abc123")).toBe(false);
      // Also deny even if projectOrgId matches the permission's org
      expect(canAccessProject(user, "prj_123", "org_different")).toBe(false);
    });

    it("defaults to manage action", () => {
      const user = createApiKeyUser({ "project:prj_123": ["manage"] });

      // No action parameter - should default to "manage"
      expect(canAccessProject(user, "prj_123")).toBe(true);
    });
  });
});

describe("hasOrgWideAccess", () => {
  it("returns true for org-wide manage permission", () => {
    const user = createApiKeyUser({ "org:org_abc123": ["manage"] });

    expect(hasOrgWideAccess(user)).toBe(true);
  });

  it("returns false for project-only permissions", () => {
    const user = createApiKeyUser({ "project:prj_123": ["manage"] });

    expect(hasOrgWideAccess(user)).toBe(false);
  });

  it("returns false for empty permissions", () => {
    const user = createApiKeyUser({});

    expect(hasOrgWideAccess(user)).toBe(false);
  });

  it("checks specific action", () => {
    const user = createApiKeyUser({ "org:org_abc123": ["read"] });

    expect(hasOrgWideAccess(user, "read")).toBe(true);
    expect(hasOrgWideAccess(user, "write")).toBe(false);
    expect(hasOrgWideAccess(user, "manage")).toBe(false);
  });

  it("handles multiple actions in permission", () => {
    const user = createApiKeyUser({
      "org:org_abc123": ["read", "write", "manage"],
    });

    expect(hasOrgWideAccess(user, "read")).toBe(true);
    expect(hasOrgWideAccess(user, "write")).toBe(true);
    expect(hasOrgWideAccess(user, "manage")).toBe(true);
    expect(hasOrgWideAccess(user, "delete")).toBe(false);
  });

  it("checks correct org ID from user context", () => {
    // Permission for different org than user's organizationId
    const user = createApiKeyUser(
      { "org:org_other": ["manage"] },
      "org_abc123"
    );

    // Should return false because permission is for different org
    expect(hasOrgWideAccess(user)).toBe(false);
  });

  it("defaults to manage action", () => {
    const user = createApiKeyUser({ "org:org_abc123": ["manage"] });

    // No action parameter - should default to "manage"
    expect(hasOrgWideAccess(user)).toBe(true);
  });
});

describe("getAccessibleProjects", () => {
  it("returns null for org-wide access", () => {
    const user = createApiKeyUser({ "org:org_abc123": ["manage"] });

    expect(getAccessibleProjects(user)).toBeNull();
  });

  it("returns project IDs for project-scoped access", () => {
    const user = createApiKeyUser({
      "project:prj_123": ["manage"],
      "project:prj_456": ["manage"],
    });

    const result = getAccessibleProjects(user);

    expect(result).toEqual(expect.arrayContaining(["prj_123", "prj_456"]));
    expect(result?.length).toBe(2);
  });

  it("returns single project ID for single project access", () => {
    const user = createApiKeyUser({ "project:prj_123": ["manage"] });

    expect(getAccessibleProjects(user)).toEqual(["prj_123"]);
  });

  it("returns empty array for no project permissions", () => {
    const user = createApiKeyUser({});

    expect(getAccessibleProjects(user)).toEqual([]);
  });

  it("filters out non-project resources", () => {
    const user = createApiKeyUser({
      "other:resource": ["manage"],
      "project:prj_123": ["manage"],
      "random:thing": ["read"],
    });

    expect(getAccessibleProjects(user)).toEqual(["prj_123"]);
  });

  it("returns null when org-wide even with project permissions", () => {
    // If org-wide access exists, return null regardless of project permissions
    const user = createApiKeyUser({
      "org:org_abc123": ["manage"],
      "project:prj_123": ["manage"],
    });

    expect(getAccessibleProjects(user)).toBeNull();
  });

  it("handles project IDs with different formats", () => {
    const user = createApiKeyUser({
      "project:prj_seed_webapp": ["manage"],
      "project:prj_abc123": ["manage"],
    });

    const result = getAccessibleProjects(user);

    expect(result).toEqual(
      expect.arrayContaining(["prj_seed_webapp", "prj_abc123"])
    );
    expect(result?.length).toBe(2);
  });
});
