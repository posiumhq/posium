/**
 * OrgService - Organization management business logic.
 *
 * Handles CRUD operations for organizations and member management.
 */

import { eq, and, isNull, inArray, count, ne } from "drizzle-orm";
import { schema } from "@posium/db";
import { publish, EVENTS } from "@posium/appevents";
import type { ServiceContext, OrgRole } from "../../context.js";
import { getActorUserId, requireActorUserId, isSystemActor } from "../../context.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../../errors.js";
import { requireOrgMembership } from "../../auth/membership.js";
import type {
  Org,
  OrgWithRole,
  OrgWithStats,
  CreateOrgInput,
  UpdateOrgInput,
  OrgMember,
  ListMembersOptions,
  AddMemberInput,
  UpdateMemberRoleInput,
  RemoveMemberInput,
  OrgInfo,
  CreateInvitationInput,
  PendingInvitation,
  CancelInvitationInput,
} from "./org.types.js";

/**
 * Check if an error is a BetterAuth API error with a specific code.
 */
function isBetterAuthError(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "body" in error &&
    error.body !== null &&
    typeof error.body === "object" &&
    "code" in error.body &&
    error.body.code === code
  );
}

/**
 * OrgService interface.
 */
export interface OrgService {
  /** List all organizations the current user is a member of */
  list(ctx: ServiceContext): Promise<OrgWithStats[]>;

  /** Get a single organization by ID */
  getById(ctx: ServiceContext, id: string): Promise<OrgWithRole>;

  /** Create a new organization (creator becomes owner) */
  create(ctx: ServiceContext, input: CreateOrgInput): Promise<Org>;

  /** Update an organization (requires admin role) */
  update(ctx: ServiceContext, id: string, input: UpdateOrgInput): Promise<Org>;

  /** Soft delete an organization (requires owner role) */
  delete(ctx: ServiceContext, id: string): Promise<void>;

  /** List members of an organization */
  getMembers(ctx: ServiceContext, options: ListMembersOptions): Promise<OrgMember[]>;

  /** Add a member to an organization (requires admin role) */
  addMember(ctx: ServiceContext, input: AddMemberInput): Promise<OrgMember>;

  /** Update a member's role (requires admin role) */
  updateMemberRole(ctx: ServiceContext, input: UpdateMemberRoleInput): Promise<OrgMember>;

  /** Remove a member from an organization (requires admin role) */
  removeMember(ctx: ServiceContext, input: RemoveMemberInput): Promise<void>;

  /**
   * Get org info by org member ID.
   * System-actor-only - used for notification jobs and internal operations.
   */
  getByMemberId(ctx: ServiceContext, orgMemberId: string): Promise<OrgInfo | null>;

  /** Create an invitation to join an organization (requires admin role) */
  createInvitation(ctx: ServiceContext, input: CreateInvitationInput): Promise<{ id: string }>;

  /** Get pending invitations for an organization (requires membership) */
  getPendingInvitations(ctx: ServiceContext, orgId: string): Promise<PendingInvitation[]>;

  /** Cancel a pending invitation (requires admin role) */
  cancelInvitation(ctx: ServiceContext, input: CancelInvitationInput): Promise<void>;
}

/**
 * Creates an OrgService instance.
 */
export function createOrgService(): OrgService {
  return {
    async list(ctx) {
      const userId = getActorUserId(ctx.actor);
      if (!userId) {
        return []; // System actors don't have org memberships
      }

      // Get all org memberships for this user
      // Note: No soft delete filter since we now use hard deletes for members
      const memberships = await ctx.db
        .select({
          orgId: schema.orgMember.orgId,
          role: schema.orgMember.role,
        })
        .from(schema.orgMember)
        .where(eq(schema.orgMember.userId, userId));

      if (memberships.length === 0) {
        return [];
      }

      const orgIds = memberships.map((m) => m.orgId);

      // Get the orgs
      const orgs = await ctx.db
        .select()
        .from(schema.org)
        .where(
          and(
            inArray(schema.org.id, orgIds),
            isNull(schema.org.deletedAt)
          )
        );

      // Get project counts for all orgs in a single query
      const projectCounts = await ctx.db
        .select({
          orgId: schema.project.orgId,
          count: count(),
        })
        .from(schema.project)
        .where(
          and(
            inArray(schema.project.orgId, orgIds),
            isNull(schema.project.deletedAt)
          )
        )
        .groupBy(schema.project.orgId);

      // Get member counts for all orgs in a single query
      // Note: No soft delete filter since we now use hard deletes for members
      const memberCounts = await ctx.db
        .select({
          orgId: schema.orgMember.orgId,
          count: count(),
        })
        .from(schema.orgMember)
        .where(inArray(schema.orgMember.orgId, orgIds))
        .groupBy(schema.orgMember.orgId);

      // Combine data
      return orgs.map((org) => {
        const membership = memberships.find((m) => m.orgId === org.id);
        const projectCountRow = projectCounts.find((p) => p.orgId === org.id);
        const memberCountRow = memberCounts.find((m) => m.orgId === org.id);

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          role: (membership?.role ?? "member") as OrgRole,
          projectCount: Number(projectCountRow?.count ?? 0),
          memberCount: Number(memberCountRow?.count ?? 0),
        };
      });
    },

    async getById(ctx, id) {
      // Check membership (will throw if not a member)
      const role = await requireOrgMembership(ctx, id);

      const [org] = await ctx.db
        .select()
        .from(schema.org)
        .where(and(eq(schema.org.id, id), isNull(schema.org.deletedAt)))
        .limit(1);

      if (!org) {
        throw new NotFoundError("Organization", id);
      }

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        role,
      };
    },

    async create(ctx, input) {
      const userId = requireActorUserId(ctx.actor);

      if (!ctx.auth) {
        throw new Error("Auth instance required for organization creation");
      }

      // Use BetterAuth API for org creation
      // This automatically:
      // - Checks slug uniqueness
      // - Creates org record
      // - Creates orgMember with owner role
      // - Fires afterCreateOrganization hook (creates service account)
      let newOrg;
      try {
        newOrg = await ctx.auth.api.createOrganization({
          body: {
            name: input.name,
            slug: input.slug,
            logo: input.logo,
            userId, // Creator becomes owner
          },
        });
      } catch (error) {
        // Convert BetterAuth APIError to our ConflictError for slug conflicts
        if (
          error &&
          typeof error === "object" &&
          "body" in error &&
          error.body &&
          typeof error.body === "object" &&
          "code" in error.body &&
          error.body.code === "ORGANIZATION_ALREADY_EXISTS"
        ) {
          throw new ConflictError("Organization slug is already taken");
        }
        throw error;
      }

      if (!newOrg) {
        throw new Error("Failed to create organization");
      }

      // Publish our custom event for pgBoss subscribers
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ORG_CREATED_V1, {
          orgId: newOrg.id,
          name: newOrg.name,
          createdByUserId: userId,
        });
      }

      return {
        id: newOrg.id,
        name: newOrg.name,
        slug: newOrg.slug,
        logo: newOrg.logo ?? null, // Convert undefined to null for Org type
      };
    },

    async update(ctx, id, input) {
      // Require admin role
      await requireOrgMembership(ctx, id, "admin");

      // Check slug uniqueness if changing
      if (input.slug) {
        const [existing] = await ctx.db
          .select({ id: schema.org.id })
          .from(schema.org)
          .where(and(eq(schema.org.slug, input.slug), isNull(schema.org.deletedAt)))
          .limit(1);

        if (existing && existing.id !== id) {
          throw new ConflictError("Organization slug is already taken");
        }
      }

      const [updated] = await ctx.db
        .update(schema.org)
        .set({
          ...(input.name && { name: input.name }),
          ...(input.slug && { slug: input.slug }),
          ...(input.logo !== undefined && { logo: input.logo }),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.org.id, id), isNull(schema.org.deletedAt)))
        .returning();

      if (!updated) {
        throw new NotFoundError("Organization", id);
      }

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        logo: updated.logo,
      };
    },

    async delete(ctx, id) {
      const userId = requireActorUserId(ctx.actor);

      // Require owner role
      await requireOrgMembership(ctx, id, "owner");

      const [org] = await ctx.db
        .select()
        .from(schema.org)
        .where(and(eq(schema.org.id, id), isNull(schema.org.deletedAt)))
        .limit(1);

      if (!org) {
        throw new NotFoundError("Organization", id);
      }

      // Soft delete
      await ctx.db
        .update(schema.org)
        .set({ deletedAt: new Date() })
        .where(eq(schema.org.id, id));

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ORG_DELETED_V1, {
          orgId: id,
          deletedByUserId: userId,
        });
      }
    },

    async getMembers(ctx, options) {
      const { orgId } = options;

      // Check membership
      await requireOrgMembership(ctx, orgId);

      // Note: No soft delete filter since we now use hard deletes for members
      const memberships = await ctx.db
        .select({
          id: schema.orgMember.id,
          userId: schema.orgMember.userId,
          orgId: schema.orgMember.orgId,
          role: schema.orgMember.role,
          createdAt: schema.orgMember.createdAt,
          user: {
            id: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            image: schema.user.image,
          },
        })
        .from(schema.orgMember)
        .innerJoin(schema.user, eq(schema.orgMember.userId, schema.user.id))
        .where(
          and(
            eq(schema.orgMember.orgId, orgId),
            ne(schema.orgMember.role, "service")
          )
        );

      return memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        orgId: m.orgId,
        role: m.role as OrgRole,
        user: m.user,
        createdAt: m.createdAt,
      }));
    },

    async addMember(ctx, input) {
      const { orgId, userId, role } = input;
      const actorUserId = requireActorUserId(ctx.actor);

      // Require admin role
      await requireOrgMembership(ctx, orgId, "admin");

      // Require auth instance for BetterAuth API calls
      if (!ctx.auth) {
        throw new Error("Auth instance required for member operations");
      }

      // Use BetterAuth API to add member
      // This handles: user validation, duplicate check
      let newMember;
      try {
        newMember = await ctx.auth.api.addMember({
          body: {
            userId,
            role,
            organizationId: orgId,
          },
        });
      } catch (error) {
        // Map BetterAuth errors to our error types
        if (isBetterAuthError(error, "USER_NOT_FOUND")) {
          throw new NotFoundError("User", userId);
        }
        if (isBetterAuthError(error, "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION")) {
          throw new ConflictError("User is already a member of this organization");
        }
        throw error;
      }

      if (!newMember) {
        throw new Error("Failed to add member");
      }

      // Get user info for response (BetterAuth doesn't return full user)
      const [user] = await ctx.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .limit(1);

      if (!user) {
        throw new Error(`User ${userId} not found - data integrity issue`);
      }

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ORG_MEMBER_ADDED_V1, {
          orgId,
          userId,
          role,
          addedByUserId: actorUserId,
        });
      }

      return {
        id: newMember.id,
        userId: newMember.userId,
        orgId: newMember.organizationId,
        role: newMember.role as OrgRole,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
        createdAt: newMember.createdAt,
      };
    },

    async updateMemberRole(ctx, input) {
      const { orgId, memberId, role } = input;

      // Require admin role
      await requireOrgMembership(ctx, orgId, "admin");

      // Get the member
      // Note: No soft delete filter since we now use hard deletes for members
      const [member] = await ctx.db
        .select()
        .from(schema.orgMember)
        .where(
          and(
            eq(schema.orgMember.id, memberId),
            eq(schema.orgMember.orgId, orgId)
          )
        )
        .limit(1);

      if (!member) {
        throw new NotFoundError("Member", memberId);
      }

      // Cannot modify service account
      if (member.role === "service") {
        throw new ForbiddenError("Cannot modify service account");
      }

      // Cannot change owner role (need to transfer ownership separately)
      if (member.role === "owner" && role !== "owner") {
        throw new ForbiddenError("Cannot demote the organization owner");
      }

      // Cannot promote to owner (ownership transfer requires separate action)
      if (role === "owner") {
        throw new ForbiddenError("Cannot promote to owner role. Only the current owner can transfer ownership.");
      }

      // Update role directly
      // Note: BetterAuth's updateMemberRole requires session headers, so we use direct DB
      const [updated] = await ctx.db
        .update(schema.orgMember)
        .set({ role, updatedAt: new Date() })
        .where(eq(schema.orgMember.id, memberId))
        .returning();

      if (!updated) {
        throw new Error("Failed to update member role");
      }

      // Get user info (should always exist due to FK constraint)
      const [user] = await ctx.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, updated.userId))
        .limit(1);

      if (!user) {
        throw new Error(`User ${updated.userId} not found - data integrity issue`);
      }

      return {
        id: updated.id,
        userId: updated.userId,
        orgId: updated.orgId,
        role: updated.role as OrgRole,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
        createdAt: updated.createdAt,
      };
    },

    async removeMember(ctx, input) {
      const { orgId, memberId } = input;
      const actorUserId = requireActorUserId(ctx.actor);

      // Require admin role
      await requireOrgMembership(ctx, orgId, "admin");

      // Get the member
      // Note: No soft delete filter since we now use hard deletes for members
      const [member] = await ctx.db
        .select()
        .from(schema.orgMember)
        .where(
          and(
            eq(schema.orgMember.id, memberId),
            eq(schema.orgMember.orgId, orgId)
          )
        )
        .limit(1);

      if (!member) {
        throw new NotFoundError("Member", memberId);
      }

      // Cannot remove owner
      if (member.role === "owner") {
        throw new ForbiddenError("Cannot remove the organization owner");
      }

      // Cannot remove service account
      if (member.role === "service") {
        throw new ForbiddenError("Cannot remove service account");
      }

      // Delete related records first to satisfy FK constraints
      // Order matters: rules reference channels, so delete rules first
      await ctx.db
        .delete(schema.orgMemberNotifRule)
        .where(eq(schema.orgMemberNotifRule.orgMemberId, memberId));
      await ctx.db
        .delete(schema.orgMemberNotifChannel)
        .where(eq(schema.orgMemberNotifChannel.orgMemberId, memberId));
      await ctx.db
        .delete(schema.orgMemberPreferences)
        .where(eq(schema.orgMemberPreferences.orgMemberId, memberId));
      await ctx.db
        .delete(schema.projectMember)
        .where(eq(schema.projectMember.orgMemberId, memberId));

      // Hard delete the member directly
      // Note: BetterAuth's removeMember requires session headers, so we use direct DB
      await ctx.db
        .delete(schema.orgMember)
        .where(eq(schema.orgMember.id, memberId));

      // Publish event
      if (ctx.boss) {
        await publish(ctx.boss, EVENTS.ORG_MEMBER_REMOVED_V1, {
          orgId,
          userId: member.userId,
          removedByUserId: actorUserId,
        });
      }
    },

    async getByMemberId(ctx, orgMemberId) {
      // Require system actor - this is for internal use only (e.g., notification jobs)
      if (!isSystemActor(ctx.actor)) {
        throw new ForbiddenError("This operation requires system access");
      }

      // Note: No soft delete filter on orgMember since we now use hard deletes
      const [result] = await ctx.db
        .select({
          orgId: schema.org.id,
          orgName: schema.org.name,
          orgSlug: schema.org.slug,
        })
        .from(schema.orgMember)
        .innerJoin(schema.org, eq(schema.orgMember.orgId, schema.org.id))
        .where(
          and(
            eq(schema.orgMember.id, orgMemberId),
            isNull(schema.org.deletedAt)
          )
        )
        .limit(1);

      return result ?? null;
    },

    async createInvitation(ctx, input) {
      const { orgId, email, role } = input;

      // Require admin role
      await requireOrgMembership(ctx, orgId, "admin");

      // Require auth instance and headers for BetterAuth API calls
      if (!ctx.auth) {
        throw new Error("Auth instance required for invitation operations");
      }
      if (!ctx.headers) {
        throw new Error("Headers required for invitation operations");
      }

      // Use BetterAuth API to create invitation
      const result = await ctx.auth.api.createInvitation({
        body: {
          organizationId: orgId,
          email,
          role,
        },
        headers: ctx.headers,
      });

      if (!result) {
        throw new Error("Failed to create invitation");
      }

      return { id: result.id };
    },

    async getPendingInvitations(ctx, orgId) {
      // Check membership
      await requireOrgMembership(ctx, orgId);

      // Require auth instance and headers for BetterAuth API calls
      if (!ctx.auth) {
        throw new Error("Auth instance required for invitation operations");
      }
      if (!ctx.headers) {
        throw new Error("Headers required for invitation operations");
      }

      // Use BetterAuth API to list invitations
      const invitations = await ctx.auth.api.listInvitations({
        query: { organizationId: orgId },
        headers: ctx.headers,
      });

      // Filter for pending only and map to expected format
      const pendingInvitations: PendingInvitation[] = (invitations ?? [])
        .filter((inv: { status: string }) => inv.status === "pending")
        .map(
          (inv: {
            id: string;
            email: string;
            role: string | null;
            status: string;
            expiresAt: Date;
            createdAt: Date;
            inviter?: { id?: string; name?: string | null; email?: string };
          }) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role,
            status: inv.status,
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt,
            inviter: {
              id: inv.inviter?.id ?? "",
              name: inv.inviter?.name ?? null,
              email: inv.inviter?.email ?? "",
            },
          })
        );

      return pendingInvitations;
    },

    async cancelInvitation(ctx, input) {
      const { orgId, invitationId } = input;

      // Require admin role
      await requireOrgMembership(ctx, orgId, "admin");

      // Require auth instance and headers for BetterAuth API calls
      if (!ctx.auth) {
        throw new Error("Auth instance required for invitation operations");
      }
      if (!ctx.headers) {
        throw new Error("Headers required for invitation operations");
      }

      // Verify the invitation belongs to the specified org
      const [invitation] = await ctx.db
        .select({ id: schema.invitation.id, orgId: schema.invitation.orgId })
        .from(schema.invitation)
        .where(eq(schema.invitation.id, invitationId))
        .limit(1);

      if (!invitation) {
        throw new NotFoundError("Invitation", invitationId);
      }

      if (invitation.orgId !== orgId) {
        throw new ForbiddenError("Invitation does not belong to this organization");
      }

      // Use BetterAuth API to cancel invitation
      await ctx.auth.api.cancelInvitation({
        body: { invitationId },
        headers: ctx.headers,
      });
    },
  };
}
