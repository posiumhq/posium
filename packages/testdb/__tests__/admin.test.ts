import { describe, it, expect } from "vitest";
import {
  generateTestDbName,
  parseDatabaseUrl,
  buildDatabaseUrl,
} from "../src/admin.js";
import { TEST_DB_PREFIX } from "../src/types.js";

describe("admin utilities", () => {
  describe("generateTestDbName", () => {
    it("generates names with the test prefix", () => {
      const name = generateTestDbName();
      expect(name.startsWith(TEST_DB_PREFIX)).toBe(true);
    });

    it("generates unique names", () => {
      const names = new Set<string>();
      for (let i = 0; i < 100; i++) {
        names.add(generateTestDbName());
      }
      expect(names.size).toBe(100);
    });

    it("generates names with expected length", () => {
      const name = generateTestDbName();
      // posium_testdb_ (14 chars) + cuid2 (5 chars) = 19 chars
      expect(name.length).toBe(14 + 5);
    });
  });

  describe("parseDatabaseUrl", () => {
    it("parses a standard postgres URL", () => {
      const result = parseDatabaseUrl(
        "postgres://user:pass@localhost:5432/mydb"
      );
      expect(result).toEqual({
        protocol: "postgres:",
        username: "user",
        password: "pass",
        host: "localhost",
        port: "5432",
        database: "mydb",
      });
    });

    it("parses URL with encoded characters", () => {
      const result = parseDatabaseUrl(
        "postgres://user%40domain:p%40ss@localhost:5432/mydb"
      );
      expect(result.username).toBe("user@domain");
      expect(result.password).toBe("p@ss");
    });

    it("uses default port 5432 when not specified", () => {
      const result = parseDatabaseUrl("postgres://user:pass@localhost/mydb");
      expect(result.port).toBe("5432");
    });
  });

  describe("buildDatabaseUrl", () => {
    it("builds a standard postgres URL", () => {
      const url = buildDatabaseUrl({
        protocol: "postgres:",
        username: "user",
        password: "pass",
        host: "localhost",
        port: "5432",
        database: "mydb",
      });
      expect(url).toBe("postgres://user:pass@localhost:5432/mydb");
    });

    it("encodes special characters", () => {
      const url = buildDatabaseUrl({
        protocol: "postgres:",
        username: "user@domain",
        password: "p@ss",
        host: "localhost",
        port: "5432",
        database: "mydb",
      });
      expect(url).toBe("postgres://user%40domain:p%40ss@localhost:5432/mydb");
    });

    it("roundtrips with parseDatabaseUrl", () => {
      const original = "postgres://user:pass@localhost:5432/mydb";
      const parsed = parseDatabaseUrl(original);
      const rebuilt = buildDatabaseUrl(parsed);
      expect(rebuilt).toBe(original);
    });
  });
});
