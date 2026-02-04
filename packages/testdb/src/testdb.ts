import { createRequire } from "node:module";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@posium/db/schema";
import { applySeed } from "@posium/db/seed";
import { createBoss } from "@posium/boss";
import { createAllQueues } from "@posium/queues";
import type { PgBoss } from "pg-boss";
import {
  createAdminConnection,
  createDatabase,
  dropDatabase,
  generateTestDbName,
  parseDatabaseUrl,
  buildDatabaseUrl,
} from "./admin.js";
import { assertSafeCleanup, isLocalhost } from "./safety.js";
import type { TestDbOptions, TestDbResult } from "./types.js";

// Use createRequire to load drizzle-kit's CJS API (avoids ESM issues)
const require = createRequire(import.meta.url);

/**
 * Deduplicates schema exports by removing alias entries that point to the same object.
 * The @posium/db schema exports aliases like `member` for `orgMember` for Better Auth compatibility.
 * These duplicates cause drizzle-kit to see "duplicated index name" warnings.
 */
function dedupeSchema(
  schemaObj: Record<string, unknown>
): Record<string, unknown> {
  const seen = new Set<unknown>();
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schemaObj)) {
    // Skip if we've already seen this exact object reference
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result[key] = value;
  }

  return result;
}

/**
 * Masks the password in a database URL for safe logging.
 * Example: postgresql://user:secret@localhost:5432/db -> postgresql://user:****@localhost:5432/db
 */
function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:([^:@]+)@/, ":****@");
  }
}

/**
 * Creates a test database with full setup:
 * 1. Creates new database (or uses existing if useExistingDb: true or CI=true)
 * 2. Applies db schema via drizzle-kit (pushSchema for existing DBs, generateMigration for new DBs)
 * 3. Applies seed data (if applySeed: true)
 * 4. Initializes pgboss with all queues (if initBoss: true)
 *
 * @example
 * ```typescript
 * import { createTestDb } from "@posium/testdb";
 *
 * // In test setup
 * const { db, boss, cleanup } = await createTestDb();
 *
 * // Run tests with db and boss...
 *
 * // In teardown
 * await cleanup();
 * ```
 *
 * @example
 * ```typescript
 * // CI mode - uses existing DATABASE_URL
 * const { db, boss, cleanup } = await createTestDb({ useExistingDb: true });
 * ```
 *
 * @example
 * ```typescript
 * // Without pgboss
 * const { db, cleanup } = await createTestDb({ initBoss: false });
 * ```
 */
export async function createTestDb(
  options: TestDbOptions = {}
): Promise<TestDbResult> {
  const {
    useExistingDb = !!process.env.DATABASE_URL && process.env.CI === "true",
    testDbHost = process.env.TEST_DB_HOST,
    databaseUrl = process.env.DATABASE_URL,
    applySeed: shouldApplySeed = true,
    initBoss = true,
    bossSchema = "pgboss",
  } = options;

  let finalDbUrl: string;
  let dbName: string;
  let adminConn: postgres.Sql | null = null;
  let createdNewDb = false;
  let hostUrl: string; // Used for admin connection and safety checks

  console.log("\n┌─────────────────────────────────────────────────────────────");
  console.log("│ [testdb] Setting up test database...");
  console.log("└─────────────────────────────────────────────────────────────\n");

  if (useExistingDb) {
    // Use existing database URL directly (CI/CD scenario)
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is required when useExistingDb is true or CI=true. " +
          "Set DATABASE_URL as an environment variable or pass databaseUrl option."
      );
    }
    finalDbUrl = databaseUrl;
    hostUrl = databaseUrl;
    dbName = parseDatabaseUrl(databaseUrl).database;
    console.log(`[testdb] Mode: Using existing database (CI mode)`);
    console.log(`[testdb] Database: ${dbName}`);
    console.log(`[testdb] URL: ${maskDatabaseUrl(finalDbUrl)}`);
  } else {
    // Create a new database dynamically (local dev scenario)
    if (!testDbHost) {
      throw new Error(
        "TEST_DB_HOST is required for creating test databases. " +
          "Set TEST_DB_HOST as an environment variable or pass testDbHost option. " +
          "Example: TEST_DB_HOST=postgresql://postgres:password@localhost:5432/postgres"
      );
    }

    hostUrl = testDbHost;

    // Safety check: only allow creating test databases on localhost
    // This prevents accidentally creating databases on remote/production servers
    if (!isLocalhost(testDbHost)) {
      throw new Error(
        `Refusing to create test database on non-localhost: ${testDbHost}. ` +
          `Creating test databases on remote servers is disabled for safety. ` +
          `Use useExistingDb: true or set CI=true to use an existing database.`
      );
    }

    // Create a new database dynamically
    dbName = generateTestDbName();
    const parts = parseDatabaseUrl(testDbHost);
    finalDbUrl = buildDatabaseUrl({ ...parts, database: dbName });

    console.log(`[testdb] Mode: Creating new database (local dev)`);
    console.log(`[testdb] Host: ${maskDatabaseUrl(testDbHost)}`);
    console.log(`[testdb] Database: ${dbName}`);
    console.log(`[testdb] Creating database...`);
    adminConn = createAdminConnection(testDbHost);
    await createDatabase(adminConn, dbName);
    console.log(`[testdb] Database created successfully`);
    createdNewDb = true;
  }

  // Connect to the test database
  console.log(`[testdb] Connecting to database...`);
  const conn = postgres(finalDbUrl);
  const db = drizzle(conn, { schema });

  // Deduplicate schema to avoid "duplicated index name" warnings from drizzle-kit
  // The schema exports aliases (e.g., `member` for `orgMember`) for Better Auth compatibility
  const dedupedSchema = dedupeSchema(schema);

  // Apply schema using drizzle-kit
  // For existing databases (useExistingDb): use pushSchema to diff against existing tables
  // For newly created databases: use generateMigration from empty -> current (faster, no introspection)
  if (createdNewDb) {
    // Newly created database is empty, use generateMigration for speed
    console.log("[testdb] Generating schema migration...");
    const { generateDrizzleJson, generateMigration } =
      require("drizzle-kit/api");

    // Generate empty snapshot (represents empty database)
    const emptySnapshot = generateDrizzleJson({});
    // Generate current schema snapshot (using deduplicated schema)
    const currentSnapshot = generateDrizzleJson(dedupedSchema, emptySnapshot.id);
    // Generate migration statements from empty to current
    const statements = await generateMigration(emptySnapshot, currentSnapshot);

    console.log(`[testdb] Applying ${statements.length} migration statements...`);
    for (const statement of statements) {
      await conn.unsafe(statement);
    }
    console.log("[testdb] Schema applied successfully");
  } else {
    // Existing database may have tables, use pushSchema to diff and apply changes
    console.log("[testdb] Applying schema via pushSchema...");
    const { pushSchema } = require("drizzle-kit/api");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { apply } = await pushSchema(dedupedSchema, db as any);
    await apply();
    console.log("[testdb] Schema applied successfully");
  }

  // Apply seed data if requested
  // applySeed creates users via Better Auth API internally (enables password login)
  if (shouldApplySeed) {
    console.log("[testdb] Applying seed data...");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applySeed(db as any);
    console.log("[testdb] Seed data applied successfully");
  }

  // Initialize pgboss if requested
  let boss: PgBoss | null = null;
  if (initBoss) {
    console.log("[testdb] Initializing pgboss...");

    // Build boss options, optionally enabling spies for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bossOptions: any = {
      connectionString: finalDbUrl,
      schema: bossSchema,
      migrate: true,
      supervise: true,
      schedule: true,
    };

    // Enable spy API for deterministic test assertions
    // This is a hidden pgboss option not exposed in TypeScript types
    if (options.enableSpies) {
      bossOptions.__test__enableSpies = true;
      bossOptions.pollingIntervalSeconds = 0.5; // Faster polling for tests
      console.log("[testdb] pgboss spies enabled");
    }

    boss = createBoss(bossOptions);

    boss.on("error", (error: Error) => {
      console.error("[testdb] pgboss error:", error);
    });

    await boss.start();
    await createAllQueues(boss);
    console.log("[testdb] pgboss started with all queues");
  }

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    console.log("\n┌─────────────────────────────────────────────────────────────");
    console.log("│ [testdb] Cleaning up test database...");
    console.log("└─────────────────────────────────────────────────────────────\n");
    console.log(`[testdb] Database: ${dbName}`);

    // Stop boss first
    if (boss) {
      try {
        console.log("[testdb] Stopping pgboss...");
        await boss.stop({ graceful: false, timeout: 5000 });
        console.log("[testdb] pgboss stopped");
      } catch (error) {
        console.warn("[testdb] Error stopping pgboss:", error);
      }
    }

    // Close database connection
    try {
      console.log("[testdb] Closing database connection...");
      await conn.end();
      console.log("[testdb] Database connection closed");
    } catch (error) {
      console.warn("[testdb] Error closing database connection:", error);
    }

    // Drop database if we created it and it's safe to do so
    if (createdNewDb && isLocalhost(hostUrl)) {
      try {
        assertSafeCleanup(hostUrl, dbName);

        if (!adminConn) {
          adminConn = createAdminConnection(hostUrl);
        }

        console.log(`[testdb] Dropping database: ${dbName}...`);
        await dropDatabase(adminConn, dbName);
        console.log(`[testdb] Database dropped successfully`);
      } catch (error) {
        console.warn(`[testdb] Error dropping database: ${error}`);
      } finally {
        if (adminConn) {
          await adminConn.end();
        }
      }
    } else if (createdNewDb) {
      console.warn(
        `[testdb] Skipping database drop for non-localhost: ${dbName}. ` +
          `Manual cleanup may be required.`
      );
      if (adminConn) {
        await adminConn.end();
      }
    } else {
      console.log(`[testdb] Skipping database drop (using existing database)`);
    }

    console.log("[testdb] Cleanup complete\n");
  };

  console.log("\n┌─────────────────────────────────────────────────────────────");
  console.log("│ [testdb] ✓ Test database ready");
  console.log("├─────────────────────────────────────────────────────────────");
  console.log(`│ Database: ${dbName}`);
  console.log(`│ URL: ${maskDatabaseUrl(finalDbUrl)}`);
  console.log(`│ Seed: ${shouldApplySeed ? "applied" : "skipped"}`);
  console.log(
    `│ PgBoss: ${initBoss ? (options.enableSpies ? "initialized (spies enabled)" : "initialized") : "skipped"}`
  );
  console.log("└─────────────────────────────────────────────────────────────\n");

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: db as any,
    boss,
    databaseUrl: finalDbUrl,
    databaseName: dbName,
    cleanup,
  };
}
