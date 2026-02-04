import { TEST_DB_PREFIX } from "./types.js";

/**
 * List of allowed hostnames for database cleanup.
 * Includes localhost variants and common Docker service names.
 */
const ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
  "postgres", // Common Docker service name
]);

/**
 * Checks if a database URL points to a local or Docker host.
 * Returns false for any remote host to prevent accidental cleanup.
 *
 * @param databaseUrl - The database connection URL
 * @returns true if the host is considered local/safe for cleanup
 */
export function isLocalhost(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    // URL.hostname strips brackets from IPv6 addresses
    // e.g., [::1] becomes ::1
    let host = url.hostname.toLowerCase();

    // Handle IPv6 addresses - remove brackets if present
    if (host.startsWith("[") && host.endsWith("]")) {
      host = host.slice(1, -1);
    }

    return (
      ALLOWED_HOSTS.has(host) ||
      host.endsWith(".localhost") ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/**
 * Checks if a database name is a valid test database.
 * Must have the `posium_testdb_` prefix.
 *
 * @param dbName - The database name to check
 * @returns true if the name has the test database prefix
 */
export function isTestDatabase(dbName: string): boolean {
  return dbName.startsWith(TEST_DB_PREFIX);
}

/**
 * Validates that cleanup is safe to perform.
 * Throws an error if conditions are not met.
 *
 * @param databaseUrl - The database connection URL
 * @param databaseName - The database name
 * @throws Error if cleanup would be unsafe
 */
export function assertSafeCleanup(
  databaseUrl: string,
  databaseName: string
): void {
  if (!isLocalhost(databaseUrl)) {
    throw new Error(
      `Refusing to cleanup database on non-localhost: ${databaseUrl}. ` +
        `Remote database cleanup is disabled for safety.`
    );
  }

  if (!isTestDatabase(databaseName)) {
    throw new Error(
      `Refusing to cleanup database without test prefix: ${databaseName}. ` +
        `Database name must start with '${TEST_DB_PREFIX}'.`
    );
  }
}
