/**
 * @posium/hook subscription setup tests.
 *
 * Tests that the project_hooks queue is properly created and subscribed to webhook events.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMockBoss, type MockBoss } from "@posium/boss/testing";
import { EVENTS } from "@posium/appevents";
import { QUEUES } from "@posium/queues";
import { setupHookSubscriptions, getHookEvents } from "../src/subscriptions.js";

describe("setupHookSubscriptions", () => {
  let mockBoss: MockBoss;

  beforeEach(() => {
    mockBoss = createMockBoss();
  });

  it("creates the dead-letter queue first", async () => {
    await setupHookSubscriptions(mockBoss as any);

    // First createQueue call should be for the DLQ
    expect(mockBoss.createQueue).toHaveBeenCalled();
    expect(mockBoss.createQueue.mock.calls[0][0]).toBe(QUEUES.PROJECT_HOOKS_DLQ);
  });

  it("creates the main project_hooks queue", async () => {
    await setupHookSubscriptions(mockBoss as any);

    // Second createQueue call should be for the main queue
    expect(mockBoss.createQueue.mock.calls[1][0]).toBe(QUEUES.PROJECT_HOOKS);
  });

  it("creates project_hooks queue with correct DLQ configuration", async () => {
    await setupHookSubscriptions(mockBoss as any);

    const mainQueueCall = mockBoss.createQueue.mock.calls[1];
    const options = mainQueueCall[1];

    expect(options.deadLetter).toBe(QUEUES.PROJECT_HOOKS_DLQ);
  });

  it("creates project_hooks queue with retry configuration for webhooks", async () => {
    await setupHookSubscriptions(mockBoss as any);

    const mainQueueCall = mockBoss.createQueue.mock.calls[1];
    const options = mainQueueCall[1];

    expect(options.retryLimit).toBe(5);
    expect(options.retryBackoff).toBe(true);
    expect(options.retryDelay).toBe(30); // 30 seconds between retries
  });

  it("creates project_hooks queue with short expiration for webhooks", async () => {
    await setupHookSubscriptions(mockBoss as any);

    const mainQueueCall = mockBoss.createQueue.mock.calls[1];
    const options = mainQueueCall[1];

    // 1 minute timeout for webhook delivery
    expect(options.expireInSeconds).toBe(60);
  });

  it("subscribes to run events", async () => {
    await setupHookSubscriptions(mockBoss as any);

    const subscribeArgs = mockBoss.subscribe.mock.calls.map((call: unknown[]) => call[0]);
    expect(subscribeArgs).toContain(EVENTS.RUN_CREATED_V1);
    expect(subscribeArgs).toContain(EVENTS.RUN_COMPLETED_V1);
  });

  it("subscribes to test events", async () => {
    await setupHookSubscriptions(mockBoss as any);

    const subscribeArgs = mockBoss.subscribe.mock.calls.map((call: unknown[]) => call[0]);
    expect(subscribeArgs).toContain(EVENTS.TEST_CREATED_V1);
    expect(subscribeArgs).toContain(EVENTS.TEST_UPDATED_V1);
    expect(subscribeArgs).toContain(EVENTS.TEST_DELETED_V1);
  });

  it("subscribes to schedule events", async () => {
    await setupHookSubscriptions(mockBoss as any);

    const subscribeArgs = mockBoss.subscribe.mock.calls.map((call: unknown[]) => call[0]);
    expect(subscribeArgs).toContain(EVENTS.SCHEDULE_CREATED_V1);
    expect(subscribeArgs).toContain(EVENTS.SCHEDULE_UPDATED_V1);
    expect(subscribeArgs).toContain(EVENTS.SCHEDULE_DELETED_V1);
  });

  it("subscribes to project.updated event", async () => {
    await setupHookSubscriptions(mockBoss as any);

    const subscribeArgs = mockBoss.subscribe.mock.calls.map((call: unknown[]) => call[0]);
    expect(subscribeArgs).toContain(EVENTS.PROJECT_UPDATED_V1);
  });

  it("subscribes all events to project_hooks queue", async () => {
    await setupHookSubscriptions(mockBoss as any);

    // All subscribe calls should route to PROJECT_HOOKS queue
    mockBoss.subscribe.mock.calls.forEach((call: unknown[]) => {
      expect(call[1]).toBe(QUEUES.PROJECT_HOOKS);
    });
  });

  it("subscribes to correct number of events", async () => {
    await setupHookSubscriptions(mockBoss as any);

    // 9 events total:
    // 2 run events + 3 test events + 3 schedule events + 1 project event
    expect(mockBoss.subscribe).toHaveBeenCalledTimes(9);
  });
});

describe("getHookEvents", () => {
  it("returns all hook event names", () => {
    const events = getHookEvents();

    expect(events).toContain(EVENTS.RUN_CREATED_V1);
    expect(events).toContain(EVENTS.RUN_COMPLETED_V1);
    expect(events).toContain(EVENTS.TEST_CREATED_V1);
    expect(events).toContain(EVENTS.SCHEDULE_CREATED_V1);
    expect(events).toContain(EVENTS.PROJECT_UPDATED_V1);
  });

  it("returns 9 events total", () => {
    const events = getHookEvents();
    expect(events.length).toBe(9);
  });

  it("does not include org events (internal only)", () => {
    const events = getHookEvents();

    expect(events).not.toContain(EVENTS.ORG_CREATED_V1);
    expect(events).not.toContain(EVENTS.ORG_DELETED_V1);
    expect(events).not.toContain(EVENTS.ORG_MEMBER_INVITED_V1);
  });

  it("does not include project created/deleted events", () => {
    const events = getHookEvents();

    // Only project.updated is included, not created/deleted
    expect(events).not.toContain(EVENTS.PROJECT_CREATED_V1);
    expect(events).not.toContain(EVENTS.PROJECT_DELETED_V1);
  });
});
