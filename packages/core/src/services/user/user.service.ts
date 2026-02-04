/**
 * UserService - User preferences management business logic.
 *
 * Handles user-level and org-member-level preference operations.
 */

import { eq, and } from "drizzle-orm";
import { schema } from "@posium/db";
import type { ServiceContext } from "../../context.js";
import { requireActorUserId, isSystemActor } from "../../context.js";
import { ForbiddenError } from "../../errors.js";
import type {
  UserPreferences,
  OrgMemberPreferences,
  UpdateUserPreferencesInput,
  UpdateOrgMemberPreferencesInput,
  UserInfo,
} from "./user.types.js";

/**
 * Default user preferences.
 */
const DEFAULT_USER_PREFS: UserPreferences = {
  theme: "system",
};

/**
 * Default org member preferences.
 */
const DEFAULT_ORG_MEMBER_PREFS: OrgMemberPreferences = {};

/**
 * UserService interface.
 */
export interface UserService {
  /** Get current user's preferences */
  getPreferences(ctx: ServiceContext): Promise<UserPreferences>;

  /** Update current user's preferences (merges with existing) */
  updatePreferences(ctx: ServiceContext, input: UpdateUserPreferencesInput): Promise<UserPreferences>;

  /** Get org member preferences for the current user in an org */
  getOrgPreferences(ctx: ServiceContext, orgId: string): Promise<OrgMemberPreferences>;

  /** Update org member preferences for the current user in an org */
  updateOrgPreferences(
    ctx: ServiceContext,
    orgId: string,
    input: UpdateOrgMemberPreferencesInput
  ): Promise<OrgMemberPreferences>;

  /**
   * Get user info by org member ID.
   * System-actor-only - used for notification jobs and internal operations.
   */
  getByOrgMemberId(ctx: ServiceContext, orgMemberId: string): Promise<UserInfo | null>;
}

/**
 * Get the org member ID for the current user in an org.
 */
async function getOrgMemberIdForUser(
  ctx: ServiceContext,
  userId: string,
  orgId: string
): Promise<string> {
  // Note: No soft delete filter since we now use hard deletes for members
  const [member] = await ctx.db
    .select({ id: schema.orgMember.id })
    .from(schema.orgMember)
    .where(
      and(
        eq(schema.orgMember.userId, userId),
        eq(schema.orgMember.orgId, orgId)
      )
    )
    .limit(1);

  if (!member) {
    throw new ForbiddenError("You are not a member of this organization");
  }

  return member.id;
}

/**
 * Creates a UserService instance.
 */
export function createUserService(): UserService {
  return {
    async getPreferences(ctx) {
      const userId = requireActorUserId(ctx.actor);

      const [prefs] = await ctx.db
        .select({ prefs: schema.userPreferences.prefs })
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, userId))
        .limit(1);

      return (prefs?.prefs as UserPreferences) ?? DEFAULT_USER_PREFS;
    },

    async updatePreferences(ctx, input) {
      const userId = requireActorUserId(ctx.actor);
      const now = new Date();

      // Get existing preferences to merge with
      const [existing] = await ctx.db
        .select({ prefs: schema.userPreferences.prefs })
        .from(schema.userPreferences)
        .where(eq(schema.userPreferences.userId, userId))
        .limit(1);

      // Merge with existing or defaults
      const currentPrefs = (existing?.prefs as UserPreferences) ?? DEFAULT_USER_PREFS;
      const newPrefs = { ...currentPrefs, ...input } as UserPreferences;

      // Atomic upsert to prevent race conditions
      await ctx.db
        .insert(schema.userPreferences)
        .values({
          userId,
          prefs: newPrefs as typeof schema.userPreferences.$inferInsert.prefs,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.userPreferences.userId,
          set: {
            prefs: newPrefs as typeof schema.userPreferences.$inferInsert.prefs,
            updatedAt: now,
          },
        });

      return newPrefs;
    },

    async getOrgPreferences(ctx, orgId) {
      const userId = requireActorUserId(ctx.actor);

      // Verify user is a member of the org and get their member ID
      const orgMemberId = await getOrgMemberIdForUser(ctx, userId, orgId);

      const [prefs] = await ctx.db
        .select({ prefs: schema.orgMemberPreferences.prefs })
        .from(schema.orgMemberPreferences)
        .where(eq(schema.orgMemberPreferences.orgMemberId, orgMemberId))
        .limit(1);

      return (prefs?.prefs as OrgMemberPreferences) ?? DEFAULT_ORG_MEMBER_PREFS;
    },

    async updateOrgPreferences(ctx, orgId, input) {
      const userId = requireActorUserId(ctx.actor);
      const now = new Date();

      // Verify user is a member of the org and get their member ID
      const orgMemberId = await getOrgMemberIdForUser(ctx, userId, orgId);

      // Get existing preferences to merge with
      const [existing] = await ctx.db
        .select({ prefs: schema.orgMemberPreferences.prefs })
        .from(schema.orgMemberPreferences)
        .where(eq(schema.orgMemberPreferences.orgMemberId, orgMemberId))
        .limit(1);

      // Merge with existing or defaults
      const currentPrefs = (existing?.prefs as OrgMemberPreferences) ?? DEFAULT_ORG_MEMBER_PREFS;
      const newPrefs = { ...currentPrefs, ...input } as OrgMemberPreferences;

      // Atomic upsert to prevent race conditions
      await ctx.db
        .insert(schema.orgMemberPreferences)
        .values({
          orgMemberId,
          prefs: newPrefs as typeof schema.orgMemberPreferences.$inferInsert.prefs,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.orgMemberPreferences.orgMemberId,
          set: {
            prefs: newPrefs as typeof schema.orgMemberPreferences.$inferInsert.prefs,
            updatedAt: now,
          },
        });

      return newPrefs;
    },

    async getByOrgMemberId(ctx, orgMemberId) {
      // Require system actor - this is for internal use only (e.g., notification jobs)
      if (!isSystemActor(ctx.actor)) {
        throw new ForbiddenError("This operation requires system access");
      }

      // Note: No soft delete filter on orgMember since we now use hard deletes
      const [result] = await ctx.db
        .select({
          userId: schema.user.id,
          userName: schema.user.name,
          userEmail: schema.user.email,
        })
        .from(schema.orgMember)
        .innerJoin(schema.user, eq(schema.orgMember.userId, schema.user.id))
        .where(eq(schema.orgMember.id, orgMemberId))
        .limit(1);

      return result ?? null;
    },
  };
}
