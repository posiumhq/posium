/**
 * SuiteService tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSuiteService } from "../src/services/suite/index.js";
import { createTestService } from "../src/services/test/index.js";
import { createTestContext, testUsers, testOrgs, testProjects, testSuites } from "../src/testing/index.js";
import { ForbiddenError, NotFoundError } from "../src/errors.js";
import { setupTestDb, teardownTestDb, getDb, getBoss } from "./setup.js";
import { schema } from "@posium/db";
import { createId } from "@posium/id";

describe("SuiteService", () => {
  const suiteService = createSuiteService();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("list", () => {
    it("lists suites for a project with stats", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Use perPage=100 to get all suites in one page
      const result = await suiteService.list(ctx, {
        projectId: testProjects.amazonStorefront,
        perPage: 100,
      });

      expect(result.suites).toBeDefined();
      expect(result.suites.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.perPage).toBe(100);

      // Should include Search suite
      const searchSuite = result.suites.find((s) => s.id === testSuites.amazonSearch);
      expect(searchSuite).toBeDefined();
      expect(searchSuite?.name).toBe("Search & Browse");
      expect(searchSuite?.testCount).toBeGreaterThanOrEqual(0);
    });

    it("returns empty array for project with no suites", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a new project without suites
      const { createProjectService } = await import("../src/services/project/index.js");
      const projectService = createProjectService();

      const project = await projectService.create(ctx, {
        orgId: testOrgs.amazon,
        name: "Empty Suite Test",
        slug: "empty-suite-" + Date.now(),
      });

      const result = await suiteService.list(ctx, { projectId: project.id });

      expect(result.suites).toEqual([]);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(0);

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
        suiteService.list(ctx, { projectId: testProjects.amazonStorefront })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getById", () => {
    it("gets suite by ID for org member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const suite = await suiteService.getById(ctx, testSuites.amazonSearch);

      expect(suite).toBeDefined();
      expect(suite.id).toBe(testSuites.amazonSearch);
      expect(suite.name).toBe("Search & Browse");
      expect(suite.projectId).toBe(testProjects.amazonStorefront);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(suiteService.getById(ctx, testSuites.amazonSearch)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("throws NotFoundError for non-existent suite", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(suiteService.getById(ctx, "ste_nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    it("creates a new suite", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "Test Suite " + Date.now(),
        description: "A test suite",
      });

      expect(suite).toBeDefined();
      expect(suite.id).toMatch(/^sui_/);
      expect(suite.name).toContain("Test Suite");
      expect(suite.projectId).toBe(testProjects.amazonStorefront);

      // Clean up
      await suiteService.delete(ctx, suite.id);
    });

    it("throws ForbiddenError when creating in project user cannot access", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        suiteService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          name: "Hacked Suite",
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("update", () => {
    it("updates suite name and description", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a suite to update
      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "Update Test Suite",
      });

      const updated = await suiteService.update(ctx, suite.id, {
        name: "Updated Suite Name",
        description: "Updated description",
      });

      expect(updated.name).toBe("Updated Suite Name");
      expect(updated.description).toBe("Updated description");

      // Clean up
      await suiteService.delete(ctx, suite.id);
    });

    it("throws ForbiddenError for non-member update", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        suiteService.update(ctx, testSuites.amazonSearch, { name: "Hacked" })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("delete", () => {
    it("soft deletes a suite", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a suite to delete
      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "Delete Test Suite",
      });

      // Delete it
      await suiteService.delete(ctx, suite.id);

      // Should no longer be retrievable
      await expect(suiteService.getById(ctx, suite.id)).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError for non-member delete", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(suiteService.delete(ctx, testSuites.amazonSearch)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe("getOverviewStats", () => {
    it("returns overview stats for a suite", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await suiteService.getOverviewStats(ctx, testSuites.amazonSearch);

      expect(result).toBeDefined();
      expect(result.suite).toBeDefined();
      expect(result.suite.id).toBe(testSuites.amazonSearch);
      expect(result.suite.name).toBe("Search & Browse");
      expect(result.testStats).toBeDefined();
      expect(typeof result.testStats.total).toBe("number");
      expect(typeof result.testStats.passing).toBe("number");
      expect(typeof result.testStats.failed).toBe("number");
      expect(typeof result.testStats.flaky).toBe("number");
      expect(typeof result.testStats.passingPercent).toBe("number");
      expect(typeof result.testStats.failedPercent).toBe("number");
      expect(typeof result.testStats.flakyPercent).toBe("number");
      expect(result.failingTests).toBeDefined();
      expect(Array.isArray(result.failingTests)).toBe(true);
      expect(result.recentRuns).toBeDefined();
      expect(Array.isArray(result.recentRuns)).toBe(true);
      expect(result.dailyRunsData).toBeDefined();
      expect(Array.isArray(result.dailyRunsData)).toBe(true);
      expect(result.dailyRunsData.length).toBe(14); // Last 14 days
    });

    it("returns empty stats for suite with no tests", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a new empty suite
      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "Empty Stats Suite " + Date.now(),
      });

      const result = await suiteService.getOverviewStats(ctx, suite.id);

      expect(result.suite.id).toBe(suite.id);
      expect(result.testStats.total).toBe(0);
      expect(result.testStats.passing).toBe(0);
      expect(result.testStats.failed).toBe(0);
      expect(result.testStats.flaky).toBe(0);
      expect(result.testStats.passingPercent).toBe(0);
      expect(result.testStats.failedPercent).toBe(0);
      expect(result.testStats.flakyPercent).toBe(0);
      expect(result.failingTests).toEqual([]);
      expect(result.recentRuns).toEqual([]);

      // Clean up
      await suiteService.delete(ctx, suite.id);
    });

    it("returns correct percentage calculations", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await suiteService.getOverviewStats(ctx, testSuites.amazonSearch);

      // Verify percentages add up correctly (or are all 0 if no tests)
      if (result.testStats.total > 0) {
        const sumPercent = result.testStats.passingPercent +
                          result.testStats.failedPercent +
                          result.testStats.flakyPercent;
        expect(sumPercent).toBeCloseTo(100, 1); // Should sum to 100%
      }
    });

    it("returns daily runs data for last 14 days", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await suiteService.getOverviewStats(ctx, testSuites.amazonSearch);

      expect(result.dailyRunsData).toHaveLength(14);

      // Each day should have the expected structure
      for (const day of result.dailyRunsData) {
        expect(day.date).toBeDefined();
        expect(typeof day.passed).toBe("number");
        expect(typeof day.failed).toBe("number");
        expect(typeof day.flaky).toBe("number");
        expect(day.passed).toBeGreaterThanOrEqual(0);
        expect(day.failed).toBeGreaterThanOrEqual(0);
        expect(day.flaky).toBeGreaterThanOrEqual(0);
      }
    });

    it("returns recent runs with correct structure", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await suiteService.getOverviewStats(ctx, testSuites.amazonSearch);

      // Recent runs should have the expected structure
      for (const run of result.recentRuns) {
        expect(run.id).toBeDefined();
        expect(run.status).toBeDefined();
        expect(run.createdAt).toBeDefined();
        expect(run.stats).toBeDefined();
        expect(typeof run.stats.total).toBe("number");
        expect(typeof run.stats.passed).toBe("number");
        expect(run.branch).toBeDefined();
      }

      // Should be limited to 5 recent runs
      expect(result.recentRuns.length).toBeLessThanOrEqual(5);
    });

    it("returns failing tests with correct structure", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await suiteService.getOverviewStats(ctx, testSuites.amazonSearch);

      // Failing tests should have the expected structure
      for (const test of result.failingTests) {
        expect(test.id).toBeDefined();
        expect(test.name).toBeDefined();
        expect(["failed", "flaky"]).toContain(test.status);
      }

      // Should be limited to 5 failing tests
      expect(result.failingTests.length).toBeLessThanOrEqual(5);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        suiteService.getOverviewStats(ctx, testSuites.amazonSearch)
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError for non-existent suite", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        suiteService.getOverviewStats(ctx, "ste_nonexistent")
      ).rejects.toThrow(NotFoundError);
    });

    it("detects flaky tests that passed on retry (attempt > 1)", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const testService = createTestService();

      // Create a new suite
      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "Flaky Detection Test Suite " + Date.now(),
      });

      // Create a test in the suite
      const test = await testService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        name: "Flaky Test",
        kind: "test",
      });

      // Create a test version (required for the test to be considered "published")
      const testVersionId = createId("testVersion");
      await getDb().insert(schema.testVersion).values({
        id: testVersionId,
        testId: test.id,
        version: 1,
        steps: [],
      });

      // Create a run for this suite
      const runId = createId("run");
      await getDb().insert(schema.run).values({
        id: runId,
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        trigger: "manual",
        status: "passed",
        config: {},
      });

      // Create a runTest that passed on retry (attempt = 2)
      // This simulates a test that failed on first attempt but passed on second
      const runTestId = createId("runTest");
      await getDb().insert(schema.runTest).values({
        id: runTestId,
        runId: runId,
        testId: test.id,
        testVersionId: testVersionId,
        status: "passed",
        attempt: 2, // Passed on retry - should be detected as flaky
      });

      // Get overview stats
      const result = await suiteService.getOverviewStats(ctx, suite.id);

      // The test should be counted as flaky, not passing
      expect(result.testStats.flaky).toBe(1);
      expect(result.testStats.passing).toBe(0);
      expect(result.testStats.failed).toBe(0);
      expect(result.testStats.total).toBe(1);

      // The test should appear in failingTests as flaky
      expect(result.failingTests.length).toBe(1);
      expect(result.failingTests[0].status).toBe("flaky");
      expect(result.failingTests[0].id).toBe(test.id);

      // Clean up
      await suiteService.delete(ctx, suite.id);
    });

    it("correctly identifies tests with explicit flaky status", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const testService = createTestService();

      // Create a new suite
      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "Explicit Flaky Test Suite " + Date.now(),
      });

      // Create a test in the suite
      const test = await testService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        name: "Explicitly Flaky Test",
        kind: "test",
      });

      // Create a test version
      const testVersionId = createId("testVersion");
      await getDb().insert(schema.testVersion).values({
        id: testVersionId,
        testId: test.id,
        version: 1,
        steps: [],
      });

      // Create a run for this suite
      const runId = createId("run");
      await getDb().insert(schema.run).values({
        id: runId,
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        trigger: "manual",
        status: "passed",
        config: {},
      });

      // Create a runTest with explicit flaky status
      const runTestId = createId("runTest");
      await getDb().insert(schema.runTest).values({
        id: runTestId,
        runId: runId,
        testId: test.id,
        testVersionId: testVersionId,
        status: "flaky",
        attempt: 1,
      });

      // Get overview stats
      const result = await suiteService.getOverviewStats(ctx, suite.id);

      // The test should be counted as flaky
      expect(result.testStats.flaky).toBe(1);
      expect(result.testStats.passing).toBe(0);
      expect(result.testStats.failed).toBe(0);

      // Clean up
      await suiteService.delete(ctx, suite.id);
    });
  });

  describe("list stats with flaky detection", () => {
    it("detects flaky tests in list stats", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const testService = createTestService();

      // Create a new suite
      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "List Flaky Test Suite " + Date.now(),
      });

      // Create a test in the suite
      const test = await testService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        name: "Flaky Test for List",
        kind: "test",
      });

      // Create a test version
      const testVersionId = createId("testVersion");
      await getDb().insert(schema.testVersion).values({
        id: testVersionId,
        testId: test.id,
        version: 1,
        steps: [],
      });

      // Create a run for this suite
      const runId = createId("run");
      await getDb().insert(schema.run).values({
        id: runId,
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        trigger: "manual",
        status: "passed",
        config: {},
      });

      // Create a runTest that passed on retry (attempt = 2)
      const runTestId = createId("runTest");
      await getDb().insert(schema.runTest).values({
        id: runTestId,
        runId: runId,
        testId: test.id,
        testVersionId: testVersionId,
        status: "passed",
        attempt: 2,
      });

      // Get list with stats
      const result = await suiteService.list(ctx, {
        projectId: testProjects.amazonStorefront,
        perPage: 100,
      });

      // Find our suite
      const testSuite = result.suites.find((s) => s.id === suite.id);
      expect(testSuite).toBeDefined();

      // The test should be counted as flaky in the list stats
      expect(testSuite!.testStats.flaky).toBe(1);
      expect(testSuite!.testStats.passing).toBe(0);

      // Clean up
      await suiteService.delete(ctx, suite.id);
    });

    it("prioritizes newer run results over older ones", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const testService = createTestService();

      // Create a new suite
      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "Run Priority Test Suite " + Date.now(),
      });

      // Create a test in the suite
      const test = await testService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        name: "Run Priority Test",
        kind: "test",
      });

      // Create a test version
      const testVersionId = createId("testVersion");
      await getDb().insert(schema.testVersion).values({
        id: testVersionId,
        testId: test.id,
        version: 1,
        steps: [],
      });

      // Create an older run (failed)
      const olderRunId = createId("run");
      const olderDate = new Date(Date.now() - 60000); // 1 minute ago
      await getDb().insert(schema.run).values({
        id: olderRunId,
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        trigger: "manual",
        status: "failed",
        config: {},
        createdAt: olderDate,
      });

      // Create runTest for older run (failed)
      await getDb().insert(schema.runTest).values({
        id: createId("runTest"),
        runId: olderRunId,
        testId: test.id,
        testVersionId: testVersionId,
        status: "failed",
        attempt: 1,
        createdAt: olderDate,
      });

      // Create a newer run (passed)
      const newerRunId = createId("run");
      const newerDate = new Date(); // now
      await getDb().insert(schema.run).values({
        id: newerRunId,
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        trigger: "manual",
        status: "passed",
        config: {},
        createdAt: newerDate,
      });

      // Create runTest for newer run (passed)
      await getDb().insert(schema.runTest).values({
        id: createId("runTest"),
        runId: newerRunId,
        testId: test.id,
        testVersionId: testVersionId,
        status: "passed",
        attempt: 1,
        createdAt: newerDate,
      });

      // Get overview stats - should use the newer run's result (passed)
      const result = await suiteService.getOverviewStats(ctx, suite.id);

      // The test should be counted as passing (from the newer run)
      expect(result.testStats.passing).toBe(1);
      expect(result.testStats.failed).toBe(0);

      // Clean up
      await suiteService.delete(ctx, suite.id);
    });

    it("uses newer run result when multiple runs exist", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const testService = createTestService();

      // Create a new suite
      const suite = await suiteService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        name: "Newer Run Result Test Suite " + Date.now(),
      });

      // Create a test in the suite
      const test = await testService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        name: "Newer Run Result Test",
        kind: "test",
      });

      // Create a test version
      const testVersionId = createId("testVersion");
      await getDb().insert(schema.testVersion).values({
        id: testVersionId,
        testId: test.id,
        version: 1,
        steps: [],
      });

      // Create timestamps: first run is older, second run is newer
      const firstTimestamp = new Date();
      const secondTimestamp = new Date(firstTimestamp.getTime() + 1000); // 1 second later

      // Create first run (older)
      const firstRunId = createId("run");
      await getDb().insert(schema.run).values({
        id: firstRunId,
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        trigger: "manual",
        status: "failed",
        config: {},
        createdAt: firstTimestamp,
      });

      // Create runTest for first run (failed)
      await getDb().insert(schema.runTest).values({
        id: createId("runTest"),
        runId: firstRunId,
        testId: test.id,
        testVersionId: testVersionId,
        status: "failed",
        attempt: 1,
        createdAt: firstTimestamp,
      });

      // Create second run (newer)
      const secondRunId = createId("run");
      await getDb().insert(schema.run).values({
        id: secondRunId,
        projectId: testProjects.amazonStorefront,
        suiteId: suite.id,
        trigger: "manual",
        status: "passed",
        config: {},
        createdAt: secondTimestamp,
      });

      // Create runTest for second run (passed)
      await getDb().insert(schema.runTest).values({
        id: createId("runTest"),
        runId: secondRunId,
        testId: test.id,
        testVersionId: testVersionId,
        status: "passed",
        attempt: 1,
        createdAt: secondTimestamp,
      });

      // Get overview stats - should use the second run's result (passed) as it's newer
      const result = await suiteService.getOverviewStats(ctx, suite.id);

      // The test should be counted as passing (from the newer run)
      expect(result.testStats.passing).toBe(1);
      expect(result.testStats.failed).toBe(0);

      // Clean up
      await suiteService.delete(ctx, suite.id);
    });
  });
});
