/**
 * AppConfig Unit Tests
 *
 * Tests the core AppConfig class with directory-based config loading
 * and environment-specific file overrides.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import * as fs from "node:fs";
import "../src/zod-env.js"; // Activate .env() extension

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Import after mocking
import {
  AppConfig,
  ConfigValidationError,
  ConfigFileError,
  NotInitializedError,
} from "../src/index.js";

const testSchema = z.object({
  port: z.number().default(3000),
  debug: z.boolean().default(false),
  name: z.string().default("test"),
  api: z
    .object({
      timeout: z.number().default(5000),
      retries: z.number().default(3),
    })
    .default({
      timeout: 5000,
      retries: 3,
    }),
});

describe("AppConfig", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  describe("initialization", () => {
    it("uses schema defaults when no config files exist", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.get("port")).toBe(3000);
      expect(config.get("debug")).toBe(false);
      expect(config.get("name")).toBe("test");
    });

    it("can initialize multiple times without error", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();
      await config.initialize();

      expect(config.get("port")).toBe(3000);
    });

    it("uses default configDir of ./appconfig", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining("appconfig"),
      );
    });

    it("uses custom configDir when provided", async () => {
      const config = new AppConfig({
        schema: testSchema,
        configDir: "./custom-config",
      });
      await config.initialize();

      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining("custom-config"),
      );
    });
  });

  describe("environment handling", () => {
    it("normalizes environment from NODE_ENV", async () => {
      process.env.NODE_ENV = "dev";
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.currentEnvironment).toBe("development");
    });

    it("normalizes provided environment", async () => {
      const config = new AppConfig({
        schema: testSchema,
        environment: "prod",
      });
      await config.initialize();

      expect(config.currentEnvironment).toBe("production");
    });

    it("provided environment overrides NODE_ENV", async () => {
      process.env.NODE_ENV = "production";
      const config = new AppConfig({
        schema: testSchema,
        environment: "staging",
      });
      await config.initialize();

      expect(config.currentEnvironment).toBe("staging");
    });

    it("defaults to development when NODE_ENV not set", async () => {
      delete process.env.NODE_ENV;
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.currentEnvironment).toBe("development");
    });
  });

  describe("file loading", () => {
    it("loads config.json from configDir", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        // Return true for directory itself AND config.json
        return pathStr.endsWith("appconfig") || pathStr.endsWith("config.json");
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ port: 8080 }),
      );

      const config = new AppConfig({
        schema: testSchema,
        environment: "development",
      });
      await config.initialize();

      expect(config.get("port")).toBe(8080);
      expect(config.get("name")).toBe("test"); // Schema default
      expect(config.configFiles.length).toBe(1);
    });

    it("loads environment-specific config file", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        // Return true for directory AND both config files
        return (
          pathStr.endsWith("appconfig") ||
          pathStr.endsWith("config.json") ||
          pathStr.endsWith("config.production.json")
        );
      });
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.endsWith("config.production.json")) {
          return JSON.stringify({ debug: true });
        }
        return JSON.stringify({ port: 8080 });
      });

      const config = new AppConfig({
        schema: testSchema,
        environment: "production",
      });
      await config.initialize();

      expect(config.get("port")).toBe(8080); // From base config
      expect(config.get("debug")).toBe(true); // From env-specific config
      expect(config.configFiles.length).toBe(2);
    });

    it("environment config overrides base config", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        // Return true for directory AND both config files
        return (
          pathStr.endsWith("appconfig") ||
          pathStr.endsWith("config.json") ||
          pathStr.endsWith("config.staging.json")
        );
      });
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.endsWith("config.staging.json")) {
          return JSON.stringify({ port: 9000 });
        }
        return JSON.stringify({ port: 8080, debug: true });
      });

      const config = new AppConfig({
        schema: testSchema,
        environment: "staging",
      });
      await config.initialize();

      expect(config.get("port")).toBe(9000); // Overridden by staging
      expect(config.get("debug")).toBe(true); // From base config
    });

    it("deep merges nested config objects", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        // Return true for directory AND both config files
        return (
          pathStr.endsWith("appconfig") ||
          pathStr.endsWith("config.json") ||
          pathStr.endsWith("config.development.json")
        );
      });
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        const pathStr = String(p);
        if (pathStr.endsWith("config.development.json")) {
          return JSON.stringify({
            api: { timeout: 10000 },
          });
        }
        return JSON.stringify({
          api: { timeout: 5000, retries: 5 },
        });
      });

      const config = new AppConfig({
        schema: testSchema,
        environment: "development",
      });
      await config.initialize();

      expect(config.get("api")).toEqual({
        timeout: 10000, // Overridden by env config
        retries: 5, // From base config
      });
    });

    it("handles missing base config gracefully", async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        // Return true for directory AND env-specific config only (no base config.json)
        return (
          pathStr.endsWith("appconfig") ||
          pathStr.endsWith("config.development.json")
        );
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ port: 4000 }),
      );

      const config = new AppConfig({
        schema: testSchema,
        environment: "development",
      });
      await config.initialize();

      expect(config.get("port")).toBe(4000);
      expect(config.configFiles.length).toBe(1);
    });

    it("handles missing configDir gracefully", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.get("port")).toBe(3000);
      expect(config.configFiles.length).toBe(0);
    });

    it("handles directory exists but no config files inside", async () => {
      // Directory exists but neither config.json nor config.<env>.json exist
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        const pathStr = String(p);
        // Only directory exists, no config files
        return pathStr.endsWith("appconfig");
      });

      const config = new AppConfig({
        schema: testSchema,
        environment: "development",
      });
      await config.initialize();

      // Should use schema defaults
      expect(config.get("port")).toBe(3000);
      expect(config.get("debug")).toBe(false);
      expect(config.configFiles.length).toBe(0);
    });

    it("throws ConfigFileError for file read errors", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        const error = new Error("EACCES: permission denied");
        (error as NodeJS.ErrnoException).code = "EACCES";
        throw error;
      });

      const config = new AppConfig({ schema: testSchema });

      await expect(config.initialize()).rejects.toThrow(ConfigFileError);
    });
  });

  describe("get() method", () => {
    it("throws NotInitializedError before initialize()", () => {
      const config = new AppConfig({ schema: testSchema });
      expect(() => config.get("port")).toThrow(NotInitializedError);
    });

    it("returns correct types for each key", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      const port: number = config.get("port");
      const debug: boolean = config.get("debug");
      const name: string = config.get("name");
      const api: { timeout: number; retries: number } = config.get("api");

      expect(typeof port).toBe("number");
      expect(typeof debug).toBe("boolean");
      expect(typeof name).toBe("string");
      expect(typeof api).toBe("object");
    });

    it("supports dot-notation for nested values", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      // Nested path access
      const timeout: number = config.get("api.timeout");
      const retries: number = config.get("api.retries");

      expect(timeout).toBe(5000);
      expect(retries).toBe(3);
    });

    it("returns nested values from file config", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          api: { timeout: 10000 },
        }),
      );

      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.get("api.timeout")).toBe(10000);
      expect(config.get("api.retries")).toBe(3); // Schema default
    });

    it("returns undefined for non-existent nested paths", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      // @ts-expect-error - testing invalid path at runtime
      expect(config.get("api.nonexistent")).toBeUndefined();
      // @ts-expect-error - testing invalid path at runtime
      expect(config.get("nonexistent.path")).toBeUndefined();
    });

    it("handles deeply nested paths", async () => {
      const deepSchema = z.object({
        level1: z
          .object({
            level2: z
              .object({
                level3: z
                  .object({
                    value: z.string().default("deep"),
                  })
                  .default({ value: "deep" }),
              })
              .default({ level3: { value: "deep" } }),
          })
          .default({ level2: { level3: { value: "deep" } } }),
      });

      const config = new AppConfig({ schema: deepSchema });
      await config.initialize();

      expect(config.get("level1.level2.level3.value")).toBe("deep");
    });
  });

  describe("getAll() method", () => {
    it("throws NotInitializedError before initialize()", () => {
      const config = new AppConfig({ schema: testSchema });
      expect(() => config.getAll()).toThrow(NotInitializedError);
    });

    it("returns entire config object", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.getAll()).toEqual({
        port: 3000,
        debug: false,
        name: "test",
        api: { timeout: 5000, retries: 3 },
      });
    });

    it("returns a copy (not the internal object)", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      const all1 = config.getAll();
      const all2 = config.getAll();

      expect(all1).not.toBe(all2);
      expect(all1).toEqual(all2);
    });
  });

  describe("validation", () => {
    it("throws ConfigValidationError for invalid config", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ port: "invalid" }),
      );

      const config = new AppConfig({ schema: testSchema });

      await expect(config.initialize()).rejects.toThrow(ConfigValidationError);
    });

    it("validates nested objects", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          api: { timeout: "slow" },
        }),
      );

      const config = new AppConfig({ schema: testSchema });

      await expect(config.initialize()).rejects.toThrow(ConfigValidationError);
    });

    it("throws ConfigFileError for malformed JSON", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("{ invalid json }");

      const config = new AppConfig({ schema: testSchema });

      await expect(config.initialize()).rejects.toThrow(ConfigFileError);
    });
  });

  describe("isStatsigAvailable", () => {
    it("returns false when Statsig not configured", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.isStatsigAvailable).toBe(false);
    });

    it("returns false before initialization", () => {
      const config = new AppConfig({ schema: testSchema });
      expect(config.isStatsigAvailable).toBe(false);
    });
  });

  describe("shutdown", () => {
    it("can be called without error", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      await expect(config.shutdown()).resolves.not.toThrow();
    });

    it("can be called before initialization", async () => {
      const config = new AppConfig({ schema: testSchema });
      await expect(config.shutdown()).resolves.not.toThrow();
    });

    it("throws NotInitializedError if get() called after shutdown()", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.get("port")).toBe(3000); // Works before shutdown

      await config.shutdown();

      expect(() => config.get("port")).toThrow(NotInitializedError);
    });

    it("throws NotInitializedError if getAll() called after shutdown()", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.getAll()).toBeDefined(); // Works before shutdown

      await config.shutdown();

      expect(() => config.getAll()).toThrow(NotInitializedError);
    });

    it("can be re-initialized after shutdown", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();
      expect(config.get("port")).toBe(3000);

      await config.shutdown();
      expect(() => config.get("port")).toThrow(NotInitializedError);

      await config.initialize();
      expect(config.get("port")).toBe(3000); // Works again after re-init
    });
  });

  describe("environment variable support", () => {
    const originalEnvValues: Record<string, string | undefined> = {};

    beforeEach(() => {
      // Save original env values we'll modify
      originalEnvValues.TEST_PORT = process.env.TEST_PORT;
      originalEnvValues.TEST_DEBUG = process.env.TEST_DEBUG;
      originalEnvValues.TEST_API_TIMEOUT = process.env.TEST_API_TIMEOUT;
      originalEnvValues.TEST_API_KEY = process.env.TEST_API_KEY;
      originalEnvValues.TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD;
    });

    afterEach(() => {
      // Restore original env values
      for (const [key, value] of Object.entries(originalEnvValues)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    it("loads env vars into config using .env() mapping", async () => {
      process.env.TEST_PORT = "8080";

      const schemaWithCoercion = z.object({
        port: z.coerce.number().default(3000).env("TEST_PORT"),
      });

      const config = new AppConfig({
        schema: schemaWithCoercion,
      });
      await config.initialize();

      expect(config.get("port")).toBe(8080); // z.coerce converts string to number
    });

    it("env vars override file config (highest priority)", async () => {
      process.env.TEST_PORT = "9000";

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ port: 8080 }),
      );

      const schemaWithStringPort = z.object({
        port: z.coerce.number().default(3000).env("TEST_PORT"),
      });

      const config = new AppConfig({
        schema: schemaWithStringPort,
      });
      await config.initialize();

      expect(config.get("port")).toBe(9000); // Env var wins over file
    });

    it("supports nested paths via .env()", async () => {
      process.env.TEST_API_TIMEOUT = "15000";

      const schemaWithCoercion = z.object({
        api: z
          .object({
            timeout: z.coerce.number().default(5000).env("TEST_API_TIMEOUT"),
            retries: z.number().default(3),
          })
          .default({ timeout: 5000, retries: 3 }),
      });

      const config = new AppConfig({
        schema: schemaWithCoercion,
      });
      await config.initialize();

      expect(config.get("api.timeout")).toBe(15000);
      expect(config.get("api.retries")).toBe(3); // Schema default preserved
    });

    it("missing env vars don't break config", async () => {
      // TEST_PORT is not set
      delete process.env.TEST_PORT;

      const schemaWithEnv = z.object({
        port: z.number().default(3000).env("TEST_PORT"),
        debug: z.boolean().default(false),
      });

      const config = new AppConfig({
        schema: schemaWithEnv,
      });
      await config.initialize();

      expect(config.get("port")).toBe(3000); // Uses schema default
    });

    it("throws validation error when required env var is missing", async () => {
      delete process.env.TEST_API_KEY;

      const schemaWithRequired = z.object({
        apiKey: z.string().min(1, "API key is required").env("TEST_API_KEY"),
      });

      const config = new AppConfig({
        schema: schemaWithRequired,
      });

      await expect(config.initialize()).rejects.toThrow(ConfigValidationError);
    });

    it("env vars create nested objects when needed", async () => {
      process.env.TEST_API_KEY = "secret-key-123";

      const nestedSchema = z.object({
        openRouter: z
          .object({
            apiKey: z.string().min(1).env("TEST_API_KEY"),
          })
          .default({ apiKey: "" }),
      });

      const config = new AppConfig({
        schema: nestedSchema,
      });
      await config.initialize();

      expect(config.get("openRouter.apiKey")).toBe("secret-key-123");
    });

    it("schema without .env() mappings works fine", async () => {
      const config = new AppConfig({
        schema: testSchema,
      });
      await config.initialize();

      expect(config.get("port")).toBe(3000);
    });

    it("combines nested values from config file and env vars", async () => {
      // database.host comes from config file, database.password comes from env var
      process.env.TEST_DB_PASSWORD = "secret-password";

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          database: {
            host: "localhost",
            port: 5432,
          },
        }),
      );

      const dbSchema = z.object({
        database: z.object({
          host: z.string(),
          port: z.number(),
          password: z.string().env("TEST_DB_PASSWORD"),
        }),
      });

      const config = new AppConfig({
        schema: dbSchema,
      });
      await config.initialize();

      // Values from config file
      expect(config.get("database.host")).toBe("localhost");
      expect(config.get("database.port")).toBe(5432);
      // Value from env var
      expect(config.get("database.password")).toBe("secret-password");
      // Full merged object
      expect(config.get("database")).toEqual({
        host: "localhost",
        port: 5432,
        password: "secret-password",
      });
    });
  });

  describe("edge cases", () => {
    it("handles falsy values (false, 0)", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ port: 0, debug: false }),
      );

      const schemaWithTrueDefaults = z.object({
        port: z.number().default(3000),
        debug: z.boolean().default(true),
      });

      const config = new AppConfig({ schema: schemaWithTrueDefaults });
      await config.initialize();

      expect(config.get("port")).toBe(0);
      expect(config.get("debug")).toBe(false);
    });

    it("handles empty config file", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      expect(config.get("port")).toBe(3000);
    });

    it("handles arrays in config", async () => {
      const arraySchema = z.object({
        origins: z.array(z.string()).default(["localhost"]),
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          origins: ["https://example.com", "https://api.example.com"],
        }),
      );

      const config = new AppConfig({ schema: arraySchema });
      await config.initialize();

      expect(config.get("origins")).toEqual([
        "https://example.com",
        "https://api.example.com",
      ]);
    });
  });
});
