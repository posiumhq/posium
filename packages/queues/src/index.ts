/**
 * @posium/queues - Queue name constants and configuration
 *
 * Central place for all queue definitions used by pgboss workers.
 * Also exports a createAllQueues function for centralized queue initialization.
 */
import type { PgBoss } from "@posium/boss";

/**
 * Queue names used throughout the application.
 * DLQ (Dead Letter Queue) variants are suffixed with _dlq.
 */
export const QUEUES = {
  // Test execution queue
  RUN: "run",
  RUN_DLQ: "run_dlq",

  // Webhook delivery queue
  PROJECT_HOOKS: "project_hooks",
  PROJECT_HOOKS_DLQ: "project_hooks_dlq",

  // Immediate notif delivery queue
  NOTIFS: "notifs",
  NOTIFS_DLQ: "notifs_dlq",

  // Daily digest queue (runs every day)
  DAILY_DIGEST: "daily_digest",
  DAILY_DIGEST_DLQ: "daily_digest_dlq",

  // Weekly digest queue (runs every Monday)
  WEEKLY_DIGEST: "weekly_digest",
  WEEKLY_DIGEST_DLQ: "weekly_digest_dlq",

  // Test failure notification queue (subscribes to run.completed events)
  TEST_FAILURE: "test_failure",
  TEST_FAILURE_DLQ: "test_failure_dlq",

  // Batched test failure notifications (deferred for throttling)
  TEST_FAILURE_BATCH: "test_failure_batch",
  TEST_FAILURE_BATCH_DLQ: "test_failure_batch_dlq",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * Queue configuration for createQueue.
 * Defines retry behavior, timeouts, and dead-letter queue routing.
 */
export interface QueueConfig {
  name?: string;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
  expireInMinutes?: number;
  retentionSeconds?: number;
  retentionMinutes?: number;
  retentionHours?: number;
  retentionDays?: number;
  deadLetter?: string;
  policy?: "standard" | "short" | "singleton" | "stately";
}

/**
 * Queue configuration options for each queue.
 * These define retry behavior, timeouts, and dead-letter queue routing.
 */
export const QUEUE_OPTIONS: Record<string, QueueConfig> = {
  // Run queue - test execution can take a long time
  [QUEUES.RUN]: {
    retryLimit: 3,
    retryBackoff: true,
    expireInSeconds: 3600, // 1 hour timeout for test execution
    deadLetter: QUEUES.RUN_DLQ,
  },

  // Run DLQ - for failed test executions
  [QUEUES.RUN_DLQ]: {
    retryLimit: 0, // No retries in DLQ
    expireInSeconds: 82800, // 23 hours (pgboss max is 24h, 86400s)
  },

  // Project hooks queue - webhook delivery
  [QUEUES.PROJECT_HOOKS]: {
    retryLimit: 5,
    retryBackoff: true,
    retryDelay: 30, // 30 seconds between retries
    expireInSeconds: 60, // 1 minute timeout per webhook
    deadLetter: QUEUES.PROJECT_HOOKS_DLQ,
  },

  // Project hooks DLQ - for failed webhooks
  [QUEUES.PROJECT_HOOKS_DLQ]: {
    retryLimit: 0,
    expireInSeconds: 82800, // 23 hours (pgboss max is 24h, 86400s)
  },

  // Notifs queue - immediate email/slack/etc notifications
  [QUEUES.NOTIFS]: {
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 60, // 1 minute between retries
    expireInSeconds: 60,
    deadLetter: QUEUES.NOTIFS_DLQ,
  },

  // Notifs DLQ - for failed notifications
  [QUEUES.NOTIFS_DLQ]: {
    retryLimit: 0,
    expireInSeconds: 82800, // 23 hours (pgboss max is 24h, 86400s)
  },

  // Daily digest queue - scheduled daily notifications
  [QUEUES.DAILY_DIGEST]: {
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 300, // 5 minutes between retries
    expireInSeconds: 300, // 5 minute timeout
    deadLetter: QUEUES.DAILY_DIGEST_DLQ,
  },

  // Daily digest DLQ
  [QUEUES.DAILY_DIGEST_DLQ]: {
    retryLimit: 0,
    expireInSeconds: 82800, // 23 hours (pgboss max is 24h, 86400s)
  },

  // Weekly digest queue - scheduled weekly notifications
  [QUEUES.WEEKLY_DIGEST]: {
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 300, // 5 minutes between retries
    expireInSeconds: 600, // 10 minute timeout (larger digests)
    deadLetter: QUEUES.WEEKLY_DIGEST_DLQ,
  },

  // Weekly digest DLQ
  [QUEUES.WEEKLY_DIGEST_DLQ]: {
    retryLimit: 0,
    expireInSeconds: 82800, // 23 hours (pgboss max is 24h, 86400s)
  },

  // Test failure notification queue - processes run.completed events
  [QUEUES.TEST_FAILURE]: {
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 60, // 1 minute between retries
    expireInSeconds: 120, // 2 minute timeout
    deadLetter: QUEUES.TEST_FAILURE_DLQ,
  },

  // Test failure DLQ
  [QUEUES.TEST_FAILURE_DLQ]: {
    retryLimit: 0,
    expireInSeconds: 82800, // 23 hours (pgboss max is 24h, 86400s)
  },

  // Batched test failure notifications - deferred delivery
  [QUEUES.TEST_FAILURE_BATCH]: {
    retryLimit: 3,
    retryBackoff: true,
    retryDelay: 60, // 1 minute between retries
    expireInSeconds: 120, // 2 minute timeout
    deadLetter: QUEUES.TEST_FAILURE_BATCH_DLQ,
  },

  // Batched test failure DLQ
  [QUEUES.TEST_FAILURE_BATCH_DLQ]: {
    retryLimit: 0,
    expireInSeconds: 82800, // 23 hours (pgboss max is 24h, 86400s)
  },
};

/**
 * Helper to get queue options by queue name.
 */
export function getQueueOptions(queueName: QueueName): QueueConfig {
  return QUEUE_OPTIONS[queueName] ?? {};
}

/**
 * Creates all queues defined in QUEUES constant.
 *
 * This function is idempotent - calling it multiple times is safe.
 * It creates DLQ queues first (required before main queues that reference them).
 *
 * Call this at worker startup to ensure all queues exist before
 * registering workers or setting up subscriptions.
 *
 * @example
 * ```typescript
 * import { createAllQueues } from "@posium/queues";
 *
 * // In worker startup
 * await createAllQueues(boss);
 * await boss.start();
 * ```
 */
export async function createAllQueues(boss: PgBoss): Promise<void> {
  // Create DLQ queues first (main queues reference them)
  const dlqQueues = [
    QUEUES.RUN_DLQ,
    QUEUES.PROJECT_HOOKS_DLQ,
    QUEUES.NOTIFS_DLQ,
    QUEUES.DAILY_DIGEST_DLQ,
    QUEUES.WEEKLY_DIGEST_DLQ,
    QUEUES.TEST_FAILURE_DLQ,
    QUEUES.TEST_FAILURE_BATCH_DLQ,
  ];

  for (const queueName of dlqQueues) {
    await boss.createQueue(queueName, QUEUE_OPTIONS[queueName]);
  }

  // Create main queues (they reference the DLQs)
  const mainQueues = [
    QUEUES.RUN,
    QUEUES.PROJECT_HOOKS,
    QUEUES.NOTIFS,
    QUEUES.DAILY_DIGEST,
    QUEUES.WEEKLY_DIGEST,
    QUEUES.TEST_FAILURE,
    QUEUES.TEST_FAILURE_BATCH,
  ];

  for (const queueName of mainQueues) {
    await boss.createQueue(queueName, QUEUE_OPTIONS[queueName]);
  }
}
