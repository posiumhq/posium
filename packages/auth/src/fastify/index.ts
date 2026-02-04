/**
 * Fastify API Key Authentication Plugin
 *
 * This plugin provides API key authentication middleware for Fastify:
 * - Verifies API keys from x-api-key header
 * - Attaches user/permissions to request context
 * - Supports org-level API keys via service account pattern
 * - Falls through to session auth when no API key is provided
 *
 * @see .claude/skills/foundations/betterauth.md for implementation patterns
 */

import type { FastifyPluginCallback } from "fastify";
import fp from "fastify-plugin";
import type { Auth } from "../server/index.js";
import { parseApiKeyMetadata } from "../server/api-key-utils.js";

export interface ApiKeyPluginOptions {
  /** The auth instance to use for verification */
  auth: Auth;
}

/**
 * API key user context attached to requests authenticated via API key.
 */
export interface ApiKeyUser {
  /** The service user ID that owns the key */
  userId: string;
  /** The organization this key belongs to */
  organizationId: string;
  /** The key's permissions (e.g., { "org:org_123": ["manage"] }) */
  permissions: Record<string, string[]>;
  /** The user ID who created this key */
  createdBy: string;
}

// Extend FastifyRequest to include apiKeyUser
declare module "fastify" {
  interface FastifyRequest {
    apiKeyUser?: ApiKeyUser;
  }
}

/**
 * Fastify plugin for API key authentication.
 *
 * Registers a preHandler hook that:
 * 1. Extracts the API key from the `x-api-key` header
 * 2. Verifies the key using BetterAuth's verifyApiKey
 * 3. Attaches ApiKeyUser to request on success
 * 4. Returns 401 on invalid/expired/disabled keys
 *
 * When no API key header is present, the request falls through
 * to allow session-based authentication.
 *
 * @example
 * ```ts
 * import { apiKeyPlugin } from "@posium/auth/fastify";
 * import { auth } from "./auth";
 *
 * fastify.register(apiKeyPlugin, { auth });
 *
 * // In routes, check request.apiKeyUser
 * fastify.get("/api/runs", async (request) => {
 *   if (request.apiKeyUser) {
 *     // Authenticated via API key
 *     const orgId = request.apiKeyUser.organizationId;
 *   }
 * });
 * ```
 */
const apiKeyPluginCallback: FastifyPluginCallback<ApiKeyPluginOptions> = (
  fastify,
  opts,
  done
) => {
  fastify.addHook("preHandler", async (request, reply) => {
    // Extract API key from header (case-insensitive in HTTP)
    const apiKey = request.headers["x-api-key"] as string | undefined;

    // No API key - fall through to session auth
    if (!apiKey) return;

    // Verify the key with error handling
    let result;
    try {
      result = await opts.auth.api.verifyApiKey({
        body: { key: apiKey },
      });
    } catch (error) {
      // Log the error for debugging but don't expose details to client
      request.log.error({ err: error }, "API key verification error");
      return reply.status(500).send({
        error: "API key verification failed",
        message: "An error occurred while verifying the API key",
        requestId: request.id,
      });
    }

    if (!result.valid) {
      return reply.status(401).send({
        error: "Invalid API key",
        message: "The provided API key is invalid, expired, or disabled",
        requestId: request.id,
      });
    }

    // Extract key data from result
    // verifyApiKey returns { valid, error, key } - key contains the full key record
    const keyData = result.key;

    if (!keyData) {
      return reply.status(401).send({
        error: "Invalid API key",
        message: "API key data could not be retrieved",
        requestId: request.id,
      });
    }

    // Parse metadata from the key record
    // Handle both string (from DB) and object (from memory) formats
    let metadata;
    if (typeof keyData.metadata === "string") {
      metadata = parseApiKeyMetadata(keyData.metadata);
    } else if (keyData.metadata && typeof keyData.metadata === "object") {
      // Already an object, use directly (avoid stringify/parse round-trip)
      metadata = keyData.metadata as Partial<{
        organizationId: string;
        createdBy: string;
        suffix: string;
        scope: "org" | "project";
        projects: string[];
      }>;
    } else {
      metadata = {};
    }

    // Validate required metadata fields
    // API keys must be associated with an organization and creator
    if (!metadata.organizationId || !metadata.createdBy) {
      return reply.status(401).send({
        error: "Invalid API key metadata",
        message: "API key is missing required organization information",
        requestId: request.id,
      });
    }

    // Parse permissions with error handling
    let permissions: Record<string, string[]>;
    try {
      permissions =
        typeof keyData.permissions === "string"
          ? JSON.parse(keyData.permissions)
          : keyData.permissions || {};
    } catch {
      // Malformed permissions JSON - fail safely with empty permissions
      permissions = {};
    }

    // Attach API key user to request
    request.apiKeyUser = {
      userId: keyData.userId,
      organizationId: metadata.organizationId,
      permissions,
      createdBy: metadata.createdBy,
    };
  });

  done();
};

/**
 * API key authentication plugin wrapped with fastify-plugin.
 * This breaks Fastify's encapsulation so the preHandler hook
 * applies to all routes registered after this plugin.
 */
export const apiKeyPlugin = fp(apiKeyPluginCallback, {
  name: "apiKeyPlugin",
});

// Re-export helpers for convenient access
export {
  canAccessProject,
  hasOrgWideAccess,
  getAccessibleProjects,
} from "./helpers.js";

// Re-export session plugin
export { sessionPlugin, type SessionPluginOptions, type SessionUser } from "./session.js";
