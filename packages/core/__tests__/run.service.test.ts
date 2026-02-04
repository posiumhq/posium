/**
 * RunService tests.
 *
 * Tests run listing and retrieval with stats calculation.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRunService } from "../src/services/run/index.js";
import { createTestContext, testUsers, testOrgs, testProjects, testSuites, testRuns } from "../src/testing/index.js";
import { ForbiddenError, NotFoundError } from "../src/errors.js";
import { setupTestDb, teardownTestDb, getDb, getBoss } from "./setup.js";

describe("RunService", () => {
  const runService = createRunService();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("listByProject", () => {
    it("lists runs for a project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await runService.listByProject(ctx, { projectId: testProjects.amazonStorefront });

      expect(result).toBeDefined();
      expect(result.runs).toBeDefined();
      expect(Array.isArray(result.runs)).toBe(true);
      expect(result.suites).toBeDefined();
      expect(Array.isArray(result.suites)).toBe(true);
    });

    it("includes run stats in response", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await runService.listByProject(ctx, { projectId: testProjects.amazonStorefront });

      if (result.runs.length > 0) {
        const run = result.runs[0];
        expect(run.id).toBeDefined();
        expect(run.projectId).toBe(testProjects.amazonStorefront);
        expect(run.status).toBeDefined();
        expect(run.stats).toBeDefined();
        expect(typeof run.stats.total).toBe("number");
        expect(typeof run.stats.passed).toBe("number");
        expect(typeof run.stats.failed).toBe("number");
      }
    });

    it("respects perPage parameter", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await runService.listByProject(ctx, {
        projectId: testProjects.amazonStorefront,
        perPage: 2,
      });

      expect(result.runs.length).toBeLessThanOrEqual(2);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.perPage).toBe(2);
    });

    it("throws NotFoundError for non-existent project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        runService.listByProject(ctx, { projectId: "prj_nonexistent" })
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
        runService.listByProject(ctx, { projectId: testProjects.amazonStorefront })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("listBySuite", () => {
    it("lists runs for a suite", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await runService.listBySuite(ctx, { suiteId: testSuites.amazonSearch });

      expect(result).toBeDefined();
      expect(result.runs).toBeDefined();
      expect(Array.isArray(result.runs)).toBe(true);
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
        runService.listBySuite(ctx, { suiteId: "sui_nonexistent" })
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
        runService.listBySuite(ctx, { suiteId: testSuites.amazonSearch })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("listByTest", () => {
    it("lists runs for a test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Use a seed test that might have runs
      const result = await runService.listByTest(ctx, { testId: "tst_seed_search_products" });

      expect(result).toBeDefined();
      expect(result.runs).toBeDefined();
      expect(Array.isArray(result.runs)).toBe(true);
      expect(result.test).toBeDefined();
      expect(result.test.id).toBe("tst_seed_search_products");
    });

    it("throws NotFoundError for non-existent test", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        runService.listByTest(ctx, { testId: "tst_nonexistent" })
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
        runService.listByTest(ctx, { testId: "tst_seed_search_products" })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getById", () => {
    it("gets run by ID", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const run = await runService.getById(ctx, testRuns.amazonRun1);

      expect(run).toBeDefined();
      expect(run.id).toBe(testRuns.amazonRun1);
      expect(run.projectId).toBe(testProjects.amazonStorefront);
      expect(run.trigger).toBeDefined();
      expect(run.status).toBeDefined();
    });

    it("throws NotFoundError for non-existent run", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        runService.getById(ctx, "run_nonexistent")
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
        runService.getById(ctx, testRuns.amazonRun1)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getByIdWithDetails", () => {
    it("gets run with full details", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const run = await runService.getByIdWithDetails(ctx, testRuns.amazonRun1);

      expect(run).toBeDefined();
      expect(run.id).toBe(testRuns.amazonRun1);
      expect(run.trigger).toBeDefined();
      expect(run.trigger.type).toBeDefined();
      expect(run.stats).toBeDefined();
      expect(typeof run.stats.total).toBe("number");
      expect(typeof run.isSingleTestRun).toBe("boolean");
    });

    it("includes branch and environment metadata", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const run = await runService.getByIdWithDetails(ctx, testRuns.amazonRun1);

      expect(run.branch).toBeDefined();
      expect(run.environment).toBeDefined();
    });

    it("throws NotFoundError for non-existent run", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        runService.getByIdWithDetails(ctx, "run_nonexistent")
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
        runService.getByIdWithDetails(ctx, testRuns.amazonRun1)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getTestsForRun", () => {
    it("gets tests for a run", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await runService.getTestsForRun(ctx, testRuns.amazonRun1);

      expect(result).toBeDefined();
      expect(result.tests).toBeDefined();
      expect(Array.isArray(result.tests)).toBe(true);

      if (result.tests.length > 0) {
        const test = result.tests[0];
        expect(test.id).toBeDefined();
        expect(test.testId).toBeDefined();
        expect(test.name).toBeDefined();
        expect(test.status).toBeDefined();
      }
    });

    it("throws NotFoundError for non-existent run", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        runService.getTestsForRun(ctx, "run_nonexistent")
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
        runService.getTestsForRun(ctx, testRuns.amazonRun1)
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
