/**
 * @posium/boss/testing - Testing utilities for pgboss
 *
 * Provides utilities for testing packages that depend on pgboss:
 * - createTestBoss(): Creates a real pgboss instance with spies enabled for integration testing
 * - createMockBoss(): Creates a mock pgboss for pure unit testing (no database)
 */
import { PgBoss, type Job, type ConstructorOptions } from "pg-boss";

/**
 * Options for creating a test pgboss instance.
 */
export interface CreateTestBossOptions {
  /** Database connection string */
  connectionString: string;
  /** Schema name for pgboss tables (default: 'pgboss_test') */
  schema?: string;
}

/**
 * Result from creating a test pgboss instance.
 */
export interface TestBoss {
  /** The pgboss instance with spies enabled */
  boss: PgBoss;
  /** Cleanup function - stops boss and clears spies */
  cleanup: () => Promise<void>;
}

/**
 * Creates a real pgboss instance with native spies enabled for integration testing.
 *
 * Uses pgboss's built-in spy functionality for fast, deterministic testing:
 * - `boss.getSpy(queueName)` - Get spy for a specific queue
 * - `spy.waitForJob(selector, state)` - Wait for job matching criteria
 * - `spy.waitForJobWithId(id, state)` - Wait for specific job by ID
 * - `boss.clearSpies()` - Clear all tracked data between tests
 *
 * @example
 * ```typescript
 * import { createTestBoss } from '@posium/boss/testing';
 *
 * describe('Run Processor', () => {
 *   let boss: PgBoss;
 *   let cleanup: () => Promise<void>;
 *
 *   beforeAll(async () => {
 *     ({ boss, cleanup } = await createTestBoss({
 *       connectionString: process.env.TEST_DATABASE_URL!,
 *     }));
 *   });
 *
 *   afterAll(async () => {
 *     await cleanup();
 *   });
 *
 *   afterEach(() => {
 *     boss.clearSpies();
 *   });
 *
 *   it('should process run.created.v1 events', async () => {
 *     const spy = boss.getSpy('run');
 *
 *     // Register worker
 *     await boss.work('run', async ([job]) => {
 *       return { processed: true };
 *     });
 *
 *     // Publish event
 *     await boss.publish('run.created.v1', { runId: 'run_123' });
 *
 *     // Wait for job to complete (handles race conditions automatically)
 *     const job = await spy.waitForJob(
 *       (data) => data.runId === 'run_123',
 *       'completed'
 *     );
 *
 *     expect(job.output).toEqual({ processed: true });
 *   });
 * });
 * ```
 */
export async function createTestBoss(
  options: CreateTestBossOptions,
): Promise<TestBoss> {
  // pg-boss has a hidden __test__enableSpies option for testing
  // that's not exposed in the TypeScript types
  const bossOptions = {
    connectionString: options.connectionString,
    schema: options.schema ?? "pgboss_test",
    // Enable spies for testing - zero overhead in production
    __test__enableSpies: true,
    // Testing configuration
    migrate: true,
    supervise: true,
    schedule: true,
    // Faster polling for tests
    pollingIntervalSeconds: 0.5,
  } as ConstructorOptions;

  const boss = new PgBoss(bossOptions);

  boss.on("error", (error: Error) => {
    console.error("pgboss test error:", error);
  });

  await boss.start();

  return {
    boss,
    cleanup: async () => {
      try {
        // clearSpies is available when spies are enabled but not in types
        const bossWithSpies = boss as unknown as { clearSpies?: () => void };
        if (typeof bossWithSpies.clearSpies === "function") {
          bossWithSpies.clearSpies();
        }
      } finally {
        // Always stop boss to prevent resource leaks
        await boss.stop({ graceful: false, timeout: 5000, close: true });
      }
    },
  };
}

/**
 * Job states that can be waited for with spies.
 */
export type JobState = "created" | "active" | "completed" | "failed";

/**
 * Spy interface returned by boss.getSpy(queueName).
 * Provides methods to wait for jobs and track their state transitions.
 */
export interface QueueSpy<T = unknown> {
  /** Clear all tracked job data for this queue */
  clear(): void;
  /** Wait for a job matching the selector to reach the specified state */
  waitForJob(
    selector: (data: T) => boolean,
    state: JobState,
  ): Promise<SpyJob<T>>;
  /** Wait for a specific job by ID to reach the specified state */
  waitForJobWithId(id: string, state: JobState): Promise<SpyJob<T>>;
}

/**
 * Job object returned by spy methods.
 */
export interface SpyJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  state: JobState;
  output?: unknown;
}

// ============================================================================
// Re-export stub utilities (framework-agnostic, no Vitest dependency)
// For Playwright tests, import directly from '@posium/boss/testing-stub' to avoid
// loading Vitest dependencies.
// ============================================================================

export { createStubBoss, type StubBoss } from "./testing-stub.js";

// ============================================================================
// Mock utilities for Vitest unit testing (with spies for assertions)
// ============================================================================

import { vi, type Mock } from "vitest";

/**
 * Mock PgBoss instance type with all commonly used methods as Vitest spies.
 * Use this for Vitest unit testing where you need to assert on method calls.
 */
export type MockBoss = {
  // Job operations
  send: Mock;
  sendAfter: Mock;
  publish: Mock;

  // Subscriptions
  subscribe: Mock;
  unsubscribe: Mock;

  // Workers
  work: Mock;
  offWork: Mock;

  // Queue management
  createQueue: Mock;
  deleteQueue: Mock;
  getQueueSize: Mock;

  // Scheduling
  schedule: Mock;
  unschedule: Mock;
  getSchedules: Mock;

  // Lifecycle
  start: Mock;
  stop: Mock;

  // Events
  on: Mock;
  off: Mock;
};

/**
 * Creates a mock PgBoss instance for Vitest unit testing.
 * All methods are Vitest spies that can be asserted against.
 * No database connection required.
 *
 * Use this for Vitest tests where you need to verify boss method calls.
 * For framework-agnostic stubs (Playwright, etc.), use `createStubBoss()` instead.
 *
 * @example
 * ```typescript
 * import { createMockBoss } from '@posium/boss/testing';
 *
 * const mockBoss = createMockBoss();
 * await myFunction(mockBoss);
 *
 * expect(mockBoss.publish).toHaveBeenCalledWith('event.name', { data: 'here' });
 * ```
 */
export function createMockBoss(): MockBoss {
  return {
    // Job operations
    send: vi.fn().mockResolvedValue("mock-job-id"),
    sendAfter: vi.fn().mockResolvedValue("mock-job-id"),
    publish: vi.fn().mockResolvedValue(undefined),

    // Subscriptions
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),

    // Workers
    work: vi.fn().mockResolvedValue("mock-worker-id"),
    offWork: vi.fn().mockResolvedValue(undefined),

    // Queue management
    createQueue: vi.fn().mockResolvedValue(undefined),
    deleteQueue: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockResolvedValue(0),

    // Scheduling
    schedule: vi.fn().mockResolvedValue(undefined),
    unschedule: vi.fn().mockResolvedValue(undefined),
    getSchedules: vi.fn().mockResolvedValue([]),

    // Lifecycle
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),

    // Events
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
  };
}

/**
 * Helper to capture the handler function passed to boss.work().
 * Useful for testing that handlers are called correctly with mock boss.
 *
 * @example
 * ```typescript
 * const handler = captureWorkHandler<MyPayload>(mockBoss, 'my-queue');
 * if (handler) {
 *   await handler([{ id: '1', data: { ... }, name: 'my-queue', ... }]);
 * }
 * ```
 */
export function captureWorkHandler<T>(
  mockBoss: MockBoss,
  queueName: string,
): ((jobs: Job<T>[]) => Promise<void>) | undefined {
  const workCall = mockBoss.work.mock.calls.find(
    (call) => call[0] === queueName,
  );

  if (!workCall) {
    return undefined;
  }

  // Handler is the last argument (either 2nd or 3rd depending on options)
  const handler = workCall[workCall.length - 1];
  return typeof handler === "function" ? handler : undefined;
}
