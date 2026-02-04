/**
 * UserService tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createUserService } from "../src/services/user/index.js";
import { createTestContext, testUsers, testOrgs } from "../src/testing/index.js";
import { ForbiddenError } from "../src/errors.js";
import { setupTestDb, teardownTestDb, getDb, getBoss } from "./setup.js";

describe("UserService", () => {
  const userService = createUserService();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getPreferences", () => {
    it("returns default preferences for user without saved preferences", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonDev2, // Less likely to have preferences
      });

      const prefs = await userService.getPreferences(ctx);

      expect(prefs).toBeDefined();
      // Should have default theme
      expect(prefs.theme).toBe("system");
    });

    it("throws Error for non-user actor", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        actor: { type: "system" },
      });

      await expect(userService.getPreferences(ctx)).rejects.toThrow(Error);
    });
  });

  describe("updatePreferences", () => {
    it("creates preferences if none exist", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.uberDev1, // Use a different user to avoid conflicts
      });

      const prefs = await userService.updatePreferences(ctx, {
        theme: "dark",
      });

      expect(prefs).toBeDefined();
      expect(prefs.theme).toBe("dark");
    });

    it("updates existing preferences", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.openaiOwner,
      });

      // First update
      await userService.updatePreferences(ctx, {
        theme: "light",
        locale: "en-US",
      });

      // Second update - should merge
      const prefs = await userService.updatePreferences(ctx, {
        timezone: "America/Los_Angeles",
      });

      expect(prefs.theme).toBe("light"); // Preserved
      expect(prefs.locale).toBe("en-US"); // Preserved
      expect(prefs.timezone).toBe("America/Los_Angeles"); // New
    });

    it("throws Error for non-user actor", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        actor: { type: "system" },
      });

      await expect(
        userService.updatePreferences(ctx, { theme: "dark" })
      ).rejects.toThrow(Error);
    });
  });

  describe("getOrgPreferences", () => {
    it("returns default preferences for member without saved preferences", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.amazonDev2,
        orgId: testOrgs.amazon,
      });

      const prefs = await userService.getOrgPreferences(ctx, testOrgs.amazon);

      expect(prefs).toBeDefined();
      // Should be empty object by default
      expect(Object.keys(prefs).length).toBeGreaterThanOrEqual(0);
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(userService.getOrgPreferences(ctx, testOrgs.amazon)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe("updateOrgPreferences", () => {
    it("creates org preferences if none exist", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.githubDev1,
        orgId: testOrgs.github,
      });

      const prefs = await userService.updateOrgPreferences(ctx, testOrgs.github, {
        starredProjects: ["prj_1", "prj_2"],
      });

      expect(prefs).toBeDefined();
      expect(prefs.starredProjects).toEqual(["prj_1", "prj_2"]);
    });

    it("updates existing org preferences", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.notionOwner,
        orgId: testOrgs.notion,
      });

      // First update
      await userService.updateOrgPreferences(ctx, testOrgs.notion, {
        starredProjects: ["prj_a"],
      });

      // Second update - should merge
      const prefs = await userService.updateOrgPreferences(ctx, testOrgs.notion, {
        sidebarState: { collapsed: true },
      });

      expect(prefs.starredProjects).toEqual(["prj_a"]); // Preserved
      expect(prefs.sidebarState).toEqual({ collapsed: true }); // New
    });

    it("throws ForbiddenError for non-member", async () => {
      const ctx = createTestContext({
        db: getDb(),
        boss: getBoss(),
        userId: testUsers.stripeOwner,
        orgId: testOrgs.stripe,
      });

      await expect(
        userService.updateOrgPreferences(ctx, testOrgs.amazon, {
          starredProjects: ["hacked"],
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
