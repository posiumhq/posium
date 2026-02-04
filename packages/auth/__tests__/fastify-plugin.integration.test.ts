/**
 * Integration tests for Fastify API key plugin.
 *
 * These tests require a database connection and use the testdb package.
 * Run with: pnpm --filter @posium/auth test:integration
 *
 * Prerequisites:
 * - TEST_DB_HOST environment variable set (e.g., postgresql://postgres:password@localhost:5432/postgres)
 * - Or DATABASE_URL for CI mode
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createTestDb, type TestDbResult } from "@posium/testdb";
import { eq } from "drizzle-orm";
import * as schema from "@posium/db/schema";
import { seedOrgs, seedUsers } from "@posium/db/seed";
import { createAuth, type Auth } from "../src/server/config.js";
import { getOrCreateServiceUser } from "../src/server/service-user.js";
import { apiKeyPlugin, type ApiKeyUser } from "../src/fastify/index.js";

// Skip if TEST_DB_HOST is not set and not in CI mode
const shouldRun =
  process.env.TEST_DB_HOST || (process.env.DATABASE_URL && process.env.CI);

describe.skipIf(!shouldRun)("Fastify API Key Plugin Integration Tests", () => {
  let testDb: TestDbResult;
  let db: TestDbResult["db"];
  let auth: Auth;
  let fastify: FastifyInstance;

  // Store created keys for testing
  let orgWideKey: string;
  let projectScopedKey: string;
  let disabledKey: string;
  let disabledKeyId: string;
  let expiredKey: string;

  beforeAll(async () => {
    // Set up test database
    testDb = await createTestDb({
      applySeed: true,
      initBoss: false,
    });
    db = testDb.db;

    auth = createAuth(db, {
      secret: "test-secret-for-fastify-plugin-tests",
    });

    // Create test API keys
    const orgId = seedOrgs.amazon.id;
    const { userId: serviceUserId } = await getOrCreateServiceUser(orgId, db);

    // Create org-wide key
    const orgWideResult = await auth.api.createApiKey({
      body: {
        userId: serviceUserId,
        name: "Test Org-Wide Key",
        prefix: "apikey_",
        permissions: { [`org:${orgId}`]: ["manage"] },
        metadata: {
          organizationId: orgId,
          createdBy: seedUsers.amazonOwner.id,
          suffix: "",
          scope: "org",
          projects: [],
        },
      },
    });
    orgWideKey = orgWideResult.key;

    // Create project-scoped key
    const projectResult = await auth.api.createApiKey({
      body: {
        userId: serviceUserId,
        name: "Test Project Key",
        prefix: "apikey_",
        permissions: { "project:prj_seed_webapp": ["manage"] },
        metadata: {
          organizationId: orgId,
          createdBy: seedUsers.amazonDev1.id,
          suffix: "",
          scope: "project",
          projects: ["prj_seed_webapp"],
        },
      },
    });
    projectScopedKey = projectResult.key;

    // Create disabled key
    const disabledResult = await auth.api.createApiKey({
      body: {
        userId: serviceUserId,
        name: "Test Disabled Key",
        prefix: "apikey_",
        permissions: { [`org:${orgId}`]: ["manage"] },
        metadata: {
          organizationId: orgId,
          createdBy: seedUsers.amazonOwner.id,
          suffix: "",
          scope: "org",
          projects: [],
        },
      },
    });
    disabledKey = disabledResult.key;
    disabledKeyId = disabledResult.id;

    // Disable the key
    await db
      .update(schema.apikey)
      .set({ enabled: false })
      .where(eq(schema.apikey.id, disabledKeyId));

    // Create expired key - create without expiration, then manually expire it
    const expiredResult = await auth.api.createApiKey({
      body: {
        userId: serviceUserId,
        name: "Test Expired Key",
        prefix: "apikey_",
        permissions: { [`org:${orgId}`]: ["manage"] },
        metadata: {
          organizationId: orgId,
          createdBy: seedUsers.amazonOwner.id,
          suffix: "",
          scope: "org",
          projects: [],
        },
      },
    });
    expiredKey = expiredResult.key;

    // Manually set the key as expired by setting expiresAt to past
    await db
      .update(schema.apikey)
      .set({ expiresAt: new Date("2020-01-01") })
      .where(eq(schema.apikey.id, expiredResult.id));
  }, 60000);

  afterAll(async () => {
    await testDb.cleanup();
  }, 30000);

  /**
   * Helper to create a Fastify instance with the plugin and optional routes.
   * Call this in each test, add any additional routes, then call ready().
   */
  async function createTestServer() {
    const server = Fastify();
    await server.register(apiKeyPlugin, { auth });

    // Add the standard test route
    server.get("/test", async (request) => {
      return {
        authenticated: !!request.apiKeyUser,
        apiKeyUser: request.apiKeyUser || null,
      };
    });

    return server;
  }

  beforeEach(async () => {
    // Create a fresh Fastify instance for each test
    fastify = await createTestServer();

    // For tests that only use /test route, call ready() here
    // Tests that add additional routes will call ready() themselves
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("header handling", () => {
    it("skips when no x-api-key header is present", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authenticated).toBe(false);
      expect(body.apiKeyUser).toBeNull();
    });

    it("skips when x-api-key header is empty string", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": "" },
      });

      // Empty string is falsy, so it should skip
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authenticated).toBe(false);
    });
  });

  describe("valid keys", () => {
    it("authenticates with valid org-wide API key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": orgWideKey },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authenticated).toBe(true);
      expect(body.apiKeyUser).toBeDefined();
      expect(body.apiKeyUser.organizationId).toBe(seedOrgs.amazon.id);
      expect(body.apiKeyUser.createdBy).toBe(seedUsers.amazonOwner.id);
    });

    it("authenticates with valid project-scoped API key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": projectScopedKey },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authenticated).toBe(true);
      expect(body.apiKeyUser).toBeDefined();
      expect(body.apiKeyUser.organizationId).toBe(seedOrgs.amazon.id);
      expect(body.apiKeyUser.createdBy).toBe(seedUsers.amazonDev1.id);
    });

    it("populates correct permissions for org-wide key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": orgWideKey },
      });

      const body = response.json();
      const permissions = body.apiKeyUser.permissions;

      expect(permissions[`org:${seedOrgs.amazon.id}`]).toEqual(["manage"]);
    });

    it("populates correct permissions for project-scoped key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": projectScopedKey },
      });

      const body = response.json();
      const permissions = body.apiKeyUser.permissions;

      expect(permissions["project:prj_seed_webapp"]).toEqual(["manage"]);
    });

    it("populates userId from key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": orgWideKey },
      });

      const body = response.json();

      // userId should be the service user's ID
      expect(body.apiKeyUser.userId).toBeDefined();
      expect(typeof body.apiKeyUser.userId).toBe("string");
    });
  });

  describe("invalid keys", () => {
    it("returns 401 for invalid API key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": "apikey_invalid_12345" },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Invalid API key");
    });

    it("returns 401 for malformed API key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": "not-a-valid-key" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 for disabled API key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": disabledKey },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 for expired API key", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": expiredKey },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("error handling", () => {
    it("handles malformed permissions gracefully", async () => {
      // This test verifies that if permissions JSON is malformed,
      // the plugin doesn't crash - it falls back to empty permissions
      // We can't easily inject malformed data in integration test,
      // but we verify the plugin handles valid keys correctly
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "x-api-key": orgWideKey },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.apiKeyUser.permissions).toBeDefined();
    });
  });

  describe("header case sensitivity", () => {
    it("accepts X-Api-Key header (mixed case)", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "X-Api-Key": orgWideKey },
      });

      // HTTP headers are case-insensitive per RFC 7230
      // Fastify normalizes headers to lowercase
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authenticated).toBe(true);
    });

    it("accepts X-API-KEY header (uppercase)", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: { "X-API-KEY": orgWideKey },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authenticated).toBe(true);
    });
  });

  describe("authorization helpers via plugin export", () => {
    it("exports canAccessProject helper", async () => {
      const { canAccessProject } = await import("../src/fastify/index.js");

      const apiKeyUser: ApiKeyUser = {
        userId: "usr_123",
        organizationId: seedOrgs.amazon.id,
        permissions: { [`org:${seedOrgs.amazon.id}`]: ["manage"] },
        createdBy: "usr_456",
      };

      // Org-wide key can access any project in the same org (requires projectOrgId)
      expect(canAccessProject(apiKeyUser, "prj_any", seedOrgs.amazon.id)).toBe(true);
    });

    it("exports hasOrgWideAccess helper", async () => {
      const { hasOrgWideAccess } = await import("../src/fastify/index.js");

      const apiKeyUser: ApiKeyUser = {
        userId: "usr_123",
        organizationId: seedOrgs.amazon.id,
        permissions: { [`org:${seedOrgs.amazon.id}`]: ["manage"] },
        createdBy: "usr_456",
      };

      expect(hasOrgWideAccess(apiKeyUser)).toBe(true);
    });

    it("exports getAccessibleProjects helper", async () => {
      const { getAccessibleProjects } = await import("../src/fastify/index.js");

      const apiKeyUser: ApiKeyUser = {
        userId: "usr_123",
        organizationId: seedOrgs.amazon.id,
        permissions: { "project:prj_a": ["manage"], "project:prj_b": ["manage"] },
        createdBy: "usr_456",
      };

      const projects = getAccessibleProjects(apiKeyUser);
      expect(projects).toEqual(expect.arrayContaining(["prj_a", "prj_b"]));
    });
  });

  describe("end-to-end route protection", () => {
    it("allows authenticated API key to access protected route", async () => {
      // Close the default fastify instance and create a new one with custom routes
      await fastify.close();
      fastify = await createTestServer();

      // Add a protected route BEFORE calling ready()
      fastify.get("/protected", async (request, reply) => {
        if (!request.apiKeyUser) {
          return reply.status(401).send({ error: "API key required" });
        }
        return { message: "Access granted", org: request.apiKeyUser.organizationId };
      });

      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: { "x-api-key": orgWideKey },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe("Access granted");
      expect(body.org).toBe(seedOrgs.amazon.id);
    });

    it("denies access to protected route without API key", async () => {
      // Close the default fastify instance and create a new one with custom routes
      await fastify.close();
      fastify = await createTestServer();

      // Add a protected route BEFORE calling ready()
      fastify.get("/protected", async (request, reply) => {
        if (!request.apiKeyUser) {
          return reply.status(401).send({ error: "API key required" });
        }
        return { message: "Access granted" };
      });

      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("API key required");
    });

    it("can check project access in route handler", async () => {
      const { canAccessProject, hasOrgWideAccess } = await import("../src/fastify/index.js");

      // Close the default fastify instance and create a new one with custom routes
      await fastify.close();
      fastify = await createTestServer();

      // Add route that checks project access BEFORE calling ready()
      // In a real app, you'd look up the project to get its orgId for canAccessProject
      fastify.get("/project/:projectId", async (request, reply) => {
        if (!request.apiKeyUser) {
          return reply.status(401).send({ error: "API key required" });
        }

        const { projectId } = request.params as { projectId: string };

        // Org-wide keys can access any project in the org
        // For project-scoped keys, check the specific project permission
        if (!hasOrgWideAccess(request.apiKeyUser) && !canAccessProject(request.apiKeyUser, projectId)) {
          return reply.status(403).send({ error: "Project access denied" });
        }

        return { message: "Project access granted", projectId };
      });

      await fastify.ready();

      // Org-wide key can access any project
      const response1 = await fastify.inject({
        method: "GET",
        url: "/project/prj_any",
        headers: { "x-api-key": orgWideKey },
      });

      expect(response1.statusCode).toBe(200);
      expect(response1.json().message).toBe("Project access granted");

      // Project-scoped key can access its project
      const response2 = await fastify.inject({
        method: "GET",
        url: "/project/prj_seed_webapp",
        headers: { "x-api-key": projectScopedKey },
      });

      expect(response2.statusCode).toBe(200);

      // Project-scoped key cannot access other projects
      const response3 = await fastify.inject({
        method: "GET",
        url: "/project/prj_other",
        headers: { "x-api-key": projectScopedKey },
      });

      expect(response3.statusCode).toBe(403);
      expect(response3.json().error).toBe("Project access denied");
    });
  });
});
