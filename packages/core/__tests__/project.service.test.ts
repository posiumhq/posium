/**
 * ProjectService tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createProjectService } from "../src/services/project/index.js";
import { createTestContext, testUsers, testOrgs, testProjects } from "../src/testing/index.js";
import { ForbiddenError, NotFoundError } from "../src/errors.js";
import { setupTestDb, teardownTestDb, getDb, getBoss } from "./setup.js";

describe("ProjectService", () => {
  const projectService = createProjectService();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("list", () => {
    it("lists projects for an organization", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const projects = await projectService.list(ctx, { orgId: testOrgs.amazon });

      expect(projects).toBeDefined();
      expect(projects.length).toBeGreaterThan(0);

      // Should include Amazon Storefront
      const storefront = projects.find((p) => p.id === testProjects.amazonStorefront);
      expect(storefront).toBeDefined();
      expect(storefront?.name).toBe("Storefront Web App");
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(projectService.list(ctx, { orgId: testOrgs.amazon })).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe("getById", () => {
    it("gets project by ID for org member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.getById(ctx, testProjects.amazonStorefront);

      expect(project).toBeDefined();
      expect(project.id).toBe(testProjects.amazonStorefront);
      expect(project.name).toBe("Storefront Web App");
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(projectService.getById(ctx, testProjects.amazonStorefront)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("throws NotFoundError for non-existent project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(projectService.getById(ctx, "prj_nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    it("creates a new project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Test Project " + Date.now(),
        description: "A test project",
      });

      expect(project).toBeDefined();
      expect(project.id).toMatch(/^prj_/);
      expect(project.name).toContain("Test Project");
      expect(project.orgId).toBe(testOrgs.amazon);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws ForbiddenError when creating in org user is not member of", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        projectService.create(ctx, {
          orgId: testOrgs.amazon,
          name: "Hacked Project",
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("update", () => {
    it("updates project name and description", async () => {
      // First create a project to update
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Update Test Project",
      });

      const updated = await projectService.update(ctx, project.id, {
        name: "Updated Project Name",
        description: "Updated description",
      });

      expect(updated.name).toBe("Updated Project Name");
      expect(updated.description).toBe("Updated description");

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws ForbiddenError for non-member update", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        projectService.update(ctx, testProjects.amazonStorefront, { name: "Hacked" })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("delete", () => {
    it("soft deletes a project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a project to delete
      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Delete Test Project",
      });

      // Delete it
      await projectService.delete(ctx, project.id);

      // Should no longer be retrievable
      await expect(projectService.getById(ctx, project.id)).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError for non-member delete", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(projectService.delete(ctx, testProjects.amazonStorefront)).rejects.toThrow(
        ForbiddenError
      );
    });
  });
});
