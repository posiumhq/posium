/**
 * EnvironmentService tests.
 *
 * Tests environment CRUD operations with isDefault logic.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEnvironmentService } from "../src/services/environment/index.js";
import { createProjectService } from "../src/services/project/index.js";
import { createTestContext, testUsers, testOrgs, testProjects } from "../src/testing/index.js";
import { ForbiddenError, ConflictError, NotFoundError } from "../src/errors.js";
import { setupTestDb, teardownTestDb, getDb, getBoss } from "./setup.js";

describe("EnvironmentService", () => {
  const environmentService = createEnvironmentService();
  const projectService = createProjectService();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("list", () => {
    it("lists environments for a project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a project (auto-creates "default" environment)
      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Env List Test",
        slug: "env-list-" + Date.now(),
      });

      // Create additional environment (default already exists from project creation)
      await environmentService.create(ctx, {
        projectId: project.id,
        name: "Staging",
        isDefault: false,
      });

      const environments = await environmentService.list(ctx, { projectId: project.id });

      expect(environments).toBeDefined();
      expect(environments.length).toBe(2);

      const defaultEnv = environments.find((e) => e.name === "default");
      expect(defaultEnv).toBeDefined();
      expect(defaultEnv?.isDefault).toBe(true);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("auto-creates default environment for new projects", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Auto Env Test",
        slug: "auto-env-" + Date.now(),
      });

      const environments = await environmentService.list(ctx, { projectId: project.id });

      // projectService.create() auto-creates a default environment
      expect(environments).toHaveLength(1);
      expect(environments[0]!.name).toBe("default");
      expect(environments[0]!.isDefault).toBe(true);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        environmentService.list(ctx, { projectId: testProjects.amazonStorefront })
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError for non-existent project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        environmentService.list(ctx, { projectId: "prj_nonexistent" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getById", () => {
    it("gets environment by ID", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Get Env Test",
        slug: "get-env-" + Date.now(),
      });

      const env = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Test Environment",
        config: { baseUrl: "https://example.com" },
      });

      const fetched = await environmentService.getById(ctx, env.id);

      expect(fetched).toBeDefined();
      expect(fetched.id).toBe(env.id);
      expect(fetched.name).toBe("Test Environment");
      expect(fetched.config).toEqual({ baseUrl: "https://example.com" });

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws NotFoundError for non-existent environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        environmentService.getById(ctx, "env_nonexistent")
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Access Env Test",
        slug: "access-env-" + Date.now(),
      });

      const env = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Secret Environment",
      });

      // Try to access from different org
      const stripeCtx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(environmentService.getById(stripeCtx, env.id)).rejects.toThrow(ForbiddenError);

      // Clean up
      await projectService.delete(ctx, project.id);
    });
  });

  describe("create", () => {
    it("creates a new environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Create Env Test",
        slug: "create-env-" + Date.now(),
      });

      const env = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Development",
        isDefault: false,
        config: { debug: true },
      });

      expect(env).toBeDefined();
      expect(env.id).toMatch(/^env_/);
      expect(env.name).toBe("Development");
      expect(env.isDefault).toBe(false);
      expect(env.config).toEqual({ debug: true });

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws ConflictError for duplicate name in same project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Dup Env Test",
        slug: "dup-env-" + Date.now(),
      });

      // Note: projectService.create() auto-creates "default" environment
      // Try to create another "default" environment - should fail
      await expect(
        environmentService.create(ctx, {
          projectId: project.id,
          name: "default", // Duplicate - already auto-created
        })
      ).rejects.toThrow(ConflictError);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("unsets previous default when creating new default environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Default Env Test",
        slug: "default-env-" + Date.now(),
      });

      // Create first default
      const env1 = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Env1",
        isDefault: true,
      });

      expect(env1.isDefault).toBe(true);

      // Create second default - should unset first
      const env2 = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Env2",
        isDefault: true,
      });

      expect(env2.isDefault).toBe(true);

      // Verify first is no longer default
      const env1Updated = await environmentService.getById(ctx, env1.id);
      expect(env1Updated.isDefault).toBe(false);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws Error for non-user actor", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        actor: { type: "system" },
      });

      await expect(
        environmentService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          name: "System Env",
        })
      ).rejects.toThrow(Error);
    });
  });

  describe("update", () => {
    it("updates environment name", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Update Env Test",
        slug: "update-env-" + Date.now(),
      });

      const env = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Old Name",
      });

      const updated = await environmentService.update(ctx, env.id, {
        name: "New Name",
      });

      expect(updated.name).toBe("New Name");

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("updates environment config", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Config Env Test",
        slug: "config-env-" + Date.now(),
      });

      const env = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Config Test",
        config: { key1: "value1" },
      });

      const updated = await environmentService.update(ctx, env.id, {
        config: { key1: "updated", key2: "new" },
      });

      expect(updated.config).toEqual({ key1: "updated", key2: "new" });

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws ConflictError when changing to existing name", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Name Conflict Test",
        slug: "name-conflict-" + Date.now(),
      });

      await environmentService.create(ctx, {
        projectId: project.id,
        name: "ExistingName",
      });

      const env2 = await environmentService.create(ctx, {
        projectId: project.id,
        name: "OtherName",
      });

      await expect(
        environmentService.update(ctx, env2.id, { name: "ExistingName" })
      ).rejects.toThrow(ConflictError);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("setting isDefault=true unsets previous default", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Set Default Test",
        slug: "set-default-" + Date.now(),
      });

      const env1 = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Env1",
        isDefault: true,
      });

      const env2 = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Env2",
        isDefault: false,
      });

      // Make env2 the default
      const updated = await environmentService.update(ctx, env2.id, {
        isDefault: true,
      });

      expect(updated.isDefault).toBe(true);

      // Verify env1 is no longer default
      const env1Updated = await environmentService.getById(ctx, env1.id);
      expect(env1Updated.isDefault).toBe(false);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("allows updating same environment name to itself", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Same Name Test",
        slug: "same-name-" + Date.now(),
      });

      const env = await environmentService.create(ctx, {
        projectId: project.id,
        name: "MyEnv",
      });

      // Should not throw - same name
      const updated = await environmentService.update(ctx, env.id, {
        name: "MyEnv",
        config: { updated: true },
      });

      expect(updated.name).toBe("MyEnv");
      expect(updated.config).toEqual({ updated: true });

      // Clean up
      await projectService.delete(ctx, project.id);
    });
  });

  describe("delete", () => {
    it("soft deletes an environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Delete Env Test",
        slug: "delete-env-" + Date.now(),
      });

      const env = await environmentService.create(ctx, {
        projectId: project.id,
        name: "ToDelete",
      });

      await environmentService.delete(ctx, env.id);

      // Should no longer be accessible
      await expect(environmentService.getById(ctx, env.id)).rejects.toThrow(NotFoundError);

      // Should not appear in list
      const environments = await environmentService.list(ctx, { projectId: project.id });
      expect(environments.find((e) => e.id === env.id)).toBeUndefined();

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws NotFoundError for non-existent environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        environmentService.delete(ctx, "env_nonexistent")
      ).rejects.toThrow(NotFoundError);
    });

    it("throws Error for non-user actor", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        actor: { type: "system" },
      });

      await expect(
        environmentService.delete(ctx, "env_123")
      ).rejects.toThrow(Error);
    });

    it("throws ConflictError when deleting the default environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Delete Default Env Test",
        slug: "delete-default-env-" + Date.now(),
      });

      // projectService.create() auto-creates a "default" environment
      // Get the auto-created default environment
      const envs = await environmentService.list(ctx, { projectId: project.id });
      const defaultEnv = envs.find((e) => e.isDefault)!;
      expect(defaultEnv).toBeDefined();
      expect(defaultEnv.name).toBe("default");

      // Create a non-default environment
      const stagingEnv = await environmentService.create(ctx, {
        projectId: project.id,
        name: "Staging",
        isDefault: false,
      });

      // Trying to delete the default environment should throw ConflictError
      await expect(environmentService.delete(ctx, defaultEnv.id)).rejects.toThrow(ConflictError);

      // Deleting non-default environment should work
      await environmentService.delete(ctx, stagingEnv.id);

      // Verify staging is deleted
      await expect(environmentService.getById(ctx, stagingEnv.id)).rejects.toThrow(NotFoundError);

      // Verify default is still there
      const stillDefault = await environmentService.getById(ctx, defaultEnv.id);
      expect(stillDefault.isDefault).toBe(true);

      // To delete the default, first make another environment default
      const newEnv = await environmentService.create(ctx, {
        projectId: project.id,
        name: "NewDefault",
        isDefault: true,
      });

      // Now the old default is no longer default, so it can be deleted
      await environmentService.delete(ctx, defaultEnv.id);
      await expect(environmentService.getById(ctx, defaultEnv.id)).rejects.toThrow(NotFoundError);

      // Clean up
      await projectService.delete(ctx, project.id);
    });
  });
});
