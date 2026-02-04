/**
 * Environment Normalizer Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizeEnvironment,
  resolveEnvironment,
} from "../src/environment.js";

describe("normalizeEnvironment", () => {
  describe("development aliases", () => {
    it("normalizes 'dev' to 'development'", () => {
      expect(normalizeEnvironment("dev")).toBe("development");
    });

    it("normalizes 'development' to 'development'", () => {
      expect(normalizeEnvironment("development")).toBe("development");
    });

    it("is case-insensitive for development", () => {
      expect(normalizeEnvironment("DEV")).toBe("development");
      expect(normalizeEnvironment("Dev")).toBe("development");
      expect(normalizeEnvironment("DEVELOPMENT")).toBe("development");
      expect(normalizeEnvironment("Development")).toBe("development");
    });
  });

  describe("production aliases", () => {
    it("normalizes 'prod' to 'production'", () => {
      expect(normalizeEnvironment("prod")).toBe("production");
    });

    it("normalizes 'production' to 'production'", () => {
      expect(normalizeEnvironment("production")).toBe("production");
    });

    it("is case-insensitive for production", () => {
      expect(normalizeEnvironment("PROD")).toBe("production");
      expect(normalizeEnvironment("Prod")).toBe("production");
      expect(normalizeEnvironment("PRODUCTION")).toBe("production");
      expect(normalizeEnvironment("Production")).toBe("production");
    });
  });

  describe("staging aliases", () => {
    it("normalizes 'stage' to 'staging'", () => {
      expect(normalizeEnvironment("stage")).toBe("staging");
    });

    it("normalizes 'stag' to 'staging'", () => {
      expect(normalizeEnvironment("stag")).toBe("staging");
    });

    it("normalizes 'staging' to 'staging'", () => {
      expect(normalizeEnvironment("staging")).toBe("staging");
    });

    it("is case-insensitive for staging", () => {
      expect(normalizeEnvironment("STAGE")).toBe("staging");
      expect(normalizeEnvironment("Stage")).toBe("staging");
      expect(normalizeEnvironment("STAGING")).toBe("staging");
      expect(normalizeEnvironment("Staging")).toBe("staging");
      expect(normalizeEnvironment("STAG")).toBe("staging");
    });
  });

  describe("test aliases", () => {
    it("normalizes 'test' to 'test'", () => {
      expect(normalizeEnvironment("test")).toBe("test");
    });

    it("normalizes 'testing' to 'test'", () => {
      expect(normalizeEnvironment("testing")).toBe("test");
    });

    it("is case-insensitive for test", () => {
      expect(normalizeEnvironment("TEST")).toBe("test");
      expect(normalizeEnvironment("Test")).toBe("test");
      expect(normalizeEnvironment("TESTING")).toBe("test");
      expect(normalizeEnvironment("Testing")).toBe("test");
    });
  });

  describe("unknown environments", () => {
    it("returns unknown values as-is (lowercase)", () => {
      expect(normalizeEnvironment("custom")).toBe("custom");
      expect(normalizeEnvironment("Custom")).toBe("custom");
      expect(normalizeEnvironment("CUSTOM")).toBe("custom");
    });

    it("handles arbitrary environment names", () => {
      expect(normalizeEnvironment("qa")).toBe("qa");
      expect(normalizeEnvironment("uat")).toBe("uat");
      expect(normalizeEnvironment("preview")).toBe("preview");
      expect(normalizeEnvironment("sandbox")).toBe("sandbox");
    });
  });

  describe("edge cases", () => {
    it("trims whitespace", () => {
      expect(normalizeEnvironment("  dev  ")).toBe("development");
      expect(normalizeEnvironment("\tprod\n")).toBe("production");
    });

    it("handles empty-ish strings", () => {
      expect(normalizeEnvironment("   ")).toBe("");
    });
  });
});

describe("resolveEnvironment", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("uses provided environment when given", () => {
    expect(resolveEnvironment("prod")).toBe("production");
    expect(resolveEnvironment("dev")).toBe("development");
    expect(resolveEnvironment("custom")).toBe("custom");
  });

  it("uses NODE_ENV when no environment provided", () => {
    process.env.NODE_ENV = "production";
    expect(resolveEnvironment()).toBe("production");

    process.env.NODE_ENV = "development";
    expect(resolveEnvironment()).toBe("development");
  });

  it("normalizes NODE_ENV value", () => {
    process.env.NODE_ENV = "prod";
    expect(resolveEnvironment()).toBe("production");

    process.env.NODE_ENV = "dev";
    expect(resolveEnvironment()).toBe("development");
  });

  it("defaults to 'development' when NODE_ENV is not set", () => {
    delete process.env.NODE_ENV;
    expect(resolveEnvironment()).toBe("development");
  });

  it("provided environment takes precedence over NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    expect(resolveEnvironment("staging")).toBe("staging");
  });
});
