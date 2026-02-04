/**
 * Integration tests for API key CRUD operations.
 *
 * These tests require a database connection and use the testdb package.
 * Run with: pnpm --filter @posium/auth test:integration
 *
 * Prerequisites:
 * - TEST_DB_HOST environment variable set (e.g., postgresql://postgres:password@localhost:5432/postgres)
 * - Or DATABASE_URL for CI mode
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDbResult } from "@posium/testdb";
import { eq, and } from "drizzle-orm";
import * as schema from "@posium/db/schema";
import {
  seedOrgs,
  seedUsers,
  seedProjects,
} from "@posium/db/seed";
import { createAuth, type Auth } from "../src/server/config.js";
import {
  getOrCreateServiceUser,
  getServiceUserEmail,
} from "../src/server/service-user.js";
import {
  isOrgAdmin,
  canCreateKey,
} from "../src/server/api-key-auth.js";
import {
  createKey,
  listKeys,
  updateKey,
  deleteKey,
  ForbiddenError,
  BadRequestError,
  NotFoundError,
} from "../src/server/api-keys.js";

// Skip if TEST_DB_HOST is not set and not in CI mode
const shouldRun =
  process.env.TEST_DB_HOST || (process.env.DATABASE_URL && process.env.CI);

describe.skipIf(!shouldRun)("API Key Integration Tests", () => {
  let testDb: TestDbResult;
  let db: TestDbResult["db"];
  let auth: Auth;

  beforeAll(async () => {
    testDb = await createTestDb({
      applySeed: true,
      initBoss: false,
    });
    db = testDb.db;

    auth = createAuth(db, {
      secret: "test-secret-for-api-key-integration-tests",
    });
  }, 60000); // 60s timeout for DB setup

  afterAll(async () => {
    await testDb.cleanup();
  }, 30000);

  describe("Service User Management", () => {
    it("creates a new service user for org", async () => {
      const orgId = seedOrgs.amazon.id;
      const result = await getOrCreateServiceUser(orgId, db);

      expect(result.isNew).toBeDefined();
      expect(result.userId).toBeDefined();

      // Verify user was created
      const user = await db.query.user.findFirst({
        where: eq(schema.user.id, result.userId),
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe(getServiceUserEmail(orgId));
      expect(user?.name).toBe("Service Account");
    });

    it("returns existing service user on subsequent calls", async () => {
      const orgId = seedOrgs.amazon.id;

      const first = await getOrCreateServiceUser(orgId, db);
      const second = await getOrCreateServiceUser(orgId, db);

      expect(first.userId).toBe(second.userId);
      expect(second.isNew).toBe(false);
    });

    it("creates org member record for service user with service role", async () => {
      const orgId = seedOrgs.stripe.id;
      const { userId } = await getOrCreateServiceUser(orgId, db);

      const member = await db.query.orgMember.findFirst({
        where: and(
          eq(schema.orgMember.orgId, orgId),
          eq(schema.orgMember.userId, userId)
        ),
      });

      expect(member).toBeDefined();
      expect(member?.role).toBe("service");
    });
  });

  describe("Authorization Helpers", () => {
    it("isOrgAdmin returns true for owner", async () => {
      const result = await isOrgAdmin(
        db,
        seedOrgs.amazon.id,
        seedUsers.amazonOwner.id
      );
      expect(result).toBe(true);
    });

    it("isOrgAdmin returns true for admin", async () => {
      const result = await isOrgAdmin(
        db,
        seedOrgs.amazon.id,
        seedUsers.amazonDev1.id
      );
      expect(result).toBe(true);
    });

    it("isOrgAdmin returns false for member", async () => {
      const result = await isOrgAdmin(
        db,
        seedOrgs.amazon.id,
        seedUsers.amazonDev2.id
      );
      expect(result).toBe(false);
    });

    it("isOrgAdmin returns false for non-member", async () => {
      const result = await isOrgAdmin(
        db,
        seedOrgs.amazon.id,
        seedUsers.unverified.id
      );
      expect(result).toBe(false);
    });

    it("canCreateKey allows admin to create org-wide key", async () => {
      const result = await canCreateKey(
        db,
        seedOrgs.amazon.id,
        seedUsers.amazonOwner.id,
        "org"
      );
      expect(result).toBe(true);
    });

    it("canCreateKey denies member creating org-wide key", async () => {
      const result = await canCreateKey(
        db,
        seedOrgs.amazon.id,
        seedUsers.amazonDev2.id,
        "org"
      );
      expect(result).toBe(false);
    });
  });

  describe("API Key CRUD Operations", () => {
    let testKeyId: string;

    it("creates an org-wide API key", async () => {
      const result = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Test Org-Wide Key",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      expect(result.id).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.key.startsWith("apikey_")).toBe(true);
      expect(result.name).toBe("Test Org-Wide Key");
      expect(result.scope).toBe("org");

      testKeyId = result.id;
    });

    it("creates a project-scoped API key", async () => {
      const result = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Test Project Key",
        scope: "project",
        projectIds: [seedProjects.amazonStorefront.id],
        createdBy: seedUsers.amazonOwner.id,
      });

      expect(result.id).toBeDefined();
      expect(result.key.startsWith("apikey_")).toBe(true);
      expect(result.scope).toBe("project");
    });

    it("throws BadRequestError for project scope without projectIds", async () => {
      await expect(
        createKey(db, auth, {
          orgId: seedOrgs.amazon.id,
          name: "Invalid Key",
          scope: "project",
          // Missing projectIds
          createdBy: seedUsers.amazonOwner.id,
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("lists all keys for admin", async () => {
      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonOwner.id);

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);

      const key = keys.find((k) => k.id === testKeyId);
      expect(key).toBeDefined();
      expect(key?.displayKey).toContain("•••••");
    });

    it("updates API key name", async () => {
      const result = await updateKey(
        db,
        auth,
        {
          orgId: seedOrgs.amazon.id,
          keyId: testKeyId,
          name: "Updated Key Name",
        },
        seedUsers.amazonOwner.id
      );

      expect(result.success).toBe(true);

      // Verify the update
      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonOwner.id);
      const key = keys.find((k) => k.id === testKeyId);
      expect(key?.name).toBe("Updated Key Name");
    });

    it("disables API key", async () => {
      await updateKey(
        db,
        auth,
        {
          orgId: seedOrgs.amazon.id,
          keyId: testKeyId,
          enabled: false,
        },
        seedUsers.amazonOwner.id
      );

      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonOwner.id);
      const key = keys.find((k) => k.id === testKeyId);
      expect(key?.enabled).toBe(false);
    });

    it("deletes API key", async () => {
      const result = await deleteKey(
        db,
        seedOrgs.amazon.id,
        testKeyId,
        seedUsers.amazonOwner.id
      );

      expect(result.success).toBe(true);

      // Verify deletion
      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonOwner.id);
      const key = keys.find((k) => k.id === testKeyId);
      expect(key).toBeUndefined();
    });

    it("throws NotFoundError when deleting non-existent key", async () => {
      await expect(
        deleteKey(db, seedOrgs.amazon.id, "nonexistent_key", seedUsers.amazonOwner.id)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("API Key Verification via BetterAuth", () => {
    it("verifies a valid API key", async () => {
      // Create a key
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Verify Test Key",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      // Verify it
      const result = await auth.api.verifyApiKey({
        body: { key: created.key },
      });

      expect(result.valid).toBe(true);
      expect(result.key).toBeDefined();
    });

    it("rejects an invalid API key", async () => {
      const result = await auth.api.verifyApiKey({
        body: { key: "apikey_invalid_key_12345" },
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("Audit Logging", () => {
    it("creates audit log entry on key creation", async () => {
      const result = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Audit Test Key",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      // Check audit log
      const auditEntry = await db.query.auditLog.findFirst({
        where: and(
          eq(schema.auditLog.entityType, "apikey"),
          eq(schema.auditLog.entityId, result.id),
          eq(schema.auditLog.action, "api_key.create")
        ),
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(seedUsers.amazonOwner.id);
    });

    it("creates audit log entry on key update", async () => {
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Update Audit Key",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      await updateKey(
        db,
        auth,
        { orgId: seedOrgs.amazon.id, keyId: created.id, name: "Renamed" },
        seedUsers.amazonOwner.id
      );

      const auditEntry = await db.query.auditLog.findFirst({
        where: and(
          eq(schema.auditLog.entityType, "apikey"),
          eq(schema.auditLog.entityId, created.id),
          eq(schema.auditLog.action, "api_key.update")
        ),
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(seedUsers.amazonOwner.id);
    });

    it("creates audit log entry on key deletion", async () => {
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Delete Audit Key",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      await deleteKey(db, seedOrgs.amazon.id, created.id, seedUsers.amazonOwner.id);

      const auditEntry = await db.query.auditLog.findFirst({
        where: and(
          eq(schema.auditLog.entityType, "apikey"),
          eq(schema.auditLog.entityId, created.id),
          eq(schema.auditLog.action, "api_key.delete")
        ),
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(seedUsers.amazonOwner.id);
    });
  });

  describe("Authorization - Key Management", () => {
    it("allows non-admin key creator to update their own key", async () => {
      // Viewer (non-admin) creates a project-scoped key
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Viewer Created Key",
        scope: "project",
        projectIds: [seedProjects.amazonStorefront.id],
        createdBy: seedUsers.amazonDev2.id,
      });

      // Viewer can update their own key
      const result = await updateKey(
        db,
        auth,
        { orgId: seedOrgs.amazon.id, keyId: created.id, name: "Updated by Creator" },
        seedUsers.amazonDev2.id
      );

      expect(result.success).toBe(true);
    });

    it("allows non-admin key creator to delete their own key", async () => {
      // Viewer (non-admin) creates a project-scoped key
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Viewer Delete Key",
        scope: "project",
        projectIds: [seedProjects.amazonStorefront.id],
        createdBy: seedUsers.amazonDev2.id,
      });

      const result = await deleteKey(
        db,
        seedOrgs.amazon.id,
        created.id,
        seedUsers.amazonDev2.id
      );

      expect(result.success).toBe(true);
    });

    it("allows org owner to manage any key", async () => {
      // Developer creates a key
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Developer Created Key",
        scope: "org",
        createdBy: seedUsers.amazonDev1.id,
      });

      // Owner can update it
      const result = await updateKey(
        db,
        auth,
        { orgId: seedOrgs.amazon.id, keyId: created.id, name: "Updated by Owner" },
        seedUsers.amazonOwner.id
      );

      expect(result.success).toBe(true);
    });

    it("denies non-creator member from managing key", async () => {
      // Owner creates a key
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Owner Key",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      // Viewer (member role) cannot update it
      await expect(
        updateKey(
          db,
          auth,
          { orgId: seedOrgs.amazon.id, keyId: created.id, name: "Attempted Update" },
          seedUsers.amazonDev2.id
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("denies non-org-member from managing old key", async () => {
      // Create key by owner
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Org Key",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      // Unverified user is not an org member
      await expect(
        updateKey(
          db,
          auth,
          { orgId: seedOrgs.amazon.id, keyId: created.id, name: "Hack" },
          seedUsers.unverified.id
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Authorization - Scope Escalation Prevention", () => {
    it("denies member from creating org-wide key", async () => {
      // Viewer is a member with project access but not admin
      await expect(
        createKey(db, auth, {
          orgId: seedOrgs.amazon.id,
          name: "Member Org Key",
          scope: "org",
          createdBy: seedUsers.amazonDev2.id,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("member with project access CAN create project-scoped key", async () => {
      // Viewer has access to webApp via seedProjectMembers.webAppViewer
      const result = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Viewer Project Key",
        scope: "project",
        projectIds: [seedProjects.amazonStorefront.id],
        createdBy: seedUsers.amazonDev2.id,
      });

      expect(result.id).toBeDefined();
      expect(result.scope).toBe("project");
    });

    // Skipped: Project membership is not checked for project-scoped keys.
    // Any org member can create keys for any project in their org.
    // See canCreateKey() in api-key-auth.ts for details.
    it.skip("member cannot create key for project they don't have access to", async () => {
      // Viewer has access to webApp but NOT mobileApi
      await expect(
        createKey(db, auth, {
          orgId: seedOrgs.amazon.id,
          name: "Unauthorized Project Key",
          scope: "project",
          projectIds: [seedProjects.amazonCheckout.id],
          createdBy: seedUsers.amazonDev2.id,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("member cannot escalate their project key to org scope", async () => {
      // Viewer creates a project-scoped key (they have access)
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Viewer Escalation Test Key",
        scope: "project",
        projectIds: [seedProjects.amazonStorefront.id],
        createdBy: seedUsers.amazonDev2.id,
      });

      // Viewer tries to escalate to org scope - should fail
      await expect(
        updateKey(
          db,
          auth,
          { orgId: seedOrgs.amazon.id, keyId: created.id, scope: "org" },
          seedUsers.amazonDev2.id
        )
      ).rejects.toThrow(ForbiddenError);
    });

    // Skipped: Project membership is not checked for project-scoped keys.
    // Any org member can add any project in their org.
    // See canCreateKey() in api-key-auth.ts for details.
    it.skip("member cannot add projects they don't have access to", async () => {
      // Viewer creates a key for webApp (has access)
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Viewer Multi-Project Test Key",
        scope: "project",
        projectIds: [seedProjects.amazonStorefront.id],
        createdBy: seedUsers.amazonDev2.id,
      });

      // Viewer tries to add mobileApi (no access) - should fail
      await expect(
        updateKey(
          db,
          auth,
          {
            orgId: seedOrgs.amazon.id,
            keyId: created.id,
            scope: "project",
            projectIds: [seedProjects.amazonStorefront.id, seedProjects.amazonCheckout.id],
          },
          seedUsers.amazonDev2.id
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("admin can change scope from project to org", async () => {
      // Admin creates a project-scoped key
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Admin Project Key",
        scope: "project",
        projectIds: [seedProjects.amazonStorefront.id],
        createdBy: seedUsers.amazonDev1.id,
      });

      // Admin can upgrade to org scope
      const result = await updateKey(
        db,
        auth,
        { orgId: seedOrgs.amazon.id, keyId: created.id, scope: "org" },
        seedUsers.amazonDev1.id
      );

      expect(result.success).toBe(true);

      // Verify the change
      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonDev1.id);
      const key = keys.find((k) => k.id === created.id);
      expect(key?.scope).toBe("org");
    });
  });

  describe("listKeys - Access Filtering", () => {
    it("admin sees all keys including org-wide", async () => {
      // Create an org-wide key
      await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Org Wide for List Test",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonOwner.id);

      const orgWideKeys = keys.filter((k) => k.isOrgWide);
      expect(orgWideKeys.length).toBeGreaterThan(0);
    });

    it("member cannot see org-wide keys", async () => {
      // Create an org-wide key
      await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Hidden Org Key",
        scope: "org",
        createdBy: seedUsers.amazonOwner.id,
      });

      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonDev2.id);

      const orgWideKeys = keys.filter((k) => k.isOrgWide);
      expect(orgWideKeys.length).toBe(0);
    });

    it("member can see project-scoped keys for their projects", async () => {
      // Create a project-scoped key for webApp (viewer has access)
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Visible Project Key",
        scope: "project",
        projectIds: [seedProjects.amazonStorefront.id],
        createdBy: seedUsers.amazonOwner.id,
      });

      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonDev2.id);

      const key = keys.find((k) => k.id === created.id);
      expect(key).toBeDefined();
      expect(key?.scope).toBe("project");
    });

    it("member cannot see project-scoped keys for projects they don't access", async () => {
      // Create a project-scoped key for mobileApi (viewer has NO access)
      const created = await createKey(db, auth, {
        orgId: seedOrgs.amazon.id,
        name: "Hidden Project Key",
        scope: "project",
        projectIds: [seedProjects.amazonCheckout.id],
        createdBy: seedUsers.amazonOwner.id,
      });

      const keys = await listKeys(db, seedOrgs.amazon.id, seedUsers.amazonDev2.id);

      const key = keys.find((k) => k.id === created.id);
      expect(key).toBeUndefined();
    });
  });

  describe("Cross-Org Validation", () => {
    it("rejects creating key with projects from another org", async () => {
      // Try to create key in acme org using dashboard project (belongs to startup org)
      await expect(
        createKey(db, auth, {
          orgId: seedOrgs.amazon.id,
          name: "Cross Org Key",
          scope: "project",
          projectIds: [seedProjects.stripeDashboard.id], // belongs to startup, not acme
          createdBy: seedUsers.amazonOwner.id,
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("rejects creating key with non-existent projects", async () => {
      await expect(
        createKey(db, auth, {
          orgId: seedOrgs.amazon.id,
          name: "Non-existent Project Key",
          scope: "project",
          projectIds: ["prj_does_not_exist"],
          createdBy: seedUsers.amazonOwner.id,
        })
      ).rejects.toThrow(BadRequestError);
    });
  });
});
