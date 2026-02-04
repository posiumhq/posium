/**
 * @posium/boss - pgboss client wrapper
 *
 * Provides a factory function to create pgboss instances and re-exports
 * commonly used types from pg-boss.
 */
import { PgBoss } from "pg-boss";
import type {
  Job,
  JobWithMetadata,
  SendOptions,
  WorkOptions,
  ScheduleOptions,
  Queue,
  ConstructorOptions,
} from "pg-boss";

export type BossOptions = ConstructorOptions;

/**
 * Creates a new pgboss instance with the given options.
 * This is a factory function (not singleton) for better testability.
 *
 * @example
 * ```typescript
 * const boss = createBoss({
 *   connectionString: process.env.DATABASE_URL,
 *   schema: 'pgboss',
 *   migrate: true,
 * });
 *
 * boss.on('error', (err) => logger.error('pgboss error', err));
 * await boss.start();
 * ```
 */
export function createBoss(options: BossOptions): PgBoss {
  return new PgBoss(options);
}

// Re-export PgBoss class and types
export { PgBoss };
export type { Job, JobWithMetadata, SendOptions, WorkOptions, ScheduleOptions };

/**
 * Queue configuration options for createQueue.
 * Combines retry, expiration, and retention settings.
 */
export type QueueConfig = Queue;
