/**
 * TestService tests.
 *
 * Tests test CRUD operations with suite validation and tag management.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestService } from "../src/services/test/index.js";
import { createProjectService } from "../src/services/project/index.js";
import { createSuiteService } from "../src/services/suite/index.js";
import { createTestContext, testUsers, testOrgs, testProjects, testSuites, testTests } from "../src/testing/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../src/errors.js";
import { setupTestDb, teardownTestDb, getDb, getBoss } from "./setup.js";

describe("TestService", () => {
  const testService = createTestService();
  const projectService = createProjectService();
  const suiteService = createSuiteService();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("listByProject", () => {
    it("lists tests for a project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await testService.listByProject(ctx, { projectId: testProjects.amazonStorefront });

      expect(result).toBeDefined();
      expect(result.tests).toBeDefined();
      expect(Array.isArray(result.tests)).toBe(true);
      expect(result.suites).toBeDefined();
      expect(Array.isArray(result.suites)).toBe(true);
    });

    it("returns empty array for project with no tests", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a new empty project
      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Empty Test Project",
        slug: "empty-test-" + Date.now(),
      });

      const result = await testService.listByProject(ctx, { projectId: project.id });

      expect(result.tests).toEqual([]);

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
        testService.listByProject(ctx, { projectId: testProjects.amazonStorefront })
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
        testService.listByProject(ctx, { projectId: "prj_nonexistent" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("listBySuite", () => {
    it("lists tests for a suite", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await testService.listBySuite(ctx, { suiteId: testSuites.amazonSearch });

      expect(result).toBeDefined();
      expect(result.tests).toBeDefined();
      expect(Array.isArray(result.tests)).toBe(true);
      expect(result.suite).toBeDefined();
      expect(result.suite.id).toBe(testSuites.amazonSearch);
    });

    it("throws NotFoundError for non-existent suite", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        testService.listBySuite(ctx, { suiteId: "sui_nonexistent" })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        testService.listBySuite(ctx, { suiteId: testSuites.amazonSearch })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getById", () => {
    it("gets test by ID", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const test = await testService.getById(ctx, testTests.searchProducts);

      expect(test).toBeDefined();
      expect(test.id).toBe(testTests.searchProducts);
      expect(test.name).toBeDefined();
      expect(test.projectId).toBe(testProjects.amazonStorefront);
    });

    it("throws NotFoundError for non-existent test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        testService.getById(ctx, "tst_nonexistent")
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        testService.getById(ctx, testTests.searchProducts)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getTestSteps", () => {
    it("returns empty steps for test without versions", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a new test without any versions
      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Steps Test Project",
        slug: "steps-test-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "No Steps Test",
        kind: "e2e",
      });

      const result = await testService.getTestSteps(ctx, test.id);

      expect(result).toBeDefined();
      expect(result.steps).toEqual([]);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("returns steps with proper TestStep structure when version exists", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a new test
      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Steps Structure Test Project",
        slug: "steps-struct-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "Steps Structure Test",
        kind: "e2e",
      });

      // Insert a test version with steps directly
      const { schema } = await import("@posium/db");
      const { createId } = await import("@posium/id");

      const versionId = createId("testVersion");
      const testSteps = {
        steps: [
          { type: "navigate", action: "goto", value: "https://example.com" },
          { type: "input", action: "fill", selector: "#username", value: "testuser" },
          { type: "action", action: "click", selector: "#submit" },
          { type: "assertion", action: "expect", selector: "#success", value: "Login successful" },
        ],
      };

      await getDb().insert(schema.testVersion).values({
        id: versionId,
        testId: test.id,
        version: 1,
        steps: testSteps,
        createdBy: testUsers.amazonOwner,
      });

      const result = await testService.getTestSteps(ctx, test.id);

      expect(result).toBeDefined();
      expect(result.versionId).toBe(versionId);
      expect(result.version).toBe(1);
      expect(result.steps).toHaveLength(4);

      // Verify each step has the expected TestStep structure
      expect(result.steps[0]).toEqual({
        type: "navigate",
        action: "goto",
        value: "https://example.com",
      });
      expect(result.steps[1]).toEqual({
        type: "input",
        action: "fill",
        selector: "#username",
        value: "testuser",
      });
      expect(result.steps[2]).toEqual({
        type: "action",
        action: "click",
        selector: "#submit",
      });
      expect(result.steps[3]).toEqual({
        type: "assertion",
        action: "expect",
        selector: "#success",
        value: "Login successful",
      });

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("returns latest version steps when multiple versions exist", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Multi Version Test Project",
        slug: "multi-ver-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "Multi Version Test",
        kind: "e2e",
      });

      const { schema } = await import("@posium/db");
      const { createId } = await import("@posium/id");

      // Insert version 1
      const versionId1 = createId("testVersion");
      await getDb().insert(schema.testVersion).values({
        id: versionId1,
        testId: test.id,
        version: 1,
        steps: { steps: [{ type: "navigate", action: "goto", value: "v1" }] },
        createdBy: testUsers.amazonOwner,
      });

      // Insert version 2 (should be returned)
      const versionId2 = createId("testVersion");
      await getDb().insert(schema.testVersion).values({
        id: versionId2,
        testId: test.id,
        version: 2,
        steps: { steps: [{ type: "navigate", action: "goto", value: "v2" }] },
        createdBy: testUsers.amazonOwner,
      });

      const result = await testService.getTestSteps(ctx, test.id);

      expect(result.version).toBe(2);
      expect(result.versionId).toBe(versionId2);
      expect(result.steps[0]?.value).toBe("v2");

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("handles steps with additional custom properties", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Custom Props Test Project",
        slug: "custom-props-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "Custom Props Test",
        kind: "e2e",
      });

      const { schema } = await import("@posium/db");
      const { createId } = await import("@posium/id");

      const versionId = createId("testVersion");
      const testSteps = {
        steps: [
          {
            type: "wait",
            action: "waitForSelector",
            selector: "#loading",
            timeout: 5000,
            customOption: "someValue",
          },
        ],
      };

      await getDb().insert(schema.testVersion).values({
        id: versionId,
        testId: test.id,
        version: 1,
        steps: testSteps,
        createdBy: testUsers.amazonOwner,
      });

      const result = await testService.getTestSteps(ctx, test.id);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]?.type).toBe("wait");
      expect(result.steps[0]?.action).toBe("waitForSelector");
      expect(result.steps[0]?.selector).toBe("#loading");
      // Additional properties should be preserved via index signature
      expect(result.steps[0]?.timeout).toBe(5000);
      expect(result.steps[0]?.customOption).toBe("someValue");

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
        testService.getTestSteps(ctx, testTests.searchProducts)
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError for non-existent test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        testService.getTestSteps(ctx, "tst_nonexistent")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    it("creates a new test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Create Test Project",
        slug: "create-test-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "New Test " + Date.now(),
        kind: "e2e",
        description: "A test description",
      });

      expect(test).toBeDefined();
      expect(test.id).toMatch(/^tst_/);
      expect(test.name).toContain("New Test");
      expect(test.kind).toBe("e2e");
      expect(test.description).toBe("A test description");
      expect(test.projectId).toBe(project.id);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("creates test with suite assignment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Suite Test Project",
        slug: "suite-test-" + Date.now(),
      });

      const suite = await suiteService.create(ctx, {
        projectId: project.id,
        name: "Test Suite",
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        suiteId: suite.id,
        name: "Suited Test",
        kind: "e2e",
      });

      expect(test.suiteId).toBe(suite.id);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws ValidationError for suite in different project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project1 = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Project 1",
        slug: "proj1-" + Date.now(),
      });

      const project2 = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Project 2",
        slug: "proj2-" + Date.now(),
      });

      const suite = await suiteService.create(ctx, {
        projectId: project1.id,
        name: "Suite in P1",
      });

      // Try to create test in project2 with suite from project1
      await expect(
        testService.create(ctx, {
          projectId: project2.id,
          suiteId: suite.id,
          name: "Cross Project Test",
          kind: "e2e",
        })
      ).rejects.toThrow(ValidationError);

      // Clean up
      await projectService.delete(ctx, project1.id);
      await projectService.delete(ctx, project2.id);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        testService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          name: "Hacked Test",
          kind: "e2e",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws Error for non-user actor", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        actor: { type: "system" },
      });

      await expect(
        testService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          name: "System Test",
          kind: "e2e",
        })
      ).rejects.toThrow(Error);
    });
  });

  describe("update", () => {
    it("updates test name and description", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Update Test Project",
        slug: "update-test-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "Original Name",
        kind: "e2e",
      });

      const updated = await testService.update(ctx, test.id, {
        name: "Updated Name",
        description: "Updated description",
      });

      expect(updated.test.name).toBe("Updated Name");
      expect(updated.test.description).toBe("Updated description");

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("updates test suite assignment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Suite Update Project",
        slug: "suite-update-" + Date.now(),
      });

      const suite1 = await suiteService.create(ctx, { projectId: project.id, name: "Suite 1" });
      const suite2 = await suiteService.create(ctx, { projectId: project.id, name: "Suite 2" });

      const test = await testService.create(ctx, {
        projectId: project.id,
        suiteId: suite1.id,
        name: "Suite Move Test",
        kind: "e2e",
      });

      expect(test.suiteId).toBe(suite1.id);

      // Move to suite2
      const updated = await testService.update(ctx, test.id, {
        suiteId: suite2.id,
      });

      expect(updated.test.suiteId).toBe(suite2.id);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("removes suite assignment with null", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Suite Remove Project",
        slug: "suite-remove-" + Date.now(),
      });

      const suite = await suiteService.create(ctx, { projectId: project.id, name: "Suite" });

      const test = await testService.create(ctx, {
        projectId: project.id,
        suiteId: suite.id,
        name: "Remove Suite Test",
        kind: "e2e",
      });

      // Remove suite assignment
      const updated = await testService.update(ctx, test.id, {
        suiteId: null,
      });

      expect(updated.test.suiteId).toBeNull();

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws ValidationError when moving to suite in different project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project1 = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "P1 for move",
        slug: "p1-move-" + Date.now(),
      });

      const project2 = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "P2 for move",
        slug: "p2-move-" + Date.now(),
      });

      const suiteInP2 = await suiteService.create(ctx, { projectId: project2.id, name: "Suite P2" });

      const test = await testService.create(ctx, {
        projectId: project1.id,
        name: "Cross Move Test",
        kind: "e2e",
      });

      // Try to move to suite in different project
      await expect(
        testService.update(ctx, test.id, {
          suiteId: suiteInP2.id,
        })
      ).rejects.toThrow(ValidationError);

      // Clean up
      await projectService.delete(ctx, project1.id);
      await projectService.delete(ctx, project2.id);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        testService.update(ctx, testTests.searchProducts, { name: "Hacked" })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("delete", () => {
    it("soft deletes a test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Delete Test Project",
        slug: "delete-test-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "To Delete",
        kind: "e2e",
      });

      await testService.delete(ctx, test.id);

      // Should no longer be accessible
      await expect(testService.getById(ctx, test.id)).rejects.toThrow(NotFoundError);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws NotFoundError for non-existent test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(testService.delete(ctx, "tst_nonexistent")).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(testService.delete(ctx, testTests.searchProducts)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("updateTags", () => {
    it("adds tags to a test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Tags Test Project",
        slug: "tags-test-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "Tagged Test",
        kind: "e2e",
      });

      await testService.updateTags(ctx, {
        testId: test.id,
        tags: ["smoke", "regression"],
      });

      // Verify tags by listing tests (includes tags)
      const result = await testService.listByProject(ctx, { projectId: project.id });
      const taggedTest = result.tests.find((t) => t.id === test.id);

      expect(taggedTest?.tags).toContain("smoke");
      expect(taggedTest?.tags).toContain("regression");

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("removes tags by not including them", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Remove Tags Project",
        slug: "remove-tags-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "Remove Tag Test",
        kind: "e2e",
      });

      // Add initial tags
      await testService.updateTags(ctx, {
        testId: test.id,
        tags: ["tag1", "tag2", "tag3"],
      });

      // Remove tag2 by not including it
      await testService.updateTags(ctx, {
        testId: test.id,
        tags: ["tag1", "tag3"],
      });

      const result = await testService.listByProject(ctx, { projectId: project.id });
      const taggedTest = result.tests.find((t) => t.id === test.id);

      expect(taggedTest?.tags).toContain("tag1");
      expect(taggedTest?.tags).toContain("tag3");
      expect(taggedTest?.tags).not.toContain("tag2");

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("clears all tags with empty array", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Clear Tags Project",
        slug: "clear-tags-" + Date.now(),
      });

      const test = await testService.create(ctx, {
        projectId: project.id,
        name: "Clear Tag Test",
        kind: "e2e",
      });

      // Add tags
      await testService.updateTags(ctx, {
        testId: test.id,
        tags: ["tag1", "tag2"],
      });

      // Clear all
      await testService.updateTags(ctx, {
        testId: test.id,
        tags: [],
      });

      const result = await testService.listByProject(ctx, { projectId: project.id });
      const taggedTest = result.tests.find((t) => t.id === test.id);

      expect(taggedTest?.tags).toEqual([]);

      // Clean up
      await projectService.delete(ctx, project.id);
    });

    it("throws NotFoundError for non-existent test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        testService.updateTags(ctx, {
          testId: "tst_nonexistent",
          tags: ["tag"],
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
