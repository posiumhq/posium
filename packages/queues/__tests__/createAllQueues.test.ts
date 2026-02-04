/**
 * Tests for createAllQueues function.
 *
 * Verifies that all queues are created in the correct order
 * (DLQs first, then main queues that reference them).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMockBoss, type MockBoss } from "@posium/boss/testing";
import { createAllQueues, QUEUES, QUEUE_OPTIONS } from "../src/index.js";

describe("createAllQueues", () => {
  let mockBoss: MockBoss;

  beforeEach(() => {
    mockBoss = createMockBoss();
  });

  it("creates all queues", async () => {
    await createAllQueues(mockBoss as any);

    // Should create 14 queues total (7 main + 7 DLQ)
    expect(mockBoss.createQueue).toHaveBeenCalledTimes(14);
  });

  it("creates DLQ queues before main queues", async () => {
    await createAllQueues(mockBoss as any);

    const calls = mockBoss.createQueue.mock.calls;

    // First 7 calls should be DLQs
    const dlqCalls = calls.slice(0, 7).map((c) => c[0]);
    expect(dlqCalls).toContain(QUEUES.RUN_DLQ);
    expect(dlqCalls).toContain(QUEUES.PROJECT_HOOKS_DLQ);
    expect(dlqCalls).toContain(QUEUES.NOTIFS_DLQ);
    expect(dlqCalls).toContain(QUEUES.DAILY_DIGEST_DLQ);
    expect(dlqCalls).toContain(QUEUES.WEEKLY_DIGEST_DLQ);
    expect(dlqCalls).toContain(QUEUES.TEST_FAILURE_DLQ);
    expect(dlqCalls).toContain(QUEUES.TEST_FAILURE_BATCH_DLQ);

    // Last 7 calls should be main queues
    const mainCalls = calls.slice(7, 14).map((c) => c[0]);
    expect(mainCalls).toContain(QUEUES.RUN);
    expect(mainCalls).toContain(QUEUES.PROJECT_HOOKS);
    expect(mainCalls).toContain(QUEUES.NOTIFS);
    expect(mainCalls).toContain(QUEUES.DAILY_DIGEST);
    expect(mainCalls).toContain(QUEUES.WEEKLY_DIGEST);
    expect(mainCalls).toContain(QUEUES.TEST_FAILURE);
    expect(mainCalls).toContain(QUEUES.TEST_FAILURE_BATCH);
  });

  it("passes correct options for each queue", async () => {
    await createAllQueues(mockBoss as any);

    const calls = mockBoss.createQueue.mock.calls;

    // Check that each call uses the correct options from QUEUE_OPTIONS
    for (const [queueName, options] of calls) {
      expect(options).toEqual(QUEUE_OPTIONS[queueName as string]);
    }
  });

  it("creates RUN queue with correct deadLetter reference", async () => {
    await createAllQueues(mockBoss as any);

    const runCall = mockBoss.createQueue.mock.calls.find(
      (c) => c[0] === QUEUES.RUN,
    );

    expect(runCall).toBeDefined();
    expect(runCall![1]).toEqual(
      expect.objectContaining({
        deadLetter: QUEUES.RUN_DLQ,
      }),
    );
  });

  it("creates PROJECT_HOOKS queue with correct deadLetter reference", async () => {
    await createAllQueues(mockBoss as any);

    const hooksCall = mockBoss.createQueue.mock.calls.find(
      (c) => c[0] === QUEUES.PROJECT_HOOKS,
    );

    expect(hooksCall).toBeDefined();
    expect(hooksCall![1]).toEqual(
      expect.objectContaining({
        deadLetter: QUEUES.PROJECT_HOOKS_DLQ,
      }),
    );
  });

  it("creates NOTIFS queue with correct deadLetter reference", async () => {
    await createAllQueues(mockBoss as any);

    const notifsCall = mockBoss.createQueue.mock.calls.find(
      (c) => c[0] === QUEUES.NOTIFS,
    );

    expect(notifsCall).toBeDefined();
    expect(notifsCall![1]).toEqual(
      expect.objectContaining({
        deadLetter: QUEUES.NOTIFS_DLQ,
      }),
    );
  });

  it("creates digest queues with correct deadLetter references", async () => {
    await createAllQueues(mockBoss as any);

    const dailyCall = mockBoss.createQueue.mock.calls.find(
      (c) => c[0] === QUEUES.DAILY_DIGEST,
    );
    const weeklyCall = mockBoss.createQueue.mock.calls.find(
      (c) => c[0] === QUEUES.WEEKLY_DIGEST,
    );

    expect(dailyCall).toBeDefined();
    expect(dailyCall![1]).toEqual(
      expect.objectContaining({
        deadLetter: QUEUES.DAILY_DIGEST_DLQ,
      }),
    );

    expect(weeklyCall).toBeDefined();
    expect(weeklyCall![1]).toEqual(
      expect.objectContaining({
        deadLetter: QUEUES.WEEKLY_DIGEST_DLQ,
      }),
    );
  });

  it("DLQ queues have no deadLetter (retryLimit: 0)", async () => {
    await createAllQueues(mockBoss as any);

    const dlqCalls = mockBoss.createQueue.mock.calls.filter((c) =>
      (c[0] as string).endsWith("_dlq"),
    );

    for (const [, options] of dlqCalls) {
      expect(options).toEqual(
        expect.objectContaining({
          retryLimit: 0,
        }),
      );
      expect(options).not.toHaveProperty("deadLetter");
    }
  });
});

describe("queue configuration", () => {
  it("all main queues have retry configuration", () => {
    const mainQueues = [
      QUEUES.RUN,
      QUEUES.PROJECT_HOOKS,
      QUEUES.NOTIFS,
      QUEUES.DAILY_DIGEST,
      QUEUES.WEEKLY_DIGEST,
      QUEUES.TEST_FAILURE,
      QUEUES.TEST_FAILURE_BATCH,
    ];

    for (const queue of mainQueues) {
      const options = QUEUE_OPTIONS[queue];
      expect(options.retryLimit).toBeGreaterThan(0);
      expect(options.deadLetter).toBeDefined();
    }
  });

  it("all DLQ queues have retryLimit of 0", () => {
    const dlqQueues = [
      QUEUES.RUN_DLQ,
      QUEUES.PROJECT_HOOKS_DLQ,
      QUEUES.NOTIFS_DLQ,
      QUEUES.DAILY_DIGEST_DLQ,
      QUEUES.WEEKLY_DIGEST_DLQ,
      QUEUES.TEST_FAILURE_DLQ,
      QUEUES.TEST_FAILURE_BATCH_DLQ,
    ];

    for (const queue of dlqQueues) {
      const options = QUEUE_OPTIONS[queue];
      expect(options.retryLimit).toBe(0);
    }
  });
});
