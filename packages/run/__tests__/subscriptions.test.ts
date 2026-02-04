/**
 * @posium/run subscription setup tests.
 *
 * Tests that the run queue is properly created and subscribed to events.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMockBoss, type MockBoss } from "@posium/boss/testing";
import { EVENTS } from "@posium/appevents";
import { QUEUES } from "@posium/queues";
import { setupRunSubscriptions } from "../src/subscriptions.js";

describe("setupRunSubscriptions", () => {
  let mockBoss: MockBoss;

  beforeEach(() => {
    mockBoss = createMockBoss();
  });

  it("creates the dead-letter queue first", async () => {
    await setupRunSubscriptions(mockBoss as any);

    // First createQueue call should be for the DLQ
    expect(mockBoss.createQueue).toHaveBeenCalledTimes(2);
    expect(mockBoss.createQueue.mock.calls[0][0]).toBe(QUEUES.RUN_DLQ);
  });

  it("creates the main run queue", async () => {
    await setupRunSubscriptions(mockBoss as any);

    // Second createQueue call should be for the main queue
    expect(mockBoss.createQueue.mock.calls[1][0]).toBe(QUEUES.RUN);
  });

  it("creates run queue with correct DLQ configuration", async () => {
    await setupRunSubscriptions(mockBoss as any);

    const mainQueueCall = mockBoss.createQueue.mock.calls[1];
    const options = mainQueueCall[1];

    expect(options.deadLetter).toBe(QUEUES.RUN_DLQ);
  });

  it("creates run queue with retry configuration", async () => {
    await setupRunSubscriptions(mockBoss as any);

    const mainQueueCall = mockBoss.createQueue.mock.calls[1];
    const options = mainQueueCall[1];

    expect(options.retryLimit).toBe(3);
    expect(options.retryBackoff).toBe(true);
  });

  it("creates run queue with expiration for long-running tests", async () => {
    await setupRunSubscriptions(mockBoss as any);

    const mainQueueCall = mockBoss.createQueue.mock.calls[1];
    const options = mainQueueCall[1];

    // 1 hour timeout for test execution
    expect(options.expireInSeconds).toBe(3600);
  });

  it("subscribes run queue to run.created.v1 event", async () => {
    await setupRunSubscriptions(mockBoss as any);

    expect(mockBoss.subscribe).toHaveBeenCalledTimes(1);
    expect(mockBoss.subscribe).toHaveBeenCalledWith(
      EVENTS.RUN_CREATED_V1,
      QUEUES.RUN,
    );
  });

  it("creates DLQ with no retries", async () => {
    await setupRunSubscriptions(mockBoss as any);

    const dlqCall = mockBoss.createQueue.mock.calls[0];
    const options = dlqCall[1];

    expect(options.retryLimit).toBe(0);
  });

  it("creates DLQ with 23-hour expiration", async () => {
    await setupRunSubscriptions(mockBoss as any);

    const dlqCall = mockBoss.createQueue.mock.calls[0];
    const options = dlqCall[1];

    // 23 hours (82800s) - pgboss max is 24h so we stay under
    expect(options.expireInSeconds).toBe(82800);
  });
});
