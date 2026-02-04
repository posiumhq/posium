/**
 * Type definitions for OrgService.
 */

import type { OrgRole } from "../../context.js";

/**
 * Organization with user's membership info and stats.
 */
export interface OrgWithStats {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: OrgRole;
  projectCount: number;
  memberCount: number;
}

/**
 * Basic organization info.
 */
export interface Org {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

/**
 * Organization with role info.
 */
export interface OrgWithRole extends Org {
  role: OrgRole;
}

/**
 * Input for creating an organization.
 */
export interface CreateOrgInput {
  name: string;
  slug: string;
  logo?: string;
}

/**
 * Input for updating an organization.
 */
export interface UpdateOrgInput {
  name?: string;
  slug?: string;
  logo?: string;
}

/**
 * Organization member info.
 */
export interface OrgMember {
  id: string;
  userId: string;
  orgId: string;
  role: OrgRole;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: Date;
}

/**
 * Options for listing members.
 */
export interface ListMembersOptions {
  orgId: string;
}

/**
 * Input for adding a member.
 */
export interface AddMemberInput {
  orgId: string;
  userId: string;
  role: OrgRole;
}

/**
 * Input for updating a member's role.
 */
export interface UpdateMemberRoleInput {
  orgId: string;
  memberId: string;
  role: OrgRole;
}

/**
 * Input for removing a member.
 */
export interface RemoveMemberInput {
  orgId: string;
  memberId: string;
}

/**
 * Org info for notifications and system operations.
 * Used by system actors to get org details from org member records.
 */
export interface OrgInfo {
  orgId: string;
  orgName: string;
  orgSlug: string;
}

/**
 * Input for creating an invitation.
 */
export interface CreateInvitationInput {
  orgId: string;
  email: string;
  role: "admin" | "member";
}

/**
 * Pending invitation info.
 */
export interface PendingInvitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviter: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Input for canceling an invitation.
 */
export interface CancelInvitationInput {
  orgId: string;
  invitationId: string;
}
