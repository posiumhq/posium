/**
 * Fastify Session Authentication Plugin
 *
 * This plugin provides session-based authentication for Fastify:
 * - Validates BetterAuth sessions from cookies
 * - Attaches session and user to request context
 * - Works with cross-origin requests when properly configured
 *
 * @see .claude/skills/foundations/betterauth.md for implementation patterns
 */

import type { FastifyPluginCallback } from "fastify";
import fp from "fastify-plugin";
import type { Auth, ServerSession } from "../server/index.js";

export interface SessionPluginOptions {
  /** The auth instance to use for session validation */
  auth: Auth;
  /** Whether authentication is required (returns 401 if no session) */
  required?: boolean;
}

/**
 * Session user context attached to authenticated requests.
 */
export interface SessionUser {
  /** The user ID */
  userId: string;
  /** The user's email */
  email: string;
  /** The user's name */
  name: string | null;
  /** The active organization ID (if any) */
  activeOrganizationId: string | null;
  /** The full session object */
  session: ServerSession;
}

// Extend FastifyRequest to include sessionUser
declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}

/**
 * Fastify plugin for BetterAuth session authentication.
 *
 * Registers a preHandler hook that:
 * 1. Extracts cookies from the request
 * 2. Validates the session using BetterAuth's getSession
 * 3. Attaches SessionUser to request on success
 * 4. Optionally returns 401 if no session and required=true
 *
 * @example
 * ```ts
 * import { sessionPlugin } from "@posium/auth/fastify";
 * import { auth } from "./auth";
 *
 * fastify.register(sessionPlugin, { auth, required: true });
 *
 * // In routes, check request.sessionUser
 * fastify.get("/api/profile", async (request) => {
 *   if (request.sessionUser) {
 *     return { user: request.sessionUser };
 *   }
 * });
 * ```
 */
const sessionPluginCallback: FastifyPluginCallback<SessionPluginOptions> = (
  fastify,
  opts,
  done
) => {
  const { auth, required = false } = opts;

  fastify.addHook("preHandler", async (request, reply) => {
    try {
      // Convert Fastify headers to standard Headers object for BetterAuth
      const headers = new Headers();

      // Forward all headers, especially cookies
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      // Get session from BetterAuth
      const session = await auth.api.getSession({
        headers,
      });

      if (!session) {
        if (required) {
          return reply.status(401).send({
            error: "Unauthorized",
            message: "Authentication required",
            requestId: request.id,
          });
        }
        // No session but not required - continue without auth
        return;
      }

      // Attach session user to request
      request.sessionUser = {
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        activeOrganizationId: session.session.activeOrganizationId ?? null,
        session,
      };
    } catch (error) {
      request.log.error({ err: error }, "Session validation error");

      if (required) {
        return reply.status(401).send({
          error: "Authentication failed",
          message: "Session validation failed",
          requestId: request.id,
        });
      }
    }
  });

  done();
};

/**
 * Session authentication plugin wrapped with fastify-plugin.
 * This breaks Fastify's encapsulation so the preHandler hook
 * applies to all routes registered after this plugin.
 */
export const sessionPlugin = fp(sessionPluginCallback, {
  name: "sessionPlugin",
});
