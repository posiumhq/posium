/**
 * OrgService tests.
 *
 * Tests organization CRUD operations and member management.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createOrgService } from "../src/services/org/index.js";
import { createTestContext, testUsers, testOrgs } from "../src/testing/index.js";
import { ForbiddenError, ConflictError, NotFoundError } from "../src/errors.js";
import { setupTestDb, teardownTestDb, getDb, getBoss, getAuth } from "./setup.js";

describe("OrgService", () => {
  const orgService = createOrgService();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("list", () => {
    it("lists organizations for a user", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
      });

      const orgs = await orgService.list(ctx);

      expect(orgs).toBeDefined();
      expect(orgs.length).toBeGreaterThan(0);

      // Amazon owner should see Amazon org
      const amazonOrg = orgs.find((o) => o.id === testOrgs.amazon);
      expect(amazonOrg).toBeDefined();
      expect(amazonOrg?.name).toBe("Amazon");
    });

    it("returns different orgs for different users", async () => {
      const amazonCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
      });

      const stripeCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
      });

      const amazonOrgs = await orgService.list(amazonCtx);
      const stripeOrgs = await orgService.list(stripeCtx);

      // Each user should see their own org
      const amazonHasAmazon = amazonOrgs.some((o) => o.id === testOrgs.amazon);
      const stripeHasStripe = stripeOrgs.some((o) => o.id === testOrgs.stripe);

      expect(amazonHasAmazon).toBe(true);
      expect(stripeHasStripe).toBe(true);
    });

    it("returns empty array for system actor", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        actor: { type: "system" },
      });

      const orgs = await orgService.list(ctx);
      expect(orgs).toEqual([]);
    });

    it("includes project and member counts", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
      });

      const orgs = await orgService.list(ctx);
      const amazonOrg = orgs.find((o) => o.id === testOrgs.amazon);

      expect(amazonOrg?.projectCount).toBeGreaterThanOrEqual(0);
      expect(amazonOrg?.memberCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getById", () => {
    it("gets organization by ID for member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const org = await orgService.getById(ctx, testOrgs.amazon);

      expect(org).toBeDefined();
      expect(org.id).toBe(testOrgs.amazon);
      expect(org.name).toBe("Amazon");
      expect(org.slug).toBe("amazon");
      expect(org.role).toBe("owner");
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(orgService.getById(ctx, testOrgs.amazon)).rejects.toThrow(ForbiddenError);
    });

    it("throws ForbiddenError for non-existent org (auth fails first)", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Non-existent org throws ForbiddenError because membership check fails
      await expect(orgService.getById(ctx, "org_nonexistent")).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getMembers", () => {
    it("lists members for an organization", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const members = await orgService.getMembers(ctx, { orgId: testOrgs.amazon });

      expect(members).toBeDefined();
      expect(members.length).toBeGreaterThan(0);

      // Should include the owner
      const ownerMember = members.find((m) => m.userId === testUsers.amazonOwner);
      expect(ownerMember).toBeDefined();
      expect(ownerMember?.role).toBe("owner");
    });

    it("throws ForbiddenError for non-member listing members", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(orgService.getMembers(ctx, { orgId: testOrgs.amazon })).rejects.toThrow(
        ForbiddenError
      );
    });

    it("includes user info with each member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const members = await orgService.getMembers(ctx, { orgId: testOrgs.amazon });
      const member = members[0];

      expect(member.user).toBeDefined();
      expect(member.user.id).toBeDefined();
      expect(member.user.email).toBeDefined();
    });
  });

  describe("create", () => {
    it("creates a new organization", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      const org = await orgService.create(ctx, {
        name: "Test Org " + Date.now(),
        slug: "test-org-" + Date.now(),
      });

      expect(org).toBeDefined();
      expect(org.id).toBeDefined();
      expect(org.id.length).toBeGreaterThan(0);
      expect(org.name).toContain("Test Org");

      // Clean up: soft delete the created org
      const cleanupCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: org.id,
      });
      await orgService.delete(cleanupCtx, org.id);
    });

    it("throws ConflictError for duplicate slug", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      await expect(
        orgService.create(ctx, {
          name: "Duplicate Amazon",
          slug: "amazon", // Already exists
        })
      ).rejects.toThrow(ConflictError);
    });

    it("throws Error for non-user actor", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        actor: { type: "system" },
      });

      await expect(
        orgService.create(ctx, {
          name: "System Org",
          slug: "system-org-" + Date.now(),
        })
      ).rejects.toThrow(Error);
    });

    it("adds creator as owner", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.githubOwner,
      });

      const org = await orgService.create(ctx, {
        name: "Owner Test Org",
        slug: "owner-test-" + Date.now(),
      });

      // Get members to verify creator is owner
      const memberCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.githubOwner,
        orgId: org.id,
      });
      const members = await orgService.getMembers(memberCtx, { orgId: org.id });

      const owner = members.find((m) => m.userId === testUsers.githubOwner);
      expect(owner).toBeDefined();
      expect(owner?.role).toBe("owner");

      // Clean up
      await orgService.delete(memberCtx, org.id);
    });
  });

  describe("update", () => {
    it("updates organization name", async () => {
      // First create an org to update
      const createCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      const org = await orgService.create(createCtx, {
        name: "Update Test Org",
        slug: "update-test-" + Date.now(),
      });

      const updateCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: org.id,
      });

      const updated = await orgService.update(updateCtx, org.id, {
        name: "Updated Org Name",
      });

      expect(updated.name).toBe("Updated Org Name");

      // Clean up
      await orgService.delete(updateCtx, org.id);
    });

    it("throws ForbiddenError for non-member update", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        orgService.update(ctx, testOrgs.amazon, { name: "Hacked Name" })
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ConflictError when changing to existing slug", async () => {
      const createCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      const org = await orgService.create(createCtx, {
        name: "Slug Conflict Test",
        slug: "slug-conflict-" + Date.now(),
      });

      const updateCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: org.id,
      });

      await expect(
        orgService.update(updateCtx, org.id, { slug: "amazon" }) // Already exists
      ).rejects.toThrow(ConflictError);

      // Clean up
      await orgService.delete(updateCtx, org.id);
    });

    it("allows updating to same slug", async () => {
      const createCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      const slug = "same-slug-" + Date.now();
      const org = await orgService.create(createCtx, {
        name: "Same Slug Test",
        slug,
      });

      const updateCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: org.id,
      });

      // Should not throw - updating to own slug
      const updated = await orgService.update(updateCtx, org.id, {
        name: "Updated Name",
        slug, // Same slug
      });

      expect(updated.slug).toBe(slug);

      // Clean up
      await orgService.delete(updateCtx, org.id);
    });
  });

  describe("delete", () => {
    it("soft deletes an organization", async () => {
      const createCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      const org = await orgService.create(createCtx, {
        name: "Delete Test Org",
        slug: "delete-test-" + Date.now(),
      });

      const deleteCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: org.id,
      });

      await orgService.delete(deleteCtx, org.id);

      // Should no longer be accessible
      await expect(orgService.getById(deleteCtx, org.id)).rejects.toThrow();
    });

    it("throws ForbiddenError for non-owner delete", async () => {
      // Amazon dev1 is a member but not owner
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonDev1,
        orgId: testOrgs.amazon,
      });

      await expect(orgService.delete(ctx, testOrgs.amazon)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("addMember", () => {
    it("adds a new member to organization", async () => {
      // Create a new org for this test
      const createCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      const org = await orgService.create(createCtx, {
        name: "Add Member Test",
        slug: "add-member-" + Date.now(),
      });

      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
        orgId: org.id,
      });

      const member = await orgService.addMember(ctx, {
        orgId: org.id,
        userId: testUsers.stripeOwner,
        role: "member",
      });

      expect(member).toBeDefined();
      expect(member.userId).toBe(testUsers.stripeOwner);
      expect(member.role).toBe("member");

      // Clean up
      await orgService.delete(ctx, org.id);
    });

    it("throws ForbiddenError for non-admin adding member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonDev2, // amazonDev2 has "member" role, not admin
        orgId: testOrgs.amazon,
      });

      await expect(
        orgService.addMember(ctx, {
          orgId: testOrgs.amazon,
          userId: testUsers.openaiOwner,
          role: "member",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError for non-existent user", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        orgService.addMember(ctx, {
          orgId: testOrgs.amazon,
          userId: "usr_nonexistent",
          role: "member",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError for existing member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Try to add amazonDev1 who is already a member
      await expect(
        orgService.addMember(ctx, {
          orgId: testOrgs.amazon,
          userId: testUsers.amazonDev1,
          role: "member",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("updateMemberRole", () => {
    it("updates member role to admin", async () => {
      // Create a new org and add a member
      const createCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      const org = await orgService.create(createCtx, {
        name: "Role Update Test",
        slug: "role-update-" + Date.now(),
      });

      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
        orgId: org.id,
      });

      // Add a member
      const member = await orgService.addMember(ctx, {
        orgId: org.id,
        userId: testUsers.stripeOwner,
        role: "member",
      });

      // Update to admin
      const updated = await orgService.updateMemberRole(ctx, {
        orgId: org.id,
        memberId: member.id,
        role: "admin",
      });

      expect(updated.role).toBe("admin");

      // Clean up
      await orgService.delete(ctx, org.id);
    });

    it("throws ForbiddenError when trying to demote owner", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Get the owner's member record
      const members = await orgService.getMembers(ctx, { orgId: testOrgs.amazon });
      const ownerMember = members.find((m) => m.role === "owner");

      await expect(
        orgService.updateMemberRole(ctx, {
          orgId: testOrgs.amazon,
          memberId: ownerMember!.id,
          role: "admin", // Can't demote owner
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ForbiddenError when trying to promote to owner", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Get a non-owner member
      const members = await orgService.getMembers(ctx, { orgId: testOrgs.amazon });
      const nonOwner = members.find((m) => m.role !== "owner");

      await expect(
        orgService.updateMemberRole(ctx, {
          orgId: testOrgs.amazon,
          memberId: nonOwner!.id,
          role: "owner", // Can't promote to owner
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError for non-existent member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        orgService.updateMemberRole(ctx, {
          orgId: testOrgs.amazon,
          memberId: "mem_nonexistent",
          role: "admin",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("removeMember", () => {
    it("removes a member from organization", async () => {
      // Create a new org and add a member
      const createCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
      });

      const org = await orgService.create(createCtx, {
        name: "Remove Member Test",
        slug: "remove-member-" + Date.now(),
      });

      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        auth: getAuth(),
        userId: testUsers.amazonOwner,
        orgId: org.id,
      });

      // Add a member
      const member = await orgService.addMember(ctx, {
        orgId: org.id,
        userId: testUsers.stripeOwner,
        role: "member",
      });

      // Remove the member
      await orgService.removeMember(ctx, {
        orgId: org.id,
        memberId: member.id,
      });

      // Verify member is removed
      const members = await orgService.getMembers(ctx, { orgId: org.id });
      const removed = members.find((m) => m.id === member.id);
      expect(removed).toBeUndefined();

      // Clean up
      await orgService.delete(ctx, org.id);
    });

    it("throws ForbiddenError when trying to remove owner", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const members = await orgService.getMembers(ctx, { orgId: testOrgs.amazon });
      const ownerMember = members.find((m) => m.role === "owner");

      await expect(
        orgService.removeMember(ctx, {
          orgId: testOrgs.amazon,
          memberId: ownerMember!.id,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ForbiddenError for non-admin removing member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonDev2, // amazonDev2 has "member" role, not admin
        orgId: testOrgs.amazon,
      });

      const members = await orgService.getMembers(ctx, { orgId: testOrgs.amazon });
      const nonOwner = members.find((m) => m.role !== "owner" && m.userId !== testUsers.amazonDev2);

      if (nonOwner) {
        await expect(
          orgService.removeMember(ctx, {
            orgId: testOrgs.amazon,
            memberId: nonOwner.id,
          })
        ).rejects.toThrow(ForbiddenError);
      }
    });

    it("throws NotFoundError for non-existent member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        orgService.removeMember(ctx, {
          orgId: testOrgs.amazon,
          memberId: "mem_nonexistent",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
