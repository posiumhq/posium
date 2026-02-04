/**
 * @posium/appevents publish helper tests.
 *
 * Tests the type-safe publish helper and utility functions.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMockBoss, type MockBoss } from "@posium/boss/testing";
import { publish, EVENTS, getAllEventNames, getEventNamesByDomain } from "../src/index.js";

describe("publish helper", () => {
  let mockBoss: MockBoss;

  beforeEach(() => {
    mockBoss = createMockBoss();
  });

  describe("publish()", () => {
    it("publishes run.created.v1 event with correct payload", async () => {
      const payload = {
        runId: "run_123",
        projectId: "prj_456",
        triggeredBy: "manual" as const,
      };

      await publish(mockBoss as any, EVENTS.RUN_CREATED_V1, payload);

      expect(mockBoss.publish).toHaveBeenCalledTimes(1);
      expect(mockBoss.publish).toHaveBeenCalledWith(
        "run.created.v1",
        payload,
      );
    });

    it("publishes run.completed.v1 event with correct payload", async () => {
      const payload = {
        runId: "run_123",
        projectId: "prj_456",
        status: "passed" as const,
        summary: {
          total: 10,
          passed: 10,
          failed: 0,
          skipped: 0,
          durationMs: 5000,
        },
      };

      await publish(mockBoss as any, EVENTS.RUN_COMPLETED_V1, payload);

      expect(mockBoss.publish).toHaveBeenCalledTimes(1);
      expect(mockBoss.publish).toHaveBeenCalledWith(
        "run.completed.v1",
        payload,
      );
    });

    it("publishes org.created.v1 event with correct payload", async () => {
      const payload = {
        orgId: "org_123",
        name: "Test Org",
        createdByUserId: "usr_456",
      };

      await publish(mockBoss as any, EVENTS.ORG_CREATED_V1, payload);

      expect(mockBoss.publish).toHaveBeenCalledWith(
        "org.created.v1",
        payload,
      );
    });

    it("publishes project.created.v1 event with correct payload", async () => {
      const payload = {
        projectId: "prj_123",
        orgId: "org_456",
        name: "Test Project",
        createdByUserId: "usr_789",
      };

      await publish(mockBoss as any, EVENTS.PROJECT_CREATED_V1, payload);

      expect(mockBoss.publish).toHaveBeenCalledWith(
        "project.created.v1",
        payload,
      );
    });

    it("publishes test.created.v1 event with correct payload", async () => {
      const payload = {
        testId: "test_123",
        projectId: "prj_456",
        name: "Login Test",
        createdByUserId: "usr_789",
      };

      await publish(mockBoss as any, EVENTS.TEST_CREATED_V1, payload);

      expect(mockBoss.publish).toHaveBeenCalledWith(
        "test.created.v1",
        payload,
      );
    });

    it("publishes schedule.created.v1 event with correct payload", async () => {
      const payload = {
        scheduleId: "sch_123",
        projectId: "prj_456",
        name: "Daily Tests",
        cron: "0 9 * * *",
        createdByUserId: "usr_789",
      };

      await publish(mockBoss as any, EVENTS.SCHEDULE_CREATED_V1, payload);

      expect(mockBoss.publish).toHaveBeenCalledWith(
        "schedule.created.v1",
        payload,
      );
    });
  });
});

describe("utility functions", () => {
  describe("getAllEventNames()", () => {
    it("returns all event names as an array", () => {
      const events = getAllEventNames();

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events).toContain("run.created.v1");
      expect(events).toContain("run.completed.v1");
      expect(events).toContain("org.created.v1");
      expect(events).toContain("project.created.v1");
    });

    it("includes all defined events", () => {
      const events = getAllEventNames();

      expect(events).toContain(EVENTS.RUN_CREATED_V1);
      expect(events).toContain(EVENTS.RUN_COMPLETED_V1);
      expect(events).toContain(EVENTS.ORG_CREATED_V1);
      expect(events).toContain(EVENTS.ORG_DELETED_V1);
      expect(events).toContain(EVENTS.PROJECT_CREATED_V1);
      expect(events).toContain(EVENTS.PROJECT_DELETED_V1);
      expect(events).toContain(EVENTS.TEST_CREATED_V1);
      expect(events).toContain(EVENTS.SCHEDULE_CREATED_V1);
    });
  });

  describe("getEventNamesByDomain()", () => {
    it("returns run domain events", () => {
      const events = getEventNamesByDomain("run");

      expect(events).toContain("run.created.v1");
      expect(events).toContain("run.completed.v1");
      expect(events).not.toContain("org.created.v1");
    });

    it("returns org domain events", () => {
      const events = getEventNamesByDomain("org");

      expect(events).toContain("org.created.v1");
      expect(events).toContain("org.deleted.v1");
      expect(events).toContain("org.member.invited.v1");
      expect(events).toContain("org.member.removed.v1");
      expect(events).not.toContain("run.created.v1");
    });

    it("returns project domain events", () => {
      const events = getEventNamesByDomain("project");

      expect(events).toContain("project.created.v1");
      expect(events).toContain("project.deleted.v1");
      expect(events).toContain("project.updated.v1");
      expect(events).not.toContain("org.created.v1");
    });

    it("returns test domain events", () => {
      const events = getEventNamesByDomain("test");

      expect(events).toContain("test.created.v1");
      expect(events).toContain("test.deleted.v1");
      expect(events).toContain("test.updated.v1");
    });

    it("returns schedule domain events", () => {
      const events = getEventNamesByDomain("schedule");

      expect(events).toContain("schedule.created.v1");
      expect(events).toContain("schedule.updated.v1");
      expect(events).toContain("schedule.deleted.v1");
    });
  });
});
