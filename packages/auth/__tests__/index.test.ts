import { describe, expect, it } from "vitest";

describe("@posium/auth", () => {
  describe("server exports", () => {
    it("exports createAuth function", async () => {
      const { createAuth } = await import("../src/server/index.js");
      expect(typeof createAuth).toBe("function");
    });

    it("exports type definitions", async () => {
      const exports = await import("../src/server/index.js");
      // Runtime exports (createAuth)
      expect(exports.createAuth).toBeDefined();
      // Type exports are compile-time only, but we verify the module loads
      expect(Object.keys(exports)).toContain("createAuth");
    });
  });

  describe("createAuth factory", () => {
    it("creates auth instance with minimal config", async () => {
      const { createAuth } = await import("../src/server/index.js");

      // Mock database - createAuth doesn't validate db at creation time
      const mockDb = {} as Parameters<typeof createAuth>[0];

      const auth = createAuth(mockDb, {
        secret: "test-secret-minimum-32-chars-long",
      });

      expect(auth).toBeDefined();
      expect(auth.api).toBeDefined();
      expect(auth.handler).toBeDefined();
    });

    it("creates auth instance with github config", async () => {
      const { createAuth } = await import("../src/server/index.js");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      const auth = createAuth(mockDb, {
        secret: "test-secret-minimum-32-chars-long",
        github: {
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
          redirectURI: "http://localhost:3000/api/auth/callback/github",
        },
      });

      expect(auth).toBeDefined();
      expect(auth.api).toBeDefined();
    });

    it("includes admin plugin capabilities", async () => {
      const { createAuth } = await import("../src/server/index.js");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      const auth = createAuth(mockDb, {
        secret: "test-secret-minimum-32-chars-long",
      });

      // Admin plugin adds these API methods
      expect(auth.api.listUsers).toBeDefined();
    });

    it("includes organization plugin capabilities", async () => {
      const { createAuth } = await import("../src/server/index.js");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      const auth = createAuth(mockDb, {
        secret: "test-secret-minimum-32-chars-long",
      });

      // Organization plugin adds these API methods
      expect(auth.api.createOrganization).toBeDefined();
      expect(auth.api.listOrganizations).toBeDefined();
    });

    it("includes apiKey plugin capabilities", async () => {
      const { createAuth } = await import("../src/server/index.js");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      const auth = createAuth(mockDb, {
        secret: "test-secret-minimum-32-chars-long",
      });

      // API key plugin adds these API methods
      expect(auth.api.createApiKey).toBeDefined();
      expect(auth.api.verifyApiKey).toBeDefined();
    });
  });

  describe("client exports", () => {
    it("exports authClient", async () => {
      const { authClient } = await import("../src/client/index.js");
      expect(authClient).toBeDefined();
    });

    it("authClient has organization plugin methods", async () => {
      const { authClient } = await import("../src/client/index.js");
      expect(authClient.organization).toBeDefined();
      expect(authClient.organization.create).toBeDefined();
      expect(authClient.organization.list).toBeDefined();
    });

    it("authClient has admin plugin methods", async () => {
      const { authClient } = await import("../src/client/index.js");
      expect(authClient.admin).toBeDefined();
      expect(authClient.admin.listUsers).toBeDefined();
    });

    it("authClient has apiKey plugin methods", async () => {
      const { authClient } = await import("../src/client/index.js");
      expect(authClient.apiKey).toBeDefined();
      expect(authClient.apiKey.create).toBeDefined();
      expect(authClient.apiKey.list).toBeDefined();
    });

    it("exports Session and User types", async () => {
      // These are type-only exports, but we verify the module structure
      const exports = await import("../src/client/index.js");
      expect(exports.authClient).toBeDefined();
      // Session and User are inferred types from authClient
    });
  });

  describe("next exports", () => {
    it("exports createGetSession function", async () => {
      const { createGetSession } = await import("../src/next/index.js");
      expect(typeof createGetSession).toBe("function");
    });

    it("exports toNextJsHandler from better-auth", async () => {
      const { toNextJsHandler } = await import("../src/next/index.js");
      expect(typeof toNextJsHandler).toBe("function");
    });

    it("createGetSession returns a function", async () => {
      const { createGetSession } = await import("../src/next/index.js");
      const { createAuth } = await import("../src/server/index.js");

      const mockDb = {} as Parameters<typeof createAuth>[0];
      const auth = createAuth(mockDb, {
        secret: "test-secret-minimum-32-chars-long",
      });

      const getSession = createGetSession(auth);
      expect(typeof getSession).toBe("function");
    });
  });

  describe("fastify exports (stub)", () => {
    it("exports apiKeyPlugin as a function", async () => {
      const { apiKeyPlugin } = await import("../src/fastify/index.js");
      expect(typeof apiKeyPlugin).toBe("function");
    });

    it("exports ApiKeyPluginOptions type", async () => {
      // Type-only export, verify module loads
      const exports = await import("../src/fastify/index.js");
      expect(exports.apiKeyPlugin).toBeDefined();
    });
  });

  describe("permissions exports (stub)", () => {
    it("exports statements as empty object placeholder", async () => {
      const { statements } = await import("../src/permissions/index.js");
      expect(statements).toBeDefined();
      expect(typeof statements).toBe("object");
    });

    it("exports roles as empty object placeholder", async () => {
      const { roles } = await import("../src/permissions/index.js");
      expect(roles).toBeDefined();
      expect(typeof roles).toBe("object");
    });
  });

  describe("root index exports", () => {
    it("re-exports server types", async () => {
      // Root index re-exports types from subpaths for convenience
      const exports = await import("../src/index.js");
      // These are type-only exports, module should load without error
      expect(exports).toBeDefined();
    });
  });

  describe("API key module exports", () => {
    it("exports API key types", async () => {
      const exports = await import("../src/server/index.js");
      // Type exports are compile-time only, verify module loads
      expect(exports).toBeDefined();
    });

    it("exports API key utility functions", async () => {
      const {
        getServiceUserEmail,
        parseApiKeyMetadata,
        parsePermissions,
        buildPermissions,
        extractProjectIds,
        hasOrgPermission,
        buildMetadata,
      } = await import("../src/server/index.js");

      expect(typeof getServiceUserEmail).toBe("function");
      expect(typeof parseApiKeyMetadata).toBe("function");
      expect(typeof parsePermissions).toBe("function");
      expect(typeof buildPermissions).toBe("function");
      expect(typeof extractProjectIds).toBe("function");
      expect(typeof hasOrgPermission).toBe("function");
      expect(typeof buildMetadata).toBe("function");
    });

    it("exports service user functions", async () => {
      const { getOrCreateServiceUser, deleteServiceUser } = await import(
        "../src/server/index.js"
      );

      expect(typeof getOrCreateServiceUser).toBe("function");
      expect(typeof deleteServiceUser).toBe("function");
    });

    it("exports authorization functions", async () => {
      const {
        isOrgAdmin,
        canAccessProjects,
        canCreateKey,
        canManageKey,
        getAccessibleProjectIds,
      } = await import("../src/server/index.js");

      expect(typeof isOrgAdmin).toBe("function");
      expect(typeof canAccessProjects).toBe("function");
      expect(typeof canCreateKey).toBe("function");
      expect(typeof canManageKey).toBe("function");
      expect(typeof getAccessibleProjectIds).toBe("function");
    });

    it("exports CRUD functions", async () => {
      const { createKey, listKeys, updateKey, deleteKey } = await import(
        "../src/server/index.js"
      );

      expect(typeof createKey).toBe("function");
      expect(typeof listKeys).toBe("function");
      expect(typeof updateKey).toBe("function");
      expect(typeof deleteKey).toBe("function");
    });

    it("exports error classes", async () => {
      const { ForbiddenError, NotFoundError, BadRequestError } = await import(
        "../src/server/index.js"
      );

      expect(ForbiddenError).toBeDefined();
      expect(NotFoundError).toBeDefined();
      expect(BadRequestError).toBeDefined();

      // Verify they can be instantiated
      const forbidden = new ForbiddenError("test");
      expect(forbidden.code).toBe("FORBIDDEN");
      expect(forbidden.message).toBe("test");

      const notFound = new NotFoundError("test");
      expect(notFound.code).toBe("NOT_FOUND");

      const badRequest = new BadRequestError("test");
      expect(badRequest.code).toBe("BAD_REQUEST");
    });
  });
});
