/**
 * Types for org-level API key management.
 *
 * These types define the structure for API key metadata, input/output types
 * for CRUD operations, and the overall API key info returned to clients.
 */

/**
 * Metadata stored with each API key.
 * Stored as JSON string in the BetterAuth apikey.metadata column.
 */
export interface ApiKeyMetadata {
  /** The organization that owns this key */
  organizationId: string;
  /** User ID of the person who created this key */
  createdBy: string;
  /** Last 5 characters of the key for display purposes */
  suffix: string;
  /** Whether this key is org-wide or project-scoped */
  scope: "org" | "project";
  /** List of project IDs this key can access (empty for org-wide) */
  projects: string[];
}

/**
 * Input for creating a new API key.
 */
export interface CreateKeyInput {
  /** Organization ID that will own this key */
  orgId: string;
  /** Human-readable name for the key */
  name: string;
  /** Scope of the key: org-wide or project-specific */
  scope: "org" | "project";
  /** Project IDs for project-scoped keys (required if scope is "project") */
  projectIds?: string[];
  /** Expiration in days (optional) */
  expiresInDays?: number;
  /** User ID of the person creating the key */
  createdBy: string;
}

/**
 * Input for updating an existing API key.
 */
export interface UpdateKeyInput {
  /** Organization ID (for verification) */
  orgId: string;
  /** ID of the key to update */
  keyId: string;
  /** New name (optional) */
  name?: string;
  /** Enable/disable the key (optional) */
  enabled?: boolean;
  /** New scope (optional) */
  scope?: "org" | "project";
  /** New project IDs (required if changing to project scope) */
  projectIds?: string[];
}

/**
 * API key info returned from list/get operations.
 * Never includes the actual key value (only shown on creation).
 */
export interface ApiKeyInfo {
  /** Unique key ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Masked display key (e.g., "apikey_•••••x7k2m") */
  displayKey: string;
  /** Whether the key is enabled */
  enabled: boolean;
  /** Expiration date (null if never expires) */
  expiresAt: Date | null;
  /** Creation date */
  createdAt: Date;
  /** User ID who created this key */
  createdBy: string;
  /** Key scope */
  scope: "org" | "project";
  /** Whether this key has org-wide access */
  isOrgWide: boolean;
  /** Projects this key can access (with names for display) */
  projects: Array<{ id: string; name: string }>;
}

/**
 * Result from creating a new API key.
 * Includes the full key value (only returned once on creation).
 */
export interface CreateKeyResult {
  /** Unique key ID */
  id: string;
  /** Full API key value - display once and never again! */
  key: string;
  /** Human-readable name */
  name: string;
  /** Key scope */
  scope: "org" | "project";
  /** Expiration date (null if never expires) */
  expiresAt: Date | null;
}
