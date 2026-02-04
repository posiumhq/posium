/**
 * Statsig Integration Tests
 *
 * These tests verify the Statsig integration behavior by testing the
 * AppConfig class with mocked dependencies. Since the statsig-node module
 * is dynamically imported, we test behavior through the public API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import * as fs from "node:fs";

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Import the classes for testing
import {
  AppConfig,
  ConfigValidationError,
  NotInitializedError,
} from "../src/index.js";

const testSchema = z.object({
  port: z.number().default(3000),
  debug: z.boolean().default(false),
  rateLimitPerMinute: z.number().default(100),
  features: z
    .object({
      darkMode: z.boolean().default(false),
      betaFeatures: z.boolean().default(false),
      experimentalUI: z.boolean().default(false),
    })
    .default({
      darkMode: false,
      betaFeatures: false,
      experimentalUI: false,
    }),
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

describe("AppConfig - Statsig Integration Scenarios", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    process.env.NODE_ENV = originalEnv;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  describe("without Statsig (OSS mode)", () => {
    it("works with schema defaults only", async () => {
      const config = new AppConfig({
        schema: testSchema,
      });

      await config.initialize();

      expect(config.isStatsigAvailable).toBe(false);
      expect(config.statsig).toBe(null);
      expect(config.get("port")).toBe(3000);
      expect(config.get("debug")).toBe(false);
      expect(config.get("rateLimitPerMinute")).toBe(100);
      expect(config.get("features")).toEqual({
        darkMode: false,
        betaFeatures: false,
        experimentalUI: false,
      });
    });

    it("uses file config values when provided", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          port: 8080,
          debug: true,
          features: {
            darkMode: true,
          },
        }),
      );

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./appconfig",
        environment: "development",
      });

      await config.initialize();

      expect(config.get("port")).toBe(8080);
      expect(config.get("debug")).toBe(true);
      expect(config.get("features")).toEqual({
        darkMode: true,
        betaFeatures: false, // Schema default
        experimentalUI: false, // Schema default
      });
    });

    it("deep merges file config with schema defaults", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          api: {
            timeout: 10000,
          },
        }),
      );

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./appconfig",
      });

      await config.initialize();

      expect(config.get("api")).toEqual({
        timeout: 10000, // From file
        retries: 3, // Schema default
      });
    });

    it("user parameter is ignored when Statsig not configured", async () => {
      const config = new AppConfig({
        schema: testSchema,
      });

      await config.initialize();

      // Should not throw, user parameter is simply ignored
      expect(config.get("port", { userID: "user123" })).toBe(3000);
      expect(config.getAll({ userID: "user123" })).toEqual({
        port: 3000,
        debug: false,
        rateLimitPerMinute: 100,
        features: {
          darkMode: false,
          betaFeatures: false,
          experimentalUI: false,
        },
        api: {
          timeout: 5000,
          retries: 3,
        },
      });
    });

    it("file is only read once at initialization", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ port: 4000 }),
      );

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./appconfig",
      });

      await config.initialize();

      // Clear mock to check no further reads
      const readCount = vi.mocked(fs.readFileSync).mock.calls.length;

      // Multiple gets should not re-read file
      config.get("port");
      config.get("port");
      config.get("debug");
      config.getAll();

      expect(fs.readFileSync).toHaveBeenCalledTimes(readCount);
    });

    it("handles missing config directory gracefully", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./nonexistent",
      });

      // Should not throw
      await config.initialize();

      // Should use schema defaults
      expect(config.get("port")).toBe(3000);
    });
  });

  describe("validation", () => {
    it("throws ConfigValidationError for invalid file config", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          port: "not-a-number", // Invalid type
        }),
      );

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./appconfig",
      });

      await expect(config.initialize()).rejects.toThrow(ConfigValidationError);
    });

    it("validates nested objects", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          api: {
            timeout: "slow", // Invalid type
          },
        }),
      );

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./appconfig",
      });

      await expect(config.initialize()).rejects.toThrow(ConfigValidationError);
    });
  });

  describe("lifecycle", () => {
    it("throws NotInitializedError if get() called before initialize()", () => {
      const config = new AppConfig({ schema: testSchema });
      expect(() => config.get("port")).toThrow(NotInitializedError);
    });

    it("throws NotInitializedError if getAll() called before initialize()", () => {
      const config = new AppConfig({ schema: testSchema });
      expect(() => config.getAll()).toThrow(NotInitializedError);
    });

    it("can initialize multiple times without error", async () => {
      const config = new AppConfig({ schema: testSchema });

      await config.initialize();
      await config.initialize();
      await config.initialize();

      expect(config.get("port")).toBe(3000);
    });

    it("shutdown can be called without initialization", async () => {
      const config = new AppConfig({ schema: testSchema });
      await expect(config.shutdown()).resolves.not.toThrow();
    });

    it("shutdown can be called multiple times", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      await config.shutdown();
      await config.shutdown();
      await config.shutdown();
    });
  });

  describe("getAll()", () => {
    it("returns entire config object", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ port: 8080 }),
      );

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./appconfig",
      });

      await config.initialize();

      expect(config.getAll()).toEqual({
        port: 8080,
        debug: false,
        rateLimitPerMinute: 100,
        features: {
          darkMode: false,
          betaFeatures: false,
          experimentalUI: false,
        },
        api: {
          timeout: 5000,
          retries: 3,
        },
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

  describe("edge cases", () => {
    it("handles array config values from file", async () => {
      const schemaWithArrays = z.object({
        allowedOrigins: z.array(z.string()).default(["http://localhost"]),
        ports: z.array(z.number()).default([3000]),
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          allowedOrigins: ["https://example.com", "https://api.example.com"],
        }),
      );

      const config = new AppConfig({
        schema: schemaWithArrays,
        configDir: "./appconfig",
      });

      await config.initialize();

      expect(config.get("allowedOrigins")).toEqual([
        "https://example.com",
        "https://api.example.com",
      ]);
      expect(config.get("ports")).toEqual([3000]); // Schema default
    });

    it("handles boolean false values from file", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          debug: false, // Explicit false
        }),
      );

      const schemaWithDebugTrue = z.object({
        debug: z.boolean().default(true), // Default is true
      });

      const config = new AppConfig({
        schema: schemaWithDebugTrue,
        configDir: "./appconfig",
      });

      await config.initialize();

      expect(config.get("debug")).toBe(false); // File false overrides schema default true
    });

    it("handles zero values from file", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          port: 0,
          rateLimitPerMinute: 0,
        }),
      );

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./appconfig",
      });

      await config.initialize();

      expect(config.get("port")).toBe(0);
      expect(config.get("rateLimitPerMinute")).toBe(0);
    });

    it("handles deeply nested config", async () => {
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

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          level1: {
            level2: {
              level3: {
                value: "from-file",
              },
            },
          },
        }),
      );

      const config = new AppConfig({
        schema: deepSchema,
        configDir: "./appconfig",
      });

      await config.initialize();

      expect(config.get("level1")).toEqual({
        level2: {
          level3: {
            value: "from-file",
          },
        },
      });
    });

    it("handles optional schema fields", async () => {
      const optionalSchema = z.object({
        required: z.string().default("default"),
        optional: z.string().optional(),
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          optional: "from-file",
        }),
      );

      const config = new AppConfig({
        schema: optionalSchema,
        configDir: "./appconfig",
      });

      await config.initialize();

      expect(config.get("required")).toBe("default");
      expect(config.get("optional")).toBe("from-file");
    });

    it("handles empty file config", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const config = new AppConfig({
        schema: testSchema,
        configDir: "./appconfig",
      });

      await config.initialize();

      // Should use schema defaults
      expect(config.get("port")).toBe(3000);
      expect(config.get("debug")).toBe(false);
    });
  });

  describe("type safety", () => {
    it("returns correct types for each key", async () => {
      const config = new AppConfig({ schema: testSchema });
      await config.initialize();

      const port: number = config.get("port");
      const debug: boolean = config.get("debug");
      const rateLimitPerMinute: number = config.get("rateLimitPerMinute");
      const features: {
        darkMode: boolean;
        betaFeatures: boolean;
        experimentalUI: boolean;
      } = config.get("features");
      const api: { timeout: number; retries: number } = config.get("api");

      expect(typeof port).toBe("number");
      expect(typeof debug).toBe("boolean");
      expect(typeof rateLimitPerMinute).toBe("number");
      expect(typeof features).toBe("object");
      expect(typeof api).toBe("object");
    });
  });

  describe("Statsig configuration options", () => {
    it("accepts statsig options without secretKey", async () => {
      // Clear env var to test explicit "no secretKey" behavior
      const originalEnvKey = process.env.STATSIG_SECRET_KEY;
      delete process.env.STATSIG_SECRET_KEY;

      try {
        const config = new AppConfig({
          schema: testSchema,
          statsig: {} as { secretKey: string },
        });

        await config.initialize();

        expect(config.isStatsigAvailable).toBe(false);
      } finally {
        // Restore env var
        if (originalEnvKey !== undefined) {
          process.env.STATSIG_SECRET_KEY = originalEnvKey;
        }
      }
    });

    it("accepts configName configuration", async () => {
      const config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "",
          configName: "custom_config",
        },
      });

      await config.initialize();

      expect(config.isStatsigAvailable).toBe(false);
    });
  });

  describe("environment configuration", () => {
    it("uses environment for config file selection", async () => {
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
          return JSON.stringify({ port: 80 });
        }
        return JSON.stringify({ port: 3000 });
      });

      const config = new AppConfig({
        schema: testSchema,
        environment: "production",
      });

      await config.initialize();

      expect(config.get("port")).toBe(80);
      expect(config.currentEnvironment).toBe("production");
    });

    it("normalizes environment aliases", async () => {
      const config = new AppConfig({
        schema: testSchema,
        environment: "prod",
      });

      await config.initialize();

      expect(config.currentEnvironment).toBe("production");
    });
  });
});

describe("AppConfig - API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it("get() method accepts optional user parameter", async () => {
    const config = new AppConfig({
      schema: z.object({ value: z.number().default(1) }),
    });

    await config.initialize();

    expect(config.get("value")).toBe(1);
    expect(config.get("value", { userID: "user123" })).toBe(1);
    expect(
      config.get("value", { userID: "user123", email: "test@test.com" }),
    ).toBe(1);
    expect(
      config.get("value", { customIDs: { companyID: "company123" } }),
    ).toBe(1);
  });

  it("getAll() method accepts optional user parameter", async () => {
    const config = new AppConfig({
      schema: z.object({ value: z.number().default(1) }),
    });

    await config.initialize();

    expect(config.getAll()).toEqual({ value: 1 });
    expect(config.getAll({ userID: "user123" })).toEqual({ value: 1 });
  });

  it("statsig property exists and is null when not configured", async () => {
    const config = new AppConfig({
      schema: z.object({ value: z.number().default(1) }),
    });

    await config.initialize();

    expect(config.statsig).toBe(null);
  });

  it("isStatsigAvailable property exists and is false when not configured", async () => {
    const config = new AppConfig({
      schema: z.object({ value: z.number().default(1) }),
    });

    expect(config.isStatsigAvailable).toBe(false);

    await config.initialize();

    expect(config.isStatsigAvailable).toBe(false);
  });

  it("currentEnvironment returns normalized environment", async () => {
    const config = new AppConfig({
      schema: z.object({ value: z.number().default(1) }),
      environment: "dev",
    });

    await config.initialize();

    expect(config.currentEnvironment).toBe("development");
  });

  it("configFiles returns list of loaded files", async () => {
    const config = new AppConfig({
      schema: z.object({ value: z.number().default(1) }),
    });

    await config.initialize();

    expect(config.configFiles).toEqual([]);
  });
});
