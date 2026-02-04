import { describe, it, expect, vi } from "vitest";
import {
  isLocalhost,
  isTestDatabase,
  assertSafeCleanup,
} from "../src/safety.js";
import { TEST_DB_PREFIX } from "../src/types.js";
import { createTestDb } from "../src/testdb.js";

describe("safety utilities", () => {
  describe("isLocalhost", () => {
    it("returns true for localhost", () => {
      expect(isLocalhost("postgres://user:pass@localhost:5432/db")).toBe(true);
    });

    it("returns true for 127.0.0.1", () => {
      expect(isLocalhost("postgres://user:pass@127.0.0.1:5432/db")).toBe(true);
    });

    it("returns true for ::1 (IPv6 localhost)", () => {
      // IPv6 addresses in URLs must be in brackets
      expect(isLocalhost("postgres://user:pass@[::1]:5432/db")).toBe(true);
    });

    it("returns true for host.docker.internal", () => {
      expect(
        isLocalhost("postgres://user:pass@host.docker.internal:5432/db")
      ).toBe(true);
    });

    it("returns true for postgres (Docker service name)", () => {
      expect(isLocalhost("postgres://user:pass@postgres:5432/db")).toBe(true);
    });

    it("returns true for .localhost domains", () => {
      expect(isLocalhost("postgres://user:pass@db.localhost:5432/db")).toBe(
        true
      );
    });

    it("returns true for .local domains", () => {
      expect(isLocalhost("postgres://user:pass@myhost.local:5432/db")).toBe(
        true
      );
    });

    it("returns false for remote hosts", () => {
      expect(
        isLocalhost("postgres://user:pass@db.example.com:5432/db")
      ).toBe(false);
    });

    it("returns false for AWS RDS", () => {
      expect(
        isLocalhost(
          "postgres://user:pass@my-db.abcdefg.us-east-1.rds.amazonaws.com:5432/db"
        )
      ).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(isLocalhost("not-a-url")).toBe(false);
    });
  });

  describe("isTestDatabase", () => {
    it("returns true for databases with test prefix", () => {
      expect(isTestDatabase(`${TEST_DB_PREFIX}abc123`)).toBe(true);
      expect(isTestDatabase("posium_testdb_abc")).toBe(true);
    });

    it("returns false for databases without test prefix", () => {
      expect(isTestDatabase("production_db")).toBe(false);
      expect(isTestDatabase("posium")).toBe(false);
      expect(isTestDatabase("testdb")).toBe(false);
    });
  });

  describe("assertSafeCleanup", () => {
    it("does not throw for valid test database on localhost", () => {
      expect(() =>
        assertSafeCleanup(
          "postgres://user:pass@localhost:5432/db",
          `${TEST_DB_PREFIX}abc123`
        )
      ).not.toThrow();
    });

    it("throws for non-localhost", () => {
      expect(() =>
        assertSafeCleanup(
          "postgres://user:pass@db.example.com:5432/db",
          `${TEST_DB_PREFIX}abc123`
        )
      ).toThrow(/non-localhost/);
    });

    it("throws for non-test database", () => {
      expect(() =>
        assertSafeCleanup(
          "postgres://user:pass@localhost:5432/db",
          "production_db"
        )
      ).toThrow(/without test prefix/);
    });
  });

  describe("createTestDb safety", () => {
    it("throws when trying to create test database on remote server", async () => {
      await expect(
        createTestDb({
          testDbHost: "postgres://user:pass@db.example.com:5432/mydb",
          useExistingDb: false,
        })
      ).rejects.toThrow(/Refusing to create test database on non-localhost/);
    });

    it("throws when TEST_DB_HOST points to remote server without CI=true", async () => {
      const originalTestDbHost = process.env.TEST_DB_HOST;
      const originalCI = process.env.CI;

      try {
        process.env.TEST_DB_HOST = "postgres://user:pass@production.example.com:5432/prod";
        delete process.env.CI;

        await expect(createTestDb()).rejects.toThrow(
          /Refusing to create test database on non-localhost/
        );
      } finally {
        // Restore environment
        if (originalTestDbHost) {
          process.env.TEST_DB_HOST = originalTestDbHost;
        } else {
          delete process.env.TEST_DB_HOST;
        }
        if (originalCI) {
          process.env.CI = originalCI;
        }
      }
    });

    it("throws when TEST_DB_HOST is not set and CI is not true", async () => {
      const originalTestDbHost = process.env.TEST_DB_HOST;
      const originalDatabaseUrl = process.env.DATABASE_URL;
      const originalCI = process.env.CI;

      try {
        delete process.env.TEST_DB_HOST;
        delete process.env.DATABASE_URL;
        delete process.env.CI;

        await expect(createTestDb()).rejects.toThrow(/TEST_DB_HOST is required/);
      } finally {
        // Restore environment
        if (originalTestDbHost) {
          process.env.TEST_DB_HOST = originalTestDbHost;
        }
        if (originalDatabaseUrl) {
          process.env.DATABASE_URL = originalDatabaseUrl;
        }
        if (originalCI) {
          process.env.CI = originalCI;
        }
      }
    });
  });
});
