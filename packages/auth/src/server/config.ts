import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, apiKey, organization } from "better-auth/plugins";
import * as schema from "@posium/db/schema";
import { getEmailClient } from "@posium/email";
import { getOrCreateServiceUser } from "./service-user.js";

/**
 * Configuration options for creating an auth instance.
 */
export interface AuthConfig {
  /** Secret key for signing tokens */
  secret: string;
  /** Base URL of the application (e.g., http://localhost:3000) - required for OAuth */
  baseURL?: string;
  /** GitHub OAuth configuration (optional) */
  github?: {
    clientId: string;
    clientSecret: string;
    /** Must use capital URI - this is what Better Auth expects */
    redirectURI: string;
  };
  /** Disable API key rate limiting (useful for tests) */
  disableApiKeyRateLimit?: boolean;
  /**
   * Custom API key generator function.
   * When provided, this function is called instead of the default key generator.
   * Useful for tests to provide predictable key values.
   */
  customKeyGenerator?: (options: {
    length: number;
    prefix: string | undefined;
  }) => string;
}

/**
 * Database type expected by the auth config.
 * This matches the first parameter of drizzleAdapter.
 */
export type AuthDatabase = Parameters<typeof drizzleAdapter>[0];

/**
 * Creates a BetterAuth instance with the standard Posium configuration.
 *
 * Includes plugins:
 * - admin: User roles and admin management
 * - organization: Multi-tenancy support
 * - apiKey: API key authentication
 *
 * @example
 * ```ts
 * import { createAuth } from "@posium/auth/server";
 * import { db } from "./db";
 *
 * export const auth = createAuth(db, {
 *   secret: process.env.BETTER_AUTH_SECRET,
 *   github: {
 *     clientId: process.env.GITHUB_CLIENT_ID,
 *     clientSecret: process.env.GITHUB_CLIENT_SECRET,
 *     redirectUri: "http://localhost:3000/api/auth/callback/github",
 *   },
 * });
 * ```
 */
export function createAuth(db: AuthDatabase, config: AuthConfig) {
  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.baseURL ? [config.baseURL] : [],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        // Core auth tables
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        // Organization plugin tables
        organization: schema.org,
        member: schema.orgMember,
        invitation: schema.invitation,
        // API key plugin table
        apikey: schema.apikey,
        // Relations for experimental joins feature
        userRelations: schema.userRelations,
        sessionRelations: schema.sessionRelations,
        accountRelations: schema.accountRelations,
        organizationRelations: schema.orgRelations,
        memberRelations: schema.orgMemberRelations,
        invitationRelations: schema.invitationRelations,
        apikeyRelations: schema.apikeyRelations,
      },
    }),
    experimental: {
      joins: true,
    },
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        const email = getEmailClient();
        await email.sendPasswordReset(user.email, {
          userName: user.name || "User",
          resetUrl: url,
          expiresInMinutes: 60,
        });
      },
    },
    socialProviders: config.github
      ? {
          github: {
            clientId: config.github.clientId,
            clientSecret: config.github.clientSecret,
            redirectURI: config.github.redirectURI,
          },
        }
      : undefined,
    plugins: [
      admin({
        defaultRole: "user",
      }),
      organization({
        allowUserToCreateOrganization: true,

        cancelPendingInvitationsOnReInvite: true,
        async sendInvitationEmail(data) {
          const email = getEmailClient();
          const baseUrl = config.baseURL || "http://localhost:3000";
          const inviteUrl = `${baseUrl}/auth/accept-invitation?invitationId=${data.id}`;

          await email.sendOrgInvite(data.email, {
            inviterName: data.inviter.user.name || "A team member",
            orgName: data.organization.name,
            inviteUrl,
            expiresInDays: 7,
          });
        },
        // Create service account when organization is created
        organizationHooks: {
          afterCreateOrganization: async ({ organization: org }) => {
            // db is available from createAuth closure
            await getOrCreateServiceUser(org.id, db);
          },
        },
        schema: {
          session: {
            fields: {
              activeOrganizationId: "activeOrgId",
            },
          },
          member: {
            fields: {
              organizationId: "orgId",
            },
          },
          invitation: {
            fields: {
              organizationId: "orgId",
            },
          },
        },
      }),
      apiKey({
        enableMetadata: true,
        // Disable rate limiting when configured (useful for tests)
        rateLimit: config.disableApiKeyRateLimit
          ? { enabled: false }
          : undefined,
        // Custom key generator for deterministic test keys
        // Only include if provided to avoid overriding default behavior
        ...(config.customKeyGenerator && {
          customKeyGenerator: config.customKeyGenerator,
        }),
      }),
      // nextCookies must be last - enables cookie setting in Next.js server actions
      nextCookies(),
    ],
  });
}

/** Type of the auth instance returned by createAuth */
export type Auth = ReturnType<typeof createAuth>;

/** Session type inferred from the auth instance */
export type ServerSession = Auth["$Infer"]["Session"];
