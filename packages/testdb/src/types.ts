import type { DBType } from "@posium/db";
import type { PgBoss } from "pg-boss";

/**
 * Options for creating a test database.
 */
export interface TestDbOptions {
  /**
   * Use existing DATABASE_URL directly instead of creating a new database.
   * Typically set in CI/CD where the database is pre-provisioned.
   *
   * Default: `true` if both `DATABASE_URL` and `CI=true` are set
   */
  useExistingDb?: boolean;

  /**
   * Override the database host connection string (used when creating new databases).
   * If not provided, uses `process.env.TEST_DB_HOST`.
   *
   * Example: `postgresql://postgres:password@localhost:5432/postgres`
   * The database name in the URL is ignored when creating new test databases.
   */
  testDbHost?: string;

  /**
   * Override the full DATABASE_URL (used when useExistingDb is true).
   * If not provided, uses `process.env.DATABASE_URL`.
   */
  databaseUrl?: string;

  /**
   * Apply seed data after schema.
   * @default true
   */
  applySeed?: boolean;

  /**
   * Initialize pgboss with all queues.
   * @default true
   */
  initBoss?: boolean;

  /**
   * Schema name for pgboss tables.
   * @default "pgboss"
   */
  bossSchema?: string;

  /**
   * Enable pgboss spy API for deterministic test assertions.
   * When enabled, you can use `boss.getSpy(queueName).waitForJob()` to wait
   * for jobs to reach specific states without polling.
   *
   * @default false
   */
  enableSpies?: boolean;
}

/**
 * Result of creating a test database.
 */
export interface TestDbResult {
  /** Drizzle database instance */
  db: DBType;

  /** PgBoss instance (null if initBoss: false) */
  boss: PgBoss | null;

  /** Database URL used for this connection */
  databaseUrl: string;

  /** Database name (e.g., "posium_testdb_a1b2c") */
  databaseName: string;

  /** Cleanup function - stops boss, closes connections, drops database if created dynamically */
  cleanup: () => Promise<void>;
}

/**
 * Prefix for test database names. Used for safety checks during cleanup.
 */
export const TEST_DB_PREFIX = "posium_testdb_" as const;
