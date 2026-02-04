/**
 * @posium/boss/testing-stub - Framework-agnostic stub for pgboss
 *
 * Use this for Playwright tests or any test framework that conflicts with Vitest.
 * For Vitest tests with spies, use @posium/boss/testing instead.
 */

/**
 * Stub PgBoss instance type with all commonly used methods as no-op functions.
 * Framework-agnostic - works with Playwright, Vitest, Jest, or any other test framework.
 */
export type StubBoss = {
  // Job operations
  send: () => Promise<string>;
  sendAfter: () => Promise<string>;
  publish: () => Promise<void>;

  // Subscriptions
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;

  // Workers
  work: () => Promise<string>;
  offWork: () => Promise<void>;

  // Queue management
  createQueue: () => Promise<void>;
  deleteQueue: () => Promise<void>;
  getQueueSize: () => Promise<number>;

  // Scheduling
  schedule: () => Promise<void>;
  unschedule: () => Promise<void>;
  getSchedules: () => Promise<unknown[]>;

  // Lifecycle
  start: () => Promise<void>;
  stop: () => Promise<void>;

  // Events
  on: () => StubBoss;
  off: () => StubBoss;
};

/**
 * Creates a stub PgBoss instance for testing.
 * Framework-agnostic - works with Playwright, Vitest, Jest, or any test framework.
 * All methods are no-op functions that return sensible defaults.
 * No database connection required.
 *
 * Use this for:
 * - Playwright API tests (where you just need boss to not throw)
 * - Integration tests where boss behavior doesn't need assertions
 *
 * For Vitest unit tests where you need to assert on calls, use `createMockBoss()` from
 * `@posium/boss/testing` instead.
 *
 * @example
 * ```typescript
 * import { createStubBoss } from '@posium/boss/testing-stub';
 *
 * // In Playwright global-setup.ts
 * const boss = createStubBoss();
 * const app = await buildApp({ db, boss });
 * ```
 */
export function createStubBoss(): StubBoss {
  const noop = () => Promise.resolve();
  const stub: StubBoss = {
    // Job operations
    send: () => Promise.resolve("stub-job-id"),
    sendAfter: () => Promise.resolve("stub-job-id"),
    publish: noop,

    // Subscriptions
    subscribe: noop,
    unsubscribe: noop,

    // Workers
    work: () => Promise.resolve("stub-worker-id"),
    offWork: noop,

    // Queue management
    createQueue: noop,
    deleteQueue: noop,
    getQueueSize: () => Promise.resolve(0),

    // Scheduling
    schedule: noop,
    unschedule: noop,
    getSchedules: () => Promise.resolve([]),

    // Lifecycle
    start: noop,
    stop: noop,

    // Events
    on: () => stub,
    off: () => stub,
  };
  return stub;
}
