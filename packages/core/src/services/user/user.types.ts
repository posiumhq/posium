/**
 * Type definitions for UserService.
 *
 * Re-exports types from db schema for consistency.
 */

import type { schema } from "@posium/db";

/**
 * User preferences (re-exported from db).
 */
export type UserPreferences = schema.UserPrefs;

/**
 * Org member preferences (re-exported from db).
 */
export type OrgMemberPreferences = schema.OrgMemberPrefs;

/**
 * Input for updating user preferences.
 */
export interface UpdateUserPreferencesInput {
  theme?: "light" | "dark" | "system";
  locale?: string;
  timezone?: string;
  defaultOrgId?: string;
  onboarding?: Record<string, boolean>;
}

/**
 * Input for updating org member preferences.
 */
export interface UpdateOrgMemberPreferencesInput {
  starredProjects?: string[];
  sidebarState?: Record<string, boolean>;
  projectSortOrder?: string[];
  [key: string]: unknown;
}

/**
 * User info for notifications and system operations.
 * Used by system actors to get user details from org member records.
 */
export interface UserInfo {
  userId: string;
  userName: string;
  userEmail: string;
}
