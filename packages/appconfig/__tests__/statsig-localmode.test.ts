/**
 * Statsig Integration Tests using disableNetwork mode
 *
 * These tests use the new @statsig/statsig-node-core SDK with disableNetwork
 * and override methods to test the real integration path without network requests.
 *
 * @see https://docs.statsig.com/server-core/node-core
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { Statsig, StatsigUser } from "@statsig/statsig-node-core";
import { AppConfig } from "../src/index.js";

const testSchema = z.object({
  port: z.number().default(3000),
  debug: z.boolean().default(false),
  rateLimit: z.number().default(100),
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

describe("AppConfig with Statsig (disableNetwork mode)", () => {
  let config: AppConfig<typeof testSchema>;
  let statsigInstance: Statsig | null = null;

  afterEach(async () => {
    if (config) {
      await config.shutdown();
    }
    if (statsigInstance) {
      await statsigInstance.shutdown();
      statsigInstance = null;
    }
  });

  describe("basic Statsig integration", () => {
    it("initializes with Statsig in disableNetwork mode", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();

      expect(config.isStatsigAvailable).toBe(true);
      expect(config.statsig).not.toBeNull();
    });

    it("returns schema defaults when no overrides set", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();

      expect(config.get("port")).toBe(3000);
      expect(config.get("debug")).toBe(false);
      expect(config.get("rateLimit")).toBe(100);
    });

    it("uses overrideDynamicConfig to set dynamic values", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await config.initialize();

      // Set override using the instance's override method
      const statsig = config.statsig!;
      statsig.overrideDynamicConfig("test_config", {
        rateLimit: 500,
        features: { darkMode: true },
      });

      expect(config.get("rateLimit")).toBe(500);
      expect(config.get("features")).toEqual({
        darkMode: true,
        betaFeatures: false, // Schema default
        experimentalUI: false, // Schema default
      });
    });

    it("deep merges override values with schema defaults", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await config.initialize();

      config.statsig!.overrideDynamicConfig("test_config", {
        api: { timeout: 10000 },
      });

      expect(config.get("api")).toEqual({
        timeout: 10000, // Override
        retries: 3, // Schema default preserved
      });
    });
  });

  describe("user-specific overrides", () => {
    it("returns different values for different users", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await config.initialize();

      // Set user-specific override
      config.statsig!.overrideDynamicConfig(
        "test_config",
        { rateLimit: 1000 },
        "premium-user",
      );

      // Default user gets schema default
      expect(config.get("rateLimit")).toBe(100);

      // Premium user gets override
      expect(config.get("rateLimit", { userID: "premium-user" })).toBe(1000);
    });

    it("global override applies to all users without specific override", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await config.initialize();

      // Global override (no userID)
      config.statsig!.overrideDynamicConfig("test_config", { rateLimit: 200 });

      // User-specific override
      config.statsig!.overrideDynamicConfig(
        "test_config",
        { rateLimit: 500 },
        "special-user",
      );

      expect(config.get("rateLimit")).toBe(200);
      expect(config.get("rateLimit", { userID: "regular-user" })).toBe(200);
      expect(config.get("rateLimit", { userID: "special-user" })).toBe(500);
    });
  });

  describe("getAll with overrides", () => {
    it("returns full config with overrides applied", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await config.initialize();

      config.statsig!.overrideDynamicConfig("test_config", {
        port: 8080,
        debug: true,
        features: { betaFeatures: true },
      });

      expect(config.getAll()).toEqual({
        port: 8080,
        debug: true,
        rateLimit: 100,
        features: {
          darkMode: false,
          betaFeatures: true,
          experimentalUI: false,
        },
        api: {
          timeout: 5000,
          retries: 3,
        },
      });
    });

    it("getAll accepts user parameter", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await config.initialize();

      config.statsig!.overrideDynamicConfig(
        "test_config",
        { features: { experimentalUI: true } },
        "beta-user",
      );

      const regularConfig = config.getAll();
      const betaConfig = config.getAll({ userID: "beta-user" });

      expect(regularConfig.features.experimentalUI).toBe(false);
      expect(betaConfig.features.experimentalUI).toBe(true);
    });
  });

  describe("statsig client access", () => {
    it("exposes Statsig client for gates and experiments", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();

      const statsig = config.statsig;
      expect(statsig).not.toBeNull();

      // Use Statsig's gate override
      statsig!.overrideGate("test_gate", true);

      const gateValue = statsig!.checkGate(
        new StatsigUser({ userID: "test" }),
        "test_gate",
      );
      expect(gateValue).toBe(true);
    });

    it("supports user-specific gate overrides", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();

      const statsig = config.statsig!;

      // User-specific gate override
      statsig.overrideGate("premium_feature", true, "premium-user");

      expect(
        statsig.checkGate(
          new StatsigUser({ userID: "regular" }),
          "premium_feature",
        ),
      ).toBe(false);
      expect(
        statsig.checkGate(
          new StatsigUser({ userID: "premium-user" }),
          "premium_feature",
        ),
      ).toBe(true);
    });
  });

  describe("secret key resolution", () => {
    it("uses STATSIG_SECRET_KEY env var when secretKey not provided", async () => {
      const originalEnvKey = process.env.STATSIG_SECRET_KEY;
      process.env.STATSIG_SECRET_KEY = "env-secret-key";

      config = new AppConfig({
        schema: testSchema,
        statsig: {},
      });

      await config.initialize();

      expect(config.isStatsigAvailable).toBe(true);

      process.env.STATSIG_SECRET_KEY = originalEnvKey;
    });

    it("explicit secretKey takes precedence over env var", async () => {
      const originalEnvKey = process.env.STATSIG_SECRET_KEY;
      process.env.STATSIG_SECRET_KEY = "env-secret-key";

      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "explicit-secret-key",
        },
      });

      await config.initialize();

      expect(config.isStatsigAvailable).toBe(true);

      process.env.STATSIG_SECRET_KEY = originalEnvKey;
    });

    it("returns null when no secretKey and no env var", async () => {
      const originalEnvKey = process.env.STATSIG_SECRET_KEY;
      delete process.env.STATSIG_SECRET_KEY;

      config = new AppConfig({
        schema: testSchema,
        statsig: {},
      });

      await config.initialize();

      expect(config.isStatsigAvailable).toBe(false);

      process.env.STATSIG_SECRET_KEY = originalEnvKey;
    });
  });

  describe("environment configuration", () => {
    it("accepts environment at top-level config", async () => {
      config = new AppConfig({
        schema: testSchema,
        environment: "staging",
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();

      expect(config.isStatsigAvailable).toBe(true);
      expect(config.currentEnvironment).toBe("staging");
    });

    it("normalizes environment aliases", async () => {
      config = new AppConfig({
        schema: testSchema,
        environment: "prod",
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();

      expect(config.currentEnvironment).toBe("production");
    });

    it("uses NODE_ENV as default tier", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();

      expect(config.isStatsigAvailable).toBe(true);
      expect(config.currentEnvironment).toBe("production");

      process.env.NODE_ENV = originalEnv;
    });

    it("normalizes NODE_ENV aliases", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "dev";

      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();

      expect(config.currentEnvironment).toBe("development");

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("shutdown", () => {
    it("shuts down Statsig cleanly", async () => {
      config = new AppConfig({
        schema: testSchema,
        statsig: {
          secretKey: "secret-test-key",
        },
      });

      await config.initialize();
      await expect(config.shutdown()).resolves.not.toThrow();
    });
  });

  describe("edge cases with overrides", () => {
    it("handles falsy values (false, 0) in overrides", async () => {
      const schemaWithDefaults = z.object({
        enabled: z.boolean().default(true),
        count: z.number().default(10),
      });

      const cfg = new AppConfig({
        schema: schemaWithDefaults,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await cfg.initialize();

      cfg.statsig!.overrideDynamicConfig("test_config", {
        enabled: false,
        count: 0,
      });

      expect(cfg.get("enabled")).toBe(false);
      expect(cfg.get("count")).toBe(0);

      await cfg.shutdown();
    });

    it("handles nested object overrides", async () => {
      const deepSchema = z.object({
        level1: z
          .object({
            level2: z
              .object({
                value: z.string().default("default"),
                other: z.string().default("other"),
              })
              .default({ value: "default", other: "other" }),
          })
          .default({ level2: { value: "default", other: "other" } }),
      });

      const cfg = new AppConfig({
        schema: deepSchema,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await cfg.initialize();

      cfg.statsig!.overrideDynamicConfig("test_config", {
        level1: {
          level2: {
            value: "overridden",
          },
        },
      });

      expect(cfg.get("level1")).toEqual({
        level2: {
          value: "overridden",
          other: "other", // Preserved from schema default
        },
      });

      await cfg.shutdown();
    });

    it("handles array values in overrides", async () => {
      const arraySchema = z.object({
        allowedOrigins: z.array(z.string()).default(["http://localhost"]),
      });

      const cfg = new AppConfig({
        schema: arraySchema,
        statsig: {
          secretKey: "secret-test-key",
          configName: "test_config",
        },
      });

      await cfg.initialize();

      cfg.statsig!.overrideDynamicConfig("test_config", {
        allowedOrigins: ["https://example.com", "https://api.example.com"],
      });

      expect(cfg.get("allowedOrigins")).toEqual([
        "https://example.com",
        "https://api.example.com",
      ]);

      await cfg.shutdown();
    });
  });
});
