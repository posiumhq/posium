import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import "../src/zod-env.js"; // Activate .env() extension
import { extractEnvMapping, getEnvVar } from "../src/zod-env.js";
import { AppConfig } from "../src/index.js";

describe("zod-env extension", () => {
  describe(".env() method", () => {
    it("should add env var name to schema", () => {
      const schema = z.string().env("DATABASE_URL");
      expect(getEnvVar(schema)).toBe("DATABASE_URL");
    });

    it("should chain with other methods", () => {
      const schema = z.string().min(1).env("API_KEY");
      expect(getEnvVar(schema)).toBe("API_KEY");
    });

    it("should work with .default()", () => {
      const schema = z.string().default("localhost").env("HOST");
      expect(getEnvVar(schema)).toBe("HOST");
    });

    it("should work with .optional()", () => {
      const schema = z.string().optional().env("OPTIONAL_VAR");
      expect(getEnvVar(schema)).toBe("OPTIONAL_VAR");
    });

    it("should work with z.coerce.number()", () => {
      const schema = z.coerce.number().default(3000).env("PORT");
      expect(getEnvVar(schema)).toBe("PORT");
    });

    it("should work with z.enum()", () => {
      const schema = z
        .enum(["development", "production"])
        .default("development")
        .env("NODE_ENV");
      expect(getEnvVar(schema)).toBe("NODE_ENV");
    });
  });

  describe("extractEnvMapping()", () => {
    it("should extract flat schema env mapping", () => {
      const schema = z.object({
        port: z.coerce.number().default(3000).env("PORT"),
        host: z.string().default("localhost").env("HOST"),
      });

      const mapping = extractEnvMapping(schema);

      expect(mapping).toEqual({
        PORT: "port",
        HOST: "host",
      });
    });

    it("should extract nested object env mapping", () => {
      const schema = z.object({
        database: z.object({
          url: z.string().env("DATABASE_URL"),
          poolSize: z.number().default(10).env("DB_POOL_SIZE"),
        }),
      });

      const mapping = extractEnvMapping(schema);

      expect(mapping).toEqual({
        DATABASE_URL: "database.url",
        DB_POOL_SIZE: "database.poolSize",
      });
    });

    it("should extract deeply nested object env mapping", () => {
      const schema = z.object({
        openRouter: z.object({
          apiKey: z.string().env("OPENROUTER_API_KEY"),
          cloudflare: z.object({
            accountId: z.string().optional().env("CF_ACCOUNT_ID"),
          }),
        }),
      });

      const mapping = extractEnvMapping(schema);

      expect(mapping).toEqual({
        OPENROUTER_API_KEY: "openRouter.apiKey",
        CF_ACCOUNT_ID: "openRouter.cloudflare.accountId",
      });
    });

    it("should handle schemas with ZodDefault wrapper on object", () => {
      const schema = z.object({
        auth: z
          .object({
            secret: z.string().optional().env("AUTH_SECRET"),
          })
          .default({}),
      });

      const mapping = extractEnvMapping(schema);

      expect(mapping).toEqual({
        AUTH_SECRET: "auth.secret",
      });
    });

    it("should skip fields without .env()", () => {
      const schema = z.object({
        port: z.number().default(3000).env("PORT"),
        debugMode: z.boolean().default(false), // No .env()
      });

      const mapping = extractEnvMapping(schema);

      expect(mapping).toEqual({
        PORT: "port",
      });
      expect(mapping).not.toHaveProperty("debugMode");
    });

    it("should return empty object for schema without any .env()", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mapping = extractEnvMapping(schema);

      expect(mapping).toEqual({});
    });
  });

  describe("AppConfig integration", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      // Clean env vars
      delete process.env.TEST_PORT;
      delete process.env.TEST_HOST;
      delete process.env.TEST_DB_URL;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("should auto-extract env mapping from schema", async () => {
      const schema = z.object({
        port: z.coerce.number().default(3000).env("TEST_PORT"),
        host: z.string().default("localhost").env("TEST_HOST"),
      });

      process.env.TEST_PORT = "8080";
      process.env.TEST_HOST = "0.0.0.0";

      const config = new AppConfig({ schema });
      await config.initialize();

      expect(config.get("port")).toBe(8080);
      expect(config.get("host")).toBe("0.0.0.0");
    });

    it("should extract nested env mapping from schema", async () => {
      const schema = z.object({
        database: z
          .object({
            url: z.string().default("").env("TEST_DB_URL"),
          })
          .default({ url: "" }),
      });

      process.env.TEST_DB_URL = "postgres://localhost/test";

      const config = new AppConfig({ schema });
      await config.initialize();

      expect(config.get("database.url")).toBe("postgres://localhost/test");
    });

  });
});
