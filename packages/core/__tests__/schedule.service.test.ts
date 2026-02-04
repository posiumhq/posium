/**
 * ScheduleService tests.
 *
 * Tests schedule CRUD operations with plan and environment validation.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createScheduleService } from "../src/services/schedule/index.js";
import {
  createTestContext,
  testUsers,
  testOrgs,
  testProjects,
  testSchedules,
  testPlans,
  testEnvironments,
} from "../src/testing/index.js";
import { ForbiddenError, NotFoundError } from "../src/errors.js";
import { setupTestDb, teardownTestDb, getDb, getBoss } from "./setup.js";

describe("ScheduleService", () => {
  const scheduleService = createScheduleService();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("list", () => {
    it("lists schedules for a project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await scheduleService.list(ctx, { projectId: testProjects.amazonStorefront });

      expect(result).toBeDefined();
      expect(result.schedules).toBeDefined();
      expect(Array.isArray(result.schedules)).toBe(true);
      expect(result.plans).toBeDefined();
      expect(Array.isArray(result.plans)).toBe(true);
    });

    it("includes schedule details with plan, tests, and suites", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const result = await scheduleService.list(ctx, { projectId: testProjects.amazonStorefront });

      expect(result.schedules.length).toBeGreaterThan(0);

      const schedule = result.schedules[0];
      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBeDefined();
      expect(schedule.cron).toBeDefined();
      expect(schedule.timezone).toBeDefined();
      expect(schedule.status).toMatch(/^(enabled|disabled)$/);
      expect(schedule.planId).toBeDefined();
      expect(schedule.planName).toBeDefined();
      expect(schedule.tests).toBeDefined();
      expect(schedule.suites).toBeDefined();
    });

    it("returns empty arrays for project with no schedules", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Use a project that may not have schedules
      const result = await scheduleService.list(ctx, { projectId: testProjects.amazonSeller });

      expect(result.schedules).toEqual([]);
      expect(result.plans).toEqual([]);
    });

    it("throws NotFoundError for non-existent project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.list(ctx, { projectId: "prj_nonexistent" })
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
        scheduleService.list(ctx, { projectId: testProjects.amazonStorefront })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getById", () => {
    it("gets schedule by ID", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const schedule = await scheduleService.getById(ctx, testSchedules.amazonDailySmoke);

      expect(schedule).toBeDefined();
      expect(schedule.id).toBe(testSchedules.amazonDailySmoke);
      expect(schedule.projectId).toBe(testProjects.amazonStorefront);
      expect(schedule.name).toBeDefined();
      expect(schedule.cron).toBeDefined();
      expect(schedule.timezone).toBeDefined();
      expect(schedule.status).toMatch(/^(enabled|disabled)$/);
      expect(schedule.planId).toBeDefined();
    });

    it("throws NotFoundError for non-existent schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.getById(ctx, "sch_nonexistent")
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
        scheduleService.getById(ctx, testSchedules.amazonDailySmoke)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("create", () => {
    it("creates a new schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const schedule = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Test Schedule",
        cron: "0 9 * * *",
        timezone: "America/New_York",
      });

      expect(schedule).toBeDefined();
      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBe("Test Schedule");
      expect(schedule.cron).toBe("0 9 * * *");
      expect(schedule.timezone).toBe("America/New_York");
      expect(schedule.status).toBe("enabled");
      expect(schedule.projectId).toBe(testProjects.amazonStorefront);
      expect(schedule.planId).toBe(testPlans.amazonSmoke);
    });

    it("creates a schedule with environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const schedule = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Staging Schedule",
        cron: "0 10 * * *",
        timezone: "UTC",
        environmentId: testEnvironments.amazonStorefrontStaging,
      });

      expect(schedule).toBeDefined();
      expect(schedule.environmentId).toBe(testEnvironments.amazonStorefrontStaging);
    });

    it("creates a schedule with metadata", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const schedule = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Metadata Schedule",
        cron: "0 11 * * *",
        timezone: "UTC",
        metadata: { source: "test", priority: "high" },
      });

      expect(schedule).toBeDefined();
      expect(schedule.id).toBeDefined();
    });

    it("throws NotFoundError for non-existent project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.create(ctx, {
          projectId: "prj_nonexistent",
          planId: testPlans.amazonSmoke,
          name: "Test Schedule",
          cron: "0 9 * * *",
          timezone: "UTC",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for non-existent plan", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          planId: "pln_nonexistent",
          name: "Test Schedule",
          cron: "0 9 * * *",
          timezone: "UTC",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for plan from different project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Try to use Stripe's plan for Amazon's project
      await expect(
        scheduleService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          planId: testPlans.stripeDaily,
          name: "Cross Project Plan Schedule",
          cron: "0 9 * * *",
          timezone: "UTC",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for non-existent environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          planId: testPlans.amazonSmoke,
          name: "Test Schedule",
          cron: "0 9 * * *",
          timezone: "UTC",
          environmentId: "env_nonexistent",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for environment from different project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Try to use Stripe's environment for Amazon's project
      await expect(
        scheduleService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          planId: testPlans.amazonSmoke,
          name: "Cross Project Env Schedule",
          cron: "0 9 * * *",
          timezone: "UTC",
          environmentId: testEnvironments.stripeDashboardDev,
        })
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
        scheduleService.create(ctx, {
          projectId: testProjects.amazonStorefront,
          planId: testPlans.amazonSmoke,
          name: "Test Schedule",
          cron: "0 9 * * *",
          timezone: "UTC",
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("update", () => {
    it("updates schedule name", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a schedule first
      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Original Name",
        cron: "0 12 * * *",
        timezone: "UTC",
      });

      const updated = await scheduleService.update(ctx, created.id, {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.id).toBe(created.id);
    });

    it("updates schedule cron and timezone", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Cron Update Test",
        cron: "0 8 * * *",
        timezone: "UTC",
      });

      const updated = await scheduleService.update(ctx, created.id, {
        cron: "0 18 * * MON-FRI",
        timezone: "Europe/London",
      });

      expect(updated.cron).toBe("0 18 * * MON-FRI");
      expect(updated.timezone).toBe("Europe/London");
    });

    it("updates schedule environment", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Env Update Test",
        cron: "0 9 * * *",
        timezone: "UTC",
        environmentId: testEnvironments.amazonStorefrontDev,
      });

      const updated = await scheduleService.update(ctx, created.id, {
        environmentId: testEnvironments.amazonStorefrontProd,
      });

      expect(updated.environmentId).toBe(testEnvironments.amazonStorefrontProd);
    });

    it("clears environment when set to null", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Clear Env Test",
        cron: "0 9 * * *",
        timezone: "UTC",
        environmentId: testEnvironments.amazonStorefrontDev,
      });

      const updated = await scheduleService.update(ctx, created.id, {
        environmentId: null,
      });

      expect(updated.environmentId).toBeNull();
    });

    it("throws NotFoundError for non-existent schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.update(ctx, "sch_nonexistent", { name: "Updated" })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for environment from different project", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Cross Project Env Update",
        cron: "0 9 * * *",
        timezone: "UTC",
      });

      // Try to update with Stripe's environment
      await expect(
        scheduleService.update(ctx, created.id, {
          environmentId: testEnvironments.stripeDashboardDev,
        })
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
        scheduleService.update(ctx, testSchedules.amazonDailySmoke, { name: "Hacked" })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("enable", () => {
    it("enables a disabled schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create and disable a schedule first
      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Enable Test",
        cron: "0 9 * * *",
        timezone: "UTC",
      });

      await scheduleService.disable(ctx, created.id);
      const enabled = await scheduleService.enable(ctx, created.id);

      expect(enabled.status).toBe("enabled");
    });

    it("throws NotFoundError for non-existent schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.enable(ctx, "sch_nonexistent")
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
        scheduleService.enable(ctx, testSchedules.amazonDailySmoke)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("disable", () => {
    it("disables an enabled schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create an enabled schedule
      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Disable Test",
        cron: "0 9 * * *",
        timezone: "UTC",
      });

      expect(created.status).toBe("enabled");

      const disabled = await scheduleService.disable(ctx, created.id);

      expect(disabled.status).toBe("disabled");
    });

    it("throws NotFoundError for non-existent schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.disable(ctx, "sch_nonexistent")
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
        scheduleService.disable(ctx, testSchedules.amazonDailySmoke)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("delete", () => {
    it("soft deletes a schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      // Create a schedule to delete
      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Delete Test",
        cron: "0 9 * * *",
        timezone: "UTC",
      });

      await scheduleService.delete(ctx, created.id);

      // Verify it's no longer accessible
      await expect(
        scheduleService.getById(ctx, created.id)
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for non-existent schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      await expect(
        scheduleService.delete(ctx, "sch_nonexistent")
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for already deleted schedule", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonOwner,
        orgId: testOrgs.amazon,
      });

      const created = await scheduleService.create(ctx, {
        projectId: testProjects.amazonStorefront,
        planId: testPlans.amazonSmoke,
        name: "Double Delete Test",
        cron: "0 9 * * *",
        timezone: "UTC",
      });

      await scheduleService.delete(ctx, created.id);

      // Second delete should fail
      await expect(
        scheduleService.delete(ctx, created.id)
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
        scheduleService.delete(ctx, testSchedules.amazonDailySmoke)
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
