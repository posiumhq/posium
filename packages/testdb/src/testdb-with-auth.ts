/**
 * Test database helper with authentication integration.
 *
 * Extends createTestDb to also set up authentication and
 * optionally seed API keys for testing.
 *
 * Uses dependency injection to avoid circular dependencies -
 * the caller provides the auth factory and service user functions.
 */

import { createTestDb } from "./testdb.js";
import {
  seedApiKeys,
  getSeedApiKeyValues,
  type SeedApiKeyResult,
} from "@posium/db/seed";
import type { TestDbOptions, TestDbResult } from "./types.js";
import type { DBType } from "@posium/db";

/**
 * Minimal interface for auth instance used in testing.
 * Must be compatible with SeedAuthApi from @posium/db/seed.
 */
export interface TestAuth {
  api: {
    verifyApiKey: (opts: { body: { key: string } }) => Promise<unknown>;
    createApiKey: (opts: {
      body: {
        userId: string;
        name: string;
        prefix: string;
        permissions: Record<string, string[]>;
        metadata: Record<string, unknown>;
      };
    }) => Promise<{ id: string; key: string }>;
    updateApiKey: (opts: {
      body: {
        userId: string;
        keyId: string;
        metadata?: Record<string, unknown>;
        enabled?: boolean;
      };
    }) => Promise<unknown>;
  };
}

/**
 * Factory function to create an auth instance.
 */
export type CreateAuthFn = (
  db: DBType,
  options: {
    secret: string;
    disableApiKeyRateLimit?: boolean;
    customKeyGenerator?: (options: {
      length: number;
      prefix: string | undefined;
    }) => string;
  },
) => TestAuth;

/**
 * Function to get or create a service user for an organization.
 * Signature matches GetOrCreateServiceUser from @posium/db/seed.
 */
export type GetOrCreateServiceUserFn = (
  orgId: string,
  db: DBType,
) => Promise<{ userId: string; isNew: boolean }>;

export interface TestDbWithAuthOptions extends TestDbOptions {
  /** Secret for auth (defaults to test secret) */
  authSecret?: string;
  /** Whether to create seed API keys (defaults to false) */
  seedApiKeys?: boolean;
  /** Factory function to create auth instance (required) */
  createAuth: CreateAuthFn;
  /** Function to get or create service user (required if seedApiKeys is true) */
  getOrCreateServiceUser?: GetOrCreateServiceUserFn;
}

export interface TestDbWithAuthResult extends TestDbResult {
  /** Auth instance for API key operations */
  auth: TestAuth;
  /** Created API keys (only if seedApiKeys: true) */
  apiKeys?: SeedApiKeyResult[];
}

/**
 * Creates a test database with auth configured and optional API key seeding.
 *
 * Uses dependency injection - you must provide the createAuth factory
 * function to avoid circular dependencies between testdb and auth packages.
 *
 * @example
 * ```ts
 * import { createAuth, getOrCreateServiceUser } from "@posium/auth/server";
 *
 * const { db, auth, cleanup } = await createTestDbWithAuth({
 *   createAuth,
 * });
 *
 * // Verify an API key
 * const result = await auth.api.verifyApiKey({ body: { key: "apikey_..." } });
 *
 * await cleanup();
 * ```
 *
 * @example
 * ```ts
 * // With API key seeding
 * import { createAuth, getOrCreateServiceUser } from "@posium/auth/server";
 *
 * const { db, auth, apiKeys, cleanup } = await createTestDbWithAuth({
 *   createAuth,
 *   getOrCreateServiceUser,
 *   seedApiKeys: true,
 * });
 *
 * // Use one of the seeded keys
 * const orgWideKey = apiKeys?.find(k => k.name === "Acme CI/CD Key");
 * const result = await auth.api.verifyApiKey({ body: { key: orgWideKey!.key } });
 *
 * await cleanup();
 * ```
 */
export async function createTestDbWithAuth(
  options: TestDbWithAuthOptions,
): Promise<TestDbWithAuthResult> {
  const {
    authSecret = "test-secret-for-integration-tests",
    seedApiKeys: shouldSeedApiKeys = false,
    createAuth,
    getOrCreateServiceUser,
    ...testDbOptions
  } = options;

  if (shouldSeedApiKeys && !getOrCreateServiceUser) {
    throw new Error(
      "getOrCreateServiceUser is required when seedApiKeys is true",
    );
  }

  // Create test database with seed data
  const testDbResult = await createTestDb({
    ...testDbOptions,
    applySeed: testDbOptions.applySeed ?? true,
    initBoss: testDbOptions.initBoss ?? false, // Default to no boss for auth tests
  });

  // Create a key generator that returns predefined seed keys in order
  // This ensures tests can import key values directly from seedApiKeyConfig
  let keyIndex = 0;
  const seedKeyValues = getSeedApiKeyValues();
  const customKeyGenerator: ((options: {
    length: number;
    prefix: string | undefined;
  }) => string) | undefined = shouldSeedApiKeys
    ? (): string => {
        if (keyIndex >= seedKeyValues.length) {
          throw new Error(
            `Ran out of seed API key values (created ${keyIndex} keys, but only ${seedKeyValues.length} defined)`,
          );
        }
        return seedKeyValues[keyIndex++]!;
      }
    : undefined;

  // Create auth instance using provided factory
  // Disable API key rate limiting for tests to avoid failures during test suites
  const auth = createAuth(testDbResult.db, {
    secret: authSecret,
    disableApiKeyRateLimit: true,
    customKeyGenerator,
  });

  let apiKeys: SeedApiKeyResult[] | undefined;

  // Seed API keys if requested
  if (shouldSeedApiKeys && getOrCreateServiceUser) {
    console.log("[testdb-with-auth] Seeding API keys...");
    const result = await seedApiKeys(
      testDbResult.db,
      auth,
      getOrCreateServiceUser,
    );
    apiKeys = result.keys;
    console.log("[testdb-with-auth] API keys seeded");
  }

  return {
    ...testDbResult,
    auth,
    apiKeys,
  };
}
