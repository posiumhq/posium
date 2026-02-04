import postgres from "postgres";
import { init } from "@paralleldrive/cuid2";
import { TEST_DB_PREFIX } from "./types.js";

// Create a cuid2 generator with length 5
const createId = init({ length: 5 });

/**
 * Generates a unique test database name.
 * Format: posium_testdb_{cuid2(5)}
 *
 * @returns A unique database name like "posium_testdb_a1b2c"
 */
export function generateTestDbName(): string {
  return `${TEST_DB_PREFIX}${createId()}`;
}

/**
 * Parsed components of a database URL.
 */
export interface DatabaseUrlParts {
  protocol: string;
  username: string;
  password: string;
  host: string;
  port: string;
  database: string;
}

/**
 * Parses a database URL and returns its components.
 *
 * @param url - The database URL to parse
 * @returns The parsed URL components
 */
export function parseDatabaseUrl(url: string): DatabaseUrlParts {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    host: parsed.hostname,
    port: parsed.port || "5432",
    database: parsed.pathname.slice(1), // Remove leading /
  };
}

/**
 * Builds a database URL from its components.
 *
 * @param parts - The URL components
 * @returns The constructed database URL
 */
export function buildDatabaseUrl(parts: DatabaseUrlParts): string {
  const auth = parts.password
    ? `${encodeURIComponent(parts.username)}:${encodeURIComponent(parts.password)}`
    : encodeURIComponent(parts.username);
  return `${parts.protocol}//${auth}@${parts.host}:${parts.port}/${parts.database}`;
}

/**
 * Creates an admin connection to PostgreSQL (connects to 'postgres' database).
 * Used for CREATE/DROP DATABASE operations.
 *
 * @param databaseUrl - A database URL (the database name will be replaced with 'postgres')
 * @returns A postgres.js SQL connection
 */
export function createAdminConnection(databaseUrl: string): postgres.Sql {
  const parts = parseDatabaseUrl(databaseUrl);
  const adminUrl = buildDatabaseUrl({ ...parts, database: "postgres" });
  return postgres(adminUrl, { max: 1 });
}

/**
 * Creates a new database with the given name.
 *
 * @param adminConn - Admin connection to PostgreSQL
 * @param dbName - Name of the database to create
 */
export async function createDatabase(
  adminConn: postgres.Sql,
  dbName: string
): Promise<void> {
  // Use template0 for a clean database
  await adminConn.unsafe(`CREATE DATABASE "${dbName}" TEMPLATE template0`);
}

/**
 * Drops a database with the given name.
 * Terminates existing connections first.
 *
 * @param adminConn - Admin connection to PostgreSQL
 * @param dbName - Name of the database to drop
 */
export async function dropDatabase(
  adminConn: postgres.Sql,
  dbName: string
): Promise<void> {
  // Terminate existing connections to the database
  await adminConn.unsafe(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${dbName}' AND pid <> pg_backend_pid()
  `);

  // Drop the database
  await adminConn.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
}
