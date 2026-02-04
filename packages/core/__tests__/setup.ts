/**
 * Test setup for @posium/core service tests.
 *
 * Provides database setup/teardown and common test utilities.
 */

import { createTestDb } from "@posium/testdb";
import type { DBType } from "@posium/db";
import type { PgBoss } from "@posium/boss";
import { createAuth, type Auth } from "@posium/auth/server";
import { createSeedContexts, testUsers, testOrgs } from "../src/testing/index.js";

// Global test state
let db: DBType;
let boss: PgBoss | null = null;
let auth: Auth;
let cleanup: () => Promise<void>;

/**
 * Setup test database before all tests.
 * Uses seed data for predictable test scenarios.
 */
export async function setupTestDb() {
  const result = await createTestDb({
    applySeed: true,
    initBoss: true,
  });

  db = result.db;
  boss = result.boss;
  cleanup = result.cleanup;

  // Create auth instance for tests
  auth = createAuth(db, {
    secret: "test-secret-for-core-service-tests",
  });

  return { db, boss, auth };
}

/**
 * Cleanup test database after all tests.
 */
export async function teardownTestDb() {
  if (cleanup) {
    await cleanup();
  }
}

/**
 * Get database connection.
 */
export function getDb(): DBType {
  if (!db) {
    throw new Error("Test database not initialized. Call setupTestDb() first.");
  }
  return db;
}

/**
 * Get PgBoss instance.
 */
export function getBoss(): PgBoss | null {
  return boss;
}

/**
 * Get Auth instance.
 */
export function getAuth(): Auth {
  if (!auth) {
    throw new Error("Test auth not initialized. Call setupTestDb() first.");
  }
  return auth;
}

/**
 * Get pre-created contexts for seed users.
 */
export function getContexts() {
  return createSeedContexts(getDb(), getBoss() ?? undefined);
}

// Re-export test utilities
export { testUsers, testOrgs };
