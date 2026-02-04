/**
 * Unit tests for API key utility functions.
 *
 * These are pure functions that can be tested without database access.
 */

import { describe, expect, it } from "vitest";
import {
  getServiceUserEmail,
  parseApiKeyMetadata,
  parsePermissions,
  buildPermissions,
  extractProjectIds,
  hasOrgPermission,
  buildMetadata,
} from "../src/server/api-key-utils.js";

describe("getServiceUserEmail", () => {
  it("generates deterministic email from orgId", () => {
    expect(getServiceUserEmail("org_abc123")).toBe(
      "service-account_org_abc123@posiumsystem.com"
    );
  });

  it("handles different org ID formats", () => {
    expect(getServiceUserEmail("org_seed_acme")).toBe(
      "service-account_org_seed_acme@posiumsystem.com"
    );
  });

  it("is deterministic - same input produces same output", () => {
    const email1 = getServiceUserEmail("org_test");
    const email2 = getServiceUserEmail("org_test");
    expect(email1).toBe(email2);
  });
});

describe("parseApiKeyMetadata", () => {
  it("parses valid JSON metadata", () => {
    const raw = JSON.stringify({
      organizationId: "org_123",
      createdBy: "usr_456",
      suffix: "x7k2m",
      scope: "org",
      projects: [],
    });

    const result = parseApiKeyMetadata(raw);

    expect(result).toEqual({
      organizationId: "org_123",
      createdBy: "usr_456",
      suffix: "x7k2m",
      scope: "org",
      projects: [],
    });
  });

  it("returns empty object for null input", () => {
    expect(parseApiKeyMetadata(null)).toEqual({});
  });

  it("returns empty object for invalid JSON", () => {
    expect(parseApiKeyMetadata("not-valid-json")).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parseApiKeyMetadata("")).toEqual({});
  });

  it("parses partial metadata", () => {
    const raw = JSON.stringify({ organizationId: "org_123" });
    const result = parseApiKeyMetadata(raw);

    expect(result).toEqual({ organizationId: "org_123" });
    expect(result.scope).toBeUndefined();
  });
});

describe("parsePermissions", () => {
  it("parses valid permissions JSON", () => {
    const raw = JSON.stringify({ "org:org_123": ["manage"] });
    const result = parsePermissions(raw);

    expect(result).toEqual({ "org:org_123": ["manage"] });
  });

  it("parses multiple permission entries", () => {
    const raw = JSON.stringify({
      "project:prj_a": ["manage"],
      "project:prj_b": ["read", "write"],
    });
    const result = parsePermissions(raw);

    expect(result).toEqual({
      "project:prj_a": ["manage"],
      "project:prj_b": ["read", "write"],
    });
  });

  it("returns empty object for null input", () => {
    expect(parsePermissions(null)).toEqual({});
  });

  it("returns empty object for invalid JSON", () => {
    expect(parsePermissions("invalid")).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parsePermissions("")).toEqual({});
  });
});

describe("buildPermissions", () => {
  it("builds org-wide permissions", () => {
    const result = buildPermissions("org", "org_123", []);

    expect(result).toEqual({ "org:org_123": ["manage"] });
  });

  it("builds project-scoped permissions for single project", () => {
    const result = buildPermissions("project", "org_123", ["prj_a"]);

    expect(result).toEqual({ "project:prj_a": ["manage"] });
  });

  it("builds project-scoped permissions for multiple projects", () => {
    const result = buildPermissions("project", "org_123", ["prj_a", "prj_b"]);

    expect(result).toEqual({
      "project:prj_a": ["manage"],
      "project:prj_b": ["manage"],
    });
  });

  it("ignores projectIds for org scope", () => {
    const result = buildPermissions("org", "org_123", ["prj_a", "prj_b"]);

    expect(result).toEqual({ "org:org_123": ["manage"] });
    expect(result["project:prj_a"]).toBeUndefined();
  });

  it("returns empty object for project scope with empty projectIds", () => {
    const result = buildPermissions("project", "org_123", []);

    expect(result).toEqual({});
  });
});

describe("extractProjectIds", () => {
  it("extracts project IDs from permissions", () => {
    const permissions = {
      "project:prj_a": ["manage"],
      "project:prj_b": ["manage"],
    };

    const result = extractProjectIds(permissions);

    expect(result).toEqual(expect.arrayContaining(["prj_a", "prj_b"]));
    expect(result.length).toBe(2);
  });

  it("returns empty array for org-wide permissions", () => {
    const permissions = { "org:org_123": ["manage"] };

    expect(extractProjectIds(permissions)).toEqual([]);
  });

  it("filters out non-project resources", () => {
    const permissions = {
      "org:org_123": ["manage"],
      "project:prj_a": ["manage"],
      "other:something": ["read"],
    };

    const result = extractProjectIds(permissions);

    expect(result).toEqual(["prj_a"]);
  });

  it("handles empty permissions", () => {
    expect(extractProjectIds({})).toEqual([]);
  });
});

describe("hasOrgPermission", () => {
  it("returns true for org-wide manage permission", () => {
    const permissions = { "org:org_123": ["manage"] };

    expect(hasOrgPermission(permissions, "org_123")).toBe(true);
  });

  it("returns false for project-only permissions", () => {
    const permissions = { "project:prj_123": ["manage"] };

    expect(hasOrgPermission(permissions, "org_123")).toBe(false);
  });

  it("returns false for different org", () => {
    const permissions = { "org:org_123": ["manage"] };

    expect(hasOrgPermission(permissions, "org_other")).toBe(false);
  });

  it("returns false for empty permissions", () => {
    expect(hasOrgPermission({}, "org_123")).toBe(false);
  });

  it("returns true regardless of action array contents", () => {
    const permissions = { "org:org_123": ["read"] };

    expect(hasOrgPermission(permissions, "org_123")).toBe(true);
  });
});

describe("buildMetadata", () => {
  it("builds complete metadata for org scope", () => {
    const result = buildMetadata("org_123", "usr_456", "x7k2m", "org", []);

    expect(result).toEqual({
      organizationId: "org_123",
      createdBy: "usr_456",
      suffix: "x7k2m",
      scope: "org",
      projects: [],
    });
  });

  it("builds complete metadata for project scope", () => {
    const result = buildMetadata(
      "org_123",
      "usr_456",
      "abc12",
      "project",
      ["prj_a", "prj_b"]
    );

    expect(result).toEqual({
      organizationId: "org_123",
      createdBy: "usr_456",
      suffix: "abc12",
      scope: "project",
      projects: ["prj_a", "prj_b"],
    });
  });

  it("returns empty projects array for org scope regardless of input", () => {
    const result = buildMetadata(
      "org_123",
      "usr_456",
      "x7k2m",
      "org",
      ["prj_a"] // This should be ignored
    );

    expect(result.projects).toEqual([]);
  });
});
